import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

// Import the internal lib directly to avoid pdf-parse's test file execution
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Supported MIME types for content enhancement
const MIME_TYPE_MAP: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

// Extension fallback
const EXTENSION_MAP: Record<string, string> = {
  ".pdf": "pdf",
  ".txt": "txt",
  ".md": "md",
  ".markdown": "md",
  ".docx": "docx",
  ".doc": "docx",
};

function getFileType(file: File): string | null {
  if (MIME_TYPE_MAP[file.type]) {
    return MIME_TYPE_MAP[file.type];
  }
  
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

// Count words in text
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// POST /api/content/extract - Extract text from uploaded file
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

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
        { error: "Unsupported file type. Supported: PDF, DOCX, MD, TXT" },
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

    // Clean up the content
    content = content.trim();
    
    if (!content) {
      return NextResponse.json(
        { error: "No text content could be extracted from the file." },
        { status: 400 }
      );
    }

    const wordCount = countWords(content);

    return NextResponse.json({
      content,
      wordCount,
      fileName: file.name,
      fileType,
    });
  } catch (error) {
    console.error("Content extraction error:", error);
    return NextResponse.json(
      { error: "Failed to extract content from file" },
      { status: 500 }
    );
  }
}
