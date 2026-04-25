"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { MessagesSquare, Swords } from "lucide-react";
import { GenerationOutput, SelectedModel, SynthesisStrategy } from "@/types";

interface CritiqueViewProps {
  outputs: GenerationOutput[];
  selectedModels: SelectedModel[];
  strategy: SynthesisStrategy;
  progressMessage: string;
  progressPercent: number;
}

export function CritiqueView({
  outputs,
  selectedModels,
  strategy,
  progressMessage,
  progressPercent,
}: CritiqueViewProps) {
  const isDebate = strategy === "debate";

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-lg text-center px-6">
        {/* Icon animation */}
        <div className="relative mx-auto h-20 w-20">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            {isDebate ? (
              <Swords className="h-8 w-8 text-primary animate-pulse" />
            ) : (
              <MessagesSquare className="h-8 w-8 text-primary animate-pulse" />
            )}
          </div>
        </div>

        {/* Title */}
        <p className="mt-6 font-serif text-xl">
          {isDebate ? "Multi-Model Debate" : "Cross-Model Critique"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {isDebate 
            ? "Models are debating to find the best approach"
            : "Models are analyzing each other's outputs"
          }
        </p>

        {/* Progress bar */}
        <div className="mt-6 space-y-2">
          <Progress value={progressPercent} className="h-2" />
          <p className="text-sm text-muted-foreground animate-pulse">
            {progressMessage}
          </p>
        </div>

        {/* Model interaction visualization */}
        <div className="mt-8 relative">
          <div className="flex justify-center gap-4">
            {selectedModels.slice(0, 3).map((model, index) => (
              <div
                key={`${model.provider}-${model.modelId}`}
                className="flex flex-col items-center"
              >
                <div 
                  className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center animate-pulse"
                  style={{ animationDelay: `${index * 200}ms` }}
                >
                  <span className="text-xs font-medium text-primary">
                    {model.modelId.slice(0, 4).toUpperCase()}
                  </span>
                </div>
                <Badge variant="outline" className="mt-2 text-xs">
                  {model.modelId.split("-")[0]}
                </Badge>
              </div>
            ))}
          </div>

          {/* Connection lines for debate */}
          {isDebate && selectedModels.length >= 2 && (
            <div className="absolute inset-0 pointer-events-none">
              <svg className="w-full h-full" viewBox="0 0 200 60">
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon
                      points="0 0, 10 3.5, 0 7"
                      className="fill-primary/40"
                    />
                  </marker>
                </defs>
                {/* Animated debate arrows */}
                <path
                  d="M 50 30 Q 100 10 150 30"
                  className="stroke-primary/40 fill-none animate-pulse"
                  strokeWidth="1"
                  markerEnd="url(#arrowhead)"
                  style={{ animationDelay: "0ms" }}
                />
                <path
                  d="M 150 35 Q 100 55 50 35"
                  className="stroke-primary/40 fill-none animate-pulse"
                  strokeWidth="1"
                  markerEnd="url(#arrowhead)"
                  style={{ animationDelay: "500ms" }}
                />
              </svg>
            </div>
          )}
        </div>

        {/* Outputs being critiqued */}
        <div className="mt-8 text-left">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
            Analyzing {outputs.length} drafts
          </p>
          <div className="space-y-2">
            {outputs.map((output, index) => (
              <div
                key={`output-${output.provider}-${index}`}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
              >
                <div 
                  className="h-2 w-2 rounded-full bg-primary animate-pulse"
                  style={{ animationDelay: `${index * 300}ms` }}
                />
                <span className="text-sm">
                  Draft {index + 1}: {output.model}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {output.content.length} chars
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Strategy explanation */}
        <div className="mt-6 p-4 rounded-lg bg-muted/30 text-left">
          <p className="text-xs text-muted-foreground">
            {isDebate ? (
              <>
                <strong>Debate Mode:</strong> Models engage in multiple rounds of critique and 
                counter-critique until they reach consensus on the best approach.
              </>
            ) : (
              <>
                <strong>Sequential Critique:</strong> Each model evaluates all drafts, 
                identifying strengths, weaknesses, and suggestions for improvement.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
