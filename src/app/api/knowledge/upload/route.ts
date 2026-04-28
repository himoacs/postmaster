import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { parseOffice } from "officeparser";

// Import the internal lib directly to avoid pdf-parse's test file execution
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for larger documents

// Supported MIME types
const MIME_TYPE_MAP: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
};

// Also check by extension for files where MIME type may be incorrect
const EXTENSION_MAP: Record<string, string> = {
  ".pdf": "pdf",
  ".txt": "txt",
  ".md": "md",
  ".markdown": "md",
  ".docx": "docx",
  ".doc": "docx",
  ".pptx": "pptx",
  ".ppt": "ppt",
  ".xlsx": "xlsx",
  ".xls": "xls",
};

function getFileType(file: File): string | null {
  // Try MIME type first
  if (MIME_TYPE_MAP[file.type]) {
    return MIME_TYPE_MAP[file.type];
  }
  
  // Fall back to extension
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (ext && EXTENSION_MAP[ext]) {
    return EXTENSION_MAP[ext];
  }
  
  return null;
}

// Extract text from PDF
async function extractPdfText(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  return result.text;
}

// Extract text from DOCX
async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

// Extract text from XLSX/XLS
function extractExcelText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const texts: string[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    texts.push(`## ${sheetName}\n`);
    
    // Convert to CSV-like text format
    const csvText = XLSX.utils.sheet_to_csv(sheet);
    texts.push(csvText);
    texts.push("\n");
  }
  
  return texts.join("\n");
}

// Extract text from PPTX/PPT using officeparser
async function extractPptText(buffer: Buffer): Promise<string> {
  const result = await parseOffice(buffer);
  // parseOffice may return an AST or string depending on version
  if (typeof result === "string") {
    return result;
  }
  // If it returns an AST, extract text from it
  return String(result);
}

// POST /api/knowledge/upload - Create knowledge entry from file upload
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const customTitle = formData.get("title") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Detect file type
    const fileType = getFileType(file);
    if (!fileType) {
      return NextResponse.json(
        { error: "Unsupported file type. Supported: PDF, TXT, MD, DOCX, PPTX, XLSX" },
        { status: 400 }
      );
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text based on file type
    let content: string;
    
    try {
      switch (fileType) {
        case "pdf":
          content = await extractPdfText(buffer);
          break;
        case "docx":
          content = await extractDocxText(buffer);
          break;
        case "xlsx":
        case "xls":
          content = extractExcelText(buffer);
          break;
        case "pptx":
        case "ppt":
          content = await extractPptText(buffer);
          break;
        case "txt":
        case "md":
        default:
          content = buffer.toString("utf-8");
          break;
      }
    } catch (parseError) {
      console.error(`${fileType.toUpperCase()} parsing error:`, parseError);
      return NextResponse.json(
        { error: `Failed to parse ${fileType.toUpperCase()} file. The file may be corrupted or unsupported.` },
        { status: 400 }
      );
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "No text content could be extracted from the file" },
        { status: 400 }
      );
    }

    // Clean up content
    content = content.trim();

    // Calculate word count
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    // Use custom title or filename
    const fileExtRegex = /\.(pdf|txt|md|markdown|docx?|pptx?|xlsx?)$/i;
    const title = customTitle?.trim() || 
                  file.name.replace(fileExtRegex, "") || 
                  `Uploaded ${fileType.toUpperCase()}`;

    // Create knowledge entry
    const entry = await prisma.knowledgeEntry.create({
      data: {
        title,
        type: "file",
        source: file.name,
        mimeType: file.type || `application/${fileType}`,
        content,
        wordCount,
        isActive: true,
      },
    });

    return NextResponse.json({
      entry: {
        id: entry.id,
        title: entry.title,
        type: entry.type,
        source: entry.source,
        mimeType: entry.mimeType,
        wordCount: entry.wordCount,
        isActive: entry.isActive,
        createdAt: entry.createdAt,
      },
      preview: content.slice(0, 500) + (content.length > 500 ? "..." : ""),
    });
  } catch (error) {
    console.error("Failed to create knowledge entry from file:", error);
    return NextResponse.json(
      { error: "Failed to process file upload" },
      { status: 500 }
    );
  }
}
