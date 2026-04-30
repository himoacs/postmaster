/**
 * Ollama Client
 * 
 * Provides integration with Ollama for local LLM hosting with privacy and zero cost.
 * Ollama exposes an OpenAI-compatible API, so we use the OpenAI SDK with a custom baseURL.
 */

import OpenAI from "openai";
import { OllamaModel, OllamaValidationResult } from "@/types";

// Ollama's /api/tags response types
interface OllamaTag {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface OllamaTagsResponse {
  models: OllamaTag[];
}

/**
 * Create an Ollama client using the OpenAI SDK with custom endpoint
 */
export function createOllamaClient(endpoint: string, apiKey?: string): OpenAI {
  // Ensure endpoint doesn't have trailing slash
  const baseURL = `${endpoint.replace(/\/$/, "")}/v1`;
  
  return new OpenAI({
    apiKey: apiKey || "ollama", // Ollama doesn't require a key for local instances
    baseURL,
  });
}

/**
 * Validate Ollama connection and fetch available models
 */
export async function validateOllamaConfig(
  endpoint: string,
  apiKey?: string
): Promise<OllamaValidationResult> {
  try {
    // First, try to fetch models from Ollama's native /api/tags endpoint
    // This provides more detailed model information than the OpenAI-compatible endpoint
    const baseURL = endpoint.replace(/\/$/, "");
    const tagsResponse = await fetch(`${baseURL}/api/tags`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    
    if (!tagsResponse.ok) {
      throw new Error(`Failed to connect to Ollama: ${tagsResponse.statusText}`);
    }
    
    const tagsData: OllamaTagsResponse = await tagsResponse.json();
    
    // Convert Ollama model tags to our OllamaModel format
    const models: OllamaModel[] = tagsData.models.map(tag => ({
      id: tag.name,
      name: formatOllamaModelName(tag.name),
      provider: "ollama",
      contextWindow: inferOllamaContextWindow(tag.name, tag.details?.family),
      costTier: inferOllamaCostTier(tag.name, tag.details?.parameter_size),
      size: tag.size,
    }));
    
    // Filter out embedding models
    const textModels = models.filter(m => !isEmbeddingModel(m.id));
    
    if (textModels.length === 0) {
      return {
        valid: false,
        error: "No text generation models found. Pull models with 'ollama pull <model>'",
      };
    }
    
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
 * Fetch models from Ollama (for refreshing cached models)
 */
export async function fetchOllamaModels(
  endpoint: string,
  apiKey?: string
): Promise<OllamaModel[]> {
  const result = await validateOllamaConfig(endpoint, apiKey);
  return result.models || [];
}

/**
 * Generate content using Ollama
 */
export async function generateWithOllama(
  endpoint: string,
  apiKey: string | undefined,
  modelId: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; tokensUsed: number }> {
  const client = createOllamaClient(endpoint, apiKey);
  
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
 * Generate content using Ollama with streaming
 * Yields content chunks as they arrive
 */
export async function* generateWithOllamaStream(
  endpoint: string,
  apiKey: string | undefined,
  modelId: string,
  systemPrompt: string,
  userPrompt: string
): AsyncGenerator<{ content: string; done: boolean; tokensUsed?: number }> {
  const client = createOllamaClient(endpoint, apiKey);
  
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

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert Ollama model name to a display-friendly format
 * Examples: "llama3.2:1b" -> "Llama 3.2 1B", "qwen2.5:7b" -> "Qwen 2.5 7B"
 */
function formatOllamaModelName(modelId: string): string {
  // Split on : to separate model name from tag
  const [name, tag] = modelId.split(":");
  
  // Format the name part
  let formattedName = name
    .replace(/([a-z])([0-9])/gi, "$1 $2")  // Add space between letters and numbers
    .replace(/([0-9])\.([0-9])/g, "$1.$2") // Keep decimal points
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  
  // Format the tag if present
  if (tag) {
    const formattedTag = tag
      .replace(/(\d+)b$/i, "$1B")           // Format parameter size (e.g., "7b" -> "7B")
      .replace(/(\d+)m$/i, "$1M")           // Format smaller sizes (e.g., "1m" -> "1M")
      .replace(/q(\d+)_([a-z0-9]+)/i, "Q$1_$2") // Format quantization (e.g., "q4_k_m" -> "Q4_K_M")
      .toUpperCase();
    
    formattedName += ` ${formattedTag}`;
  }
  
  return formattedName.trim();
}

/**
 * Infer context window from Ollama model name and family
 */
function inferOllamaContextWindow(modelId: string, family?: string): number {
  const id = modelId.toLowerCase();
  const fam = family?.toLowerCase() || "";
  
  // Known context windows for popular models
  if (id.includes("llama3.2") || id.includes("llama-3.2")) {
    return 128000; // Llama 3.2 has 128K context
  }
  if (id.includes("llama3.1") || id.includes("llama-3.1")) {
    return 128000; // Llama 3.1 has 128K context
  }
  if (id.includes("llama3") || id.includes("llama-3") || fam.includes("llama")) {
    return 8192; // Llama 3 has 8K context by default
  }
  if (id.includes("qwen3") || id.includes("qwen-3")) {
    return 8192; // Qwen 3 has 8K context
  }
  if (id.includes("qwen2.5") || id.includes("qwen-2.5")) {
    return 32768; // Qwen 2.5 has 32K context
  }
  if (id.includes("mistral") || id.includes("mixtral")) {
    return 32768; // Mistral models typically 32K
  }
  if (id.includes("gemma2") || id.includes("gemma-2")) {
    return 8192; // Gemma 2 has 8K context
  }
  if (id.includes("phi3") || id.includes("phi-3")) {
    return 128000; // Phi-3 has 128K context
  }
  if (id.includes("codellama")) {
    return 16384; // Code Llama has 16K context
  }
  if (id.includes("deepseek")) {
    return 16384; // DeepSeek models typically 16K
  }
  
  // Default context window for unknown models
  return 4096;
}

/**
 * Infer cost tier from Ollama model (all local models are technically free)
 * But we tier them by computational cost/quality for user guidance
 */
function inferOllamaCostTier(modelId: string, parameterSize?: string): "low" | "medium" | "high" {
  const id = modelId.toLowerCase();
  const params = parameterSize?.toLowerCase() || id;
  
  // Extract parameter count from model name or details
  // Look for patterns like "70b", "7b", "1b", "405b"
  const paramMatch = params.match(/(\d+(?:\.\d+)?)\s*b/i);
  const paramCount = paramMatch ? parseFloat(paramMatch[1]) : 0;
  
  // High tier: Large models (>30B parameters) - require significant compute
  if (
    paramCount >= 30 ||
    id.includes("405b") ||
    id.includes("70b") ||
    id.includes("65b") ||
    id.includes("mixtral") && id.includes("8x")
  ) {
    return "high";
  }
  
  // Low tier: Small models (<4B parameters) - fast and efficient
  if (
    paramCount > 0 && paramCount < 4 ||
    id.includes("1b") ||
    id.includes("2b") ||
    id.includes("3b") ||
    id.includes("tiny") ||
    id.includes("mini")
  ) {
    return "low";
  }
  
  // Medium tier: Mid-size models (4B-30B) - balanced performance
  return "medium";
}

/**
 * Check if a model is for embeddings (vs text generation)
 */
function isEmbeddingModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  
  return (
    id.includes("embed") ||
    id.includes("nomic") ||
    id.includes("mxbai") ||
    id.includes("all-minilm")
  );
}
