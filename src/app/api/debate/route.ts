import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { 
  AIProvider, 
  CritiqueOutput, 
  DebateRound, 
  DebateSession, 
  DebateTranscriptEntry,
  GenerationOutput, 
  SelectedModel 
} from "@/types";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { generateWithAnthropic } from "@/lib/ai/claude";
import { generateWithMistral } from "@/lib/ai/mistral";
import { generateWithGrok } from "@/lib/ai/grok";
import { generateWithLiteLLM } from "@/lib/ai/litellm";
import { AI_PROVIDERS } from "@/lib/ai/providers";

interface DebateRequest {
  generationId: string;
  outputs: GenerationOutput[];
  debateModels: SelectedModel[]; // Models participating in debate
  maxRounds?: number;
  starredSections?: { provider: AIProvider; text: string }[];
  primaryModel: SelectedModel; // Model for final synthesis
  parentSynthesisId?: string; // For parent-child versioning across regenerations
}

interface DebateResponse {
  session: DebateSession;
  finalContent: string;
  synthesisId: string;
}

// POST /api/debate - Run a multi-round debate
export async function POST(request: NextRequest) {
  const { 
    generationId, 
    outputs, 
    debateModels, 
    maxRounds = 3, 
    starredSections,
    primaryModel,
    parentSynthesisId 
  } = (await request.json()) as DebateRequest;

  if (!generationId || !outputs || outputs.length === 0 || !debateModels || debateModels.length === 0) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const session: DebateSession = {
    id: `debate-${Date.now()}`,
    generationId,
    strategy: "debate",
    rounds: [],
    maxRounds,
    converged: false,
    finalConsensus: "",
    transcript: [],
  };

  let currentOutputs = outputs;
  let previousIssueCount = Infinity;

  try {
    // Run debate rounds
    for (let round = 1; round <= maxRounds; round++) {
      const roundResult = await runDebateRound(
        generationId,
        round,
        currentOutputs,
        debateModels,
        session.transcript
      );

      session.rounds.push(roundResult);

      // Check for convergence
      const improvementRate = previousIssueCount > 0 
        ? (previousIssueCount - roundResult.newIssuesFound) / previousIssueCount 
        : 0;

      if (roundResult.convergenceScore > 0.85 || roundResult.newIssuesFound === 0) {
        session.converged = true;
        break;
      }

      // If very few new issues, likely converging
      if (roundResult.newIssuesFound <= 2 && improvementRate > 0.5) {
        session.converged = true;
        break;
      }

      previousIssueCount = roundResult.newIssuesFound;
    }

    // Final synthesis using all debate insights
    const allCritiques = session.rounds.flatMap(r => r.critiques);
    const finalContent = await synthesizeWithDebateInsights(
      generationId,
      outputs,
      allCritiques,
      starredSections,
      primaryModel,
      session.transcript
    );

    session.finalConsensus = finalContent;

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

    // Save to database with lineage tracking
    const synthesized = await prisma.synthesizedContent.upsert({
      where: { generationId },
      update: {
        content: finalContent,
        strategy: "debate",
        version: { increment: 1 },
        feedback: JSON.stringify({
          debateSession: {
            rounds: session.rounds.length,
            converged: session.converged,
            finalConvergence: session.rounds[session.rounds.length - 1]?.convergenceScore || 0,
          },
        }),
      },
      create: {
        generationId,
        content: finalContent,
        strategy: "debate",
        version: 1,
        feedback: JSON.stringify({
          debateSession: {
            rounds: session.rounds.length,
            converged: session.converged,
            finalConvergence: session.rounds[session.rounds.length - 1]?.convergenceScore || 0,
          },
        }),
        parentSynthesisId: parentSynthesisId || null,
        globalVersion,
      },
    });

    await prisma.generation.update({
      where: { id: generationId },
      data: { status: "COMPLETED" },
    });

    const response: DebateResponse = {
      session,
      finalContent,
      synthesisId: synthesized.id,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Debate error:", error);
    return NextResponse.json({ error: "Debate failed" }, { status: 500 });
  }
}

async function runDebateRound(
  generationId: string,
  roundNumber: number,
  outputs: GenerationOutput[],
  debateModels: SelectedModel[],
  transcript: DebateTranscriptEntry[]
): Promise<DebateRound> {
  // Each model critiques all outputs
  const critiquePromises = debateModels.map(async (model) => {
    const critique = await generateCritiqueForDebate(model, outputs, roundNumber, transcript);
    
    // Store critique
    await prisma.generationCritique.create({
      data: {
        generationId,
        fromProvider: model.provider,
        fromModel: model.modelId,
        critiques: JSON.stringify(critique),
        debateRound: roundNumber,
      },
    });

    // Add to transcript
    transcript.push({
      roundNumber,
      model,
      type: "critique",
      content: formatCritiqueForTranscript(critique),
      timestamp: new Date().toISOString(),
    });

    return critique;
  });

  const critiques = await Promise.all(critiquePromises);

  // Calculate convergence and issue counts
  const convergenceScore = calculateConvergence(critiques);
  const newIssuesFound = countNewIssues(critiques);

  return {
    roundNumber,
    critiques,
    convergenceScore,
    newIssuesFound,
    timestamp: new Date().toISOString(),
  };
}

async function generateCritiqueForDebate(
  model: SelectedModel,
  outputs: GenerationOutput[],
  roundNumber: number,
  previousTranscript: DebateTranscriptEntry[]
): Promise<CritiqueOutput> {
  let decryptedKey = "";
  if (model.provider !== "LITELLM") {
    const apiKey = await prisma.aPIKey.findUnique({
      where: { provider: model.provider },
    });
    if (!apiKey?.isValid) {
      throw new Error(`API key not available for ${model.provider}`);
    }
    decryptedKey = decrypt(apiKey.encryptedKey);
  }

  // Build context-aware prompt including previous debate rounds
  const systemPrompt = `You are participating in a multi-model debate to improve content quality.

Round ${roundNumber} of the debate. Your role is to:
1. Critically analyze each draft
2. Build on insights from previous rounds
3. Identify NEW issues not yet discussed
4. Work toward consensus on the best approach

Respond ONLY in valid JSON format:
{
  "targetDrafts": [
    {
      "draftIndex": 0,
      "strengths": ["strength1"],
      "weaknesses": ["weakness1"],
      "suggestions": ["suggestion1"],
      "rating": 8
    }
  ],
  "consensusPoints": ["point1"],
  "overallRating": 7,
  "newInsights": ["new issue or insight not previously discussed"]
}`;

  let userPrompt = "DRAFTS TO EVALUATE:\n\n";
  outputs.forEach((output, index) => {
    const providerName = AI_PROVIDERS[output.provider]?.name || output.provider;
    userPrompt += `--- DRAFT ${index} (${providerName}) ---\n${output.content}\n\n`;
  });

  // Include relevant previous debate context
  if (previousTranscript.length > 0) {
    userPrompt += "\n=== PREVIOUS DEBATE CONTEXT ===\n";
    const recentEntries = previousTranscript.slice(-6); // Last 6 entries
    recentEntries.forEach((entry) => {
      const modelName = AI_PROVIDERS[entry.model.provider]?.name || entry.model.provider;
      userPrompt += `[Round ${entry.roundNumber} - ${modelName}]: ${entry.content.substring(0, 500)}...\n\n`;
    });
  }

  userPrompt += "\nProvide your critique, focusing on NEW insights for this round.";

  let result: { content: string; tokensUsed: number };

  switch (model.provider) {
    case "OPENAI":
      result = await generateWithOpenAI(decryptedKey, model.modelId, systemPrompt, userPrompt);
      break;
    case "ANTHROPIC":
      result = await generateWithAnthropic(decryptedKey, model.modelId, systemPrompt, userPrompt);
      break;
    case "MISTRAL":
      result = await generateWithMistral(decryptedKey, model.modelId, systemPrompt, userPrompt);
      break;
    case "XAI":
      result = await generateWithGrok(decryptedKey, model.modelId, systemPrompt, userPrompt);
      break;
    case "LITELLM": {
      const litellmConfig = await prisma.liteLLMConfig.findFirst({
        where: { isEnabled: true, isValid: true },
      });
      if (!litellmConfig) throw new Error("LiteLLM not configured");
      const litellmKey = litellmConfig.encryptedKey ? decrypt(litellmConfig.encryptedKey) : undefined;
      result = await generateWithLiteLLM(litellmConfig.endpoint, litellmKey, model.modelId, systemPrompt, userPrompt);
      break;
    }
    default:
      throw new Error("Unsupported provider");
  }

  return parseCritiqueResponse(result.content, outputs, model);
}

function parseCritiqueResponse(
  response: string,
  outputs: GenerationOutput[],
  fromModel: SelectedModel
): CritiqueOutput {
  try {
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];

    const parsed = JSON.parse(jsonStr.trim());

    return {
      fromModel,
      targetDrafts: (parsed.targetDrafts || []).map(
        (draft: { draftIndex: number; strengths?: string[]; weaknesses?: string[]; suggestions?: string[]; rating?: number }) => ({
          targetModel: {
            provider: outputs[draft.draftIndex]?.provider || "OPENAI",
            modelId: outputs[draft.draftIndex]?.model || "unknown",
          },
          strengths: draft.strengths || [],
          weaknesses: draft.weaknesses || [],
          suggestions: draft.suggestions || [],
          rating: draft.rating || 5,
        })
      ),
      overallRating: parsed.overallRating || 5,
      consensusPoints: parsed.consensusPoints || [],
      timestamp: new Date().toISOString(),
    };
  } catch {
    return {
      fromModel,
      targetDrafts: outputs.map((output) => ({
        targetModel: { provider: output.provider, modelId: output.model },
        strengths: ["Unable to parse critique"],
        weaknesses: [],
        suggestions: [],
        rating: 5,
      })),
      overallRating: 5,
      consensusPoints: [],
      timestamp: new Date().toISOString(),
    };
  }
}

function calculateConvergence(critiques: CritiqueOutput[]): number {
  if (critiques.length < 2) return 1;

  // Calculate rating variance across critiques
  const avgRatings = critiques.map((c) => {
    const ratings = c.targetDrafts.map((td) => td.rating);
    return ratings.reduce((a, b) => a + b, 0) / ratings.length;
  });

  const mean = avgRatings.reduce((a, b) => a + b, 0) / avgRatings.length;
  const variance = avgRatings.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / avgRatings.length;
  
  // Lower variance = higher convergence
  // Normalize: variance of 0 = 1.0 convergence, variance of 10+ = 0 convergence
  return Math.max(0, 1 - variance / 10);
}

function countNewIssues(critiques: CritiqueOutput[]): number {
  const allWeaknesses = new Set<string>();
  critiques.forEach((c) => {
    c.targetDrafts.forEach((td) => {
      td.weaknesses.forEach((w) => allWeaknesses.add(w.toLowerCase().trim()));
    });
  });
  return allWeaknesses.size;
}

function formatCritiqueForTranscript(critique: CritiqueOutput): string {
  const summary = critique.targetDrafts
    .map((td, i) => `Draft ${i}: ${td.rating}/10 - ${td.weaknesses.slice(0, 2).join(", ")}`)
    .join("; ");
  return `${summary}. Consensus: ${critique.consensusPoints.slice(0, 2).join(", ")}`;
}

async function synthesizeWithDebateInsights(
  generationId: string,
  outputs: GenerationOutput[],
  critiques: CritiqueOutput[],
  starredSections: { provider: AIProvider; text: string }[] | undefined,
  primaryModel: SelectedModel,
  transcript: DebateTranscriptEntry[]
): Promise<string> {
  let decryptedKey = "";
  if (primaryModel.provider !== "LITELLM") {
    const apiKey = await prisma.aPIKey.findUnique({
      where: { provider: primaryModel.provider },
    });
    if (!apiKey?.isValid) {
      throw new Error("API key not available for synthesis");
    }
    decryptedKey = decrypt(apiKey.encryptedKey);
  }

  const systemPrompt = `You are a skilled editor synthesizing content after a thorough multi-model debate.
Multiple AI models have analyzed and debated the drafts. Your task is to create the final, optimized version that:
1. Incorporates the consensus points all models agreed upon
2. Addresses the weaknesses identified through debate
3. Applies the best suggestions from all models
4. Maintains a cohesive, engaging voice

Output ONLY the final content, no meta-commentary.`;

  let userPrompt = "=== ORIGINAL DRAFTS ===\n\n";
  outputs.forEach((output, index) => {
    const providerName = AI_PROVIDERS[output.provider]?.name || output.provider;
    userPrompt += `--- DRAFT ${index + 1} (${providerName}) ---\n${output.content}\n\n`;
  });

  userPrompt += "\n=== DEBATE INSIGHTS ===\n\n";

  // Aggregate all consensus points
  const consensusPoints = new Set<string>();
  critiques.forEach((c) => c.consensusPoints?.forEach((p) => consensusPoints.add(p)));
  
  if (consensusPoints.size > 0) {
    userPrompt += "CONSENSUS (all models agree):\n";
    Array.from(consensusPoints).forEach((p) => userPrompt += `• ${p}\n`);
    userPrompt += "\n";
  }

  // Aggregate improvements by draft
  outputs.forEach((output, index) => {
    const providerName = AI_PROVIDERS[output.provider]?.name || output.provider;
    const avgRating = critiques
      .flatMap((c) => c.targetDrafts.filter((td) => td.targetModel.modelId === output.model))
      .reduce((sum, td, _, arr) => sum + td.rating / arr.length, 0);

    userPrompt += `Draft ${index + 1} (${providerName}) - Avg Rating: ${avgRating.toFixed(1)}/10\n`;

    const suggestions = new Set<string>();
    critiques.forEach((c) => {
      c.targetDrafts
        .filter((td) => td.targetModel.modelId === output.model)
        .forEach((td) => td.suggestions.forEach((s) => suggestions.add(s)));
    });

    if (suggestions.size > 0) {
      userPrompt += "  Key improvements:\n";
      Array.from(suggestions).slice(0, 5).forEach((s) => userPrompt += `    → ${s}\n`);
    }
    userPrompt += "\n";
  });

  if (starredSections && starredSections.length > 0) {
    userPrompt += "USER-HIGHLIGHTED SECTIONS (preserve):\n";
    starredSections.forEach((s) => {
      const providerName = AI_PROVIDERS[s.provider]?.name || s.provider;
      userPrompt += `[${providerName}]: "${s.text}"\n`;
    });
    userPrompt += "\n";
  }

  userPrompt += "Create the final, optimized content incorporating all debate insights.";

  let result: { content: string; tokensUsed: number };

  switch (primaryModel.provider) {
    case "OPENAI":
      result = await generateWithOpenAI(decryptedKey, primaryModel.modelId, systemPrompt, userPrompt);
      break;
    case "ANTHROPIC":
      result = await generateWithAnthropic(decryptedKey, primaryModel.modelId, systemPrompt, userPrompt);
      break;
    case "MISTRAL":
      result = await generateWithMistral(decryptedKey, primaryModel.modelId, systemPrompt, userPrompt);
      break;
    case "XAI":
      result = await generateWithGrok(decryptedKey, primaryModel.modelId, systemPrompt, userPrompt);
      break;
    case "LITELLM": {
      const litellmConfig = await prisma.liteLLMConfig.findFirst({
        where: { isEnabled: true, isValid: true },
      });
      if (!litellmConfig) throw new Error("LiteLLM not configured");
      const litellmKey = litellmConfig.encryptedKey ? decrypt(litellmConfig.encryptedKey) : undefined;
      result = await generateWithLiteLLM(litellmConfig.endpoint, litellmKey, primaryModel.modelId, systemPrompt, userPrompt);
      break;
    }
    default:
      throw new Error("Unsupported provider");
  }

  // Add synthesis to transcript
  transcript.push({
    roundNumber: 0, // Final synthesis
    model: primaryModel,
    type: "synthesis",
    content: "Final synthesis completed",
    timestamp: new Date().toISOString(),
  });

  return result.content;
}
