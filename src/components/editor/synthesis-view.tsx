"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  ImageIcon,
  Download,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { ImageGenerator } from "./image-generator";

interface SynthesisViewProps {
  content: string;
  generationId: string | null;
  onIterate: (feedback: string) => void;
  onBack: () => void;
  onBackToCompare: () => void;
}

export function SynthesisView({
  content,
  generationId,
  onIterate,
  onBack,
  onBackToCompare,
}: SynthesisViewProps) {
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);
  const [showImageGen, setShowImageGen] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAsMarkdown = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `postmaster-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Downloaded as Markdown");
  };

  const handleIterate = () => {
    if (!feedback.trim()) return;
    onIterate(feedback);
    setFeedback("");
  };

  const quickFeedback = [
    "Make it more casual",
    "Make it more professional",
    "Make it shorter",
    "Add more examples",
    "Stronger opening",
    "Better conclusion",
  ];

  const wordCount = content.split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            New
          </Button>
          <Button variant="ghost" size="sm" onClick={onBackToCompare}>
            <Layers className="mr-2 h-4 w-4" />
            Compare
          </Button>
          <div>
            <h2 className="text-xl font-semibold">Synthesized Content</h2>
            <p className="text-sm text-muted-foreground">
              Your final content, ready to refine or export
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{wordCount} words</Badge>
          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            {copied ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button variant="outline" size="sm" onClick={downloadAsMarkdown}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImageGen(!showImageGen)}
          >
            <ImageIcon className="mr-2 h-4 w-4" />
            Generate Image
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Final Content</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {content.split("\n").map((paragraph, i) => (
                  <p key={i} className="mb-3">
                    {paragraph}
                  </p>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Feedback panel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refine
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Not quite right? Provide feedback and we'll iterate.
            </p>

            {/* Quick feedback buttons */}
            <div className="flex flex-wrap gap-2">
              {quickFeedback.map((text) => (
                <Button
                  key={text}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setFeedback(text)}
                >
                  {text}
                </Button>
              ))}
            </div>

            <Textarea
              placeholder="Or describe what you'd like to change..."
              className="min-h-[120px] resize-none"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />

            <Button
              className="w-full"
              onClick={handleIterate}
              disabled={!feedback.trim()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Apply Feedback
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Image generation panel */}
      {showImageGen && (
        <ImageGenerator
          content={content}
          generationId={generationId}
          onClose={() => setShowImageGen(false)}
        />
      )}
    </div>
  );
}
