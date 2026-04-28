import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SubpageLink } from "@/lib/url-crawler";

// GET /api/knowledge - List all knowledge entries
// Optional query params: ?active=true to filter only active entries
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") === "true";

  try {
    const entries = await prisma.knowledgeEntry.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        source: true,
        mimeType: true,
        wordCount: true,
        isActive: true,
        subpageLinks: true,
        createdAt: true,
        updatedAt: true,
        // Only include content for active filter (used in generation)
        ...(activeOnly ? { content: true } : {}),
      },
    });

    // Transform entries to include subpageCount instead of full links array
    const transformedEntries = entries.map((entry) => ({
      ...entry,
      subpageCount: entry.subpageLinks 
        ? (entry.subpageLinks as unknown as SubpageLink[]).length 
        : 0,
      subpageLinks: undefined, // Don't send full array to client
    }));

    return NextResponse.json({ entries: transformedEntries });
  } catch (error) {
    console.error("Failed to fetch knowledge entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch knowledge entries" },
      { status: 500 }
    );
  }
}

// DELETE /api/knowledge?id=xxx - Delete a knowledge entry
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing entry ID" }, { status: 400 });
  }

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
