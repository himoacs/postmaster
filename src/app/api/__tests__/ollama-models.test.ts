/**
 * Tests for /api/ollama/models - Ollama model refresh
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/ollama/models/route';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { fetchOllamaModels } from '@/lib/ai/ollama';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    ollamaConfig: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/encryption', () => ({
  decrypt: vi.fn((encrypted: string) => encrypted.replace('encrypted-', '')),
}));

vi.mock('@/lib/ai/ollama', () => ({
  fetchOllamaModels: vi.fn(),
}));

describe('API: /api/ollama/models', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/ollama/models', () => {
    it('should return cached models', async () => {
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
          {
            id: 'llama3.3:latest',
            name: 'Llama 3.3 (Latest)',
            provider: 'ollama',
            contextWindow: 8192,
            costTier: 'local',
            size: '42.0 GB',
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
      expect(data.models).toHaveLength(2);
      expect(data.models[0].id).toBe('qwen3:latest');
      expect(data.models[1].id).toBe('llama3.3:latest');
    });

    it('should return empty array when no config exists', async () => {
      vi.mocked(prisma.ollamaConfig.findFirst).mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.models).toEqual([]);
    });

    it('should return empty array for invalid JSON', async () => {
      const mockConfig = {
        id: '1',
        endpoint: 'http://localhost:11434',
        encryptedKey: null,
        isEnabled: true,
        isValid: true,
        cachedModels: 'invalid-json',
        lastValidated: new Date('2026-04-30'),
        createdAt: new Date('2026-04-30'),
        updatedAt: new Date('2026-04-30'),
      };

      vi.mocked(prisma.ollamaConfig.findFirst).mockResolvedValue(mockConfig as any);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.models).toEqual([]);
    });

    it('should handle database errors', async () => {
      vi.mocked(prisma.ollamaConfig.findFirst).mockRejectedValue(
        new Error('Database error')
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch models');
    });
  });

  describe('POST /api/ollama/models', () => {
    it('should refresh models successfully', async () => {
      const mockConfig = {
        id: '1',
        endpoint: 'http://localhost:11434',
        encryptedKey: null,
        isEnabled: true,
        isValid: true,
        cachedModels: JSON.stringify([]),
        lastValidated: new Date('2026-04-29'),
        createdAt: new Date('2026-04-29'),
        updatedAt: new Date('2026-04-29'),
      };

      const mockModels = [
        {
          id: 'qwen3:latest',
          name: 'Qwen 3 (Latest)',
          provider: 'ollama' as const,
          contextWindow: 8192,
          costTier: 'local' as const,
          size: '5.2 GB',
        },
        {
          id: 'llama3.3:latest',
          name: 'Llama 3.3 (Latest)',
          provider: 'ollama' as const,
          contextWindow: 8192,
          costTier: 'local' as const,
          size: '42.0 GB',
        },
      ];

      vi.mocked(prisma.ollamaConfig.findFirst).mockResolvedValue(mockConfig as any);
      vi.mocked(fetchOllamaModels).mockResolvedValue(mockModels);
      vi.mocked(prisma.ollamaConfig.update).mockResolvedValue({
        ...mockConfig,
        cachedModels: JSON.stringify(mockModels),
        lastValidated: new Date(),
      } as any);

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.models).toHaveLength(2);
      expect(data.models[0].id).toBe('qwen3:latest');
      expect(data.models[1].id).toBe('llama3.3:latest');
      expect(fetchOllamaModels).toHaveBeenCalledWith('http://localhost:11434', undefined);
      expect(prisma.ollamaConfig.update).toHaveBeenCalled();
    });

    it('should refresh models with API key', async () => {
      const mockConfig = {
        id: '1',
        endpoint: 'http://localhost:11434',
        encryptedKey: 'encrypted-test-key',
        isEnabled: true,
        isValid: true,
        cachedModels: JSON.stringify([]),
        lastValidated: new Date('2026-04-29'),
        createdAt: new Date('2026-04-29'),
        updatedAt: new Date('2026-04-29'),
      };

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

      vi.mocked(prisma.ollamaConfig.findFirst).mockResolvedValue(mockConfig as any);
      vi.mocked(fetchOllamaModels).mockResolvedValue(mockModels);
      vi.mocked(prisma.ollamaConfig.update).mockResolvedValue({
        ...mockConfig,
        cachedModels: JSON.stringify(mockModels),
        lastValidated: new Date(),
      } as any);

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(decrypt).toHaveBeenCalledWith('encrypted-test-key');
      expect(fetchOllamaModels).toHaveBeenCalledWith('http://localhost:11434', 'test-key');
    });

    it('should return error when no config exists', async () => {
      vi.mocked(prisma.ollamaConfig.findFirst).mockResolvedValue(null);

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Ollama not configured');
      expect(fetchOllamaModels).not.toHaveBeenCalled();
    });

    it('should handle fetch errors', async () => {
      const mockConfig = {
        id: '1',
        endpoint: 'http://localhost:11434',
        encryptedKey: null,
        isEnabled: true,
        isValid: true,
        cachedModels: JSON.stringify([]),
        lastValidated: new Date('2026-04-29'),
        createdAt: new Date('2026-04-29'),
        updatedAt: new Date('2026-04-29'),
      };

      vi.mocked(prisma.ollamaConfig.findFirst).mockResolvedValue(mockConfig as any);
      vi.mocked(fetchOllamaModels).mockRejectedValue(
        new Error('Connection failed')
      );

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to refresh models');
    });

    it('should handle database update errors', async () => {
      const mockConfig = {
        id: '1',
        endpoint: 'http://localhost:11434',
        encryptedKey: null,
        isEnabled: true,
        isValid: true,
        cachedModels: JSON.stringify([]),
        lastValidated: new Date('2026-04-29'),
        createdAt: new Date('2026-04-29'),
        updatedAt: new Date('2026-04-29'),
      };

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

      vi.mocked(prisma.ollamaConfig.findFirst).mockResolvedValue(mockConfig as any);
      vi.mocked(fetchOllamaModels).mockResolvedValue(mockModels);
      vi.mocked(prisma.ollamaConfig.update).mockRejectedValue(
        new Error('Update failed')
      );

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to refresh models');
    });
  });
});
