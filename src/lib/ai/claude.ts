import Anthropic from "@anthropic-ai/sdk";
import { KeyValidationResult } from "@/types";

export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

export async function validateAnthropicKey(
  apiKey: string
): Promise<KeyValidationResult> {
  try {
    const client = createAnthropicClient(apiKey);

    // Make a minimal API call to validate the key
    await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 10,
      messages: [{ role: "user", content: "Hi" }],
    });

    // If successful, return available models
    return {
      valid: true,
      models: [
        "claude-sonnet-4-20250514",
        "claude-3-5-sonnet-20241022",
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307",
      ],
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid API key",
    };
  }
}

export async function generateWithAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; tokensUsed: number }> {
  const client = createAnthropicClient(apiKey);

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textContent = message.content.find((c) => c.type === "text");
  const content = textContent?.type === "text" ? textContent.text : "";

  return {
    content,
    tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
  };
}
