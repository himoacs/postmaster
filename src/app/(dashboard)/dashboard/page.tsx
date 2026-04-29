import { WritingWorkspace } from "@/components/editor/writing-workspace";
import { WelcomeBanner } from "@/components/onboarding/welcome-banner";
import { prisma } from "@/lib/db";
import { AIProvider, GenerationOutput, ContentType } from "@/types";
import { HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageProps {
  searchParams: Promise<{ resumeId?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { resumeId } = await searchParams;
  
  // Check if user has any valid API keys
  const apiKeyCount = await prisma.aPIKey.count({
    where: { isValid: true },
  });
  const hasApiKeys = apiKeyCount > 0;
  
  // Also check if LiteLLM is configured
  const litellmConfig = await prisma.liteLLMConfig.findFirst({
    where: { isEnabled: true, isValid: true },
  });
  const hasLiteLLM = !!litellmConfig;
  const hasAnyProvider = hasApiKeys || hasLiteLLM;
  
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
        outputs: generation.outputs.map((o: { provider: string; model: string; content: string; tokensUsed: number | null; latencyMs: number | null }) => ({
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
    <div className="h-full flex flex-col">
      {/* Welcome Banner */}
      {!hasAnyProvider && (
        <div className="flex-shrink-0 p-6 pb-0">
          <WelcomeBanner hasApiKeys={hasAnyProvider} />
        </div>
      )}
      
      <div className="flex-1 min-h-0 overflow-hidden">
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
