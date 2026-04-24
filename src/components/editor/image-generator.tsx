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
import { X, Sparkles, Download, RefreshCw, Wand2 } from "lucide-react";
import { toast } from "sonner";

interface ImageGeneratorProps {
  content: string;
  generationId: string | null;
  onClose: () => void;
}

type ImageProvider = "openai" | "stability";

export function ImageGenerator({
  content,
  generationId,
  onClose,
}: ImageGeneratorProps) {
  const [provider, setProvider] = useState<ImageProvider>("openai");
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);

  // Auto-generate prompt when component mounts (only if content has actual text)
  useEffect(() => {
    if (content?.trim() && !prompt) {
      generatePrompt(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generatePrompt = async (silent = false) => {
    if (!content?.trim()) {
      if (!silent) toast.error("No content available to generate prompt from");
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
    } catch (error) {
      // Only show toast for manual generation, not auto-generation
      if (!silent) {
        toast.error(error instanceof Error ? error.message : "Failed to generate image prompt");
      }
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const generateImage = async () => {
    if (!prompt.trim()) return;

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

      if (!response.ok) throw new Error("Failed to generate image");

      const data = await response.json();
      setImageUrl(data.imageUrl);
      toast.success("Image generated successfully");
    } catch (error) {
      toast.error("Failed to generate image");
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = async () => {
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Generate Image</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Image Provider</Label>
              <Select
                value={provider}
                onValueChange={(v) => setProvider(v as ImageProvider)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI DALL-E 3</SelectItem>
                  <SelectItem value="stability">
                    Stability AI (Stable Diffusion)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Image Prompt</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={generatePrompt}
                  disabled={generatingPrompt}
                >
                  <Wand2 className="mr-2 h-3 w-3" />
                  {generatingPrompt ? "Generating..." : "Regenerate"}
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
                  placeholder="Describe the image you want to generate..."
                  className="min-h-[120px] resize-none"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              )}
              {prompt && !generatingPrompt && (
                <p className="text-xs text-muted-foreground">
                  Auto-generated from your content. Feel free to edit.
                </p>
              )}
            </div>

            <Button
              className="w-full"
              onClick={generateImage}
              disabled={loading || !prompt.trim()}
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
            <div className="aspect-square rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
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
      </CardContent>
    </Card>
  );
}
