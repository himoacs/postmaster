/**
 * Tests for /api/synthesize - Combine multiple outputs into one
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/synthesize/route';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { generateWithOpenAI } from '@/lib/ai/openai';
import { generateWithLiteLLM } from '@/lib/ai/litellm';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    aPIKey: {
      findUnique: vi.fn(),
    },
    liteLLMConfig: {
      findFirst: vi.fn(),
    },
    synthesizedContent: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    synthesisVersion: {
      upsert: vi.fn(),
    },
    synthesisContribution: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    generation: {
      findUnique: vi.fn(),
      update: vi.fn(),
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

vi.mock('@/lib/ai/litellm', () => ({
  generateWithLiteLLM: vi.fn(),
}));

describe('API: /api/synthesize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/synthesize', () => {
    it('should synthesize multiple outputs with basic strategy', async () => {
      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-key',
        isValid: true,
        validModels: '["gpt-4o"]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: JSON.stringify({
          content: 'Synthesized content combining both drafts',
          reasoning: {
            summary: 'Combined best elements from both drafts',
            decisions: [
              {
                aspect: 'Opening',
                from: { provider: 'OPENAI', model: 'gpt-4o' },
                choice: 'Used draft 1 opening',
                rationale: 'More engaging',
              },
            ],
          },
        }),
        tokensUsed: 300,
      });

      vi.mocked(prisma.synthesizedContent.upsert).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Synthesized content combining both drafts',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: JSON.stringify({ summary: 'Combined best elements from both drafts' }),
        parentSynthesisId: null,
        globalVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft 1 content',
              tokensUsed: 150,
              latencyMs: 1500,
            },
            {
              provider: 'ANTHROPIC',
              model: 'claude-3-5-sonnet-20241022',
              content: 'Draft 2 content',
              tokensUsed: 160,
              latencyMs: 1600,
            },
          ],
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
          strategy: 'basic',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBe('Synthesized content combining both drafts');
      expect(data.synthesisId).toBe('synth-1');
      expect(generateWithOpenAI).toHaveBeenCalled();
    });

    it('should use sequential strategy with critiques', async () => {
      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-key',
        isValid: true,
        validModels: '["gpt-4o"]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: JSON.stringify({
          content: 'Synthesized with critique insights',
          reasoning: {
            summary: 'Addressed critique feedback',
            decisions: [],
          },
        }),
        tokensUsed: 350,
      });

      vi.mocked(prisma.synthesizedContent.upsert).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Synthesized with critique insights',
        strategy: 'sequential',
        version: 1,
        feedback: null,
        reasoning: JSON.stringify({ summary: 'Addressed critique feedback' }),
        parentSynthesisId: null,
        globalVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft 1',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
          strategy: 'sequential',
          critiques: [
            {
              fromProvider: 'ANTHROPIC',
              fromModel: 'claude-3-5-sonnet-20241022',
              targetDrafts: [],
              consensusPoints: ['Point 1'],
              overallRating: 8,
            },
          ],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      // Should use sequential-specific system prompt
      expect(generateWithOpenAI).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.stringContaining('informed by critical analysis'),
        expect.any(String)
      );
    });

    it('should return 400 when required fields missing', async () => {
      const request = new NextRequest('http://localhost/api/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          // Missing outputs and primaryModel
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
    });

    it('should return 400 when API key not available', async () => {
      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-key',
        isValid: false, // Invalid key
        validModels: '[]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('API key not available for synthesis');
    });

    it('should fallback to LiteLLM when primary model fails', async () => {
      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-key',
        isValid: true,
        validModels: '["gpt-4o"]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Primary model fails
      vi.mocked(generateWithOpenAI).mockRejectedValue(new Error('Rate limit exceeded'));

      // LiteLLM configured
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

      // LiteLLM succeeds
      vi.mocked(generateWithLiteLLM).mockResolvedValue({
        content: JSON.stringify({
          content: 'Synthesized via LiteLLM',
          reasoning: { summary: 'Fallback synthesis', decisions: [] },
        }),
        tokensUsed: 280,
      });

      vi.mocked(prisma.synthesizedContent.upsert).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Synthesized via LiteLLM',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: JSON.stringify({ summary: 'Fallback synthesis' }),
        parentSynthesisId: null,
        globalVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBe('Synthesized via LiteLLM');
      expect(generateWithLiteLLM).toHaveBeenCalled();
    });

    it('should handle parent-child versioning', async () => {
      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-key',
        isValid: true,
        validModels: '["gpt-4o"]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: JSON.stringify({
          content: 'Child synthesis',
          reasoning: { summary: 'test', decisions: [] },
        }),
        tokensUsed: 300,
      });

      vi.mocked(prisma.synthesizedContent.findUnique).mockResolvedValue({
        id: 'parent-synth',
        generationId: 'gen-1',
        content: 'Parent',
        strategy: 'basic',
        version: 2,
        feedback: null,
        reasoning: null,
        parentSynthesisId: null,
        globalVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.synthesizedContent.upsert).mockResolvedValue({
        id: 'synth-2',
        generationId: 'gen-2',
        content: 'Child synthesis',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: JSON.stringify({ summary: 'test' }),
        parentSynthesisId: 'parent-synth',
        globalVersion: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-2',
        prompt: 'test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-2',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
          parentSynthesisId: 'parent-synth',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(prisma.synthesizedContent.findUnique).toHaveBeenCalledWith({
        where: { id: 'parent-synth' },
        select: { globalVersion: true, version: true },
      });
    });

    it('should handle legacy non-JSON response format', async () => {
      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-key',
        isValid: true,
        validModels: '["gpt-4o"]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Return plain text instead of JSON
      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'Plain text synthesis without JSON wrapper',
        tokensUsed: 250,
      });

      vi.mocked(prisma.synthesizedContent.upsert).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Plain text synthesis without JSON wrapper',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: null,
        parentSynthesisId: null,
        globalVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBe('Plain text synthesis without JSON wrapper');
    });

    it('should handle JSON wrapped in markdown code blocks', async () => {
      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-key',
        isValid: true,
        validModels: '["gpt-4o"]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: '```json\n{"content": "Synthesized", "reasoning": {"summary": "test", "decisions": []}}\n```',
        tokensUsed: 250,
      });

      vi.mocked(prisma.synthesizedContent.upsert).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Synthesized',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: JSON.stringify({ summary: 'test' }),
        parentSynthesisId: null,
        globalVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBe('Synthesized');
    });

    it('should handle LITELLM provider without API key lookup', async () => {
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

      vi.mocked(generateWithLiteLLM).mockResolvedValue({
        content: JSON.stringify({
          content: 'LiteLLM synthesis',
          reasoning: { summary: 'test', decisions: [] },
        }),
        tokensUsed: 270,
      });

      vi.mocked(prisma.synthesizedContent.upsert).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'LiteLLM synthesis',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: JSON.stringify({ summary: 'test' }),
        parentSynthesisId: null,
        globalVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          primaryModel: {
            provider: 'LITELLM',
            modelId: 'gpt-4o',
          },
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      // Should not look up API key for LITELLM
      expect(prisma.aPIKey.findUnique).not.toHaveBeenCalled();
    });

    it('should retrieve sourceMap from generation when not provided', async () => {
      vi.mocked(prisma.generation.findUnique).mockResolvedValue({
        id: 'gen-1',
        prompt: 'test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        sourceMap: JSON.stringify([
          { url: 'https://example.com', title: 'Example' },
        ]),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-key',
        isValid: true,
        validModels: '["gpt-4o"]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: JSON.stringify({
          content: 'Synthesis with citations',
          reasoning: { summary: 'Combined drafts' },
        }),
        tokensUsed: 200,
      });

      vi.mocked(prisma.synthesizedContent.upsert).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Synthesis with citations',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: JSON.stringify({ summary: 'Combined drafts' }),
        parentSynthesisId: null,
        globalVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft with [Source: Example](https://example.com)',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.generation.findUnique).toHaveBeenCalledWith({
        where: { id: 'gen-1' },
        select: { sourceMap: true },
      });
      expect(generateWithOpenAI).toHaveBeenCalledWith(
        'decrypted-api-key',
        'gpt-4o',
        expect.stringContaining('AVAILABLE CITATION SOURCES'),
        expect.stringContaining('Draft with')
      );
    });

    it('should handle sequential strategy with critiques', async () => {
      vi.mocked(prisma.generation.findUnique).mockResolvedValue({
        id: 'gen-1',
        prompt: 'test',
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

      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-key',
        isValid: true,
        validModels: '["gpt-4o"]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: JSON.stringify({
          content: 'Synthesized with critique insights',
          reasoning: {
            summary: 'Applied critique suggestions',
            decisions: [],
          },
        }),
        tokensUsed: 250,
      });

      vi.mocked(prisma.synthesizedContent.upsert).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Synthesized with critique insights',
        strategy: 'sequential',
        version: 1,
        feedback: null,
        reasoning: JSON.stringify({ summary: 'Applied critique suggestions' }),
        parentSynthesisId: null,
        globalVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft 1',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
          strategy: 'sequential',
          critiques: [
            {
              fromModel: { provider: 'ANTHROPIC', modelId: 'claude-3-5-sonnet-20241022' },
              targetDrafts: [
                {
                  targetModel: { provider: 'OPENAI', modelId: 'gpt-4o' },
                  strengths: ['Clear'],
                  weaknesses: ['Too brief'],
                  suggestions: ['Add more detail'],
                  rating: 7,
                },
              ],
              overallRating: 7,
              consensusPoints: ['Good start'],
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(generateWithOpenAI).toHaveBeenCalledWith(
        'decrypted-api-key',
        'gpt-4o',
        expect.stringContaining('informed by critical analysis'),
        expect.stringContaining('CRITICAL ANALYSIS')
      );
    });

    it('should handle starred sections', async () => {
      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-key',
        isValid: true,
        validModels: '["gpt-4o"]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: JSON.stringify({
          content: 'Synthesis with starred sections',
          reasoning: { summary: 'Used starred sections' },
        }),
        tokensUsed: 220,
      });

      vi.mocked(prisma.synthesizedContent.upsert).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Synthesis with starred sections',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: JSON.stringify({ summary: 'Used starred sections' }),
        parentSynthesisId: null,
        globalVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft 1',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
          starredSections: [
            { provider: 'OPENAI', text: 'Important section to include' },
          ],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(generateWithOpenAI).toHaveBeenCalledWith(
        'decrypted-api-key',
        'gpt-4o',
        expect.stringContaining('skilled editor'),
        expect.stringContaining('Important section to include')
      );
    });

    it('should handle JSON parsing failures with fallback', async () => {
      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-key',
        isValid: true,
        validModels: '["gpt-4o"]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Return non-JSON response (plain text)
      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'This is plain text synthesis without JSON format',
        tokensUsed: 150,
      });

      vi.mocked(prisma.synthesizedContent.upsert).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'This is plain text synthesis without JSON format',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: null,
        parentSynthesisId: null,
        globalVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should fallback to plain text when JSON parsing fails
      expect(data.content).toBe('This is plain text synthesis without JSON format');
    });

    it('should handle empty critiques array gracefully', async () => {
      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-key',
        isValid: true,
        validModels: '["gpt-4o"]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: JSON.stringify({
          content: 'Synthesized without critiques',
          reasoning: { summary: 'Basic synthesis' },
        }),
        tokensUsed: 180,
      });

      vi.mocked(prisma.synthesizedContent.upsert).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Synthesized without critiques',
        strategy: 'sequential',
        version: 1,
        feedback: null,
        reasoning: JSON.stringify({ summary: 'Basic synthesis' }),
        parentSynthesisId: null,
        globalVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
          strategy: 'sequential',
          critiques: [],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBe('Synthesized without critiques');
    });

    it('should complete synthesis even if contribution tracking fails', async () => {
      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-key',
        isValid: true,
        validModels: '["gpt-4o"]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: JSON.stringify({
          content: 'Final synthesis',
          reasoning: {
            summary: 'Combined drafts',
            decisions: [
              {
                aspect: 'Opening',
                from: { provider: 'OPENAI', model: 'gpt-4o' },
                choice: 'Selected opening',
                rationale: 'Better hook',
              },
            ],
          },
        }),
        tokensUsed: 220,
      });

      vi.mocked(prisma.synthesizedContent.upsert).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Final synthesis',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: JSON.stringify({ summary: 'Combined drafts' }),
        parentSynthesisId: null,
        globalVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock contribution tracking to fail
      vi.mocked(prisma.synthesisContribution.deleteMany).mockRejectedValue(
        new Error('Database error')
      );

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft 1',
              tokensUsed: 150,
              latencyMs: 1500,
            },
            {
              provider: 'ANTHROPIC',
              model: 'claude-3-5-sonnet-20241022',
              content: 'Draft 2',
              tokensUsed: 160,
              latencyMs: 1600,
            },
          ],
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should succeed despite contribution tracking failure
      expect(response.status).toBe(200);
      expect(data.content).toBe('Final synthesis');
    });

    it('should handle JSON response without reasoning field', async () => {
      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-key',
        isValid: true,
        validModels: '["gpt-4o"]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Return JSON without reasoning field
      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: JSON.stringify({
          content: 'Synthesis without reasoning',
        }),
        tokensUsed: 160,
      });

      vi.mocked(prisma.synthesizedContent.upsert).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Synthesis without reasoning',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: null,
        parentSynthesisId: null,
        globalVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBe('Synthesis without reasoning');
      expect(data.reasoning).toBeNull();
    });

    it('should handle JSON wrapped in triple backticks without json tag', async () => {
      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-key',
        isValid: true,
        validModels: '["gpt-4o"]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Return JSON wrapped in plain ``` blocks
      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: '```\n{"content": "Wrapped synthesis", "reasoning": {"summary": "test"}}\n```',
        tokensUsed: 170,
      });

      vi.mocked(prisma.synthesizedContent.upsert).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Wrapped synthesis',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: JSON.stringify({ summary: 'test' }),
        parentSynthesisId: null,
        globalVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBe('Wrapped synthesis');
    });

    it('should fallback to raw content when JSON has no valid content field', async () => {
      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-key',
        isValid: true,
        validModels: '["gpt-4o"]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Return JSON with empty content field - should fallback to raw
      const rawResponse = '{"content": "", "reasoning": {"summary": "test"}}';
      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: rawResponse,
        tokensUsed: 160,
      });

      vi.mocked(prisma.synthesizedContent.upsert).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: rawResponse, // Should use raw response
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: null,
        parentSynthesisId: null,
        globalVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBe(rawResponse); // Should use raw response
    });

    it('should extract JSON from response with text before and after', async () => {
      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-key',
        isValid: true,
        validModels: '["gpt-4o"]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Return JSON with text before and after
      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'Here is my synthesis:\n\n{"content": "Extracted content", "reasoning": {"summary": "test"}}\n\nHope that helps!',
        tokensUsed: 180,
      });

      vi.mocked(prisma.synthesizedContent.upsert).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Extracted content',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: JSON.stringify({ summary: 'test' }),
        parentSynthesisId: null,
        globalVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.generation.update).mockResolvedValue({
        id: 'gen-1',
        prompt: 'test',
        contentType: 'BLOG_POST',
        lengthPref: 'medium',
        styleContext: null,
        status: 'COMPLETED',
        contentMode: 'new',
        sourceContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBe('Extracted content');
    });
  });
});
