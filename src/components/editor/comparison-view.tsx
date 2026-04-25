"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Star, Sparkles, Clock, Hash, MessagesSquare, Swords } from "lucide-react";
import { AIProvider, SynthesisStrategy } from "@/types";
import { GenerationOutput } from "@/types";
import { AI_PROVIDERS } from "@/lib/ai/providers";

interface ComparisonViewProps {
  outputs: GenerationOutput[];
  onSynthesize: (starredSections?: { provider: AIProvider; text: string }[]) => void;
  onBack: () => void;
  synthesisStrategy?: SynthesisStrategy;
}

interface StarredSection {
  provider: AIProvider;
  text: string;
}

export function ComparisonView({
  outputs,
  onSynthesize,
  onBack,
  synthesisStrategy = "basic",
}: ComparisonViewProps) {
  const [starredSections, setStarredSections] = useState<StarredSection[]>([]);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="text-xl font-semibold">Compare Outputs</h2>
            <p className="text-sm text-muted-foreground">
              Select text you like and star it, then synthesize the best parts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {synthesisStrategy !== "basic" && (
            <Badge variant="secondary" className="flex items-center gap-1">
              {synthesisStrategy === "debate" ? (
                <>
                  <Swords className="h-3 w-3" />
                  Debate Mode
                </>
              ) : (
                <>
                  <MessagesSquare className="h-3 w-3" />
                  Critique Mode
                </>
              )}
            </Badge>
          )}
          <Button onClick={() => onSynthesize(starredSections)} size="lg">
            <Sparkles className="mr-2 h-4 w-4" />
            {synthesisStrategy === "basic" 
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
        {outputs.map((output, index) => (
          <Card key={index} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {AI_PROVIDERS[output.provider].name}
                  <Badge variant="secondary" className="text-xs font-normal">
                    {output.model}
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {wordCount(output.content)} words
                  </span>
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
              <ScrollArea className="h-[400px] pr-4">
                <div
                  className="prose prose-sm dark:prose-invert max-w-none select-text"
                  onMouseUp={() => handleTextSelection(output.provider)}
                >
                  <ReactMarkdown>{output.content}</ReactMarkdown>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
