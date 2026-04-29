/**
 * Test fixtures - shared test data and factories
 */
import { AIProvider } from '@/types';

export const mockAPIKey = {
  id: 'test-key-1',
  provider: 'OPENAI',
  encryptedKey: 'encrypted-test-key',
  isValid: true,
  validModels: ['gpt-4o', 'gpt-4o-mini'],
  lastValidated: new Date('2026-04-28'),
  createdAt: new Date('2026-04-01'),
  updatedAt: new Date('2026-04-28'),
};

export const mockGeneration = {
  id: 'gen-1',
  prompt: 'Write a blog post about AI testing',
  type: 'BLOG_POST',
  status: 'COMPLETED',
  createdAt: new Date('2026-04-28'),
  updatedAt: new Date('2026-04-28'),
};

export const mockGenerationOutput = {
  id: 'output-1',
  generationId: 'gen-1',
  provider: 'OPENAI' as AIProvider,
  modelId: 'gpt-4o',
  content: 'This is a test blog post about AI testing...',
  tokensUsed: 250,
  latency: 1200,
  isStarred: false,
  createdAt: new Date('2026-04-28'),
};

export const mockSynthesis = {
  id: 'synth-1',
  generationId: 'gen-1',
  content: 'Final synthesized content...',
  strategy: 'basic',
  version: 1,
  feedback: null,
  reasoning: null,
  createdAt: new Date('2026-04-28'),
  updatedAt: new Date('2026-04-28'),
};

export const mockStyleProfile = {
  id: 'profile-1',
  tone: 'conversational',
  voice: 'first-person',
  vocabulary: 'technical',
  sentence: 'varied',
  patterns: JSON.stringify(['uses analogies', 'asks rhetorical questions']),
  bio: 'Software engineer and tech blogger',
  context: 'Writing technical blog posts',
  analyzedAt: new Date('2026-04-28'),
  createdAt: new Date('2026-04-28'),
  updatedAt: new Date('2026-04-28'),
};

export const mockKnowledgeEntry = {
  id: 'kb-1',
  type: 'URL',
  url: 'https://example.com/article',
  title: 'Test Article',
  content: 'This is test knowledge base content...',
  wordCount: 150,
  createdAt: new Date('2026-04-28'),
};

export const mockUserPreferences = {
  id: 'pref-1',
  synthesisStrategy: 'basic',
  debateMaxRounds: 3,
  showCritiqueDetails: true,
  primaryModelProvider: 'OPENAI',
  primaryModelId: 'gpt-4o',
  createdAt: new Date('2026-04-28'),
  updatedAt: new Date('2026-04-28'),
};

export const mockLiteLLMConfig = {
  id: 'litellm-1',
  endpoint: 'http://localhost:4000',
  encryptedKey: null,
  isEnabled: true,
  isValid: true,
  cachedModels: JSON.stringify([
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  ]),
  lastValidated: new Date('2026-04-28'),
  createdAt: new Date('2026-04-28'),
  updatedAt: new Date('2026-04-28'),
};

/**
 * Factory functions for creating test data with overrides
 */
export const createMockAPIKey = (overrides: Partial<typeof mockAPIKey> = {}) => ({
  ...mockAPIKey,
  ...overrides,
});

export const createMockGeneration = (overrides: Partial<typeof mockGeneration> = {}) => ({
  ...mockGeneration,
  ...overrides,
});

export const createMockGenerationOutput = (overrides: Partial<typeof mockGenerationOutput> = {}) => ({
  ...mockGenerationOutput,
  ...overrides,
});

export const createMockSynthesis = (overrides: Partial<typeof mockSynthesis> = {}) => ({
  ...mockSynthesis,
  ...overrides,
});

export const createMockStyleProfile = (overrides: Partial<typeof mockStyleProfile> = {}) => ({
  ...mockStyleProfile,
  ...overrides,
});

export const createMockKnowledgeEntry = (overrides: Partial<typeof mockKnowledgeEntry> = {}) => ({
  ...mockKnowledgeEntry,
  ...overrides,
});

export const createMockUserPreferences = (overrides: Partial<typeof mockUserPreferences> = {}) => ({
  ...mockUserPreferences,
  ...overrides,
});
