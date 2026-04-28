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

const DEFAULT_MAX_PAGES = 5;

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

    console.log("[Knowledge Relevance API] Entry found:", {
      id: entry.id,
      title: entry.title,
      type: entry.type,
      contentLength: entry.content?.length || 0,
      contentPreview: entry.content?.slice(0, 200) || "(empty)",
      hasSubpageLinks: !!entry.subpageLinks,
    });

    // Get LiteLLM config for relevance extraction
    const liteLLMConfig = await prisma.liteLLMConfig.findFirst({
      where: { isEnabled: true, isValid: true },
    });

    // Get user preferences for primary model
    const preferences = await prisma.userPreferences.findFirst();
    let modelId = "gpt-4o-mini"; // Default fallback for relevance selection
    
    if (preferences?.primaryModelProvider && preferences?.primaryModelId) {
      modelId = preferences.primaryModelId;
      console.log("[Knowledge Relevance API] Using user's primary model:", modelId);
    } else {
      console.log("[Knowledge Relevance API] No primary model set, using default:", modelId);
    }

    // For entries without subpage links (text, file, or simple URL entries)
    // Use LLM to extract relevant sections if content is large enough
    if (!entry.subpageLinks || (entry.subpageLinks as unknown as SubpageLink[]).length === 0) {
      const content = entry.content || "";
      const EXTRACTION_THRESHOLD = 4000; // Only extract if content is large
      
      // If content is small or no LLM available, return as-is
      if (content.length < EXTRACTION_THRESHOLD || !liteLLMConfig) {
        return NextResponse.json({
          content: content,
          sources: [{ url: entry.source, title: entry.title }],
          fromSubpages: false,
          extracted: false,
        });
      }
      
      // Use LLM to extract relevant sections
      console.log("[Knowledge Relevance API] Extracting relevant sections from large content:", {
        entryId: id,
        contentLength: content.length,
        prompt: prompt.slice(0, 100),
      });
      
      try {
        const extractedContent = await extractRelevantSections(
          prompt,
          content,
          entry.title,
          liteLLMConfig.endpoint,
          liteLLMConfig.encryptedKey ? decrypt(liteLLMConfig.encryptedKey) : undefined,
          modelId
        );
        
        return NextResponse.json({
          content: extractedContent,
          sources: [{ url: entry.source, title: entry.title }],
          fromSubpages: false,
          extracted: true,
          originalLength: content.length,
          extractedLength: extractedContent.length,
        });
      } catch (error) {
        console.error("[Knowledge Relevance API] Extraction failed, returning full content:", error);
        return NextResponse.json({
          content: content,
          sources: [{ url: entry.source, title: entry.title }],
          fromSubpages: false,
          extracted: false,
        });
      }
    }

    const subpageLinks = entry.subpageLinks as unknown as SubpageLink[];

    let selectedUrls: string[] = [];

    if (liteLLMConfig) {
      // Use LLM to select relevant pages
      selectedUrls = await selectRelevantPages(
        prompt,
        subpageLinks,
        maxPages,
        liteLLMConfig.endpoint,
        liteLLMConfig.encryptedKey ? decrypt(liteLLMConfig.encryptedKey) : undefined,
        modelId
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

    console.log("[Knowledge Relevance API] Processing:", {
      entryId: id,
      entryTitle: entry.title,
      prompt: prompt.slice(0, 100),
      subpageCount: subpageLinks.length,
      selectedUrls: selectedUrls,
      rootContentLength: entry.content?.length || 0,
    });

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
  apiKey?: string,
  modelId: string = "gpt-4o-mini"
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
    console.log("[Knowledge Relevance API] Selecting pages with model:", modelId);
    const { content } = await generateWithLiteLLM(
      endpoint,
      apiKey,
      modelId,
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
 * Improved keyword-based selection fallback with phrase matching and term weighting
 */
function selectByKeywords(
  prompt: string,
  subpageLinks: SubpageLink[],
  maxPages: number
): string[] {
  const promptLower = prompt.toLowerCase();
  const promptWords = promptLower.split(/\s+/).filter(w => w.length >= 3);
  
  // Extract potential phrases (2-3 word combinations)
  const phrases: string[] = [];
  for (let i = 0; i < promptWords.length - 1; i++) {
    phrases.push(promptWords.slice(i, i + 2).join(" "));
    if (i < promptWords.length - 2) {
      phrases.push(promptWords.slice(i, i + 3).join(" "));
    }
  }
  
  // Common stop words to reduce weight
  const stopWords = new Set(["the", "and", "for", "with", "how", "what", "why", "when", "where", "who", "can", "will", "about", "your", "from", "have", "this", "that", "these", "those"]);
  
  // Score each link by keyword matches
  const scored = subpageLinks.map((link) => {
    const titleLower = link.title.toLowerCase();
    const urlLower = link.url.toLowerCase();
    
    let score = 0;
    
    // Exact phrase matches get highest score
    for (const phrase of phrases) {
      if (titleLower.includes(phrase)) score += 10;
      if (urlLower.includes(phrase)) score += 5;
    }
    
    // Individual word matches
    for (const word of promptWords) {
      // Skip stop words for scoring
      if (stopWords.has(word)) continue;
      
      // Exact word boundary match in title (higher value)
      const titleWordMatch = new RegExp(`\\b${word}\\b`, "i").test(titleLower);
      if (titleWordMatch) score += 4;
      else if (titleLower.includes(word)) score += 2;
      
      // URL path segment match
      if (urlLower.includes(`/${word}`) || urlLower.includes(`-${word}`)) score += 2;
      else if (urlLower.includes(word)) score += 1;
    }
    
    return { url: link.url, title: link.title, score };
  });

  // Sort by score and take top N
  const selected = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPages);
  
  console.log("[Knowledge Relevance API] Keyword selection scores:", 
    selected.map(s => ({ title: s.title.slice(0, 50), score: s.score })));
  
  return selected.map((s) => s.url);
}

/**
 * Use LLM to extract only the relevant sections from a large text content
 * This is used for text/file KB entries that don't have subpages
 */
async function extractRelevantSections(
  userPrompt: string,
  content: string,
  entryTitle: string,
  endpoint: string,
  apiKey?: string,
  modelId: string = "gpt-4o-mini"
): Promise<string> {
  // Split content into sections/paragraphs for the LLM to evaluate
  const sections = splitIntoSections(content);
  
  if (sections.length <= 3) {
    // Content is already small enough, return as-is
    return content;
  }
  
  // Build section list for LLM
  const sectionList = sections
    .map((section, i) => {
      // Truncate long sections for the selection prompt
      const preview = section.length > 300 
        ? section.slice(0, 300) + "..." 
        : section;
      return `[Section ${i + 1}]\n${preview}`;
    })
    .join("\n\n");

  const systemPrompt = `You are a helpful assistant that identifies the most relevant sections of a document based on a user's query.

Given a document split into sections and a user query, identify which sections contain information most relevant to answering the query.

INSTRUCTIONS:
1. Read the user's query carefully to understand what information they need
2. Scan through the sections and identify which ones contain relevant information
3. Select ALL sections that contain useful context (aim for 3-7 most relevant sections)
4. Respond with ONLY a JSON array of section numbers (1-indexed), like: [1, 3, 5, 7]
5. If no sections seem directly relevant, return the first few sections: [1, 2, 3]

Do not include any other text in your response, only the JSON array.`;

  const llmPrompt = `Document: "${entryTitle}"

Available sections:
${sectionList}

User query: "${userPrompt}"

Select the most relevant section numbers:`;

  try {
    console.log("[Knowledge Relevance API] Asking LLM to select sections:", {
      totalSections: sections.length,
      modelId,
    });
    
    const { content: response } = await generateWithLiteLLM(
      endpoint,
      apiKey,
      modelId,
      systemPrompt,
      llmPrompt
    );

    // Parse the response
    const match = response.match(/\[[\d,\s]*\]/);
    if (match) {
      const indices: number[] = JSON.parse(match[0]);
      const validIndices = indices
        .filter((i) => i >= 1 && i <= sections.length)
        .slice(0, 10); // Max 10 sections
      
      if (validIndices.length > 0) {
        const selectedSections = validIndices.map((i) => sections[i - 1]);
        const extracted = selectedSections.join("\n\n---\n\n");
        
        console.log("[Knowledge Relevance API] Extracted sections:", {
          selectedIndices: validIndices,
          selectedCount: validIndices.length,
          totalSections: sections.length,
          originalLength: content.length,
          extractedLength: extracted.length,
        });
        
        return `[Extracted ${validIndices.length} relevant sections from "${entryTitle}"]\n\n${extracted}`;
      }
    }
  } catch (error) {
    console.error("[Knowledge Relevance API] Section selection failed:", error);
  }

  // Fallback: return first portion of content
  console.log("[Knowledge Relevance API] Fallback: returning first sections");
  const fallbackSections = sections.slice(0, 5);
  return `[First sections from "${entryTitle}"]\n\n${fallbackSections.join("\n\n---\n\n")}`;
}

/**
 * Split content into logical sections (paragraphs, headings, etc.)
 */
function splitIntoSections(content: string): string[] {
  // First, try to split by markdown headings
  const headingPattern = /^#{1,3}\s+.+$/gm;
  const hasHeadings = headingPattern.test(content);
  
  if (hasHeadings) {
    // Split by headings, keeping the heading with its content
    const parts = content.split(/(?=^#{1,3}\s+)/m);
    const sections = parts
      .map(s => s.trim())
      .filter(s => s.length > 50); // Filter out tiny sections
    
    if (sections.length >= 3) {
      return sections;
    }
  }
  
  // Fallback: split by double newlines (paragraphs)
  const paragraphs = content
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 30); // Filter out tiny paragraphs
  
  // If still too many small sections, combine adjacent paragraphs
  if (paragraphs.length > 20) {
    const combined: string[] = [];
    let current = "";
    
    for (const p of paragraphs) {
      if (current.length + p.length < 800) {
        current = current ? `${current}\n\n${p}` : p;
      } else {
        if (current) combined.push(current);
        current = p;
      }
    }
    if (current) combined.push(current);
    
    return combined;
  }
  
  return paragraphs.length > 0 ? paragraphs : [content];
}
