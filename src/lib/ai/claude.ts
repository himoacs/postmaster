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
  } catch (error: any) {
    // Parse Anthropic-specific error types
    // Error structure: error.error.error.type and error.error.error.message
    let errorMessage = "Invalid API key";
    
    const errorType = error?.error?.error?.type || error?.type;
    const errorMsg = error?.error?.error?.message || error?.message;
    
    if (errorType === "invalid_request_error") {
      // Check for billing/credit issues
      if (errorMsg?.includes("credit balance") || 
          errorMsg?.includes("billing")) {
        errorMessage = "Insufficient credits. Please add billing at console.anthropic.com/settings/billing";
      } else {
        errorMessage = errorMsg || errorMessage;
      }
    } else if (errorType === "authentication_error" || error?.status === 401) {
      errorMessage = "Invalid API key. Please check your key at console.anthropic.com/settings/keys";
    } else if (errorType === "permission_error" || error?.status === 403) {
      errorMessage = "Permission denied. Check your account status and organization settings.";
    } else if (errorType === "rate_limit_error" || error?.status === 429) {
      errorMessage = "Rate limit exceeded. Please wait and try again.";
    } else if (error instanceof Error && errorMsg) {
      errorMessage = errorMsg;
    }

    return {
      valid: false,
      error: errorMessage,
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

/**
 * Generate content with Anthropic using streaming
 * Yields content chunks as they arrive
 */
export async function* generateWithAnthropicStream(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): AsyncGenerator<{ content: string; done: boolean; tokensUsed?: number }> {
  const client = createAnthropicClient(apiKey);

  const stream = await client.messages.stream({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { content: event.delta.text, done: false };
    }
  }

  // Get final message for token usage
  const finalMessage = await stream.finalMessage();
  const tokensUsed = finalMessage.usage.input_tokens + finalMessage.usage.output_tokens;
  
  yield { content: "", done: true, tokensUsed };
}
