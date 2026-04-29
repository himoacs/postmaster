"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Star, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { UserPreferences, AIProvider, LiteLLMModel } from "@/types";
import { AI_PROVIDERS } from "@/lib/ai/providers";

interface AvailableModel {
  provider: string; // AIProvider or "LITELLM"
  modelId: string;
  displayName: string;
}

export function PrimaryModelSettings() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        // Load preferences and available models in parallel
        const [prefsRes, keysRes, litellmRes] = await Promise.all([
          fetch("/api/preferences"),
          fetch("/api/keys"),
          fetch("/api/litellm/models"),
        ]);

        if (prefsRes.ok) {
          const prefs = await prefsRes.json();
          setPreferences(prefs);
        }

        const models: AvailableModel[] = [];

        // Add models from configured API keys
        if (keysRes.ok) {
          const keysData = await keysRes.json();
          const keys = keysData.keys || [];
          for (const key of keys) {
            if (key.isValid && key.validModels) {
              const providerConfig = AI_PROVIDERS[key.provider as AIProvider];
              if (providerConfig) {
                // validModels is already an array from the API
                const validModelIds = Array.isArray(key.validModels) 
                  ? key.validModels 
                  : [];
                
                // Use config models as the source of truth to avoid duplicates
                // Track which API IDs we've already used
                const usedApiIds = new Set<string>();
                const addedDisplayNames = new Set<string>();
                
                for (const configModel of providerConfig.models) {
                  // Find a matching API model ID that hasn't been used yet
                  const matchingApiId = validModelIds.find((apiId: string) => 
                    !usedApiIds.has(apiId) && (
                      apiId === configModel.id || 
                      apiId.startsWith(configModel.id + "-") ||
                      configModel.id.startsWith(apiId + "-")
                    )
                  );
                  
                  const displayName = `${providerConfig.name} - ${configModel.name}`;
                  
                  if (matchingApiId && !addedDisplayNames.has(displayName)) {
                    usedApiIds.add(matchingApiId);
                    addedDisplayNames.add(displayName);
                    models.push({
                      provider: key.provider,
                      modelId: matchingApiId, // Use the actual API model ID
                      displayName,
                    });
                  }
                }
              }
            }
          }
        }

        // Add LiteLLM models
        if (litellmRes.ok) {
          const litellmData = await litellmRes.json();
          if (litellmData.models && Array.isArray(litellmData.models)) {
            for (const model of litellmData.models as LiteLLMModel[]) {
              models.push({
                provider: "LITELLM",
                modelId: model.id,
                displayName: `LiteLLM - ${model.name || model.id}`,
              });
            }
          }
        }

        setAvailableModels(models);
      } catch (error) {
        console.error("Failed to load data:", error);
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleModelChange = async (value: string) => {
    if (!preferences) return;

    setSaving(true);
    
    // Parse the value (format: "PROVIDER:modelId")
    const [provider, modelId] = value.split(":");
    
    const updates = {
      primaryModelProvider: provider,
      primaryModelId: modelId,
    };

    try {
      const response = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      setPreferences({
        ...preferences,
        ...updates,
      });

      toast.success("Primary model updated");
    } catch (error) {
      console.error("Failed to save preference:", error);
      toast.error("Failed to save preference");
    } finally {
      setSaving(false);
    }
  };

  const handleClearModel = async () => {
    if (!preferences) return;

    setSaving(true);

    try {
      const response = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryModelProvider: null,
          primaryModelId: null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      setPreferences({
        ...preferences,
        primaryModelProvider: undefined,
        primaryModelId: undefined,
      });

      toast.success("Primary model cleared");
    } catch (error) {
      console.error("Failed to clear preference:", error);
      toast.error("Failed to clear preference");
    } finally {
      setSaving(false);
    }
  };

  const currentValue = preferences?.primaryModelProvider && preferences?.primaryModelId
    ? `${preferences.primaryModelProvider}:${preferences.primaryModelId}`
    : "";

  const currentModelDisplay = availableModels.find(
    (m) => m.provider === preferences?.primaryModelProvider && m.modelId === preferences?.primaryModelId
  )?.displayName;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Primary Model
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          Primary Model
        </CardTitle>
        <CardDescription>
          Choose your preferred model for synthesis and other operations. This model will be used
          when combining outputs and for AI-powered features throughout the app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {availableModels.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>No models available. Configure API keys or LiteLLM to enable this feature.</span>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="primary-model">Select Primary Model</Label>
              <Select
                value={currentValue}
                onValueChange={handleModelChange}
                disabled={saving}
              >
                <SelectTrigger id="primary-model" className="w-full">
                  <SelectValue placeholder="Select a model...">
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </span>
                    ) : currentModelDisplay ? (
                      currentModelDisplay
                    ) : (
                      "Select a model..."
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {/* Group by provider */}
                  {Object.entries(
                    availableModels.reduce((acc, model) => {
                      const group = model.provider === "LITELLM" ? "LiteLLM Proxy" : AI_PROVIDERS[model.provider as AIProvider]?.name || model.provider;
                      if (!acc[group]) acc[group] = [];
                      acc[group].push(model);
                      return acc;
                    }, {} as Record<string, AvailableModel[]>)
                  ).map(([group, models]) => (
                    <SelectGroup key={group}>
                      <SelectLabel className="text-xs font-semibold">
                        {group}
                      </SelectLabel>
                      {models.map((model) => (
                        <SelectItem
                          key={`${model.provider}:${model.modelId}`}
                          value={`${model.provider}:${model.modelId}`}
                        >
                          <span className="flex items-center gap-2">
                            {model.displayName.replace(`${group} - `, "")}
                            {model.provider === "LITELLM" && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                Proxy
                              </Badge>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {currentValue && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 flex-1">
                  <Star className="h-3.5 w-3.5 flex-shrink-0 fill-current" />
                  <span>
                    <strong>{currentModelDisplay?.split(" - ")[1] || "Model"}</strong> is your primary model for synthesis and refinement.
                  </span>
                </div>
                <button
                  onClick={handleClearModel}
                  disabled={saving}
                  className="ml-2 text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Clear
                </button>
              </div>
            )}

            {!currentValue && availableModels.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>
                  A primary model will be auto-selected from your highest quality available models when you start using the app.
                </span>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              <p>The primary model is used for:</p>
              <ul className="mt-1 list-disc list-inside space-y-0.5">
                <li>Synthesizing outputs from multiple models</li>
                <li>Iterating and refining content</li>
                <li>Content analysis and suggestions</li>
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
