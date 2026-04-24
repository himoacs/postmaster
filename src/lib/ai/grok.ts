import OpenAI from "openai";
import { KeyValidationResult } from "@/types";

// xAI uses an OpenAI-compatible API
const XAI_BASE_URL = "https://api.x.ai/v1";

export function createGrokClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: XAI_BASE_URL,
  });
}

export async function validateGrokKey(
  apiKey: string
): Promise<KeyValidationResult> {
  try {
    const client = createGrokClient(apiKey);

    // Make a minimal API call to validate the key
    await client.chat.completions.create({
      model: "grok-2-mini",
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 10,
    });

    return {
      valid: true,
      models: ["grok-2", "grok-2-mini"],
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid API key",
    };
  }
}

export async function generateWithGrok(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; tokensUsed: number }> {
  const client = createGrokClient(apiKey);

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  });

  return {
    content: completion.choices[0]?.message?.content || "",
    tokensUsed: completion.usage?.total_tokens || 0,
  };
}
