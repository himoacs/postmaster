import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWithLiteLLM, createLiteLLMClient } from "@/lib/ai/litellm";
import { fetchUrlContent } from "@/lib/url-fetcher";
import { decrypt } from "@/lib/encryption";
import { SubpageLink } from "@/lib/url-crawler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface RelevantRequest {
  prompt: string;
  maxPages?: number;
}

const DEFAULT_MAX_PAGES = 3;

/**
 * POST /api/knowledge/[id]/relevant
 * 
 * Given a user prompt, uses an LLM to select the most relevant subpages
 * from the knowledge entry, fetches them on-demand, and returns combined content.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const body = (await request.json()) as RelevantRequest;
    const { prompt, maxPages = DEFAULT_MAX_PAGES } = body;

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Fetch the knowledge entry
    const entry = await prisma.knowledgeEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    // If no subpage links, just return the stored content
    if (!entry.subpageLinks) {
      return NextResponse.json({
        content: entry.content,
        sources: [{ url: entry.source, title: entry.title }],
        fromSubpages: false,
      });
    }

    const subpageLinks = entry.subpageLinks as SubpageLink[];
    
    if (subpageLinks.length === 0) {
      return NextResponse.json({
        content: entry.content,
        sources: [{ url: entry.source, title: entry.title }],
        fromSubpages: false,
      });
    }

    // Get LiteLLM config for the relevance selection
    const liteLLMConfig = await prisma.liteLLMConfig.findFirst({
      where: { isEnabled: true, isValid: true },
    });

    let selectedUrls: string[] = [];

    if (liteLLMConfig) {
      // Use LLM to select relevant pages
      selectedUrls = await selectRelevantPages(
        prompt,
        subpageLinks,
        maxPages,
        liteLLMConfig.endpoint,
        liteLLMConfig.apiKey ? decrypt(liteLLMConfig.apiKey) : undefined
      );
    } else {
      // Fallback: simple keyword matching
      selectedUrls = selectByKeywords(prompt, subpageLinks, maxPages);
    }

    // Always include the root content
    let combinedContent = `--- Main Page: ${entry.title} ---\n${entry.content}\n\n`;
    const sources: { url: string; title: string }[] = [
      { url: entry.source, title: entry.title },
    ];

    // Fetch selected subpages
    if (selectedUrls.length > 0) {
      const fetchPromises = selectedUrls.map(async (url) => {
        const result = await fetchUrlContent(url);
        if (result.content && !result.error) {
          const link = subpageLinks.find((l) => l.url === url);
          return {
            url,
            title: link?.title || result.title || url,
            content: result.content,
          };
        }
        return null;
      });

      const fetchedPages = await Promise.all(fetchPromises);
      
      for (const page of fetchedPages) {
        if (page) {
          combinedContent += `--- Subpage: ${page.title} ---\n${page.content}\n\n`;
          sources.push({ url: page.url, title: page.title });
        }
      }
    }

    return NextResponse.json({
      content: combinedContent.trim(),
      sources,
      fromSubpages: selectedUrls.length > 0,
      selectedCount: selectedUrls.length,
      availableCount: subpageLinks.length,
    });
  } catch (error) {
    console.error("Failed to fetch relevant content:", error);
    return NextResponse.json(
      { error: "Failed to fetch relevant content" },
      { status: 500 }
    );
  }
}

/**
 * Use LLM to select the most relevant subpage URLs based on the user's prompt
 */
async function selectRelevantPages(
  prompt: string,
  subpageLinks: SubpageLink[],
  maxPages: number,
  endpoint: string,
  apiKey?: string
): Promise<string[]> {
  // Build a list of available pages for the LLM
  const pageList = subpageLinks
    .map((link, i) => `${i + 1}. "${link.title}" - ${link.url}`)
    .join("\n");

  const systemPrompt = `You are a helpful assistant that selects the most relevant documentation pages based on a user's query.

Given a list of available pages and a user query, select up to ${maxPages} pages that would be most helpful for answering the query.

Respond with ONLY a JSON array of page numbers (1-indexed), like: [1, 3, 5]
If no pages seem relevant, respond with an empty array: []
Do not include any other text in your response.`;

  const userPrompt = `Available pages:
${pageList}

User query: "${prompt}"

Select the ${maxPages} most relevant page numbers:`;

  try {
    const { content } = await generateWithLiteLLM(
      endpoint,
      apiKey,
      "gpt-4o-mini", // Fast and cheap for this task
      systemPrompt,
      userPrompt
    );

    // Parse the response
    const match = content.match(/\[[\d,\s]*\]/);
    if (match) {
      const indices: number[] = JSON.parse(match[0]);
      return indices
        .filter((i) => i >= 1 && i <= subpageLinks.length)
        .slice(0, maxPages)
        .map((i) => subpageLinks[i - 1].url);
    }
  } catch (error) {
    console.error("LLM selection failed, falling back to keywords:", error);
  }

  // Fallback to keyword matching
  return selectByKeywords(prompt, subpageLinks, maxPages);
}

/**
 * Simple keyword-based selection fallback
 */
function selectByKeywords(
  prompt: string,
  subpageLinks: SubpageLink[],
  maxPages: number
): string[] {
  const promptWords = prompt.toLowerCase().split(/\s+/);
  
  // Score each link by keyword matches
  const scored = subpageLinks.map((link) => {
    const titleLower = link.title.toLowerCase();
    const urlLower = link.url.toLowerCase();
    
    let score = 0;
    for (const word of promptWords) {
      if (word.length < 3) continue; // Skip short words
      if (titleLower.includes(word)) score += 2;
      if (urlLower.includes(word)) score += 1;
    }
    
    return { url: link.url, score };
  });

  // Sort by score and take top N
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPages)
    .map((s) => s.url);
}
