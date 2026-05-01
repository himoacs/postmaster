/**
 * LiteLLM Configuration API
 * 
 * GET    /api/litellm - Get current LiteLLM configuration
 * POST   /api/litellm - Save/update LiteLLM configuration
 * DELETE /api/litellm - Remove LiteLLM configuration
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import { validateLiteLLMConfig, fetchLiteLLMModels } from "@/lib/ai/litellm";
import { LiteLLMModel } from "@/types";

// GET - Return current LiteLLM configuration
export async function GET() {
  try {
    const config = await prisma.liteLLMConfig.findFirst();
    
    if (!config) {
      return NextResponse.json({ configured: false });
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
      id: config.id,
      endpoint: config.endpoint,
      hasKey: !!config.encryptedKey,
      isEnabled: config.isEnabled,
      isValid: config.isValid,
      modelCount: models.length,
      models,
      enabledModels,
      lastValidated: config.lastValidated?.toISOString(),
    });
  } catch (error) {
    console.error("Error fetching LiteLLM config:", error);
    return NextResponse.json(
      { error: "Failed to fetch configuration" },
      { status: 500 }
    );
  }
}

// POST - Save/update LiteLLM configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, apiKey, isEnabled = true, validateOnly = false } = body;
    
    if (!endpoint) {
      return NextResponse.json(
        { error: "Endpoint URL is required" },
        { status: 400 }
      );
    }
    
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
    const validation = await validateLiteLLMConfig(endpoint, apiKey);
    
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
    const existing = await prisma.liteLLMConfig.findFirst();
    
    let config;
    if (existing) {
      config = await prisma.liteLLMConfig.update({
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
      config = await prisma.liteLLMConfig.create({
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
    console.error("Error saving LiteLLM config:", error);
    return NextResponse.json(
      { error: "Failed to save configuration" },
      { status: 500 }
    );
  }
}

// PATCH - Update enabled models selection
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { enabledModels } = body;
    
    if (!Array.isArray(enabledModels)) {
      return NextResponse.json(
        { error: "enabledModels must be an array of model IDs" },
        { status: 400 }
      );
    }
    
    const config = await prisma.liteLLMConfig.findFirst();
    
    if (!config) {
      return NextResponse.json(
        { error: "LiteLLM not configured" },
        { status: 404 }
      );
    }
    
    const updated = await prisma.liteLLMConfig.update({
      where: { id: config.id },
      data: {
        enabledModels: JSON.stringify(enabledModels),
      },
    });
    
    return NextResponse.json({
      success: true,
      enabledModels,
      enabledCount: enabledModels.length,
    });
  } catch (error) {
    console.error("Error updating LiteLLM enabled models:", error);
    return NextResponse.json(
      { error: "Failed to update enabled models" },
      { status: 500 }
    );
  }
}

// DELETE - Remove LiteLLM configuration
export async function DELETE() {
  try {
    const existing = await prisma.liteLLMConfig.findFirst();
    
    if (existing) {
      await prisma.liteLLMConfig.delete({
        where: { id: existing.id },
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting LiteLLM config:", error);
    return NextResponse.json(
      { error: "Failed to delete configuration" },
      { status: 500 }
    );
  }
}
