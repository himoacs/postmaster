"use client";

import { useState, useEffect } from "react";
import { PromptInput, ReferenceSource } from "./prompt-input";
import { ModelSelector } from "./model-selector";
import { ComparisonView } from "./comparison-view";
import { SynthesisView } from "./synthesis-view";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Zap, PenLine } from "lucide-react";
import { AIProvider, YoloSelection } from "@/types";
import { GenerationOutput } from "@/types";

export type WorkspaceState = "input" | "generating" | "comparing" | "synthesizing" | "complete";

// Progress messages for different stages
const GENERATING_MESSAGES = [
  { message: "Preparing your prompt...", duration: 800 },
  { message: "Sending to AI models...", duration: 1200 },
  { message: "Models are thinking...", duration: 2000 },
  { message: "Crafting unique perspectives...", duration: 2500 },
  { message: "Polishing responses...", duration: 2000 },
  { message: "Almost there...", duration: 3000 },
];

const SYNTHESIZING_MESSAGES = [
  { message: "Analyzing all outputs...", duration: 1000 },
  { message: "Identifying key themes...", duration: 1500 },
  { message: "Merging best elements...", duration: 2000 },
  { message: "Harmonizing writing styles...", duration: 1500 },
  { message: "Finalizing content...", duration: 2000 },
];

export interface SelectedModel {
  provider: AIProvider;
  modelId: string;
}

export function WritingWorkspace() {
  const [state, setState] = useState<WorkspaceState>("input");
  const [prompt, setPrompt] = useState("");
  const [contentType, setContentType] = useState("BLOG_POST");
  const [lengthPref, setLengthPref] = useState("medium");
  const [selectedModels, setSelectedModels] = useState<SelectedModel[]>([]);
  const [outputs, setOutputs] = useState<GenerationOutput[]>([]);
  const [synthesis, setSynthesis] = useState<string>("");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [references, setReferences] = useState<ReferenceSource[]>([]);
  
  // Progress state
  const [progressMessage, setProgressMessage] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  
  // YOLO mode state
  const [yoloMode, setYoloMode] = useState(false);
  const [yoloSelection, setYoloSelection] = useState<YoloSelection | null>(null);

  // Progress animation for generating state
  useEffect(() => {
    if (state !== "generating") return;
    
    let messageIndex = 0;
    let totalDuration = 0;
    const messages = GENERATING_MESSAGES;
    const totalTime = messages.reduce((sum, m) => sum + m.duration, 0);
    
    setProgressMessage(messages[0].message);
    setProgressPercent(0);
    
    const interval = setInterval(() => {
      totalDuration += 100;
      const progress = Math.min((totalDuration / totalTime) * 100, 95);
      setProgressPercent(progress);
      
      // Find current message based on elapsed time
      let elapsed = 0;
      for (let i = 0; i < messages.length; i++) {
        elapsed += messages[i].duration;
        if (totalDuration < elapsed) {
          if (i !== messageIndex) {
            messageIndex = i;
            setProgressMessage(messages[i].message);
          }
          break;
        }
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [state]);

  // Progress animation for synthesizing state
  useEffect(() => {
    if (state !== "synthesizing") return;
    
    let messageIndex = 0;
    let totalDuration = 0;
    const messages = SYNTHESIZING_MESSAGES;
    const totalTime = messages.reduce((sum, m) => sum + m.duration, 0);
    
    setProgressMessage(messages[0].message);
    setProgressPercent(0);
    
    const interval = setInterval(() => {
      totalDuration += 100;
      const progress = Math.min((totalDuration / totalTime) * 100, 95);
      setProgressPercent(progress);
      
      // Find current message based on elapsed time
      let elapsed = 0;
      for (let i = 0; i < messages.length; i++) {
        elapsed += messages[i].duration;
        if (totalDuration < elapsed) {
          if (i !== messageIndex) {
            messageIndex = i;
            setProgressMessage(messages[i].message);
          }
          break;
        }
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [state]);

  const handleGenerate = async () => {
    // In YOLO mode, we don't need selected models - server will pick them
    if (!prompt.trim()) return;
    if (!yoloMode && selectedModels.length < 2) return;

    setState("generating");
    setOutputs([]);
    setYoloSelection(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          contentType,
          lengthPref,
          references: references.map(r => ({ type: r.type, value: r.value })),
          ...(yoloMode 
            ? { yoloMode: true }
            : { selectedModels }
          ),
        }),
      });

      if (!response.ok) {
        throw new Error("Generation failed");
      }

      const data = await response.json();
      setGenerationId(data.generationId);
      setOutputs(data.outputs);
      
      // Store YOLO selection info if available
      if (data.yoloSelection) {
        setYoloSelection(data.yoloSelection);
        setSelectedModels(data.yoloSelection.models);
      }
      
      setState("comparing");
    } catch (error) {
      console.error("Generation error:", error);
      setState("input");
    }
  };

  const handleSynthesize = async (starredSections?: { provider: AIProvider; text: string }[]) => {
    setState("synthesizing");

    try {
      const response = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId,
          outputs,
          starredSections,
          primaryModel: selectedModels[0],
        }),
      });

      if (!response.ok) {
        throw new Error("Synthesis failed");
      }

      const data = await response.json();
      setSynthesis(data.content);
      setState("complete");
    } catch (error) {
      console.error("Synthesis error:", error);
      setState("comparing");
    }
  };

  const handleIterate = async (feedback: string) => {
    setState("synthesizing");

    try {
      const response = await fetch("/api/iterate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId,
          currentContent: synthesis,
          feedback,
          selectedModels,
        }),
      });

      if (!response.ok) {
        throw new Error("Iteration failed");
      }

      const data = await response.json();
      setSynthesis(data.content);
      setState("complete");
    } catch (error) {
      console.error("Iteration error:", error);
      setState("complete");
    }
  };

  const handleReset = () => {
    setState("input");
    setOutputs([]);
    setSynthesis("");
    setGenerationId(null);
  };

  return (
    <div className="h-full overflow-auto">
      {state === "input" && (
        <div className="mx-auto max-w-4xl space-y-6 p-6">
          <div className="rounded-lg border bg-card p-6">
            <PromptInput
              prompt={prompt}
              onPromptChange={setPrompt}
              contentType={contentType}
              onContentTypeChange={setContentType}
              lengthPref={lengthPref}
              onLengthPrefChange={setLengthPref}
              references={references}
              onReferencesChange={setReferences}
            />
          </div>

          {/* YOLO Mode Toggle */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="yolo-mode" className="text-base font-medium cursor-pointer">
                    YOLO Mode
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Auto-select optimal models — just write and generate
                  </p>
                </div>
              </div>
              <Switch
                id="yolo-mode"
                checked={yoloMode}
                onCheckedChange={setYoloMode}
              />
            </div>

            {yoloMode && (
              <div className="mt-4 rounded-lg bg-primary/5 p-4">
                <p className="text-sm text-muted-foreground">
                  PostMaster will automatically select 3 high-quality models from different providers 
                  for diverse perspectives. Just enter your prompt and hit generate.
                </p>
                <div className="mt-4">
                  <Button
                    onClick={handleGenerate}
                    disabled={!prompt.trim()}
                    size="lg"
                    className="w-full sm:w-auto"
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Generate with YOLO
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Manual Model Selection (hidden in YOLO mode) */}
          {!yoloMode && (
            <div className="rounded-lg border bg-card p-6">
              <ModelSelector
                selectedModels={selectedModels}
                onModelsChange={setSelectedModels}
                onGenerate={handleGenerate}
                isGenerating={false}
                canGenerate={prompt.trim().length > 0 && selectedModels.length >= 2}
              />
            </div>
          )}
        </div>
      )}

      {state === "generating" && (
        <div className="flex h-full items-center justify-center">
          <div className="w-full max-w-md text-center px-6">
            <div className="relative mx-auto h-16 w-16">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <PenLine className="h-6 w-6 text-primary animate-pulse" />
              </div>
            </div>
            <p className="mt-6 font-serif text-xl">Generating Content</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {yoloMode 
                ? `Using ${selectedModels.length || 3} optimally selected models`
                : `Comparing ${selectedModels.length} models in parallel`
              }
            </p>
            
            {/* Progress bar */}
            <div className="mt-6 space-y-2">
              <Progress value={progressPercent} className="h-2" />
              <p className="text-sm text-muted-foreground animate-pulse">
                {progressMessage}
              </p>
            </div>
            
            {/* Model badges */}
            {(yoloSelection?.models || selectedModels).length > 0 && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {(yoloSelection?.models || selectedModels).map((m, i) => (
                  <Badge 
                    key={`${m.provider}-${m.modelId}`} 
                    variant="secondary"
                    className="transition-opacity"
                    style={{ opacity: progressPercent > (i * 30) ? 1 : 0.4 }}
                  >
                    {m.modelId}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {state === "comparing" && (
        <ComparisonView
          outputs={outputs}
          onSynthesize={handleSynthesize}
          onBack={handleReset}
        />
      )}

      {state === "synthesizing" && (
        <div className="flex h-full items-center justify-center">
          <div className="w-full max-w-md text-center px-6">
            <div className="relative mx-auto h-16 w-16">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Zap className="h-6 w-6 text-primary animate-pulse" />
              </div>
            </div>
            <p className="mt-6 font-serif text-xl">Synthesizing Content</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Combining the best elements from all outputs
            </p>
            
            {/* Progress bar */}
            <div className="mt-6 space-y-2">
              <Progress value={progressPercent} className="h-2" />
              <p className="text-sm text-muted-foreground animate-pulse">
                {progressMessage}
              </p>
            </div>
            
            {/* Visual indicator of merge */}
            <div className="mt-6 flex items-center justify-center gap-2">
              {selectedModels.slice(0, 3).map((m, i) => (
                <div 
                  key={`synth-${m.provider}-${i}`}
                  className="h-3 w-3 rounded-full bg-primary/60 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
              <span className="mx-2 text-muted-foreground">→</span>
              <div className="h-4 w-4 rounded-full bg-primary animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {state === "complete" && (
        <SynthesisView
          content={synthesis}
          generationId={generationId}
          onIterate={handleIterate}
          onBack={handleReset}
          onBackToCompare={() => setState("comparing")}
        />
      )}
    </div>
  );
}
