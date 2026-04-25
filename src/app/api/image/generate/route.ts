import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { generateImageWithOpenAI } from "@/lib/ai/openai";
import { generateImageWithStability } from "@/lib/ai/stability";
import { generateImageWithLiteLLM } from "@/lib/ai/litellm";

interface ImageGenerateRequest {
  prompt: string;
  provider: "openai" | "stability";
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

    if (provider === "openai") {
      // Try LiteLLM first, then fall back to direct OpenAI
      const litellmConfig = await prisma.liteLLMConfig.findFirst({
        where: { isEnabled: true, isValid: true },
      });

      const directApiKey = await prisma.aPIKey.findUnique({
        where: { provider: "OPENAI" },
      });

      let litellmError: Error | null = null;
      
      // Try LiteLLM first if configured
      if (litellmConfig) {
        try {
          const litellmKey = litellmConfig.encryptedKey 
            ? decrypt(litellmConfig.encryptedKey) 
            : undefined;
          
          imageUrl = await generateImageWithLiteLLM(
            litellmConfig.endpoint,
            litellmKey,
            prompt,
            "dall-e-3"
          );
        } catch (err) {
          litellmError = err instanceof Error ? err : new Error(String(err));
          console.warn("LiteLLM image generation failed, attempting direct OpenAI:", litellmError.message);
        }
      }

      // Fall back to direct OpenAI if LiteLLM failed or not configured
      if (!imageUrl!) {
        if (directApiKey?.isValid) {
          const decryptedKey = decrypt(directApiKey.encryptedKey);
          imageUrl = await generateImageWithOpenAI(decryptedKey, prompt);
        } else if (litellmError) {
          // LiteLLM failed and no direct key available
          throw litellmError;
        } else {
          return NextResponse.json(
            { error: "No valid OpenAI API key or LiteLLM proxy configured for image generation" },
            { status: 400 }
          );
        }
      }
    } else {
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
        errorMessage = "Image generation (DALL-E) is not available through your LiteLLM proxy. Add an OpenAI API key directly or enable DALL-E access in LiteLLM.";
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
