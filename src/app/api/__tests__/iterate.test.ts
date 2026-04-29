/**
 * Tests for /api/iterate - Content iteration with feedback
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/iterate/route';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { generateWithOpenAI } from '@/lib/ai/openai';
import { generateWithLiteLLM } from '@/lib/ai/litellm';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    userPreferences: {
      findFirst: vi.fn(),
    },
    aPIKey: {
      findUnique: vi.fn(),
    },
    liteLLMConfig: {
      findFirst: vi.fn(),
    },
    synthesizedContent: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    synthesisVersion: {
      create: vi.fn(),
      upsert: vi.fn(),
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

describe('API: /api/iterate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/iterate', () => {
    it('should iterate content successfully with provided primary model', async () => {
      // Mock API key
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

      // Mock synthesis content
      vi.mocked(prisma.synthesizedContent.findUnique).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Original content',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentSynthesisId: null,
        globalVersion: 1,
        imageUrl: null,
        imagePrompt: null,
      });

      // Mock AI generation
      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'Refined content based on feedback',
        tokensUsed: 150,
      });

      vi.mocked(prisma.synthesisVersion.upsert).mockResolvedValue({
        id: 'version-1',
        synthesizedContentId: 'synth-1',
        version: 1,
        content: 'Original content',
        feedback: 'Make it shorter',
        createdAt: new Date(),
      });

      vi.mocked(prisma.synthesizedContent.update).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Refined content based on feedback',
        strategy: 'basic',
        version: 2,
        feedback: '["Make it shorter"]',
        reasoning: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentSynthesisId: null,
        globalVersion: 1,
        imageUrl: null,
        imagePrompt: null,
      });

      const request = new NextRequest('http://localhost/api/iterate', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          currentContent: 'Original content',
          feedback: 'Make it shorter',
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBe('Refined content based on feedback');
      expect(generateWithOpenAI).toHaveBeenCalledWith(
        'decrypted-api-key',
        'gpt-4o',
        expect.stringContaining('skilled editor'),
        expect.stringContaining('Make it shorter')
      );
    });

    it('should use user preferences when no primary model provided', async () => {
      // Mock user preferences
      vi.mocked(prisma.userPreferences.findFirst).mockResolvedValue({
        id: 'pref-1',
        synthesisStrategy: 'basic',
        debateMaxRounds: 3,
        showCritiqueDetails: true,
        primaryModelProvider: 'OPENAI',
        primaryModelId: 'gpt-4o',
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

      vi.mocked(prisma.synthesizedContent.findUnique).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Original content',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentSynthesisId: null,
        globalVersion: 1,
        imageUrl: null,
        imagePrompt: null,
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'Refined content',
        tokensUsed: 150,
      });

      vi.mocked(prisma.synthesizedContent.update).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Refined content',
        strategy: 'basic',
        version: 2,
        feedback: '["feedback"]',
        reasoning: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentSynthesisId: null,
        globalVersion: 1,
        imageUrl: null,
        imagePrompt: null,
      });

      const request = new NextRequest('http://localhost/api/iterate', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          currentContent: 'Original content',
          feedback: 'feedback',
          // No primaryModel provided
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(prisma.userPreferences.findFirst).toHaveBeenCalled();
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

      vi.mocked(prisma.synthesizedContent.findUnique).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Original content',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentSynthesisId: null,
        globalVersion: 1,
        imageUrl: null,
        imagePrompt: null,
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
        content: 'Refined via LiteLLM',
        tokensUsed: 150,
      });

      vi.mocked(prisma.synthesizedContent.update).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Refined via LiteLLM',
        strategy: 'basic',
        version: 2,
        feedback: '["feedback"]',
        reasoning: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentSynthesisId: null,
        globalVersion: 1,
        imageUrl: null,
        imagePrompt: null,
      });

      const request = new NextRequest('http://localhost/api/iterate', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          currentContent: 'Original content',
          feedback: 'feedback',
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBe('Refined via LiteLLM');
      expect(generateWithLiteLLM).toHaveBeenCalled();
    });

    it('should return 400 for missing required fields', async () => {
      const request = new NextRequest('http://localhost/api/iterate', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          // Missing currentContent and feedback
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
    });

    it('should return 400 when no model is available', async () => {
      // No preferences
      vi.mocked(prisma.userPreferences.findFirst).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/iterate', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          currentContent: 'content',
          feedback: 'feedback',
          // No primaryModel, no selectedModels
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No model available');
    });

    it('should return 400 when API key is not available', async () => {
      // API key not valid
      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-key',
        isValid: false, // Invalid
        validModels: '[]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/iterate', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          currentContent: 'content',
          feedback: 'feedback',
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('API key not available');
    });

    it('should return 404 when generation not found', async () => {
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

      // No synthesis found
      vi.mocked(prisma.synthesizedContent.findUnique).mockResolvedValue(null);

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'Refined content',
        tokensUsed: 150,
      });

      const request = new NextRequest('http://localhost/api/iterate', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          currentContent: 'content',
          feedback: 'feedback',
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('No synthesized content found to iterate');
    });

    it('should handle LiteLLM provider without API key', async () => {
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

      vi.mocked(prisma.synthesizedContent.findUnique).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Original content',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentSynthesisId: null,
        globalVersion: 1,
        imageUrl: null,
        imagePrompt: null,
      });

      vi.mocked(generateWithLiteLLM).mockResolvedValue({
        content: 'Refined via LiteLLM',
        tokensUsed: 150,
      });

      vi.mocked(prisma.synthesizedContent.update).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Refined via LiteLLM',
        strategy: 'basic',
        version: 2,
        feedback: '["feedback"]',
        reasoning: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentSynthesisId: null,
        globalVersion: 1,
        imageUrl: null,
        imagePrompt: null,
      });

      const request = new NextRequest('http://localhost/api/iterate', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          currentContent: 'content',
          feedback: 'feedback',
          primaryModel: {
            provider: 'LITELLM',
            modelId: 'gpt-4o',
          },
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      // Should not call aPIKey.findUnique for LITELLM
      expect(prisma.aPIKey.findUnique).not.toHaveBeenCalled();
    });

    it('should preserve citations in system prompt', async () => {
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

      vi.mocked(prisma.synthesizedContent.findUnique).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Original content',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentSynthesisId: null,
        globalVersion: 1,
        imageUrl: null,
        imagePrompt: null,
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'Refined content',
        tokensUsed: 150,
      });

      vi.mocked(prisma.synthesizedContent.update).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Refined content',
        strategy: 'basic',
        version: 2,
        feedback: '["feedback"]',
        reasoning: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentSynthesisId: null,
        globalVersion: 1,
        imageUrl: null,
        imagePrompt: null,
      });

      const request = new NextRequest('http://localhost/api/iterate', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          currentContent: 'content',
          feedback: 'feedback',
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
        }),
      });

      await POST(request);

      // Verify system prompt includes citation preservation instruction
      expect(generateWithOpenAI).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.stringContaining('preserve all source citations'),
        expect.any(String)
      );
    });

    it('should handle LiteLLM provider', async () => {
      vi.mocked(prisma.liteLLMConfig.findFirst).mockResolvedValue({
        id: 'config-1',
        endpoint: 'http://localhost:4000',
        encryptedKey: 'encrypted-litellm-key',
        isEnabled: true,
        isValid: true,
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.synthesizedContent.findUnique).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Original content',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentSynthesisId: null,
        globalVersion: 1,
        imageUrl: null,
        imagePrompt: null,
      });

      vi.mocked(generateWithLiteLLM).mockResolvedValue({
        content: 'LiteLLM refined content',
        tokensUsed: 120,
      });

      vi.mocked(prisma.synthesizedContent.update).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'LiteLLM refined content',
        strategy: 'basic',
        version: 2,
        feedback: '["feedback"]',
        reasoning: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentSynthesisId: null,
        globalVersion: 1,
        imageUrl: null,
        imagePrompt: null,
      });

      const request = new NextRequest('http://localhost/api/iterate', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          currentContent: 'Original content',
          feedback: 'Make it better',
          primaryModel: {
            provider: 'LITELLM',
            modelId: 'custom-model',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBe('LiteLLM refined content');
      expect(generateWithLiteLLM).toHaveBeenCalled();
      expect(prisma.aPIKey.findUnique).not.toHaveBeenCalled();
    });

    it('should return 400 when LiteLLM not configured', async () => {
      vi.mocked(prisma.liteLLMConfig.findFirst).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/iterate', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          currentContent: 'content',
          feedback: 'feedback',
          primaryModel: {
            provider: 'LITELLM',
            modelId: 'custom-model',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('LiteLLM');
    });

    it('should use legacy selectedModels fallback', async () => {
      vi.mocked(prisma.userPreferences.findFirst).mockResolvedValue(null);

      vi.mocked(prisma.aPIKey.findUnique).mockResolvedValue({
        id: 'key-1',
        provider: 'ANTHROPIC',
        encryptedKey: 'encrypted-key',
        isValid: true,
        validModels: '["claude-3-5-sonnet-20241022"]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.synthesizedContent.findUnique).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Original content',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentSynthesisId: null,
        globalVersion: 1,
        imageUrl: null,
        imagePrompt: null,
      });

      const { generateWithAnthropic } = await import('@/lib/ai/claude');
      vi.mocked(generateWithAnthropic).mockResolvedValue({
        content: 'Anthropic refined content',
        tokensUsed: 130,
      });

      vi.mocked(prisma.synthesizedContent.update).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Anthropic refined content',
        strategy: 'basic',
        version: 2,
        feedback: '["feedback"]',
        reasoning: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentSynthesisId: null,
        globalVersion: 1,
        imageUrl: null,
        imagePrompt: null,
      });

      const request = new NextRequest('http://localhost/api/iterate', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          currentContent: 'Original content',
          feedback: 'Improve this',
          selectedModels: [
            { provider: 'ANTHROPIC', modelId: 'claude-3-5-sonnet-20241022' },
          ],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBe('Anthropic refined content');
    });

    it('should return 400 when no model available', async () => {
      vi.mocked(prisma.userPreferences.findFirst).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/iterate', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          currentContent: 'content',
          feedback: 'feedback',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No model available');
    });

    it('should handle provider errors with meaningful message', async () => {
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

      vi.mocked(prisma.synthesizedContent.findUnique).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Original content',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: null,
        parentSynthesisId: null,
        globalVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentSynthesisId: null,
        globalVersion: 1,
        imageUrl: null,
        imagePrompt: null,
      });

      // Mock provider to throw error
      vi.mocked(generateWithOpenAI).mockRejectedValue(new Error('Rate limit exceeded'));

      const request = new NextRequest('http://localhost/api/iterate', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          currentContent: 'Original content',
          feedback: 'Make it better',
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Rate limit exceeded');
    });

    it('should handle empty feedback gracefully', async () => {
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

      vi.mocked(prisma.synthesizedContent.findUnique).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Original content',
        strategy: 'basic',
        version: 1,
        feedback: null,
        reasoning: null,
        parentSynthesisId: null,
        globalVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentSynthesisId: null,
        globalVersion: 1,
        imageUrl: null,
        imagePrompt: null,
      });

      vi.mocked(generateWithOpenAI).mockResolvedValue({
        content: 'Slightly refined content',
        tokensUsed: 50,
      });

      vi.mocked(prisma.synthesisVersion.upsert).mockResolvedValue({
        id: 'version-1',
        synthesizedContentId: 'synth-1',
        version: 1,
        content: 'Original content',
        feedback: '',
        createdAt: new Date(),
      });

      vi.mocked(prisma.synthesizedContent.update).mockResolvedValue({
        id: 'synth-1',
        generationId: 'gen-1',
        content: 'Slightly refined content',
        strategy: 'basic',
        version: 2,
        feedback: '[""]',
        reasoning: null,
        parentSynthesisId: null,
        globalVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentSynthesisId: null,
        globalVersion: 1,
        imageUrl: null,
        imagePrompt: null,
      });

      const request = new NextRequest('http://localhost/api/iterate', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'gen-1',
          currentContent: 'Original content',
          feedback: '   ',
          primaryModel: {
            provider: 'OPENAI',
            modelId: 'gpt-4o',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should handle empty/whitespace feedback gracefully
      expect(response.status).toBe(200);
      expect(generateWithOpenAI).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.stringContaining('   ')
      );
    });
  });
});
