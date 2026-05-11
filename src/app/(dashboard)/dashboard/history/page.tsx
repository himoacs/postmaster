import { prisma } from "@/lib/db";
import { HistoryList } from "@/components/history/history-list";
import { ContentType, GenerationStatus, AIProvider } from "@/types";

// Disable caching to always show fresh generations
export const dynamic = "force-dynamic";

interface GenerationOutput {
  provider: string;
  model: string;
}

interface SynthesizedContent {
  content: string | null;
  imageUrl: string | null;
  version: number;
}

interface GenerationWithRelations {
  id: string;
  prompt: string;
  contentType: string;
  status: string;
  createdAt: Date;
  outputs: GenerationOutput[];
  synthesizedContent: SynthesizedContent | null;
}

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

  const formattedGenerations = generations.map((g: GenerationWithRelations) => ({
    id: g.id,
    prompt: g.prompt,
    contentType: g.contentType as ContentType,
    status: g.status as GenerationStatus,
    createdAt: g.createdAt.toISOString(),
    models: g.outputs.map((o: { provider: string; model: string }) => ({ 
      provider: o.provider as AIProvider, 
      model: o.model 
    })),
    hasSynthesis: !!g.synthesizedContent,
    synthesisPreview: g.synthesizedContent?.content?.substring(0, 200),
    hasImage: !!g.synthesizedContent?.imageUrl,
    version: g.synthesizedContent?.version || 1,
  }));

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4 flex-shrink-0">
        <div>
          <h1 className="font-serif text-xl font-medium">History</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            View and continue previous generations
          </p>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl">
          <HistoryList initialGenerations={formattedGenerations} />
        </div>
      </div>
    </div>
  );
}
