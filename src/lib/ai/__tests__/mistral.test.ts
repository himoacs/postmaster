import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMistralClient,
  validateMistralKey,
  generateWithMistral,
  generateWithMistralStream,
} from '../mistral';

// Mock the Mistral SDK
const mockModels = {
  list: vi.fn(),
};

const mockChat = {
  complete: vi.fn(),
  stream: vi.fn(),
};

vi.mock('@mistralai/mistralai', () => {
  class MockMistral {
    models = mockModels;
    chat = mockChat;
    constructor() {
      // noop
    }
  }
  return {
    Mistral: MockMistral,
  };
});

import { Mistral } from '@mistralai/mistralai';

describe('Mistral AI Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createMistralClient', () => {
    it('should create a Mistral client with API key', () => {
      const apiKey = 'test-api-key';
      const client = createMistralClient(apiKey);

      expect(client).toBeDefined();
      expect(client.models).toBeDefined();
      expect(client.chat).toBeDefined();
    });
  });

  describe('validateMistralKey', () => {
    it('should validate a valid API key and return models', async () => {
      const mockData = {
        data: [
          { id: 'mistral-large-latest' },
          { id: 'mistral-medium-latest' },
          { id: 'mistral-small-latest' },
        ],
      };

      vi.mocked(mockModels.list).mockResolvedValue(mockData as any);

      const result = await validateMistralKey('test-api-key');

      expect(result.valid).toBe(true);
      expect(result.models).toEqual([
        'mistral-large-latest',
        'mistral-medium-latest',
        'mistral-small-latest',
      ]);
      expect(result.error).toBeUndefined();
    });

    it('should return default models when list is empty', async () => {
      const mockData = { data: [] };

      vi.mocked(mockModels.list).mockResolvedValue(mockData as any);

      const result = await validateMistralKey('test-api-key');

      expect(result.valid).toBe(true);
      expect(result.models).toEqual([
        'mistral-large-latest',
        'mistral-medium-latest',
        'mistral-small-latest',
      ]);
    });

    it('should return error for invalid API key', async () => {
      vi.mocked(mockModels.list).mockRejectedValue(
        new Error('Unauthorized')
      );

      const result = await validateMistralKey('invalid-api-key');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should handle non-Error exceptions', async () => {
      vi.mocked(mockModels.list).mockRejectedValue('Unknown error');

      const result = await validateMistralKey('test-api-key');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });
  });

  describe('generateWithMistral', () => {
    it('should generate content successfully', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Generated content from Mistral',
            },
          },
        ],
        usage: {
          totalTokens: 150,
        },
      };

      vi.mocked(mockChat.complete).mockResolvedValue(mockResponse as any);

      const result = await generateWithMistral(
        'test-api-key',
        'mistral-large-latest',
        'You are a helpful assistant',
        'Write about AI'
      );

      expect(result.content).toBe('Generated content from Mistral');
      expect(result.tokensUsed).toBe(150);
      expect(mockChat.complete).toHaveBeenCalledWith({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Write about AI' },
        ],
        temperature: 0.7,
        maxTokens: 4096,
      });
    });

    it('should handle empty content response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
        usage: {
          totalTokens: 10,
        },
      };

      vi.mocked(mockChat.complete).mockResolvedValue(mockResponse as any);

      const result = await generateWithMistral(
        'test-api-key',
        'mistral-large-latest',
        'System prompt',
        'User prompt'
      );

      expect(result.content).toBe('');
      expect(result.tokensUsed).toBe(10);
    });

    it('should handle missing usage data', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Test content',
            },
          },
        ],
        usage: undefined,
      };

      vi.mocked(mockChat.complete).mockResolvedValue(mockResponse as any);

      const result = await generateWithMistral(
        'test-api-key',
        'mistral-small-latest',
        'System',
        'User'
      );

      expect(result.content).toBe('Test content');
      expect(result.tokensUsed).toBe(0);
    });

    it('should handle API errors', async () => {
      vi.mocked(mockChat.complete).mockRejectedValue(
        new Error('Rate limit exceeded')
      );

      await expect(
        generateWithMistral(
          'test-api-key',
          'mistral-large-latest',
          'System',
          'User'
        )
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('generateWithMistralStream', () => {
    it('should stream content chunks', async () => {
      const mockStreamData = [
        {
          data: {
            choices: [{ delta: { content: 'Hello ' } }],
          },
        },
        {
          data: {
            choices: [{ delta: { content: 'world' } }],
          },
        },
        {
          data: {
            choices: [{ delta: { content: '' }, finishReason: 'stop' }],
            usage: { totalTokens: 50 },
          },
        },
      ];

      vi.mocked(mockChat.stream).mockResolvedValue(
        (async function* () {
          for (const event of mockStreamData) {
            yield event;
          }
        })() as any
      );

      const chunks: Array<{ content: string; done: boolean; tokensUsed?: number }> = [];
      const stream = generateWithMistralStream(
        'test-api-key',
        'mistral-large-latest',
        'System prompt',
        'User prompt'
      );

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual({ content: 'Hello ', done: false });
      expect(chunks[1]).toEqual({ content: 'world', done: false });
      expect(chunks[2]).toEqual({ content: '', done: true, tokensUsed: 50 });
    });

    it('should handle empty delta content', async () => {
      const mockStreamData = [
        {
          data: {
            choices: [{ delta: { content: '' } }],
          },
        },
        {
          data: {
            choices: [{ delta: {}, finishReason: 'stop' }],
            usage: { totalTokens: 10 },
          },
        },
      ];

      vi.mocked(mockChat.stream).mockResolvedValue(
        (async function* () {
          for (const event of mockStreamData) {
            yield event;
          }
        })() as any
      );

      const chunks: Array<{ content: string; done: boolean; tokensUsed?: number }> = [];
      const stream = generateWithMistralStream(
        'test-api-key',
        'mistral-large-latest',
        'System',
        'User'
      );

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Only the done signal should be emitted
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual({ content: '', done: true, tokensUsed: 10 });
    });

    it('should handle array content chunks', async () => {
      const mockStreamData = [
        {
          data: {
            choices: [{ delta: { content: [{ text: 'Array ' }, { text: 'content' }] } }],
          },
        },
        {
          data: {
            choices: [{ delta: { content: '' }, finishReason: 'stop' }],
            usage: { totalTokens: 25 },
          },
        },
      ];

      vi.mocked(mockChat.stream).mockResolvedValue(
        (async function* () {
          for (const event of mockStreamData) {
            yield event;
          }
        })() as any
      );

      const chunks: Array<{ content: string; done: boolean; tokensUsed?: number }> = [];
      const stream = generateWithMistralStream(
        'test-api-key',
        'mistral-large-latest',
        'System',
        'User'
      );

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({ content: 'Array content', done: false });
      expect(chunks[1]).toEqual({ content: '', done: true, tokensUsed: 25 });
    });
  });
});
