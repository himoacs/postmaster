/**
 * Database Schema Manifest
 * 
 * Defines the expected schema structure for validation and health checks.
 * This should be updated whenever the Prisma schema changes.
 * Version should match package.json version.
 */

export const CURRENT_SCHEMA_VERSION = "1.2.4";

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  indexes?: string[];
}

export interface ColumnDefinition {
  name: string;
  type: string; // SQLite type: TEXT, INTEGER, REAL, BLOB
  nullable: boolean;
  defaultValue?: string;
}

/**
 * Expected database schema structure.
 * Used for validation to ensure user databases have all required tables/columns.
 */
export const EXPECTED_SCHEMA: TableDefinition[] = [
  {
    name: "APIKey",
    columns: [
      { name: "id", type: "TEXT", nullable: false },
      { name: "provider", type: "TEXT", nullable: false },
      { name: "encryptedKey", type: "TEXT", nullable: false },
      { name: "isValid", type: "INTEGER", nullable: false, defaultValue: "0" },
      { name: "validModels", type: "TEXT", nullable: false, defaultValue: "'[]'" },
      { name: "enabledModels", type: "TEXT", nullable: false, defaultValue: "'[]'" },
      { name: "lastValidated", type: "INTEGER", nullable: true },
      { name: "createdAt", type: "INTEGER", nullable: false },
      { name: "updatedAt", type: "INTEGER", nullable: false },
    ],
  },
  {
    name: "LiteLLMConfig",
    columns: [
      { name: "id", type: "TEXT", nullable: false },
      { name: "endpoint", type: "TEXT", nullable: false },
      { name: "encryptedKey", type: "TEXT", nullable: true },
      { name: "isEnabled", type: "INTEGER", nullable: false, defaultValue: "1" },
      { name: "isValid", type: "INTEGER", nullable: false, defaultValue: "0" },
      { name: "cachedModels", type: "TEXT", nullable: false, defaultValue: "'[]'" },
      { name: "enabledModels", type: "TEXT", nullable: false, defaultValue: "'[]'" },
      { name: "lastValidated", type: "INTEGER", nullable: true },
      { name: "createdAt", type: "INTEGER", nullable: false },
      { name: "updatedAt", type: "INTEGER", nullable: false },
    ],
  },
  {
    name: "OllamaConfig",
    columns: [
      { name: "id", type: "TEXT", nullable: false },
      { name: "endpoint", type: "TEXT", nullable: false },
      { name: "encryptedKey", type: "TEXT", nullable: true },
      { name: "isEnabled", type: "INTEGER", nullable: false, defaultValue: "1" },
      { name: "isValid", type: "INTEGER", nullable: false, defaultValue: "0" },
      { name: "cachedModels", type: "TEXT", nullable: false, defaultValue: "'[]'" },
      { name: "enabledModels", type: "TEXT", nullable: false, defaultValue: "'[]'" },
      { name: "lastValidated", type: "INTEGER", nullable: true },
      { name: "createdAt", type: "INTEGER", nullable: false },
      { name: "updatedAt", type: "INTEGER", nullable: false },
    ],
  },
  {
    name: "StyleProfile",
    columns: [
      { name: "id", type: "TEXT", nullable: false },
      { name: "tone", type: "TEXT", nullable: true },
      { name: "voice", type: "TEXT", nullable: true },
      { name: "vocabulary", type: "TEXT", nullable: true },
      { name: "sentence", type: "TEXT", nullable: true },
      { name: "patterns", type: "TEXT", nullable: true },
      { name: "uniqueVocabulary", type: "TEXT", nullable: true },
      { name: "avoidPatterns", type: "TEXT", nullable: true },
      { name: "writingQuirks", type: "TEXT", nullable: true },
      { name: "sampleExcerpts", type: "TEXT", nullable: true },
      { name: "openingStyles", type: "TEXT", nullable: true },
      { name: "closingStyles", type: "TEXT", nullable: true },
      { name: "bio", type: "TEXT", nullable: true },
      { name: "context", type: "TEXT", nullable: true },
      { name: "overrides", type: "TEXT", nullable: true },
      { name: "analyzedAt", type: "INTEGER", nullable: true },
      { name: "createdAt", type: "INTEGER", nullable: false },
      { name: "updatedAt", type: "INTEGER", nullable: false },
    ],
  },
  {
    name: "ContentSample",
    columns: [
      { name: "id", type: "TEXT", nullable: false },
      { name: "url", type: "TEXT", nullable: false },
      { name: "title", type: "TEXT", nullable: true },
      { name: "extractedText", type: "TEXT", nullable: true },
      { name: "wordCount", type: "INTEGER", nullable: true },
      { name: "analyzedAt", type: "INTEGER", nullable: true },
      { name: "createdAt", type: "INTEGER", nullable: false },
    ],
  },
  {
    name: "Generation",
    columns: [
      { name: "id", type: "TEXT", nullable: false },
      { name: "prompt", type: "TEXT", nullable: false },
      { name: "contentType", type: "TEXT", nullable: false, defaultValue: "'BLOG_POST'" },
      { name: "lengthPref", type: "TEXT", nullable: true },
      { name: "styleContext", type: "TEXT", nullable: true },
      { name: "contentMode", type: "TEXT", nullable: false, defaultValue: "'new'" },
      { name: "sourceContent", type: "TEXT", nullable: true },
      { name: "sourceMap", type: "TEXT", nullable: true },
      { name: "enableCitations", type: "INTEGER", nullable: false, defaultValue: "0" },
      { name: "enableEmojis", type: "INTEGER", nullable: false, defaultValue: "0" },
      { name: "status", type: "TEXT", nullable: false, defaultValue: "'PENDING'" },
      { name: "createdAt", type: "INTEGER", nullable: false },
      { name: "updatedAt", type: "INTEGER", nullable: false },
    ],
  },
  {
    name: "GenerationOutput",
    columns: [
      { name: "id", type: "TEXT", nullable: false },
      { name: "generationId", type: "TEXT", nullable: false },
      { name: "provider", type: "TEXT", nullable: false },
      { name: "model", type: "TEXT", nullable: false },
      { name: "content", type: "TEXT", nullable: false },
      { name: "tokensUsed", type: "INTEGER", nullable: true },
      { name: "latencyMs", type: "INTEGER", nullable: true },
      { name: "createdAt", type: "INTEGER", nullable: false },
    ],
  },
  {
    name: "SynthesizedContent",
    columns: [
      { name: "id", type: "TEXT", nullable: false },
      { name: "generationId", type: "TEXT", nullable: false },
      { name: "content", type: "TEXT", nullable: false },
      { name: "reasoning", type: "TEXT", nullable: true },
      { name: "strategy", type: "TEXT", nullable: false, defaultValue: "'basic'" },
      { name: "version", type: "INTEGER", nullable: false, defaultValue: "1" },
      { name: "feedback", type: "TEXT", nullable: true },
      { name: "imageUrl", type: "TEXT", nullable: true },
      { name: "imagePrompt", type: "TEXT", nullable: true },
      { name: "parentSynthesisId", type: "TEXT", nullable: true },
      { name: "globalVersion", type: "INTEGER", nullable: false, defaultValue: "1" },
      { name: "createdAt", type: "INTEGER", nullable: false },
      { name: "updatedAt", type: "INTEGER", nullable: false },
    ],
  },
  {
    name: "GenerationCritique",
    columns: [
      { name: "id", type: "TEXT", nullable: false },
      { name: "generationId", type: "TEXT", nullable: false },
      { name: "fromProvider", type: "TEXT", nullable: false },
      { name: "fromModel", type: "TEXT", nullable: false },
      { name: "critiques", type: "TEXT", nullable: false },
      { name: "debateRound", type: "INTEGER", nullable: false, defaultValue: "0" },
      { name: "createdAt", type: "INTEGER", nullable: false },
    ],
  },
  {
    name: "UserPreferences",
    columns: [
      { name: "id", type: "TEXT", nullable: false },
      { name: "synthesisStrategy", type: "TEXT", nullable: false, defaultValue: "'basic'" },
      { name: "debateMaxRounds", type: "INTEGER", nullable: false, defaultValue: "3" },
      { name: "showCritiqueDetails", type: "INTEGER", nullable: false, defaultValue: "1" },
      { name: "primaryModelProvider", type: "TEXT", nullable: true },
      { name: "primaryModelId", type: "TEXT", nullable: true },
      { name: "createdAt", type: "INTEGER", nullable: false },
      { name: "updatedAt", type: "INTEGER", nullable: false },
    ],
  },
  {
    name: "ModelAnalytics",
    columns: [
      { name: "id", type: "TEXT", nullable: false },
      { name: "provider", type: "TEXT", nullable: false },
      { name: "modelId", type: "TEXT", nullable: false },
      { name: "totalRuns", type: "INTEGER", nullable: false, defaultValue: "0" },
      { name: "totalTokens", type: "INTEGER", nullable: false, defaultValue: "0" },
      { name: "totalLatencyMs", type: "INTEGER", nullable: false, defaultValue: "0" },
      { name: "avgRating", type: "REAL", nullable: true },
      { name: "lastUsed", type: "INTEGER", nullable: true },
      { name: "createdAt", type: "INTEGER", nullable: false },
      { name: "updatedAt", type: "INTEGER", nullable: false },
    ],
  },
  {
    name: "SynthesisContribution",
    columns: [
      { name: "id", type: "TEXT", nullable: false },
      { name: "synthesisId", type: "TEXT", nullable: false },
      { name: "generationId", type: "TEXT", nullable: false },
      { name: "provider", type: "TEXT", nullable: false },
      { name: "model", type: "TEXT", nullable: false },
      { name: "aspectCount", type: "INTEGER", nullable: false, defaultValue: "0" },
      { name: "totalAspects", type: "INTEGER", nullable: false, defaultValue: "0" },
      { name: "aspectTypes", type: "TEXT", nullable: false, defaultValue: "'[]'" },
      { name: "starredCount", type: "INTEGER", nullable: false, defaultValue: "0" },
      { name: "createdAt", type: "INTEGER", nullable: false },
    ],
  },
  {
    name: "SynthesisVersion",
    columns: [
      { name: "id", type: "TEXT", nullable: false },
      { name: "synthesizedContentId", type: "TEXT", nullable: false },
      { name: "version", type: "INTEGER", nullable: false },
      { name: "content", type: "TEXT", nullable: false },
      { name: "reasoning", type: "TEXT", nullable: true },
      { name: "feedback", type: "TEXT", nullable: true },
      { name: "createdAt", type: "INTEGER", nullable: false },
    ],
  },
  {
    name: "Draft",
    columns: [
      { name: "id", type: "TEXT", nullable: false },
      { name: "prompt", type: "TEXT", nullable: false },
      { name: "contentType", type: "TEXT", nullable: false, defaultValue: "'BLOG_POST'" },
      { name: "lengthPref", type: "TEXT", nullable: true },
      { name: "contentMode", type: "TEXT", nullable: false, defaultValue: "'new'" },
      { name: "existingContent", type: "TEXT", nullable: true },
      { name: "selectedModels", type: "TEXT", nullable: false },
      { name: "yoloMode", type: "INTEGER", nullable: false, defaultValue: "0" },
      { name: "references", type: "TEXT", nullable: false, defaultValue: "'[]'" },
      { name: "selectedKnowledge", type: "TEXT", nullable: false, defaultValue: "'[]'" },
      { name: "enableCitations", type: "INTEGER", nullable: false, defaultValue: "0" },
      { name: "synthesisStrategy", type: "TEXT", nullable: false, defaultValue: "'basic'" },
      { name: "createdAt", type: "INTEGER", nullable: false },
      { name: "updatedAt", type: "INTEGER", nullable: false },
    ],
  },
  {
    name: "KnowledgeEntry",
    columns: [
      { name: "id", type: "TEXT", nullable: false },
      { name: "title", type: "TEXT", nullable: false },
      { name: "type", type: "TEXT", nullable: false },
      { name: "source", type: "TEXT", nullable: false },
      { name: "mimeType", type: "TEXT", nullable: true },
      { name: "content", type: "TEXT", nullable: false },
      { name: "wordCount", type: "INTEGER", nullable: false },
      { name: "isActive", type: "INTEGER", nullable: false, defaultValue: "1" },
      { name: "subpageLinks", type: "TEXT", nullable: true },
      { name: "createdAt", type: "INTEGER", nullable: false },
      { name: "updatedAt", type: "INTEGER", nullable: false },
    ],
  },
  {
    name: "SchemaVersion",
    columns: [
      { name: "id", type: "TEXT", nullable: false },
      { name: "version", type: "TEXT", nullable: false },
      { name: "description", type: "TEXT", nullable: false },
      { name: "appliedAt", type: "INTEGER", nullable: false },
    ],
  },
];

/**
 * Get all expected table names
 */
export function getExpectedTableNames(): string[] {
  return EXPECTED_SCHEMA.map((table) => table.name);
}

/**
 * Get expected columns for a specific table
 */
export function getExpectedColumns(tableName: string): ColumnDefinition[] {
  const table = EXPECTED_SCHEMA.find((t) => t.name === tableName);
  return table?.columns ?? [];
}

/**
 * Check if a table is expected to exist
 */
export function isExpectedTable(tableName: string): boolean {
  return EXPECTED_SCHEMA.some((t) => t.name === tableName);
}

/**
 * Check if a column is expected in a table
 */
export function isExpectedColumn(tableName: string, columnName: string): boolean {
  const table = EXPECTED_SCHEMA.find((t) => t.name === tableName);
  return table?.columns.some((c) => c.name === columnName) ?? false;
}
