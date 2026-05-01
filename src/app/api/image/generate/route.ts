import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { generateImageWithOpenAI } from "@/lib/ai/openai";
import { generateImageWithStability } from "@/lib/ai/stability";
import { generateImageWithLiteLLM } from "@/lib/ai/litellm";

interface ImageGenerateRequest {
  prompt: string;
  provider: string; // "openai", "stability", or "litellm:<modelId>"
  generationId?: string;
}

// POST /api/image/generate - Generate an image
export async function POST(request: NextRequest) {
  const { prompt, provider, generationId } =
    (await request.json()) as ImageGenerateRequest;

  if (!prompt || !provider) {
    return NextResponse.json(
      { error: "Prompt and provider required" },
      { status: 400 }
    );
  }

  try {
    let imageUrl: string;

    // Handle LiteLLM models (prefixed with "litellm:")
    if (provider.startsWith("litellm:")) {
      const modelId = provider.replace("litellm:", "");
      
      const litellmConfig = await prisma.liteLLMConfig.findFirst({
        where: { isEnabled: true, isValid: true },
      });

      if (!litellmConfig) {
        return NextResponse.json(
          { error: "LiteLLM proxy not configured" },
          { status: 400 }
        );
      }

      const litellmKey = litellmConfig.encryptedKey 
        ? decrypt(litellmConfig.encryptedKey) 
        : undefined;
      
      imageUrl = await generateImageWithLiteLLM(
        litellmConfig.endpoint,
        litellmKey,
        prompt,
        modelId
      );
    } else if (provider === "openai") {
      // Direct OpenAI API
      const directApiKey = await prisma.aPIKey.findUnique({
        where: { provider: "OPENAI" },
      });

      if (!directApiKey?.isValid) {
        return NextResponse.json(
          { error: "No valid OpenAI API key configured" },
          { status: 400 }
        );
      }

      const decryptedKey = decrypt(directApiKey.encryptedKey);
      imageUrl = await generateImageWithOpenAI(decryptedKey, prompt);
    } else if (provider === "stability") {
      // Stability AI - direct API only
      const apiKey = await prisma.aPIKey.findUnique({
        where: { provider: "STABILITY" },
      });

      if (!apiKey?.isValid) {
        return NextResponse.json(
          { error: "No valid Stability AI API key configured" },
          { status: 400 }
        );
      }

      const decryptedKey = decrypt(apiKey.encryptedKey);
      imageUrl = await generateImageWithStability(decryptedKey, prompt);
    } else {
      return NextResponse.json(
        { error: `Unknown image provider: ${provider}` },
        { status: 400 }
      );
    }

    // Save to generation if provided
    if (generationId) {
      await prisma.synthesizedContent.update({
        where: { generationId },
        data: {
          imageUrl,
          imagePrompt: prompt,
        },
      });
    }

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("Image generation error:", error);
    
    // Extract meaningful error message
    let errorMessage = "Failed to generate image";
    if (error instanceof Error) {
      if (error.message.includes("team not allowed") || error.message.includes("model_access_denied")) {
        errorMessage = "Image generation is not available through your LiteLLM proxy for this model.";
      } else if (error.message.includes("401")) {
        errorMessage = "Authentication failed for image generation";
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
