/**
 * Tests for AI provider utilities
 */
import { describe, it, expect } from 'vitest';
import {
  getProviderById,
  getModelById,
  getTextGenerationProviders,
  getImageGenerationProviders,
  selectBestAvailableModel,
  AI_PROVIDERS,
} from '@/lib/ai/providers';
import { AIProvider } from '@/types';

describe('AI Provider utilities', () => {
  describe('getProviderById', () => {
    it('should return OpenAI provider', () => {
      const provider = getProviderById('OPENAI' as AIProvider);
      expect(provider.id).toBe('OPENAI');
      expect(provider.name).toBe('OpenAI');
      expect(provider.models.length).toBeGreaterThan(0);
    });

    it('should return Anthropic provider', () => {
      const provider = getProviderById('ANTHROPIC' as AIProvider);
      expect(provider.id).toBe('ANTHROPIC');
      expect(provider.name).toBe('Anthropic');
      expect(provider.models.length).toBeGreaterThan(0);
    });

    it('should return xAI provider', () => {
      const provider = getProviderById('XAI' as AIProvider);
      expect(provider.id).toBe('XAI');
      expect(provider.name).toBe('xAI');
    });

    it('should return Mistral provider', () => {
      const provider = getProviderById('MISTRAL' as AIProvider);
      expect(provider.id).toBe('MISTRAL');
      expect(provider.name).toBe('Mistral AI');
    });
  });

  describe('getModelById', () => {
    it('should return GPT-4o model', () => {
      const model = getModelById('OPENAI' as AIProvider, 'gpt-4o');
      expect(model).toBeDefined();
      expect(model?.name).toBe('GPT-4o');
      expect(model?.costTier).toBe('high');
    });

    it('should return Claude Sonnet 4 model', () => {
      const model = getModelById('ANTHROPIC' as AIProvider, 'claude-sonnet-4-20250514');
      expect(model).toBeDefined();
      expect(model?.name).toBe('Claude Sonnet 4');
      expect(model?.costTier).toBe('high');
    });

    it('should return undefined for non-existent model', () => {
      const model = getModelById('OPENAI' as AIProvider, 'non-existent-model');
      expect(model).toBeUndefined();
    });

    it('should handle GPT-4o mini', () => {
      const model = getModelById('OPENAI' as AIProvider, 'gpt-4o-mini');
      expect(model).toBeDefined();
      expect(model?.name).toBe('GPT-4o Mini');
      expect(model?.costTier).toBe('low');
    });
  });

  describe('getTextGenerationProviders', () => {
    it('should return all text generation providers', () => {
      const providers = getTextGenerationProviders();
      expect(providers.length).toBeGreaterThanOrEqual(4);
      
      const providerIds = providers.map(p => p.id);
      expect(providerIds).toContain('OPENAI');
      expect(providerIds).toContain('ANTHROPIC');
      expect(providerIds).toContain('XAI');
      expect(providerIds).toContain('MISTRAL');
    });

    it('should not include image generation providers', () => {
      const providers = getTextGenerationProviders();
      const providerIds = providers.map(p => p.id);
      expect(providerIds).not.toContain('STABILITY');
    });
  });

  describe('getImageGenerationProviders', () => {
    it('should return image generation providers', () => {
      const providers = getImageGenerationProviders();
      expect(providers.length).toBeGreaterThanOrEqual(1);
      
      const providerIds = providers.map(p => p.id);
      expect(providerIds).toContain('STABILITY');
    });
  });

  describe('selectBestAvailableModel', () => {
    it('should return null for empty array', () => {
      const best = selectBestAvailableModel([]);
      expect(best).toBeNull();
    });

    it('should select Claude Sonnet 4 when available (highest quality)', () => {
      const models = [
        { provider: 'OPENAI' as AIProvider, modelId: 'gpt-4o' },
        { provider: 'ANTHROPIC' as AIProvider, modelId: 'claude-sonnet-4-20250514' },
        { provider: 'MISTRAL' as AIProvider, modelId: 'mistral-large-latest' },
      ];
      
      const best = selectBestAvailableModel(models);
      expect(best?.provider).toBe('ANTHROPIC');
      expect(best?.modelId).toBe('claude-sonnet-4-20250514');
    });

    it('should select GPT-4o when Claude is not available', () => {
      const models = [
        { provider: 'OPENAI' as AIProvider, modelId: 'gpt-4o' },
        { provider: 'MISTRAL' as AIProvider, modelId: 'mistral-large-latest' },
        { provider: 'XAI' as AIProvider, modelId: 'grok-2' },
      ];
      
      const best = selectBestAvailableModel(models);
      expect(best?.provider).toBe('OPENAI');
      expect(best?.modelId).toBe('gpt-4o');
    });

    it('should prefer high-tier models over low-tier', () => {
      const models = [
        { provider: 'OPENAI' as AIProvider, modelId: 'gpt-4o-mini' }, // low tier
        { provider: 'OPENAI' as AIProvider, modelId: 'gpt-4o' }, // high tier
      ];
      
      const best = selectBestAvailableModel(models);
      expect(best?.modelId).toBe('gpt-4o');
    });

    it('should handle only low-tier models', () => {
      const models = [
        { provider: 'OPENAI' as AIProvider, modelId: 'gpt-4o-mini' },
        { provider: 'MISTRAL' as AIProvider, modelId: 'mistral-small-latest' },
      ];
      
      const best = selectBestAvailableModel(models);
      expect(best).not.toBeNull();
      expect(best?.provider).toBe('OPENAI'); // OpenAI has higher priority than Mistral
    });

    it('should filter out image generation models', () => {
      const models = [
        { provider: 'STABILITY' as AIProvider, modelId: 'stable-diffusion-xl-1024-v1-0' },
        { provider: 'OPENAI' as AIProvider, modelId: 'gpt-4o' },
      ];
      
      const best = selectBestAvailableModel(models);
      expect(best?.provider).toBe('OPENAI');
      expect(best?.modelId).toBe('gpt-4o');
    });

    it('should handle LiteLLM models (treated as medium tier)', () => {
      const models = [
        { provider: 'LITELLM' as AIProvider, modelId: 'gpt-4o' },
        { provider: 'OPENAI' as AIProvider, modelId: 'gpt-4o-mini' },
      ];
      
      const best = selectBestAvailableModel(models);
      // LiteLLM should be treated as medium tier, so it should win over low tier
      expect(best?.provider).toBe('LITELLM');
    });

    it('should prefer direct provider over LiteLLM for same model quality', () => {
      const models = [
        { provider: 'LITELLM' as AIProvider, modelId: 'gpt-4o' },
        { provider: 'ANTHROPIC' as AIProvider, modelId: 'claude-3-5-sonnet-20241022' },
      ];
      
      const best = selectBestAvailableModel(models);
      expect(best?.provider).toBe('ANTHROPIC');
    });

    it('should handle single model', () => {
      const models = [
        { provider: 'OPENAI' as AIProvider, modelId: 'gpt-4o' },
      ];
      
      const best = selectBestAvailableModel(models);
      expect(best?.provider).toBe('OPENAI');
      expect(best?.modelId).toBe('gpt-4o');
    });
  });

  describe('AI_PROVIDERS constant', () => {
    it('should have all expected providers', () => {
      expect(AI_PROVIDERS.OPENAI).toBeDefined();
      expect(AI_PROVIDERS.ANTHROPIC).toBeDefined();
      expect(AI_PROVIDERS.XAI).toBeDefined();
      expect(AI_PROVIDERS.MISTRAL).toBeDefined();
      expect(AI_PROVIDERS.STABILITY).toBeDefined();
      expect(AI_PROVIDERS.LITELLM).toBeDefined();
    });

    it('should have models for each text provider', () => {
      expect(AI_PROVIDERS.OPENAI.models.length).toBeGreaterThan(0);
      expect(AI_PROVIDERS.ANTHROPIC.models.length).toBeGreaterThan(0);
      expect(AI_PROVIDERS.XAI.models.length).toBeGreaterThan(0);
      expect(AI_PROVIDERS.MISTRAL.models.length).toBeGreaterThan(0);
    });

    it('should have cost tiers defined for all models', () => {
      const textProviders = getTextGenerationProviders();
      
      for (const provider of textProviders) {
        for (const model of provider.models) {
          expect(model.costTier).toMatch(/^(low|medium|high)$/);
        }
      }
    });

    it('should have context windows defined', () => {
      const gpt4o = getModelById('OPENAI' as AIProvider, 'gpt-4o');
      expect(gpt4o?.contextWindow).toBeGreaterThan(0);
      
      const claude = getModelById('ANTHROPIC' as AIProvider, 'claude-sonnet-4-20250514');
      expect(claude?.contextWindow).toBeGreaterThan(0);
    });
  });
});
