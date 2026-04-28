"use client";

import { useState, useCallback, useRef } from "react";
import { parseSSEStream, StreamEvent } from "@/lib/streaming";
import { SelectedModel, GenerationOutput, AIProvider } from "@/types";

interface StreamingOutput {
  provider: string;
  modelId: string;
  content: string;
  isComplete: boolean;
  error?: string;
  tokensUsed?: number;
  latencyMs?: number;
}

interface UseStreamingGenerationOptions {
  onChunk?: (provider: string, modelId: string, content: string, accumulated: string) => void;
  onModelComplete?: (output: GenerationOutput) => void;
  onComplete?: (outputs: GenerationOutput[], failedModels?: Array<{ provider: string; model: string; error: string }>) => void;
  onError?: (error: string) => void;
}

interface StreamingState {
  isGenerating: boolean;
  outputs: Map<string, StreamingOutput>;
  generationId: string | null;
  yoloSelection?: {
    models: SelectedModel[];
    reasoning: string[];
  };
  completedOutputs: GenerationOutput[];
  failedModels: Array<{ provider: string; model: string; error: string }>;
  currentStreamingModel: string | null;
}

export function useStreamingGeneration(options: UseStreamingGenerationOptions = {}) {
  const [state, setState] = useState<StreamingState>({
    isGenerating: false,
    outputs: new Map(),
    generationId: null,
    completedOutputs: [],
    failedModels: [],
    currentStreamingModel: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (request: {
    prompt: string;
    contentType: string;
    lengthPref: string;
    selectedModels?: SelectedModel[];
    yoloMode?: boolean;
    references?: Array<{ type: "url" | "text"; value: string }>;
    enableCitations?: boolean;
    contentMode?: "new" | "enhance";
    existingContent?: string;
  }) => {
    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setState({
      isGenerating: true,
      outputs: new Map(),
      generationId: null,
      completedOutputs: [],
      failedModels: [],
      currentStreamingModel: null,
    });

    try {
      const response = await fetch("/api/generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Generation failed");
      }

      // Parse SSE events
      for await (const event of parseSSEStream(response)) {
        if (abortController.signal.aborted) break;

        handleEvent(event, options, setState);
      }

    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return; // Request was cancelled
      }
      
      const errorMessage = error instanceof Error ? error.message : "Generation failed";
      options.onError?.(errorMessage);
      
      setState(prev => ({
        ...prev,
        isGenerating: false,
      }));
    }
  }, [options]);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isGenerating: false,
    }));
  }, []);

  // Get the current streaming model's content for the preview
  const getPreviewContent = useCallback((): { provider: string; modelId: string; content: string } | null => {
    const { outputs, currentStreamingModel } = state;
    
    if (currentStreamingModel) {
      const output = outputs.get(currentStreamingModel);
      if (output) {
        return {
          provider: output.provider,
          modelId: output.modelId,
          content: output.content,
        };
      }
    }
    
    // Find any model that's still streaming
    for (const [, output] of outputs) {
      if (!output.isComplete && output.content) {
        return {
          provider: output.provider,
          modelId: output.modelId,
          content: output.content,
        };
      }
    }
    
    return null;
  }, [state]);

  // Get all outputs as an array for display
  const getAllOutputs = useCallback((): StreamingOutput[] => {
    return Array.from(state.outputs.values());
  }, [state.outputs]);

  return {
    isGenerating: state.isGenerating,
    outputs: state.outputs,
    generationId: state.generationId,
    yoloSelection: state.yoloSelection,
    completedOutputs: state.completedOutputs,
    failedModels: state.failedModels,
    currentStreamingModel: state.currentStreamingModel,
    generate,
    cancel,
    getPreviewContent,
    getAllOutputs,
  };
}

function handleEvent(
  event: StreamEvent,
  options: UseStreamingGenerationOptions,
  setState: React.Dispatch<React.SetStateAction<StreamingState>>
) {
  const { data } = event;

  switch (event.type) {
    case "model-start": {
      const { generationId, models, yoloSelection } = data as {
        generationId: string;
        models: SelectedModel[];
        yoloSelection?: { models: SelectedModel[]; reasoning: string[] };
      };

      // Initialize outputs for all models
      const outputs = new Map<string, StreamingOutput>();
      for (const model of models) {
        const key = `${model.provider}:${model.modelId}`;
        outputs.set(key, {
          provider: model.provider,
          modelId: model.modelId,
          content: "",
          isComplete: false,
        });
      }

      setState(prev => ({
        ...prev,
        generationId,
        yoloSelection,
        outputs,
        currentStreamingModel: models[0] ? `${models[0].provider}:${models[0].modelId}` : null,
      }));
      break;
    }

    case "model-chunk": {
      const { provider, modelId, content, accumulated } = data as {
        provider: string;
        modelId: string;
        content: string;
        accumulated: string;
      };

      const key = `${provider}:${modelId}`;

      setState(prev => {
        const outputs = new Map(prev.outputs);
        const existing = outputs.get(key);
        outputs.set(key, {
          ...existing,
          provider,
          modelId,
          content: accumulated,
          isComplete: false,
        });
        return {
          ...prev,
          outputs,
          currentStreamingModel: key,
        };
      });

      options.onChunk?.(provider, modelId, content, accumulated);
      break;
    }

    case "model-complete": {
      const { provider, modelId, content, tokensUsed, latencyMs, error } = data as {
        provider: string;
        modelId: string;
        content: string;
        tokensUsed: number;
        latencyMs: number;
        error?: string;
      };

      const key = `${provider}:${modelId}`;
      const output: GenerationOutput = {
        provider: provider as AIProvider,
        model: modelId,
        content,
        tokensUsed,
        latencyMs,
        error,
      };

      setState(prev => {
        const outputs = new Map(prev.outputs);
        outputs.set(key, {
          provider,
          modelId,
          content,
          isComplete: true,
          error,
          tokensUsed,
          latencyMs,
        });
        return {
          ...prev,
          outputs,
          completedOutputs: [...prev.completedOutputs, output],
        };
      });

      options.onModelComplete?.(output);
      break;
    }

    case "model-error": {
      const { provider, modelId, error } = data as {
        provider: string;
        modelId: string;
        error: string;
      };

      const key = `${provider}:${modelId}`;

      setState(prev => {
        const outputs = new Map(prev.outputs);
        const existing = outputs.get(key);
        outputs.set(key, {
          ...existing,
          provider,
          modelId,
          content: existing?.content || "",
          isComplete: true,
          error,
        });
        return {
          ...prev,
          outputs,
          failedModels: [...prev.failedModels, { provider, model: modelId, error }],
        };
      });
      break;
    }

    case "generation-complete": {
      const { generationId, outputs: finalOutputs, failedModels, yoloSelection, error } = data as {
        generationId?: string;
        outputs?: GenerationOutput[];
        failedModels?: Array<{ provider: string; model: string; error: string }>;
        yoloSelection?: { models: SelectedModel[]; reasoning: string[] };
        error?: string;
      };

      if (error) {
        options.onError?.(error);
      } else if (finalOutputs) {
        options.onComplete?.(finalOutputs, failedModels);
      }

      setState(prev => ({
        ...prev,
        isGenerating: false,
        generationId: generationId || prev.generationId,
        yoloSelection: yoloSelection || prev.yoloSelection,
      }));
      break;
    }
  }
}
