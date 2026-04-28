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

export function HistoryDetailContent({
  prompt,
  outputs,
  synthesizedContent,
}: HistoryDetailContentProps) {
  return (
    <div className="space-y-4">
      {/* Prompt Section */}
      <CollapsibleSection
        title="Prompt"
        icon={<MessageSquare className="h-5 w-5 text-muted-foreground" />}
        defaultOpen={true}
      >
        <p className="text-sm whitespace-pre-wrap">{prompt}</p>
      </CollapsibleSection>

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
        defaultOpen={false}
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
