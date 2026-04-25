import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { AIProvider, CritiqueOutput, SynthesisStrategy } from "@/types";
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
  strategy?: SynthesisStrategy;
  critiques?: CritiqueOutput[];
  parentSynthesisId?: string; // For parent-child versioning across regenerations
}

// POST /api/synthesize - Combine outputs into one
export async function POST(request: NextRequest) {
  const { generationId, outputs, starredSections, primaryModel, strategy = "basic", critiques, parentSynthesisId } =
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

  // Build synthesis prompt based on strategy
  const synthesisPrompt = strategy === "sequential" && critiques
    ? buildConsensusPrompt(outputs, critiques, starredSections)
    : buildSynthesisPrompt(outputs, starredSections);

  const systemPrompt = strategy === "sequential"
    ? `You are a skilled editor who synthesizes multiple drafts into one cohesive piece, informed by critical analysis.
Your task is to combine the best elements from each draft while:
1. Addressing the weaknesses identified in the critiques
2. Incorporating the suggested improvements
3. Preserving consensus points that all models agreed upon
4. Maintaining a consistent voice and flow

You MUST respond with valid JSON in this exact format:
{
  "content": "The final synthesized content here...",
  "reasoning": {
    "summary": "A 1-2 sentence overview of your synthesis approach",
    "decisions": [
      {
        "aspect": "Structure/Opening/Tone/Key Point/etc.",
        "choice": "What you chose to do",
        "rationale": "Why you made this choice based on the drafts"
      }
    ]
  }
}

Include 3-5 key decisions that explain your thinking. Be specific about which draft elements you chose and why.`
    : `You are a skilled editor who synthesizes multiple drafts into one cohesive piece.
Your task is to combine the best elements from each draft while maintaining a consistent voice and flow.
Preserve the overall message and key points while improving clarity and engagement.

You MUST respond with valid JSON in this exact format:
{
  "content": "The final synthesized content here...",
  "reasoning": {
    "summary": "A 1-2 sentence overview of your synthesis approach",
    "decisions": [
      {
        "aspect": "Structure/Opening/Tone/Key Point/etc.",
        "choice": "What you chose to do",
        "rationale": "Why you made this choice based on the drafts"
      }
    ]
  }
}

Include 3-5 key decisions that explain your thinking. Be specific about which draft elements you chose and why.`;

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

    // Parse the JSON response to extract content and reasoning
    let finalContent: string;
    let reasoning: string | null = null;

    try {
      // Strip markdown code blocks if present (LLMs often wrap JSON in ```json ... ```)
      let jsonContent = result.content.trim();
      if (jsonContent.startsWith("```")) {
        // Remove opening fence (```json or ```)
        jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, "");
        // Remove closing fence
        jsonContent = jsonContent.replace(/\n?```\s*$/, "");
      }

      // Try to parse as JSON (new format with reasoning)
      const parsed = JSON.parse(jsonContent);
      finalContent = parsed.content || result.content;
      if (parsed.reasoning) {
        reasoning = JSON.stringify(parsed.reasoning);
      }
    } catch {
      // If not valid JSON, use raw content (legacy format or fallback)
      finalContent = result.content;
    }

    // Calculate globalVersion based on parent lineage
    let globalVersion = 1;
    if (parentSynthesisId) {
      const parent = await prisma.synthesizedContent.findUnique({
        where: { id: parentSynthesisId },
        select: { globalVersion: true, version: true },
      });
      if (parent) {
        // Global version = parent's global version + parent's local edits + 1
        globalVersion = parent.globalVersion + parent.version;
      }
    }

    // Save synthesized content with reasoning and lineage tracking
    const synthesized = await prisma.synthesizedContent.upsert({
      where: { generationId },
      update: {
        content: finalContent,
        reasoning,
        strategy,
        version: { increment: 1 },
      },
      create: {
        generationId,
        content: finalContent,
        reasoning,
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

    return NextResponse.json({ 
      content: finalContent, 
      synthesisId: synthesized.id,
      reasoning: reasoning ? JSON.parse(reasoning) : null,
    });
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

Remember to respond with valid JSON containing both "content" and "reasoning" as specified.`;

  return prompt;
}

// Build synthesis prompt with critique insights
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

  // Aggregate consensus points
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

  // Aggregate strengths and weaknesses per draft
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

Remember to respond with valid JSON containing both "content" and "reasoning" as specified.`;

  return prompt;
}
