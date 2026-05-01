import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface ImageProvider {
  id: string;
  name: string;
  available: boolean;
  source: "direct" | "litellm";
}

// Patterns to identify image generation models
const IMAGE_MODEL_PATTERNS = [
  /dall-?e/i,
  /dalle/i,
  /stable.*diffusion/i,
  /flux/i,
  /midjourney/i,
  /imagen/i,
];

function isImageModel(modelId: string): boolean {
  return IMAGE_MODEL_PATTERNS.some(pattern => pattern.test(modelId));
}

// GET /api/image/providers - Check which image providers are available
export async function GET() {
  const providers: ImageProvider[] = [];

  // Check for OpenAI DALL-E availability (direct API)
  const openaiKey = await prisma.aPIKey.findUnique({
    where: { provider: "OPENAI" },
  });

  if (openaiKey?.isValid) {
    providers.push({
      id: "openai",
      name: "OpenAI DALL-E 3",
      available: true,
      source: "direct",
    });
  }

  // Check for Stability AI availability (direct API)
  const stabilityKey = await prisma.aPIKey.findUnique({
    where: { provider: "STABILITY" },
  });

  if (stabilityKey?.isValid) {
    providers.push({
      id: "stability",
      name: "Stability AI (Stable Diffusion)",
      available: true,
      source: "direct",
    });
  }

  // Check LiteLLM for image generation models
  const litellmConfig = await prisma.liteLLMConfig.findFirst({
    where: { isEnabled: true, isValid: true },
  });

  if (litellmConfig) {
    const cachedModels = JSON.parse(litellmConfig.cachedModels || "[]") as Array<{ id: string; name: string }>;
    const enabledModels = JSON.parse(litellmConfig.enabledModels || "[]") as string[];
    
    // Find image generation models in LiteLLM
    const imageModels = cachedModels.filter(m => isImageModel(m.id));
    
    for (const model of imageModels) {
      // Skip if user has enabled models list and this model isn't in it
      if (enabledModels.length > 0 && !enabledModels.includes(model.id)) {
        continue;
      }
      
      providers.push({
        id: `litellm:${model.id}`,
        name: `${model.name} (LiteLLM)`,
        available: true,
        source: "litellm",
      });
    }
  }

  return NextResponse.json({ providers });
}
