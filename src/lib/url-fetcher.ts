/**
 * URL Content Fetcher
 * 
 * Fetches and extracts readable content from URLs for use as reference material.
 * Uses a simple HTML-to-text extraction approach.
 */

export interface FetchedContent {
  url: string;
  title: string;
  content: string;
  error?: string;
}

/**
 * Fetch content from a URL and extract readable text
 */
export async function fetchUrlContent(url: string): Promise<FetchedContent> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "PostMaster/1.0 (Content Reference Fetcher)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      return {
        url,
        title: "",
        content: "",
        error: `Failed to fetch: ${response.status} ${response.statusText}`,
      };
    }

    const html = await response.text();
    const { title, content } = extractContent(html);

    return {
      url,
      title,
      content: truncateContent(content, 8000), // Limit content size
    };
  } catch (error) {
    return {
      url,
      title: "",
      content: "",
      error: error instanceof Error ? error.message : "Failed to fetch URL",
    };
  }
}

/**
 * Fetch multiple URLs in parallel
 */
export async function fetchMultipleUrls(urls: string[]): Promise<FetchedContent[]> {
  const results = await Promise.all(urls.map(fetchUrlContent));
  return results;
}

/**
 * Extract title and main content from HTML
 */
function extractContent(html: string): { title: string; content: string } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : "";

  // Remove script, style, nav, footer, header, and other non-content elements
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, " ")
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, " ")
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // Try to find main content area
  const mainMatch = cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ||
                    cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
                    cleaned.match(/<div[^>]*(?:class|id)=["'][^"']*(?:content|main|article)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

  const contentHtml = mainMatch ? mainMatch[1] : cleaned;

  // Convert to text
  let text = contentHtml
    // Add newlines for block elements
    .replace(/<\/?(p|div|h[1-6]|li|br|tr)[^>]*>/gi, "\n")
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, " ")
    // Decode HTML entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up whitespace
    .replace(/\s+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, content: text };
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
}

/**
 * Truncate content to a maximum length while preserving word boundaries
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  
  const truncated = content.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  
  return (lastSpace > maxLength * 0.8 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

/**
 * Format fetched content for inclusion in a prompt
 */
export function formatReferencesForPrompt(
  references: Array<{ type: "url" | "text"; value: string }>,
  fetchedContent: FetchedContent[]
): string {
  const parts: string[] = [];

  // Add URL content
  for (const fetched of fetchedContent) {
    if (fetched.content && !fetched.error) {
      parts.push(`--- Reference from ${fetched.url} ---`);
      if (fetched.title) {
        parts.push(`Title: ${fetched.title}`);
      }
      parts.push(fetched.content);
      parts.push("");
    }
  }

  // Add direct text references
  const textRefs = references.filter(r => r.type === "text");
  for (const ref of textRefs) {
    parts.push("--- User-provided reference content ---");
    parts.push(ref.value);
    parts.push("");
  }

  if (parts.length === 0) return "";

  return `\n\nREFERENCE MATERIALS (Use these to inform your writing):\n\n${parts.join("\n")}`;
}
