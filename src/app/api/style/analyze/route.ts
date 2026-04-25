import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { generateWithAnthropic } from "@/lib/ai/claude";
import { generateWithLiteLLM } from "@/lib/ai/litellm";

// POST /api/style/analyze - Analyze writing style from samples
export async function POST() {
  // Get content samples
  const samples = await prisma.contentSample.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
  });

  if (samples.length === 0) {
    return NextResponse.json(
      { error: "No content samples found. Add some content samples first." },
      { status: 400 }
    );
  }

  // Check for LiteLLM config first
  const litellmConfig = await prisma.liteLLMConfig.findFirst({
    where: { isEnabled: true, isValid: true },
  });

  // Fall back to direct API keys if no LiteLLM
  const apiKey = !litellmConfig ? await prisma.aPIKey.findFirst({
    where: {
      isValid: true,
      provider: { in: ["ANTHROPIC", "OPENAI"] },
    },
    orderBy: {
      provider: "asc", // Prefer Anthropic
    },
  }) : null;

  if (!litellmConfig && !apiKey) {
    return NextResponse.json(
      { error: "No valid API key or LiteLLM proxy available for style analysis" },
      { status: 400 }
    );
  }

  // Combine sample texts
  const combinedText = samples
    .map((s) => s.extractedText || "")
    .filter(Boolean)
    .join("\n\n---\n\n")
    .substring(0, 15000); // Limit to ~15k chars

  const systemPrompt = `You are an expert writing analyst. Analyze the provided writing samples and extract the author's distinct writing style characteristics.

Respond with a JSON object containing these fields:
- tone: The emotional tone (e.g., "conversational", "professional", "humorous", "serious")
- voice: The narrative voice (e.g., "first-person casual", "authoritative expert", "friendly guide")
- vocabulary: The vocabulary style (e.g., "technical jargon", "simple everyday", "creative metaphorical")
- sentence: The sentence structure (e.g., "short punchy sentences", "long flowing prose", "varied rhythmic")
- patterns: A JSON array of 3-5 common phrases or patterns the author uses

Be specific and observational. Base your analysis only on what you see in the samples.
Output only valid JSON, no explanation.`;

  const userPrompt = `Analyze these writing samples and extract the author's writing style:

${combinedText}`;

  try {
    let result: { content: string; tokensUsed: number };

    if (litellmConfig) {
      // Use LiteLLM - pick a fast/cheap model for analysis
      const models = JSON.parse(litellmConfig.cachedModels || "[]") as Array<{ id: string; costTier: string }>;
      // Prefer low-cost models for style analysis
      const cheapModel = models.find(m => m.costTier === "low") || models[0];
      const modelId = cheapModel?.id || "azure-gpt-4o-mini";
      
      const litellmKey = litellmConfig.encryptedKey 
        ? decrypt(litellmConfig.encryptedKey) 
        : undefined;
      
      result = await generateWithLiteLLM(
        litellmConfig.endpoint,
        litellmKey,
        modelId,
        systemPrompt,
        userPrompt
      );
    } else if (apiKey!.provider === "ANTHROPIC") {
      const decryptedKey = decrypt(apiKey!.encryptedKey);
      result = await generateWithAnthropic(
        decryptedKey,
        "claude-3-haiku-20240307",
        systemPrompt,
        userPrompt
      );
    } else {
      const decryptedKey = decrypt(apiKey!.encryptedKey);
      result = await generateWithOpenAI(
        decryptedKey,
        "gpt-4o-mini",
        systemPrompt,
        userPrompt
      );
    }

    // Parse the response
    let analysis;
    try {
      // Try to extract JSON from response
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse analysis:", result.content);
      return NextResponse.json(
        { error: "Failed to parse style analysis" },
        { status: 500 }
      );
    }

    // Update the style profile
    const existing = await prisma.styleProfile.findFirst();
    
    if (existing) {
      await prisma.styleProfile.update({
        where: { id: existing.id },
        data: {
          tone: analysis.tone || null,
          voice: analysis.voice || null,
          vocabulary: analysis.vocabulary || null,
          sentence: analysis.sentence || null,
          patterns: analysis.patterns
            ? JSON.stringify(analysis.patterns)
            : null,
          analyzedAt: new Date(),
        },
      });
    } else {
      await prisma.styleProfile.create({
        data: {
          tone: analysis.tone || null,
          voice: analysis.voice || null,
          vocabulary: analysis.vocabulary || null,
          sentence: analysis.sentence || null,
          patterns: analysis.patterns
            ? JSON.stringify(analysis.patterns)
            : null,
          analyzedAt: new Date(),
        },
      });
    }

    // Mark samples as analyzed
    await prisma.contentSample.updateMany({
      where: {
        id: { in: samples.map((s) => s.id) },
      },
      data: { analyzedAt: new Date() },
    });

    return NextResponse.json({
      tone: analysis.tone,
      voice: analysis.voice,
      vocabulary: analysis.vocabulary,
      sentence: analysis.sentence,
      patterns: analysis.patterns
        ? JSON.stringify(analysis.patterns)
        : null,
    });
  } catch (error) {
    console.error("Style analysis error:", error);
    return NextResponse.json(
      { error: "Style analysis failed" },
      { status: 500 }
    );
  }
}
