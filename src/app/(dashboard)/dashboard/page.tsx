import { WritingWorkspace } from "@/components/editor/writing-workspace";
import { prisma } from "@/lib/db";
import { AIProvider, GenerationOutput, ContentType } from "@/types";
import { HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageProps {
  searchParams: Promise<{ resumeId?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { resumeId } = await searchParams;
  
  // If resumeId is provided, fetch the generation to resume
  let resumeData: {
    generationId: string;
    prompt: string;
    contentType: string;
    outputs: GenerationOutput[];
    synthesis: string;
    synthesisId: string | null;
    state: "comparing" | "complete";
  } | null = null;

  if (resumeId) {
    const generation = await prisma.generation.findUnique({
      where: { id: resumeId },
      include: {
        outputs: true,
        synthesizedContent: true,
      },
    });

    if (generation) {
      resumeData = {
        generationId: generation.id,
        prompt: generation.prompt,
        contentType: generation.contentType,
        outputs: generation.outputs.map((o) => ({
          provider: o.provider as AIProvider,
          model: o.model,
          content: o.content,
          tokensUsed: o.tokensUsed ?? undefined,
          latencyMs: o.latencyMs ?? undefined,
        })),
        synthesis: generation.synthesizedContent?.content || "",
        synthesisId: generation.synthesizedContent?.id || null,
        state: generation.synthesizedContent ? "complete" : "comparing",
      };
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="font-serif text-xl font-medium">
            {resumeData ? "Resume Draft" : "New Draft"}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {resumeData 
              ? "Continue working on your previous content" 
              : "Compare outputs from multiple AI models"}
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <a href="https://paypal.me/himoacs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
            <HeartHandshake className="h-4 w-4" />
            Donate
          </a>
        </Button>
      </header>
      <div className="flex-1 overflow-hidden">
        <WritingWorkspace
          initialGenerationId={resumeData?.generationId}
          initialPrompt={resumeData?.prompt}
          initialContentType={resumeData?.contentType}
          initialOutputs={resumeData?.outputs}
          initialSynthesis={resumeData?.synthesis}
          initialSynthesisId={resumeData?.synthesisId}
          initialState={resumeData?.state}
        />
      </div>
    </div>
  );
}
