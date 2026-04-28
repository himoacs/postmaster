import OpenAI from "openai";
import { KeyValidationResult } from "@/types";

export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

export async function validateOpenAIKey(
  apiKey: string
): Promise<KeyValidationResult> {
  try {
    const client = createOpenAIClient(apiKey);
    const models = await client.models.list();

    // Filter for chat completion models
    const chatModels = models.data
      .filter(
        (m) =>
          m.id.includes("gpt-4") ||
          m.id.includes("gpt-3.5") ||
          m.id.includes("o1")
      )
      .map((m) => m.id);

    return {
      valid: true,
      models: chatModels,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid API key",
    };
  }
}

export async function generateWithOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; tokensUsed: number }> {
  const client = createOpenAIClient(apiKey);

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
 * Generate content with OpenAI using streaming
 * Yields content chunks as they arrive
 */
export async function* generateWithOpenAIStream(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): AsyncGenerator<{ content: string; done: boolean; tokensUsed?: number }> {
  const client = createOpenAIClient(apiKey);

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
    
    // Check for usage info in the final chunk
    if (chunk.usage) {
      tokensUsed = chunk.usage.total_tokens || 0;
    }
    
    if (content) {
      yield { content, done: false };
    }
    
    // Check if this is the final chunk
    if (chunk.choices[0]?.finish_reason) {
      yield { content: "", done: true, tokensUsed };
    }
  }
}

export async function generateImageWithOpenAI(
  apiKey: string,
  prompt: string,
  size: "1024x1024" | "1792x1024" | "1024x1792" = "1024x1024"
): Promise<string> {
  const client = createOpenAIClient(apiKey);

  const response = await client.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size,
    quality: "standard",
  });

  return response.data?.[0]?.url || "";
}
