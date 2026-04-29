"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TourStep {
  title: string;
  description: string;
  target?: string; // CSS selector for element to highlight
  position?: "top" | "bottom" | "left" | "right";
}

const tourSteps: TourStep[] = [
  {
    title: "Welcome to PostMaster! 🎉",
    description: "Take a quick tour to learn how to generate amazing content using multiple AI models.",
  },
  {
    title: "Write Your Prompt",
    description: "Start by describing what you want to write. Be specific about your topic, key points, and desired angle.",
    target: "[data-tour='prompt-input']",
    position: "bottom",
  },
  {
    title: "Select AI Models",
    description: "Choose 2-4 different AI models to generate diverse perspectives. Each model brings unique strengths.",
    target: "[data-tour='model-selector']",
    position: "top",
  },
  {
    title: "YOLO Mode",
    description: "Let PostMaster auto-select optimal models for you. Perfect for quick content generation!",
    target: "[data-tour='yolo-mode']",
    position: "right",
  },
  {
    title: "Knowledge Base",
    description: "Add reference materials to help AI models generate more accurate, informed content.",
    target: "[data-tour='knowledge-base']",
    position: "top",
  },
  {
    title: "Compare & Synthesize",
    description: "After generation, compare outputs from different models and synthesize the best parts into one perfect piece.",
  },
  {
    title: "You're Ready!",
    description: "Start creating amazing content with the power of multiple AI models. Your work is auto-saved as you type.",
  },
];

interface ProductTourProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

/**
 * Interactive product tour for first-time users
 * Highlights key features and guides through the workflow
 */
export function ProductTour({ onComplete, onSkip }: ProductTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has completed the tour
    const tourCompleted = localStorage.getItem("tour-completed");
    if (!tourCompleted) {
      // Show tour after a short delay
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("tour-completed", "true");
    setIsVisible(false);
    onComplete?.();
  };

  const handleSkip = () => {
    localStorage.setItem("tour-completed", "true");
    setIsVisible(false);
    onSkip?.();
  };

  if (!isVisible) return null;

  const step = tourSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tourSteps.length - 1;

  // Calculate position for tooltip
  const getPosition = () => {
    if (!step.target) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    
    // In a real implementation, we'd calculate based on the target element
    // For now, center it
    return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 z-50 animate-in fade-in duration-300" />

      {/* Tour Card */}
      <Card 
        className="fixed z-50 w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300"
        style={getPosition()}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{step.title}</CardTitle>
              <CardDescription className="mt-2">{step.description}</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mt-1 -mr-1"
              onClick={handleSkip}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardFooter className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  index === currentStep ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            )}
            
            {isFirstStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
              >
                Skip Tour
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleNext}
            >
              {isLastStep ? (
                <>
                  <Check className="mr-1 h-4 w-4" />
                  Got it!
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </>
  );
}

/**
 * Hook to manually trigger the tour
 */
export function useProductTour() {
  const startTour = () => {
    localStorage.removeItem("tour-completed");
    window.location.reload(); // Simple approach - reload to restart tour
  };

  return { startTour };
}
