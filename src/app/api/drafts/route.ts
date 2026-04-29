import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/drafts
 * Auto-save current editor state
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      contentType,
      lengthPref,
      contentMode,
      existingContent,
      selectedModels,
      yoloMode,
      references,
      selectedKnowledge,
      enableCitations,
      synthesisStrategy,
    } = body;

    // Validation
    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Delete old drafts (keep only one active draft for single-user mode)
    await prisma.draft.deleteMany({});

    // Create new draft
    const draft = await prisma.draft.create({
      data: {
        prompt,
        contentType: contentType || "BLOG_POST",
        lengthPref,
        contentMode: contentMode || "new",
        existingContent,
        selectedModels: JSON.stringify(selectedModels || []),
        yoloMode: yoloMode || false,
        references: JSON.stringify(references || []),
        selectedKnowledge: JSON.stringify(selectedKnowledge || []),
        enableCitations: enableCitations || false,
        synthesisStrategy: synthesisStrategy || "basic",
      },
    });

    return NextResponse.json({ id: draft.id, success: true });
  } catch (error) {
    console.error("Error saving draft:", error);
    return NextResponse.json(
      { error: "Failed to save draft" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/drafts
 * Get the most recent draft
 */
export async function GET() {
  try {
    const draft = await prisma.draft.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    if (!draft) {
      return NextResponse.json({ draft: null });
    }

    // Parse JSON fields
    const parsedDraft = {
      id: draft.id,
      prompt: draft.prompt,
      contentType: draft.contentType,
      lengthPref: draft.lengthPref,
      contentMode: draft.contentMode,
      existingContent: draft.existingContent,
      selectedModels: JSON.parse(draft.selectedModels),
      yoloMode: draft.yoloMode,
      references: JSON.parse(draft.references),
      selectedKnowledge: JSON.parse(draft.selectedKnowledge),
      enableCitations: draft.enableCitations,
      synthesisStrategy: draft.synthesisStrategy,
      updatedAt: draft.updatedAt,
    };

    return NextResponse.json({ draft: parsedDraft });
  } catch (error) {
    console.error("Error loading draft:", error);
    return NextResponse.json(
      { error: "Failed to load draft" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/drafts
 * Clear saved draft (when user completes or abandons work)
 */
export async function DELETE() {
  try {
    await prisma.draft.deleteMany({});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting draft:", error);
    return NextResponse.json(
      { error: "Failed to delete draft" },
      { status: 500 }
    );
  }
}
