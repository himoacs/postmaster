"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap, Loader2 } from "lucide-react";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { AIProvider } from "@/types";
import { cn } from "@/lib/utils";

interface StreamingOutput {
  provider: string;
  modelId: string;
  content: string;
  isComplete: boolean;
  error?: string;
}

interface LivePreviewPanelProps {
  outputs: Map<string, StreamingOutput>;
  mode: "generating" | "synthesizing";
  synthesisContent?: string;
  rotationInterval?: number; // ms between model switches, default 3000
  className?: string;
}

// Truncate content if too long, showing recent portion
function getPreviewContent(content: string, maxChars: number = 2000): string {
  if (content.length <= maxChars) return content;
  // Show last portion with ellipsis
  return '...' + content.slice(-maxChars);
}

/**
 * LivePreviewPanel shows a streaming "typing" preview during generation/synthesis.
 * Shows a snippet of the last few lines with a gradient fade effect.
 */
export function LivePreviewPanel({
  outputs,
  mode,
  synthesisContent,
  rotationInterval = 3000,
  className,
}: LivePreviewPanelProps) {
  const [activeModelIndex, setActiveModelIndex] = useState(0);
  const [isRotating, setIsRotating] = useState(true);

  // Get list of models that have content
  const modelsWithContent = useMemo(() => {
    const models: Array<{ key: string; output: StreamingOutput }> = [];
    for (const [key, output] of outputs) {
      if (output.content.length > 0) {
        models.push({ key, output });
      }
    }
    return models;
  }, [outputs]);

  // Auto-rotate through models
  useEffect(() => {
    if (!isRotating || modelsWithContent.length <= 1) return;

    const interval = setInterval(() => {
      setActiveModelIndex(prev => (prev + 1) % modelsWithContent.length);
    }, rotationInterval);

    return () => clearInterval(interval);
  }, [isRotating, modelsWithContent.length, rotationInterval]);

  // When a new model starts streaming, focus on it
  useEffect(() => {
    const streamingIndexes = modelsWithContent
      .map((m, i) => ({ ...m, index: i }))
      .filter(m => !m.output.isComplete);
    
    if (streamingIndexes.length > 0) {
      const lastStreaming = streamingIndexes[streamingIndexes.length - 1];
      setActiveModelIndex(lastStreaming.index);
    }
  }, [modelsWithContent]);

  // Auto-scroll to bottom as content streams
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentContent = modelsWithContent[activeModelIndex]?.output.content;
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [synthesisContent, currentContent]);

  // Handle manual model selection
  const selectModel = useCallback((index: number) => {
    setActiveModelIndex(index);
    setIsRotating(false);
    setTimeout(() => setIsRotating(true), 10000);
  }, []);

  const currentModel = modelsWithContent[activeModelIndex] || modelsWithContent[0];

  // Synthesis mode - show synthesis in progress or streaming content
  if (mode === "synthesizing") {
    // If we have streaming content, show it
    if (synthesisContent) {
      const previewText = getPreviewContent(synthesisContent);
      
      return (
        <div className={cn("flex flex-col h-full overflow-hidden", className)}>
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-background/50 flex-shrink-0">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
              <Zap className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-medium">Synthesizing</span>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />
          </div>
          
          {/* Scrollable content area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {previewText}
                <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // No streaming content yet - show processing state
    return (
      <div className={cn("flex flex-col h-full overflow-hidden", className)}>
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-background/50 flex-shrink-0">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
            <Zap className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-medium">Synthesizing</span>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />
        </div>
        
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="relative mx-auto h-12 w-12 mb-4">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Zap className="h-5 w-5 text-primary animate-pulse" />
              </div>
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Combining best elements...
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Creating your optimized content
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Waiting state
  if (!currentModel) {
    return (
      <div className={cn("flex flex-col h-full items-center justify-center overflow-hidden", className)}>
        <div className="text-center px-6">
          <div className="relative mx-auto h-12 w-12">
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Waiting for content...
          </p>
        </div>
      </div>
    );
  }

  const providerInfo = AI_PROVIDERS[currentModel.output.provider as AIProvider];
  const providerName = providerInfo?.name || currentModel.output.provider;
  const previewText = getPreviewContent(currentModel.output.content);

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      {/* Header with model pagination dots */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-background/50 flex-shrink-0">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-medium">Live Preview</span>
        
        {/* Model pagination dots */}
        {modelsWithContent.length > 1 && (
          <div className="flex items-center gap-1.5 ml-auto">
            {modelsWithContent.map((m, i) => {
              const isActive = i === activeModelIndex;
              const isStreaming = !m.output.isComplete;
              
              return (
                <button
                  key={m.key}
                  onClick={() => selectModel(i)}
                  className={cn(
                    "relative h-2 w-2 rounded-full transition-all",
                    isActive 
                      ? "bg-primary scale-125" 
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  )}
                  title={m.output.modelId}
                >
                  {isActive && isStreaming && (
                    <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-50" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Current model label */}
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b flex-shrink-0">
        <Badge variant="outline" className="text-xs font-normal">
          {providerName}
        </Badge>
        <span className="text-xs text-muted-foreground truncate flex-1">
          {currentModel.output.modelId.split("/").pop() || currentModel.output.modelId}
        </span>
        {!currentModel.output.isComplete && (
          <Loader2 className="h-3 w-3 animate-spin text-primary flex-shrink-0" />
        )}
        {currentModel.output.isComplete && (
          <span className="text-xs text-green-600 dark:text-green-400 flex-shrink-0">✓</span>
        )}
      </div>

      {/* Scrollable content area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {previewText}
            {/* Typing cursor */}
            {!currentModel.output.isComplete && (
              <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        </div>
      </div>

      {/* Bottom status - compact */}
      <div className="flex items-center gap-2 px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground flex-shrink-0">
        <span>
          {modelsWithContent.filter(m => m.output.isComplete).length}/{outputs.size} complete
        </span>
        {modelsWithContent.length > 1 && isRotating && (
          <span className="ml-auto opacity-60">Auto-cycling</span>
        )}
      </div>
    </div>
  );
}
