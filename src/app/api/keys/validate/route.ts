import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { validateOpenAIKey } from "@/lib/ai/openai";
import { validateAnthropicKey } from "@/lib/ai/claude";
import { validateMistralKey } from "@/lib/ai/mistral";
import { validateGrokKey } from "@/lib/ai/grok";
import { validateStabilityKey } from "@/lib/ai/stability";

// Valid AI providers
const AI_PROVIDERS = ["OPENAI", "ANTHROPIC", "XAI", "MISTRAL", "STABILITY"] as const;
type AIProvider = (typeof AI_PROVIDERS)[number];

// POST /api/keys/validate - Re-validate an existing key
export async function POST(request: NextRequest) {
  const { provider } = await request.json();

  if (!provider || !AI_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  // Get the stored key
  const storedKey = await prisma.aPIKey.findUnique({
    where: { provider },
  });

  if (!storedKey) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  // Decrypt and validate
  const key = decrypt(storedKey.encryptedKey);
  const validationResult = await validateKey(provider, key);

  // Update validation status
  await prisma.aPIKey.update({
    where: { provider },
    data: {
      isValid: validationResult.valid,
      validModels: JSON.stringify(validationResult.models || []),
      lastValidated: new Date(),
    },
  });

  return NextResponse.json({
    valid: validationResult.valid,
    models: validationResult.models,
    error: validationResult.error,
  });
}

async function validateKey(
  provider: AIProvider,
  key: string
): Promise<{ valid: boolean; models?: string[]; error?: string }> {
  switch (provider) {
    case "OPENAI":
      return validateOpenAIKey(key);
    case "ANTHROPIC":
      return validateAnthropicKey(key);
    case "MISTRAL":
      return validateMistralKey(key);
    case "XAI":
      return validateGrokKey(key);
    case "STABILITY":
      return validateStabilityKey(key);
    default:
      return { valid: false, error: "Unknown provider" };
  }
}
