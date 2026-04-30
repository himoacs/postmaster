"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Key,
  Loader2,
  RefreshCw,
  Trash2,
  Server,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AIProvider, LiteLLMModel, OllamaModel } from "@/types";
import { AI_PROVIDERS } from "@/lib/ai/providers";

interface StoredKey {
  provider: AIProvider;
  maskedKey: string;
  isValid: boolean;
  validModels: string[];
  lastValidated: string | null;
}

interface LiteLLMConfigState {
  configured: boolean;
  endpoint?: string;
  hasKey?: boolean;
  isEnabled?: boolean;
  isValid?: boolean;
  modelCount?: number;
  models?: LiteLLMModel[];
}

interface OllamaConfigState {
  configured: boolean;
  endpoint?: string;
  hasKey?: boolean;
  isEnabled?: boolean;
  isValid?: boolean;
  modelCount?: number;
  models?: OllamaModel[];
}

const TEXT_PROVIDERS: AIProvider[] = ["OPENAI", "ANTHROPIC", "XAI", "MISTRAL"];
const IMAGE_PROVIDERS: AIProvider[] = ["STABILITY"];

export function APIKeyManager() {
  const [keys, setKeys] = useState<StoredKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<AIProvider | null>(null);
  const [newKeyValue, setNewKeyValue] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState<AIProvider | null>(null);
  const [saving, setSaving] = useState(false);

  // LiteLLM state
  const [liteLLMConfig, setLiteLLMConfig] = useState<LiteLLMConfigState>({ configured: false });
  const [liteLLMEditing, setLiteLLMEditing] = useState(false);
  const [liteLLMEndpoint, setLiteLLMEndpoint] = useState("");
  const [liteLLMKey, setLiteLLMKey] = useState("");
  const [liteLLMSaving, setLiteLLMSaving] = useState(false);
  const [liteLLMRefreshing, setLiteLLMRefreshing] = useState(false);

  // Ollama state
  const [ollamaConfig, setOllamaConfig] = useState<OllamaConfigState>({ configured: false });
  const [ollamaEditing, setOllamaEditing] = useState(false);
  const [ollamaEndpoint, setOllamaEndpoint] = useState("http://localhost:11434");
  const [ollamaKey, setOllamaKey] = useState("");
  const [ollamaSaving, setOllamaSaving] = useState(false);
  const [ollamaRefreshing, setOllamaRefreshing] = useState(false);

  useEffect(() => {
    fetchKeys();
    fetchLiteLLMConfig();
    fetchOllamaConfig();
  }, []);

  const fetchKeys = async () => {
    try {
      const response = await fetch("/api/keys");
      if (response.ok) {
        const data = await response.json();
        setKeys(data.keys);
      }
    } catch (error) {
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  const fetchLiteLLMConfig = async () => {
    try {
      const response = await fetch("/api/litellm");
      if (response.ok) {
        const data = await response.json();
        setLiteLLMConfig(data);
        if (data.endpoint) {
          setLiteLLMEndpoint(data.endpoint);
        }
      }
    } catch (error) {
      console.error("Failed to load LiteLLM config");
    }
  };

  const saveLiteLLMConfig = async () => {
    if (!liteLLMEndpoint.trim()) {
      toast.error("Endpoint URL is required");
      return;
    }

    setLiteLLMSaving(true);
    try {
      const response = await fetch("/api/litellm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: liteLLMEndpoint,
          apiKey: liteLLMKey || undefined,
          isEnabled: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to connect to LiteLLM");
        return;
      }

      toast.success(`Connected! Found ${data.modelCount} models`);
      setLiteLLMEditing(false);
      setLiteLLMKey("");
      await fetchLiteLLMConfig();
    } catch (error) {
      toast.error("Failed to save LiteLLM configuration");
    } finally {
      setLiteLLMSaving(false);
    }
  };

  const toggleLiteLLM = async (enabled: boolean) => {
    if (!liteLLMConfig.configured) return;

    try {
      const response = await fetch("/api/litellm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: liteLLMConfig.endpoint,
          isEnabled: enabled,
        }),
      });

      if (response.ok) {
        toast.success(enabled ? "LiteLLM enabled" : "LiteLLM disabled");
        await fetchLiteLLMConfig();
      }
    } catch (error) {
      toast.error("Failed to update LiteLLM");
    }
  };

  const refreshLiteLLMModels = async () => {
    setLiteLLMRefreshing(true);
    try {
      const response = await fetch("/api/litellm/models", {
        method: "POST",
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(`Refreshed! Found ${data.modelCount} models`);
        await fetchLiteLLMConfig();
      } else {
        toast.error(data.error || "Failed to refresh models");
      }
    } catch (error) {
      toast.error("Failed to refresh models");
    } finally {
      setLiteLLMRefreshing(false);
    }
  };

  const deleteLiteLLMConfig = async () => {
    try {
      const response = await fetch("/api/litellm", {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("LiteLLM configuration removed");
        setLiteLLMConfig({ configured: false });
        setLiteLLMEndpoint("");
        setLiteLLMKey("");
      }
    } catch (error) {
      toast.error("Failed to remove LiteLLM configuration");
    }
  };
  // Ollama functions
  const fetchOllamaConfig = async () => {
    try {
      const response = await fetch("/api/ollama");
      if (response.ok) {
        const data = await response.json();
        setOllamaConfig(data);
        if (data.endpoint) {
          setOllamaEndpoint(data.endpoint);
        }
      }
    } catch (error) {
      console.error("Failed to load Ollama config");
    }
  };

  const saveOllamaConfig = async () => {
    if (!ollamaEndpoint.trim()) {
      toast.error("Endpoint URL is required");
      return;
    }

    setOllamaSaving(true);
    try {
      const response = await fetch("/api/ollama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: ollamaEndpoint,
          apiKey: ollamaKey || undefined,
          isEnabled: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to connect to Ollama");
        return;
      }

      toast.success(`Connected! Found ${data.modelCount} models`);
      setOllamaEditing(false);
      setOllamaKey("");
      await fetchOllamaConfig();
    } catch (error) {
      toast.error("Failed to save Ollama configuration");
    } finally {
      setOllamaSaving(false);
    }
  };

  const toggleOllama = async (enabled: boolean) => {
    if (!ollamaConfig.configured) return;

    try {
      const response = await fetch("/api/ollama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: ollamaConfig.endpoint,
          isEnabled: enabled,
        }),
      });

      if (response.ok) {
        toast.success(enabled ? "Ollama enabled" : "Ollama disabled");
        await fetchOllamaConfig();
      }
    } catch (error) {
      toast.error("Failed to update Ollama");
    }
  };

  const refreshOllamaModels = async () => {
    setOllamaRefreshing(true);
    try {
      const response = await fetch("/api/ollama/models", {
        method: "POST",
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(`Refreshed! Found ${data.modelCount} models`);
        await fetchOllamaConfig();
      } else {
        toast.error(data.error || "Failed to refresh models");
      }
    } catch (error) {
      toast.error("Failed to refresh models");
    } finally {
      setOllamaRefreshing(false);
    }
  };

  const deleteOllamaConfig = async () => {
    try {
      const response = await fetch("/api/ollama", {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Ollama configuration removed");
        setOllamaConfig({ configured: false });
        setOllamaEndpoint("http://localhost:11434");
        setOllamaKey("");
      }
    } catch (error) {
      toast.error("Failed to remove Ollama configuration");
    }
  };
  const saveKey = async (provider: AIProvider) => {
    if (!newKeyValue.trim()) return;

    setSaving(true);
    try {
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key: newKeyValue }),
      });

      if (!response.ok) throw new Error("Failed to save key");

      toast.success(`${AI_PROVIDERS[provider].name} key saved`);
      setEditingKey(null);
      setNewKeyValue("");
      await fetchKeys();
    } catch (error) {
      toast.error("Failed to save API key");
    } finally {
      setSaving(false);
    }
  };

  const validateKey = async (provider: AIProvider) => {
    setValidating(provider);
    try {
      const response = await fetch("/api/keys/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      if (!response.ok) throw new Error("Validation failed");

      const data = await response.json();
      if (data.valid) {
        toast.success(`${AI_PROVIDERS[provider].name} key is valid`);
      } else {
        toast.error(`${AI_PROVIDERS[provider].name} key is invalid`);
      }
      await fetchKeys();
    } catch (error) {
      toast.error("Failed to validate key");
    } finally {
      setValidating(null);
    }
  };

  const deleteKey = async (provider: AIProvider) => {
    try {
      const response = await fetch(`/api/keys?provider=${provider}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete key");

      toast.success(`${AI_PROVIDERS[provider].name} key removed`);
      await fetchKeys();
    } catch (error) {
      toast.error("Failed to delete API key");
    }
  };

  const getKeyForProvider = (provider: AIProvider) => {
    return keys.find((k) => k.provider === provider);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* LiteLLM Proxy Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              <div>
                <CardTitle>LiteLLM Proxy</CardTitle>
                <CardDescription>
                  Connect to a LiteLLM proxy for unified access to 100+ models
                </CardDescription>
              </div>
            </div>
            {liteLLMConfig.configured && (
              <div className="flex items-center gap-2">
                <Label htmlFor="litellm-toggle" className="text-sm text-muted-foreground">
                  {liteLLMConfig.isEnabled ? "Enabled" : "Disabled"}
                </Label>
                <Switch
                  id="litellm-toggle"
                  checked={liteLLMConfig.isEnabled}
                  onCheckedChange={toggleLiteLLM}
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {liteLLMEditing || !liteLLMConfig.configured ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="litellm-endpoint">Proxy Endpoint URL</Label>
                <Input
                  id="litellm-endpoint"
                  placeholder="http://localhost:4000"
                  value={liteLLMEndpoint}
                  onChange={(e) => setLiteLLMEndpoint(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="litellm-key">API Key (optional)</Label>
                <div className="relative">
                  <Input
                    id="litellm-key"
                    type={showKey ? "text" : "password"}
                    placeholder="sk-... (if your proxy requires authentication)"
                    value={liteLLMKey}
                    onChange={(e) => setLiteLLMKey(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={saveLiteLLMConfig}
                  disabled={liteLLMSaving || !liteLLMEndpoint.trim()}
                >
                  {liteLLMSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="mr-2 h-4 w-4" />
                  )}
                  Connect & Discover Models
                </Button>
                {liteLLMConfig.configured && (
                  <Button variant="outline" onClick={() => setLiteLLMEditing(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <code className="text-sm">{liteLLMConfig.endpoint}</code>
                    <Badge variant={liteLLMConfig.isValid ? "default" : "destructive"}>
                      {liteLLMConfig.isValid ? (
                        <>
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Connected
                        </>
                      ) : (
                        <>
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Disconnected
                        </>
                      )}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {liteLLMConfig.modelCount} models available
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshLiteLLMModels}
                    disabled={liteLLMRefreshing}
                  >
                    {liteLLMRefreshing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setLiteLLMEditing(true)}>
                    Update
                  </Button>
                  <Button variant="outline" size="sm" onClick={deleteLiteLLMConfig}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {liteLLMConfig.models && liteLLMConfig.models.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Available Models</Label>
                  <div className="flex flex-wrap gap-1">
                    {liteLLMConfig.models.slice(0, 8).map((model) => (
                      <Badge key={model.id} variant="secondary" className="text-xs">
                        {model.name}
                      </Badge>
                    ))}
                    {liteLLMConfig.models.length > 8 && (
                      <Badge variant="secondary" className="text-xs">
                        +{liteLLMConfig.models.length - 8} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ollama Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              <div>
                <CardTitle>Ollama (Local)</CardTitle>
                <CardDescription>
                  Run models locally with privacy and zero cost
                </CardDescription>
              </div>
            </div>
            {ollamaConfig.configured && (
              <div className="flex items-center gap-2">
                <Label htmlFor="ollama-toggle" className="text-sm text-muted-foreground">
                  {ollamaConfig.isEnabled ? "Enabled" : "Disabled"}
                </Label>
                <Switch
                  id="ollama-toggle"
                  checked={ollamaConfig.isEnabled}
                  onCheckedChange={toggleOllama}
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {ollamaEditing || !ollamaConfig.configured ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ollama-endpoint">Ollama Endpoint URL</Label>
                <Input
                  id="ollama-endpoint"
                  placeholder="http://localhost:11434"
                  value={ollamaEndpoint}
                  onChange={(e) => setOllamaEndpoint(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ollama-key">API Key (optional)</Label>
                <div className="relative">
                  <Input
                    id="ollama-key"
                    type={showKey ? "text" : "password"}
                    placeholder="Only needed for remote Ollama instances"
                    value={ollamaKey}
                    onChange={(e) => setOllamaKey(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={saveOllamaConfig}
                  disabled={ollamaSaving || !ollamaEndpoint.trim()}
                >
                  {ollamaSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="mr-2 h-4 w-4" />
                  )}
                  Connect & Discover Models
                </Button>
                {ollamaConfig.configured && (
                  <Button variant="outline" onClick={() => setOllamaEditing(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <code className="text-sm">{ollamaConfig.endpoint}</code>
                    <Badge variant={ollamaConfig.isValid ? "default" : "destructive"}>
                      {ollamaConfig.isValid ? (
                        <>
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Connected
                        </>
                      ) : (
                        <>
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Disconnected
                        </>
                      )}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {ollamaConfig.modelCount} models available
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshOllamaModels}
                    disabled={ollamaRefreshing}
                  >
                    {ollamaRefreshing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setOllamaEditing(true)}>
                    Update
                  </Button>
                  <Button variant="outline" size="sm" onClick={deleteOllamaConfig}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {ollamaConfig.models && ollamaConfig.models.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Available Models</Label>
                  <div className="flex flex-wrap gap-1">
                    {ollamaConfig.models.slice(0, 8).map((model) => (
                      <Badge key={model.id} variant="secondary" className="text-xs">
                        {model.name}
                      </Badge>
                    ))}
                    {ollamaConfig.models.length > 8 && (
                      <Badge variant="secondary" className="text-xs">
                        +{ollamaConfig.models.length - 8} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Text Generation API Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {TEXT_PROVIDERS.map((provider) => {
            const storedKey = getKeyForProvider(provider);
            const providerInfo = AI_PROVIDERS[provider];
            const isEditing = editingKey === provider;

            return (
              <div
                key={provider}
                className="rounded-lg border p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{providerInfo.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {providerInfo.description}
                    </p>
                  </div>
                  {storedKey && (
                    <Badge
                      variant={storedKey.isValid ? "default" : "destructive"}
                    >
                      {storedKey.isValid ? (
                        <>
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Valid
                        </>
                      ) : (
                        <>
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Invalid
                        </>
                      )}
                    </Badge>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <Input
                        type={showKey ? "text" : "password"}
                        placeholder={`Enter your ${providerInfo.name} API key`}
                        value={newKeyValue}
                        onChange={(e) => setNewKeyValue(e.target.value)}
                        className="pr-10"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveKey(provider)}
                        disabled={saving || !newKeyValue.trim()}
                      >
                        {saving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Save & Validate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingKey(null);
                          setNewKeyValue("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : storedKey ? (
                  <div className="flex items-center justify-between">
                    <code className="text-sm text-muted-foreground">
                      {storedKey.maskedKey}
                    </code>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => validateKey(provider)}
                        disabled={validating === provider}
                      >
                        {validating === provider ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Validate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingKey(provider)}
                      >
                        Update
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteKey(provider)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setEditingKey(provider)}
                  >
                    Add API Key
                  </Button>
                )}

                {storedKey?.isValid && storedKey.validModels.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {storedKey.validModels.slice(0, 5).map((model) => (
                      <Badge key={model} variant="secondary" className="text-xs">
                        {model}
                      </Badge>
                    ))}
                    {storedKey.validModels.length > 5 && (
                      <Badge variant="secondary" className="text-xs">
                        +{storedKey.validModels.length - 5} more
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Image Generation API Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* OpenAI for DALL-E is shared */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">OpenAI DALL-E</h4>
                <p className="text-sm text-muted-foreground">
                  Uses your OpenAI API key for image generation
                </p>
              </div>
              {getKeyForProvider("OPENAI") ? (
                <Badge variant="default">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Available
                </Badge>
              ) : (
                <Badge variant="secondary">Not configured</Badge>
              )}
            </div>
          </div>

          {IMAGE_PROVIDERS.map((provider) => {
            const storedKey = getKeyForProvider(provider);
            const providerInfo = AI_PROVIDERS[provider];
            const isEditing = editingKey === provider;

            return (
              <div
                key={provider}
                className="rounded-lg border p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{providerInfo.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {providerInfo.description}
                    </p>
                  </div>
                  {storedKey && (
                    <Badge
                      variant={storedKey.isValid ? "default" : "destructive"}
                    >
                      {storedKey.isValid ? (
                        <>
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Valid
                        </>
                      ) : (
                        <>
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Invalid
                        </>
                      )}
                    </Badge>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <Input
                        type={showKey ? "text" : "password"}
                        placeholder={`Enter your ${providerInfo.name} API key`}
                        value={newKeyValue}
                        onChange={(e) => setNewKeyValue(e.target.value)}
                        className="pr-10"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveKey(provider)}
                        disabled={saving || !newKeyValue.trim()}
                      >
                        {saving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Save & Validate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingKey(null);
                          setNewKeyValue("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : storedKey ? (
                  <div className="flex items-center justify-between">
                    <code className="text-sm text-muted-foreground">
                      {storedKey.maskedKey}
                    </code>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => validateKey(provider)}
                        disabled={validating === provider}
                      >
                        {validating === provider ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Validate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingKey(provider)}
                      >
                        Update
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteKey(provider)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setEditingKey(provider)}
                  >
                    Add API Key
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
