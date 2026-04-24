// AI Provider type - defined locally for SQLite compatibility
// LITELLM is a special provider that routes through a LiteLLM proxy
export const AI_PROVIDERS = ["OPENAI", "ANTHROPIC", "XAI", "MISTRAL", "STABILITY", "LITELLM"] as const;
export type AIProvider = (typeof AI_PROVIDERS)[number];

// Text-only providers (excludes image generation)
export const TEXT_PROVIDERS = ["OPENAI", "ANTHROPIC", "XAI", "MISTRAL", "LITELLM"] as const;
export type TextProvider = (typeof TEXT_PROVIDERS)[number];

// Generation status and content types
export const GENERATION_STATUSES = ["PENDING", "GENERATING", "SYNTHESIZING", "COMPLETED", "FAILED"] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

export const CONTENT_TYPES = ["BLOG_POST", "TWEET_THREAD", "LINKEDIN_POST", "EMAIL", "ARTICLE", "OTHER"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

// AI Provider Types
export interface ProviderConfig {
  id: AIProvider;
  name: string;
  description: string;
  models: ModelInfo[];
  validationEndpoint?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  costTier: "low" | "medium" | "high";
  supportsStreaming: boolean;
}

// Style Profile Types
export interface StyleCharacteristics {
  tone: string;
  voice: string;
  vocabulary: string;
  sentenceStructure: string;
  patterns: string[];
  commonPhrases: string[];
}

export interface StyleOverrides {
  adjustments: string[];
  priorities: string[];
}

// Generation Types
export interface GenerationRequest {
  prompt: string;
  contentType: string;
  lengthPref: string;
  selectedModels: SelectedModel[];
}

export interface SelectedModel {
  provider: AIProvider;
  modelId: string;
}

export interface GenerationOutput {
  provider: AIProvider;
  model: string;
  content: string;
  tokensUsed?: number;
  latencyMs?: number;
}

export interface SynthesisRequest {
  outputs: GenerationOutput[];
  starredSections?: StarredSection[];
  primaryModel: SelectedModel;
}

export interface StarredSection {
  provider: AIProvider;
  startIndex: number;
  endIndex: number;
  text: string;
}

// Image Generation Types
export type ImageProvider = "openai" | "stability";

export interface ImageGenerationRequest {
  prompt: string;
  provider: ImageProvider;
  style?: string;
  size?: string;
}

// API Key Validation Response Types
export interface KeyValidationResult {
  valid: boolean;
  models?: string[];
  error?: string;
}

// LiteLLM Types
export interface LiteLLMModel {
  id: string;              // Model ID used for API calls (e.g., "gpt-4", "claude-3-opus")
  name: string;            // Display name
  provider: string;        // Original provider (e.g., "openai", "anthropic")
  contextWindow?: number;
  costTier?: "low" | "medium" | "high";
  maxTokens?: number;
}

export interface LiteLLMConfig {
  id: string;
  endpoint: string;
  isEnabled: boolean;
  isValid: boolean;
  models: LiteLLMModel[];
  lastValidated?: string;
}

export interface LiteLLMValidationResult {
  valid: boolean;
  models?: LiteLLMModel[];
  error?: string;
}

// YOLO Mode Types
export interface YoloSelection {
  models: SelectedModel[];
  reasoning: string[];  // Why each model was selected
}

export interface ModelScore {
  provider: AIProvider;
  modelId: string;
  score: number;
  factors: {
    quality: number;
    diversity: number;
    contextWindow: number;
  };
}
