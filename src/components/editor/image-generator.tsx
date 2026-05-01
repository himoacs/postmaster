"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Sparkles, Download, RefreshCw, Wand2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ImageGeneratorProps {
  content: string;
  generationId: string | null;
  onClose: () => void;
  embedded?: boolean;
}

interface AvailableProvider {
  id: string;
  name: string;
  available: boolean;
  source?: "direct" | "litellm";
}

export function ImageGenerator({
  content,
  generationId,
  onClose,
  embedded = false,
}: ImageGeneratorProps) {
  const [provider, setProvider] = useState<string>("");
  const [availableProviders, setAvailableProviders] = useState<AvailableProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);

  // Fetch available providers on mount
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await fetch("/api/image/providers");
        const data = await response.json();
        setAvailableProviders(data.providers || []);
        
        // Auto-select first available provider
        const firstAvailable = data.providers?.find((p: AvailableProvider) => p.available);
        if (firstAvailable) {
          setProvider(firstAvailable.id);
        }
      } catch (error) {
        console.error("Failed to fetch image providers:", error);
      } finally {
        setLoadingProviders(false);
      }
    };
    fetchProviders();
  }, []);

  const generatePromptFromContent = async () => {
    if (!content?.trim()) {
      toast.error("No content available to generate prompt from");
      return;
    }
    
    setGeneratingPrompt(true);
    try {
      const response = await fetch("/api/image/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate prompt");
      }

      const data = await response.json();
      setPrompt(data.prompt);
      toast.success("Prompt generated from your content");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate image prompt");
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const generateImage = async () => {
    if (!prompt.trim() || !provider) return;

    setLoading(true);
    try {
      const response = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          provider,
          generationId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate image");
      }

      setImageUrl(data.imageUrl);
      toast.success("Image generated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate image");
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = async () => {
    if (!imageUrl) return;

    try {
      // Use proxy endpoint to avoid CORS issues with external image URLs
      const response = await fetch("/api/image/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });

      if (!response.ok) {
        throw new Error("Failed to download image");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `postmaster-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Image downloaded");
    } catch (error) {
      toast.error("Failed to download image");
    }
  };

  const imageContent = (
    <div className="space-y-4">
      <div className={embedded ? "space-y-4" : "grid gap-4 lg:grid-cols-2"}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Image Provider</Label>
            {loadingProviders ? (
              <Skeleton className="h-10 w-full" />
            ) : availableProviders.filter(p => p.available).length === 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">No image providers available</p>
                    <p className="mt-1 text-xs">
                      Add an OpenAI API key or Stability AI key in Settings to enable image generation.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <Select
                value={provider}
                onValueChange={setProvider}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders
                    .filter(p => p.available)
                    .map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Image Prompt</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generatePromptFromContent()}
                disabled={generatingPrompt || !content?.trim()}
              >
                <Wand2 className="mr-2 h-3 w-3" />
                {generatingPrompt ? "Generating..." : "Suggest from Content"}
              </Button>
            </div>
            {generatingPrompt ? (
              <div className="min-h-[120px] rounded-md border bg-muted/50 p-3 flex items-center justify-center">
                <div className="text-center">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Creating prompt from your content...
                  </p>
                </div>
              </div>
            ) : (
              <Textarea
                placeholder="Describe the image you want to generate, or click 'Suggest from Content' for AI assistance..."
                className="min-h-[120px] resize-none"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            )}
          </div>

          <Button
            className="w-full"
            onClick={generateImage}
            disabled={loading || !prompt.trim() || !provider}
          >
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Image
              </>
            )}
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Preview</Label>
          <div className={`rounded-lg border bg-muted flex items-center justify-center overflow-hidden ${embedded ? "aspect-video" : "aspect-square"}`}>
            {loading ? (
              <Skeleton className="w-full h-full" />
            ) : imageUrl ? (
              <img
                src={imageUrl}
                alt="Generated image"
                className="w-full h-full object-cover"
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center p-4">
                Your generated image will appear here
              </p>
            )}
          </div>
          {imageUrl && (
            <Button variant="outline" className="w-full" onClick={downloadImage}>
              <Download className="mr-2 h-4 w-4" />
              Download Image
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Generate Image
        </h3>
        {imageContent}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Generate Image</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {imageContent}
      </CardContent>
    </Card>
  );
}
