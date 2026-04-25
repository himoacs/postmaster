import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface CreateTextRequest {
  title: string;
  content: string;
}

// POST /api/knowledge/text - Create knowledge entry from pasted text
export async function POST(request: NextRequest) {
  try {
    const { title, content } = (await request.json()) as CreateTextRequest;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    // Calculate word count
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    // Create knowledge entry
    const entry = await prisma.knowledgeEntry.create({
      data: {
        title: title.trim(),
        type: "text",
        source: "pasted",
        content: content.trim(),
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
        wordCount: entry.wordCount,
        isActive: entry.isActive,
        createdAt: entry.createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to create knowledge entry from text:", error);
    return NextResponse.json(
      { error: "Failed to create knowledge entry" },
      { status: 500 }
    );
  }
}
