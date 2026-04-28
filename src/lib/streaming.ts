/**
 * Server-Sent Events (SSE) streaming utilities for real-time content updates
 */

export type StreamEventType =
  | "model-start"      // Model started generating
  | "model-chunk"      // Partial content from model
  | "model-complete"   // Model finished generating
  | "model-error"      // Model failed
  | "generation-complete" // All models finished
  | "synthesis-start"  // Synthesis started
  | "synthesis-chunk"  // Partial synthesis content
  | "synthesis-complete"; // Synthesis finished

export interface StreamEvent {
  type: StreamEventType;
  data: Record<string, unknown>;
}

/**
 * Create an SSE-formatted message
 */
export function formatSSE(event: StreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

/**
 * Create a ReadableStream for SSE responses
 */
export function createSSEStream(): {
  stream: ReadableStream<Uint8Array>;
  writer: {
    write: (event: StreamEvent) => void;
    close: () => void;
  };
} {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      // Stream was cancelled by client
    },
  });

  return {
    stream,
    writer: {
      write(event: StreamEvent) {
        try {
          const sseMessage = formatSSE(event);
          controller.enqueue(encoder.encode(sseMessage));
        } catch {
          // Controller may be closed
        }
      },
      close() {
        try {
          controller.close();
        } catch {
          // Already closed
        }
      },
    },
  };
}

/**
 * Parse SSE events from a readable stream (client-side)
 */
export async function* parseSSEStream(
  response: Response
): AsyncGenerator<StreamEvent> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      let currentEvent: string | null = null;
      let currentData: string | null = null;

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7);
        } else if (line.startsWith("data: ")) {
          currentData = line.slice(6);
        } else if (line === "" && currentEvent && currentData) {
          // Empty line marks end of event
          try {
            yield {
              type: currentEvent as StreamEventType,
              data: JSON.parse(currentData),
            };
          } catch {
            // Invalid JSON, skip
          }
          currentEvent = null;
          currentData = null;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
