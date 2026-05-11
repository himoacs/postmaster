"use client";

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { AIProvider } from "@/types";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  MessageSquare,
  Sparkles,
  ImageIcon,
  GitCompare,
} from "lucide-react";

interface Output {
  id: string;
  provider: string;
  model: string;
  content: string;
  tokensUsed: number | null;
  latencyMs: number | null;
}

interface SynthesizedContent {
  content: string;
  strategy: string;
  version: number;
  imageUrl: string | null;
  imagePrompt: string | null;
}

interface HistoryDetailContentProps {
  prompt: string;
  outputs: Output[];
  synthesizedContent: SynthesizedContent | null;
  contentMode?: string;
  sourceContent?: string | null;
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
}: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                {icon}
                {title}
                {badge}
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
}

function computeSimpleDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const dp: number[][] = Array(oldLines.length + 1)
    .fill(null)
    .map(() => Array(newLines.length + 1).fill(0));

  for (let i = 1; i <= oldLines.length; i++) {
    for (let j = 1; j <= newLines.length; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find diff
  let i = oldLines.length;
  let j = newLines.length;
  const temp: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      temp.push({ type: "unchanged", content: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      temp.push({ type: "added", content: newLines[j - 1] });
      j--;
    } else {
      temp.push({ type: "removed", content: oldLines[i - 1] });
      i--;
    }
  }

  return temp.reverse();
}

export function HistoryDetailContent({
  prompt,
  outputs,
  synthesizedContent,
  contentMode,
  sourceContent,
}: HistoryDetailContentProps) {
  console.log("[HistoryDetailContent] Rendering with:", {
    outputsLength: outputs.length,
    hasSynthesizedContent: !!synthesizedContent,
    shouldDefaultOpen: !synthesizedContent || outputs.length === 1,
    contentMode,
  });

  return (
    <div className="space-y-4">
      {/* Original Content Section - Only show for enhance mode */}
      {contentMode === "enhance" && sourceContent && (
        <CollapsibleSection
          title="Original Content"
          icon={<FileText className="h-5 w-5 text-blue-500" />}
          badge={
            <Badge variant="outline" className="ml-2 font-normal">
              Before Enhancement
            </Badge>
          }
          defaultOpen={true}
        >
          <div className="space-y-2">
            <div className="prose prose-sm prose-editorial max-w-none dark:prose-invert whitespace-pre-wrap">
              {sourceContent}
            </div>
            <div className="text-xs text-muted-foreground pt-2 border-t">
              {sourceContent.split(/\s+/).filter(Boolean).length} words
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Prompt Section */}
      <CollapsibleSection
        title="Prompt"
        icon={<MessageSquare className="h-5 w-5 text-muted-foreground" />}
        defaultOpen={true}
      >
        <p className="text-sm whitespace-pre-wrap">{prompt}</p>
      </CollapsibleSection>

      {/* Diff Section - Only show for enhance mode when we have both original and synthesized */}
      {contentMode === "enhance" && sourceContent && synthesizedContent && (
        <CollapsibleSection
          title="Changes Made"
          icon={<GitCompare className="h-5 w-5 text-green-500" />}
          badge={
            <Badge variant="outline" className="ml-2 font-normal">
              Diff View
            </Badge>
          }
          defaultOpen={true}
        >
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground mb-3">
              Line-by-line comparison showing changes from original to enhanced content
            </div>
            <div className="font-mono text-xs border rounded-lg overflow-hidden">
              {computeSimpleDiff(sourceContent, synthesizedContent.content).map((line, idx) => {
                if (line.type === "unchanged") {
                  return (
                    <div key={idx} className="px-3 py-1 bg-background">
                      <span className="text-muted-foreground mr-3 select-none">│</span>
                      {line.content}
                    </div>
                  );
                } else if (line.type === "added") {
                  return (
                    <div key={idx} className="px-3 py-1 bg-green-500/10 text-green-700 dark:text-green-400">
                      <span className="mr-3 select-none">+</span>
                      {line.content}
                    </div>
                  );
                } else {
                  return (
                    <div key={idx} className="px-3 py-1 bg-red-500/10 text-red-700 dark:text-red-400">
                      <span className="mr-3 select-none">-</span>
                      {line.content}
                    </div>
                  );
                }
              })}
            </div>
            <div className="text-xs text-muted-foreground pt-2 flex items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="text-green-600 dark:text-green-400">+</span>
                Added lines
              </span>
              <span className="flex items-center gap-1">
                <span className="text-red-600 dark:text-red-400">-</span>
                Removed lines
              </span>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Synthesized Output Section */}
      {synthesizedContent && (
        <CollapsibleSection
          title="Synthesized Output"
          icon={<Sparkles className="h-5 w-5 text-amber-500" />}
          badge={
            synthesizedContent.strategy !== "basic" && (
              <Badge variant="outline" className="ml-2 font-normal">
                {synthesizedContent.strategy}
              </Badge>
            )
          }
          defaultOpen={true}
        >
          <div className="space-y-4">
            <div className="prose prose-sm prose-editorial max-w-none dark:prose-invert whitespace-pre-wrap">
              {synthesizedContent.content}
            </div>

            {synthesizedContent.imageUrl && (
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Generated Image
                </h4>
                <img
                  src={synthesizedContent.imageUrl}
                  alt="Generated content image"
                  className="rounded-lg max-w-md"
                />
                {synthesizedContent.imagePrompt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Prompt: {synthesizedContent.imagePrompt}
                  </p>
                )}
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Model Outputs Section */}
      <CollapsibleSection
        title="Model Outputs"
        icon={<FileText className="h-5 w-5 text-muted-foreground" />}
        badge={
          <Badge variant="secondary" className="ml-2">
            {outputs.length}
          </Badge>
        }
        defaultOpen={outputs.length === 1 || !synthesizedContent}
      >
        <div className="space-y-4">
          {outputs.map((output) => {
            const provider = AI_PROVIDERS[output.provider as AIProvider];
            return (
              <ModelOutputCard key={output.id} output={output} provider={provider} />
            );
          })}
        </div>
      </CollapsibleSection>
    </div>
  );
}

interface ModelOutputCardProps {
  output: Output;
  provider: { name: string } | undefined;
}

function ModelOutputCard({ output, provider }: ModelOutputCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer select-none hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="font-medium text-sm">
                {provider?.name || output.provider}
              </span>
              <Badge variant="outline" className="font-normal text-xs">
                {output.model}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {output.tokensUsed && (
                <span>{output.tokensUsed.toLocaleString()} tokens</span>
              )}
              {output.latencyMs && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {(output.latencyMs / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 border-t">
            <div className="prose prose-sm prose-editorial max-w-none dark:prose-invert whitespace-pre-wrap pt-3">
              {output.content}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
