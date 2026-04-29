"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Star, Sparkles, Clock, Hash, MessagesSquare, Swords, RefreshCw, Replace, AlertTriangle, Loader2, ChevronDown } from "lucide-react";
import { AIProvider, SynthesisStrategy, SelectedModel } from "@/types";
import { GenerationOutput } from "@/types";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ComparisonViewProps {
  outputs: GenerationOutput[];
  onSynthesize: (starredSections?: { provider: AIProvider; text: string }[]) => void;
  onBack: () => void;
  onBackToSynthesis?: () => void;
  hasSynthesis?: boolean;
  synthesisStrategy?: SynthesisStrategy;
  onSynthesisStrategyChange?: (strategy: SynthesisStrategy) => void;
  onRetry?: (index: number, provider: AIProvider, modelId: string) => Promise<void>;
  onSwap?: (index: number, oldProvider: AIProvider, oldModelId: string, newProvider: AIProvider, newModelId: string) => Promise<void>;
  availableModels?: SelectedModel[];
}

interface StarredSection {
  provider: AIProvider;
  text: string;
}

export function ComparisonView({
  outputs,
  onSynthesize,
  onBack,
  onBackToSynthesis,
  hasSynthesis = false,
  synthesisStrategy = "basic",
  onSynthesisStrategyChange,
  onRetry,
  onSwap,
  availableModels = [],
}: ComparisonViewProps) {
  const [starredSections, setStarredSections] = useState<StarredSection[]>([]);
  const [retryingIndex, setRetryingIndex] = useState<number | null>(null);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<{ index: number; provider: AIProvider; modelId: string } | null>(null);
  const [selectedText, setSelectedText] = useState<{
    provider: AIProvider;
    text: string;
  } | null>(null);

  const handleTextSelection = (provider: AIProvider) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (text && text.length > 10) {
      setSelectedText({ provider, text });
    }
  };

  const starSelection = () => {
    if (selectedText) {
      setStarredSections([...starredSections, selectedText]);
      setSelectedText(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  const removeStarredSection = (index: number) => {
    setStarredSections(starredSections.filter((_, i) => i !== index));
  };

  const wordCount = (text: string) => {
    return text.split(/\s+/).filter(Boolean).length;
  };

  const handleRetry = async (index: number, provider: AIProvider, modelId: string) => {
    if (!onRetry) return;
    setRetryingIndex(index);
    try {
      await onRetry(index, provider, modelId);
    } finally {
      setRetryingIndex(null);
    }
  };

  const handleOpenSwapDialog = (index: number, provider: AIProvider, modelId: string) => {
    setSwapTarget({ index, provider, modelId });
    setSwapDialogOpen(true);
  };

  const handleSwapModel = async (newProvider: AIProvider, newModelId: string) => {
    if (!onSwap || !swapTarget) return;
    setSwapDialogOpen(false);
    setRetryingIndex(swapTarget.index);
    try {
      await onSwap(swapTarget.index, swapTarget.provider, swapTarget.modelId, newProvider, newModelId);
    } finally {
      setRetryingIndex(null);
      setSwapTarget(null);
    }
  };

  // Filter available models to exclude ones already in use
  const getAvailableSwapModels = () => {
    const usedModels = new Set(outputs.map(o => `${o.provider}:${o.model}`));
    return availableModels.filter(m => !usedModels.has(`${m.provider}:${m.modelId}`));
  };

  // Check if an output has an error or is empty
  const isOutputFailed = (output: GenerationOutput) => {
    return output.error || !output.content || output.content.trim() === "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {hasSynthesis && onBackToSynthesis && (
            <Button variant="default" size="sm" onClick={onBackToSynthesis}>
              <Sparkles className="mr-2 h-4 w-4" />
              View Final Draft
            </Button>
          )}
          <div>
            <h2 className="text-xl font-semibold">{outputs.length === 1 ? "Review Output" : "Compare Outputs"}</h2>
            <p className="text-sm text-muted-foreground">
              {outputs.length === 1 
                ? "Review your content and polish it, or star sections you like"
                : "Select text you like and star it, then synthesize the best parts"
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Synthesis Strategy Selector */}
          {outputs.length > 1 && onSynthesisStrategyChange && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Synthesis:</span>
                <HelpTooltip
                  content={
                    <div className="space-y-3">
                      <p className="font-semibold text-foreground">Choose Your Synthesis Approach</p>
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="font-medium text-foreground">Basic (~1x time)</p>
                          <p className="text-muted-foreground">Fast direct merge of outputs without critique.</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Critique (~3x time)</p>
                          <p className="text-muted-foreground">Models review each other's work before synthesis.</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Debate (~5x time)</p>
                          <p className="text-muted-foreground">Multi-round debate to reach consensus and best quality.</p>
                        </div>
                      </div>
                    </div>
                  }
                />
              </div>
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  {synthesisStrategy === "debate" ? (
                    <>
                      <Swords className="h-4 w-4" />
                      Debate
                    </>
                  ) : synthesisStrategy === "sequential" ? (
                    <>
                      <MessagesSquare className="h-4 w-4" />
                      Critique
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Basic
                    </>
                  )}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem 
                  onClick={() => onSynthesisStrategyChange("basic")}
                  className="flex flex-col items-start gap-1 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    <span className="font-medium">Basic</span>
                    <Badge variant="outline" className="ml-auto text-xs">~1x</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground pl-6">Fast direct merge</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onSynthesisStrategyChange("sequential")}
                  className="flex flex-col items-start gap-1 py-2"
                >
                  <div className="flex items-center gap-2">
                    <MessagesSquare className="h-4 w-4" />
                    <span className="font-medium">Critique</span>
                    <Badge variant="secondary" className="ml-auto text-xs">~3x</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground pl-6">Models review each other</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onSynthesisStrategyChange("debate")}
                  className="flex flex-col items-start gap-1 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Swords className="h-4 w-4" />
                    <span className="font-medium">Debate</span>
                    <Badge variant="default" className="ml-auto text-xs">~5x</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground pl-6">Multi-round consensus</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          )}
          <Button onClick={() => onSynthesize(starredSections)} size="lg">
            <Sparkles className="mr-2 h-4 w-4" />
            {outputs.length === 1 
              ? "Polish & Finalize"
              : synthesisStrategy === "basic" 
                ? `Synthesize${starredSections.length > 0 ? ` (${starredSections.length} starred)` : ""}`
                : synthesisStrategy === "debate"
                  ? "Start Debate & Synthesize"
                  : "Critique & Synthesize"
            }
          </Button>
        </div>
      </div>

      {/* Starred sections */}
      {starredSections.length > 0 && (
        <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
              Starred Sections ({starredSections.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {starredSections.map((section, index) => (
              <div
                key={index}
                className="flex items-start gap-2 rounded-md bg-background p-2 text-sm"
              >
                <Badge variant="outline" className="shrink-0">
                  {AI_PROVIDERS[section.provider].name}
                </Badge>
                <p className="flex-1 line-clamp-2">{section.text}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeStarredSection(index)}
                >
                  ×
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Selection action bar */}
      {selectedText && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <Card className="shadow-lg">
            <CardContent className="flex items-center gap-3 p-3">
              <span className="text-sm text-muted-foreground">
                Selected from {AI_PROVIDERS[selectedText.provider].name}
              </span>
              <Button size="sm" onClick={starSelection}>
                <Star className="mr-2 h-4 w-4" />
                Star Selection
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedText(null);
                  window.getSelection()?.removeAllRanges();
                }}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Output cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {outputs.map((output, index) => {
          const isFailed = isOutputFailed(output);
          const isRetrying = retryingIndex === index;

          return (
            <Card key={index} className={`flex flex-col ${isFailed ? "border-destructive/50" : ""}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {AI_PROVIDERS[output.provider]?.name || output.provider}
                    <Badge variant="secondary" className="text-xs font-normal">
                      {output.model}
                    </Badge>
                    {isFailed && (
                      <Badge variant="destructive" className="text-xs">
                        Failed
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {!isFailed && (
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {wordCount(output.content)} words
                      </span>
                    )}
                    {output.latencyMs && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {(output.latencyMs / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                {isFailed ? (
                  // Error state - show retry/swap options
                  <div className="h-[400px] flex flex-col items-center justify-center text-center p-6 space-y-4">
                    {isRetrying ? (
                      <>
                        <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
                        <p className="text-muted-foreground">Regenerating...</p>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-10 w-10 text-destructive/60" />
                        <div className="space-y-1">
                          <p className="font-medium">This model returned no content</p>
                          <p className="text-sm text-muted-foreground">
                            {output.error || "The model returned an empty response after automatic retry."}
                          </p>
                        </div>
                        <div className="flex gap-2 pt-2">
                          {onRetry && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetry(index, output.provider, output.model)}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Retry
                            </Button>
                          )}
                          {onSwap && availableModels.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenSwapDialog(index, output.provider, output.model)}
                            >
                              <Replace className="mr-2 h-4 w-4" />
                              Swap Model
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  // Success state - show content
                  <ScrollArea className="h-[400px] pr-4">
                    <div
                      className="prose prose-sm prose-editorial dark:prose-invert max-w-none select-text"
                      onMouseUp={() => handleTextSelection(output.provider)}
                    >
                      <ReactMarkdown
                        components={{
                          a: ({ href, children }) => {
                            // Handle citation links - show URL and open externally
                            const handleClick = (e: React.MouseEvent) => {
                              e.preventDefault();
                              if (href) {
                                window.open(href, '_blank', 'noopener,noreferrer');
                              }
                            };
                            return (
                              <span
                                onClick={handleClick}
                                className="text-primary underline cursor-pointer hover:text-primary/80"
                                title={href}
                              >
                                {children}
                                {href && <span className="text-muted-foreground text-xs ml-1">({href})</span>}
                              </span>
                            );
                          }
                        }}
                      >{output.content}</ReactMarkdown>
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Model Swap Dialog */}
      <Dialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Swap to a Different Model</DialogTitle>
            <DialogDescription>
              Choose a model to replace {swapTarget && AI_PROVIDERS[swapTarget.provider]?.name} ({swapTarget?.modelId})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {getAvailableSwapModels().map((model) => (
              <Button
                key={`${model.provider}:${model.modelId}`}
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleSwapModel(model.provider, model.modelId)}
              >
                <span className="font-medium">{AI_PROVIDERS[model.provider]?.name || model.provider}</span>
                <span className="ml-2 text-muted-foreground">{model.modelId}</span>
              </Button>
            ))}
            {getAvailableSwapModels().length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No other models available. Configure more models in Settings.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
