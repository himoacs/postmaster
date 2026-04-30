import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { AIProvider, SelectedModel } from "@/types";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { generateWithAnthropic } from "@/lib/ai/claude";
import { generateWithMistral } from "@/lib/ai/mistral";
import { generateWithGrok } from "@/lib/ai/grok";
import { generateWithLiteLLM } from "@/lib/ai/litellm";
import { generateWithOllama } from "@/lib/ai/ollama";
import { 
  scanForAIPatterns, 
  calculateAIScore, 
  PatternMatch,
  AntiPatternCategory 
} from "@/lib/ai/anti-patterns";

interface AIDetectRequest {
  content: string;
  model?: SelectedModel; // Optional: use AI for deeper analysis
  includePatternScan?: boolean; // Include rule-based pattern scan
}

interface AIDetectResponse {
  // Rule-based scoring
  patternScore: {
    score: number; // 0-100, lower is better (more human)
    breakdown: {
      highSeverityCount: number;
      mediumSeverityCount: number;
      lowSeverityCount: number;
      totalMatches: number;
    };
    matches: Array<{
      pattern: string;
      category: string;
      severity: string;
      position: number;
    }>;
  };
  // AI-based analysis (if model provided)
  aiAnalysis?: {
    humanScore: number; // 0-100, higher is better (more human)
    confidence: string;
    overallAssessment: string;
    aiIndicators: Array<{
      indicator: string;
      severity: "high" | "medium" | "low";
      example?: string;
      suggestion?: string;
    }>;
    humanIndicators: string[];
    suggestions: string[];
  };
}

// POST /api/critique/ai-detect - Analyze content for AI-like patterns
export async function POST(request: NextRequest) {
  const { content, model, includePatternScan = true } =
    (await request.json()) as AIDetectRequest;

  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  try {
    const response: AIDetectResponse = {
      patternScore: {
        score: 0,
        breakdown: {
          highSeverityCount: 0,
          mediumSeverityCount: 0,
          lowSeverityCount: 0,
          totalMatches: 0,
        },
        matches: [],
      },
    };

    // Rule-based pattern scanning
    if (includePatternScan) {
      const aiScore = calculateAIScore(content);
      response.patternScore = {
        score: aiScore.score,
        breakdown: aiScore.breakdown,
        matches: aiScore.matches.map((m) => ({
          pattern: m.pattern.pattern,
          category: m.pattern.category,
          severity: m.pattern.severity,
          position: m.position,
        })),
      };
    }

    // AI-based deep analysis (if model provided)
    if (model) {
      const aiAnalysis = await performAIAnalysis(content, model);
      response.aiAnalysis = aiAnalysis;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("AI detection error:", error);
    return NextResponse.json(
      { error: "AI detection analysis failed" },
      { status: 500 }
    );
  }
}

async function performAIAnalysis(
  content: string,
  model: SelectedModel
): Promise<AIDetectResponse["aiAnalysis"]> {
  // Get API key
  let decryptedKey = "";
  if (model.provider !== "LITELLM" && model.provider !== "OLLAMA") {
    const apiKey = await prisma.aPIKey.findUnique({
      where: { provider: model.provider },
    });

    if (!apiKey?.isValid) {
      throw new Error(`API key not available for ${model.provider}`);
    }

    decryptedKey = decrypt(apiKey.encryptedKey);
  }

  const systemPrompt = `You are an expert at distinguishing between AI-generated and human-written content. You have deep knowledge of:
- Common AI writing patterns, clichés, and tells
- Authentic human writing characteristics
- Linguistic markers that distinguish AI from human authors

Analyze the provided content for signs of AI generation. Be thorough but fair - some indicators alone don't prove AI authorship.

Respond ONLY in valid JSON format with this exact structure:
{
  "humanScore": 75,
  "confidence": "medium",
  "overallAssessment": "Brief 1-2 sentence assessment",
  "aiIndicators": [
    {
      "indicator": "Description of AI-like pattern found",
      "severity": "high|medium|low",
      "example": "Specific quote from the text",
      "suggestion": "How to make this more human"
    }
  ],
  "humanIndicators": [
    "Things that make this seem human-written"
  ],
  "suggestions": [
    "Specific actionable suggestions to make the content sound more human"
  ]
}

SCORING GUIDE:
- humanScore: 0-100 where 100 = definitely human, 0 = definitely AI
- confidence: "high" if you're very certain, "medium" if there are mixed signals, "low" if it's genuinely ambiguous

AI INDICATORS TO LOOK FOR:
- Formulaic structure (always 3 points, predictable organization)
- Generic transitions ("Furthermore", "Moreover", "In conclusion")
- Buzzword density ("leverage", "innovative", "comprehensive")
- Artificial enthusiasm ("I'm excited to", "truly remarkable")
- Over-hedging ("It's important to note", "It's worth mentioning")
- Perfect but soulless prose (technically correct but lacks personality)
- Lack of specificity or personal anecdotes
- Generic openings ("In today's fast-paced world")

HUMAN INDICATORS TO LOOK FOR:
- Unique voice, personality, or quirks
- Specific examples, anecdotes, or personal experience
- Natural imperfections, casual language, or humor
- Unexpected transitions or structure
- Strong opinions or contrarian takes
- Cultural references, idioms, or colloquialisms
- Emotional authenticity (frustration, excitement, skepticism)`;

  const userPrompt = `Analyze this content for AI vs human writing characteristics:

---
${content}
---

Provide your analysis in JSON format.`;

  let result: { content: string; tokensUsed: number };

  switch (model.provider) {
    case "OPENAI":
      result = await generateWithOpenAI(
        decryptedKey,
        model.modelId,
        systemPrompt,
        userPrompt
      );
      break;
    case "ANTHROPIC":
      result = await generateWithAnthropic(
        decryptedKey,
        model.modelId,
        systemPrompt,
        userPrompt
      );
      break;
    case "MISTRAL":
      result = await generateWithMistral(
        decryptedKey,
        model.modelId,
        systemPrompt,
        userPrompt
      );
      break;
    case "XAI":
      result = await generateWithGrok(
        decryptedKey,
        model.modelId,
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
        model.modelId,
        systemPrompt,
        userPrompt
      );
      break;
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
      result = await generateWithOllama(
        ollamaConfig.endpoint,
        ollamaKey,
        model.modelId,
        systemPrompt,
        userPrompt
      );
      break;
    }
    default:
      throw new Error("Unsupported provider");
  }

  // Parse JSON response
  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        humanScore: parsed.humanScore ?? 50,
        confidence: parsed.confidence ?? "medium",
        overallAssessment: parsed.overallAssessment ?? "Analysis complete",
        aiIndicators: parsed.aiIndicators ?? [],
        humanIndicators: parsed.humanIndicators ?? [],
        suggestions: parsed.suggestions ?? [],
      };
    }
  } catch (parseError) {
    console.error("Failed to parse AI analysis response:", result.content);
  }

  // Fallback if parsing fails
  return {
    humanScore: 50,
    confidence: "low",
    overallAssessment: "Unable to complete detailed analysis",
    aiIndicators: [],
    humanIndicators: [],
    suggestions: [],
  };
}

// GET /api/critique/ai-detect - Quick scan without AI (just pattern matching)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const content = searchParams.get("content");

  if (!content) {
    return NextResponse.json({ error: "Content parameter required" }, { status: 400 });
  }

  const aiScore = calculateAIScore(content);
  
  return NextResponse.json({
    score: aiScore.score,
    breakdown: aiScore.breakdown,
    matchCount: aiScore.matches.length,
    // Group matches by category for summary
    byCategory: aiScore.matches.reduce((acc, m) => {
      const cat = m.pattern.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(m.matchedText);
      return acc;
    }, {} as Record<string, string[]>),
  });
}
