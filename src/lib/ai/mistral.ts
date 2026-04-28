import { Mistral } from "@mistralai/mistralai";
import { KeyValidationResult } from "@/types";

export function createMistralClient(apiKey: string): Mistral {
  return new Mistral({ apiKey });
}

export async function validateMistralKey(
  apiKey: string
): Promise<KeyValidationResult> {
  try {
    const client = createMistralClient(apiKey);
    const models = await client.models.list();

    const modelIds = models.data
      ?.filter((m): m is typeof m & { id: string } => "id" in m && typeof m.id === "string")
      .map((m) => m.id) || [];

    return {
      valid: true,
      models: modelIds.length > 0 ? modelIds : ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"],
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid API key",
    };
  }
}

export async function generateWithMistral(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; tokensUsed: number }> {
  const client = createMistralClient(apiKey);

  const response = await client.chat.complete({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    maxTokens: 4096,
  });

  const choice = response.choices?.[0];
  const content =
    choice?.message?.content && typeof choice.message.content === "string"
      ? choice.message.content
      : "";

  return {
    content,
    tokensUsed: response.usage?.totalTokens || 0,
  };
}

/**
 * Generate content with Mistral using streaming
 * Yields content chunks as they arrive
 */
export async function* generateWithMistralStream(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): AsyncGenerator<{ content: string; done: boolean; tokensUsed?: number }> {
  const client = createMistralClient(apiKey);

  const stream = await client.chat.stream({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    maxTokens: 4096,
  });

  let tokensUsed = 0;

  for await (const event of stream) {
    const choice = event.data?.choices?.[0];
    const rawContent = choice?.delta?.content || "";
    // The content could be a string or ContentChunk[], handle both cases
    const content = typeof rawContent === 'string' 
      ? rawContent 
      : Array.isArray(rawContent) 
        ? rawContent.map(c => typeof c === 'string' ? c : (c as { text?: string }).text || '').join('')
        : "";
    
    if (event.data?.usage?.totalTokens) {
      tokensUsed = event.data.usage.totalTokens;
    }
    
    if (content) {
      yield { content, done: false };
    }
    
    if (choice?.finishReason) {
      yield { content: "", done: true, tokensUsed };
    }
  }
}
