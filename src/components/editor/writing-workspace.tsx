"use client";

import { useState, useEffect } from "react";
import { PromptInput, ReferenceSource } from "./prompt-input";
import { ModelSelector } from "./model-selector";
import { ComparisonView } from "./comparison-view";
import { SynthesisView } from "./synthesis-view";
import { CritiqueView } from "./critique-view";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Zap, PenLine, MessagesSquare, Sparkles, Swords } from "lucide-react";
import { toast } from "sonner";
import { AIProvider, YoloSelection, SynthesisStrategy, CritiqueOutput, DebateSession, SynthesisReasoning } from "@/types";
import { GenerationOutput } from "@/types";

export type WorkspaceState = "input" | "generating" | "comparing" | "critiquing" | "synthesizing" | "complete";

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

const CRITIQUING_MESSAGES = [
  { message: "Models are reviewing each other's work...", duration: 1200 },
  { message: "Identifying strengths and weaknesses...", duration: 1500 },
  { message: "Finding consensus points...", duration: 1800 },
  { message: "Generating improvement suggestions...", duration: 2000 },
  { message: "Compiling critique insights...", duration: 1500 },
];

const DEBATE_MESSAGES = [
  { message: "Starting multi-model debate...", duration: 1000 },
  { message: "Round 1: Models sharing initial critiques...", duration: 2500 },
  { message: "Models responding to critiques...", duration: 2000 },
  { message: "Round 2: Refining perspectives...", duration: 2500 },
  { message: "Building toward consensus...", duration: 2000 },
  { message: "Final synthesis in progress...", duration: 2500 },
];

export interface SelectedModel {
  provider: AIProvider;
  modelId: string;
}

export interface WritingWorkspaceProps {
  initialGenerationId?: string | null;
  initialPrompt?: string;
  initialContentType?: string;
  initialOutputs?: GenerationOutput[];
  initialSynthesis?: string;
  initialSynthesisId?: string | null;
  initialState?: WorkspaceState;
}

export function WritingWorkspace({
  initialGenerationId = null,
  initialPrompt = "",
  initialContentType = "BLOG_POST",
  initialOutputs = [],
  initialSynthesis = "",
  initialSynthesisId = null,
  initialState = "input",
}: WritingWorkspaceProps = {}) {
  const [state, setState] = useState<WorkspaceState>(initialState);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [contentType, setContentType] = useState(initialContentType);
  const [lengthPref, setLengthPref] = useState("medium");
  const [selectedModels, setSelectedModels] = useState<SelectedModel[]>(() =>
    initialOutputs.map((output) => ({
      provider: output.provider,
      modelId: output.model,
    }))
  );
  const [outputs, setOutputs] = useState<GenerationOutput[]>(initialOutputs);
  const [synthesis, setSynthesis] = useState<string>(initialSynthesis);
  const [synthesisId, setSynthesisId] = useState<string | null>(initialSynthesisId);
  const [synthesisReasoning, setSynthesisReasoning] = useState<SynthesisReasoning | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(initialGenerationId);
  const [references, setReferences] = useState<ReferenceSource[]>([]);
  
  // Progress state
  const [progressMessage, setProgressMessage] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  
  // YOLO mode state
  const [yoloMode, setYoloMode] = useState(false);
  const [yoloSelection, setYoloSelection] = useState<YoloSelection | null>(null);
  
  // Synthesis strategy state
  const [synthesisStrategy, setSynthesisStrategy] = useState<SynthesisStrategy>("basic");
  const [critiques, setCritiques] = useState<CritiqueOutput[]>([]);
  const [debateSession, setDebateSession] = useState<DebateSession | null>(null);
  
  // Parent-child versioning: tracks the previous synthesis when regenerating
  const [parentSynthesisId, setParentSynthesisId] = useState<string | null>(null);
  
  // Knowledge base state
  const [selectedKnowledge, setSelectedKnowledge] = useState<string[]>([]);
  
  // Citations state
  const [enableCitations, setEnableCitations] = useState(false);
  
  // User's preferred primary model for synthesis
  const [userPrimaryModel, setUserPrimaryModel] = useState<SelectedModel | null>(null);

  // Load user preferences on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        const response = await fetch("/api/preferences");
        if (response.ok) {
          const prefs = await response.json();
          setSynthesisStrategy(prefs.synthesisStrategy);
          // Load user's primary model if set
          if (prefs.primaryModelProvider && prefs.primaryModelId) {
            setUserPrimaryModel({
              provider: prefs.primaryModelProvider,
              modelId: prefs.primaryModelId,
            });
          }
        }
      } catch (error) {
        console.error("Failed to load preferences:", error);
      }
    }
    loadPreferences();
  }, []);

  // Get the effective primary model: user preference > first selected model
  const getEffectivePrimaryModel = (): SelectedModel => {
    // If user has set a primary model in preferences, use it
    if (userPrimaryModel) {
      return userPrimaryModel;
    }
    // Otherwise fall back to the first selected model
    return selectedModels[0] || { provider: "OPENAI" as const, modelId: "gpt-4o" };
  };

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

  // Progress animation for critiquing state
  useEffect(() => {
    if (state !== "critiquing") return;
    
    let messageIndex = 0;
    let totalDuration = 0;
    const messages = synthesisStrategy === "debate" ? DEBATE_MESSAGES : CRITIQUING_MESSAGES;
    const totalTime = messages.reduce((sum, m) => sum + m.duration, 0);
    
    setProgressMessage(messages[0].message);
    setProgressPercent(0);
    
    const interval = setInterval(() => {
      totalDuration += 100;
      const progress = Math.min((totalDuration / totalTime) * 100, 95);
      setProgressPercent(progress);
      
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
  }, [state, synthesisStrategy]);

  const handleGenerate = async () => {
    // In YOLO mode, we don't need selected models - server will pick them
    if (!prompt.trim()) return;
    if (!yoloMode && selectedModels.length < 2) return;

    setState("generating");
    setOutputs([]);
    setYoloSelection(null);

    try {
      // Fetch selected knowledge base entries content
      // For URL entries with subpages, use the relevance API to fetch relevant pages
      let allReferences = references.map(r => ({ type: r.type, value: r.value }));
      
      if (selectedKnowledge.length > 0) {
        // Fetch content for selected KB entries, using relevance API for URLs with subpages
        const kbPromises = selectedKnowledge.map(async (id) => {
          // First check if entry has subpages by fetching metadata
          const metaResponse = await fetch(`/api/knowledge/${id}`);
          if (!metaResponse.ok) return null;
          
          const metaData = await metaResponse.json();
          const entry = metaData.entry;
          
          // If URL entry with subpages, use relevance API
          if (entry.type === "url" && entry.subpageLinks && entry.subpageLinks.length > 0) {
            const relevantResponse = await fetch(`/api/knowledge/${id}/relevant`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt, maxPages: 3 }),
            });
            
            if (relevantResponse.ok) {
              const relevantData = await relevantResponse.json();
              const sourceInfo = relevantData.sources
                .map((s: { title: string }) => s.title)
                .join(", ");
              return {
                type: "text" as const,
                value: `[Knowledge Base: ${entry.title} (${relevantData.selectedCount} relevant pages from ${relevantData.availableCount} available)]\n${relevantData.content}`,
              };
            }
          }
          
          // Fallback: use stored content directly
          return {
            type: "text" as const,
            value: `[Knowledge Base: ${entry.title}]\n${entry.content}`,
          };
        });
        
        const kbContents = await Promise.all(kbPromises);
        const validKbContents = kbContents.filter((c): c is { type: "text"; value: string } => c !== null);
        allReferences = [...allReferences, ...validKbContents];
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          contentType,
          lengthPref,
          references: allReferences,
          enableCitations,
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
      
      // Notify user if any models failed
      if (data.failedModels && data.failedModels.length > 0) {
        const failedNames = data.failedModels.map((f: { model: string }) => f.model).join(", ");
        toast.warning(`${data.failedModels.length} model(s) failed: ${failedNames}`, {
          description: "Generation continued with available models.",
          duration: 5000,
        });
      }
      
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
    // For basic strategy, go directly to synthesis
    if (synthesisStrategy === "basic") {
      setState("synthesizing");
      await performBasicSynthesis(starredSections);
      return;
    }

    // For sequential/debate, first run critiquing phase
    setState("critiquing");
    setCritiques([]);
    setDebateSession(null);

    try {
      if (synthesisStrategy === "sequential") {
        // Sequential: Get critiques first, then synthesize
        const critiqueResponse = await fetch("/api/critique", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generationId,
            outputs,
            critiqueModels: selectedModels, // All models critique
          }),
        });

        if (!critiqueResponse.ok) {
          throw new Error("Critique failed");
        }

        const critiqueData = await critiqueResponse.json();
        setCritiques(critiqueData.critiques);

        // Now synthesize with critique insights
        setState("synthesizing");
        await performSequentialSynthesis(starredSections, critiqueData.critiques);

      } else if (synthesisStrategy === "debate") {
        // Debate: Run full debate process in one call
        const debateResponse = await fetch("/api/debate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generationId,
            outputs,
            debateModels: selectedModels,
            primaryModel: getEffectivePrimaryModel(),
            starredSections,
            parentSynthesisId, // For lineage tracking across regenerations
          }),
        });

        if (!debateResponse.ok) {
          throw new Error("Debate failed");
        }

        const debateData = await debateResponse.json();
        setDebateSession(debateData.session);
        setCritiques(debateData.session.rounds.flatMap((r: { critiques: CritiqueOutput[] }) => r.critiques));
        setSynthesis(debateData.finalContent);
        setSynthesisId(debateData.synthesisId);
        setParentSynthesisId(null); // Clear after successful synthesis
        setState("complete");
      }
    } catch (error) {
      console.error("Synthesis error:", error);
      setState("comparing");
    }
  };

  const performBasicSynthesis = async (starredSections?: { provider: AIProvider; text: string }[]) => {
    try {
      const response = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId,
          outputs,
          starredSections,
          primaryModel: getEffectivePrimaryModel(),
          strategy: "basic",
          parentSynthesisId, // For lineage tracking across regenerations
        }),
      });

      if (!response.ok) {
        throw new Error("Synthesis failed");
      }

      const data = await response.json();
      setSynthesis(data.content);
      setSynthesisId(data.synthesisId);
      setSynthesisReasoning(data.reasoning || null);
      setParentSynthesisId(null); // Clear after successful synthesis
      setState("complete");
    } catch (error) {
      console.error("Synthesis error:", error);
      setState("comparing");
    }
  };

  const performSequentialSynthesis = async (
    starredSections: { provider: AIProvider; text: string }[] | undefined,
    critiqueData: CritiqueOutput[]
  ) => {
    try {
      const response = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId,
          outputs,
          starredSections,
          primaryModel: getEffectivePrimaryModel(),
          strategy: "sequential",
          critiques: critiqueData,
          parentSynthesisId, // For lineage tracking across regenerations
        }),
      });

      if (!response.ok) {
        throw new Error("Synthesis failed");
      }

      const data = await response.json();
      setSynthesis(data.content);
      setSynthesisId(data.synthesisId);
      setSynthesisReasoning(data.reasoning || null);
      setParentSynthesisId(null); // Clear after successful synthesis
      setState("complete");
    } catch (error) {
      console.error("Synthesis error:", error);
      setState("comparing");
    }
  };

  const handleIterate = async (feedback: string, modifiedContent?: string) => {
    setState("synthesizing");

    // Use modified content if user made edits, otherwise use current synthesis
    const contentToIterate = modifiedContent ?? synthesis;

    try {
      const response = await fetch("/api/iterate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId,
          currentContent: contentToIterate,
          feedback,
          selectedModels,
        }),
      });

      if (!response.ok) {
        throw new Error("Iteration failed");
      }

      const data = await response.json();
      setSynthesis(data.content);
      if (data.synthesisId) {
        setSynthesisId(data.synthesisId);
      }
      setState("complete");
    } catch (error) {
      console.error("Iteration error:", error);
      setState("complete");
    }
  };

  const handleContentChange = (newContent: string) => {
    setSynthesis(newContent);
  };

  const handleRegenerate = async (draftContent: string) => {
    // Send the draft through multi-model comparison again
    // The AI models will provide their own variations/improvements
    
    // Save current synthesis as parent for lineage tracking
    if (synthesisId) {
      setParentSynthesisId(synthesisId);
    }
    
    setState("generating");
    setOutputs([]);
    setYoloSelection(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Please improve, refine, and provide your best version of the following content while maintaining its core message and intent:\n\n${draftContent}`,
          contentType,
          lengthPref,
          references: [],
          enableCitations: false,
          ...(yoloMode 
            ? { yoloMode: true }
            : { selectedModels }
          ),
        }),
      });

      if (!response.ok) {
        throw new Error("Regeneration failed");
      }

      const data = await response.json();
      setGenerationId(data.generationId);
      setOutputs(data.outputs);
      
      // Notify user if any models failed
      if (data.failedModels && data.failedModels.length > 0) {
        const failedNames = data.failedModels.map((f: { model: string }) => f.model).join(", ");
        toast.warning(`${data.failedModels.length} model(s) failed: ${failedNames}`, {
          description: "Generation continued with available models.",
          duration: 5000,
        });
      }
      
      // Store YOLO selection info if available
      if (data.yoloSelection) {
        setYoloSelection(data.yoloSelection);
        setSelectedModels(data.yoloSelection.models);
      }
      
      // Reset synthesis state for fresh comparison (but keep parentSynthesisId for lineage)
      setSynthesis("");
      setSynthesisId(null);
      setSynthesisReasoning(null);
      setCritiques([]);
      setDebateSession(null);
      
      setState("comparing");
    } catch (error) {
      console.error("Regeneration error:", error);
      toast.error("Failed to regenerate. Please try again.");
      setParentSynthesisId(null); // Clear parent on error since we're not proceeding
      setState("complete"); // Go back to completed state on error
    }
  };

  const handleReset = () => {
    setState("input");
    setOutputs([]);
    setSynthesis("");
    setSynthesisId(null);
    setSynthesisReasoning(null);
    setGenerationId(null);
    setCritiques([]);
    setDebateSession(null);
    setParentSynthesisId(null); // Clear lineage on full reset
  };

  const updateSynthesisPreference = async (strategy: SynthesisStrategy) => {
    try {
      await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ synthesisStrategy: strategy }),
      });
    } catch (error) {
      console.error("Failed to save preference:", error);
    }
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
              selectedKnowledge={selectedKnowledge}
              onSelectedKnowledgeChange={setSelectedKnowledge}
              enableCitations={enableCitations}
              onEnableCitationsChange={setEnableCitations}
            />
          </div>

          {/* Synthesis Strategy Selector */}
          <div className="rounded-lg border bg-card p-6">
            <div className="mb-4">
              <h3 className="text-base font-medium">Synthesis Strategy</h3>
              <p className="text-sm text-muted-foreground">
                Choose how outputs are combined into your final content
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {/* Basic */}
              <button
                onClick={() => {
                  setSynthesisStrategy("basic");
                  updateSynthesisPreference("basic");
                }}
                className={`relative flex flex-col items-start rounded-lg border p-4 text-left transition-colors ${
                  synthesisStrategy === "basic"
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50"
                }`}
              >
                <div className={`rounded-lg p-2 ${
                  synthesisStrategy === "basic" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  <Sparkles className="h-4 w-4" />
                </div>
                <span className="mt-2 font-medium">Basic</span>
                <span className="mt-1 text-xs text-muted-foreground">Fast direct merge</span>
                <Badge variant="outline" className="mt-2 text-xs">~1x cost</Badge>
              </button>

              {/* Sequential */}
              <button
                onClick={() => {
                  setSynthesisStrategy("sequential");
                  updateSynthesisPreference("sequential");
                }}
                className={`relative flex flex-col items-start rounded-lg border p-4 text-left transition-colors ${
                  synthesisStrategy === "sequential"
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50"
                }`}
              >
                <div className={`rounded-lg p-2 ${
                  synthesisStrategy === "sequential" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  <MessagesSquare className="h-4 w-4" />
                </div>
                <span className="mt-2 font-medium">Critique</span>
                <span className="mt-1 text-xs text-muted-foreground">Models review each other</span>
                <Badge variant="secondary" className="mt-2 text-xs">~3x cost</Badge>
              </button>

              {/* Debate */}
              <button
                onClick={() => {
                  setSynthesisStrategy("debate");
                  updateSynthesisPreference("debate");
                }}
                className={`relative flex flex-col items-start rounded-lg border p-4 text-left transition-colors ${
                  synthesisStrategy === "debate"
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50"
                }`}
              >
                <div className={`rounded-lg p-2 ${
                  synthesisStrategy === "debate" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  <Swords className="h-4 w-4" />
                </div>
                <span className="mt-2 font-medium">Debate</span>
                <span className="mt-1 text-xs text-muted-foreground">Multi-round consensus</span>
                <Badge variant="default" className="mt-2 text-xs">~5x cost</Badge>
              </button>
            </div>
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
        <div className="p-6">
          <ComparisonView
            outputs={outputs}
            onSynthesize={handleSynthesize}
            onBack={handleReset}
            synthesisStrategy={synthesisStrategy}
          />
        </div>
      )}

      {state === "critiquing" && (
        <CritiqueView
          outputs={outputs}
          selectedModels={selectedModels}
          strategy={synthesisStrategy}
          progressMessage={progressMessage}
          progressPercent={progressPercent}
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
        <div className="p-6">
          <SynthesisView
            content={synthesis}
            generationId={generationId}
            synthesisId={synthesisId}
            reasoning={synthesisReasoning}
            onIterate={handleIterate}
            onContentChange={handleContentChange}
            onRegenerate={handleRegenerate}
            onBack={handleReset}
            onBackToCompare={() => setState("comparing")}
            synthesisStrategy={synthesisStrategy}
            critiques={critiques}
            debateSession={debateSession}
          />
        </div>
      )}
    </div>
  );
}
