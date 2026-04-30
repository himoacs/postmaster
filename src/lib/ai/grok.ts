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
  } catch (error: any) {
    // Parse xAI-specific error types
    let errorMessage = "Invalid API key";
    
    if (error?.status === 401) {
      errorMessage = "Invalid API key. Please check your key at x.ai/api";
    } else if (error?.status === 429) {
      if (error?.message?.includes("quota") || error?.message?.includes("billing")) {
        errorMessage = "Quota exceeded or billing issue. Check your xAI account.";
      } else {
        errorMessage = "Rate limit exceeded. Please wait and try again.";
      }
    } else if (error?.status === 403) {
      errorMessage = "Access forbidden. Check your xAI account status.";
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      valid: false,
      error: errorMessage,
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

/**
 * Generate content with Grok using streaming
 * Yields content chunks as they arrive
 */
export async function* generateWithGrokStream(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): AsyncGenerator<{ content: string; done: boolean; tokensUsed?: number }> {
  const client = createGrokClient(apiKey);

  const stream = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 4096,
    stream: true,
    stream_options: { include_usage: true },
  });

  let tokensUsed = 0;
  
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    
    if (chunk.usage) {
      tokensUsed = chunk.usage.total_tokens || 0;
    }
    
    if (content) {
      yield { content, done: false };
    }
    
    if (chunk.choices[0]?.finish_reason) {
      yield { content: "", done: true, tokensUsed };
    }
  }
}
