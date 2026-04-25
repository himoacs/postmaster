import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { generateWithAnthropic } from "@/lib/ai/claude";
import { generateWithMistral } from "@/lib/ai/mistral";
import { generateWithGrok } from "@/lib/ai/grok";
import { generateWithLiteLLM } from "@/lib/ai/litellm";
import { SelectedModel } from "@/types";

interface IterateRequest {
  generationId: string;
  currentContent: string;
  feedback: string;
  selectedModels: SelectedModel[];
}

// POST /api/iterate - Refine content based on feedback
export async function POST(request: NextRequest) {
  const { generationId, currentContent, feedback, selectedModels } =
    (await request.json()) as IterateRequest;

  if (!generationId || !currentContent || !feedback || !selectedModels?.length) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Use the first model for iteration
  const primaryModel = selectedModels[0];

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
Output only the revised content, no explanations or meta-commentary.`;

  const iterationPrompt = `Here is the current content:

${currentContent}

---

User feedback: "${feedback}"

Please revise the content according to this feedback. Make the requested changes while preserving what works well.
Output only the revised content.`;

  try {
    let result: { content: string; tokensUsed: number };

    switch (primaryModel.provider) {
      case "OPENAI":
        result = await generateWithOpenAI(
          decryptedKey,
          primaryModel.modelId,
          systemPrompt,
          iterationPrompt
        );
        break;
      case "ANTHROPIC":
        result = await generateWithAnthropic(
          decryptedKey,
          primaryModel.modelId,
          systemPrompt,
          iterationPrompt
        );
        break;
      case "MISTRAL":
        result = await generateWithMistral(
          decryptedKey,
          primaryModel.modelId,
          systemPrompt,
          iterationPrompt
        );
        break;
      case "XAI":
        result = await generateWithGrok(
          decryptedKey,
          primaryModel.modelId,
          systemPrompt,
          iterationPrompt
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
          iterationPrompt
        );
        break;
      }
      default:
        return NextResponse.json(
          { error: "Unsupported provider" },
          { status: 400 }
        );
    }

    // Update synthesized content with new version
    const existing = await prisma.synthesizedContent.findUnique({
      where: { generationId },
    });

    if (existing) {
      // Save current version to history before updating
      await prisma.synthesisVersion.create({
        data: {
          synthesizedContentId: existing.id,
          version: existing.version,
          content: existing.content,
          feedback: feedback, // The feedback that will be applied to create the next version
        },
      });
    }

    const currentFeedback = existing?.feedback
      ? JSON.parse(existing.feedback)
      : [];

    await prisma.synthesizedContent.update({
      where: { generationId },
      data: {
        content: result.content,
        version: { increment: 1 },
        feedback: JSON.stringify([...currentFeedback, feedback]),
      },
    });

    return NextResponse.json({ content: result.content, synthesisId: existing?.id });
  } catch (error) {
    console.error("Iteration error:", error);
    return NextResponse.json({ error: "Iteration failed" }, { status: 500 });
  }
}
