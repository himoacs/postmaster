/**
 * LiteLLM Client
 * 
 * Provides integration with LiteLLM proxy for unified access to multiple LLM providers.
 * LiteLLM exposes an OpenAI-compatible API, so we use the OpenAI SDK with a custom baseURL.
 */

import OpenAI from "openai";
import { LiteLLMModel, LiteLLMValidationResult } from "@/types";

/**
 * Create a LiteLLM client using the OpenAI SDK with custom endpoint
 */
export function createLiteLLMClient(endpoint: string, apiKey?: string): OpenAI {
  // Ensure endpoint doesn't have trailing slash
  const baseURL = endpoint.replace(/\/$/, "");
  
  return new OpenAI({
    apiKey: apiKey || "not-needed", // Some LiteLLM setups don't require a key
    baseURL,
  });
}

/**
 * Validate LiteLLM connection and fetch available models
 */
export async function validateLiteLLMConfig(
  endpoint: string,
  apiKey?: string
): Promise<LiteLLMValidationResult> {
  try {
    const client = createLiteLLMClient(endpoint, apiKey);
    
    // Try to list models - this validates the connection
    const modelsResponse = await client.models.list();
    
    // Also try to fetch model info from LiteLLM's /model/info endpoint if available
    let modelInfo: Record<string, unknown> = {};
    try {
      const baseURL = endpoint.replace(/\/$/, "");
      const infoResponse = await fetch(`${baseURL}/model/info`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });
      if (infoResponse.ok) {
        modelInfo = await infoResponse.json();
      }
    } catch {
      // /model/info is optional, continue without it
    }
    
    // Convert OpenAI model list response to our LiteLLMModel format
    const models: LiteLLMModel[] = [];
    
    for (const model of modelsResponse.data) {
      // Extract provider from model ID (e.g., "gpt-4" -> "openai", "claude-3" -> "anthropic")
      const provider = inferProviderFromModelId(model.id);
      
      // Get additional info if available
      const info = (modelInfo as Record<string, Record<string, unknown>>)?.[model.id] || {};
      
      models.push({
        id: model.id,
        name: formatModelName(model.id),
        provider,
        contextWindow: (info.max_input_tokens as number) || inferContextWindow(model.id),
        costTier: inferCostTier(model.id),
        maxTokens: (info.max_tokens as number) || undefined,
      });
    }
    
    // Filter to only text generation models (exclude embedding, image models)
    const textModels = models.filter(m => isTextGenerationModel(m.id));
    
    return {
      valid: true,
      models: textModels,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    return {
      valid: false,
      error: message,
    };
  }
}

/**
 * Fetch models from LiteLLM (for refreshing cached models)
 */
export async function fetchLiteLLMModels(
  endpoint: string,
  apiKey?: string
): Promise<LiteLLMModel[]> {
  const result = await validateLiteLLMConfig(endpoint, apiKey);
  return result.models || [];
}

/**
 * Generate content using LiteLLM proxy
 */
export async function generateWithLiteLLM(
  endpoint: string,
  apiKey: string | undefined,
  modelId: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; tokensUsed: number }> {
  const client = createLiteLLMClient(endpoint, apiKey);
  
  const response = await client.chat.completions.create({
    model: modelId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  });
  
  const content = response.choices[0]?.message?.content || "";
  const tokensUsed = response.usage?.total_tokens || 0;
  
  return { content, tokensUsed };
}

/**
 * Generate content using LiteLLM proxy with streaming
 * Yields content chunks as they arrive
 */
export async function* generateWithLiteLLMStream(
  endpoint: string,
  apiKey: string | undefined,
  modelId: string,
  systemPrompt: string,
  userPrompt: string
): AsyncGenerator<{ content: string; done: boolean; tokensUsed?: number }> {
  const client = createLiteLLMClient(endpoint, apiKey);
  
  const stream = await client.chat.completions.create({
    model: modelId,
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

/**
 * Generate image using LiteLLM proxy (routes to DALL-E or other image providers)
 */
export async function generateImageWithLiteLLM(
  endpoint: string,
  apiKey: string | undefined,
  prompt: string,
  model: string = "dall-e-3",
  size: "1024x1024" | "1792x1024" | "1024x1792" = "1024x1024"
): Promise<string> {
  const client = createLiteLLMClient(endpoint, apiKey);
  
  const response = await client.images.generate({
    model,
    prompt,
    n: 1,
    size,
    quality: "standard",
  });
  
  return response.data?.[0]?.url || "";
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Infer the original provider from model ID
 */
function inferProviderFromModelId(modelId: string): string {
  const id = modelId.toLowerCase();
  
  if (id.includes("gpt") || id.includes("o1") || id.includes("davinci") || id.includes("turbo")) {
    return "openai";
  }
  if (id.includes("claude")) {
    return "anthropic";
  }
  if (id.includes("grok")) {
    return "xai";
  }
  if (id.includes("mistral") || id.includes("mixtral") || id.includes("codestral")) {
    return "mistral";
  }
  if (id.includes("gemini") || id.includes("palm")) {
    return "google";
  }
  if (id.includes("llama") || id.includes("meta")) {
    return "meta";
  }
  if (id.includes("command") || id.includes("cohere")) {
    return "cohere";
  }
  if (id.includes("deepseek")) {
    return "deepseek";
  }
  
  return "unknown";
}

/**
 * Convert model ID to a display-friendly name
 */
function formatModelName(modelId: string): string {
  // Handle common patterns
  return modelId
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .replace(/(\d+)k/gi, " $1K")  // Format context sizes
    .trim();
}

/**
 * Infer context window from model ID
 */
function inferContextWindow(modelId: string): number {
  const id = modelId.toLowerCase();
  
  // Known large context models
  if (id.includes("128k") || id.includes("gpt-4o") || id.includes("gpt-4-turbo")) {
    return 128000;
  }
  if (id.includes("200k") || id.includes("claude-3")) {
    return 200000;
  }
  if (id.includes("32k")) {
    return 32000;
  }
  if (id.includes("16k")) {
    return 16000;
  }
  if (id.includes("grok")) {
    return 131072;
  }
  
  // Default context window
  return 8192;
}

/**
 * Infer cost tier from model ID
 */
function inferCostTier(modelId: string): "low" | "medium" | "high" {
  const id = modelId.toLowerCase();
  
  // High-end models (most capable, most expensive)
  if (
    id.includes("opus") ||
    id.includes("gpt-5") && !id.includes("mini") && !id.includes("nano") ||
    id.includes("gpt5") && !id.includes("mini") && !id.includes("nano") ||
    id.includes("gpt-4o") && !id.includes("mini") ||
    id.includes("gpt-4-turbo") ||
    id.includes("gpt-4") && !id.includes("mini") ||
    id.includes("claude-3.5-sonnet") ||
    id.includes("claude-3-5-sonnet") ||
    id.includes("claude-4") ||
    id.includes("sonnet") ||
    id.includes("large") && !id.includes("x-large") ||
    id.includes("grok-2") && !id.includes("mini") ||
    id.includes("gemini-1.5-pro") ||
    id.includes("gemini-pro") ||
    id.includes("mistral-large") ||
    id.includes("llama-3.1-405b") ||
    id.includes("llama-3.3-70b") ||
    id.includes("deepseek-v3")
  ) {
    return "high";
  }
  
  // Low-cost models (smaller, faster, cheaper)
  if (
    id.includes("mini") ||
    id.includes("small") ||
    id.includes("haiku") ||
    id.includes("flash") ||
    id.includes("nano") ||
    id.includes("tiny") ||
    id.includes("lite") ||
    id.includes("3.5-turbo") ||
    id.includes("gpt-3.5") ||
    id.includes("llama-3.2") ||
    id.includes("llama-3.1-8b") ||
    id.includes("mistral-7b") ||
    id.includes("gemma")
  ) {
    return "low";
  }
  
  // Medium tier (everything else)
  return "medium";
}

/**
 * Check if a model is for text generation (vs embedding, image, etc.)
 */
function isTextGenerationModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  
  // Exclude known non-text models
  if (
    id.includes("embed") ||
    id.includes("dall-e") ||
    id.includes("whisper") ||
    id.includes("tts") ||
    id.includes("stable-diffusion") ||
    id.includes("sdxl") ||
    id.includes("image")
  ) {
    return false;
  }
  
  return true;
}
