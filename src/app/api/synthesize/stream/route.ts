import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { AIProvider, CritiqueOutput, SynthesisStrategy } from "@/types";
import { generateWithOpenAIStream } from "@/lib/ai/openai";
import { generateWithAnthropicStream } from "@/lib/ai/claude";
import { generateWithMistralStream } from "@/lib/ai/mistral";
import { generateWithGrokStream } from "@/lib/ai/grok";
import { generateWithLiteLLMStream } from "@/lib/ai/litellm";
import { GenerationOutput, SelectedModel } from "@/types";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { createSSEStream } from "@/lib/streaming";

interface SynthesizeStreamRequest {
  generationId: string;
  outputs: GenerationOutput[];
  starredSections?: { provider: AIProvider; text: string }[];
  primaryModel: SelectedModel;
  strategy?: SynthesisStrategy;
  critiques?: CritiqueOutput[];
  parentSynthesisId?: string;
}

// POST /api/synthesize/stream - Synthesize with streaming
export async function POST(request: NextRequest) {
  const { 
    generationId, 
    outputs, 
    starredSections, 
    primaryModel, 
    strategy = "basic", 
    critiques, 
    parentSynthesisId 
  } = (await request.json()) as SynthesizeStreamRequest;

  if (!generationId || !outputs || outputs.length === 0 || !primaryModel) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get API key for the primary model (skip for LITELLM)
  let decryptedKey = "";
  if (primaryModel.provider !== "LITELLM") {
    const apiKey = await prisma.aPIKey.findUnique({
      where: { provider: primaryModel.provider },
    });

    if (!apiKey?.isValid) {
      return new Response(
        JSON.stringify({ error: "API key not available for synthesis" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    decryptedKey = decrypt(apiKey.encryptedKey);
  }

  // Build synthesis prompt based on strategy
  const synthesisPrompt = strategy === "sequential" && critiques
    ? buildConsensusPrompt(outputs, critiques, starredSections)
    : buildSynthesisPrompt(outputs, starredSections);

  // For streaming, we use a simpler prompt that just returns content directly
  const systemPrompt = strategy === "sequential"
    ? `You are a skilled editor who synthesizes multiple drafts into one cohesive piece, informed by critical analysis.
Your task is to combine the best elements from each draft while:
1. Addressing the weaknesses identified in the critiques
2. Incorporating the suggested improvements
3. Preserving consensus points that all models agreed upon
4. Maintaining a consistent voice and flow
5. PRESERVING ALL CITATIONS - Keep all [Source: ...] citations and links intact.

Write the final synthesized content directly. Do not include any JSON formatting or metadata - just output the content.`
    : `You are a skilled editor who synthesizes multiple drafts into one cohesive piece.
Your task is to combine the best elements from each draft while maintaining a consistent voice and flow.
Preserve the overall message and key points while improving clarity and engagement.

IMPORTANT: Preserve all source citations in the format [Source: Title] or [Source: Title](URL).

Write the final synthesized content directly. Do not include any JSON formatting or metadata - just output the content.`;

  const { stream, writer } = createSSEStream();

  // Start streaming in the background
  (async () => {
    let accumulatedContent = "";
    
    try {
      // Signal synthesis start
      writer.write({
        type: "synthesis-start",
        data: {
          provider: primaryModel.provider,
          modelId: primaryModel.modelId,
        },
      });

      // Get the streaming generator for the primary model
      const streamGenerator = await getStreamGenerator(
        primaryModel.provider,
        primaryModel.modelId,
        decryptedKey,
        systemPrompt,
        synthesisPrompt
      );

      // Stream chunks
      for await (const chunk of streamGenerator) {
        if (chunk.content) {
          accumulatedContent += chunk.content;
          writer.write({
            type: "synthesis-chunk",
            data: {
              content: chunk.content,
              accumulated: accumulatedContent,
            },
          });
        }
      }

      // Calculate globalVersion based on parent lineage
      let globalVersion = 1;
      if (parentSynthesisId) {
        const parent = await prisma.synthesizedContent.findUnique({
          where: { id: parentSynthesisId },
          select: { globalVersion: true, version: true },
        });
        if (parent) {
          globalVersion = parent.globalVersion + parent.version;
        }
      }

      // Save synthesized content
      const synthesized = await prisma.synthesizedContent.upsert({
        where: { generationId },
        update: {
          content: accumulatedContent,
          strategy,
          version: { increment: 1 },
        },
        create: {
          generationId,
          content: accumulatedContent,
          strategy,
          version: 1,
          parentSynthesisId: parentSynthesisId || null,
          globalVersion,
        },
      });

      // Update generation status
      await prisma.generation.update({
        where: { id: generationId },
        data: { status: "COMPLETED" },
      });

      // Signal completion
      writer.write({
        type: "synthesis-complete",
        data: {
          content: accumulatedContent,
          synthesisId: synthesized.id,
        },
      });
    } catch (error) {
      console.error("Synthesis streaming error:", error);
      writer.write({
        type: "model-error",
        data: {
          error: error instanceof Error ? error.message : "Synthesis failed",
        },
      });
    } finally {
      writer.close();
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function getStreamGenerator(
  provider: string,
  modelId: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<AsyncGenerator<{ content: string; done: boolean; tokensUsed?: number }>> {
  switch (provider) {
    case "OPENAI":
      return generateWithOpenAIStream(apiKey, modelId, systemPrompt, userPrompt);
    case "ANTHROPIC":
      return generateWithAnthropicStream(apiKey, modelId, systemPrompt, userPrompt);
    case "MISTRAL":
      return generateWithMistralStream(apiKey, modelId, systemPrompt, userPrompt);
    case "XAI":
      return generateWithGrokStream(apiKey, modelId, systemPrompt, userPrompt);
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
      return generateWithLiteLLMStream(
        litellmConfig.endpoint,
        litellmKey,
        modelId,
        systemPrompt,
        userPrompt
      );
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

function buildSynthesisPrompt(
  outputs: GenerationOutput[],
  starredSections?: { provider: AIProvider; text: string }[]
): string {
  // Handle single output case
  if (outputs.length === 1) {
    const output = outputs[0];
    const providerName = AI_PROVIDERS[output.provider]?.name || output.provider;
    
    let prompt = `Here is a draft from ${providerName} (${output.model}):\n\n`;
    prompt += output.content;
    prompt += "\n\n";
    
    if (starredSections && starredSections.length > 0) {
      prompt += "The user has specifically highlighted these sections as particularly good:\n\n";
      starredSections.forEach((section) => {
        const sectionProviderName = AI_PROVIDERS[section.provider]?.name || section.provider;
        prompt += `[From ${sectionProviderName}]: "${section.text}"\n`;
      });
      prompt += "\n";
    }
    
    prompt += `Please polish and refine this draft. Improve clarity, flow, and engagement while preserving the core message.${
      starredSections && starredSections.length > 0
        ? " Make sure to keep the highlighted sections, adapting them smoothly if needed."
        : ""
    }

IMPORTANT: Preserve all source citations in the format [Source: Title] or [Source: Title](URL).`;
    
    return prompt;
  }

  // Multiple outputs
  let prompt = "Here are multiple drafts of the same content from different AI models:\n\n";

  outputs.forEach((output, index) => {
    const providerName = AI_PROVIDERS[output.provider]?.name || output.provider;
    prompt += `--- DRAFT ${index + 1} (${providerName} - ${output.model}) ---\n`;
    prompt += output.content;
    prompt += "\n\n";
  });

  if (starredSections && starredSections.length > 0) {
    prompt += "The user has specifically highlighted these sections as particularly good:\n\n";
    starredSections.forEach((section) => {
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

IMPORTANT: Preserve all source citations in the format [Source: Title] or [Source: Title](URL).`;

  return prompt;
}

function buildConsensusPrompt(
  outputs: GenerationOutput[],
  critiques: CritiqueOutput[],
  starredSections?: { provider: AIProvider; text: string }[]
): string {
  let prompt = "Here are multiple drafts of the same content from different AI models:\n\n";

  outputs.forEach((output, index) => {
    const providerName = AI_PROVIDERS[output.provider]?.name || output.provider;
    prompt += `--- DRAFT ${index + 1} (${providerName} - ${output.model}) ---\n`;
    prompt += output.content;
    prompt += "\n\n";
  });

  // Add critique insights
  prompt += "=== CRITICAL ANALYSIS FROM MULTIPLE MODELS ===\n\n";

  const allConsensusPoints = new Set<string>();
  critiques.forEach((critique) => {
    critique.consensusPoints?.forEach((point) => allConsensusPoints.add(point));
  });

  if (allConsensusPoints.size > 0) {
    prompt += "CONSENSUS POINTS (all models agree on these):\n";
    Array.from(allConsensusPoints).forEach((point) => {
      prompt += `• ${point}\n`;
    });
    prompt += "\n";
  }

  outputs.forEach((output, index) => {
    const providerName = AI_PROVIDERS[output.provider]?.name || output.provider;
    prompt += `Analysis of Draft ${index + 1} (${providerName}):\n`;

    const strengths = new Set<string>();
    const weaknesses = new Set<string>();
    const suggestions = new Set<string>();

    critiques.forEach((critique) => {
      const draftCritique = critique.targetDrafts?.find(
        (td) => td.targetModel.provider === output.provider && td.targetModel.modelId === output.model
      );
      if (draftCritique) {
        draftCritique.strengths?.forEach((s) => strengths.add(s));
        draftCritique.weaknesses?.forEach((w) => weaknesses.add(w));
        draftCritique.suggestions?.forEach((s) => suggestions.add(s));
      }
    });

    if (strengths.size > 0) {
      prompt += "  Strengths:\n";
      Array.from(strengths).forEach((s) => {
        prompt += `    ✓ ${s}\n`;
      });
    }

    if (weaknesses.size > 0) {
      prompt += "  Weaknesses to address:\n";
      Array.from(weaknesses).forEach((w) => {
        prompt += `    ✗ ${w}\n`;
      });
    }

    if (suggestions.size > 0) {
      prompt += "  Suggested improvements:\n";
      Array.from(suggestions).forEach((s) => {
        prompt += `    → ${s}\n`;
      });
    }

    prompt += "\n";
  });

  if (starredSections && starredSections.length > 0) {
    prompt += "USER-HIGHLIGHTED SECTIONS (preserve these):\n";
    starredSections.forEach((section) => {
      const providerName = AI_PROVIDERS[section.provider]?.name || section.provider;
      prompt += `[From ${providerName}]: "${section.text}"\n`;
    });
    prompt += "\n";
  }

  prompt += `Please synthesize these drafts into one final, polished piece that:
1. Preserves the consensus points all models agreed upon
2. Incorporates the identified strengths from each draft
3. Addresses the weaknesses through the suggested improvements
${starredSections && starredSections.length > 0 ? "4. Includes the user-highlighted sections, adapting them smoothly" : ""}

IMPORTANT: Preserve all source citations in the format [Source: Title] or [Source: Title](URL).`;

  return prompt;
}
