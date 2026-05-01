/**
 * Tests for /api/keys - API key management
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from '@/app/api/keys/route';
import { prisma } from '@/lib/db';
import { encrypt, decrypt, maskApiKey } from '@/lib/encryption';
import { validateOpenAIKey } from '@/lib/ai/openai';
import { validateAnthropicKey } from '@/lib/ai/claude';
import { validateMistralKey } from '@/lib/ai/mistral';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    aPIKey: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((text: string) => `encrypted-${text}`),
  decrypt: vi.fn((encrypted: string) => encrypted.replace('encrypted-', '')),
  maskApiKey: vi.fn((key: string) => `${key.slice(0, 4)}****${key.slice(-4)}`),
}));

vi.mock('@/lib/ai/openai', () => ({
  validateOpenAIKey: vi.fn(),
}));

vi.mock('@/lib/ai/claude', () => ({
  validateAnthropicKey: vi.fn(),
}));

vi.mock('@/lib/ai/mistral', () => ({
  validateMistralKey: vi.fn(),
}));

vi.mock('@/lib/ai/grok', () => ({
  validateGrokKey: vi.fn(),
}));

vi.mock('@/lib/ai/stability', () => ({
  validateStabilityKey: vi.fn(),
}));

describe('API: /api/keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/keys', () => {
    it('should return all API keys with masked values', async () => {
      const mockKeys = [
        {
          provider: 'OPENAI',
          encryptedKey: 'encrypted-sk-openai-key',
          isValid: true,
          validModels: '["gpt-4o", "gpt-4o-mini"]',
          enabledModels: '[]',
          lastValidated: new Date('2026-04-28'),
        },
        {
          provider: 'ANTHROPIC',
          encryptedKey: 'encrypted-sk-ant-key',
          isValid: true,
          validModels: '["claude-3-5-sonnet-20241022"]',
          enabledModels: '[]',
          lastValidated: new Date('2026-04-28'),
        },
      ];

      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue(mockKeys as any);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.keys).toHaveLength(2);
      expect(data.keys[0].provider).toBe('OPENAI');
      expect(data.keys[0].maskedKey).toBe('sk-o****-key');
      expect(data.keys[0].isValid).toBe(true);
      expect(data.keys[0].validModels).toEqual(['gpt-4o', 'gpt-4o-mini']);
      expect(data.keys[0].lastValidated).toBeDefined();
      expect(decrypt).toHaveBeenCalledTimes(2);
      expect(maskApiKey).toHaveBeenCalledTimes(2);
    });

    it('should return empty array when no keys exist', async () => {
      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.keys).toEqual([]);
    });

    it('should parse validModels JSON correctly', async () => {
      const mockKeys = [
        {
          provider: 'OPENAI',
          encryptedKey: 'encrypted-key',
          isValid: true,
          validModels: '["model1", "model2", "model3"]',
          enabledModels: '[]',
          lastValidated: new Date(),
        },
      ];

      vi.mocked(prisma.aPIKey.findMany).mockResolvedValue(mockKeys as any);

      const response = await GET();
      const data = await response.json();

      expect(data.keys[0].validModels).toEqual(['model1', 'model2', 'model3']);
    });
  });

  describe('POST /api/keys', () => {
    it('should save a valid OpenAI key', async () => {
      const mockValidation = {
        valid: true,
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
      };

      vi.mocked(validateOpenAIKey).mockResolvedValue(mockValidation);

      vi.mocked(prisma.aPIKey.upsert).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-sk-openai-key',
        isValid: true,
        validModels: JSON.stringify(mockValidation.models),
          enabledModels: '[]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/keys', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'OPENAI',
          key: 'sk-openai-key',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.valid).toBe(true);
      expect(data.models).toEqual(mockValidation.models);
      
      expect(encrypt).toHaveBeenCalledWith('sk-openai-key');
      expect(validateOpenAIKey).toHaveBeenCalledWith('sk-openai-key');
      expect(prisma.aPIKey.upsert).toHaveBeenCalledWith({
        where: { provider: 'OPENAI' },
        update: {
          encryptedKey: 'encrypted-sk-openai-key',
          isValid: true,
          validModels: JSON.stringify(mockValidation.models),
          enabledModels: '[]',
          lastValidated: expect.any(Date),
        },
        create: {
          provider: 'OPENAI',
          encryptedKey: 'encrypted-sk-openai-key',
          isValid: true,
          validModels: JSON.stringify(mockValidation.models),
          enabledModels: '[]',
          lastValidated: expect.any(Date),
        },
      });
    });

    it('should save an invalid key with validation failure', async () => {
      const mockValidation = {
        valid: false,
        error: 'Invalid API key format',
      };

      vi.mocked(validateOpenAIKey).mockResolvedValue(mockValidation);

      vi.mocked(prisma.aPIKey.upsert).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-invalid-key',
        isValid: false,
        validModels: '[]',
          enabledModels: '[]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/keys', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'OPENAI',
          key: 'invalid-key',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.valid).toBe(false);
      expect(data.models).toBeUndefined();
    });

    it('should update existing key when provider already exists', async () => {
      const mockValidation = {
        valid: true,
        models: ['gpt-4o'],
      };

      vi.mocked(validateOpenAIKey).mockResolvedValue(mockValidation);

      vi.mocked(prisma.aPIKey.upsert).mockResolvedValue({
        id: 'existing-key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-new-key',
        isValid: true,
        validModels: JSON.stringify(mockValidation.models),
          enabledModels: '[]',
        lastValidated: new Date(),
        createdAt: new Date('2026-04-01'),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/keys', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'OPENAI',
          key: 'new-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      
      // Should use upsert which updates existing or creates new
      expect(prisma.aPIKey.upsert).toHaveBeenCalled();
    });

    it('should validate Anthropic keys', async () => {
      const mockValidation = {
        valid: true,
        models: ['claude-3-5-sonnet-20241022'],
      };

      vi.mocked(validateAnthropicKey).mockResolvedValue(mockValidation);

      vi.mocked(prisma.aPIKey.upsert).mockResolvedValue({
        id: 'key-1',
        provider: 'ANTHROPIC',
        encryptedKey: 'encrypted-key',
        isValid: true,
        validModels: JSON.stringify(mockValidation.models),
          enabledModels: '[]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/keys', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'ANTHROPIC',
          key: 'sk-ant-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(validateAnthropicKey).toHaveBeenCalledWith('sk-ant-key');
    });

    it('should return 400 for missing provider', async () => {
      const request = new NextRequest('http://localhost/api/keys', {
        method: 'POST',
        body: JSON.stringify({
          key: 'some-key',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Provider and key are required');
    });

    it('should return 400 for missing key', async () => {
      const request = new NextRequest('http://localhost/api/keys', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'OPENAI',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Provider and key are required');
    });

    it('should return 400 for invalid provider', async () => {
      const request = new NextRequest('http://localhost/api/keys', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'INVALID_PROVIDER',
          key: 'some-key',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid provider');
    });

    it('should handle Mistral keys', async () => {
      const mockValidation = {
        valid: true,
        models: ['mistral-large-latest'],
      };

      vi.mocked(validateMistralKey).mockResolvedValue(mockValidation);

      vi.mocked(prisma.aPIKey.upsert).mockResolvedValue({
        id: 'key-1',
        provider: 'MISTRAL',
        encryptedKey: 'encrypted-key',
        isValid: true,
        validModels: JSON.stringify(mockValidation.models),
          enabledModels: '[]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/keys', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'MISTRAL',
          key: 'mistral-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(validateMistralKey).toHaveBeenCalledWith('mistral-key');
    });
  });

  describe('DELETE /api/keys', () => {
    it('should delete a key successfully', async () => {
      vi.mocked(prisma.aPIKey.delete).mockResolvedValue({
        id: 'key-1',
        provider: 'OPENAI',
        encryptedKey: 'encrypted-key',
        isValid: true,
        validModels: '[]',
          enabledModels: '[]',
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/keys?provider=OPENAI', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.aPIKey.delete).toHaveBeenCalledWith({
        where: { provider: 'OPENAI' },
      });
    });

    it('should return 400 when provider is missing', async () => {
      const request = new NextRequest('http://localhost/api/keys', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Provider is required');
    });

    it('should handle deletion of non-existent key', async () => {
      vi.mocked(prisma.aPIKey.delete).mockRejectedValue(
        new Error('Record not found')
      );

      const request = new NextRequest('http://localhost/api/keys?provider=OPENAI', {
        method: 'DELETE',
      });

      // Should throw error - let it bubble up
      await expect(DELETE(request)).rejects.toThrow('Record not found');
    });

    it('should delete different providers', async () => {
      const providers = ['OPENAI', 'ANTHROPIC', 'MISTRAL', 'XAI'];

      for (const provider of providers) {
        vi.mocked(prisma.aPIKey.delete).mockResolvedValue({
          id: 'key-1',
          provider,
          encryptedKey: 'encrypted-key',
          isValid: true,
          validModels: '[]',
          enabledModels: '[]',
          lastValidated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = new NextRequest(`http://localhost/api/keys?provider=${provider}`, {
          method: 'DELETE',
        });

        const response = await DELETE(request);
        expect(response.status).toBe(200);
        expect(prisma.aPIKey.delete).toHaveBeenCalledWith({
          where: { provider },
        });
      }
    });
  });
});
