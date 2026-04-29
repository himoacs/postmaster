import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { generateWithAnthropic } from "@/lib/ai/claude";
import { generateWithMistral } from "@/lib/ai/mistral";
import { generateWithGrok } from "@/lib/ai/grok";
import { generateWithLiteLLM } from "@/lib/ai/litellm";
import { AIProvider, SelectedModel } from "@/types";

interface IterateRequest {
  generationId: string;
  currentContent: string;
  feedback: string;
  primaryModel?: SelectedModel; // User's primary model preference
  selectedModels?: SelectedModel[]; // Legacy: used for fallback
}

// POST /api/iterate - Refine content based on feedback
export async function POST(request: NextRequest) {
  const { generationId, currentContent, feedback, primaryModel: providedPrimaryModel, selectedModels } =
    (await request.json()) as IterateRequest;

  if (!generationId || !currentContent || !feedback) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Use provided primary model, or fall back to user preferences, or first selected model
  let primaryModel = providedPrimaryModel;
  
  if (!primaryModel) {
    // Try to get from user preferences
    const preferences = await prisma.userPreferences.findFirst();
    if (preferences?.primaryModelProvider && preferences?.primaryModelId) {
      primaryModel = {
        provider: preferences.primaryModelProvider as AIProvider,
        modelId: preferences.primaryModelId,
      };
    } else if (selectedModels?.length) {
      // Legacy fallback
      primaryModel = selectedModels[0];
    } else {
      return NextResponse.json({ error: "No model available" }, { status: 400 });
    }
  }

  // Get API key (skip for LITELLM - handled separately)
  let decryptedKey = "";
  if (primaryModel.provider !== "LITELLM") {
    const apiKey = await prisma.aPIKey.findUnique({
      where: { provider: primaryModel.provider },
    });

    if (!apiKey?.isValid) {
      return NextResponse.json(
        { error: "API key not available" },
        { status: 400 }
      );
    }

    decryptedKey = decrypt(apiKey.encryptedKey);
  }

  const systemPrompt = `You are a skilled editor helping to refine content based on user feedback.
Apply the requested changes while maintaining the overall quality and flow of the writing.
IMPORTANT: Unless the user explicitly asks to remove citations, preserve all source citations in the format [Source: Title] or [Source: Title](URL).
Output only the revised content, no explanations or meta-commentary.`;

  const iterationPrompt = `Here is the current content:

${currentContent}

---

User feedback: "${feedback}"

Please revise the content according to this feedback. Make the requested changes while preserving what works well.
Output only the revised content.`;

  // Helper function to generate with a specific provider
  async function tryGenerate(
    provider: string,
    modelId: string,
    key: string
  ): Promise<{ content: string; tokensUsed: number }> {
    switch (provider) {
      case "OPENAI":
        return generateWithOpenAI(key, modelId, systemPrompt, iterationPrompt);
      case "ANTHROPIC":
        return generateWithAnthropic(key, modelId, systemPrompt, iterationPrompt);
      case "MISTRAL":
        return generateWithMistral(key, modelId, systemPrompt, iterationPrompt);
      case "XAI":
        return generateWithGrok(key, modelId, systemPrompt, iterationPrompt);
      case "LITELLM": {
        const litellmConfig = await prisma.liteLLMConfig.findFirst({
          where: { isEnabled: true, isValid: true },
        });
        if (!litellmConfig) {
          throw new Error("LiteLLM not configured");
        }
        const litellmKey = litellmConfig.encryptedKey
          ? decrypt(litellmConfig.encryptedKey)
          : undefined;
        return generateWithLiteLLM(
          litellmConfig.endpoint,
          litellmKey,
          modelId,
          systemPrompt,
          iterationPrompt
        );
      }
      default:
        throw new Error("Unsupported provider");
    }
  }

  try {
    let result: { content: string; tokensUsed: number };

    // Try primary model first
    try {
      result = await tryGenerate(primaryModel.provider, primaryModel.modelId, decryptedKey);
    } catch (primaryError) {
      console.error(`Primary model (${primaryModel.provider}) failed:`, primaryError);
      
      // Fallback to LiteLLM if available and primary wasn't already LiteLLM
      if (primaryModel.provider !== "LITELLM") {
        const litellmConfig = await prisma.liteLLMConfig.findFirst({
          where: { isEnabled: true, isValid: true },
        });
        
        if (litellmConfig) {
          console.log("Falling back to LiteLLM for iteration...");
          const litellmKey = litellmConfig.encryptedKey
            ? decrypt(litellmConfig.encryptedKey)
            : undefined;
          
          // Get first available LiteLLM model
          let models: { id: string }[] = [];
          try {
            models = JSON.parse(litellmConfig.cachedModels || "[]");
          } catch {
            models = [];
          }
          
          const fallbackModel = models[0]?.id;
          if (fallbackModel) {
            result = await generateWithLiteLLM(
              litellmConfig.endpoint,
              litellmKey,
              fallbackModel,
              systemPrompt,
              iterationPrompt
            );
          } else {
            throw primaryError; // No fallback available
          }
        } else {
          throw primaryError; // No LiteLLM configured
        }
      } else {
        throw primaryError; // Primary was LiteLLM and it failed
      }
    }

    // Update synthesized content with new version
    const existing = await prisma.synthesizedContent.findUnique({
      where: { generationId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "No synthesized content found to iterate" },
        { status: 404 }
      );
    }

    // Save current version to history before updating (upsert to avoid duplicates)
    await prisma.synthesisVersion.upsert({
      where: {
        synthesizedContentId_version: {
          synthesizedContentId: existing.id,
          version: existing.version,
        },
      },
      create: {
        synthesizedContentId: existing.id,
        version: existing.version,
        content: existing.content,
        feedback: feedback, // The feedback that will be applied to create the next version
      },
      update: {
        content: existing.content,
        feedback: feedback,
      },
    });

    let currentFeedback = [];
    try {
      if (existing.feedback) {
        const parsed = JSON.parse(existing.feedback);
        currentFeedback = Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      // If parsing fails, start with empty array
      currentFeedback = [];
    }

    await prisma.synthesizedContent.update({
      where: { generationId },
      data: {
        content: result.content,
        version: { increment: 1 },
        feedback: JSON.stringify([...currentFeedback, feedback]),
      },
    });

    return NextResponse.json({ content: result.content, synthesisId: existing.id });
  } catch (error) {
    console.error("Iteration error:", error);
    return NextResponse.json({ error: "Iteration failed" }, { status: 500 });
  }
}
