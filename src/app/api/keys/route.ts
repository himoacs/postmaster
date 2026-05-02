import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt, decrypt, maskApiKey } from "@/lib/encryption";
import { validateOpenAIKey } from "@/lib/ai/openai";
import { validateAnthropicKey } from "@/lib/ai/claude";
import { validateMistralKey } from "@/lib/ai/mistral";
import { validateGrokKey } from "@/lib/ai/grok";
import { validateStabilityKey } from "@/lib/ai/stability";

// Valid AI providers
const AI_PROVIDERS = ["OPENAI", "ANTHROPIC", "XAI", "MISTRAL", "STABILITY"] as const;
type AIProvider = (typeof AI_PROVIDERS)[number];

// GET /api/keys - List all API keys
export async function GET() {
  try {
    const keys = await prisma.aPIKey.findMany({
      select: {
        provider: true,
        encryptedKey: true,
        isValid: true,
        validModels: true,
        enabledModels: true,
        lastValidated: true,
      },
    });

    // Mask the keys for display and parse validModels JSON
    // Handle decryption failures gracefully (e.g., after encryption key changes)
    const maskedKeys = keys
      .map((key) => {
        try {
          const decryptedKey = decrypt(key.encryptedKey);
          return {
            provider: key.provider,
            maskedKey: maskApiKey(decryptedKey),
            isValid: key.isValid,
            validModels: JSON.parse(key.validModels) as string[],
            enabledModels: JSON.parse(key.enabledModels) as string[],
            lastValidated: key.lastValidated,
          };
        } catch (error) {
          console.error(`Failed to decrypt API key for ${key.provider}:`, error);
          // Return null for keys that can't be decrypted (will be filtered out)
          return null;
        }
      })
      .filter((key): key is NonNullable<typeof key> => key !== null);

    return NextResponse.json({ keys: maskedKeys });
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json(
      { error: "Failed to fetch API keys", keys: [] },
      { status: 500 }
    );
  }
}

// POST /api/keys - Save a new API key
export async function POST(request: NextRequest) {
  const { provider, key } = await request.json();

  if (!provider || !key) {
    return NextResponse.json(
      { error: "Provider and key are required" },
      { status: 400 }
    );
  }

  // Validate provider
  if (!AI_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  // Validate the key
  const validationResult = await validateKey(provider, key);

  // Encrypt and store
  const encryptedKey = encrypt(key);

  await prisma.aPIKey.upsert({
    where: { provider },
    update: {
      encryptedKey,
      isValid: validationResult.valid,
      validModels: JSON.stringify(validationResult.models || []),
      lastValidated: new Date(),
    },
    create: {
      provider,
      encryptedKey,
      isValid: validationResult.valid,
      validModels: JSON.stringify(validationResult.models || []),
      lastValidated: new Date(),
    },
  });

  return NextResponse.json({
    success: true,
    valid: validationResult.valid,
    models: validationResult.models,
  });
}

// DELETE /api/keys - Delete an API key
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") as AIProvider;

  if (!provider) {
    return NextResponse.json(
      { error: "Provider is required" },
      { status: 400 }
    );
  }

  await prisma.aPIKey.delete({
    where: { provider },
  });

  return NextResponse.json({ success: true });
}

// PATCH /api/keys - Update enabled models for a provider
export async function PATCH(request: NextRequest) {
  const { provider, enabledModels } = await request.json();

  if (!provider) {
    return NextResponse.json(
      { error: "Provider is required" },
      { status: 400 }
    );
  }

  if (!AI_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  if (!Array.isArray(enabledModels)) {
    return NextResponse.json(
      { error: "enabledModels must be an array" },
      { status: 400 }
    );
  }

  const updated = await prisma.aPIKey.update({
    where: { provider },
    data: {
      enabledModels: JSON.stringify(enabledModels),
    },
  });

  return NextResponse.json({
    success: true,
    enabledModels: JSON.parse(updated.enabledModels) as string[],
  });
}

async function validateKey(
  provider: AIProvider,
  key: string
): Promise<{ valid: boolean; models?: string[] }> {
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
      return { valid: false };
  }
}
