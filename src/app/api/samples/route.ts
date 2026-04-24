import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as cheerio from "cheerio";

// POST /api/samples - Add a content sample
export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (!url) {
    return NextResponse.json({ error: "URL required" }, { status: 400 });
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Check for duplicate
  const existing = await prisma.contentSample.findFirst({
    where: { url },
  });

  if (existing) {
    return NextResponse.json(
      { error: "This URL has already been added" },
      { status: 400 }
    );
  }

  try {
    // Fetch and extract content
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PostMaster/1.0; +https://postmaster.app)",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch URL");
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract title
    const title =
      $("title").text().trim() ||
      $("h1").first().text().trim() ||
      $('meta[property="og:title"]').attr("content")?.trim() ||
      url;

    // Extract main content (common article selectors)
    const contentSelectors = [
      "article",
      ".post-content",
      ".entry-content",
      ".article-content",
      ".content",
      "main",
      ".blog-post",
      "#content",
    ];

    let extractedText = "";
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        extractedText = element.text().trim();
        break;
      }
    }

    // Fallback to body text
    if (!extractedText) {
      // Remove scripts, styles, nav, footer, etc.
      $("script, style, nav, footer, header, aside, .sidebar, .comments").remove();
      extractedText = $("body").text().trim();
    }

    // Clean up whitespace
    extractedText = extractedText.replace(/\s+/g, " ").trim();

    // Calculate word count
    const wordCount = extractedText.split(/\s+/).filter(Boolean).length;

    // Create the sample
    const sample = await prisma.contentSample.create({
      data: {
        url,
        title: title.substring(0, 500),
        extractedText: extractedText.substring(0, 50000), // Limit stored text
        wordCount,
      },
    });

    return NextResponse.json({
      sample: {
        id: sample.id,
        url: sample.url,
        title: sample.title,
        wordCount: sample.wordCount,
        analyzedAt: sample.analyzedAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error extracting content:", error);
    return NextResponse.json(
      { error: "Failed to extract content from URL" },
      { status: 500 }
    );
  }
}

// DELETE /api/samples - Remove a content sample
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const sample = await prisma.contentSample.findUnique({
    where: { id },
  });

  if (!sample) {
    return NextResponse.json({ error: "Sample not found" }, { status: 404 });
  }

  await prisma.contentSample.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

// GET /api/samples - List content samples
export async function GET() {
  const samples = await prisma.contentSample.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      title: true,
      wordCount: true,
      analyzedAt: true,
    },
  });

  return NextResponse.json({ samples });
}
