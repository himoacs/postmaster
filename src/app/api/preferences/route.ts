import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SynthesisStrategy, UserPreferences } from "@/types";

// GET /api/preferences - Get user preferences
export async function GET() {
  // Single-user mode: get or create the single preferences record
  let preferences = await prisma.userPreferences.findFirst();

  if (!preferences) {
    // Create default preferences
    preferences = await prisma.userPreferences.create({
      data: {
        synthesisStrategy: "basic",
        debateMaxRounds: 3,
        showCritiqueDetails: true,
      },
    });
  }

  const response: UserPreferences = {
    synthesisStrategy: preferences.synthesisStrategy as SynthesisStrategy,
    debateMaxRounds: preferences.debateMaxRounds,
    showCritiqueDetails: preferences.showCritiqueDetails,
    primaryModelProvider: preferences.primaryModelProvider || undefined,
    primaryModelId: preferences.primaryModelId || undefined,
  };

  return NextResponse.json(response);
}

// PUT /api/preferences - Update user preferences
export async function PUT(request: NextRequest) {
  const updates = (await request.json()) as Partial<UserPreferences>;

  // Validate synthesis strategy
  if (updates.synthesisStrategy && !["basic", "sequential", "debate"].includes(updates.synthesisStrategy)) {
    return NextResponse.json({ error: "Invalid synthesis strategy" }, { status: 400 });
  }

  // Validate debate max rounds
  if (updates.debateMaxRounds !== undefined && (updates.debateMaxRounds < 1 || updates.debateMaxRounds > 5)) {
    return NextResponse.json({ error: "debateMaxRounds must be between 1 and 5" }, { status: 400 });
  }

  // Get existing preferences or create new
  let preferences = await prisma.userPreferences.findFirst();

  if (!preferences) {
    preferences = await prisma.userPreferences.create({
      data: {
        synthesisStrategy: updates.synthesisStrategy || "basic",
        debateMaxRounds: updates.debateMaxRounds || 3,
        showCritiqueDetails: updates.showCritiqueDetails ?? true,
      },
    });
  } else {
    preferences = await prisma.userPreferences.update({
      where: { id: preferences.id },
      data: {
        ...(updates.synthesisStrategy && { synthesisStrategy: updates.synthesisStrategy }),
        ...(updates.debateMaxRounds !== undefined && { debateMaxRounds: updates.debateMaxRounds }),
        ...(updates.showCritiqueDetails !== undefined && { showCritiqueDetails: updates.showCritiqueDetails }),
        ...(updates.primaryModelProvider !== undefined && { primaryModelProvider: updates.primaryModelProvider || null }),
        ...(updates.primaryModelId !== undefined && { primaryModelId: updates.primaryModelId || null }),
      },
    });
  }

  const response: UserPreferences = {
    synthesisStrategy: preferences.synthesisStrategy as SynthesisStrategy,
    debateMaxRounds: preferences.debateMaxRounds,
    showCritiqueDetails: preferences.showCritiqueDetails,
    primaryModelProvider: preferences.primaryModelProvider || undefined,
    primaryModelId: preferences.primaryModelId || undefined,
  };

  return NextResponse.json(response);
}
