/**
 * URL Crawler - Discovers subpage links from a root URL
 * 
 * Uses Jina Reader to fetch the page and extract markdown links,
 * then filters for same-domain internal links.
 */

export interface SubpageLink {
  url: string;
  title: string;
}

export interface CrawlResult {
  rootContent: string;
  rootTitle: string;
  subpageLinks: SubpageLink[];
  error?: string;
}

const MAX_LINKS = 50; // Maximum number of links to store

/**
 * Discover subpage links from a root URL
 * Fetches via Jina Reader and extracts same-domain links from the markdown
 */
export async function discoverSubpageLinks(rootUrl: string): Promise<CrawlResult> {
  try {
    const jinaUrl = `https://r.jina.ai/${rootUrl}`;
    const response = await fetch(jinaUrl, {
      headers: {
        "Accept": "text/plain",
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return {
        rootContent: "",
        rootTitle: "",
        subpageLinks: [],
        error: `Failed to fetch: ${response.status}`,
      };
    }

    const markdown = await response.text();
    
    // Extract title from first heading
    const lines = markdown.split("\n");
    let title = "";
    let contentStart = 0;
    
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line.startsWith("# ")) {
        title = line.slice(2).trim();
        contentStart = i + 1;
        break;
      }
      if (line.toLowerCase().startsWith("title:")) {
        title = line.slice(6).trim();
        contentStart = i + 1;
        break;
      }
    }

    const content = lines.slice(contentStart).join("\n").trim();

    // Parse the root URL to get domain
    const rootUrlObj = new URL(rootUrl);
    const rootDomain = rootUrlObj.hostname;

    // Extract links from markdown
    const links = extractLinksFromMarkdown(markdown, rootUrl, rootDomain);

    // Deduplicate and limit
    const uniqueLinks = deduplicateLinks(links);
    const limitedLinks = uniqueLinks.slice(0, MAX_LINKS);

    return {
      rootContent: truncateContent(content, 12000),
      rootTitle: title,
      subpageLinks: limitedLinks,
    };
  } catch (error) {
    return {
      rootContent: "",
      rootTitle: "",
      subpageLinks: [],
      error: error instanceof Error ? error.message : "Failed to crawl URL",
    };
  }
}

/**
 * Extract markdown links [text](url) from content
 * Filters for same-domain links only
 */
function extractLinksFromMarkdown(
  markdown: string,
  rootUrl: string,
  rootDomain: string
): SubpageLink[] {
  const links: SubpageLink[] = [];
  
  // Match markdown links: [title](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  
  while ((match = linkRegex.exec(markdown)) !== null) {
    const linkTitle = match[1].trim();
    let linkUrl = match[2].trim();
    
    // Skip anchors-only links
    if (linkUrl.startsWith("#")) continue;
    
    // Skip common non-content links
    if (isBoilerplateLink(linkUrl, linkTitle)) continue;
    
    // Resolve relative URLs
    try {
      const absoluteUrl = new URL(linkUrl, rootUrl).href;
      const urlObj = new URL(absoluteUrl);
      
      // Only same-domain links
      if (urlObj.hostname !== rootDomain) continue;
      
      // Skip if it's the same as root URL
      if (absoluteUrl === rootUrl || absoluteUrl === rootUrl + "/") continue;
      
      // Remove hash fragments for deduplication
      urlObj.hash = "";
      const cleanUrl = urlObj.href;
      
      links.push({
        url: cleanUrl,
        title: linkTitle,
      });
    } catch {
      // Invalid URL, skip
      continue;
    }
  }
  
  return links;
}

/**
 * Filter out boilerplate/navigation links
 */
function isBoilerplateLink(url: string, title: string): boolean {
  const boilerplatePatterns = [
    /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i,
    /^(mailto:|tel:|javascript:|data:)/i,
    /\/(login|logout|signin|signup|register|auth|oauth)/i,
    /#(footer|header|nav|sidebar|menu)/i,
  ];
  
  const boilerplateTitles = [
    /^(home|skip|back|next|previous|logo|menu|nav|search|login|sign\s*in|sign\s*up)$/i,
    /^[\d]+$/, // Just numbers
    /^[→←↑↓▶◀►◄]$/, // Arrow symbols
  ];
  
  for (const pattern of boilerplatePatterns) {
    if (pattern.test(url)) return true;
  }
  
  for (const pattern of boilerplateTitles) {
    if (pattern.test(title)) return true;
  }
  
  return false;
}

/**
 * Deduplicate links by URL, keeping the first occurrence
 */
function deduplicateLinks(links: SubpageLink[]): SubpageLink[] {
  const seen = new Set<string>();
  const unique: SubpageLink[] = [];
  
  for (const link of links) {
    // Normalize URL for comparison (remove trailing slash)
    const normalizedUrl = link.url.replace(/\/$/, "");
    
    if (!seen.has(normalizedUrl)) {
      seen.add(normalizedUrl);
      unique.push(link);
    }
  }
  
  return unique;
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
