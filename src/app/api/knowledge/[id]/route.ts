import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/knowledge/[id] - Get a single knowledge entry
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const entry = await prisma.knowledgeEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("Failed to fetch knowledge entry:", error);
    return NextResponse.json(
      { error: "Failed to fetch entry" },
      { status: 500 }
    );
  }
}

interface PatchRequest {
  title?: string;
  isActive?: boolean;
}

// PATCH /api/knowledge/[id] - Update a knowledge entry
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const body = (await request.json()) as PatchRequest;

    // Build update data
    const updateData: { title?: string; isActive?: boolean } = {};
    
    if (body.title !== undefined) {
      if (!body.title.trim()) {
        return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
      }
      updateData.title = body.title.trim();
    }
    
    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const entry = await prisma.knowledgeEntry.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        title: true,
        type: true,
        source: true,
        mimeType: true,
        wordCount: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("Failed to update knowledge entry:", error);
    return NextResponse.json(
      { error: "Failed to update entry" },
      { status: 500 }
    );
  }
}

// DELETE /api/knowledge/[id] - Delete a knowledge entry
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    await prisma.knowledgeEntry.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete knowledge entry:", error);
    return NextResponse.json(
      { error: "Failed to delete entry" },
      { status: 500 }
    );
  }
}
