import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContentType, GenerationStatus } from "@/types";
import { HistoryDetailContent } from "@/components/history/history-detail-content";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  ImageIcon,
  Layers,
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
    <div className="h-full flex flex-col">
      <header className="border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/history">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to History
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link href={`/dashboard?resumeId=${id}`}>
                <Play className="mr-2 h-4 w-4" />
                Resume in Workspace
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
              <a href="https://paypal.me/himoacs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                <HeartHandshake className="h-4 w-4" />
                Sponsor
              </a>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="space-y-3">
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

        {/* Collapsible Content Sections */}
        <HistoryDetailContent
          prompt={generation.prompt}
          contentMode={generation.contentMode}
          sourceContent={generation.sourceContent}
          outputs={generation.outputs.map((output) => ({
            id: output.id,
            provider: output.provider,
            model: output.model,
            content: output.content,
            tokensUsed: output.tokensUsed,
            latencyMs: output.latencyMs,
          }))}
          synthesizedContent={
            generation.synthesizedContent
              ? {
                  content: generation.synthesizedContent.content,
                  strategy: generation.synthesizedContent.strategy,
                  version: generation.synthesizedContent.version,
                  imageUrl: generation.synthesizedContent.imageUrl,
                  imagePrompt: generation.synthesizedContent.imagePrompt,
                }
              : null
          }
        />
      </div>
    </div>
  );
}
