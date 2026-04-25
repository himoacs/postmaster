import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { AIProvider, CritiqueOutput, CritiquedDraft, GenerationOutput, SelectedModel } from "@/types";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { generateWithAnthropic } from "@/lib/ai/claude";
import { generateWithMistral } from "@/lib/ai/mistral";
import { generateWithGrok } from "@/lib/ai/grok";
import { generateWithLiteLLM } from "@/lib/ai/litellm";
import { AI_PROVIDERS } from "@/lib/ai/providers";

interface CritiqueRequest {
  generationId: string;
  outputs: GenerationOutput[];
  critiqueModels: SelectedModel[]; // Models that will critique the outputs
  debateRound?: number; // For debate mode
}

// POST /api/critique - Generate cross-model critiques
export async function POST(request: NextRequest) {
  const { generationId, outputs, critiqueModels, debateRound = 0 } =
    (await request.json()) as CritiqueRequest;

  if (!generationId || !outputs || outputs.length === 0 || !critiqueModels || critiqueModels.length === 0) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    // Generate critiques in parallel - each model critiques all outputs
    const critiquePromises = critiqueModels.map(async (critiqueModel) => {
      const critique = await generateCritique(critiqueModel, outputs);
      
      // Store critique in database
      await prisma.generationCritique.create({
        data: {
          generationId,
          fromProvider: critiqueModel.provider,
          fromModel: critiqueModel.modelId,
          critiques: JSON.stringify(critique),
          debateRound,
        },
      });

      return critique;
    });

    const critiques = await Promise.all(critiquePromises);

    return NextResponse.json({ critiques });
  } catch (error) {
    console.error("Critique error:", error);
    return NextResponse.json({ error: "Critique generation failed" }, { status: 500 });
  }
}

async function generateCritique(
  critiqueModel: SelectedModel,
  outputs: GenerationOutput[]
): Promise<CritiqueOutput> {
  // Get API key
  let decryptedKey = "";
  if (critiqueModel.provider !== "LITELLM") {
    const apiKey = await prisma.aPIKey.findUnique({
      where: { provider: critiqueModel.provider },
    });

    if (!apiKey?.isValid) {
      throw new Error(`API key not available for ${critiqueModel.provider}`);
    }

    decryptedKey = decrypt(apiKey.encryptedKey);
  }

  const systemPrompt = `You are an expert writing critic and editor. Your task is to critically evaluate multiple drafts of the same content and provide structured feedback.

For each draft, identify:
1. Strengths: What does this draft do particularly well?
2. Weaknesses: What could be improved?
3. Suggestions: Specific recommendations for improvement
4. Rating: A score from 1-10

Also identify:
- Consensus points: Ideas or approaches that appear across multiple drafts
- Overall assessment: How would you rate the collective quality?

Respond ONLY in valid JSON format with this exact structure:
{
  "targetDrafts": [
    {
      "draftIndex": 0,
      "strengths": ["strength1", "strength2"],
      "weaknesses": ["weakness1", "weakness2"],
      "suggestions": ["suggestion1", "suggestion2"],
      "rating": 8
    }
  ],
  "consensusPoints": ["point1", "point2"],
  "overallRating": 7
}`;

  const userPrompt = buildCritiquePrompt(outputs);

  let result: { content: string; tokensUsed: number };

  switch (critiqueModel.provider) {
    case "OPENAI":
      result = await generateWithOpenAI(
        decryptedKey,
        critiqueModel.modelId,
        systemPrompt,
        userPrompt
      );
      break;
    case "ANTHROPIC":
      result = await generateWithAnthropic(
        decryptedKey,
        critiqueModel.modelId,
        systemPrompt,
        userPrompt
      );
      break;
    case "MISTRAL":
      result = await generateWithMistral(
        decryptedKey,
        critiqueModel.modelId,
        systemPrompt,
        userPrompt
      );
      break;
    case "XAI":
      result = await generateWithGrok(
        decryptedKey,
        critiqueModel.modelId,
        systemPrompt,
        userPrompt
      );
      break;
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
      result = await generateWithLiteLLM(
        litellmConfig.endpoint,
        litellmKey,
        critiqueModel.modelId,
        systemPrompt,
        userPrompt
      );
      break;
    }
    default:
      throw new Error("Unsupported provider");
  }

  // Parse JSON response
  const parsedCritique = parseCritiqueResponse(result.content, outputs, critiqueModel);
  return parsedCritique;
}

function buildCritiquePrompt(outputs: GenerationOutput[]): string {
  let prompt = "Please critique the following drafts:\n\n";

  outputs.forEach((output, index) => {
    const providerName = AI_PROVIDERS[output.provider]?.name || output.provider;
    prompt += `--- DRAFT ${index} (${providerName} - ${output.model}) ---\n`;
    prompt += output.content;
    prompt += "\n\n";
  });

  prompt += "Provide your critical analysis in the JSON format specified.";
  return prompt;
}

function parseCritiqueResponse(
  response: string,
  outputs: GenerationOutput[],
  fromModel: SelectedModel
): CritiqueOutput {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr.trim());

    // Map parsed response to CritiqueOutput format
    const targetDrafts: CritiquedDraft[] = parsed.targetDrafts.map(
      (draft: { draftIndex: number; strengths: string[]; weaknesses: string[]; suggestions: string[]; rating: number }) => ({
        targetModel: {
          provider: outputs[draft.draftIndex].provider,
          modelId: outputs[draft.draftIndex].model,
        },
        strengths: draft.strengths || [],
        weaknesses: draft.weaknesses || [],
        suggestions: draft.suggestions || [],
        rating: draft.rating || 5,
      })
    );

    return {
      fromModel,
      targetDrafts,
      overallRating: parsed.overallRating || 5,
      consensusPoints: parsed.consensusPoints || [],
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to parse critique response:", error);
    // Return a default critique if parsing fails
    return {
      fromModel,
      targetDrafts: outputs.map((output) => ({
        targetModel: { provider: output.provider, modelId: output.model },
        strengths: ["Unable to parse detailed critique"],
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

// GET /api/critique - Get critiques for a generation
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const generationId = searchParams.get("generationId");
  const debateRound = searchParams.get("debateRound");

  if (!generationId) {
    return NextResponse.json({ error: "generationId required" }, { status: 400 });
  }

  const whereClause: { generationId: string; debateRound?: number } = { generationId };
  if (debateRound !== null) {
    whereClause.debateRound = parseInt(debateRound, 10);
  }

  const critiques = await prisma.generationCritique.findMany({
    where: whereClause,
    orderBy: { createdAt: "asc" },
  });

  // Parse stored JSON critiques
  const parsedCritiques = critiques.map((c) => ({
    ...JSON.parse(c.critiques),
    fromProvider: c.fromProvider,
    fromModel: c.fromModel,
    debateRound: c.debateRound,
  }));

  return NextResponse.json({ critiques: parsedCritiques });
}
