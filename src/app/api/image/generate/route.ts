import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { generateImageWithOpenAI } from "@/lib/ai/openai";
import { generateImageWithStability } from "@/lib/ai/stability";

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

  // Get the appropriate API key
  const providerMap = {
    openai: "OPENAI",
    stability: "STABILITY",
  } as const;

  const apiKey = await prisma.aPIKey.findUnique({
    where: { provider: providerMap[provider] },
  });

  if (!apiKey?.isValid) {
    return NextResponse.json(
      { error: `No valid ${provider} API key` },
      { status: 400 }
    );
  }

  const decryptedKey = decrypt(apiKey.encryptedKey);

  try {
    let imageUrl: string;

    if (provider === "openai") {
      imageUrl = await generateImageWithOpenAI(decryptedKey, prompt);
    } else {
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
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}
