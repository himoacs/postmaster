import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { discoverSubpageLinks } from "@/lib/url-crawler";

interface CreateUrlRequest {
  url: string;
  title?: string;
}

// POST /api/knowledge/url - Create knowledge entry from URL
// Now also discovers subpage links for dynamic fetching at generation time
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

    // Fetch content and discover subpage links
    const crawlResult = await discoverSubpageLinks(url);

    if (crawlResult.error) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${crawlResult.error}` },
        { status: 400 }
      );
    }

    if (!crawlResult.rootContent || crawlResult.rootContent.trim().length === 0) {
      return NextResponse.json(
        { error: "No content could be extracted from this URL" },
        { status: 400 }
      );
    }

    // Calculate word count
    const wordCount = crawlResult.rootContent.split(/\s+/).filter(Boolean).length;

    // Use custom title, fetched title, or URL hostname as fallback
    const title = customTitle || crawlResult.rootTitle || new URL(url).hostname;

    // Create knowledge entry with subpage links
    const entry = await prisma.knowledgeEntry.create({
      data: {
        title,
        type: "url",
        source: url,
        content: crawlResult.rootContent,
        wordCount,
        isActive: true,
        subpageLinks: crawlResult.subpageLinks.length > 0 ? crawlResult.subpageLinks : undefined,
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
        subpageCount: crawlResult.subpageLinks.length,
        createdAt: entry.createdAt,
      },
      preview: crawlResult.rootContent.slice(0, 500) + (crawlResult.rootContent.length > 500 ? "..." : ""),
    });
  } catch (error) {
    console.error("Failed to create knowledge entry from URL:", error);
    return NextResponse.json(
      { error: "Failed to create knowledge entry" },
      { status: 500 }
    );
  }
}
