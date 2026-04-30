/**
 * Tests for /api/ollama - Ollama configuration management
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from '@/app/api/ollama/route';
import { prisma } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/encryption';
import { validateOllamaConfig } from '@/lib/ai/ollama';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    ollamaConfig: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((text: string) => `encrypted-${text}`),
  decrypt: vi.fn((encrypted: string) => encrypted.replace('encrypted-', '')),
}));

vi.mock('@/lib/ai/ollama', () => ({
  validateOllamaConfig: vi.fn(),
}));

describe('API: /api/ollama', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/ollama', () => {
    it('should return Ollama configuration with models', async () => {
      const mockConfig = {
        id: '1',
        endpoint: 'http://localhost:11434',
        encryptedKey: null,
        isEnabled: true,
        isValid: true,
        cachedModels: JSON.stringify([
          {
            id: 'qwen3:latest',
            name: 'Qwen 3 (Latest)',
            provider: 'ollama',
            contextWindow: 8192,
            costTier: 'local',
            size: '5.2 GB',
          },
        ]),
        lastValidated: new Date('2026-04-30'),
        createdAt: new Date('2026-04-30'),
        updatedAt: new Date('2026-04-30'),
      };

      vi.mocked(prisma.ollamaConfig.findFirst).mockResolvedValue(mockConfig as any);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.endpoint).toBe('http://localhost:11434');
      expect(data.isEnabled).toBe(true);
      expect(data.isValid).toBe(true);
      expect(data.models).toHaveLength(1);
      expect(data.models[0].id).toBe('qwen3:latest');
      expect(data.models[0].size).toBe('5.2 GB');
    });

    it('should return empty config when none exists', async () => {
      vi.mocked(prisma.ollamaConfig.findFirst).mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.endpoint).toBe('http://localhost:11434'); // Default
      expect(data.isEnabled).toBe(false);
      expect(data.isValid).toBe(false);
      expect(data.models).toEqual([]);
    });

    it('should handle database errors', async () => {
      vi.mocked(prisma.ollamaConfig.findFirst).mockRejectedValue(
        new Error('Database error')
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch Ollama configuration');
    });
  });

  describe('POST /api/ollama', () => {
    it('should save valid Ollama configuration', async () => {
      const mockModels = [
        {
          id: 'qwen3:latest',
          name: 'Qwen 3 (Latest)',
          provider: 'ollama' as const,
          contextWindow: 8192,
          costTier: 'local' as const,
          size: '5.2 GB',
        },
      ];

      vi.mocked(validateOllamaConfig).mockResolvedValue({
        valid: true,
        models: mockModels,
      });

      vi.mocked(prisma.ollamaConfig.upsert).mockResolvedValue({
        id: '1',
        endpoint: 'http://localhost:11434',
        encryptedKey: null,
        isEnabled: true,
        isValid: true,
        cachedModels: JSON.stringify(mockModels),
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const request = new NextRequest('http://localhost/api/ollama', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: 'http://localhost:11434',
          apiKey: '',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.isValid).toBe(true);
      expect(data.models).toHaveLength(1);
      expect(validateOllamaConfig).toHaveBeenCalledWith('http://localhost:11434', '');
      expect(prisma.ollamaConfig.upsert).toHaveBeenCalled();
    });

    it('should save configuration with API key', async () => {
      const mockModels = [
        {
          id: 'qwen3:latest',
          name: 'Qwen 3 (Latest)',
          provider: 'ollama' as const,
          contextWindow: 8192,
          costTier: 'local' as const,
          size: '5.2 GB',
        },
      ];

      vi.mocked(validateOllamaConfig).mockResolvedValue({
        valid: true,
        models: mockModels,
      });

      vi.mocked(prisma.ollamaConfig.upsert).mockResolvedValue({
        id: '1',
        endpoint: 'http://localhost:11434',
        encryptedKey: 'encrypted-test-key',
        isEnabled: true,
        isValid: true,
        cachedModels: JSON.stringify(mockModels),
        lastValidated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const request = new NextRequest('http://localhost/api/ollama', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: 'http://localhost:11434',
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(validateOllamaConfig).toHaveBeenCalledWith('http://localhost:11434', 'test-key');
      expect(encrypt).toHaveBeenCalledWith('test-key');
    });

    it('should validate without saving when validateOnly is true', async () => {
      const mockModels = [
        {
          id: 'qwen3:latest',
          name: 'Qwen 3 (Latest)',
          provider: 'ollama' as const,
          contextWindow: 8192,
          costTier: 'local' as const,
          size: '5.2 GB',
        },
      ];

      vi.mocked(validateOllamaConfig).mockResolvedValue({
        valid: true,
        models: mockModels,
      });

      const request = new NextRequest('http://localhost/api/ollama', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: 'http://localhost:11434',
          apiKey: '',
          validateOnly: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.isValid).toBe(true);
      expect(data.models).toHaveLength(1);
      expect(validateOllamaConfig).toHaveBeenCalled();
      expect(prisma.ollamaConfig.upsert).not.toHaveBeenCalled();
    });

    it('should return invalid for connection failure', async () => {
      vi.mocked(validateOllamaConfig).mockResolvedValue({
        valid: false,
        error: 'Failed to connect to Ollama',
      });

      const request = new NextRequest('http://localhost/api/ollama', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: 'http://invalid:11434',
          apiKey: '',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.isValid).toBe(false);
      expect(data.error).toBe('Failed to connect to Ollama');
      expect(prisma.ollamaConfig.upsert).not.toHaveBeenCalled();
    });

    it('should require endpoint', async () => {
      const request = new NextRequest('http://localhost/api/ollama', {
        method: 'POST',
        body: JSON.stringify({
          apiKey: '',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Endpoint is required');
    });

    it('should handle validation errors', async () => {
      vi.mocked(validateOllamaConfig).mockRejectedValue(
        new Error('Validation failed')
      );

      const request = new NextRequest('http://localhost/api/ollama', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: 'http://localhost:11434',
          apiKey: '',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to configure Ollama');
    });
  });

  describe('DELETE /api/ollama', () => {
    it('should delete Ollama configuration', async () => {
      vi.mocked(prisma.ollamaConfig.delete).mockResolvedValue({
        id: '1',
      } as any);

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.ollamaConfig.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should handle deletion errors', async () => {
      vi.mocked(prisma.ollamaConfig.delete).mockRejectedValue(
        new Error('Delete failed')
      );

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to delete Ollama configuration');
    });
  });
});
