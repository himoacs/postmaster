import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { generateWithLiteLLM } from "@/lib/ai/litellm";

export interface ToneScore {
  professional: number; // 1-10
  casual: number;
  urgent: number;
  friendly: number;
  authoritative: number;
  empathetic: number;
}

export interface ToneResult {
  scores: ToneScore;
  dominantTone: string;
  summary: string;
  suggestions: string[];
}

// POST /api/analyze/tone - Analyze content tone using AI
export async function POST(request: NextRequest) {
  try {
    const { content, targetTone } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Get LiteLLM config
    const litellmConfig = await prisma.liteLLMConfig.findFirst({
      where: { isEnabled: true, isValid: true },
    });

    if (!litellmConfig) {
      return NextResponse.json(
        { error: "No AI provider configured for tone analysis" },
        { status: 400 }
      );
    }

    // Pick a low-cost model for analysis
    const models = JSON.parse(litellmConfig.cachedModels || "[]") as Array<{
      id: string;
      costTier: string;
    }>;
    const cheapModel = models.find((m) => m.costTier === "low") || models[0];
    const modelId = cheapModel?.id || "azure-gpt-4o-mini";

    const litellmKey = litellmConfig.encryptedKey
      ? decrypt(litellmConfig.encryptedKey)
      : undefined;

    const systemPrompt = `You are an expert writing tone analyzer. Analyze the provided content and rate its tone on multiple dimensions.

Respond with a JSON object containing:
- scores: Object with these keys, each rated 1-10:
  - professional: How formal/business-like
  - casual: How relaxed/conversational
  - urgent: How pressing/time-sensitive
  - friendly: How warm/approachable
  - authoritative: How expert/commanding
  - empathetic: How understanding/compassionate
- dominantTone: The single most prominent tone (e.g., "professional", "friendly")
- summary: A brief 1-2 sentence description of the overall tone
- suggestions: Array of 2-3 suggestions to shift the tone${targetTone ? ` toward "${targetTone}"` : ""}

Output only valid JSON, no explanation.`;

    const userPrompt = `Analyze the tone of this content:

${content.substring(0, 8000)}`;

    const result = await generateWithLiteLLM(
      litellmConfig.endpoint,
      litellmKey,
      modelId,
      systemPrompt,
      userPrompt
    );

    // Parse the response
    let analysis: ToneResult;
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse tone analysis:", result.content);
      // Return a default response
      analysis = {
        scores: {
          professional: 5,
          casual: 5,
          urgent: 3,
          friendly: 5,
          authoritative: 5,
          empathetic: 4,
        },
        dominantTone: "neutral",
        summary: "Unable to analyze tone accurately.",
        suggestions: ["Content analysis was inconclusive."],
      };
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Tone analysis failed:", error);
    return NextResponse.json(
      { error: "Failed to analyze tone" },
      { status: 500 }
    );
  }
}
