import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { AIProvider, LiteLLMModel } from "@/types";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { generateWithAnthropic } from "@/lib/ai/claude";
import { generateWithMistral } from "@/lib/ai/mistral";
import { generateWithGrok } from "@/lib/ai/grok";
import { generateWithLiteLLM } from "@/lib/ai/litellm";
import { GenerationOutput } from "@/types";
import { fetchMultipleUrls, formatReferencesForPrompt } from "@/lib/url-fetcher";
import { buildAntiPatternPromptSection } from "@/lib/ai/anti-patterns";

interface ReferenceInput {
  type: "url" | "text";
  value: string;
}

interface SingleGenerationRequest {
  generationId: string;
  provider: AIProvider;
  modelId: string;
  // Optional: swap to a different model
  newProvider?: AIProvider;
  newModelId?: string;
}

// POST /api/generate/single - Retry or swap a single model generation
export async function POST(request: NextRequest) {
  const { generationId, provider, modelId, newProvider, newModelId } =
    (await request.json()) as SingleGenerationRequest;

  console.log("[Generate Single API] Received request:", {
    generationId,
    provider,
    modelId,
    newProvider,
    newModelId,
  });

  if (!generationId) {
    return NextResponse.json(
      { error: "Generation ID is required" },
      { status: 400 }
    );
  }

  // Determine target model (either retry same or swap to new)
  const targetProvider = newProvider || provider;
  const targetModelId = newModelId || modelId;

  // Get the original generation record
  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
  });

  if (!generation) {
    return NextResponse.json(
      { error: "Generation not found" },
      { status: 404 }
    );
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

  // Build system prompt (simplified version - we don't have all original context)
  const systemPrompt = buildSimpleSystemPrompt(
    styleProfile,
    generation.contentType || "article",
    generation.lengthPref || "medium",
    generation.contentMode as "new" | "enhance" | null,
    false, // enableEmojis - default to false for retries/swaps
    generation.sourceContent
  );

  // Helper function to call the appropriate provider
  const callProvider = async (): Promise<{ content: string; tokensUsed: number }> => {
    if (targetProvider === "LITELLM") {
      if (!liteLLMConfig) {
        throw new Error("LiteLLM not configured");
      }
      
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
        targetModelId,
        systemPrompt,
        generation.prompt
      );
    } else {
      const apiKey = apiKeys.find((k) => k.provider === targetProvider);
      if (!apiKey) {
        throw new Error("API key not found");
      }

      const decryptedKey = decrypt(apiKey.encryptedKey);

      switch (targetProvider) {
        case "OPENAI":
          return await generateWithOpenAI(
            decryptedKey,
            targetModelId,
            systemPrompt,
            generation.prompt
          );
        case "ANTHROPIC":
          return await generateWithAnthropic(
            decryptedKey,
            targetModelId,
            systemPrompt,
            generation.prompt
          );
        case "MISTRAL":
          return await generateWithMistral(
            decryptedKey,
            targetModelId,
            systemPrompt,
            generation.prompt
          );
        case "XAI":
          return await generateWithGrok(
            decryptedKey,
            targetModelId,
            systemPrompt,
            generation.prompt
          );
        default:
          throw new Error("Unknown provider");
      }
    }
  };

  const startTime = Date.now();

  try {
    let result = await callProvider();

    // Auto-retry once if content is empty
    if (!result.content || result.content.trim() === "") {
      console.log(`[Generate Single API] Empty response from ${targetProvider}:${targetModelId}, auto-retrying...`);
      result = await callProvider();
    }

    const latencyMs = Date.now() - startTime;

    // Check if still empty after retry
    if (!result.content || result.content.trim() === "") {
      console.log(`[Generate Single API] Still empty after retry from ${targetProvider}:${targetModelId}`);
      
      const output: GenerationOutput = {
        provider: targetProvider,
        model: targetModelId,
        content: "",
        tokensUsed: result.tokensUsed,
        latencyMs,
        error: "Model returned empty response",
      };

      return NextResponse.json({ output });
    }

    // If swapping to a new model, create a new output record
    // If retrying the same model, update the existing record
    const isSwap = newProvider && newModelId;
    
    if (isSwap) {
      // Create new output for the swapped model
      await prisma.generationOutput.create({
        data: {
          generationId: generation.id,
          provider: targetProvider,
          model: targetModelId,
          content: result.content,
          tokensUsed: result.tokensUsed,
          latencyMs,
        },
      });
      
      // Delete the old failed output
      await prisma.generationOutput.deleteMany({
        where: {
          generationId: generation.id,
          provider,
          model: modelId,
        },
      });
    } else {
      // Update existing output (retry same model)
      const existingOutput = await prisma.generationOutput.findFirst({
        where: {
          generationId: generation.id,
          provider,
          model: modelId,
        },
      });

      if (existingOutput) {
        await prisma.generationOutput.update({
          where: { id: existingOutput.id },
          data: {
            content: result.content,
            tokensUsed: result.tokensUsed,
            latencyMs,
          },
        });
      } else {
        // Create if didn't exist (shouldn't happen, but safety)
        await prisma.generationOutput.create({
          data: {
            generationId: generation.id,
            provider: targetProvider,
            model: targetModelId,
            content: result.content,
            tokensUsed: result.tokensUsed,
            latencyMs,
          },
        });
      }
    }

    const output: GenerationOutput = {
      provider: targetProvider,
      model: targetModelId,
      content: result.content,
      tokensUsed: result.tokensUsed,
      latencyMs,
    };

    console.log("[Generate Single API] Success:", {
      provider: targetProvider,
      model: targetModelId,
      contentLength: result.content.length,
      latencyMs,
    });

    return NextResponse.json({ output });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Generate Single API] Error generating with ${targetProvider}:`, error);
    
    const output: GenerationOutput = {
      provider: targetProvider,
      model: targetModelId,
      content: "",
      latencyMs: Date.now() - startTime,
      error: errorMessage,
    };

    return NextResponse.json({ output, error: errorMessage });
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

function buildSimpleSystemPrompt(
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
  contentMode?: "new" | "enhance" | null,
  enableEmojis?: boolean,
  existingContent?: string | null
): string {
  // Content-type-aware length guidance
  let lengthGuide: string;
  
  switch (contentType) {
    case "TWEET_THREAD":
      lengthGuide = {
        short: "3-5 tweets (each under 280 characters)",
        medium: "6-10 tweets (each under 280 characters)",
        long: "11-15 tweets (each under 280 characters)",
      }[lengthPref] || "6-10 tweets";
      break;
    case "LINKEDIN_POST":
      lengthGuide = {
        short: "around 50-100 words (600-800 characters)",
        medium: "around 150-200 words (1,000-1,300 characters)",
        long: "around 300-400 words (2,000-2,500 characters)",
      }[lengthPref] || "around 150-200 words";
      break;
    case "EMAIL":
      lengthGuide = {
        short: "around 100 words (brief and to the point)",
        medium: "around 200 words",
        long: "around 400 words",
      }[lengthPref] || "around 200 words";
      break;
    default: // BLOG_POST, ARTICLE, OTHER
      lengthGuide = {
        short: "around 300 words",
        medium: "around 600 words",
        long: "around 1200 words",
      }[lengthPref] || "a medium length";
  }

  let prompt = "";
  
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
          prompt += `- Vocabulary fingerprint (words/phrases to incorporate): ${vocab.slice(0, 10).join(", ")}\n`;
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

  // Add AI anti-patterns section
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

  return prompt;
}
