import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { AIProvider, CritiqueOutput, SynthesisStrategy } from "@/types";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { generateWithAnthropic } from "@/lib/ai/claude";
import { generateWithMistral } from "@/lib/ai/mistral";
import { generateWithGrok } from "@/lib/ai/grok";
import { generateWithLiteLLM } from "@/lib/ai/litellm";
import { generateWithOllama } from "@/lib/ai/ollama";
import { GenerationOutput, SelectedModel } from "@/types";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { buildAntiPatternPromptSection } from "@/lib/ai/anti-patterns";

interface SynthesizeRequest {
  generationId: string;
  outputs: GenerationOutput[];
  starredSections?: { provider: AIProvider; text: string }[];
  primaryModel: SelectedModel;
  strategy?: SynthesisStrategy;
  critiques?: CritiqueOutput[];
  parentSynthesisId?: string; // For parent-child versioning across regenerations
  sourceMap?: Array<{ url: string; title: string }>; // Citation sources for URL references
}

// POST /api/synthesize - Combine outputs into one
export async function POST(request: NextRequest) {
  const { generationId, outputs, starredSections, primaryModel, strategy = "basic", critiques, parentSynthesisId, sourceMap: providedSourceMap } =
    (await request.json()) as SynthesizeRequest;

  if (!generationId || !outputs || outputs.length === 0 || !primaryModel) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Retrieve sourceMap from Generation if not provided
  let sourceMap: Array<{ url: string; title: string }> = providedSourceMap || [];
  if (!sourceMap || sourceMap.length === 0) {
    const generation = await prisma.generation.findUnique({
      where: { id: generationId },
      select: { sourceMap: true },
    });
    if (generation?.sourceMap) {
      try {
        sourceMap = JSON.parse(generation.sourceMap);
      } catch {
        sourceMap = [];
      }
    }
  }

  // Get API key for the primary model (skip for LITELLM and OLLAMA - handled separately)
  let decryptedKey = "";
  if (primaryModel.provider !== "LITELLM" && primaryModel.provider !== "OLLAMA") {
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

  // Build citation context if sourceMap is available
  let citationContext = "";
  if (sourceMap && sourceMap.length > 0) {
    citationContext = "\n\nAVAILABLE CITATION SOURCES:\n";
    sourceMap.forEach((source, i) => {
      if (source.url) {
        citationContext += `${i + 1}. "${source.title}" - ${source.url}\n`;
      } else {
        citationContext += `${i + 1}. "${source.title}" (Knowledge Base entry)\n`;
      }
    });
    citationContext += "\nWhen preserving citations, ensure they are in the format [Source: Title](URL) for web sources with URLs, or [Source: Title] for Knowledge Base entries without URLs.\n";
  }

  const systemPrompt = strategy === "sequential"
    ? `You are a skilled editor who synthesizes multiple drafts into one cohesive piece, informed by critical analysis.
Your task is to combine the best elements from each draft while:
1. Addressing the weaknesses identified in the critiques
2. Incorporating the suggested improvements
3. Preserving consensus points that all models agreed upon
4. Maintaining a consistent voice and flow
5. PRESERVING ALL CITATIONS - Keep all [Source: ...] citations and links intact. These are important for credibility.${citationContext}

STYLE REQUIREMENTS:
- Write naturally and authentically to sound like a real person, not AI
- NEVER use em dashes (—); instead use commas, periods, colons, semicolons, or parentheses
- Vary sentence structure and avoid formulaic patterns
- AVOID contrastive negation structures like "It's not just X, it's Y" or "It's more than just..."
- AVOID sentence stacking: don't write consecutive short, declarative sentences that read like a list without bullets
- Use natural transitions between ideas; connect sentences so they flow into each other

${buildAntiPatternPromptSection({ includeSeverities: ["high", "medium"] })}

FINAL CHECK: After drafting, review the piece as a whole to ensure it reads as one coherent, flowing piece rather than fragmented paragraphs stitched together.

You MUST respond with valid JSON in this exact format:
{
  "content": "The final synthesized content here...",
  "reasoning": {
    "summary": "A 1-2 sentence overview of your synthesis approach",
    "decisions": [
      {
        "aspect": "Structure/Opening/Tone/Key Point/etc.",
        "from": { "provider": "PROVIDER_NAME", "model": "model-id" },
        "choice": "What you chose to do",
        "rationale": "Why you made this choice based on the drafts"
      }
    ]
  }
}

CRITICAL: For each decision, include a "from" field specifying which model's content you chose (using the exact provider name and model ID from the drafts above). If combining elements from multiple models, list the primary source.

Include 3-5 key decisions that explain your thinking. Be specific about which draft elements you chose and why.`
    : `You are a skilled editor who synthesizes multiple drafts into one cohesive piece.
Your task is to combine the best elements from each draft while maintaining a consistent voice and flow.
Preserve the overall message and key points while improving clarity and engagement.

IMPORTANT: Preserve all source citations in the format [Source: Title] or [Source: Title](URL). These citations provide credibility and should be kept intact in the final content.${citationContext}

STYLE REQUIREMENTS:
- Write naturally and authentically to sound like a real person, not AI
- NEVER use em dashes (—); instead use commas, periods, colons, semicolons, or parentheses
- Vary sentence structure and avoid formulaic patterns
- AVOID contrastive negation structures like "It's not just X, it's Y" or "It's more than just..."
- AVOID sentence stacking: don't write consecutive short, declarative sentences that read like a list without bullets
- Use natural transitions between ideas; connect sentences so they flow into each other

${buildAntiPatternPromptSection({ includeSeverities: ["high", "medium"] })}

FINAL CHECK: After drafting, review the piece as a whole to ensure it reads as one coherent, flowing piece rather than fragmented paragraphs stitched together.

You MUST respond with valid JSON in this exact format:
{
  "content": "The final synthesized content here...",
  "reasoning": {
    "summary": "A 1-2 sentence overview of your synthesis approach",
    "decisions": [
      {
        "aspect": "Structure/Opening/Tone/Key Point/etc.",
        "from": { "provider": "PROVIDER_NAME", "model": "model-id" },
        "choice": "What you chose to do",
        "rationale": "Why you made this choice based on the drafts"
      }
    ]
  }
}

CRITICAL: For each decision, include a "from" field specifying which model's content you chose (using the exact provider name and model ID from the drafts above). If combining elements from multiple models, list the primary source.

Include 3-5 key decisions that explain your thinking. Be specific about which draft elements you chose and why.`;

  // Helper function to generate with a specific provider
  async function tryGenerate(
    provider: string,
    modelId: string,
    key: string
  ): Promise<{ content: string; tokensUsed: number }> {
    switch (provider) {
      case "OPENAI":
        return generateWithOpenAI(key, modelId, systemPrompt, synthesisPrompt);
      case "ANTHROPIC":
        return generateWithAnthropic(key, modelId, systemPrompt, synthesisPrompt);
      case "MISTRAL":
        return generateWithMistral(key, modelId, systemPrompt, synthesisPrompt);
      case "XAI":
        return generateWithGrok(key, modelId, systemPrompt, synthesisPrompt);
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
        return generateWithLiteLLM(
          litellmConfig.endpoint,
          litellmKey,
          modelId,
          systemPrompt,
          synthesisPrompt
        );
      }
      case "OLLAMA": {
        const ollamaConfig = await prisma.ollamaConfig.findFirst({
          where: { isEnabled: true, isValid: true },
        });
        if (!ollamaConfig) {
          throw new Error("Ollama not configured");
        }
        const ollamaKey = ollamaConfig.encryptedKey
          ? decrypt(ollamaConfig.encryptedKey)
          : undefined;
        return generateWithOllama(
          ollamaConfig.endpoint,
          ollamaKey,
          modelId,
          systemPrompt,
          synthesisPrompt
        );
      }
      default:
        throw new Error("Unsupported provider");
    }
  }

  try {
    let result: { content: string; tokensUsed: number };

    // Try primary model first
    try {
      result = await tryGenerate(primaryModel.provider, primaryModel.modelId, decryptedKey);
    } catch (primaryError) {
      console.error(`Primary model (${primaryModel.provider}) failed:`, primaryError);
      
      // Fallback to LiteLLM if available and primary wasn't already LiteLLM
      if (primaryModel.provider !== "LITELLM") {
        const litellmConfig = await prisma.liteLLMConfig.findFirst({
          where: { isEnabled: true, isValid: true },
        });
        
        if (litellmConfig) {
          console.log("Falling back to LiteLLM for synthesis...");
          const litellmKey = litellmConfig.encryptedKey
            ? decrypt(litellmConfig.encryptedKey)
            : undefined;
          
          // Get first available LiteLLM model
          let models: { id: string }[] = [];
          try {
            models = JSON.parse(litellmConfig.cachedModels || "[]");
          } catch {
            models = [];
          }
          
          const fallbackModel = models[0]?.id;
          if (fallbackModel) {
            result = await generateWithLiteLLM(
              litellmConfig.endpoint,
              litellmKey,
              fallbackModel,
              systemPrompt,
              synthesisPrompt
            );
          } else {
            throw primaryError; // No fallback available
          }
        } else {
          throw primaryError; // No LiteLLM configured
        }
      } else {
        throw primaryError; // Primary was LiteLLM and it failed
      }
    }

    // Parse the JSON response to extract content and reasoning
    let finalContent: string;
    let reasoning: string | null = null;

    try {
      // Strip markdown code blocks if present (LLMs often wrap JSON in ```json ... ```)
      let jsonContent = result.content.trim();
      
      // Handle multiple possible code block formats
      // Match: ```json\n{...}\n``` or ```\n{...}\n``` or just {...}
      const codeBlockMatch = jsonContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch) {
        jsonContent = codeBlockMatch[1].trim();
      } else if (jsonContent.startsWith("```")) {
        // Fallback: Remove opening fence (```json or ```)
        jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, "");
        // Remove closing fence
        jsonContent = jsonContent.replace(/\n?```\s*$/, "");
      }
      
      // Find the JSON object - in case there's text before or after
      const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonContent = jsonMatch[0];
      }

      // Try to parse as JSON (new format with reasoning)
      const parsed = JSON.parse(jsonContent);
      
      // Check that content exists and is a string
      if (typeof parsed.content === "string" && parsed.content.trim()) {
        finalContent = parsed.content;
      } else {
        // Fallback to raw content if no content field
        console.warn("Synthesis JSON has no valid content field, using raw response");
        finalContent = result.content;
      }
      
      if (parsed.reasoning) {
        reasoning = JSON.stringify(parsed.reasoning);
      }
    } catch (parseError) {
      // If not valid JSON, use raw content (legacy format or fallback)
      console.warn("Could not parse synthesis JSON, using raw content:", parseError);
      finalContent = result.content;
    }
    
    // Final safety check - ensure we have content
    if (!finalContent || finalContent.trim() === "") {
      console.error("Synthesis returned empty content, raw response:", result.content.substring(0, 500));
      return NextResponse.json({ error: "Synthesis returned empty content" }, { status: 500 });
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

    // Track synthesis contributions for quality analytics
    // Track even without reasoning to ensure participations are counted
    if (outputs.length > 1) {
      await trackSynthesisContributions(synthesized.id, generationId, reasoning, outputs, starredSections);
    }

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
    const errorMessage = error instanceof Error ? error.message : "Unknown error during synthesis";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

function buildSynthesisPrompt(
  outputs: GenerationOutput[],
  starredSections?: { provider: AIProvider; text: string }[]
): string {
  // Handle single output case - just polish, don't pretend to merge
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

IMPORTANT: Preserve all source citations in the format [Source: Title] or [Source: Title](URL). These citations provide credibility and should be kept intact.

Remember to respond with valid JSON containing both "content" and "reasoning" as specified.`;
    
    return prompt;
  }

  // Multiple outputs - original synthesis logic
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

IMPORTANT: Preserve all source citations in the format [Source: Title] or [Source: Title](URL). These citations provide credibility and should be kept intact.

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

IMPORTANT: Preserve all source citations in the format [Source: Title] or [Source: Title](URL). These citations provide credibility and should be kept intact.

Remember to respond with valid JSON containing both "content" and "reasoning" as specified.`;

  return prompt;
}

// Track which models contributed to the synthesis for quality analytics
async function trackSynthesisContributions(
  synthesisId: string,
  generationId: string,
  reasoningJson: string | null,
  outputs: GenerationOutput[],
  starredSections?: { provider: AIProvider; text: string }[]
) {
  try {
    // Initialize contributions for all participating models
    const contributions: Record<string, { aspects: string[]; count: number }> = {};
    for (const output of outputs) {
      const key = `${output.provider}:${output.model}`;
      contributions[key] = { aspects: [], count: 0 };
    }

    let totalAspects = 0;

    // If we have reasoning, parse detailed contributions
    if (reasoningJson) {
      try {
        const reasoning = JSON.parse(reasoningJson);
        const decisions = reasoning.decisions || [];
        totalAspects = decisions.length;

        // Count decisions where each model was selected
        for (const decision of decisions) {
          if (decision.from?.provider && decision.from?.model) {
            const key = `${decision.from.provider}:${decision.from.model || decision.from.modelId}`;
            if (contributions[key]) {
              contributions[key].count++;
              if (decision.aspect) {
                contributions[key].aspects.push(decision.aspect);
              }
            }
          }
        }
      } catch (parseError) {
        console.error("Failed to parse reasoning for contributions:", parseError);
        // Fall through to participation-only tracking
      }
    }

    // If no reasoning or parsing failed, track participation only
    // This ensures all models get credit for participating even without detailed reasoning
    if (totalAspects === 0) {
      totalAspects = 1; // Set to 1 so participations are tracked
      // Don't assign aspect counts - leave at 0 to indicate no detailed tracking
    }

    // Count starred sections per model
    const starredCounts: Record<string, number> = {};
    if (starredSections) {
      for (const section of starredSections) {
        // Find matching output to get the model
        const matchingOutput = outputs.find(o => o.provider === section.provider);
        if (matchingOutput) {
          const key = `${matchingOutput.provider}:${matchingOutput.model}`;
          starredCounts[key] = (starredCounts[key] || 0) + 1;
        }
      }
    }

    // Store contribution records
    const contributionRecords = Object.entries(contributions).map(([key, data]) => {
      const [provider, model] = key.split(":");
      return {
        synthesisId,
        generationId,
        provider,
        model,
        aspectCount: data.count,
        totalAspects,
        aspectTypes: JSON.stringify(data.aspects),
        starredCount: starredCounts[key] || 0,
      };
    });

    // Delete existing contributions for this synthesis and insert new ones
    await prisma.synthesisContribution.deleteMany({
      where: { synthesisId },
    });

    if (contributionRecords.length > 0) {
      await prisma.synthesisContribution.createMany({
        data: contributionRecords,
      });
    }
  } catch (error) {
    // Don't fail synthesis if contribution tracking fails
    console.error("Failed to track synthesis contributions:", error);
  }
}
