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

  // Get user preferences to use primary model
  const preferences = await prisma.userPreferences.findFirst();

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
    .join("\n\n---\n\n");
  
  // Validate we have enough content
  if (combinedText.length < 100) {
    return NextResponse.json(
      { error: "Not enough content in samples to analyze. Please add more substantial writing samples." },
      { status: 400 }
    );
  }
  
  // Limit to ~15k chars
  const limitedText = combinedText.substring(0, 15000);

  const systemPrompt = `You are an expert writing analyst specializing in capturing authentic human voice. Analyze the provided writing samples and extract the author's DISTINCT writing style characteristics that make them sound uniquely human.

IMPORTANT: Your goal is to capture enough detail that AI-generated content can authentically match this person's voice and NOT sound like typical AI output.

Respond with a JSON object containing these fields:

CORE STYLE:
- tone: The emotional tone (e.g., "conversational with dry humor", "professional but warm", "enthusiastic and direct")
- voice: The narrative voice (e.g., "first-person casual storyteller", "authoritative but approachable expert", "friendly skeptic")
- vocabulary: The vocabulary style (e.g., "technical with accessible explanations", "casual with occasional profanity", "precise academic")
- sentence: The sentence structure (e.g., "varies between punchy one-liners and complex explanations", "consistently flowing mid-length", "fragments for emphasis, then detailed followups")

DISTINCTIVE PATTERNS (capture 8-10):
- patterns: A JSON array of 8-10 DISTINCTIVE writing patterns. Include:
  * Signature transition phrases (e.g., "Here's the thing:", "Look,", "Real talk:")
  * Opening hooks they favor (questions, bold statements, anecdotes)
  * Closing styles (calls to action, reflections, questions to reader)
  * Rhetorical devices (direct address "you", questions, parentheticals)
  * Emphasis techniques (italics patterns, caps for humor, em-dashes)
  * Signature expressions or idioms unique to their voice
  DO NOT include: article titles, navigation text, generic CTAs, or common phrases everyone uses.

VOCABULARY FINGERPRINT:
- uniqueVocabulary: A JSON array of 10-15 distinctive words or short phrases this author uses that are somewhat unique to them or used more frequently than typical (e.g., specific adjectives, verbs, expressions, industry terms they favor)
- avoidPatterns: A JSON array of 5-8 common phrases or structures this author NEVER uses or actively avoids (based on what's absent from all samples despite being common elsewhere)

WRITING QUIRKS:
- writingQuirks: A JSON object with:
  * punctuation: How they use punctuation distinctively (e.g., "heavy em-dash user", "avoids semicolons", "uses ... for trailing thoughts")
  * formatting: Formatting preferences (e.g., "bold for key terms", "frequent bullet lists", "avoids headers in favor of paragraphs")
  * emoji: Emoji usage (e.g., "never", "sparingly for emphasis", "frequent casual use")
  * caps: Capitalization style (e.g., "occasional ALL CAPS for humor", "standard", "lowercase aesthetic")

REPRESENTATIVE EXCERPTS:
- sampleExcerpts: A JSON array of 3-5 short (2-4 sentence) VERBATIM excerpts from the samples that best capture the author's distinctive voice. These will be used as few-shot examples.

OPENING/CLOSING ANALYSIS:
- openingStyles: A JSON array of 3-4 descriptions of how this author typically opens pieces (e.g., "provocative question", "personal anecdote", "bold contrarian statement")
- closingStyles: A JSON array of 3-4 descriptions of how this author typically closes pieces (e.g., "reflective question to reader", "action item", "circling back to opening")

Be extremely specific and observational. Base your analysis only on what you see in the samples. If you can't determine something from the samples, use null.
Output only valid JSON, no explanation.`;

  const userPrompt = `Analyze these writing samples and extract the author's complete writing style fingerprint:

${limitedText}`;

  try {
    let result: { content: string; tokensUsed: number };

    if (litellmConfig) {
      // Use LiteLLM - prefer user's primary model, fall back to first available
      const models = JSON.parse(litellmConfig.cachedModels || "[]") as Array<{ id: string; costTier: string }>;
      
      // Use primary model if set and available, otherwise fall back
      let modelId = preferences?.primaryModelId;
      if (!modelId || !models.find(m => m.id === modelId)) {
        modelId = models[0]?.id || "azure-gpt-4o-mini";
      }
      
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
      // Try to extract JSON from response with multiple strategies
      let jsonString = result.content.trim();
      
      // Strategy 1: Check if wrapped in markdown code block
      const codeBlockMatch = jsonString.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonString = codeBlockMatch[1].trim();
      }
      
      // Strategy 2: Extract JSON object (handle nested braces properly)
      if (!codeBlockMatch) {
        let braceCount = 0;
        let startIndex = -1;
        let endIndex = -1;
        
        for (let i = 0; i < jsonString.length; i++) {
          if (jsonString[i] === '{') {
            if (braceCount === 0) startIndex = i;
            braceCount++;
          } else if (jsonString[i] === '}') {
            braceCount--;
            if (braceCount === 0 && startIndex !== -1) {
              endIndex = i;
              break;
            }
          }
        }
        
        if (startIndex !== -1 && endIndex !== -1) {
          jsonString = jsonString.substring(startIndex, endIndex + 1);
        }
      }
      
      // Parse the JSON
      analysis = JSON.parse(jsonString);
      
      // Validate that we have at least some expected fields
      if (!analysis || typeof analysis !== 'object') {
        throw new Error("Invalid analysis object");
      }
    } catch (parseError) {
      console.error("Failed to parse analysis. Error:", parseError);
      console.error("Raw response:", result.content);
      console.error("Response length:", result.content.length);
      return NextResponse.json(
        { 
          error: "Failed to parse style analysis. The AI response was not in the expected format.",
          details: parseError instanceof Error ? parseError.message : "Unknown parse error"
        },
        { status: 500 }
      );
    }

    // Helper to safely stringify JSON fields
    const safeStringify = (value: unknown): string | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === "string") return value;
      return JSON.stringify(value);
    };

    // Prepare the data for saving
    const profileData = {
      tone: analysis.tone || null,
      voice: analysis.voice || null,
      vocabulary: analysis.vocabulary || null,
      sentence: analysis.sentence || null,
      patterns: safeStringify(analysis.patterns),
      uniqueVocabulary: safeStringify(analysis.uniqueVocabulary),
      avoidPatterns: safeStringify(analysis.avoidPatterns),
      writingQuirks: safeStringify(analysis.writingQuirks),
      sampleExcerpts: safeStringify(analysis.sampleExcerpts),
      openingStyles: safeStringify(analysis.openingStyles),
      closingStyles: safeStringify(analysis.closingStyles),
      analyzedAt: new Date(),
    };

    // Update the style profile
    const existing = await prisma.styleProfile.findFirst();
    
    if (existing) {
      await prisma.styleProfile.update({
        where: { id: existing.id },
        data: profileData,
      });
    } else {
      await prisma.styleProfile.create({
        data: profileData,
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
      patterns: safeStringify(analysis.patterns),
      uniqueVocabulary: safeStringify(analysis.uniqueVocabulary),
      avoidPatterns: safeStringify(analysis.avoidPatterns),
      writingQuirks: safeStringify(analysis.writingQuirks),
      sampleExcerpts: safeStringify(analysis.sampleExcerpts),
      openingStyles: safeStringify(analysis.openingStyles),
      closingStyles: safeStringify(analysis.closingStyles),
    });
  } catch (error) {
    console.error("Style analysis error:", error);
    return NextResponse.json(
      { error: "Style analysis failed" },
      { status: 500 }
    );
  }
}
