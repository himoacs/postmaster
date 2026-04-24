/**
 * Model Scorer for YOLO Mode
 * 
 * Automatically selects optimal models for content generation based on:
 * - Quality (context window, cost tier as proxy for capability)
 * - Diversity (different providers for varied perspectives)
 * - Availability (only select from validated models)
 */

import { AIProvider, SelectedModel, ModelInfo, LiteLLMModel, YoloSelection, ModelScore } from "@/types";
import { AI_PROVIDERS, getTextGenerationProviders } from "./providers";

const YOLO_MODEL_COUNT = 3;

// Quality weights for scoring
const QUALITY_WEIGHTS = {
  contextWindow: 0.3,  // Larger context = better understanding
  costTier: 0.5,       // Higher tier usually = better quality
  streaming: 0.2,      // Streaming support is nice but not critical
};

// Cost tier scores (higher = better quality)
const COST_TIER_SCORES: Record<string, number> = {
  high: 1.0,
  medium: 0.6,
  low: 0.3,
};

/**
 * Select optimal models for YOLO mode
 * 
 * Strategy:
 * 1. Score all available models by quality
 * 2. Prioritize diversity - pick top model from each provider
 * 3. Fill remaining slots with highest-scoring models
 */
export function selectOptimalModels(
  availableModels: Array<{ provider: AIProvider; models: ModelInfo[] }>,
  liteLLMModels: LiteLLMModel[] = [],
  count: number = YOLO_MODEL_COUNT
): YoloSelection {
  const scoredModels: ModelScore[] = [];
  const reasoning: string[] = [];
  
  // Score models from direct API providers
  for (const providerData of availableModels) {
    const { provider, models } = providerData;
    
    // Skip STABILITY (image generation) and LITELLM (handled separately)
    if (provider === "STABILITY" || provider === "LITELLM") continue;
    
    for (const model of models) {
      const score = scoreModel(model, provider);
      scoredModels.push({
        provider,
        modelId: model.id,
        score: score.total,
        factors: {
          quality: score.quality,
          diversity: 0, // Will be calculated during selection
          contextWindow: score.contextWindow,
        },
      });
    }
  }
  
  // Score LiteLLM models (add diversity bonus for unique providers)
  // Filter out non-text models (image, embedding, audio models)
  const textLiteLLMModels = liteLLMModels.filter(model => {
    const id = model.id.toLowerCase();
    // Exclude image generation models
    if (id.includes('dall') || id.includes('dalle') || id.includes('stable-diffusion') || 
        id.includes('midjourney') || id.includes('imagen')) {
      return false;
    }
    // Exclude embedding models
    if (id.includes('embed') || id.includes('embedding')) {
      return false;
    }
    // Exclude audio/speech models
    if (id.includes('whisper') || id.includes('tts') || id.includes('speech')) {
      return false;
    }
    return true;
  });
  
  for (const model of textLiteLLMModels) {
    const score = scoreLiteLLMModel(model);
    scoredModels.push({
      provider: "LITELLM",
      modelId: model.id,
      score: score.total,
      factors: {
        quality: score.quality,
        diversity: 0,
        contextWindow: score.contextWindow,
      },
    });
  }
  
  if (scoredModels.length === 0) {
    return {
      models: [],
      reasoning: ["No models available. Configure API keys or LiteLLM in Settings."],
    };
  }
  
  // Sort by score (descending)
  scoredModels.sort((a, b) => b.score - a.score);
  
  // Select models with diversity priority
  const selectedModels: SelectedModel[] = [];
  const usedProviders = new Set<string>();
  
  // Pass 1: Pick the best model from each unique provider (for diversity)
  const tempSelected: ModelScore[] = [];
  for (const model of scoredModels) {
    // Get the "effective" provider (for LiteLLM, use the original provider)
    const effectiveProvider = model.provider === "LITELLM" 
      ? getLiteLLMEffectiveProvider(model.modelId, liteLLMModels)
      : model.provider;
    
    if (!usedProviders.has(effectiveProvider) && tempSelected.length < count) {
      tempSelected.push(model);
      usedProviders.add(effectiveProvider);
    }
  }
  
  // Pass 2: Fill remaining slots with highest-scoring models
  for (const model of scoredModels) {
    if (tempSelected.length >= count) break;
    if (!tempSelected.includes(model)) {
      tempSelected.push(model);
    }
  }
  
  // Convert to SelectedModel format and generate reasoning
  for (const model of tempSelected) {
    selectedModels.push({
      provider: model.provider,
      modelId: model.modelId,
    });
    
    const providerName = model.provider === "LITELLM" 
      ? `LiteLLM (${getLiteLLMEffectiveProvider(model.modelId, liteLLMModels)})`
      : model.provider;
    
    reasoning.push(
      `${model.modelId} (${providerName}): Quality ${Math.round(model.factors.quality * 100)}%, ` +
      `Context ${formatContextWindow(model.factors.contextWindow)}`
    );
  }
  
  return {
    models: selectedModels,
    reasoning,
  };
}

/**
 * Score a direct API model
 */
function scoreModel(
  model: ModelInfo,
  provider: AIProvider
): { total: number; quality: number; contextWindow: number } {
  // Normalize context window (0-1 scale, 200K = 1.0)
  const contextScore = Math.min(model.contextWindow / 200000, 1.0);
  
  // Cost tier score
  const costScore = COST_TIER_SCORES[model.costTier] || 0.5;
  
  // Streaming bonus
  const streamingScore = model.supportsStreaming ? 1.0 : 0.5;
  
  // Calculate weighted quality score
  const qualityScore = 
    contextScore * QUALITY_WEIGHTS.contextWindow +
    costScore * QUALITY_WEIGHTS.costTier +
    streamingScore * QUALITY_WEIGHTS.streaming;
  
  // Provider reputation bonus (slight boost for well-known providers)
  const providerBonus = getProviderBonus(provider);
  
  return {
    total: qualityScore + providerBonus,
    quality: qualityScore,
    contextWindow: model.contextWindow,
  };
}

/**
 * Score a LiteLLM model
 */
function scoreLiteLLMModel(
  model: LiteLLMModel
): { total: number; quality: number; contextWindow: number } {
  // Normalize context window
  const contextScore = Math.min((model.contextWindow || 8192) / 200000, 1.0);
  
  // Cost tier score
  const costScore = COST_TIER_SCORES[model.costTier || "medium"] || 0.5;
  
  // Calculate weighted quality score
  const qualityScore = 
    contextScore * QUALITY_WEIGHTS.contextWindow +
    costScore * (QUALITY_WEIGHTS.costTier + QUALITY_WEIGHTS.streaming);
  
  // Provider reputation bonus based on inferred provider
  const providerBonus = getLiteLLMProviderBonus(model.provider);
  
  return {
    total: qualityScore + providerBonus,
    quality: qualityScore,
    contextWindow: model.contextWindow || 8192,
  };
}

/**
 * Get provider reputation bonus
 */
function getProviderBonus(provider: AIProvider): number {
  const bonuses: Record<string, number> = {
    OPENAI: 0.05,
    ANTHROPIC: 0.05,
    XAI: 0.03,
    MISTRAL: 0.02,
    LITELLM: 0.01,
    STABILITY: 0,
  };
  return bonuses[provider] || 0;
}

/**
 * Get LiteLLM provider reputation bonus
 */
function getLiteLLMProviderBonus(provider: string): number {
  const bonuses: Record<string, number> = {
    openai: 0.05,
    anthropic: 0.05,
    google: 0.04,
    xai: 0.03,
    mistral: 0.02,
    meta: 0.02,
    cohere: 0.01,
    deepseek: 0.01,
  };
  return bonuses[provider.toLowerCase()] || 0;
}

/**
 * Get effective provider for a LiteLLM model (for diversity calculation)
 */
function getLiteLLMEffectiveProvider(modelId: string, models: LiteLLMModel[]): string {
  const model = models.find(m => m.id === modelId);
  return model?.provider || "unknown";
}

/**
 * Format context window for display
 */
function formatContextWindow(contextWindow: number): string {
  if (contextWindow >= 1000000) {
    return `${(contextWindow / 1000000).toFixed(1)}M`;
  }
  if (contextWindow >= 1000) {
    return `${Math.round(contextWindow / 1000)}K`;
  }
  return contextWindow.toString();
}

/**
 * Get the best single model (for simple operations)
 */
export function selectBestModel(
  availableModels: Array<{ provider: AIProvider; models: ModelInfo[] }>,
  liteLLMModels: LiteLLMModel[] = []
): SelectedModel | null {
  const selection = selectOptimalModels(availableModels, liteLLMModels, 1);
  return selection.models[0] || null;
}
