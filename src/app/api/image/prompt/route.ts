import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { generateWithAnthropic } from "@/lib/ai/claude";
import { generateWithLiteLLM } from "@/lib/ai/litellm";

// POST /api/image/prompt - Generate an image prompt from content
export async function POST(request: NextRequest) {
  const { content } = await request.json();

  if (!content) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  // Check for LiteLLM config first
  const litellmConfig = await prisma.liteLLMConfig.findFirst({
    where: { isEnabled: true, isValid: true },
  });

  // Fall back to direct API keys if no LiteLLM
  const apiKey = !litellmConfig ? await prisma.aPIKey.findFirst({
    where: {
      isValid: true,
      provider: { in: ["OPENAI", "ANTHROPIC"] },
    },
  }) : null;

  if (!litellmConfig && !apiKey) {
    return NextResponse.json(
      { error: "No valid API key or LiteLLM proxy available" },
      { status: 400 }
    );
  }

  const systemPrompt = `You are an expert at creating image prompts for AI image generators.
Given a piece of content, create a concise, descriptive prompt for generating a hero image.
The prompt should capture the essence and mood of the content.
Focus on visual elements, style, and atmosphere.
Keep it under 200 words.
Output only the image prompt, nothing else.`;

  const userPrompt = `Create an image prompt for this content:

${content.substring(0, 2000)}

Generate a prompt for a blog hero image that captures the essence of this content.`;

  try {
    let result: { content: string; tokensUsed: number };

    if (litellmConfig) {
      // Use LiteLLM - pick a fast/cheap model for prompt generation
      const models = JSON.parse(litellmConfig.cachedModels || "[]") as Array<{ id: string; costTier: string }>;
      const cheapModel = models.find(m => m.costTier === "low") || models[0];
      const modelId = cheapModel?.id || "azure-gpt-4o-mini";
      
      const litellmKey = litellmConfig.encryptedKey 
        ? decrypt(litellmConfig.encryptedKey) 
        : undefined;
      
      result = await generateWithLiteLLM(
        litellmConfig.endpoint,
        litellmKey,
        modelId,
        systemPrompt,
        userPrompt
      );
    } else if (apiKey!.provider === "OPENAI") {
      const decryptedKey = decrypt(apiKey!.encryptedKey);
      result = await generateWithOpenAI(
        decryptedKey,
        "gpt-4o-mini",
        systemPrompt,
        userPrompt
      );
    } else {
      const decryptedKey = decrypt(apiKey!.encryptedKey);
      result = await generateWithAnthropic(
        decryptedKey,
        "claude-3-haiku-20240307",
        systemPrompt,
        userPrompt
      );
    }

    return NextResponse.json({ prompt: result.content });
  } catch (error) {
    console.error("Prompt generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate prompt" },
      { status: 500 }
    );
  }
}
