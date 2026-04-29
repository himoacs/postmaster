"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type WorkspaceStep = "input" | "generating" | "comparing" | "critiquing" | "synthesizing" | "iterating" | "complete";

interface WorkflowProgressProps {
  currentStep: WorkspaceStep;
  className?: string;
}

const steps = [
  { id: "input", label: "Input", shortLabel: "Input" },
  { id: "generating", label: "Generating", shortLabel: "Generate" },
  { id: "comparing", label: "Comparing", shortLabel: "Compare" },
  { id: "synthesizing", label: "Synthesizing", shortLabel: "Synthesize" },
  { id: "complete", label: "Complete", shortLabel: "Done" },
] as const;

// Map workspace states to step indices
const stepOrder: Record<WorkspaceStep, number> = {
  input: 0,
  generating: 1,
  comparing: 2,
  critiquing: 3, // Between comparing and synthesizing
  synthesizing: 3,
  iterating: 3, // Between synthesizing and complete
  complete: 4,
};

/**
 * Visual progress indicator showing where user is in the content generation workflow
 * Displays: Input → Generate → Compare → Synthesize → Complete
 */
export function WorkflowProgress({ currentStep, className }: WorkflowProgressProps) {
  const currentStepIndex = stepOrder[currentStep];

  // For critique and iterate states, show them in progress messages but don't add separate steps
  const showingCritique = currentStep === "critiquing";
  const showingIterate = currentStep === "iterating";

  return (
    <div className={cn("w-full max-w-3xl mx-auto", className)}>
      <nav aria-label="Progress">
        <ol className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isLast = index === steps.length - 1;

            return (
              <li key={step.id} className="relative flex-1 flex items-center">
                {/* Step Circle */}
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={cn(
                      "relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                      isCompleted && "bg-primary border-primary",
                      isCurrent && "border-primary bg-primary/10",
                      !isCompleted && !isCurrent && "border-muted bg-background"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4 text-primary-foreground" />
                    ) : (
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isCurrent && "text-primary",
                          !isCurrent && "text-muted-foreground"
                        )}
                      >
                        {index + 1}
                      </span>
                    )}
                  </div>

                  {/* Step Label */}
                  <span
                    className={cn(
                      "mt-2 text-xs font-medium text-center",
                      isCurrent && "text-primary",
                      isCompleted && "text-foreground",
                      !isCompleted && !isCurrent && "text-muted-foreground"
                    )}
                  >
                    <span className="hidden sm:inline">{step.label}</span>
                    <span className="sm:hidden">{step.shortLabel}</span>
                  </span>

                  {/* Sub-step indicators for critique/iterate */}
                  {isCurrent && (showingCritique || showingIterate) && (
                    <span className="mt-1 text-[10px] text-primary/80 animate-pulse">
                      {showingCritique && "Critiquing..."}
                      {showingIterate && "Refining..."}
                    </span>
                  )}
                </div>

                {/* Connector Line */}
                {!isLast && (
                  <div
                    className={cn(
                      "absolute left-[calc(50%+1rem)] right-[calc(-50%+1rem)] top-4 h-0.5 transition-colors",
                      isCompleted ? "bg-primary" : "bg-muted"
                    )}
                    style={{ transform: "translateY(-50%)" }}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Progress percentage (optional) */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>
          Step {currentStepIndex + 1} of {steps.length}
        </span>
        <span>·</span>
        <span>{Math.round(((currentStepIndex + 1) / steps.length) * 100)}% complete</span>
      </div>
    </div>
  );
}
