/**
 * Ollama Configuration API
 * 
 * GET    /api/ollama - Get current Ollama configuration
 * POST   /api/ollama - Save/update Ollama configuration
 * DELETE /api/ollama - Remove Ollama configuration
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import { validateOllamaConfig, fetchOllamaModels } from "@/lib/ai/ollama";
import { OllamaModel } from "@/types";

// GET - Return current Ollama configuration
export async function GET() {
  try {
    const config = await prisma.ollamaConfig.findFirst();
    
    if (!config) {
      return NextResponse.json({ configured: false });
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
      id: config.id,
      endpoint: config.endpoint,
      hasKey: !!config.encryptedKey,
      isEnabled: config.isEnabled,
      isValid: config.isValid,
      modelCount: models.length,
      models,
      lastValidated: config.lastValidated?.toISOString(),
    });
  } catch (error) {
    console.error("Error fetching Ollama config:", error);
    return NextResponse.json(
      { error: "Failed to fetch configuration" },
      { status: 500 }
    );
  }
}

// POST - Save/update Ollama configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint = "http://localhost:11434", apiKey, isEnabled = true, validateOnly = false } = body;
    
    // Validate the endpoint URL format
    try {
      new URL(endpoint);
    } catch {
      return NextResponse.json(
        { error: "Invalid endpoint URL" },
        { status: 400 }
      );
    }
    
    // Test connection and fetch models
    const validation = await validateOllamaConfig(endpoint, apiKey);
    
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: validation.error || "Connection failed",
          valid: false,
        },
        { status: 400 }
      );
    }
    
    // If only validating, return without saving
    if (validateOnly) {
      return NextResponse.json({
        valid: true,
        modelCount: validation.models?.length || 0,
        models: validation.models,
      });
    }
    
    // Encrypt API key if provided
    const encryptedKey = apiKey ? encrypt(apiKey) : null;
    
    // Serialize models for storage
    const cachedModels = JSON.stringify(validation.models || []);
    
    // Upsert configuration (only one config allowed)
    const existing = await prisma.ollamaConfig.findFirst();
    
    let config;
    if (existing) {
      config = await prisma.ollamaConfig.update({
        where: { id: existing.id },
        data: {
          endpoint,
          encryptedKey,
          isEnabled,
          isValid: true,
          cachedModels,
          lastValidated: new Date(),
        },
      });
    } else {
      config = await prisma.ollamaConfig.create({
        data: {
          endpoint,
          encryptedKey,
          isEnabled,
          isValid: true,
          cachedModels,
          lastValidated: new Date(),
        },
      });
    }
    
    return NextResponse.json({
      success: true,
      id: config.id,
      endpoint: config.endpoint,
      isEnabled: config.isEnabled,
      isValid: config.isValid,
      modelCount: validation.models?.length || 0,
      models: validation.models,
    });
  } catch (error) {
    console.error("Error saving Ollama config:", error);
    return NextResponse.json(
      { error: "Failed to save configuration" },
      { status: 500 }
    );
  }
}

// DELETE - Remove Ollama configuration
export async function DELETE() {
  try {
    const config = await prisma.ollamaConfig.findFirst();
    
    if (!config) {
      return NextResponse.json(
        { error: "Ollama not configured" },
        { status: 404 }
      );
    }
    
    await prisma.ollamaConfig.delete({
      where: { id: config.id },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting Ollama config:", error);
    return NextResponse.json(
      { error: "Failed to delete configuration" },
      { status: 500 }
    );
  }
}
