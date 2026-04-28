import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { generateWithAnthropic } from "@/lib/ai/claude";
import { generateWithLiteLLM } from "@/lib/ai/litellm";
import { generateWithMistral } from "@/lib/ai/mistral";
import { generateWithGrok } from "@/lib/ai/grok";
import { AIProvider } from "@/types";

interface FactCheckRequest {
  content: string;
}

export interface Claim {
  id: string;
  text: string;
  type: "statistic" | "date" | "attribution" | "technical" | "general";
  verifiability: "high" | "medium" | "low";
}

export interface ClaimResult {
  claim: Claim;
  confidence: "verified" | "likely" | "uncertain" | "conflicting" | "unverifiable";
  kbSources: { title: string; excerpt: string }[];
  reasoning: string;
}

export interface FactCheckResponse {
  claims: ClaimResult[];
  summary: {
    total: number;
    verified: number;
    uncertain: number;
    unverifiable: number;
  };
}

// POST /api/factcheck - Extract and verify claims from content
export async function POST(request: NextRequest) {
  try {
    const { content } = (await request.json()) as FactCheckRequest;

    if (!content || content.trim().length < 50) {
      return NextResponse.json(
        { error: "Content must be at least 50 characters" },
        { status: 400 }
      );
    }

    // Get user's primary model preference
    const preferences = await prisma.userPreferences.findFirst();
    
    // Get available API keys and LiteLLM config
    const apiKeys = await prisma.aPIKey.findMany({ where: { isValid: true } });
    const liteLLMConfig = await prisma.liteLLMConfig.findFirst({
      where: { isEnabled: true, isValid: true },
    });

    // Determine which model to use
    let provider: AIProvider | null = null;
    let modelId: string | null = null;
    let apiKey: string | null = null;
    let liteLLMEndpoint: string | undefined;
    let useLiteLLM = false;

    if (preferences?.primaryModelProvider && preferences?.primaryModelId) {
      provider = preferences.primaryModelProvider as AIProvider;
      modelId = preferences.primaryModelId;
      
      if (provider === "LITELLM" && liteLLMConfig) {
        apiKey = liteLLMConfig.encryptedKey ? decrypt(liteLLMConfig.encryptedKey) : "";
        liteLLMEndpoint = liteLLMConfig.endpoint;
        useLiteLLM = true;
      } else {
        const keyRecord = apiKeys.find(k => k.provider === provider);
        if (keyRecord) {
          apiKey = decrypt(keyRecord.encryptedKey);
        }
      }
    }

    // Fallback to any available model
    if (!apiKey && !useLiteLLM) {
      if (liteLLMConfig) {
        provider = "LITELLM";
        const models = JSON.parse(liteLLMConfig.cachedModels || "[]");
        modelId = models[0]?.id || "gpt-4o";
        apiKey = liteLLMConfig.encryptedKey ? decrypt(liteLLMConfig.encryptedKey) : "";
        liteLLMEndpoint = liteLLMConfig.endpoint;
        useLiteLLM = true;
      } else {
        for (const key of apiKeys) {
          if (key.provider !== "STABILITY") {
            provider = key.provider as AIProvider;
            apiKey = decrypt(key.encryptedKey);
            if (provider === "OPENAI") modelId = "gpt-4o";
            else if (provider === "ANTHROPIC") modelId = "claude-3-5-sonnet-20241022";
            else if (provider === "MISTRAL") modelId = "mistral-large-latest";
            else if (provider === "XAI") modelId = "grok-2";
            break;
          }
        }
      }
    }

    if (!provider || !modelId || (!apiKey && !useLiteLLM)) {
      return NextResponse.json(
        { error: "No AI model available for fact checking" },
        { status: 400 }
      );
    }

    console.log(`[FactCheck] Using provider: ${provider}, model: ${modelId}, useLiteLLM: ${useLiteLLM}`);

    // Step 1: Extract claims from content
    const extractionPrompt = `Analyze the following content and extract all factual claims. For each claim:
1. Quote the exact text containing the claim (keep it concise, max 100 characters)
2. Classify the type: statistic, date, attribution, technical, or general
3. Rate how verifiable this claim is: high (objectively checkable), medium (partially checkable), low (opinion-adjacent)

Return a JSON array of claims. Example:
[
  {"text": "Python was created in 1991", "type": "date", "verifiability": "high"},
  {"text": "React is the most popular frontend framework", "type": "general", "verifiability": "medium"}
]

Content to analyze:
---
${content.slice(0, 8000)}
---

Return ONLY the JSON array, no other text. If no factual claims found, return [].`;

    let extractionResult;
    try {
      extractionResult = await generateWithModel(
        provider,
        modelId,
        apiKey ?? "",
        "You are a fact-checking assistant that extracts factual claims from text. Return only valid JSON.",
        extractionPrompt,
        liteLLMEndpoint
      );
      console.log(`[FactCheck] Extraction result length: ${extractionResult.content.length}`);
    } catch (genError) {
      console.error("[FactCheck] Model generation failed:", genError);
      return NextResponse.json(
        { error: genError instanceof Error ? genError.message : "Model generation failed" },
        { status: 500 }
      );
    }

    let claims: Claim[];
    try {
      // Clean the response - remove markdown code blocks if present
      let jsonStr = extractionResult.content.trim();
      console.log(`[FactCheck] Raw extraction response (first 500 chars): ${jsonStr.slice(0, 500)}`);
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
      }
      // Handle empty response
      if (!jsonStr || jsonStr === "[]") {
        claims = [];
      } else {
        const parsed = JSON.parse(jsonStr);
        claims = parsed.map((c: { text: string; type: string; verifiability: string }, i: number) => ({
          id: `claim-${i}`,
          text: c.text,
          type: c.type as Claim["type"],
          verifiability: c.verifiability as Claim["verifiability"],
        }));
      }
    } catch (parseError) {
      console.error("[FactCheck] Failed to parse claims:", {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        content: extractionResult.content.slice(0, 1000),
      });
      return NextResponse.json(
        { error: "Failed to extract claims from content" },
        { status: 500 }
      );
    }

    if (claims.length === 0) {
      return NextResponse.json({
        claims: [],
        summary: { total: 0, verified: 0, uncertain: 0, unverifiable: 0 },
      });
    }

    // Step 2: Get knowledge base content for cross-reference
    const kbEntries = await prisma.knowledgeEntry.findMany({
      where: { isActive: true },
      select: { id: true, title: true, content: true },
    });

    // Build KB context (truncated for prompt size)
    const kbContext = kbEntries.map(e => ({
      title: e.title,
      excerpt: e.content.slice(0, 1500),
    }));

    // Step 3: Verify claims against KB and general knowledge
    const verificationPrompt = `You are a fact-checking assistant. Verify each claim against the provided knowledge base and your general knowledge.

CLAIMS TO VERIFY:
${claims.map((c, i) => `${i}. "${c.text}" (${c.type}, verifiability: ${c.verifiability})`).join("\n")}

KNOWLEDGE BASE CONTEXT:
${kbContext.length > 0 
  ? kbContext.map(kb => `[${kb.title}]: ${kb.excerpt}`).join("\n\n")
  : "(No knowledge base entries available)"
}

For each claim, provide:
1. confidence: "verified" (strong evidence supports it), "likely" (probably true but not confirmed), "uncertain" (mixed or weak evidence), "conflicting" (evidence contradicts it), "unverifiable" (cannot be checked)
2. kbSources: array of {title, excerpt} from knowledge base that support or relate to this claim (empty array if none)
3. reasoning: brief explanation of your assessment (max 100 characters)

Return a JSON array in this exact format:
[
  {
    "claimIndex": 0,
    "confidence": "verified",
    "kbSources": [{"title": "Source Name", "excerpt": "relevant quote..."}],
    "reasoning": "This is supported by..."
  }
]

Be conservative - only mark claims as "verified" if there's strong evidence. Return ONLY the JSON array.`;

    const verificationResult = await generateWithModel(
      provider,
      modelId,
      apiKey ?? "",
      "You are a fact-checking assistant. Be conservative - only mark claims as 'verified' if there's strong evidence. Return only valid JSON.",
      verificationPrompt,
      liteLLMEndpoint
    );

    let verifications: Array<{
      claimIndex: number;
      confidence: ClaimResult["confidence"];
      kbSources: { title: string; excerpt: string }[];
      reasoning: string;
    }>;

    try {
      let jsonStr = verificationResult.content.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
      }
      verifications = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse verifications:", verificationResult.content);
      // Return claims with uncertain status if verification parsing fails
      const results: ClaimResult[] = claims.map(claim => ({
        claim,
        confidence: "uncertain" as const,
        kbSources: [],
        reasoning: "Verification could not be completed",
      }));
      
      return NextResponse.json({
        claims: results,
        summary: {
          total: claims.length,
          verified: 0,
          uncertain: claims.length,
          unverifiable: 0,
        },
      });
    }

    // Combine claims with verification results
    const results: ClaimResult[] = claims.map((claim, index) => {
      const verification = verifications.find(v => v.claimIndex === index) || {
        confidence: "uncertain" as const,
        kbSources: [],
        reasoning: "No verification result",
      };

      return {
        claim,
        confidence: verification.confidence,
        kbSources: verification.kbSources || [],
        reasoning: verification.reasoning,
      };
    });

    // Calculate summary
    const summary = {
      total: results.length,
      verified: results.filter(r => r.confidence === "verified" || r.confidence === "likely").length,
      uncertain: results.filter(r => r.confidence === "uncertain" || r.confidence === "conflicting").length,
      unverifiable: results.filter(r => r.confidence === "unverifiable").length,
    };

    return NextResponse.json({ claims: results, summary });
  } catch (error) {
    console.error("Fact check error:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to perform fact check" },
      { status: 500 }
    );
  }
}

// Helper to generate with different providers
async function generateWithModel(
  provider: AIProvider,
  modelId: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  liteLLMEndpoint?: string
): Promise<{ content: string }> {
  switch (provider) {
    case "LITELLM":
      if (!liteLLMEndpoint) throw new Error("LiteLLM endpoint required");
      return generateWithLiteLLM(liteLLMEndpoint, apiKey, modelId, systemPrompt, userPrompt);
    case "OPENAI":
      return generateWithOpenAI(apiKey, modelId, systemPrompt, userPrompt);
    case "ANTHROPIC":
      return generateWithAnthropic(apiKey, modelId, systemPrompt, userPrompt);
    case "MISTRAL":
      return generateWithMistral(apiKey, modelId, systemPrompt, userPrompt);
    case "XAI":
      return generateWithGrok(apiKey, modelId, systemPrompt, userPrompt);
    default:
      throw new Error(`Unsupported provider for fact checking: ${provider}`);
  }
}
