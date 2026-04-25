import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchUrlContent } from "@/lib/url-fetcher";

interface CreateUrlRequest {
  url: string;
  title?: string;
}

// POST /api/knowledge/url - Create knowledge entry from URL
export async function POST(request: NextRequest) {
  try {
    const { url, title: customTitle } = (await request.json()) as CreateUrlRequest;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Fetch and extract content from URL
    const fetched = await fetchUrlContent(url);

    if (fetched.error) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${fetched.error}` },
        { status: 400 }
      );
    }

    if (!fetched.content || fetched.content.trim().length === 0) {
      return NextResponse.json(
        { error: "No content could be extracted from this URL" },
        { status: 400 }
      );
    }

    // Calculate word count
    const wordCount = fetched.content.split(/\s+/).filter(Boolean).length;

    // Use custom title, fetched title, or URL hostname as fallback
    const title = customTitle || fetched.title || new URL(url).hostname;

    // Create knowledge entry
    const entry = await prisma.knowledgeEntry.create({
      data: {
        title,
        type: "url",
        source: url,
        content: fetched.content,
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
      preview: fetched.content.slice(0, 500) + (fetched.content.length > 500 ? "..." : ""),
    });
  } catch (error) {
    console.error("Failed to create knowledge entry from URL:", error);
    return NextResponse.json(
      { error: "Failed to create knowledge entry" },
      { status: 500 }
    );
  }
}
