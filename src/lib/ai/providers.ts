import { AIProvider } from "@/types";
import { ProviderConfig, ModelInfo } from "@/types";

export const AI_PROVIDERS: Record<AIProvider, ProviderConfig> = {
  OPENAI: {
    id: "OPENAI",
    name: "OpenAI",
    description: "GPT-4o, GPT-4 Turbo, and more",
    models: [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        contextWindow: 128000,
        costTier: "high",
        supportsStreaming: true,
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        contextWindow: 128000,
        costTier: "low",
        supportsStreaming: true,
      },
      {
        id: "gpt-4-turbo",
        name: "GPT-4 Turbo",
        contextWindow: 128000,
        costTier: "high",
        supportsStreaming: true,
      },
    ],
  },
  ANTHROPIC: {
    id: "ANTHROPIC",
    name: "Anthropic",
    description: "Claude 3.5 Sonnet, Claude 3 Opus",
    models: [
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        contextWindow: 200000,
        costTier: "high",
        supportsStreaming: true,
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        contextWindow: 200000,
        costTier: "high",
        supportsStreaming: true,
      },
      {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus",
        contextWindow: 200000,
        costTier: "high",
        supportsStreaming: true,
      },
    ],
  },
  XAI: {
    id: "XAI",
    name: "xAI",
    description: "Grok-2, Grok-2 Mini",
    models: [
      {
        id: "grok-2",
        name: "Grok-2",
        contextWindow: 131072,
        costTier: "high",
        supportsStreaming: true,
      },
      {
        id: "grok-2-mini",
        name: "Grok-2 Mini",
        contextWindow: 131072,
        costTier: "medium",
        supportsStreaming: true,
      },
    ],
  },
  MISTRAL: {
    id: "MISTRAL",
    name: "Mistral AI",
    description: "Mistral Large, Mistral Medium",
    models: [
      {
        id: "mistral-large-latest",
        name: "Mistral Large",
        contextWindow: 128000,
        costTier: "high",
        supportsStreaming: true,
      },
      {
        id: "mistral-medium-latest",
        name: "Mistral Medium",
        contextWindow: 32000,
        costTier: "medium",
        supportsStreaming: true,
      },
      {
        id: "mistral-small-latest",
        name: "Mistral Small",
        contextWindow: 32000,
        costTier: "low",
        supportsStreaming: true,
      },
    ],
  },
  STABILITY: {
    id: "STABILITY",
    name: "Stability AI",
    description: "Image generation with Stable Diffusion",
    models: [
      {
        id: "stable-diffusion-xl-1024-v1-0",
        name: "SDXL 1.0",
        contextWindow: 0,
        costTier: "medium",
        supportsStreaming: false,
      },
      {
        id: "stable-image-ultra",
        name: "Stable Image Ultra",
        contextWindow: 0,
        costTier: "high",
        supportsStreaming: false,
      },
    ],
  },
  LITELLM: {
    id: "LITELLM",
    name: "LiteLLM Proxy",
    description: "Unified access to 100+ LLM providers",
    models: [], // Models are dynamically discovered from the proxy
  },
  OLLAMA: {
    id: "OLLAMA",
    name: "Ollama (Local)",
    description: "Run models locally with privacy and zero cost",
    models: [], // Models are dynamically discovered from Ollama
  },
};

export function getProviderById(id: AIProvider): ProviderConfig {
  return AI_PROVIDERS[id];
}

export function getModelById(
  provider: AIProvider,
  modelId: string
): ModelInfo | undefined {
  return AI_PROVIDERS[provider].models.find((m) => m.id === modelId);
}

export function getTextGenerationProviders(): ProviderConfig[] {
  return [
    AI_PROVIDERS.OPENAI,
    AI_PROVIDERS.ANTHROPIC,
    AI_PROVIDERS.XAI,
    AI_PROVIDERS.MISTRAL,
  ];
}

export function getImageGenerationProviders(): ProviderConfig[] {
  return [AI_PROVIDERS.STABILITY, AI_PROVIDERS.OPENAI];
}

// Provider priority for text generation (higher = better)
const PROVIDER_PRIORITY: Record<AIProvider, number> = {
  ANTHROPIC: 4,
  OPENAI: 3,
  XAI: 2,
  MISTRAL: 1,
  STABILITY: 0,
  LITELLM: 0,
  OLLAMA: 0,
};

// Cost tier priority (higher = better quality)
const COST_TIER_PRIORITY: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

interface AvailableModel {
  provider: AIProvider;
  modelId: string;
}

/**
 * Select the best available model from a list of available models.
 * Prioritizes by cost tier (high > medium > low), then by provider preference.
 * Returns null if no models are available.
 */
export function selectBestAvailableModel(
  availableModels: AvailableModel[]
): AvailableModel | null {
  if (availableModels.length === 0) return null;

  // Filter to text generation models only
  const textProviders = new Set(getTextGenerationProviders().map((p) => p.id));
  const textModels = availableModels.filter((m) => 
    textProviders.has(m.provider) || m.provider === "LITELLM"
  );

  if (textModels.length === 0) return null;

  // Sort by quality: cost tier first, then provider priority
  const sorted = [...textModels].sort((a, b) => {
    const aModel = getModelById(a.provider as AIProvider, a.modelId);
    const bModel = getModelById(b.provider as AIProvider, b.modelId);

    // For LiteLLM, we don't have model info, so treat as medium tier
    const aTier = aModel?.costTier || "medium";
    const bTier = bModel?.costTier || "medium";

    const aTierPriority = COST_TIER_PRIORITY[aTier] || 2;
    const bTierPriority = COST_TIER_PRIORITY[bTier] || 2;

    // First compare by cost tier
    if (aTierPriority !== bTierPriority) {
      return bTierPriority - aTierPriority;
    }

    // If same tier, compare by provider priority
    const aProviderPriority = PROVIDER_PRIORITY[a.provider] || 0;
    const bProviderPriority = PROVIDER_PRIORITY[b.provider] || 0;
    return bProviderPriority - aProviderPriority;
  });

  return sorted[0];
}
