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

// ============================================================================
// Synthesis Strategy Types
// ============================================================================

// Synthesis strategy options for multi-model critique
export const SYNTHESIS_STRATEGIES = ["basic", "sequential", "debate"] as const;
export type SynthesisStrategy = (typeof SYNTHESIS_STRATEGIES)[number];

// Critique output from one model evaluating other drafts
export interface CritiqueOutput {
  fromModel: SelectedModel;           // Model that provided the critique
  targetDrafts: CritiquedDraft[];     // Evaluations of each draft
  overallRating: number;              // 1-10 overall quality assessment
  consensusPoints: string[];          // Points all drafts agree on
  timestamp: string;
}

export interface CritiquedDraft {
  targetModel: SelectedModel;         // Model whose output is being critiqued
  strengths: string[];                // What this draft does well
  weaknesses: string[];               // Areas for improvement
  suggestions: string[];              // Specific improvement suggestions
  rating: number;                     // 1-10 rating for this draft
}

// Debate round for iterative refinement
export interface DebateRound {
  roundNumber: number;
  critiques: CritiqueOutput[];        // All critiques from this round
  refinedOutputs?: GenerationOutput[]; // Refined outputs after critique (if applicable)
  convergenceScore: number;           // 0-1 how much models agree
  newIssuesFound: number;             // New issues discovered this round
  timestamp: string;
}

// Debate session tracking full debate process
export interface DebateSession {
  id: string;
  generationId: string;
  strategy: "debate";
  rounds: DebateRound[];
  maxRounds: number;
  converged: boolean;                 // True if debate reached consensus early
  finalConsensus: string;             // Final synthesized content
  transcript: DebateTranscriptEntry[];
}

export interface DebateTranscriptEntry {
  roundNumber: number;
  model: SelectedModel;
  type: "critique" | "response" | "synthesis";
  content: string;
  timestamp: string;
}

// Extended synthesis request with strategy
export interface ExtendedSynthesisRequest extends SynthesisRequest {
  strategy: SynthesisStrategy;
  critiques?: CritiqueOutput[];       // For sequential strategy
  debateSession?: DebateSession;      // For debate strategy
}

// User preferences for synthesis
export interface UserPreferences {
  synthesisStrategy: SynthesisStrategy;
  debateMaxRounds: number;            // Max rounds for debate mode (default: 3)
  showCritiqueDetails: boolean;       // Show detailed critique in UI
  primaryModelProvider?: string;      // e.g., "LITELLM", "OPENAI"
  primaryModelId?: string;            // e.g., "azure-gpt-4o", "gpt-4o"
}

// LLM reasoning for synthesis transparency
export interface SynthesisReasoningDecision {
  aspect: string;    // What aspect of the content (Structure, Opening, Tone, etc.)
  choice: string;    // What the LLM chose to do
  rationale: string; // Why this choice was made
}

export interface SynthesisReasoning {
  summary: string;                      // Overview of synthesis approach
  decisions: SynthesisReasoningDecision[]; // Key decisions made
}
