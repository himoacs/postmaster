import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface DiscoveredArticle {
  url: string;
  title: string;
}

// POST /api/samples/discover - Discover article links from an author/index page
export async function POST(request: NextRequest) {
  const { url, maxArticles = 10 } = await request.json();

  if (!url) {
    return NextResponse.json({ error: "URL required" }, { status: 400 });
  }

  // Validate URL
  let baseUrl: URL;
  try {
    baseUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    // Fetch the page
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PostMaster/1.0; +https://postmaster.app)",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Find article links using various common patterns
    const discoveredArticles: DiscoveredArticle[] = [];
    const seenUrls = new Set<string>();

    // Common selectors for article links on author/blog pages
    const articleSelectors = [
      // Direct article elements
      "article a[href]",
      ".post a[href]",
      ".blog-post a[href]",
      ".entry a[href]",
      
      // List items that are posts
      ".post-list a[href]",
      ".posts a[href]",
      ".articles a[href]",
      ".blog-list a[href]",
      
      // Card-style layouts
      ".post-card a[href]",
      ".article-card a[href]",
      ".blog-card a[href]",
      
      // Heading links (often titles)
      "h2 a[href]",
      "h3 a[href]",
      ".post-title a[href]",
      ".entry-title a[href]",
      ".article-title a[href]",
      
      // Generic content links
      "main a[href]",
      ".content a[href]",
      "#content a[href]",
    ];

    // Try each selector
    for (const selector of articleSelectors) {
      if (discoveredArticles.length >= maxArticles) break;

      $(selector).each((_, element) => {
        if (discoveredArticles.length >= maxArticles) return false;

        const href = $(element).attr("href");
        if (!href) return;

        // Resolve relative URLs
        let absoluteUrl: string;
        try {
          absoluteUrl = new URL(href, baseUrl).href;
        } catch {
          return;
        }

        // Skip if already seen
        if (seenUrls.has(absoluteUrl)) return;

        // Filter out non-article URLs
        if (!isLikelyArticleUrl(absoluteUrl, baseUrl.origin)) return;

        seenUrls.add(absoluteUrl);

        // Get title with multiple fallback strategies
        let title = extractArticleTitle($, element, absoluteUrl);

        // Skip if title looks like navigation
        if (isNavigationText(title)) return;

        discoveredArticles.push({
          url: absoluteUrl,
          title: title.substring(0, 200) || absoluteUrl,
        });
      });
    }

    // Remove duplicates and sort by title
    const uniqueArticles = Array.from(
      new Map(discoveredArticles.map((a) => [a.url, a])).values()
    ).slice(0, maxArticles);

    return NextResponse.json({
      sourceUrl: url,
      articles: uniqueArticles,
      totalFound: uniqueArticles.length,
    });
  } catch (error) {
    console.error("Error discovering articles:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to discover articles from URL",
      },
      { status: 500 }
    );
  }
}

/**
 * Extract a clean article title using multiple strategies
 */
function extractArticleTitle(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $: ReturnType<typeof cheerio.load>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  element: any,
  url: string
): string {
  const $el = $(element);
  
  // Strategy 1: Look for a heading in parent container
  const parent = $el.closest("article, .post, .entry, .blog-card, .post-card, li, div");
  const headingText = parent.find("h2, h3, h4, .title, .post-title, .entry-title").first().text().trim();
  if (headingText && headingText.length >= 5 && !looksLikeHtml(headingText)) {
    return cleanTitle(headingText);
  }
  
  // Strategy 2: Check for title attribute on the link
  const titleAttr = $el.attr("title");
  if (titleAttr && titleAttr.length >= 5 && !looksLikeHtml(titleAttr)) {
    return cleanTitle(titleAttr);
  }
  
  // Strategy 3: Check for image alt text inside the link
  const imgAlt = $el.find("img").first().attr("alt");
  if (imgAlt && imgAlt.length >= 5 && !looksLikeHtml(imgAlt)) {
    return cleanTitle(imgAlt);
  }
  
  // Strategy 4: Get all text content but clean it
  const allText = $el.text().trim();
  if (allText && allText.length >= 5 && !looksLikeHtml(allText)) {
    return cleanTitle(allText);
  }
  
  // Strategy 5: Extract readable title from URL slug
  return extractTitleFromUrl(url);
}

/**
 * Check if text looks like HTML
 */
function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

/**
 * Clean up a title string
 */
function cleanTitle(title: string): string {
  return title
    .replace(/<[^>]+>/g, "") // Remove any HTML tags
    .replace(/\s+/g, " ")    // Normalize whitespace
    .trim();
}

/**
 * Extract a readable title from a URL slug
 */
function extractTitleFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    // Get the last path segment
    const segments = pathname.split("/").filter(Boolean);
    const slug = segments[segments.length - 1] || "";
    
    // Convert slug to title case
    // e.g., "hedge-funds-capitalize-eda" -> "Hedge Funds Capitalize Eda"
    if (slug && slug.includes("-")) {
      return slug
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
    }
    
    return slug || url;
  } catch {
    return url;
  }
}

/**
 * Check if a URL is likely to be a blog article
 */
function isLikelyArticleUrl(url: string, origin: string): boolean {
  // Must be from the same origin
  if (!url.startsWith(origin)) return false;

  const path = url.replace(origin, "").toLowerCase();

  // Skip common non-article paths
  const skipPatterns = [
    /^\/$/,
    /^\/?#/,
    /^\/?(tag|category|author|page|search|login|register|contact|about|privacy|terms)/i,
    /\.(jpg|jpeg|png|gif|svg|pdf|zip|css|js)$/i,
    /\/feed\/?$/i,
    /\/rss\/?$/i,
    /\?/,
  ];

  if (skipPatterns.some((pattern) => pattern.test(path))) {
    return false;
  }

  // Common article URL patterns
  const articlePatterns = [
    /\/blog\//i,
    /\/post\//i,
    /\/article\//i,
    /\/\d{4}\/\d{2}\//i, // Date-based URLs like /2024/01/
    /\/[a-z0-9-]+\/?$/i, // Slug-style URLs ending in lowercase-dashes
  ];

  // If path has at least one segment and doesn't look like a category
  const segments = path.split("/").filter(Boolean);
  if (segments.length >= 1) {
    // If URL matches article patterns, likely an article
    if (articlePatterns.some((pattern) => pattern.test(path))) {
      return true;
    }
    // If it has a slug-like last segment (words with dashes)
    const lastSegment = segments[segments.length - 1];
    if (
      lastSegment &&
      lastSegment.includes("-") &&
      lastSegment.length > 10 &&
      !/^\d+$/.test(lastSegment)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Check if text looks like navigation rather than article title
 */
function isNavigationText(text: string): boolean {
  const navPatterns = [
    /^(home|about|contact|login|sign up|register|menu|nav|search|more|read more|continue)$/i,
    /^(previous|next|older|newer|page \d+)$/i,
    /^[\d\s,]+$/, // Just numbers
    /^.{0,3}$/, // Too short
  ];
  return navPatterns.some((pattern) => pattern.test(text.trim()));
}
