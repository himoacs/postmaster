import { prisma } from "@/lib/db";
import { HistoryList } from "@/components/history/history-list";
import { HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentType, GenerationStatus, AIProvider } from "@/types";

export default async function HistoryPage() {
  const generations = await prisma.generation.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      outputs: {
        select: {
          provider: true,
          model: true,
        },
      },
      synthesizedContent: {
        select: {
          content: true,
          imageUrl: true,
          version: true,
        },
      },
    },
  });

  const formattedGenerations = generations.map((g) => ({
    id: g.id,
    prompt: g.prompt,
    contentType: g.contentType as ContentType,
    status: g.status as GenerationStatus,
    createdAt: g.createdAt.toISOString(),
    models: g.outputs.map((o) => ({ 
      provider: o.provider as AIProvider, 
      model: o.model 
    })),
    hasSynthesis: !!g.synthesizedContent,
    synthesisPreview: g.synthesizedContent?.content?.substring(0, 200),
    hasImage: !!g.synthesizedContent?.imageUrl,
    version: g.synthesizedContent?.version || 1,
  }));

  return (
    <div className="h-full">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="font-serif text-xl font-medium">History</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            View and continue previous generations
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <a href="https://paypal.me/himoacs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
            <HeartHandshake className="h-4 w-4" />
            Donate
          </a>
        </Button>
      </header>
      <div className="p-6">
        <div className="mx-auto max-w-4xl">
          <HistoryList initialGenerations={formattedGenerations} />
        </div>
      </div>
    </div>
  );
}
