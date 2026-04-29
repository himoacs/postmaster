/**
 * Example API Route Test - /api/preferences
 * This demonstrates the pattern for testing Next.js API routes
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/preferences/route';
import { prisma } from '@/lib/db';

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    userPreferences: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('API: /api/preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/preferences', () => {
    it('should return existing preferences', async () => {
      const mockPreferences = {
        id: 'pref-1',
        synthesisStrategy: 'basic',
        debateMaxRounds: 3,
        showCritiqueDetails: true,
        primaryModelProvider: 'OPENAI',
        primaryModelId: 'gpt-4o',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.userPreferences.findFirst).mockResolvedValue(mockPreferences);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.synthesisStrategy).toBe('basic');
      expect(data.primaryModelProvider).toBe('OPENAI');
      expect(data.primaryModelId).toBe('gpt-4o');
    });

    it('should create default preferences if none exist', async () => {
      const mockCreatedPreferences = {
        id: 'pref-new',
        synthesisStrategy: 'basic',
        debateMaxRounds: 3,
        showCritiqueDetails: true,
        primaryModelProvider: null,
        primaryModelId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.userPreferences.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.userPreferences.create).mockResolvedValue(mockCreatedPreferences);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.synthesisStrategy).toBe('basic');
      expect(prisma.userPreferences.create).toHaveBeenCalled();
    });
  });

  describe('PUT /api/preferences', () => {
    it('should update existing preferences', async () => {
      const existingPrefs = {
        id: 'pref-1',
        synthesisStrategy: 'basic',
        debateMaxRounds: 3,
        showCritiqueDetails: true,
        primaryModelProvider: null,
        primaryModelId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedPrefs = {
        ...existingPrefs,
        primaryModelProvider: 'ANTHROPIC',
        primaryModelId: 'claude-sonnet-4-20250514',
      };

      vi.mocked(prisma.userPreferences.findFirst).mockResolvedValue(existingPrefs);
      vi.mocked(prisma.userPreferences.update).mockResolvedValue(updatedPrefs);

      const request = new NextRequest('http://localhost/api/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          primaryModelProvider: 'ANTHROPIC',
          primaryModelId: 'claude-sonnet-4-20250514',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.primaryModelProvider).toBe('ANTHROPIC');
      expect(data.primaryModelId).toBe('claude-sonnet-4-20250514');
    });

    it('should validate synthesis strategy', async () => {
      const request = new NextRequest('http://localhost/api/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          synthesisStrategy: 'invalid-strategy',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should validate debate rounds range', async () => {
      const request = new NextRequest('http://localhost/api/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          debateMaxRounds: 10, // Out of range (1-5)
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should create new preferences when none exist during PUT', async () => {
      const newPrefs = {
        id: 'pref-new',
        synthesisStrategy: 'sequential',
        debateMaxRounds: 2,
        showCritiqueDetails: false,
        primaryModelProvider: null,
        primaryModelId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.userPreferences.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.userPreferences.create).mockResolvedValue(newPrefs);

      const request = new NextRequest('http://localhost/api/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          synthesisStrategy: 'sequential',
          debateMaxRounds: 2,
          showCritiqueDetails: false,
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.synthesisStrategy).toBe('sequential');
      expect(data.debateMaxRounds).toBe(2);
      expect(prisma.userPreferences.create).toHaveBeenCalled();
    });
  });
});
