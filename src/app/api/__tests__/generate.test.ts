/**
 * Tests for /api/generate - Content generation with multiple models
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/generate/route';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { generateWithOpenAI } from '@/lib/ai/openai';
import { generateWithAnthropic } from '@/lib/ai/claude';
import { generateWithLiteLLM } from '@/lib/ai/litellm';
import { selectOptimalModels } from '@/lib/ai/model-scorer';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    styleProfile: {
      findFirst: vi.fn(),
    },
    aPIKey: {
      findMany: vi.fn(),
    },
    liteLLMConfig: {
      findFirst: vi.fn(),
    },
    generation: {
      create: vi.fn(),
      update: vi.fn(),
    },
    generationOutput: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/encryption', () => ({
  decrypt: vi.fn((encrypted: string) => 'decrypted-api-key'),
}));

vi.mock('@/lib/ai/openai', () => ({
  generateWithOpenAI: vi.fn(),
}));

vi.mock('@/lib/ai/claude', () => ({
  generateWithAnthropic: vi.fn(),
}));

vi.mock('@/lib/ai/mistral', () => ({
  generateWithMistral: vi.fn(),
}));

vi.mock('@/lib/ai/grok', () => ({
  generateWithGrok: vi.fn(),
}));

vi.mock('@/lib/ai/litellm', () => ({
  generateWithLiteLLM: vi.fn(),
}));

vi.mock('@/lib/ai/model-scorer', () => ({
  selectOptimalModels: vi.fn(),
}));

vi.mock('@/lib/url-fetcher', () => ({
  fetchMultipleUrls: vi.fn(() => Promise.resolve([])),
  formatReferencesForPrompt: vi.fn(() => ''),
}));

vi.mock('@/lib/ai/anti-patterns', () => ({
  buildAntiPatternPromptSection: vi.fn(() => ''),
}));

describe('API: /api/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    vi.mocked(prisma.styleProfile.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.aPIKey.findMany).mockResolvedValue([]);
    vi.mocked(prisma.liteLLMConfig.findFirst).mockResolvedValue(null);
  });

  describe('POST /api/generate', () => {
    it('should generate content with multiple models', async () => {
      // Mock API keys
      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue([
        {
          id: 'key-1',
          provider: 'OPENAI',
          encryptedKey: 'encrypted-key-1',
          isValid: true,
          validModels: '["gpt-4o"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'key-2',
          provider: 'ANTHROPIC',
          encryptedKey: 'encrypted-key-2',
          isValid: true,
          validModels: '["claude-3-5-sonnet-20241022"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(prisma.generation.create).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Test prompt',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'GENERATING',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'Generated content from GPT-4o',
        tokensUsed: 200,
      });

      vi.mocked(generateWithAnthropic).mockResolvedValue({
        content: 'Generated content from Claude',
        tokensUsed: 220,
      });

      vi.mocked(prisma.generationOutput.create).mockResolvedValue({
        id: 'output-1',
        generationId: 'gen-1',
        provider: 'OPENAI',
        model: 'gpt-4o',
        content: 'Generated content',
        tokensUsed: 200,
        latencyMs: 1500,
        error: null,
        createdAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Test prompt',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Write about AI',
          contentType: 'blog_post',
          lengthPref: 'medium',
          selectedModels: [
            { provider: 'OPENAI', modelId: 'gpt-4o' },
            { provider: 'ANTHROPIC', modelId: 'claude-3-5-sonnet-20241022' },
          ],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.generationId).toBe('gen-1');
      expect(data.outputs).toHaveLength(2);
      expect(generateWithOpenAI).toHaveBeenCalled();
      expect(generateWithAnthropic).toHaveBeenCalled();
    });

    it('should use YOLO mode to auto-select models', async () => {
      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue([
        {
          id: 'key-1',
          provider: 'OPENAI',
          encryptedKey: 'encrypted-key',
          isValid: true,
          validModels: '["gpt-4o"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(selectOptimalModels).mockReturnValue({
        models: [
          { provider: 'OPENAI', modelId: 'gpt-4o' },
        ],
        reasoning: ['Selected GPT-4o for high quality'],
      });

      vi.mocked(prisma.generation.create).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'GENERATING',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'Generated content',
        tokensUsed: 150,
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Write about AI',
          contentType: 'blog_post',
          lengthPref: 'medium',
          yoloMode: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.yoloSelection).toBeDefined();
      expect(data.yoloSelection.reasoning).toEqual(['Selected GPT-4o for high quality']);
      expect(selectOptimalModels).toHaveBeenCalled();
    });

    it('should return 400 when prompt is missing', async () => {
      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          contentType: 'blog_post',
          lengthPref: 'medium',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Prompt is required');
    });

    it('should return 400 when no models available in YOLO mode', async () => {
      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue([]);
      vi.mocked(selectOptimalModels).mockReturnValue({
        models: [],
        reasoning: [],
      });

      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Write about AI',
          contentType: 'blog_post',
          lengthPref: 'medium',
          yoloMode: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('No models available');
    });

    it('should return 400 when less than 1 model provided in manual mode', async () => {
      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Write about AI',
          contentType: 'blog_post',
          lengthPref: 'medium',
          selectedModels: [],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('At least 1 model required');
    });

    it('should handle enhancement mode with existing content', async () => {
      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue([
        {
          id: 'key-1',
          provider: 'OPENAI',
          encryptedKey: 'encrypted-key',
          isValid: true,
          validModels: '["gpt-4o"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(prisma.generation.create).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Enhance this',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'GENERATING',
        contentMode: 'enhance',
        sourceContent: 'Existing content to enhance',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'Enhanced content',
        tokensUsed: 180,
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Enhance this',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'enhance',
        sourceContent: 'Existing content to enhance',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Make it better',
          contentType: 'blog_post',
          lengthPref: 'medium',
          contentMode: 'enhance',
          existingContent: 'Existing content to enhance',
          selectedModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(prisma.generation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contentMode: 'enhance',
            sourceContent: 'Existing content to enhance',
          }),
        })
      );
    });

    it('should return 500 when all models fail', async () => {
      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue([
        {
          id: 'key-1',
          provider: 'OPENAI',
          encryptedKey: 'encrypted-key',
          isValid: true,
          validModels: '["gpt-4o"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(prisma.generation.create).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'GENERATING',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Model fails
      vi.mocked(generateWithOpenAI).mockRejectedValue(new Error('Rate limit exceeded'));

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'FAILED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Write about AI',
          contentType: 'blog_post',
          lengthPref: 'medium',
          selectedModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('All generation attempts failed');
    });

    it('should use style profile when available', async () => {
      vi.mocked(prisma.styleProfile.findFirst).mockResolvedValue({
        id: 'style-1',
        tone: 'professional',
        vocabulary: 'technical',
        sentenceStyle: 'varied',
        perspective: 'third-person',
        formality: 'formal',
        idioms: false,
        vocabulary_3: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue([
        {
          id: 'key-1',
          provider: 'OPENAI',
          encryptedKey: 'encrypted-key',
          isValid: true,
          validModels: '["gpt-4o"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(prisma.generation.create).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: JSON.stringify({ tone: 'professional' }),
        status: 'GENERATING',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'Professional content',
        tokensUsed: 150,
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: JSON.stringify({ tone: 'professional' }),
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Write about AI',
          contentType: 'blog_post',
          lengthPref: 'medium',
          selectedModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(prisma.styleProfile.findFirst).toHaveBeenCalled();
    });

    it('should handle LiteLLM provider', async () => {
      vi.mocked(prisma.liteLLMConfig.findFirst).mockResolvedValue({
        id: 'litellm-1',
        endpoint: 'http://localhost:4000',
        encryptedKey: null,
        isEnabled: true,
        isValid: true,
        cachedModels: JSON.stringify([{ id: 'gpt-4o', name: 'GPT-4o' }]),
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.generation.create).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'GENERATING',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithLiteLLM).mockResolvedValue({
        content: 'Content via LiteLLM',
        tokensUsed: 160,
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Write about AI',
          contentType: 'blog_post',
          lengthPref: 'medium',
          selectedModels: [{ provider: 'LITELLM', modelId: 'gpt-4o' }],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(generateWithLiteLLM).toHaveBeenCalled();
    });

    it('should handle empty model response with retry', async () => {
      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue([
        {
          id: 'key-1',
          provider: 'OPENAI',
          encryptedKey: 'encrypted-key',
          isValid: true,
          validModels: '["gpt-4o"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(prisma.generation.create).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'GENERATING',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // First call returns empty, second call returns content
      vi.mocked(generateWithOpenAI)
        .mockResolvedValueOnce({ content: '', tokensUsed: 0 })
        .mockResolvedValueOnce({ content: 'Generated after retry', tokensUsed: 150 });

      vi.mocked(prisma.generationOutput.create).mockResolvedValue({
        id: 'output-1',
        generationId: 'gen-1',
        provider: 'OPENAI',
        model: 'gpt-4o',
        content: 'Generated after retry',
        tokensUsed: 150,
        latencyMs: 1000,
        error: null,
        createdAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Write about AI',
          contentType: 'blog_post',
          lengthPref: 'medium',
          selectedModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(generateWithOpenAI).toHaveBeenCalledTimes(2); // Original + retry
      expect(data.outputs[0].content).toBe('Generated after retry');
    });

    it('should handle persistent empty response after retry', async () => {
      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue([
        {
          id: 'key-1',
          provider: 'OPENAI',
          encryptedKey: 'encrypted-key',
          isValid: true,
          validModels: '["gpt-4o"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(prisma.generation.create).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'GENERATING',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Both calls return empty
      vi.mocked(generateWithOpenAI).mockResolvedValue({ content: '', tokensUsed: 0 });

      vi.mocked(prisma.generationOutput.create).mockResolvedValue({
        id: 'output-1',
        generationId: 'gen-1',
        provider: 'OPENAI',
        model: 'gpt-4o',
        content: '',
        tokensUsed: 0,
        latencyMs: 1000,
        error: null,
        createdAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Write about AI',
          contentType: 'blog_post',
          lengthPref: 'medium',
          selectedModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.outputs[0].error).toBe('Model returned empty response');
    });

    it('should handle partial failures with some successful models', async () => {
      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue([
        {
          id: 'key-1',
          provider: 'OPENAI',
          encryptedKey: 'encrypted-key-1',
          isValid: true,
          validModels: '["gpt-4o"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'key-2',
          provider: 'ANTHROPIC',
          encryptedKey: 'encrypted-key-2',
          isValid: true,
          validModels: '["claude-3-5-sonnet-20241022"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(prisma.generation.create).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'GENERATING',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // OpenAI succeeds, Anthropic fails
      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'OpenAI generated content',
        tokensUsed: 150,
      });

      vi.mocked(generateWithAnthropic).mockRejectedValue(new Error('Rate limit exceeded'));

      vi.mocked(prisma.generationOutput.create).mockResolvedValue({
        id: 'output-1',
        generationId: 'gen-1',
        provider: 'OPENAI',
        model: 'gpt-4o',
        content: 'OpenAI generated content',
        tokensUsed: 150,
        latencyMs: 1000,
        error: null,
        createdAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Write about AI',
          contentType: 'blog_post',
          lengthPref: 'medium',
          selectedModels: [
            { provider: 'OPENAI', modelId: 'gpt-4o' },
            { provider: 'ANTHROPIC', modelId: 'claude-3-5-sonnet-20241022' },
          ],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.outputs).toHaveLength(1);
      expect(data.outputs[0].provider).toBe('OPENAI');
      expect(data.failedModels).toHaveLength(1);
      expect(data.failedModels[0].provider).toBe('ANTHROPIC');
      expect(data.failedModels[0].error).toBe('Rate limit exceeded');
    });

    it('should handle different content types', async () => {
      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue([
        {
          id: 'key-1',
          provider: 'OPENAI',
          encryptedKey: 'encrypted-key',
          isValid: true,
          validModels: '["gpt-4o"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'Tweet thread content',
        tokensUsed: 80,
      });

      const contentTypes = ['tweet_thread', 'linkedin_post', 'email', 'article'];

      for (const contentType of contentTypes) {
        vi.mocked(prisma.generation.create).mockResolvedValue({
          id: `gen-${contentType}`,
          prompt: 'Test',
          contentType: contentType.toUpperCase() as any,
          lengthPref: 'medium',
          styleContext: null,
          status: 'GENERATING',
          contentMode: 'new',
          sourceContent: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        vi.mocked(prisma.generationOutput.create).mockResolvedValue({
          id: 'output-1',
          generationId: `gen-${contentType}`,
          provider: 'OPENAI',
          model: 'gpt-4o',
          content: 'Generated content',
          tokensUsed: 80,
          latencyMs: 1000,
          error: null,
          createdAt: new Date(),
        });

        vi.mocked(prisma.generation.update).mockResolvedValue({
          id: `gen-${contentType}`,
          prompt: 'Test',
          contentType: contentType.toUpperCase() as any,
          lengthPref: 'medium',
          styleContext: null,
          status: 'COMPLETED',
          contentMode: 'new',
          sourceContent: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = new NextRequest('http://localhost/api/generate', {
          method: 'POST',
          body: JSON.stringify({
            prompt: 'Write something',
            contentType,
            lengthPref: 'medium',
            selectedModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
          }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
      }
    });

    it('should handle references with URL fetching', async () => {
      const { fetchMultipleUrls, formatReferencesForPrompt } = await import('@/lib/url-fetcher');
      
      vi.mocked(fetchMultipleUrls).mockResolvedValue([
        {
          url: 'https://example.com/article',
          title: 'Example Article',
          content: 'Article content about AI',
          error: null,
        },
      ]);

      vi.mocked(formatReferencesForPrompt).mockReturnValue(
        '\n\nREFERENCE MATERIALS:\n1. Example Article (https://example.com/article)\nArticle content about AI'
      );

      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue([
        {
          id: 'key-1',
          provider: 'OPENAI',
          encryptedKey: 'encrypted-key',
          isValid: true,
          validModels: '["gpt-4o"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(prisma.generation.create).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Write about AI',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'GENERATING',
        contentMode: 'new',
        sourceContent: null,
        sourceMap: JSON.stringify([{ url: 'https://example.com/article', title: 'Example Article' }]),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'AI content with [Source: Example Article](https://example.com/article)',
        tokensUsed: 200,
      });

      vi.mocked(prisma.generationOutput.create).mockResolvedValue({
        id: 'output-1',
        generationId: 'gen-1',
        provider: 'OPENAI',
        model: 'gpt-4o',
        content: 'Generated content',
        tokensUsed: 200,
        latencyMs: 1500,
        error: null,
        createdAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Write about AI',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        sourceMap: JSON.stringify([{ url: 'https://example.com/article', title: 'Example Article' }]),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Write about AI',
          contentType: 'blog_post',
          lengthPref: 'medium',
          selectedModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
          references: [
            { type: 'url', value: 'https://example.com/article' },
          ],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(fetchMultipleUrls).toHaveBeenCalledWith(['https://example.com/article']);
      expect(formatReferencesForPrompt).toHaveBeenCalled();
    });

    it('should enable citations with sourceMap', async () => {
      const { fetchMultipleUrls, formatReferencesForPrompt } = await import('@/lib/url-fetcher');
      
      vi.mocked(fetchMultipleUrls).mockResolvedValue([
        {
          url: 'https://example.com/research',
          title: 'Research Paper',
          content: 'Research findings',
          error: null,
        },
      ]);

      vi.mocked(formatReferencesForPrompt).mockReturnValue('\n\nREFERENCE MATERIALS:\nResearch findings');

      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue([
        {
          id: 'key-1',
          provider: 'OPENAI',
          encryptedKey: 'encrypted-key',
          isValid: true,
          validModels: '["gpt-4o"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(prisma.generation.create).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Summarize research',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'GENERATING',
        contentMode: 'new',
        sourceContent: null,
        sourceMap: JSON.stringify([{ url: 'https://example.com/research', title: 'Research Paper' }]),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'Summary with [Source: Research Paper](https://example.com/research) citation',
        tokensUsed: 180,
      });

      vi.mocked(prisma.generationOutput.create).mockResolvedValue({
        id: 'output-1',
        generationId: 'gen-1',
        provider: 'OPENAI',
        model: 'gpt-4o',
        content: 'Summary with citation',
        tokensUsed: 180,
        latencyMs: 1400,
        error: null,
        createdAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Summarize research',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        sourceMap: JSON.stringify([{ url: 'https://example.com/research', title: 'Research Paper' }]),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Summarize research',
          contentType: 'blog_post',
          lengthPref: 'medium',
          selectedModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
          references: [
            { type: 'url', value: 'https://example.com/research' },
          ],
          enableCitations: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(generateWithOpenAI).toHaveBeenCalledWith(
        'decrypted-api-key',
        'gpt-4o',
        expect.stringContaining('INLINE CITATIONS'),
        expect.stringContaining('Summarize research')
      );
    });

    it('should handle style profile with multiple fields', async () => {
      vi.mocked(prisma.styleProfile.findFirst).mockResolvedValue({
        id: 'style-1',
        tone: 'Casual and conversational',
        voice: 'First person',
        pacing: 'Fast-paced',
        sentenceVariety: 'Mix short and long',
        vocabulary: 'Simple',
        idioms: '["Piece of cake", "Hit the nail on the head"]',
        transitions: '["Meanwhile", "In addition"]',
        openings: '["Let me tell you", "Here\'s the thing"]',
        closings: '["That\'s all for now", "See you next time"]',
        writingQuirks: JSON.stringify({
          punctuation: 'Uses em dashes frequently',
          emoji: 'Occasional emojis',
          caps: 'Rarely uses all caps',
        }),
        avoidPatterns: '["Delve", "Dive deep", "Leverage"]',
        bio: 'Tech blogger and developer',
        context: 'Writing for developers',
        sampleExcerpts: JSON.stringify([
          'This is an example excerpt from my writing.',
          'Another example showing my style.',
        ]),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue([
        {
          id: 'key-1',
          provider: 'OPENAI',
          encryptedKey: 'encrypted-key',
          isValid: true,
          validModels: '["gpt-4o"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(prisma.generation.create).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Write a blog post',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: expect.any(String),
        status: 'GENERATING',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'Styled blog post content',
        tokensUsed: 250,
      });

      vi.mocked(prisma.generationOutput.create).mockResolvedValue({
        id: 'output-1',
        generationId: 'gen-1',
        provider: 'OPENAI',
        model: 'gpt-4o',
        content: 'Styled content',
        tokensUsed: 250,
        latencyMs: 1600,
        error: null,
        createdAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Write a blog post',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: expect.any(String),
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Write a blog post',
          contentType: 'blog_post',
          lengthPref: 'medium',
          selectedModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(generateWithOpenAI).toHaveBeenCalledWith(
        'decrypted-api-key',
        'gpt-4o',
        expect.stringContaining('Tech blogger'),
        expect.stringContaining('Write a blog post')
      );
    });

    it('should handle URL fetching failures gracefully', async () => {
      const { fetchMultipleUrls, formatReferencesForPrompt } = await import('@/lib/url-fetcher');
      
      // Mock URL fetching to return empty/error results instead of throwing
      vi.mocked(fetchMultipleUrls).mockResolvedValue([
        {
          url: 'https://broken-url.com',
          title: 'Broken URL',
          content: '',
          error: 'Network timeout',
        },
      ]);
      vi.mocked(formatReferencesForPrompt).mockReturnValue('');

      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue([
        {
          id: 'key-1',
          provider: 'OPENAI',
          encryptedKey: 'encrypted-key',
          isValid: true,
          validModels: '["gpt-4o"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(prisma.generation.create).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Write about AI',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'GENERATING',
        contentMode: 'new',
        sourceContent: null,
        sourceMap: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'Generated content without references',
        tokensUsed: 150,
      });

      vi.mocked(prisma.generationOutput.create).mockResolvedValue({
        id: 'output-1',
        generationId: 'gen-1',
        provider: 'OPENAI',
        model: 'gpt-4o',
        content: 'Generated content',
        tokensUsed: 150,
        latencyMs: 1400,
        error: null,
        createdAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Write about AI',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        sourceMap: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Write about AI',
          contentType: 'blog_post',
          lengthPref: 'medium',
          selectedModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
          references: [
            { type: 'url', value: 'https://broken-url.com' },
          ],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should succeed despite URL fetch failure
      expect(response.status).toBe(200);
      expect(data.outputs).toHaveLength(1);
    });

    it('should handle malformed style profile JSON gracefully', async () => {
      vi.mocked(prisma.styleProfile.findFirst).mockResolvedValue({
        id: 'style-1',
        tone: 'Casual',
        voice: 'First person',
        pacing: 'Fast',
        sentenceVariety: 'Mixed',
        vocabulary: 'Simple',
        idioms: 'invalid json [',
        transitions: '{"not": "an array"}',
        openings: 'null',
        closings: undefined,
        writingQuirks: 'not valid json at all',
        avoidPatterns: '[incomplete',
        bio: 'Bio text',
        context: 'Context',
        sampleExcerpts: '{broken json',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue([
        {
          id: 'key-1',
          provider: 'OPENAI',
          encryptedKey: 'encrypted-key',
          isValid: true,
          validModels: '["gpt-4o"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(prisma.generation.create).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Write a post',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: expect.any(String),
        status: 'GENERATING',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'Generated content',
        tokensUsed: 180,
      });

      vi.mocked(prisma.generationOutput.create).mockResolvedValue({
        id: 'output-1',
        generationId: 'gen-1',
        provider: 'OPENAI',
        model: 'gpt-4o',
        content: 'Generated content',
        tokensUsed: 180,
        latencyMs: 1500,
        error: null,
        createdAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Write a post',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: expect.any(String),
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Write a post',
          contentType: 'blog_post',
          lengthPref: 'medium',
          selectedModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should succeed despite malformed JSON in style profile
      expect(response.status).toBe(200);
      expect(data.outputs).toHaveLength(1);
    });

    it('should handle empty references array', async () => {
      const { fetchMultipleUrls } = await import('@/lib/url-fetcher');

      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue([
        {
          id: 'key-1',
          provider: 'OPENAI',
          encryptedKey: 'encrypted-key',
          isValid: true,
          validModels: '["gpt-4o"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(prisma.generation.create).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Write content',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'GENERATING',
        contentMode: 'new',
        sourceContent: null,
        sourceMap: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'Generated content without references',
        tokensUsed: 140,
      });

      vi.mocked(prisma.generationOutput.create).mockResolvedValue({
        id: 'output-1',
        generationId: 'gen-1',
        provider: 'OPENAI',
        model: 'gpt-4o',
        content: 'Generated content',
        tokensUsed: 140,
        latencyMs: 1300,
        error: null,
        createdAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Write content',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        sourceMap: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Write content',
          contentType: 'blog_post',
          lengthPref: 'medium',
          selectedModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
          references: [],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.outputs).toHaveLength(1);
      // Should not call fetchMultipleUrls for empty references
      expect(fetchMultipleUrls).not.toHaveBeenCalled();
    });

    it('should handle provider failures gracefully', async () => {
      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue([
        {
          id: 'key-1',
          provider: 'OPENAI',
          encryptedKey: 'encrypted-key',
          isValid: true,
          validModels: '["gpt-4o"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(prisma.generation.create).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Write content',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'GENERATING',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Provider throws error
      vi.mocked(generateWithOpenAI).mockRejectedValue(new Error('Service unavailable'));

      vi.mocked(prisma.generationOutput.create).mockResolvedValue({
        id: 'output-1',
        generationId: 'gen-1',
        provider: 'OPENAI',
        model: 'gpt-4o',
        content: '',
        tokensUsed: 0,
        latencyMs: 100,
        error: 'Service unavailable',
        createdAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Write content',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Write content',
          contentType: 'blog_post',
          lengthPref: 'medium',
          selectedModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // When ALL providers fail, status should be 500
      expect(response.status).toBe(500);
      expect(data.error).toBe('All generation attempts failed');
    });

    it('should handle style profile with valid JSON but empty arrays', async () => {
      vi.mocked(prisma.styleProfile.findFirst).mockResolvedValue({
        id: 'style-1',
        tone: 'Casual',
        voice: 'First person',
        pacing: 'Fast',
        sentenceVariety: 'Mixed',
        vocabulary: 'Simple',
        idioms: '[]',
        transitions: '[]',
        openings: '[]',
        closings: '[]',
        writingQuirks: '{}',
        avoidPatterns: '[]',
        bio: null,
        context: null,
        sampleExcerpts: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue([
        {
          id: 'key-1',
          provider: 'OPENAI',
          encryptedKey: 'encrypted-key',
          isValid: true,
          validModels: '["gpt-4o"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(prisma.generation.create).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Write a post',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: expect.any(String),
        status: 'GENERATING',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'Generated content',
        tokensUsed: 170,
      });

      vi.mocked(prisma.generationOutput.create).mockResolvedValue({
        id: 'output-1',
        generationId: 'gen-1',
        provider: 'OPENAI',
        model: 'gpt-4o',
        content: 'Generated content',
        tokensUsed: 170,
        latencyMs: 1500,
        error: null,
        createdAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'Write a post',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: expect.any(String),
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Write a post',
          contentType: 'blog_post',
          lengthPref: 'medium',
          selectedModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should succeed despite empty arrays in style profile
      expect(response.status).toBe(200);
      expect(data.outputs).toHaveLength(1);
    });
  });
});
