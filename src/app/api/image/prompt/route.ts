import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { generateWithAnthropic } from "@/lib/ai/claude";

// POST /api/image/prompt - Generate an image prompt from content
export async function POST(request: NextRequest) {
  const { content } = await request.json();

  if (!content) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  // Find first valid text generation key
  const apiKey = await prisma.aPIKey.findFirst({
    where: {
      isValid: true,
      provider: { in: ["OPENAI", "ANTHROPIC"] },
    },
  });

  if (!apiKey) {
    return NextResponse.json(
      { error: "No valid API key available" },
      { status: 400 }
    );
  }

  const decryptedKey = decrypt(apiKey.encryptedKey);

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

    if (apiKey.provider === "OPENAI") {
      result = await generateWithOpenAI(
        decryptedKey,
        "gpt-4o-mini",
        systemPrompt,
        userPrompt
      );
    } else {
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
