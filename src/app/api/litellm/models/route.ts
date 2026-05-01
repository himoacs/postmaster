/**
 * LiteLLM Models API
 * 
 * GET  /api/litellm/models - Get available models from LiteLLM proxy
 * POST /api/litellm/models - Refresh models from LiteLLM proxy
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { fetchLiteLLMModels } from "@/lib/ai/litellm";
import { LiteLLMModel } from "@/types";

// GET - Return cached models
export async function GET() {
  try {
    const config = await prisma.liteLLMConfig.findFirst();
    
    if (!config) {
      return NextResponse.json({
        configured: false,
        models: [],
      });
    }
    
    if (!config.isEnabled) {
      return NextResponse.json({
        configured: true,
        enabled: false,
        models: [],
      });
    }
    
    // Parse cached models
    let models: LiteLLMModel[] = [];
    try {
      models = JSON.parse(config.cachedModels);
    } catch {
      models = [];
    }
    
    // Parse enabled models (empty = all enabled)
    let enabledModels: string[] = [];
    try {
      enabledModels = JSON.parse(config.enabledModels);
    } catch {
      enabledModels = [];
    }
    
    return NextResponse.json({
      configured: true,
      enabled: config.isEnabled,
      valid: config.isValid,
      models,
      enabledModels,
      lastValidated: config.lastValidated?.toISOString(),
    });
  } catch (error) {
    console.error("Error fetching LiteLLM models:", error);
    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 }
    );
  }
}

// POST - Refresh models from LiteLLM proxy
export async function POST() {
  try {
    const config = await prisma.liteLLMConfig.findFirst();
    
    if (!config) {
      return NextResponse.json(
        { error: "LiteLLM not configured" },
        { status: 400 }
      );
    }
    
    // Decrypt API key if present
    let apiKey: string | undefined;
    if (config.encryptedKey) {
      try {
        apiKey = decrypt(config.encryptedKey);
      } catch {
        console.error("Failed to decrypt LiteLLM API key");
      }
    }
    
    // Fetch fresh models
    const models = await fetchLiteLLMModels(config.endpoint, apiKey);
    
    // Update cached models
    await prisma.liteLLMConfig.update({
      where: { id: config.id },
      data: {
        cachedModels: JSON.stringify(models),
        isValid: models.length > 0,
        lastValidated: new Date(),
      },
    });
    
    return NextResponse.json({
      success: true,
      models,
      modelCount: models.length,
    });
  } catch (error) {
    console.error("Error refreshing LiteLLM models:", error);
    return NextResponse.json(
      { error: "Failed to refresh models" },
      { status: 500 }
    );
  }
}
