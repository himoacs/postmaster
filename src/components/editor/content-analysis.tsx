"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  BookOpen,
  ChevronDown,
  Lightbulb,
  MessageCircle,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

interface ReadabilityResult {
  fleschKincaid: number;
  fleschReadingEase: number;
  avgSentenceLength: number;
  avgSyllablesPerWord: number;
  wordCount: number;
  sentenceCount: number;
  gradeLevel: string;
  difficulty: "easy" | "moderate" | "difficult";
  suggestions: string[];
}

interface ToneScore {
  professional: number;
  casual: number;
  urgent: number;
  friendly: number;
  authoritative: number;
  empathetic: number;
}

interface ToneResult {
  scores: ToneScore;
  dominantTone: string;
  summary: string;
  suggestions: string[];
}

interface ContentAnalysisProps {
  content: string;
  onApplySuggestion?: (suggestion: string) => void;
  embedded?: boolean;
}

const difficultyColors: Record<string, string> = {
  easy: "bg-green-100 text-green-800",
  moderate: "bg-yellow-100 text-yellow-800",
  difficult: "bg-red-100 text-red-800",
};

const toneKeys: (keyof ToneScore)[] = [
  "professional",
  "casual",
  "urgent",
  "friendly",
  "authoritative",
  "empathetic",
];

export function ContentAnalysis({ content, onApplySuggestion, embedded = false }: ContentAnalysisProps) {
  const [readability, setReadability] = useState<ReadabilityResult | null>(null);
  const [tone, setTone] = useState<ToneResult | null>(null);
  const [loadingReadability, setLoadingReadability] = useState(false);
  const [loadingTone, setLoadingTone] = useState(false);
  const [showReadability, setShowReadability] = useState(false);
  const [showTone, setShowTone] = useState(false);

  const analyzeReadability = async () => {
    setLoadingReadability(true);
    try {
      const response = await fetch("/api/analyze/readability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (response.ok) {
        const data = await response.json();
        setReadability(data);
        setShowReadability(true);
      }
    } catch (error) {
      console.error("Readability analysis failed:", error);
    } finally {
      setLoadingReadability(false);
    }
  };

  const analyzeTone = async () => {
    setLoadingTone(true);
    try {
      const response = await fetch("/api/analyze/tone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (response.ok) {
        const data = await response.json();
        setTone(data);
        setShowTone(true);
      }
    } catch (error) {
      console.error("Tone analysis failed:", error);
    } finally {
      setLoadingTone(false);
    }
  };

  const analysisContent = (
    <div className="space-y-4">
      {/* Quick Analysis Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={analyzeReadability}
          disabled={loadingReadability}
        >
          {loadingReadability ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <BookOpen className="mr-2 h-4 w-4" />
          )}
          Readability
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={analyzeTone}
          disabled={loadingTone}
        >
          {loadingTone ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <MessageCircle className="mr-2 h-4 w-4" />
          )}
          Tone
        </Button>
      </div>

      {/* Readability Results */}
      {readability && (
        <Collapsible open={showReadability} onOpenChange={setShowReadability}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="font-medium">Readability</span>
              <Badge
                variant="secondary"
                className={difficultyColors[readability.difficulty]}
              >
                {readability.gradeLevel}
              </Badge>
            </div>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                showReadability ? "rotate-180" : ""
              }`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted/50 p-2">
                <div className="text-muted-foreground">Grade Level</div>
                <div className="font-medium">{readability.fleschKincaid.toFixed(1)}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <div className="text-muted-foreground">Reading Ease</div>
                <div className="font-medium">{readability.fleschReadingEase.toFixed(0)}/100</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <div className="text-muted-foreground">Avg Sentence</div>
                <div className="font-medium">{readability.avgSentenceLength.toFixed(0)} words</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <div className="text-muted-foreground">Sentences</div>
                <div className="font-medium">{readability.sentenceCount}</div>
              </div>
            </div>

            {readability.suggestions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-sm font-medium">
                  <Lightbulb className="h-4 w-4" />
                  Suggestions
                </div>
                {readability.suggestions.map((suggestion, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{suggestion}</span>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Tone Results */}
      {tone && (
        <Collapsible open={showTone} onOpenChange={setShowTone}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span className="font-medium">Tone</span>
              <Badge variant="secondary" className="capitalize">
                {tone.dominantTone}
              </Badge>
            </div>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                showTone ? "rotate-180" : ""
              }`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <p className="text-sm text-muted-foreground">{tone.summary}</p>

            <div className="space-y-2">
              {toneKeys.map((key) => (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{key}</span>
                    <span className="text-muted-foreground">
                      {tone.scores[key]}/10
                    </span>
                  </div>
                  <Progress value={tone.scores[key] * 10} className="h-1.5" />
                </div>
              ))}
            </div>

            {tone.suggestions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-sm font-medium">
                  <Lightbulb className="h-4 w-4" />
                  Suggestions
                </div>
                {tone.suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => onApplySuggestion?.(suggestion)}
                    className="flex w-full items-start gap-2 text-sm text-muted-foreground text-left hover:text-foreground transition-colors"
                  >
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Content Analysis
        </h3>
        {analysisContent}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Content Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        {analysisContent}
      </CardContent>
    </Card>
  );
}
