import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createGrokClient,
  validateGrokKey,
  generateWithGrok,
  generateWithGrokStream,
} from '../grok';

// Mock OpenAI SDK
const mockCompletions = {
  create: vi.fn(),
};

vi.mock('openai', () => {
  class MockOpenAI {
    chat = {
      completions: mockCompletions,
    };
    constructor() {
      // noop
    }
  }
  return {
    default: MockOpenAI,
  };
});

import OpenAI from 'openai';

describe('Grok AI Provider (xAI)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createGrokClient', () => {
    it('should create a Grok client with xAI base URL', () => {
      const apiKey = 'test-xai-key';
      const client = createGrokClient(apiKey);

      expect(client).toBeDefined();
      expect(client.chat).toBeDefined();
      expect(client.chat.completions).toBeDefined();
    });
  });

  describe('validateGrokKey', () => {
    it('should validate a valid API key', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Hi',
            },
          },
        ],
        usage: {
          total_tokens: 5,
        },
      };

      vi.mocked(mockCompletions.create).mockResolvedValue(mockResponse as any);

      const result = await validateGrokKey('test-xai-key');

      expect(result.valid).toBe(true);
      expect(result.models).toEqual(['grok-2', 'grok-2-mini']);
      expect(result.error).toBeUndefined();
      expect(mockCompletions.create).toHaveBeenCalledWith({
        model: 'grok-2-mini',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10,
      });
    });

    it('should return error for invalid API key', async () => {
      vi.mocked(mockCompletions.create).mockRejectedValue(
        new Error('Invalid API key')
      );

      const result = await validateGrokKey('invalid-xai-key');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });

    it('should handle non-Error exceptions', async () => {
      vi.mocked(mockCompletions.create).mockRejectedValue('Unknown error');

      const result = await validateGrokKey('test-xai-key');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });
  });

  describe('generateWithGrok', () => {
    it('should generate content successfully', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Generated content from Grok',
            },
          },
        ],
        usage: {
          total_tokens: 200,
        },
      };

      vi.mocked(mockCompletions.create).mockResolvedValue(mockResponse as any);

      const result = await generateWithGrok(
        'test-xai-key',
        'grok-2',
        'You are a helpful assistant',
        'Write about quantum computing'
      );

      expect(result.content).toBe('Generated content from Grok');
      expect(result.tokensUsed).toBe(200);
      expect(mockCompletions.create).toHaveBeenCalledWith({
        model: 'grok-2',
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Write about quantum computing' },
        ],
        temperature: 0.7,
        max_tokens: 4096,
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
          total_tokens: 5,
        },
      };

      vi.mocked(mockCompletions.create).mockResolvedValue(mockResponse as any);

      const result = await generateWithGrok(
        'test-xai-key',
        'grok-2-mini',
        'System prompt',
        'User prompt'
      );

      expect(result.content).toBe('');
      expect(result.tokensUsed).toBe(5);
    });

    it('should handle missing usage data', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Grok response',
            },
          },
        ],
        usage: undefined,
      };

      vi.mocked(mockCompletions.create).mockResolvedValue(mockResponse as any);

      const result = await generateWithGrok(
        'test-xai-key',
        'grok-2',
        'System',
        'User'
      );

      expect(result.content).toBe('Grok response');
      expect(result.tokensUsed).toBe(0);
    });

    it('should handle API errors', async () => {
      vi.mocked(mockCompletions.create).mockRejectedValue(
        new Error('Rate limit exceeded')
      );

      await expect(
        generateWithGrok('test-xai-key', 'grok-2', 'System', 'User')
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('generateWithGrokStream', () => {
    it('should stream content chunks', async () => {
      const mockStreamData = [
        {
          choices: [{ delta: { content: 'Streaming ' } }],
        },
        {
          choices: [{ delta: { content: 'from ' } }],
        },
        {
          choices: [{ delta: { content: 'Grok' } }],
        },
        {
          choices: [{ delta: { content: '' }, finish_reason: 'stop' }],
          usage: { total_tokens: 75 },
        },
      ];

      vi.mocked(mockCompletions.create).mockResolvedValue(
        (async function* () {
          for (const chunk of mockStreamData) {
            yield chunk;
          }
        })() as any
      );

      const chunks: Array<{ content: string; done: boolean; tokensUsed?: number }> = [];
      const stream = generateWithGrokStream(
        'test-xai-key',
        'grok-2',
        'System prompt',
        'User prompt'
      );

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(4);
      expect(chunks[0]).toEqual({ content: 'Streaming ', done: false });
      expect(chunks[1]).toEqual({ content: 'from ', done: false });
      expect(chunks[2]).toEqual({ content: 'Grok', done: false });
      expect(chunks[3]).toEqual({ content: '', done: true, tokensUsed: 75 });
    });

    it('should handle empty delta content', async () => {
      const mockStreamData = [
        {
          choices: [{ delta: { content: '' } }],
        },
        {
          choices: [{ delta: {}, finish_reason: 'stop' }],
          usage: { total_tokens: 10 },
        },
      ];

      vi.mocked(mockCompletions.create).mockResolvedValue(
        (async function* () {
          for (const chunk of mockStreamData) {
            yield chunk;
          }
        })() as any
      );

      const chunks: Array<{ content: string; done: boolean; tokensUsed?: number }> = [];
      const stream = generateWithGrokStream(
        'test-xai-key',
        'grok-2-mini',
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

    it('should track usage tokens from stream', async () => {
      const mockStreamData = [
        {
          choices: [{ delta: { content: 'Test' } }],
          usage: { total_tokens: 20 },
        },
        {
          choices: [{ delta: { content: '' }, finish_reason: 'stop' }],
          usage: { total_tokens: 30 },
        },
      ];

      vi.mocked(mockCompletions.create).mockResolvedValue(
        (async function* () {
          for (const chunk of mockStreamData) {
            yield chunk;
          }
        })() as any
      );

      const chunks: Array<{ content: string; done: boolean; tokensUsed?: number }> = [];
      const stream = generateWithGrokStream(
        'test-xai-key',
        'grok-2',
        'System',
        'User'
      );

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({ content: 'Test', done: false });
      expect(chunks[1]).toEqual({ content: '', done: true, tokensUsed: 30 });
    });

    it('should call API with correct stream parameters', async () => {
      const mockStreamData = [
        {
          choices: [{ delta: { content: 'X' }, finish_reason: 'stop' }],
          usage: { total_tokens: 1 },
        },
      ];

      vi.mocked(mockCompletions.create).mockResolvedValue(
        (async function* () {
          for (const chunk of mockStreamData) {
            yield chunk;
          }
        })() as any
      );

      const stream = generateWithGrokStream(
        'test-xai-key',
        'grok-2',
        'System prompt',
        'User prompt'
      );

      // Consume the stream
      for await (const _ of stream) {
        // Just consume
      }

      expect(mockCompletions.create).toHaveBeenCalledWith({
        model: 'grok-2',
        messages: [
          { role: 'system', content: 'System prompt' },
          { role: 'user', content: 'User prompt' },
        ],
        temperature: 0.7,
        max_tokens: 4096,
        stream: true,
        stream_options: { include_usage: true },
      });
    });
  });
});
