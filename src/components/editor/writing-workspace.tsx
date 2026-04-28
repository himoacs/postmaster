"use client";

import { useState, useEffect, useCallback } from "react";
import { PromptInput, ReferenceSource, ContentMode } from "./prompt-input";
import { ModelSelector } from "./model-selector";
import { ComparisonView } from "./comparison-view";
import { SynthesisView } from "./synthesis-view";
import { CritiqueView } from "./critique-view";
import { LivePreviewPanel } from "./live-preview-panel";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Zap, PenLine, MessagesSquare, Sparkles, Swords, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AIProvider, YoloSelection, SynthesisStrategy, CritiqueOutput, DebateSession, SynthesisReasoning } from "@/types";
import { GenerationOutput } from "@/types";
import { parseSSEStream } from "@/lib/streaming";

export type WorkspaceState = "input" | "generating" | "comparing" | "critiquing" | "synthesizing" | "iterating" | "complete";

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

const ITERATING_MESSAGES = [
  { message: "Analyzing your feedback...", duration: 800 },
  { message: "Revising the content...", duration: 1500 },
  { message: "Applying changes...", duration: 2000 },
  { message: "Polishing the draft...", duration: 1500 },
  { message: "Almost done...", duration: 2000 },
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
  const [streamingOutputs, setStreamingOutputs] = useState<Map<string, {
    provider: string;
    modelId: string;
    content: string;
    isComplete: boolean;
    error?: string;
  }>>(new Map());
  const [synthesis, setSynthesis] = useState<string>(initialSynthesis);
  const [streamingSynthesis, setStreamingSynthesis] = useState<string>("");
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
  
  // Content mode state (new vs enhance existing)
  const [contentMode, setContentMode] = useState<ContentMode>("new");
  const [existingContent, setExistingContent] = useState<string | null>(null);
  
  // User's preferred primary model for synthesis
  const [userPrimaryModel, setUserPrimaryModel] = useState<SelectedModel | null>(null);

  // All available models (for swap functionality)
  const [allAvailableModels, setAllAvailableModels] = useState<SelectedModel[]>([]);

  // Fetch all available models on mount (for swap dialog)
  useEffect(() => {
    async function fetchAllAvailableModels() {
      const models: SelectedModel[] = [];
      
      try {
        // Fetch direct API provider models
        const keysResponse = await fetch("/api/keys");
        if (keysResponse.ok) {
          const data = await keysResponse.json();
          for (const key of data.keys) {
            if (key.isValid && key.validModels) {
              for (const modelId of key.validModels) {
                models.push({ provider: key.provider, modelId });
              }
            }
          }
        }
        
        // Fetch LiteLLM models
        const liteLLMResponse = await fetch("/api/litellm/models");
        if (liteLLMResponse.ok) {
          const data = await liteLLMResponse.json();
          if (data.enabled && data.models?.length > 0) {
            for (const model of data.models) {
              models.push({ provider: "LITELLM" as AIProvider, modelId: model.id });
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch available models:", error);
      }
      
      setAllAvailableModels(models);
    }
    
    fetchAllAvailableModels();
  }, []);

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

  // Progress animation for iterating state
  useEffect(() => {
    if (state !== "iterating") return;
    
    let messageIndex = 0;
    let totalDuration = 0;
    const messages = ITERATING_MESSAGES;
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
    if (!yoloMode && selectedModels.length < 1) return;
    
    // Require existing content when in enhance mode
    if (contentMode === "enhance" && !existingContent?.trim()) {
      toast.error("Please upload or paste content to enhance");
      return;
    }

    setState("generating");
    setOutputs([]);
    setYoloSelection(null);

    try {
      // Fetch selected knowledge base entries content
      // For URL entries with subpages, use the relevance API to fetch relevant pages
      let allReferences = references.map(r => ({ type: r.type, value: r.value }));
      
      if (selectedKnowledge.length > 0) {
        console.log("[WritingWorkspace] Fetching knowledge base content for:", selectedKnowledge);
        
        // Fetch content for selected KB entries, using relevance API for URLs with subpages
        const kbPromises = selectedKnowledge.map(async (id) => {
          // First check if entry has subpages by fetching metadata
          const metaResponse = await fetch(`/api/knowledge/${id}`);
          if (!metaResponse.ok) {
            console.warn("[WritingWorkspace] Failed to fetch KB entry metadata:", id);
            return null;
          }
          
          const metaData = await metaResponse.json();
          const entry = metaData.entry;
          
          console.log("[WritingWorkspace] KB entry metadata:", {
            id,
            title: entry.title,
            type: entry.type,
            hasSubpages: !!(entry.subpageLinks && entry.subpageLinks.length > 0),
            subpageCount: entry.subpageLinks?.length || 0,
            contentLength: entry.content?.length || 0,
          });
          
          // Use relevance API for all entry types to get relevant content
          // - URL entries with subpages: selects relevant pages
          // - Text/file entries with large content: extracts relevant sections
          // - Small entries: returns full content
          const relevantResponse = await fetch(`/api/knowledge/${id}/relevant`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, maxPages: 5 }),
          });
          
          if (relevantResponse.ok) {
            const relevantData = await relevantResponse.json();
            console.log("[WritingWorkspace] Relevant content fetched:", {
              id,
              type: entry.type,
              selectedCount: relevantData.selectedCount,
              availableCount: relevantData.availableCount,
              extracted: relevantData.extracted,
              originalLength: relevantData.originalLength,
              extractedLength: relevantData.extractedLength,
              contentLength: relevantData.content?.length || 0,
            });
            
            // Build a descriptive header based on what was done
            let header = `[Knowledge Base: ${entry.title}`;
            if (relevantData.selectedCount !== undefined) {
              header += ` (${relevantData.selectedCount} relevant pages from ${relevantData.availableCount} available)`;
            } else if (relevantData.extracted) {
              header += ` (relevant sections extracted)`;
            }
            header += `]`;
            
            return {
              type: "text" as const,
              value: `${header}\n${relevantData.content}`,
            };
          } else {
            console.warn("[WritingWorkspace] Failed to fetch relevant content:", id, relevantResponse.status);
          }
          
          // Fallback: use stored content directly
          console.log("[WritingWorkspace] Using stored content for:", id, "length:", entry.content?.length || 0);
          return {
            type: "text" as const,
            value: `[Knowledge Base: ${entry.title}]\n${entry.content}`,
          };
        });
        
        const kbContents = await Promise.all(kbPromises);
        const validKbContents = kbContents.filter((c): c is { type: "text"; value: string } => c !== null);
        console.log("[WritingWorkspace] Total KB content items:", validKbContents.length, "Total reference size:", validKbContents.reduce((sum, c) => sum + c.value.length, 0));
        allReferences = [...allReferences, ...validKbContents];
      }

      console.log("[WritingWorkspace] Sending to generate API:", {
        totalReferences: allReferences.length,
        referenceTypes: allReferences.map(r => r.type),
        totalReferenceLength: allReferences.reduce((sum, r) => sum + r.value.length, 0),
      });

      // Reset streaming state
      setStreamingOutputs(new Map());
      
      // Use streaming API
      const response = await fetch("/api/generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          contentType,
          lengthPref,
          references: allReferences,
          enableCitations,
          contentMode,
          existingContent: contentMode === "enhance" ? existingContent : undefined,
          ...(yoloMode 
            ? { yoloMode: true }
            : { selectedModels }
          ),
        }),
      });

      if (!response.ok) {
        let errorMessage = "Generation failed";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Response body was empty or not JSON
          errorMessage = `Server error (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      // Parse SSE stream
      for await (const event of parseSSEStream(response)) {
        const { data } = event;

        switch (event.type) {
          case "model-start": {
            const { generationId: gId, models, yoloSelection: ys } = data as {
              generationId: string;
              models: SelectedModel[];
              yoloSelection?: YoloSelection;
            };
            setGenerationId(gId);
            if (ys) {
              setYoloSelection(ys);
              setSelectedModels(ys.models);
            } else {
              setSelectedModels(models);
            }
            // Initialize streaming outputs for all models
            const initialOutputs = new Map<string, {
              provider: string;
              modelId: string;
              content: string;
              isComplete: boolean;
            }>();
            for (const model of models) {
              const key = `${model.provider}:${model.modelId}`;
              initialOutputs.set(key, {
                provider: model.provider,
                modelId: model.modelId,
                content: "",
                isComplete: false,
              });
            }
            setStreamingOutputs(initialOutputs);
            break;
          }

          case "model-chunk": {
            const { provider, modelId, accumulated } = data as {
              provider: string;
              modelId: string;
              content: string;
              accumulated: string;
            };
            const key = `${provider}:${modelId}`;
            setStreamingOutputs(prev => {
              const newMap = new Map(prev);
              const existing = newMap.get(key);
              newMap.set(key, {
                ...existing,
                provider,
                modelId,
                content: accumulated,
                isComplete: false,
              });
              return newMap;
            });
            break;
          }

          case "model-complete": {
            const { provider, modelId, content, error: modelError } = data as {
              provider: string;
              modelId: string;
              content: string;
              tokensUsed: number;
              latencyMs: number;
              error?: string;
            };
            const key = `${provider}:${modelId}`;
            setStreamingOutputs(prev => {
              const newMap = new Map(prev);
              newMap.set(key, {
                provider,
                modelId,
                content,
                isComplete: true,
                error: modelError,
              });
              return newMap;
            });
            break;
          }

          case "model-error": {
            const { provider, modelId, error: modelError } = data as {
              provider: string;
              modelId: string;
              error: string;
            };
            const key = `${provider}:${modelId}`;
            setStreamingOutputs(prev => {
              const newMap = new Map(prev);
              const existing = newMap.get(key);
              newMap.set(key, {
                ...existing,
                provider,
                modelId,
                content: existing?.content || "",
                isComplete: true,
                error: modelError,
              });
              return newMap;
            });
            break;
          }

          case "generation-complete": {
            const { outputs: finalOutputs, failedModels, error: genError } = data as {
              generationId?: string;
              outputs?: GenerationOutput[];
              failedModels?: Array<{ provider: string; model: string; error: string }>;
              error?: string;
            };

            if (genError) {
              throw new Error(genError);
            }

            if (finalOutputs) {
              setOutputs(finalOutputs);
              
              // Notify user if any models failed
              if (failedModels && failedModels.length > 0) {
                const failedNames = failedModels.map(f => f.model).join(", ");
                toast.warning(`${failedModels.length} model(s) failed: ${failedNames}`, {
                  description: "Generation continued with available models.",
                  duration: 5000,
                });
              }
              
              setState("comparing");
            }
            break;
          }
        }
      }
    } catch (error) {
      console.error("Generation error:", error);
      toast.error(error instanceof Error ? error.message : "Generation failed");
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
    // Clear streaming state
    setStreamingSynthesis("");
    
    try {
      const response = await fetch("/api/synthesize/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId,
          outputs,
          starredSections,
          primaryModel: getEffectivePrimaryModel(),
          strategy: "basic",
          parentSynthesisId,
        }),
      });

      if (!response.ok) {
        throw new Error("Synthesis failed");
      }

      // Process streaming response
      for await (const event of parseSSEStream(response)) {
        switch (event.type) {
          case "synthesis-chunk": {
            const { accumulated } = event.data as { content: string; accumulated: string };
            setStreamingSynthesis(accumulated);
            break;
          }
          case "synthesis-complete": {
            const { content, synthesisId: newSynthesisId } = event.data as { 
              content: string; 
              synthesisId: string;
            };
            setSynthesis(content);
            setSynthesisId(newSynthesisId);
            setSynthesisReasoning(null); // Streaming doesn't include reasoning
            setParentSynthesisId(null);
            setStreamingSynthesis("");
            setState("complete");
            break;
          }
          case "model-error": {
            const { error } = event.data as { error: string };
            throw new Error(error);
          }
        }
      }
    } catch (error) {
      console.error("Synthesis error:", error);
      setStreamingSynthesis("");
      setState("comparing");
    }
  };

  const performSequentialSynthesis = async (
    starredSections: { provider: AIProvider; text: string }[] | undefined,
    critiqueData: CritiqueOutput[]
  ) => {
    // Clear streaming state
    setStreamingSynthesis("");
    
    try {
      const response = await fetch("/api/synthesize/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId,
          outputs,
          starredSections,
          primaryModel: getEffectivePrimaryModel(),
          strategy: "sequential",
          critiques: critiqueData,
          parentSynthesisId,
        }),
      });

      if (!response.ok) {
        throw new Error("Synthesis failed");
      }

      // Process streaming response
      for await (const event of parseSSEStream(response)) {
        switch (event.type) {
          case "synthesis-chunk": {
            const { accumulated } = event.data as { content: string; accumulated: string };
            setStreamingSynthesis(accumulated);
            break;
          }
          case "synthesis-complete": {
            const { content, synthesisId: newSynthesisId } = event.data as { 
              content: string; 
              synthesisId: string;
            };
            setSynthesis(content);
            setSynthesisId(newSynthesisId);
            setSynthesisReasoning(null); // Streaming doesn't include reasoning
            setParentSynthesisId(null);
            setStreamingSynthesis("");
            setState("complete");
            break;
          }
          case "model-error": {
            const { error } = event.data as { error: string };
            throw new Error(error);
          }
        }
      }
    } catch (error) {
      console.error("Synthesis error:", error);
      setStreamingSynthesis("");
      setState("comparing");
    }
  };

  const handleIterate = async (feedback: string, modifiedContent?: string) => {
    setState("iterating");

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
          primaryModel: getEffectivePrimaryModel(),
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
      toast.success("Content refined", {
        description: "View History to see what changed",
      });
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
    
    console.log("[Regenerate] Starting with models:", selectedModels);
    console.log("[Regenerate] YOLO mode:", yoloMode);
    console.log("[Regenerate] Draft content length:", draftContent.length);
    
    // Save current synthesis as parent for lineage tracking
    if (synthesisId) {
      setParentSynthesisId(synthesisId);
    }
    
    setState("generating");
    setOutputs([]);
    setYoloSelection(null);

    try {
      const requestBody = {
        prompt: `Improve, refine, and enhance this content. Preserve the core message and key information while improving clarity, flow, and engagement.`,
        contentType,
        lengthPref,
        references: [],
        enableCitations: false,
        contentMode: "enhance" as const,
        existingContent: draftContent,
        ...(yoloMode 
          ? { yoloMode: true }
          : { selectedModels }
        ),
      };
      
      console.log("[Regenerate] Request body:", { ...requestBody, prompt: requestBody.prompt.slice(0, 100) + "..." });
      
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Regenerate] API error:", errorData);
        throw new Error("Regeneration failed");
      }

      const data = await response.json();
      console.log("[Regenerate] Response:", {
        generationId: data.generationId,
        outputCount: data.outputs?.length,
        failedModels: data.failedModels,
      });
      
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

  const handleRetryModel = async (index: number) => {
    if (!generationId || !outputs[index]) return;
    
    const output = outputs[index];
    try {
      const response = await fetch("/api/generate/single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId,
          provider: output.provider,
          modelId: output.model,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Retry failed");
      }
      
      const result = await response.json();
      
      // Update the specific output
      setOutputs(prev => {
        const updated = [...prev];
        updated[index] = result.output;
        return updated;
      });
    } catch (error) {
      console.error("Failed to retry model:", error);
    }
  };

  const handleSwapModel = async (index: number, newProvider: string, newModelId: string) => {
    if (!generationId || !outputs[index]) return;
    
    const output = outputs[index];
    try {
      const response = await fetch("/api/generate/single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId,
          provider: output.provider,
          modelId: output.model,
          newProvider,
          newModelId,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Swap failed");
      }
      
      const result = await response.json();
      
      // Replace the output with the new model's output
      setOutputs(prev => {
        const updated = [...prev];
        updated[index] = result.output;
        return updated;
      });
    } catch (error) {
      console.error("Failed to swap model:", error);
    }
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
    <div className="h-full flex flex-col">
      {state === "input" && (
        <div className="flex-1 min-h-0 overflow-auto">
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
              contentMode={contentMode}
              onContentModeChange={setContentMode}
              existingContent={existingContent}
              onExistingContentChange={setExistingContent}
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
                canGenerate={prompt.trim().length > 0 && selectedModels.length >= 1}
              />
            </div>
          )}
        </div>
        </div>
      )}

      {state === "generating" && (
        <div className="flex-1 min-h-0 grid overflow-hidden" style={{ gridTemplateColumns: '1fr 360px' }}>
          {/* Left side - Progress info (centered) */}
          <div className="h-full border-r bg-muted/20 flex items-center justify-center px-12 py-8">
            <div className="w-full max-w-md text-center">
              <div className="relative h-14 w-14 mx-auto">
                <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <PenLine className="h-5 w-5 text-primary animate-pulse" />
                </div>
              </div>
              <p className="mt-5 font-serif text-xl">Generating Content</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {yoloMode 
                  ? `Using ${selectedModels.length || 3} optimally selected models`
                  : `Comparing ${selectedModels.length} models in parallel`
                }
              </p>
              
              {/* Model badges with status */}
              {(yoloSelection?.models || selectedModels).length > 0 && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {(yoloSelection?.models || selectedModels).map((m) => {
                    const key = `${m.provider}:${m.modelId}`;
                    const streamOutput = streamingOutputs.get(key);
                    const hasContent = streamOutput && streamOutput.content.length > 0;
                    const isComplete = streamOutput?.isComplete;
                    
                    return (
                      <Badge 
                        key={key} 
                        variant={isComplete ? "default" : "secondary"}
                        className="text-xs transition-all"
                      >
                        {hasContent && !isComplete && (
                          <span className="mr-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse inline-block" />
                        )}
                        {isComplete && (
                          <span className="mr-1 text-green-500">✓</span>
                        )}
                        {m.modelId.split("/").pop()?.split("-").slice(0, 2).join("-") || m.modelId}
                      </Badge>
                    );
                  })}
                </div>
              )}
              
              {/* Progress bar */}
              <div className="mt-8 space-y-2">
                <Progress 
                  value={
                    streamingOutputs.size > 0
                      ? (Array.from(streamingOutputs.values()).filter(o => o.isComplete).length / streamingOutputs.size) * 100
                      : progressPercent
                  } 
                  className="h-2" 
                />
                <p className="text-sm text-muted-foreground">
                  {streamingOutputs.size > 0
                    ? `${Array.from(streamingOutputs.values()).filter(o => o.isComplete).length} of ${streamingOutputs.size} models complete`
                    : progressMessage
                  }
                </p>
              </div>
            </div>
          </div>
          
          {/* Right side - Compact live preview (fixed width via grid, scrollable) */}
          <div className="h-full flex flex-col min-h-0 border-l bg-muted/10">
            <LivePreviewPanel
              outputs={streamingOutputs}
              mode="generating"
              className="h-full overflow-hidden"
            />
          </div>
        </div>
      )}

      {state === "comparing" && (
        <div className="flex-1 min-h-0 overflow-auto p-6">
          <ComparisonView
            outputs={outputs}
            onSynthesize={handleSynthesize}
            onBack={handleReset}
            synthesisStrategy={synthesisStrategy}
            onSynthesisStrategyChange={(strategy) => {
              setSynthesisStrategy(strategy);
              updateSynthesisPreference(strategy);
            }}
            onRetry={handleRetryModel}
            onSwap={handleSwapModel}
            availableModels={allAvailableModels}
          />
        </div>
      )}

      {state === "critiquing" && (
        <div className="flex-1 min-h-0 overflow-auto">
          <CritiqueView
            outputs={outputs}
            selectedModels={selectedModels}
            strategy={synthesisStrategy}
            progressMessage={progressMessage}
            progressPercent={progressPercent}
          />
        </div>
      )}

      {state === "synthesizing" && (
        <div className="flex-1 min-h-0 grid overflow-hidden" style={{ gridTemplateColumns: '1fr 360px' }}>
          {/* Left side - Progress info (centered) */}
          <div className="h-full border-r bg-muted/20 flex items-center justify-center px-12 py-8">
            <div className="w-full max-w-md text-center">
              <div className="relative h-14 w-14 mx-auto">
                <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Zap className="h-5 w-5 text-primary animate-pulse" />
                </div>
              </div>
              <p className="mt-5 font-serif text-xl">
                {outputs.length === 1 ? "Polishing Content" : "Synthesizing Content"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {outputs.length === 1 
                  ? "Refining and enhancing your draft"
                  : "Combining the best elements from all outputs"
                }
              </p>
              
              {/* Progress bar */}
              <div className="mt-8 space-y-2">
                <Progress value={progressPercent} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {progressMessage}
                </p>
              </div>
              
              {/* Visual indicator of merge - hide for single output */}
              {outputs.length > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  {selectedModels.slice(0, 3).map((m, i) => (
                    <div 
                      key={`synth-${m.provider}-${i}`}
                      className="h-2.5 w-2.5 rounded-full bg-primary/60 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                  <span className="mx-2 text-muted-foreground text-sm">→</span>
                  <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
                </div>
              )}
            </div>
          </div>
          
          {/* Right side - Compact live preview (fixed width via grid, scrollable) */}
          <div className="h-full flex flex-col min-h-0 border-l bg-muted/10">
            <LivePreviewPanel
              outputs={new Map()}
              mode="synthesizing"
              synthesisContent={streamingSynthesis}
              className="h-full overflow-hidden"
            />
          </div>
        </div>
      )}

      {state === "iterating" && (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="w-full max-w-md text-center px-6">
            <div className="relative mx-auto h-16 w-16">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <RefreshCw className="h-6 w-6 text-primary animate-spin" />
              </div>
            </div>
            <p className="mt-6 font-serif text-xl">Refining Content</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Applying your feedback to improve the draft
            </p>
            
            {/* Progress bar */}
            <div className="mt-6 space-y-2">
              <Progress value={progressPercent} className="h-2" />
              <p className="text-sm text-muted-foreground animate-pulse">
                {progressMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {state === "complete" && (
        <div className="flex-1 min-h-0 overflow-auto p-6">
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
