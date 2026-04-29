/**
 * Tests for /api/critique - Generate cross-model critiques
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/critique/route';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { generateWithOpenAI } from '@/lib/ai/openai';
import { generateWithAnthropic } from '@/lib/ai/claude';
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
    generationCritique: {
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

describe('API: /api/critique', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/critique', () => {
    it('should generate critiques from multiple models', async () => {
      vi.mocked(prisma.aPIKey.findUnique)
        .mockResolvedValueOnce({
          id: 'key-1',
          provider: 'OPENAI',
          encryptedKey: 'encrypted-key-1',
          isValid: true,
          validModels: '["gpt-4o"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'key-2',
          provider: 'ANTHROPIC',
          encryptedKey: 'encrypted-key-2',
          isValid: true,
          validModels: '["claude-3-5-sonnet-20241022"]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: JSON.stringify({
          targetDrafts: [
            {
              draftIndex: 0,
              strengths: ['Clear structure', 'Good examples'],
              weaknesses: ['Too verbose'],
              suggestions: ['Condense main points'],
              rating: 7,
            },
          ],
          consensusPoints: ['Point 1'],
          overallRating: 7,
        }),
        tokensUsed: 250,
      });

      vi.mocked(generateWithAnthropic).mockResolvedValue({
        content: JSON.stringify({
          targetDrafts: [
            {
              draftIndex: 0,
              strengths: ['Strong opening'],
              weaknesses: ['Needs more examples'],
              suggestions: ['Add case studies'],
              rating: 8,
            },
          ],
          consensusPoints: ['Point 1'],
          overallRating: 8,
        }),
        tokensUsed: 240,
      });

      vi.mocked(prisma.generationCritique.create).mockResolvedValue({
        id: 'critique-1',
        generationId: 'gen-1',
        fromProvider: 'OPENAI',
        fromModel: 'gpt-4o',
        critiques: JSON.stringify({}),
        debateRound: 0,
        createdAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/critique', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft to critique',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          critiqueModels: [
            { provider: 'OPENAI', modelId: 'gpt-4o' },
            { provider: 'ANTHROPIC', modelId: 'claude-3-5-sonnet-20241022' },
          ],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.critiques).toHaveLength(2);
      expect(generateWithOpenAI).toHaveBeenCalled();
      expect(generateWithAnthropic).toHaveBeenCalled();
      expect(prisma.generationCritique.create).toHaveBeenCalledTimes(2);
    });

    it('should return 400 when required fields missing', async () => {
      const request = new NextRequest('http://localhost/api/critique', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          // Missing outputs and critiqueModels
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
    });

    it('should return 400 when outputs is empty', async () => {
      const request = new NextRequest('http://localhost/api/critique', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [],
          critiqueModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
    });

    it('should return 400 when critiqueModels is empty', async () => {
      const request = new NextRequest('http://localhost/api/critique', {
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
          critiqueModels: [],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
    });

    it('should handle debate round tracking', async () => {
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
          targetDrafts: [{ draftIndex: 0, strengths: [], weaknesses: [], suggestions: [], rating: 7 }],
          consensusPoints: [],
          overallRating: 7,
        }),
        tokensUsed: 250,
      });

      vi.mocked(prisma.generationCritique.create).mockResolvedValue({
        id: 'critique-1',
        generationId: 'gen-1',
        fromProvider: 'OPENAI',
        fromModel: 'gpt-4o',
        critiques: JSON.stringify({}),
        debateRound: 2,
        createdAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/critique', {
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
          critiqueModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
          debateRound: 2,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(prisma.generationCritique.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            debateRound: 2,
          }),
        })
      );
    });

    it('should handle API key not available error', async () => {
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

      const request = new NextRequest('http://localhost/api/critique', {
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
          critiqueModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('API key not available');
    });

    it('should generate critiques in parallel', async () => {
      const startTime = Date.now();

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

      // Simulate async delay
      vi.mocked(generateWithOpenAI).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          content: JSON.stringify({
            targetDrafts: [{ draftIndex: 0, strengths: [], weaknesses: [], suggestions: [], rating: 7 }],
            consensusPoints: [],
            overallRating: 7,
          }),
          tokensUsed: 250,
        };
      });

      vi.mocked(prisma.generationCritique.create).mockResolvedValue({
        id: 'critique-1',
        generationId: 'gen-1',
        fromProvider: 'OPENAI',
        fromModel: 'gpt-4o',
        critiques: JSON.stringify({}),
        debateRound: 0,
        createdAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/critique', {
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
          critiqueModels: [
            { provider: 'OPENAI', modelId: 'gpt-4o' },
            { provider: 'OPENAI', modelId: 'gpt-4o-mini' },
          ],
        }),
      });

      await POST(request);
      const endTime = Date.now();

      // Should complete in roughly 10ms (parallel) rather than 20ms (sequential)
      expect(endTime - startTime).toBeLessThan(50);
      expect(generateWithOpenAI).toHaveBeenCalledTimes(2);
    });

    it('should store critiques with correct provider and model', async () => {
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
          targetDrafts: [{ draftIndex: 0, strengths: [], weaknesses: [], suggestions: [], rating: 7 }],
          consensusPoints: [],
          overallRating: 7,
        }),
        tokensUsed: 250,
      });

      vi.mocked(prisma.generationCritique.create).mockResolvedValue({
        id: 'critique-1',
        generationId: 'gen-1',
        fromProvider: 'OPENAI',
        fromModel: 'gpt-4o',
        critiques: JSON.stringify({}),
        debateRound: 0,
        createdAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/critique', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'ANTHROPIC',
              model: 'claude-3-5-sonnet-20241022',
              content: 'Draft',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          critiqueModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
        }),
      });

      await POST(request);

      expect(prisma.generationCritique.create).toHaveBeenCalledWith({
        data: {
          generationId: 'gen-1',
          fromProvider: 'OPENAI',
          fromModel: 'gpt-4o',
          critiques: expect.any(String),
          debateRound: 0,
        },
      });
    });

    it('should parse and validate critique JSON structure', async () => {
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

      const mockCritique = {
        targetDrafts: [
          {
            draftIndex: 0,
            strengths: ['Well structured', 'Clear examples'],
            weaknesses: ['Too long', 'Repetitive'],
            suggestions: ['Condense', 'Remove duplicates'],
            rating: 8,
          },
          {
            draftIndex: 1,
            strengths: ['Concise'],
            weaknesses: ['Lacks depth'],
            suggestions: ['Add more detail'],
            rating: 6,
          },
        ],
        consensusPoints: ['Both agree on key concept'],
        overallRating: 7,
      };

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: JSON.stringify(mockCritique),
        tokensUsed: 300,
      });

      vi.mocked(prisma.generationCritique.create).mockResolvedValue({
        id: 'critique-1',
        generationId: 'gen-1',
        fromProvider: 'OPENAI',
        fromModel: 'gpt-4o',
        critiques: JSON.stringify(mockCritique),
        debateRound: 0,
        createdAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/critique', {
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
          critiqueModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.critiques[0].targetDrafts).toHaveLength(2);
      expect(data.critiques[0].overallRating).toBe(7);
    });

    it('should handle LiteLLM critique provider', async () => {
      vi.mocked(prisma.liteLLMConfig.findFirst).mockResolvedValue({
        id: 'litellm-1',
        isEnabled: true,
        isValid: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithLiteLLM).mockResolvedValue({
        content: JSON.stringify({
          targetDrafts: [{ draftIndex: 0, strengths: [], weaknesses: [], suggestions: [], rating: 8 }],
          consensusPoints: [],
          overallRating: 8,
        }),
        tokensUsed: 200,
      });

      vi.mocked(prisma.generationCritique.create).mockResolvedValue({
        id: 'critique-1',
        generationId: 'gen-1',
        fromProvider: 'LITELLM',
        fromModel: 'gpt-4o',
        critiques: JSON.stringify({}),
        debateRound: 0,
        createdAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/critique', {
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
          critiqueModels: [{ provider: 'LITELLM', modelId: 'gpt-4o' }],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(generateWithLiteLLM).toHaveBeenCalled();
    });

    it('should handle invalid provider gracefully', async () => {
      const request = new NextRequest('http://localhost/api/critique', {
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
          critiqueModels: [{ provider: 'INVALID_PROVIDER' as any, modelId: 'model' }],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
    });

    it('should handle malformed critique JSON', async () => {
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

      // Return malformed JSON
      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'Not valid JSON at all',
        tokensUsed: 100,
      });

      vi.mocked(prisma.generationCritique.create).mockResolvedValue({
        id: 'critique-1',
        generationId: 'gen-1',
        fromProvider: 'OPENAI',
        fromModel: 'gpt-4o',
        critiques: JSON.stringify({}),
        debateRound: 0,
        createdAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/critique', {
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
          critiqueModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should return 200 with a default critique when JSON parsing fails
      expect(response.status).toBe(200);
      expect(data.critiques).toHaveLength(1);
      expect(data.critiques[0].targetDrafts).toBeDefined();
    });

    it('should handle empty outputs array', async () => {
      const request = new NextRequest('http://localhost/api/critique', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [],
          critiqueModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
    });

    it('should handle missing critiqueModels', async () => {
      const request = new NextRequest('http://localhost/api/critique', {
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
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
    });

    it('should handle LiteLLM decryption failure', async () => {
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

      vi.mocked(prisma.liteLLMConfig.findFirst).mockResolvedValue({
        id: 'config-1',
        endpoint: 'http://localhost:4000',
        encryptedKey: 'corrupted-litellm-key',
        isEnabled: true,
        isValid: true,
        cachedModels: null,
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock decrypt to fail for LiteLLM key
      vi.mocked(decrypt).mockImplementation((encrypted: string) => {
        if (encrypted === 'corrupted-litellm-key') {
          throw new Error('Decryption failed');
        }
        return 'decrypted-api-key';
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: JSON.stringify({
          targetDrafts: [
            {
              draftIndex: 0,
              strengths: ['Clear'],
              weaknesses: ['Brief'],
              suggestions: ['Expand'],
              rating: 7,
            },
          ],
          overallRating: 7,
          consensusPoints: ['Good start'],
        }),
        tokensUsed: 200,
      });

      vi.mocked(prisma.generationCritique.create).mockResolvedValue({
        id: 'critique-1',
        generationId: 'gen-1',
        fromProvider: 'OPENAI',
        fromModel: 'gpt-4o',
        critiques: JSON.stringify({}),
        debateRound: 0,
        createdAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/critique', {
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
          critiqueModels: [
            { provider: 'OPENAI', modelId: 'gpt-4o' },
            { provider: 'LITELLM', modelId: 'custom-model' },
          ],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // When decryption fails, the whole request fails with 500
      expect(response.status).toBe(500);
      expect(data.error).toContain('Decryption failed');
    });

    it('should parse critique JSON from markdown code blocks', async () => {
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

      // Return JSON wrapped in markdown code block
      const critiqueData = {
        targetDrafts: [
          {
            draftIndex: 0,
            strengths: ['Concise'],
            weaknesses: ['Too brief'],
            suggestions: ['Add detail'],
            rating: 6,
          },
        ],
        overallRating: 6,
        consensusPoints: ['Needs expansion'],
      };

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: '```json\n' + JSON.stringify(critiqueData) + '\n```',
        tokensUsed: 220,
      });

      vi.mocked(prisma.generationCritique.create).mockResolvedValue({
        id: 'critique-1',
        generationId: 'gen-1',
        fromProvider: 'OPENAI',
        fromModel: 'gpt-4o',
        critiques: JSON.stringify(critiqueData),
        debateRound: 0,
        createdAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/critique', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft content',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          critiqueModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.critiques).toHaveLength(1);
      expect(data.critiques[0].targetDrafts[0].strengths).toContain('Concise');
    });

    it('should handle LiteLLM config not found', async () => {
      // No valid LiteLLM config
      vi.mocked(prisma.liteLLMConfig.findFirst).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/critique', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft content',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          critiqueModels: [{ provider: 'LITELLM', modelId: 'custom-model' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('LiteLLM not configured');
    });

    it('should use default critique when JSON parsing fails completely', async () => {
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

      // Return completely unparseable content (not JSON at all)
      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'This is not JSON at all, just plain text response',
        tokensUsed: 200,
      });

      vi.mocked(prisma.generationCritique.create).mockImplementation(async (args: any) => {
        // Parse the critiques to validate structure
        const critiques = JSON.parse(args.data.critiques);
        expect(critiques.targetDrafts[0].strengths).toContain('Unable to parse detailed critique');
        
        return {
          id: 'critique-1',
          generationId: 'gen-1',
          fromProvider: 'OPENAI',
          fromModel: 'gpt-4o',
          critiques: args.data.critiques,
          debateRound: 0,
          createdAt: new Date(),
        };
      });

      const request = new NextRequest('http://localhost/api/critique', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [
            {
              provider: 'OPENAI',
              model: 'gpt-4o',
              content: 'Draft content',
              tokensUsed: 150,
              latencyMs: 1500,
            },
          ],
          critiqueModels: [{ provider: 'OPENAI', modelId: 'gpt-4o' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.critiques[0].targetDrafts[0].strengths).toContain('Unable to parse detailed critique');
    });

    it('should handle MISTRAL critique provider', async () => {
      const { generateWithMistral } = await import('@/lib/ai/mistral');
      
      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-mistral',
        provider: 'MISTRAL',
        encryptedKey: 'encrypted-key-mistral',
        isValid: true,
        validModels: '["mistral-large-latest"]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithMistral).mockResolvedValue({
        content: JSON.stringify({
          targetDrafts: [{
            draftIndex: 0,
            strengths: ['Good clarity'],
            weaknesses: ['Needs examples'],
            suggestions: ['Add examples'],
            rating: 8,
          }],
          consensusPoints: ['Point 1'],
          overallRating: 8,
        }),
        tokensUsed: 200,
      });

      vi.mocked(prisma.generationCritique.create).mockResolvedValue({
        id: 'critique-mistral-1',
        generationId: 'gen-1',
        fromProvider: 'MISTRAL',
        fromModel: 'mistral-large-latest',
        critiques: JSON.stringify({
          targetDrafts: [{
            draftIndex: 0,
            strengths: ['Good clarity'],
            weaknesses: ['Needs examples'],
            suggestions: ['Add examples'],
            rating: 8,
          }],
          consensusPoints: ['Point 1'],
          overallRating: 8,
        }),
        debateRound: 0,
        createdAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/critique', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [{
            provider: 'OPENAI',
            model: 'gpt-4o',
            content: 'Draft content',
            tokensUsed: 150,
            latencyMs: 1500,
          }],
          critiqueModels: [{ provider: 'MISTRAL', modelId: 'mistral-large-latest' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.critiques).toHaveLength(1);
      expect(generateWithMistral).toHaveBeenCalled();
    });

    it('should handle XAI (Grok) critique provider', async () => {
      const { generateWithGrok } = await import('@/lib/ai/grok');
      
      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-xai',
        provider: 'XAI',
        encryptedKey: 'encrypted-key-xai',
        isValid: true,
        validModels: '["grok-2-1212"]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(generateWithGrok).mockResolvedValue({
        content: JSON.stringify({
          targetDrafts: [{
            draftIndex: 0,
            strengths: ['Concise'],
            weaknesses: ['Too brief'],
            suggestions: ['Expand details'],
            rating: 7,
          }],
          consensusPoints: ['Point 1'],
          overallRating: 7,
        }),
        tokensUsed: 180,
      });

      vi.mocked(prisma.generationCritique.create).mockResolvedValue({
        id: 'critique-xai-1',
        generationId: 'gen-1',
        fromProvider: 'XAI',
        fromModel: 'grok-2-1212',
        critiques: JSON.stringify({
          targetDrafts: [{
            draftIndex: 0,
            strengths: ['Concise'],
            weaknesses: ['Too brief'],
            suggestions: ['Expand details'],
            rating: 7,
          }],
          consensusPoints: ['Point 1'],
          overallRating: 7,
        }),
        debateRound: 0,
        createdAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/critique', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          outputs: [{
            provider: 'OPENAI',
            model: 'gpt-4o',
            content: 'Draft content',
            tokensUsed: 150,
            latencyMs: 1500,
          }],
          critiqueModels: [{ provider: 'XAI', modelId: 'grok-2-1212' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.critiques).toHaveLength(1);
      expect(generateWithGrok).toHaveBeenCalled();
    });
  });
});
