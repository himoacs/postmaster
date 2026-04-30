/**
 * Ollama Models API
 * 
 * GET  /api/ollama/models - Get available models from Ollama
 * POST /api/ollama/models - Refresh models from Ollama
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { fetchOllamaModels } from "@/lib/ai/ollama";
import { OllamaModel } from "@/types";

// GET - Return cached models
export async function GET() {
  try {
    const config = await prisma.ollamaConfig.findFirst();
    
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
    let models: OllamaModel[] = [];
    try {
      models = JSON.parse(config.cachedModels);
    } catch {
      models = [];
    }
    
    return NextResponse.json({
      configured: true,
      enabled: config.isEnabled,
      valid: config.isValid,
      models,
      lastValidated: config.lastValidated?.toISOString(),
    });
  } catch (error) {
    console.error("Error fetching Ollama models:", error);
    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 }
    );
  }
}

// POST - Refresh models from Ollama
export async function POST() {
  try {
    const config = await prisma.ollamaConfig.findFirst();
    
    if (!config) {
      return NextResponse.json(
        { error: "Ollama not configured" },
        { status: 400 }
      );
    }
    
    // Decrypt API key if present
    let apiKey: string | undefined;
    if (config.encryptedKey) {
      try {
        apiKey = decrypt(config.encryptedKey);
      } catch {
        console.error("Failed to decrypt Ollama API key");
      }
    }
    
    // Fetch fresh models
    const models = await fetchOllamaModels(config.endpoint, apiKey);
    
    // Update cached models
    await prisma.ollamaConfig.update({
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
    console.error("Error refreshing Ollama models:", error);
    return NextResponse.json(
      { error: "Failed to refresh models" },
      { status: 500 }
    );
  }
}
