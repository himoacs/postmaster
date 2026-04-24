import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { AIProvider } from "@/types";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { generateWithAnthropic } from "@/lib/ai/claude";
import { generateWithMistral } from "@/lib/ai/mistral";
import { generateWithGrok } from "@/lib/ai/grok";
import { generateWithLiteLLM } from "@/lib/ai/litellm";
import { GenerationOutput, SelectedModel } from "@/types";
import { AI_PROVIDERS } from "@/lib/ai/providers";

interface SynthesizeRequest {
  generationId: string;
  outputs: GenerationOutput[];
  starredSections?: { provider: AIProvider; text: string }[];
  primaryModel: SelectedModel;
}

// POST /api/synthesize - Combine outputs into one
export async function POST(request: NextRequest) {
  const { generationId, outputs, starredSections, primaryModel } =
    (await request.json()) as SynthesizeRequest;

  if (!generationId || !outputs || outputs.length === 0 || !primaryModel) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Get API key for the primary model (skip for LITELLM - handled separately)
  let decryptedKey = "";
  if (primaryModel.provider !== "LITELLM") {
    const apiKey = await prisma.aPIKey.findUnique({
      where: { provider: primaryModel.provider },
    });

    if (!apiKey?.isValid) {
      return NextResponse.json(
        { error: "API key not available for synthesis" },
        { status: 400 }
      );
    }

    decryptedKey = decrypt(apiKey.encryptedKey);
  }

  // Build synthesis prompt
  const synthesisPrompt = buildSynthesisPrompt(outputs, starredSections);

  const systemPrompt = `You are a skilled editor who synthesizes multiple drafts into one cohesive piece.
Your task is to combine the best elements from each draft while maintaining a consistent voice and flow.
Preserve the overall message and key points while improving clarity and engagement.
Do NOT include any meta-commentary about the synthesis process - just output the final content directly.`;

  try {
    let result: { content: string; tokensUsed: number };

    switch (primaryModel.provider) {
      case "OPENAI":
        result = await generateWithOpenAI(
          decryptedKey,
          primaryModel.modelId,
          systemPrompt,
          synthesisPrompt
        );
        break;
      case "ANTHROPIC":
        result = await generateWithAnthropic(
          decryptedKey,
          primaryModel.modelId,
          systemPrompt,
          synthesisPrompt
        );
        break;
      case "MISTRAL":
        result = await generateWithMistral(
          decryptedKey,
          primaryModel.modelId,
          systemPrompt,
          synthesisPrompt
        );
        break;
      case "XAI":
        result = await generateWithGrok(
          decryptedKey,
          primaryModel.modelId,
          systemPrompt,
          synthesisPrompt
        );
        break;
      case "LITELLM": {
        const litellmConfig = await prisma.liteLLMConfig.findFirst({
          where: { isEnabled: true, isValid: true },
        });
        if (!litellmConfig) {
          return NextResponse.json(
            { error: "LiteLLM not configured" },
            { status: 400 }
          );
        }
        const litellmKey = litellmConfig.encryptedKey
          ? decrypt(litellmConfig.encryptedKey)
          : undefined;
        result = await generateWithLiteLLM(
          litellmConfig.endpoint,
          litellmKey,
          primaryModel.modelId,
          systemPrompt,
          synthesisPrompt
        );
        break;
      }
      default:
        return NextResponse.json(
          { error: "Unsupported provider" },
          { status: 400 }
        );
    }

    // Save synthesized content
    await prisma.synthesizedContent.upsert({
      where: { generationId },
      update: {
        content: result.content,
        version: { increment: 1 },
      },
      create: {
        generationId,
        content: result.content,
        version: 1,
      },
    });

    // Update generation status
    await prisma.generation.update({
      where: { id: generationId },
      data: { status: "COMPLETED" },
    });

    return NextResponse.json({ content: result.content });
  } catch (error) {
    console.error("Synthesis error:", error);
    return NextResponse.json({ error: "Synthesis failed" }, { status: 500 });
  }
}

function buildSynthesisPrompt(
  outputs: GenerationOutput[],
  starredSections?: { provider: AIProvider; text: string }[]
): string {
  let prompt = "Here are multiple drafts of the same content from different AI models:\n\n";

  outputs.forEach((output, index) => {
    const providerName = AI_PROVIDERS[output.provider]?.name || output.provider;
    prompt += `--- DRAFT ${index + 1} (${providerName} - ${output.model}) ---\n`;
    prompt += output.content;
    prompt += "\n\n";
  });

  if (starredSections && starredSections.length > 0) {
    prompt += "The user has specifically highlighted these sections as particularly good:\n\n";
    starredSections.forEach((section, index) => {
      const providerName = AI_PROVIDERS[section.provider]?.name || section.provider;
      prompt += `[From ${providerName}]: "${section.text}"\n`;
    });
    prompt += "\n";
  }

  prompt += `Please synthesize these drafts into one final, polished piece. ${
    starredSections && starredSections.length > 0
      ? "Make sure to incorporate the highlighted sections, adapting them smoothly into the flow."
      : "Take the best elements from each draft."
  }

Output only the final content, no explanations or meta-commentary.`;

  return prompt;
}
