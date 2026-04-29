/**
 * Tests for OpenAI provider integration
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createOpenAIClient,
  validateOpenAIKey,
  generateWithOpenAI,
  generateWithOpenAIStream,
} from '@/lib/ai/openai';

// Create mock OpenAI client
const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn(),
    },
  },
  models: {
    list: vi.fn(),
  },
  images: {
    generate: vi.fn(),
  },
};

// Mock API errors
const mockAPIError = {
  openai: {
    invalid_key: new Error('Invalid API key'),
    rate_limit: new Error('Rate limit exceeded'),
    timeout: new Error('Request timeout'),
  },
};

// Mock the OpenAI SDK constructor
vi.mock('openai', () => {
  class MockOpenAI {
    chat = mockOpenAI.chat;
    models = mockOpenAI.models;
    images = mockOpenAI.images;
    constructor() {
      // noop
    }
  }
  return {
    default: MockOpenAI,
  };
});

describe('OpenAI Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOpenAIClient', () => {
    it('should create client with API key', () => {
      const client = createOpenAIClient('test-api-key');
      expect(client).toBeDefined();
    });
  });

  describe('validateOpenAIKey', () => {
    it('should validate a valid API key', async () => {
      mockOpenAI.models.list = vi.fn().mockResolvedValue({
        data: [
          { id: 'gpt-4o', object: 'model' },
          { id: 'gpt-4o-mini', object: 'model' },
          { id: 'gpt-4-turbo', object: 'model' },
          { id: 'gpt-3.5-turbo', object: 'model' },
          { id: 'davinci-002', object: 'model' }, // Non-chat model
        ],
      });

      const result = await validateOpenAIKey('valid-api-key');

      expect(result.valid).toBe(true);
      expect(result.models).toContain('gpt-4o');
      expect(result.models).toContain('gpt-4o-mini');
      expect(result.models).toContain('gpt-4-turbo');
      expect(result.models).toContain('gpt-3.5-turbo');
      expect(result.models).not.toContain('davinci-002'); // Should filter out non-chat
    });

    it('should filter for chat completion models only', async () => {
      mockOpenAI.models.list = vi.fn().mockResolvedValue({
        data: [
          { id: 'gpt-4o', object: 'model' },
          { id: 'text-davinci-003', object: 'model' },
          { id: 'whisper-1', object: 'model' },
          { id: 'dall-e-3', object: 'model' },
          { id: 'o1-preview', object: 'model' },
        ],
      });

      const result = await validateOpenAIKey('valid-api-key');

      expect(result.valid).toBe(true);
      expect(result.models).toContain('gpt-4o');
      expect(result.models).toContain('o1-preview');
      expect(result.models).not.toContain('text-davinci-003');
      expect(result.models).not.toContain('whisper-1');
      expect(result.models).not.toContain('dall-e-3');
    });

    it('should return invalid for bad API key', async () => {
      mockOpenAI.models.list = vi.fn().mockRejectedValue(
        mockAPIError.openai.invalid_key
      );

      const result = await validateOpenAIKey('invalid-api-key');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.models).toBeUndefined();
    });

    it('should handle network errors', async () => {
      mockOpenAI.models.list = vi.fn().mockRejectedValue(
        mockAPIError.openai.timeout
      );

      const result = await validateOpenAIKey('test-key');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Request timeout');
    });

    it('should handle rate limit errors', async () => {
      mockOpenAI.models.list = vi.fn().mockRejectedValue(
        mockAPIError.openai.rate_limit
      );

      const result = await validateOpenAIKey('test-key');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
    });
  });

  describe('generateWithOpenAI', () => {
    it('should generate content successfully', async () => {
      mockOpenAI.chat.completions.create = vi.fn().mockResolvedValue({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'This is the generated content from GPT-4o.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 100,
          total_tokens: 150,
        },
      });

      const result = await generateWithOpenAI(
        'test-api-key',
        'gpt-4o',
        'You are a helpful assistant',
        'Write a test message'
      );

      expect(result.content).toBe('This is the generated content from GPT-4o.');
      expect(result.tokensUsed).toBe(150);
      
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Write a test message' },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      });
    });

    it('should handle empty response', async () => {
      mockOpenAI.chat.completions.create = vi.fn().mockResolvedValue({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null, // Empty content
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 0,
          total_tokens: 10,
        },
      });

      const result = await generateWithOpenAI(
        'test-api-key',
        'gpt-4o',
        'system',
        'prompt'
      );

      expect(result.content).toBe('');
      expect(result.tokensUsed).toBe(10);
    });

    it('should handle missing usage data', async () => {
      mockOpenAI.chat.completions.create = vi.fn().mockResolvedValue({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Generated content',
            },
            finish_reason: 'stop',
          },
        ],
        // Missing usage data
      });

      const result = await generateWithOpenAI(
        'test-api-key',
        'gpt-4o',
        'system',
        'prompt'
      );

      expect(result.content).toBe('Generated content');
      expect(result.tokensUsed).toBe(0); // Should default to 0
    });

    it('should throw on rate limit error', async () => {
      mockOpenAI.chat.completions.create = vi.fn().mockRejectedValue(
        mockAPIError.openai.rate_limit
      );

      await expect(
        generateWithOpenAI('test-api-key', 'gpt-4o', 'system', 'prompt')
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should throw on invalid API key', async () => {
      mockOpenAI.chat.completions.create = vi.fn().mockRejectedValue(
        mockAPIError.openai.invalid_key
      );

      await expect(
        generateWithOpenAI('invalid-key', 'gpt-4o', 'system', 'prompt')
      ).rejects.toThrow('Invalid API key');
    });

    it('should throw on timeout', async () => {
      mockOpenAI.chat.completions.create = vi.fn().mockRejectedValue(
        mockAPIError.openai.timeout
      );

      await expect(
        generateWithOpenAI('test-api-key', 'gpt-4o', 'system', 'prompt')
      ).rejects.toThrow('Request timeout');
    });

    it('should work with different models', async () => {
      const models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];

      for (const model of models) {
        mockOpenAI.chat.completions.create = vi.fn().mockResolvedValue({
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: Date.now(),
          model,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: `Response from ${model}`,
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
          },
        });

        const result = await generateWithOpenAI(
          'test-api-key',
          model,
          'system',
          'prompt'
        );

        expect(result.content).toBe(`Response from ${model}`);
        expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
          expect.objectContaining({ model })
        );
      }
    });

    it('should use correct temperature and max_tokens', async () => {
      mockOpenAI.chat.completions.create = vi.fn().mockResolvedValue({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Response',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      });

      await generateWithOpenAI('test-api-key', 'gpt-4o', 'system', 'prompt');

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
          max_tokens: 4096,
        })
      );
    });
  });

  describe('generateWithOpenAIStream', () => {
    it('should stream content chunks', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [
              {
                delta: { content: 'Hello' },
                finish_reason: null,
              },
            ],
          };
          yield {
            choices: [
              {
                delta: { content: ' world' },
                finish_reason: null,
              },
            ],
          };
          yield {
            choices: [
              {
                delta: { content: '!' },
                finish_reason: 'stop',
              },
            ],
          };
        },
      };

      mockOpenAI.chat.completions.create = vi.fn().mockResolvedValue(mockStream);

      const chunks: string[] = [];
      for await (const chunk of generateWithOpenAIStream(
        'test-api-key',
        'gpt-4o',
        'system',
        'prompt'
      )) {
        chunks.push(chunk.content);
        if (chunk.done) {
          break;
        }
      }

      // Should include 'Hello', ' world', '!', and final empty chunk with done=true
      expect(chunks).toEqual(['Hello', ' world', '!', '']);
    });

    it('should set done flag on completion', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [
              {
                delta: { content: 'Test' },
                finish_reason: 'stop',
              },
            ],
          };
        },
      };

      mockOpenAI.chat.completions.create = vi.fn().mockResolvedValue(mockStream);

      const chunks = [];
      for await (const chunk of generateWithOpenAIStream(
        'test-api-key',
        'gpt-4o',
        'system',
        'prompt'
      )) {
        chunks.push(chunk);
      }

      expect(chunks[chunks.length - 1].done).toBe(true);
    });

    it('should handle empty delta content', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [
              {
                delta: {}, // Empty delta
                finish_reason: null,
              },
            ],
          };
          yield {
            choices: [
              {
                delta: { content: 'Content' },
                finish_reason: 'stop',
              },
            ],
          };
        },
      };

      mockOpenAI.chat.completions.create = vi.fn().mockResolvedValue(mockStream);

      const chunks: string[] = [];
      for await (const chunk of generateWithOpenAIStream(
        'test-api-key',
        'gpt-4o',
        'system',
        'prompt'
      )) {
        chunks.push(chunk.content);
      }

      expect(chunks).toContain('Content');
    });

    it('should track tokens from usage info in final chunk', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [
              {
                delta: { content: 'Hello' },
                finish_reason: null,
              },
            ],
          };
          yield {
            choices: [
              {
                delta: { content: ' world' },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15,
            },
          };
        },
      };

      mockOpenAI.chat.completions.create = vi.fn().mockResolvedValue(mockStream);

      const chunks: any[] = [];
      for await (const chunk of generateWithOpenAIStream(
        'test-api-key',
        'gpt-4o',
        'system',
        'prompt'
      )) {
        chunks.push(chunk);
      }

      const finalChunk = chunks.find(c => c.done === true);
      expect(finalChunk).toBeDefined();
      expect(finalChunk?.tokensUsed).toBe(15);
    });
  });

  describe('generateImageWithOpenAI', () => {
    beforeEach(() => {
      // Reset the images mock
      (mockOpenAI as any).images = {
        generate: vi.fn(),
      };
    });

    it('should generate image with DALL-E 3', async () => {
      (mockOpenAI as any).images.generate.mockResolvedValue({
        data: [
          {
            url: 'https://example.com/generated-image.png',
          },
        ],
      });

      const { generateImageWithOpenAI } = await import('@/lib/ai/openai');
      
      const imageUrl = await generateImageWithOpenAI(
        'test-api-key',
        'A beautiful sunset over mountains',
        '1024x1024'
      );

      expect(imageUrl).toBe('https://example.com/generated-image.png');
      expect((mockOpenAI as any).images.generate).toHaveBeenCalledWith({
        model: 'dall-e-3',
        prompt: 'A beautiful sunset over mountains',
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      });
    });

    it('should return empty string when no image URL is returned', async () => {
      (mockOpenAI as any).images.generate.mockResolvedValue({
        data: [],
      });

      const { generateImageWithOpenAI } = await import('@/lib/ai/openai');
      
      const imageUrl = await generateImageWithOpenAI(
        'test-api-key',
        'A test prompt'
      );

      expect(imageUrl).toBe('');
    });
  });
});
