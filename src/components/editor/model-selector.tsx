"use client";

import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PenLine, AlertCircle, Settings, Server } from "lucide-react";
import Link from "next/link";
import { AIProvider, LiteLLMModel, OllamaModel } from "@/types";
import { AI_PROVIDERS, getTextGenerationProviders } from "@/lib/ai/providers";

interface SelectedModel {
  provider: AIProvider;
  modelId: string;
}

interface ModelSelectorProps {
  selectedModels: SelectedModel[];
  onModelsChange: (models: SelectedModel[]) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  canGenerate: boolean;
  hidden?: boolean; // Hide when YOLO mode is active
}

interface ValidatedKey {
  provider: AIProvider;
  models: string[];
}

interface LiteLLMState {
  enabled: boolean;
  models: LiteLLMModel[];
}

interface OllamaState {
  enabled: boolean;
  models: OllamaModel[];
}

// Cost tier order for sorting (high quality first)
const COST_TIER_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const sortByCostTier = <T extends { costTier?: "low" | "medium" | "high" }>(models: T[]): T[] => {
  return [...models].sort((a, b) => {
    const orderA = COST_TIER_ORDER[a.costTier || "medium"] ?? 1;
    const orderB = COST_TIER_ORDER[b.costTier || "medium"] ?? 1;
    return orderA - orderB;
  });
};

export function ModelSelector({
  selectedModels,
  onModelsChange,
  onGenerate,
  isGenerating,
  canGenerate,
  hidden = false,
}: ModelSelectorProps) {
  const [validatedKeys, setValidatedKeys] = useState<ValidatedKey[]>([]);
  const [liteLLM, setLiteLLM] = useState<LiteLLMState>({ enabled: false, models: [] });
  const [ollama, setOllama] = useState<OllamaState>({ enabled: false, models: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchValidatedKeys();
    fetchLiteLLMModels();
    fetchOllamaModels();
  }, []);

  const fetchValidatedKeys = async () => {
    try {
      const response = await fetch("/api/keys");
      if (response.ok) {
        const data = await response.json();
        setValidatedKeys(
          data.keys
            .filter((k: { isValid: boolean }) => k.isValid)
            .map((k: { provider: AIProvider; validModels: string[] }) => ({
              provider: k.provider,
              models: k.validModels,
            }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch keys:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLiteLLMModels = async () => {
    try {
      const response = await fetch("/api/litellm/models");
      if (response.ok) {
        const data = await response.json();
        if (data.enabled && data.models?.length > 0) {
          setLiteLLM({ enabled: true, models: data.models });
        }
      }
    } catch (error) {
      console.error("Failed to fetch LiteLLM models:", error);
    }
  };

  const fetchOllamaModels = async () => {
    try {
      const response = await fetch("/api/ollama");
      if (response.ok) {
        const data = await response.json();
        if (data.configured && data.isEnabled && data.models?.length > 0) {
          setOllama({ enabled: true, models: data.models });
        }
      }
    } catch (error) {
      console.error("Failed to fetch Ollama models:", error);
    }
  };

  const toggleModel = (provider: AIProvider, modelId: string) => {
    const exists = selectedModels.some(
      (m) => m.provider === provider && m.modelId === modelId
    );

    if (exists) {
      onModelsChange(
        selectedModels.filter(
          (m) => !(m.provider === provider && m.modelId === modelId)
        )
      );
    } else {
      if (selectedModels.length >= 4) {
        // Max 4 models
        return;
      }
      onModelsChange([...selectedModels, { provider, modelId }]);
    }
  };

  const isModelSelected = (provider: AIProvider, modelId: string) => {
    return selectedModels.some(
      (m) => m.provider === provider && m.modelId === modelId
    );
  };

  const textProviders = getTextGenerationProviders();
  const availableProviders = textProviders.filter((p) =>
    validatedKeys.some((k) => k.provider === p.id)
  );

  // Group LiteLLM models by their original provider
  const liteLLMByProvider = liteLLM.enabled
    ? liteLLM.models.reduce((acc, model) => {
        const provider = model.provider || "other";
        if (!acc[provider]) acc[provider] = [];
        acc[provider].push(model);
        return acc;
      }, {} as Record<string, LiteLLMModel[]>)
    : {};

  const hasNoModels = validatedKeys.length === 0 && !liteLLM.enabled && !ollama.enabled;

  if (hidden) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (hasNoModels) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>
            No API keys, LiteLLM, or Ollama configured. Add your API keys or connect to a proxy.
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/settings">
              <Settings className="mr-2 h-4 w-4" />
              Configure
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Select AI Models</h3>
        <p className="text-sm text-muted-foreground">
          Choose 2-4 models to compare. Each will generate content from your
          prompt.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Direct API providers */}
        {availableProviders.map((provider) => {
          const validatedKey = validatedKeys.find(
            (k) => k.provider === provider.id
          );
          const availableModels = provider.models.filter((m) =>
            validatedKey?.models.includes(m.id)
          );

          if (availableModels.length === 0) return null;

          return (
            <div
              key={provider.id}
              className="rounded-lg border bg-card p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{provider.name}</h4>
                <Badge variant="secondary" className="text-xs">
                  {availableModels.length} models
                </Badge>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {sortByCostTier(availableModels).map((model) => {
                  const isSelected = isModelSelected(provider.id, model.id);
                  const isDisabled =
                    !isSelected && selectedModels.length >= 4;

                  return (
                    <label
                      key={model.id}
                      className={`flex items-center gap-3 rounded-md border p-2 cursor-pointer transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : isDisabled
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-accent"
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() =>
                          !isDisabled && toggleModel(provider.id, model.id)
                        }
                        disabled={isDisabled}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {model.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(model.contextWindow / 1000).toFixed(0)}k context
                        </p>
                      </div>
                      <Badge
                        variant={
                          model.costTier === "low"
                            ? "secondary"
                            : model.costTier === "medium"
                            ? "outline"
                            : "default"
                        }
                        className="text-xs"
                      >
                        {model.costTier}
                      </Badge>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* LiteLLM models grouped by provider */}
        {Object.entries(liteLLMByProvider).map(([providerName, models]) => (
          <div
            key={`litellm-${providerName}`}
            className="rounded-lg border bg-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="font-medium capitalize">{providerName}</h4>
                <Badge variant="outline" className="text-xs">
                  <Server className="mr-1 h-3 w-3" />
                  LiteLLM
                </Badge>
              </div>
              <Badge variant="secondary" className="text-xs">
                {models.length} models
              </Badge>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {sortByCostTier(models).map((model) => {
                const isSelected = isModelSelected("LITELLM", model.id);
                const isDisabled = !isSelected && selectedModels.length >= 4;

                return (
                  <label
                    key={model.id}
                    className={`flex items-center gap-3 rounded-md border p-2 cursor-pointer transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : isDisabled
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-accent"
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() =>
                        !isDisabled && toggleModel("LITELLM", model.id)
                      }
                      disabled={isDisabled}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{model.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {model.contextWindow
                          ? `${(model.contextWindow / 1000).toFixed(0)}k context`
                          : "via proxy"}
                      </p>
                    </div>
                    <Badge
                      variant={
                        model.costTier === "low"
                          ? "secondary"
                          : model.costTier === "medium"
                          ? "outline"
                          : "default"
                      }
                      className="text-xs"
                    >
                      {model.costTier || "medium"}
                    </Badge>
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        {/* Ollama models */}
        {ollama.enabled && ollama.models.length > 0 && (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">Ollama (Local)</h4>
                <Badge variant="outline" className="text-xs">
                  <Server className="mr-1 h-3 w-3" />
                  Local
                </Badge>
              </div>
              <Badge variant="secondary" className="text-xs">
                {ollama.models.length} models
              </Badge>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {sortByCostTier(ollama.models).map((model) => {
                const isSelected = isModelSelected("OLLAMA", model.id);
                const isDisabled = !isSelected && selectedModels.length >= 4;

                return (
                  <label
                    key={model.id}
                    className={`flex items-center gap-3 rounded-md border p-2 cursor-pointer transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : isDisabled
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-accent"
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() =>
                        !isDisabled && toggleModel("OLLAMA", model.id)
                      }
                      disabled={isDisabled}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{model.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {model.contextWindow
                          ? `${(model.contextWindow / 1000).toFixed(0)}k context`
                          : "local"}
                        {model.size && ` · ${(model.size / 1024 / 1024 / 1024).toFixed(1)}GB`}
                      </p>
                    </div>
                    <Badge
                      variant={
                        model.costTier === "low"
                          ? "secondary"
                          : model.costTier === "medium"
                          ? "outline"
                          : "default"
                      }
                      className="text-xs"
                    >
                      {model.costTier || "free"}
                    </Badge>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-sm text-muted-foreground">
          {selectedModels.length} of 4 models selected
          {selectedModels.length === 0 && " (select at least 1)"}
          {selectedModels.length === 1 && " (single model - no synthesis)"}
        </p>
        <Button
          onClick={onGenerate}
          disabled={!canGenerate || isGenerating}
          size="lg"
        >
          <PenLine className="mr-2 h-4 w-4" />
          {isGenerating ? "Generating..." : "Generate Content"}
        </Button>
      </div>
    </div>
  );
}
