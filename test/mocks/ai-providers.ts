/**
 * Mock factories for AI providers
 * Mocks the external AI SDK calls for testing
 */
import { vi } from 'vitest';

/**
 * Mock OpenAI SDK
 */
export const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'This is a mock OpenAI response for testing.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 100,
          total_tokens: 150,
        },
      }),
    },
  },
  images: {
    generate: vi.fn().mockResolvedValue({
      data: [
        {
          url: 'https://example.com/mock-image.png',
          revised_prompt: 'Mock revised prompt',
        },
      ],
    }),
  },
};

/**
 * Mock Anthropic SDK
 */
export const mockAnthropic = {
  messages: {
    create: vi.fn().mockResolvedValue({
      id: 'msg-test',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'This is a mock Anthropic response for testing.',
        },
      ],
      model: 'claude-3-5-sonnet-20241022',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 50,
        output_tokens: 100,
      },
    }),
  },
};

/**
 * Mock Mistral SDK
 */
export const mockMistral = {
  chat: {
    complete: vi.fn().mockResolvedValue({
      id: 'mistral-test',
      object: 'chat.completion',
      created: Date.now(),
      model: 'mistral-large-latest',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a mock Mistral response for testing.',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 50,
        completion_tokens: 100,
        total_tokens: 150,
      },
    }),
  },
};

/**
 * Mock Grok (xAI) - uses OpenAI-compatible API
 */
export const mockGrok = {
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        id: 'grok-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'grok-2',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'This is a mock Grok response for testing.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 100,
          total_tokens: 150,
        },
      }),
    },
  },
};

/**
 * Mock LiteLLM (uses OpenAI-compatible API)
 */
export const mockLiteLLM = {
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        id: 'litellm-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'This is a mock LiteLLM response for testing.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 100,
          total_tokens: 150,
        },
      }),
    },
  },
  models: {
    list: vi.fn().mockResolvedValue({
      data: [
        { id: 'gpt-4o', object: 'model' },
        { id: 'claude-3-5-sonnet', object: 'model' },
        { id: 'grok-2', object: 'model' },
      ],
    }),
  },
};

/**
 * Mock streaming response for any provider
 */
export function createMockStream(chunks: string[]) {
  let index = 0;
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of chunks) {
        yield {
          choices: [
            {
              delta: { content: chunk },
              finish_reason: index === chunks.length - 1 ? 'stop' : null,
            },
          ],
        };
        index++;
      }
    },
  };
}

/**
 * Mock error responses
 */
export const mockAPIError = {
  openai: {
    rate_limit: new Error('Rate limit exceeded'),
    invalid_key: new Error('Invalid API key'),
    timeout: new Error('Request timeout'),
  },
  anthropic: {
    rate_limit: new Error('rate_limit_error'),
    invalid_key: new Error('authentication_error'),
    timeout: new Error('timeout_error'),
  },
  mistral: {
    rate_limit: new Error('Rate limit error'),
    invalid_key: new Error('Authentication error'),
    timeout: new Error('Connection timeout'),
  },
};

/**
 * Reset all mocks
 */
export function resetAIMocks() {
  mockOpenAI.chat.completions.create.mockClear();
  mockOpenAI.images.generate.mockClear();
  mockAnthropic.messages.create.mockClear();
  mockMistral.chat.complete.mockClear();
  mockGrok.chat.completions.create.mockClear();
  mockLiteLLM.chat.completions.create.mockClear();
  mockLiteLLM.models.list.mockClear();
}
