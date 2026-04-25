import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { AIProvider, ContentType, GenerationStatus } from "@/types";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  ImageIcon,
  Layers,
  Sparkles,
  Play,
  HeartHandshake,
} from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

const contentTypeLabels: Record<ContentType, string> = {
  BLOG_POST: "Blog Post",
  TWEET_THREAD: "Tweet Thread",
  LINKEDIN_POST: "LinkedIn",
  EMAIL: "Email",
  ARTICLE: "Article",
  OTHER: "Other",
};

const statusColors: Record<GenerationStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  GENERATING: "bg-blue-100 text-blue-800",
  SYNTHESIZING: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

export default async function HistoryDetailPage({ params }: PageProps) {
  const { id } = await params;

  const generation = await prisma.generation.findUnique({
    where: { id },
    include: {
      outputs: true,
      synthesizedContent: true,
    },
  });

  if (!generation) {
    notFound();
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="h-full">
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/history">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to History
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/dashboard?resumeId=${id}`}>
              <Play className="mr-2 h-4 w-4" />
              Resume in Workspace
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <a href="https://paypal.me/himoacs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
              <HeartHandshake className="h-4 w-4" />
              Donate
            </a>
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">
              {contentTypeLabels[generation.contentType as ContentType]}
            </Badge>
            <Badge
              variant="secondary"
              className={statusColors[generation.status as GenerationStatus]}
            >
              {generation.status.toLowerCase()}
            </Badge>
            {generation.synthesizedContent?.imageUrl && (
              <Badge variant="secondary" className="gap-1">
                <ImageIcon className="h-3 w-3" />
                Has Image
              </Badge>
            )}
            {(generation.synthesizedContent?.version ?? 1) > 1 && (
              <Badge variant="secondary">
                v{generation.synthesizedContent?.version}
              </Badge>
            )}
          </div>

          <h1 className="text-xl font-semibold">{generation.prompt}</h1>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(generation.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Layers className="h-4 w-4" />
              {generation.outputs.length} model outputs
            </span>
          </div>
        </div>

        <Separator />

        {/* Synthesized Content */}
        {generation.synthesizedContent && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Synthesized Content
                {generation.synthesizedContent.strategy !== "basic" && (
                  <Badge variant="outline" className="ml-2">
                    {generation.synthesizedContent.strategy}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                {generation.synthesizedContent.content}
              </div>

              {generation.synthesizedContent.imageUrl && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Generated Image</h4>
                  <img
                    src={generation.synthesizedContent.imageUrl}
                    alt="Generated content image"
                    className="rounded-lg max-w-md"
                  />
                  {generation.synthesizedContent.imagePrompt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Prompt: {generation.synthesizedContent.imagePrompt}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Individual Model Outputs */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Model Outputs
          </h2>

          <div className="grid gap-4">
            {generation.outputs.map((output) => {
              const provider = AI_PROVIDERS[output.provider as AIProvider];
              return (
                <Card key={output.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        {provider?.name || output.provider}
                        <Badge variant="outline" className="font-normal">
                          {output.model}
                        </Badge>
                      </CardTitle>
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
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap text-muted-foreground">
                      {output.content}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
