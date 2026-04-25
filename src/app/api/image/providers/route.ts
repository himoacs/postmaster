import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface ImageProvider {
  id: "openai" | "stability";
  name: string;
  available: boolean;
}

// GET /api/image/providers - Check which image providers are available
export async function GET() {
  const providers: ImageProvider[] = [];

  // Check for OpenAI DALL-E availability
  // First check direct API key
  const openaiKey = await prisma.aPIKey.findUnique({
    where: { provider: "OPENAI" },
  });

  // Then check LiteLLM for DALL-E access
  const litellmConfig = await prisma.liteLLMConfig.findFirst({
    where: { isEnabled: true, isValid: true },
  });

  let openaiAvailable = openaiKey?.isValid || false;
  
  // If using LiteLLM, check if dall-e models are in the cached models
  if (litellmConfig && !openaiAvailable) {
    const cachedModels = JSON.parse(litellmConfig.cachedModels || "[]") as Array<{ id: string }>;
    // Check if any DALL-E model is available
    openaiAvailable = cachedModels.some(m => 
      m.id.toLowerCase().includes("dall-e") || 
      m.id.toLowerCase().includes("dalle")
    );
  }

  providers.push({
    id: "openai",
    name: "OpenAI DALL-E 3",
    available: openaiAvailable,
  });

  // Check for Stability AI availability
  const stabilityKey = await prisma.aPIKey.findUnique({
    where: { provider: "STABILITY" },
  });

  providers.push({
    id: "stability",
    name: "Stability AI (Stable Diffusion)",
    available: stabilityKey?.isValid || false,
  });

  return NextResponse.json({ providers });
}
