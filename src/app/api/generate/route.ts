import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { ContentType, AIProvider, LiteLLMModel, ModelInfo } from "@/types";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { generateWithAnthropic } from "@/lib/ai/claude";
import { generateWithMistral } from "@/lib/ai/mistral";
import { generateWithGrok } from "@/lib/ai/grok";
import { generateWithLiteLLM } from "@/lib/ai/litellm";
import { selectOptimalModels } from "@/lib/ai/model-scorer";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { GenerationOutput, SelectedModel } from "@/types";
import { fetchMultipleUrls, formatReferencesForPrompt } from "@/lib/url-fetcher";
import { buildAntiPatternPromptSection } from "@/lib/ai/anti-patterns";

interface ReferenceInput {
  type: "url" | "text";
  value: string;
}

interface GenerationRequest {
  prompt: string;
  contentType: string;
  lengthPref: string;
  selectedModels?: SelectedModel[];
  yoloMode?: boolean; // Auto-select optimal models
  references?: ReferenceInput[];
  enableCitations?: boolean; // Include inline source citations
  contentMode?: "new" | "enhance"; // New content or enhance existing
  existingContent?: string; // Content to enhance (when mode is "enhance")
}

// POST /api/generate - Generate content with multiple models
export async function POST(request: NextRequest) {
  try {
    const { prompt, contentType, lengthPref, selectedModels: requestedModels, yoloMode, references, enableCitations, contentMode, existingContent } =
      (await request.json()) as GenerationRequest;

    console.log("[Generate API] Received request:", {
      promptLength: prompt?.length,
      contentType,
      yoloMode,
      requestedModelsCount: requestedModels?.length,
      requestedModels: requestedModels?.map(m => `${m.provider}:${m.modelId}`),
    });

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

  // Fetch URL content if references provided
  let referenceContext = "";
  let sourceMap: Array<{ url: string; title: string }> = []; // For citation links
  if (references && references.length > 0) {
    const urlRefs = references.filter(r => r.type === "url").map(r => r.value);
    const fetchedContent = urlRefs.length > 0 ? await fetchMultipleUrls(urlRefs) : [];
    referenceContext = formatReferencesForPrompt(references, fetchedContent);
    
    // Log reference content for debugging
    console.log("[Generate API] Reference materials:", {
      totalRefs: references.length,
      urlRefs: urlRefs.length,
      textRefs: references.filter(r => r.type === "text").length,
      referenceContextLength: referenceContext.length,
      referenceContextPreview: referenceContext.slice(0, 500) + (referenceContext.length > 500 ? "..." : ""),
    });
    
    // Build source map for citations with links
    sourceMap = fetchedContent
      .filter(fc => fc.content && !fc.error)
      .map(fc => {
        try {
          return { url: fc.url, title: fc.title || new URL(fc.url).hostname };
        } catch {
          return { url: fc.url, title: fc.title || fc.url };
        }
      });
    
    // Add Knowledge Base entries to source map
    const textRefs = references.filter(r => r.type === "text");
    for (const ref of textRefs) {
      const match = ref.value.match(/^\[Knowledge Base: ([^\]]+)\]/);
      if (match) {
        sourceMap.push({ url: "", title: match[1] });
      }
    }
  }

  // Get style profile
  const styleProfile = await prisma.styleProfile.findFirst();

  // Get API keys
  const apiKeys = await prisma.aPIKey.findMany({
    where: { isValid: true },
  });

  // Get LiteLLM config
  const liteLLMConfig = await prisma.liteLLMConfig.findFirst({
    where: { isEnabled: true, isValid: true },
  });

  // Parse LiteLLM models
  let liteLLMModels: LiteLLMModel[] = [];
  if (liteLLMConfig) {
    try {
      liteLLMModels = JSON.parse(liteLLMConfig.cachedModels);
    } catch {
      liteLLMModels = [];
    }
  }

  // Determine which models to use
  let selectedModels: SelectedModel[];
  let yoloReasoning: string[] = [];

  if (yoloMode) {
    // YOLO mode: auto-select optimal models
    const availableModels: Array<{ provider: AIProvider; models: ModelInfo[] }> = [];
    
    // Add models from providers with valid API keys
    for (const apiKey of apiKeys) {
      const provider = apiKey.provider as AIProvider;
      if (provider !== "STABILITY" && provider !== "LITELLM") {
        const providerConfig = AI_PROVIDERS[provider];
        if (providerConfig) {
          // Filter to only models that are in the validModels list
          let validModelIds: string[] = [];
          try {
            validModelIds = JSON.parse(apiKey.validModels);
          } catch {
            // If parsing fails, allow all models from config
            validModelIds = [];
          }
          
          // Use fuzzy matching: API returns versioned model IDs like "gpt-4o-2024-08-06"
          // but we define base models like "gpt-4o". Match if any valid ID starts with or contains config model ID.
          const validModels = providerConfig.models.filter(m => 
            validModelIds.length === 0 || 
            validModelIds.includes(m.id) ||
            validModelIds.some(vid => vid.startsWith(m.id) || vid.includes(m.id))
          );
          
          if (validModels.length > 0) {
            availableModels.push({ provider, models: validModels });
          }
        }
      }
    }

    const selection = selectOptimalModels(availableModels, liteLLMModels, 3);
    selectedModels = selection.models;
    yoloReasoning = selection.reasoning;

    if (selectedModels.length === 0) {
      return NextResponse.json(
        { error: "No models available. Configure API keys or LiteLLM in Settings." },
        { status: 400 }
      );
    }
  } else {
    // Manual mode: use requested models
    if (!requestedModels || requestedModels.length < 1) {
      return NextResponse.json(
        { error: "At least 1 model required" },
        { status: 400 }
      );
    }
    selectedModels = requestedModels;
  }

  console.log("[Generate API] Selected models:", {
    count: selectedModels.length,
    models: selectedModels.map(m => `${m.provider}:${m.modelId}`),
    isYoloMode: yoloMode,
  });

  // Create generation record
  const generation = await prisma.generation.create({
    data: {
      prompt,
      contentType: contentType as ContentType,
      lengthPref,
      styleContext: styleProfile ? JSON.stringify(styleProfile) : null,
      status: "GENERATING",
      contentMode: contentMode || "new",
      sourceContent: contentMode === "enhance" ? existingContent : null,
      sourceMap: sourceMap.length > 0 ? JSON.stringify(sourceMap) : null,
    },
  });

  // Build system prompt
  const hasReferences = references && references.length > 0;
  const systemPrompt = buildSystemPrompt(styleProfile, contentType, lengthPref, enableCitations, hasReferences, contentMode, existingContent, sourceMap);

  // Build user prompt with references
  const userPrompt = prompt + referenceContext;

  // Generate with each selected model in parallel
  const outputs: GenerationOutput[] = [];
  const failedModels: { provider: string; model: string; error: string }[] = [];

  type GenerateResult = 
    | { success: true; output: GenerationOutput }
    | { success: false; provider: string; model: string; error: string };

  const generatePromises = selectedModels.map(async (model): Promise<GenerateResult> => {
    const startTime = Date.now();

    // Helper function to call the appropriate provider
    const callProvider = async (): Promise<{ content: string; tokensUsed: number }> => {
      if (model.provider === "LITELLM") {
        // Use LiteLLM proxy
        if (!liteLLMConfig) {
          throw new Error("LiteLLM not configured");
        }
        
        // Decrypt LiteLLM API key if present
        let liteLLMKey: string | undefined;
        if (liteLLMConfig.encryptedKey) {
          try {
            liteLLMKey = decrypt(liteLLMConfig.encryptedKey);
          } catch {
            throw new Error("Failed to decrypt API key");
          }
        }

        return await generateWithLiteLLM(
          liteLLMConfig.endpoint,
          liteLLMKey,
          model.modelId,
          systemPrompt,
          userPrompt
        );
      } else {
        // Use direct API
        const apiKey = apiKeys.find((k) => k.provider === model.provider);
        if (!apiKey) {
          throw new Error("API key not found");
        }

        const decryptedKey = decrypt(apiKey.encryptedKey);

        switch (model.provider) {
          case "OPENAI":
            return await generateWithOpenAI(
              decryptedKey,
              model.modelId,
              systemPrompt,
              userPrompt
            );
          case "ANTHROPIC":
            return await generateWithAnthropic(
              decryptedKey,
              model.modelId,
              systemPrompt,
              userPrompt
            );
          case "MISTRAL":
            return await generateWithMistral(
              decryptedKey,
              model.modelId,
              systemPrompt,
              userPrompt
            );
          case "XAI":
            return await generateWithGrok(
              decryptedKey,
              model.modelId,
              systemPrompt,
              userPrompt
            );
          default:
            throw new Error("Unknown provider");
        }
      }
    };

    try {
      let result = await callProvider();

      // Auto-retry once if content is empty
      if (!result.content || result.content.trim() === "") {
        console.log(`[Generate API] Empty response from ${model.provider}:${model.modelId}, auto-retrying...`);
        result = await callProvider();
      }

      const latencyMs = Date.now() - startTime;

      // Check if still empty after retry
      if (!result.content || result.content.trim() === "") {
        console.log(`[Generate API] Still empty after retry from ${model.provider}:${model.modelId}`);
        
        // Store empty output with error flag in database
        await prisma.generationOutput.create({
          data: {
            generationId: generation.id,
            provider: model.provider,
            model: model.modelId,
            content: "",
            tokensUsed: result.tokensUsed || 0,
            latencyMs,
          },
        });

        return {
          success: true, // Still "success" so it shows in UI, but with error flag
          output: {
            provider: model.provider,
            model: model.modelId,
            content: "",
            tokensUsed: result.tokensUsed,
            latencyMs,
            error: "Model returned empty response",
          },
        };
      }

      // Store output in database
      await prisma.generationOutput.create({
        data: {
          generationId: generation.id,
          provider: model.provider,
          model: model.modelId,
          content: result.content,
          tokensUsed: result.tokensUsed,
          latencyMs,
        },
      });

      return {
        success: true,
        output: {
          provider: model.provider,
          model: model.modelId,
          content: result.content,
          tokensUsed: result.tokensUsed,
          latencyMs,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Error generating with ${model.provider}:`, error);
      return { success: false, provider: model.provider, model: model.modelId, error: errorMessage };
    }
  });

  const results = await Promise.all(generatePromises);
  
  for (const result of results) {
    if (result.success) {
      outputs.push(result.output);
    } else {
      failedModels.push({ provider: result.provider, model: result.model, error: result.error });
    }
  }

  console.log("[Generate API] Results:", {
    totalModels: selectedModels.length,
    successfulOutputs: outputs.length,
    failedModels: failedModels.map(f => `${f.provider}:${f.model} - ${f.error}`),
  });

  // Update generation status
  await prisma.generation.update({
    where: { id: generation.id },
    data: { status: outputs.length > 0 ? "COMPLETED" : "FAILED" },
  });

  if (outputs.length === 0) {
    return NextResponse.json(
      { error: "All generation attempts failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    generationId: generation.id,
    outputs,
    sourceMap, // Include sourceMap for frontend use
    ...(failedModels.length > 0 && { failedModels }),
    ...(yoloMode && {
      yoloSelection: {
        models: selectedModels,
        reasoning: yoloReasoning,
      },
    }),
  });
  } catch (error) {
    console.error("[Generate API] Unhandled error:", error);
    return NextResponse.json(
      { 
        error: "Failed to generate content", 
        details: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}

function getContentTypeGuidance(contentType: string): string {
  const guidance: Record<string, string> = {
    BLOG_POST: `Content format: BLOG POST

FORMAT REQUIREMENTS:
- Use a compelling headline/title at the start
- Structure with clear sections using H2/H3 headings where appropriate
- Include an engaging introduction that hooks the reader
- Use paragraphs of 2-4 sentences for readability
- Include a conclusion with a takeaway or call-to-action
- Aim for a conversational yet informative tone`,

    TWEET_THREAD: `Content format: TWEET THREAD

FORMAT REQUIREMENTS:
- Start with a hook tweet that grabs attention (no numbering on first tweet)
- Number subsequent tweets as "2/", "3/", etc. at the START of each tweet
- Each tweet MUST be under 280 characters (this is critical - Twitter's limit)
- Use line breaks between tweets for clarity
- End with a summary or call-to-action tweet
- Use short, punchy sentences
- Emojis are acceptable for emphasis (sparingly)
- Include a "🧵" or "Thread:" indicator in the first tweet if appropriate`,

    LINKEDIN_POST: `Content format: LINKEDIN POST

FORMAT REQUIREMENTS:
- Start with a strong hook in the first 1-2 lines (this is what shows before "see more")
- Use short paragraphs (1-3 lines) with line breaks for scannability
- Include a personal angle or story when possible
- Professional but authentic tone
- End with a question or call-to-action to encourage engagement
- 3-5 relevant hashtags at the end (not inline)
- Emojis can be used sparingly for visual breaks
- Ideal length: 1,300-2,000 characters for maximum engagement`,

    EMAIL: `Content format: EMAIL

FORMAT REQUIREMENTS:
- Start with "Subject:" followed by a clear, compelling subject line
- Include appropriate greeting based on context (formal/informal)
- Get to the point quickly in the opening paragraph
- Use bullet points for lists or multiple items
- Clear call-to-action if applicable
- Professional sign-off
- Keep paragraphs short and scannable
- If it's a cold email, keep it brief (under 150 words for body)`,

    ARTICLE: `Content format: ARTICLE

FORMAT REQUIREMENTS:
- Professional, well-researched tone
- Strong headline and optional subheadline
- Structured with clear sections and headings
- Introduction that establishes context and importance
- Well-developed body with supporting evidence or examples
- Conclusion that summarizes key points
- Formal but accessible language
- Can include blockquotes for emphasis`,

    OTHER: `Content format: GENERAL CONTENT

FORMAT REQUIREMENTS:
- Clear structure appropriate to the content
- Engaging opening
- Well-organized body
- Strong conclusion
- Adapt tone to the subject matter`,
  };

  return guidance[contentType] || guidance.OTHER;
}

function buildSystemPrompt(
  styleProfile: {
    tone?: string | null;
    voice?: string | null;
    vocabulary?: string | null;
    sentence?: string | null;
    patterns?: string | null;
    bio?: string | null;
    context?: string | null;
    // Enhanced style fields
    uniqueVocabulary?: string | null;
    avoidPatterns?: string | null;
    writingQuirks?: string | null;
    sampleExcerpts?: string | null;
    openingStyles?: string | null;
    closingStyles?: string | null;
  } | null,
  contentType: string,
  lengthPref: string,
  enableCitations?: boolean,
  hasReferences?: boolean,
  contentMode?: "new" | "enhance",
  existingContent?: string,
  sourceMap?: Array<{ url: string; title: string }>
): string {
  const lengthGuide = {
    short: "around 300 words",
    medium: "around 600 words",
    long: "around 1200 words",
  }[lengthPref] || "a medium length";

  let prompt = "";
  
  // Different instructions based on content mode
  if (contentMode === "enhance" && existingContent) {
    prompt = `You are a professional content editor and writer. Your task is to ENHANCE and IMPROVE the existing content provided below based on the user's instructions.

EXISTING CONTENT TO ENHANCE:
---
${existingContent}
---

${getContentTypeGuidance(contentType)}

IMPORTANT INSTRUCTIONS:
- Preserve the core message and key information from the original content
- Apply the user's requested changes/improvements throughout
- Maintain a similar length unless instructed otherwise (target ${lengthGuide})
- Improve clarity, flow, and engagement while keeping the original intent
- Do NOT add fabricated information or claims not present in the original
- Use the existing content as your primary source of facts

`;
  } else {
    prompt = `You are a professional content writer. Write ${lengthGuide} of high-quality content.

${getContentTypeGuidance(contentType)}

`;
  }

  // CRITICAL: Add grounding instructions when references exist
  if (hasReferences) {
    prompt += `
CRITICAL - REFERENCE MATERIAL GROUNDING:
You have been provided with REFERENCE MATERIALS at the end of the user's message. These are your AUTHORITATIVE source of truth.

MANDATORY PROCESS - Follow this BEFORE writing:
1. SCAN the reference materials thoroughly to understand the available information
2. IDENTIFY the key concepts, terms, acronyms, and facts that relate to the prompt
3. EXTRACT exact definitions, descriptions, and explanations from the references
4. MAP each claim you make to specific content in the references

STRICT RULES:
1. For ANY technical terms, acronyms, or domain-specific concepts mentioned in the prompt, FIRST look them up in the reference materials
2. ONLY use definitions, explanations, and facts that appear in the reference materials
3. If an acronym appears in the prompt (like "MNR", "API", "SDK"), search the references for its expanded form - DO NOT guess or invent meanings
4. QUOTE or closely paraphrase key definitions rather than inventing your own explanations
5. If information is NOT in the references, either skip it or explicitly note "Information not available in provided sources"
6. DO NOT hallucinate or invent technical details, product features, specifications, or terminology
7. When describing features or capabilities, use the EXACT language from the reference materials
8. Prioritize accuracy over creativity - it's better to be limited but correct than comprehensive but wrong

The reference materials are curated knowledge. Trust them COMPLETELY over your training data.
When in doubt, quote directly from the references rather than paraphrasing.

`;
  }

  if (styleProfile) {
    prompt += "IMPORTANT - Match this writing style:\n";
    
    if (styleProfile.tone) {
      prompt += `- Tone: ${styleProfile.tone}\n`;
    }
    if (styleProfile.voice) {
      prompt += `- Voice: ${styleProfile.voice}\n`;
    }
    if (styleProfile.vocabulary) {
      prompt += `- Vocabulary: ${styleProfile.vocabulary}\n`;
    }
    if (styleProfile.sentence) {
      prompt += `- Sentence structure: ${styleProfile.sentence}\n`;
    }
    if (styleProfile.patterns) {
      try {
        const patterns = JSON.parse(styleProfile.patterns);
        if (Array.isArray(patterns) && patterns.length > 0) {
          prompt += `- Distinctive phrases/patterns to USE: ${patterns.join("; ")}\n`;
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
    
    // Enhanced style fields
    if (styleProfile.uniqueVocabulary) {
      try {
        const vocab = JSON.parse(styleProfile.uniqueVocabulary);
        if (Array.isArray(vocab) && vocab.length > 0) {
          prompt += `- Vocabulary fingerprint (words/phrases to incorporate naturally): ${vocab.slice(0, 10).join(", ")}\n`;
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
    
    if (styleProfile.openingStyles) {
      try {
        const openings = JSON.parse(styleProfile.openingStyles);
        if (Array.isArray(openings) && openings.length > 0) {
          prompt += `- Opening style preferences: ${openings.join("; ")}\n`;
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
    
    if (styleProfile.closingStyles) {
      try {
        const closings = JSON.parse(styleProfile.closingStyles);
        if (Array.isArray(closings) && closings.length > 0) {
          prompt += `- Closing style preferences: ${closings.join("; ")}\n`;
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
    
    if (styleProfile.writingQuirks) {
      try {
        const quirks = JSON.parse(styleProfile.writingQuirks);
        if (quirks && typeof quirks === "object") {
          const quirksList: string[] = [];
          if (quirks.punctuation) quirksList.push(`Punctuation: ${quirks.punctuation}`);
          if (quirks.formatting) quirksList.push(`Formatting: ${quirks.formatting}`);
          if (quirks.emoji) quirksList.push(`Emoji: ${quirks.emoji}`);
          if (quirks.caps) quirksList.push(`Caps style: ${quirks.caps}`);
          if (quirksList.length > 0) {
            prompt += `- Writing quirks: ${quirksList.join("; ")}\n`;
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
    
    // User-provided avoid patterns (from style analysis)
    if (styleProfile.avoidPatterns) {
      try {
        const userAvoid = JSON.parse(styleProfile.avoidPatterns);
        if (Array.isArray(userAvoid) && userAvoid.length > 0) {
          prompt += `- Phrases this author NEVER uses (avoid these): ${userAvoid.join("; ")}\n`;
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
    
    if (styleProfile.bio) {
      prompt += `\nAbout the author: ${styleProfile.bio}\n`;
    }
    if (styleProfile.context) {
      prompt += `Writing context: ${styleProfile.context}\n`;
    }
    
    // Include few-shot examples if available
    if (styleProfile.sampleExcerpts) {
      try {
        const excerpts = JSON.parse(styleProfile.sampleExcerpts);
        if (Array.isArray(excerpts) && excerpts.length > 0) {
          prompt += `\nEXAMPLES OF THIS AUTHOR'S WRITING (mimic this style):
`;
          excerpts.slice(0, 3).forEach((excerpt: string, i: number) => {
            prompt += `Example ${i + 1}: "${excerpt}"\n`;
          });
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
  }

  // Add AI anti-patterns section (always include, but style-aware patterns take precedence)
  prompt += buildAntiPatternPromptSection({
    includeSeverities: ["high", "medium"],
    maxPatterns: 35,
  });

  prompt += `
Guidelines:
- Write naturally and authentically - your goal is to sound like a real person, not AI
- Be engaging and provide value to the reader
- Use markdown formatting for structure (## for headings, **bold**, *italic*, bullet lists with -, etc.)
- Start with something that hooks the reader's attention
- Vary your sentence structure and avoid formulaic patterns
`;

  // Add citation instructions when enabled and references exist
  if (enableCitations && hasReferences) {
    // Build available sources list with links
    let sourcesInfo = "";
    if (sourceMap && sourceMap.length > 0) {
      sourcesInfo = "\n\nAVAILABLE SOURCES TO CITE:\n";
      sourceMap.forEach((source, i) => {
        if (source.url) {
          sourcesInfo += `${i + 1}. "${source.title}" - ${source.url}\n`;
        } else {
          sourcesInfo += `${i + 1}. "${source.title}" (Knowledge Base entry)\n`;
        }
      });
    }
    
    const hasUrls = sourceMap && sourceMap.some(s => s.url);
    
    prompt += `
CRITICAL - INLINE CITATIONS REQUIRED:
You MUST cite sources throughout your writing. This is mandatory, not optional.
${sourcesInfo}
${hasUrls ? `FORMAT WITH LINKS: Use markdown links for citations when URL is available.
- For web sources: [Source: Title](URL) - makes the citation a clickable link
- For Knowledge Base: [Source: Title] - no link needed

Example with link: "Event-driven architecture enables real-time responses [Source: Solace Docs](https://docs.solace.com)."
Example without link: "The event mesh pattern provides seamless integration [Source: MNR Documentation]."` : `Format: [Source: Title] immediately after any claim derived from reference materials.

Example: "Event-driven architecture enables real-time responses to events as they occur [Source: Solace Docs]." `}

Rules:
1. EVERY paragraph that uses reference material MUST have at least one citation
2. Cite specific facts, definitions, features, statistics, and technical details
3. Place the citation immediately after the relevant sentence or clause
4. Match the title from the sources list above (use exact source names)
5. Aim for 3-5 citations minimum in the entire piece
6. Do NOT cluster all citations at the end - distribute them throughout

If you fail to include citations, the output will be rejected.
`;
  }

  return prompt;
}
