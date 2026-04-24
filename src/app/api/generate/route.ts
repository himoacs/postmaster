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
}

// POST /api/generate - Generate content with multiple models
export async function POST(request: NextRequest) {
  const { prompt, contentType, lengthPref, selectedModels: requestedModels, yoloMode, references } =
    (await request.json()) as GenerationRequest;

  if (!prompt) {
    return NextResponse.json(
      { error: "Prompt is required" },
      { status: 400 }
    );
  }

  // Fetch URL content if references provided
  let referenceContext = "";
  if (references && references.length > 0) {
    const urlRefs = references.filter(r => r.type === "url").map(r => r.value);
    const fetchedContent = urlRefs.length > 0 ? await fetchMultipleUrls(urlRefs) : [];
    referenceContext = formatReferencesForPrompt(references, fetchedContent);
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
    if (!requestedModels || requestedModels.length < 2) {
      return NextResponse.json(
        { error: "At least 2 models required" },
        { status: 400 }
      );
    }
    selectedModels = requestedModels;
  }

  // Create generation record
  const generation = await prisma.generation.create({
    data: {
      prompt,
      contentType: contentType as ContentType,
      lengthPref,
      styleContext: styleProfile ? JSON.stringify(styleProfile) : null,
      status: "GENERATING",
    },
  });

  // Build system prompt
  const systemPrompt = buildSystemPrompt(styleProfile, contentType, lengthPref);

  // Build user prompt with references
  const userPrompt = prompt + referenceContext;

  // Generate with each selected model in parallel
  const outputs: GenerationOutput[] = [];

  const generatePromises = selectedModels.map(async (model) => {
    const startTime = Date.now();

    try {
      let result: { content: string; tokensUsed: number };

      if (model.provider === "LITELLM") {
        // Use LiteLLM proxy
        if (!liteLLMConfig) {
          console.error("LiteLLM not configured");
          return null;
        }
        
        // Decrypt LiteLLM API key if present
        let liteLLMKey: string | undefined;
        if (liteLLMConfig.encryptedKey) {
          try {
            liteLLMKey = decrypt(liteLLMConfig.encryptedKey);
          } catch {
            console.error("Failed to decrypt LiteLLM API key");
          }
        }

        result = await generateWithLiteLLM(
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
          return null;
        }

        const decryptedKey = decrypt(apiKey.encryptedKey);

        switch (model.provider) {
          case "OPENAI":
            result = await generateWithOpenAI(
              decryptedKey,
              model.modelId,
              systemPrompt,
              userPrompt
            );
            break;
          case "ANTHROPIC":
            result = await generateWithAnthropic(
              decryptedKey,
              model.modelId,
              systemPrompt,
              userPrompt
            );
            break;
          case "MISTRAL":
            result = await generateWithMistral(
              decryptedKey,
              model.modelId,
              systemPrompt,
              userPrompt
            );
            break;
          case "XAI":
            result = await generateWithGrok(
              decryptedKey,
              model.modelId,
              systemPrompt,
              userPrompt
            );
            break;
          default:
            return null;
        }
      }

      const latencyMs = Date.now() - startTime;

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
        provider: model.provider,
        model: model.modelId,
        content: result.content,
        tokensUsed: result.tokensUsed,
        latencyMs,
      };
    } catch (error) {
      console.error(`Error generating with ${model.provider}:`, error);
      return null;
    }
  });

  const results = await Promise.all(generatePromises);
  
  for (const result of results) {
    if (result) {
      outputs.push(result);
    }
  }

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
    ...(yoloMode && {
      yoloSelection: {
        models: selectedModels,
        reasoning: yoloReasoning,
      },
    }),
  });
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
  } | null,
  contentType: string,
  lengthPref: string
): string {
  const lengthGuide = {
    short: "around 300 words",
    medium: "around 600 words",
    long: "around 1200 words",
  }[lengthPref] || "a medium length";

  let prompt = `You are a professional content writer. Write ${lengthGuide} of high-quality content.

Content format: ${contentType.replace("_", " ").toLowerCase()}

`;

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
          prompt += `- Common phrases/patterns: ${patterns.join(", ")}\n`;
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
  }

  prompt += `
Guidelines:
- Write naturally and avoid AI-sounding phrases
- Be engaging and provide value to the reader
- Use appropriate formatting (headers, lists, etc.) when it helps clarity
- Don't include generic introductions like "In today's fast-paced world..."
- Start with something that hooks the reader's attention
`;

  return prompt;
}
