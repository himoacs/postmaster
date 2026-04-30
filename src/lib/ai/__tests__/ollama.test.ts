/**
 * Tests for Ollama provider integration
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../test/setup';
import {
  createOllamaClient,
  validateOllamaConfig,
  fetchOllamaModels,
  generateWithOllama,
  generateWithOllamaStream,
} from '@/lib/ai/ollama';

// Create mock OpenAI client (Ollama uses OpenAI SDK)
const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn(),
    },
  },
};

// Mock API errors
const mockAPIError = {
  ollama: {
    connection_failed: new Error('Failed to connect to Ollama'),
    invalid_model: new Error('Model not found'),
    timeout: new Error('Request timeout'),
  },
};

// Mock the OpenAI SDK constructor
vi.mock('openai', () => {
  class MockOpenAI {
    chat = mockOpenAI.chat;
    constructor() {
      // noop
    }
  }
  return {
    default: MockOpenAI,
  };
});

describe('Ollama Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOllamaClient', () => {
    it('should create client with endpoint', () => {
      const client = createOllamaClient('http://localhost:11434');
      expect(client).toBeDefined();
    });

    it('should create client with endpoint and API key', () => {
      const client = createOllamaClient('http://localhost:11434', 'test-key');
      expect(client).toBeDefined();
    });
  });

  describe('validateOllamaConfig', () => {
    it('should validate a valid Ollama endpoint', async () => {
      server.use(
        http.get('http://localhost:11434/api/tags', () => {
          return HttpResponse.json({
            models: [
              {
                name: 'qwen3:latest',
                model: 'qwen3:latest',
                size: 5200000000,
                details: { parameter_size: '8.2B', quantization_level: 'Q4_K_M' },
              },
              {
                name: 'llama3.3:latest',
                model: 'llama3.3:latest',
                size: 42000000000,
                details: { parameter_size: '70B', quantization_level: 'Q4_K_M' },
              },
              {
                name: 'nomic-embed-text:latest',
                model: 'nomic-embed-text:latest',
                size: 274000000,
                details: { families: ['bert'] },
              },
            ],
          });
        })
      );

      const result = await validateOllamaConfig('http://localhost:11434');

      expect(result.valid).toBe(true);
      expect(result.models).toBeDefined();
      expect(result.models?.length).toBe(2); // Should filter out embedding model
      expect(result.models?.[0].id).toBe('qwen3:latest');
      expect(result.models?.[0].size).toBe(5200000000);
      expect(result.models?.[0].contextWindow).toBe(8192);
      expect(result.models?.[1].id).toBe('llama3.3:latest');
      expect(result.models?.[1].size).toBe(42000000000);
    });

    it('should validate endpoint with optional API key', async () => {
      server.use(
        http.get('http://localhost:11434/api/tags', ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          expect(authHeader).toBe('Bearer test-key');
          
          return HttpResponse.json({
            models: [
              {
                name: 'qwen3:latest',
                model: 'qwen3:latest',
                size: 5200000000,
                details: { parameter_size: '8.2B', quantization_level: 'Q4_K_M' },
              },
            ],
          });
        })
      );

      const result = await validateOllamaConfig('http://localhost:11434', 'test-key');

      expect(result.valid).toBe(true);
    });

    it('should return invalid for connection failure', async () => {
      server.use(
        http.get('http://localhost:11434/api/tags', () => {
          return HttpResponse.error();
        })
      );

      const result = await validateOllamaConfig('http://localhost:11434');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.models).toBeUndefined();
    });

    it('should return invalid for HTTP error response', async () => {
      server.use(
        http.get('http://localhost:11434/api/tags', () => {
          return new HttpResponse(null, { 
            status: 500,
            statusText: 'Internal Server Error',
          });
        })
      );

      const result = await validateOllamaConfig('http://localhost:11434');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Internal Server Error');
    });

    it('should filter out embedding models', async () => {
      server.use(
        http.get('http://localhost:11434/api/tags', () => {
          return HttpResponse.json({
            models: [
              {
                name: 'qwen3:latest',
                model: 'qwen3:latest',
                size: 5200000000,
                details: { parameter_size: '8.2B' },
              },
              {
                name: 'nomic-embed-text:latest',
                model: 'nomic-embed-text:latest',
                size: 274000000,
                details: { families: ['bert'] },
              },
              {
                name: 'mxbai-embed-large:latest',
                model: 'mxbai-embed-large:latest',
                size: 670000000,
                details: {},
              },
            ],
          });
        })
      );

      const result = await validateOllamaConfig('http://localhost:11434');

      expect(result.valid).toBe(true);
      expect(result.models?.length).toBe(1);
      expect(result.models?.[0].id).toBe('qwen3:latest');
    });

    it('should handle timeout errors', async () => {
      server.use(
        http.get('http://localhost:11434/api/tags', () => {
          return HttpResponse.error();
        })
      );

      const result = await validateOllamaConfig('http://localhost:11434');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('fetchOllamaModels', () => {
    it('should fetch and parse Ollama models', async () => {
      server.use(
        http.get('http://localhost:11434/api/tags', () => {
          return HttpResponse.json({
            models: [
              {
                name: 'qwen3:latest',
                model: 'qwen3:latest',
                size: 5200000000,
                details: { parameter_size: '8.2B', quantization_level: 'Q4_K_M' },
              },
            ],
          });
        })
      );

      const models = await fetchOllamaModels('http://localhost:11434');

      expect(models.length).toBe(1);
      expect(models[0].id).toBe('qwen3:latest');
      expect(models[0].provider).toBe('ollama');
      expect(models[0].size).toBe(5200000000);
    });

    it('should handle fetch errors', async () => {
      server.use(
        http.get('http://localhost:11434/api/tags', () => {
          return HttpResponse.error();
        })
      );

      const models = await fetchOllamaModels('http://localhost:11434');
      expect(models).toEqual([]);
    });
  });

  describe('generateWithOllama', () => {
    it('should generate content successfully', async () => {
      mockOpenAI.chat.completions.create = vi.fn().mockResolvedValue({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'qwen3:latest',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'This is the generated content from Ollama.',
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

      const result = await generateWithOllama(
        'http://localhost:11434',
        undefined,
        'qwen3:latest',
        'You are a helpful assistant',
        'Write a test message'
      );

      expect(result.content).toBe('This is the generated content from Ollama.');
      expect(result.tokensUsed).toBe(150);
      
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'qwen3:latest',
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Write a test message' },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      });
    });

    it('should generate content with API key', async () => {
      mockOpenAI.chat.completions.create = vi.fn().mockResolvedValue({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'qwen3:latest',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Test content',
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

      const result = await generateWithOllama(
        'http://localhost:11434',
        'test-key',
        'qwen3:latest',
        'You are a helpful assistant',
        'Test prompt'
      );

      expect(result.content).toBe('Test content');
      expect(result.tokensUsed).toBe(30);
    });

    it('should handle empty response', async () => {
      mockOpenAI.chat.completions.create = vi.fn().mockResolvedValue({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'qwen3:latest',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
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

      const result = await generateWithOllama(
        'http://localhost:11434',
        undefined,
        'qwen3:latest',
        'System prompt',
        'User prompt'
      );

      expect(result.content).toBe('');
      expect(result.tokensUsed).toBe(10);
    });

    it('should handle generation errors', async () => {
      mockOpenAI.chat.completions.create = vi.fn().mockRejectedValue(
        mockAPIError.ollama.invalid_model
      );

      await expect(
        generateWithOllama(
          'http://localhost:11434',
          undefined,
          'invalid-model',
          'System prompt',
          'User prompt'
        )
      ).rejects.toThrow();
    });
  });

  describe('generateWithOllamaStream', () => {
    it('should stream content successfully', async () => {
      // Mock streaming response
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            id: 'chatcmpl-1',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'qwen3:latest',
            choices: [
              {
                index: 0,
                delta: { role: 'assistant', content: 'Hello' },
                finish_reason: null,
              },
            ],
          };
          yield {
            id: 'chatcmpl-2',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'qwen3:latest',
            choices: [
              {
                index: 0,
                delta: { content: ' world' },
                finish_reason: null,
              },
            ],
          };
          yield {
            id: 'chatcmpl-3',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'qwen3:latest',
            choices: [
              {
                index: 0,
                delta: { content: '!' },
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

      const stream = generateWithOllamaStream(
        'http://localhost:11434',
        undefined,
        'qwen3:latest',
        'You are a helpful assistant',
        'Say hello'
      );

      const chunks: Array<{ content: string; done: boolean; tokensUsed?: number }> = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([
        { content: 'Hello', done: false },
        { content: ' world', done: false },
        { content: '!', done: false },
        { content: '', done: true, tokensUsed: 15 },
      ]);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'qwen3:latest',
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Say hello' },
        ],
        temperature: 0.7,
        max_tokens: 4096,
        stream: true,
        stream_options: { include_usage: true },
      });
    });

    it('should handle streaming with API key', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            id: 'chatcmpl-1',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'qwen3:latest',
            choices: [
              {
                index: 0,
                delta: { role: 'assistant', content: 'Test' },
                finish_reason: 'stop',
              },
            ],
            usage: {
              total_tokens: 20,
            },
          };
        },
      };

      mockOpenAI.chat.completions.create = vi.fn().mockResolvedValue(mockStream);

      const stream = generateWithOllamaStream(
        'http://localhost:11434',
        'test-key',
        'qwen3:latest',
        'System prompt',
        'User prompt'
      );

      const chunks: Array<{ content: string; done: boolean; tokensUsed?: number }> = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([
        { content: 'Test', done: false },
        { content: '', done: true, tokensUsed: 20 },
      ]);
    });

    it('should handle empty content in stream', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            id: 'chatcmpl-1',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'qwen3:latest',
            choices: [
              {
                index: 0,
                delta: { role: 'assistant', content: null },
                finish_reason: null,
              },
            ],
          };
          yield {
            id: 'chatcmpl-2',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'qwen3:latest',
            choices: [
              {
                index: 0,
                delta: { content: '' },
                finish_reason: 'stop',
              },
            ],
            usage: {
              total_tokens: 0,
            },
          };
        },
      };

      mockOpenAI.chat.completions.create = vi.fn().mockResolvedValue(mockStream);

      const stream = generateWithOllamaStream(
        'http://localhost:11434',
        undefined,
        'qwen3:latest',
        'System prompt',
        'User prompt'
      );

      const chunks: Array<{ content: string; done: boolean; tokensUsed?: number }> = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([
        { content: '', done: true, tokensUsed: 0 },
      ]);
    });

    it('should handle streaming errors', async () => {
      mockOpenAI.chat.completions.create = vi.fn().mockRejectedValue(
        new Error('Streaming failed')
      );

      const stream = generateWithOllamaStream(
        'http://localhost:11434',
        undefined,
        'qwen3:latest',
        'System prompt',
        'User prompt'
      );

      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of stream) {
          // Consume stream
        }
      }).rejects.toThrow('Streaming failed');
    });
  });
});
