import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { generateWithAnthropic } from "@/lib/ai/claude";
import { generateWithMistral } from "@/lib/ai/mistral";
import { generateWithGrok } from "@/lib/ai/grok";
import { generateWithLiteLLM } from "@/lib/ai/litellm";

interface EnhanceRequest {
  prompt: string;
  contentType: string;
  lengthPref: string;
}

const ENHANCE_SYSTEM_PROMPT = `You are an expert prompt engineer. Your task is to enhance a user's initial writing prompt to make it more detailed, specific, and effective.

Given the user's basic prompt, you should:
1. Add more specific details and context
2. Clarify the target audience if relevant
3. Suggest a compelling angle or hook
4. Include key points that should be covered
5. Add any relevant constraints or requirements

IMPORTANT RULES:
- Keep the enhanced prompt concise but comprehensive (2-4 paragraphs max)
- Maintain the user's original intent and topic
- Don't add fictional details or make up specific data
- The enhanced prompt should still feel natural and readable
- Output ONLY the enhanced prompt text, nothing else (no labels, no "Enhanced prompt:", etc.)`;

// POST /api/enhance-prompt - Enhance a user's initial prompt
export async function POST(request: NextRequest) {
  try {
    const { prompt, contentType, lengthPref } = (await request.json()) as EnhanceRequest;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Get user preferences for primary model
    const preferences = await prisma.userPreferences.findFirst();
    
    // Get API keys
    const apiKeys = await prisma.aPIKey.findMany({
      where: { isValid: true },
    });

    // Get LiteLLM config
    const liteLLMConfig = await prisma.liteLLMConfig.findFirst({
      where: { isEnabled: true, isValid: true },
    });

    // Determine which model to use - prefer primary, then available
    let provider: string | null = null;
    let modelId: string | null = null;
    let apiKey: string | null = null;

    // Check if user has a primary model set
    if (preferences?.primaryModelProvider && preferences?.primaryModelId) {
      provider = preferences.primaryModelProvider;
      modelId = preferences.primaryModelId;
      
      if (provider === "LITELLM" && liteLLMConfig) {
        apiKey = decrypt(liteLLMConfig.encryptedKey);
      } else {
        const keyRecord = apiKeys.find(k => k.provider === provider);
        if (keyRecord) {
          apiKey = decrypt(keyRecord.encryptedKey);
        }
      }
    }

    // Fallback to any available model if primary not set or not available
    if (!apiKey) {
      // Try LiteLLM first
      if (liteLLMConfig) {
        provider = "LITELLM";
        try {
          const models = JSON.parse(liteLLMConfig.cachedModels);
          modelId = models[0]?.id || "gpt-4o";
        } catch {
          modelId = "gpt-4o";
        }
        apiKey = decrypt(liteLLMConfig.encryptedKey);
      } else {
        // Try other providers
        for (const keyRecord of apiKeys) {
          if (keyRecord.provider !== "STABILITY") {
            provider = keyRecord.provider;
            apiKey = decrypt(keyRecord.encryptedKey);
            // Pick a default model for the provider
            if (provider === "OPENAI") modelId = "gpt-4o";
            else if (provider === "ANTHROPIC") modelId = "claude-3-5-sonnet-20241022";
            else if (provider === "MISTRAL") modelId = "mistral-large-latest";
            else if (provider === "XAI") modelId = "grok-2-1212";
            break;
          }
        }
      }
    }

    if (!provider || !modelId || !apiKey) {
      return NextResponse.json(
        { error: "No AI model available. Please configure an API key." },
        { status: 400 }
      );
    }

    // Build the enhancement prompt
    const contentTypeLabel = {
      BLOG_POST: "blog post",
      TWEET_THREAD: "tweet thread",
      LINKEDIN_POST: "LinkedIn post",
      EMAIL: "email",
      ARTICLE: "article",
      OTHER: "content",
    }[contentType] || "content";

    const lengthLabel = {
      short: "~300 words",
      medium: "~600 words",
      long: "~1200 words",
    }[lengthPref] || "medium length";

    const userPrompt = `Please enhance this prompt for creating a ${contentTypeLabel} (target: ${lengthLabel}):

"${prompt}"

Remember: Output ONLY the enhanced prompt, no labels or explanations.`;

    // Generate enhanced prompt using the selected model
    let enhancedPrompt: string;

    if (provider === "LITELLM") {
      const result = await generateWithLiteLLM(
        liteLLMConfig!.endpoint,
        apiKey,
        modelId,
        ENHANCE_SYSTEM_PROMPT,
        userPrompt
      );
      enhancedPrompt = result.content;
    } else if (provider === "OPENAI") {
      const result = await generateWithOpenAI(
        apiKey,
        modelId,
        ENHANCE_SYSTEM_PROMPT,
        userPrompt
      );
      enhancedPrompt = result.content;
    } else if (provider === "ANTHROPIC") {
      const result = await generateWithAnthropic(
        apiKey,
        modelId,
        ENHANCE_SYSTEM_PROMPT,
        userPrompt
      );
      enhancedPrompt = result.content;
    } else if (provider === "MISTRAL") {
      const result = await generateWithMistral(
        apiKey,
        modelId,
        ENHANCE_SYSTEM_PROMPT,
        userPrompt
      );
      enhancedPrompt = result.content;
    } else if (provider === "XAI") {
      const result = await generateWithGrok(
        apiKey,
        modelId,
        ENHANCE_SYSTEM_PROMPT,
        userPrompt
      );
      enhancedPrompt = result.content;
    } else {
      return NextResponse.json(
        { error: `Unsupported provider: ${provider}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      enhanced: enhancedPrompt,
      model: modelId,
      provider,
    });
  } catch (error) {
    console.error("Enhance prompt error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to enhance prompt" },
      { status: 500 }
    );
  }
}
