import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface VersionEntry {
  id: string;
  content: string;
  version: number;
  globalVersion: number;
  createdAt: Date;
  isCurrent: boolean;
  isRegeneration?: boolean;
  synthesisId?: string;
}

// Traverse up to find the root of the lineage
async function findLineageRoot(synthesisId: string): Promise<string> {
  let currentId = synthesisId;
  
  while (true) {
    const synthesis = await prisma.synthesizedContent.findUnique({
      where: { id: currentId },
      select: { parentSynthesisId: true },
    });
    
    if (!synthesis || !synthesis.parentSynthesisId) {
      return currentId;
    }
    currentId = synthesis.parentSynthesisId;
  }
}

// Collect all versions from a synthesis and its descendants
async function collectLineageVersions(rootId: string): Promise<VersionEntry[]> {
  const allVersions: VersionEntry[] = [];
  const queue = [rootId];
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    
    // Get the synthesis and its versions
    const synthesis = await prisma.synthesizedContent.findUnique({
      where: { id: currentId },
      include: {
        versions: { orderBy: { version: "asc" } },
        childSyntheses: { select: { id: true } },
      },
    });
    
    if (!synthesis) continue;
    
    // Add historical versions from this synthesis
    for (const v of synthesis.versions) {
      allVersions.push({
        id: v.id,
        content: v.content,
        version: v.version,
        globalVersion: synthesis.globalVersion + v.version - 1,
        createdAt: v.createdAt,
        isCurrent: false,
        isRegeneration: false,
        synthesisId: currentId,
      });
    }
    
    // Add current version of this synthesis
    allVersions.push({
      id: `current-${currentId}`,
      content: synthesis.content,
      version: synthesis.version,
      globalVersion: synthesis.globalVersion + synthesis.version - 1,
      createdAt: synthesis.updatedAt,
      isCurrent: true,
      isRegeneration: synthesis.parentSynthesisId !== null,
      synthesisId: currentId,
    });
    
    // Queue up child syntheses (from regenerations)
    for (const child of synthesis.childSyntheses) {
      queue.push(child.id);
    }
  }
  
  // Sort by globalVersion descending (newest first)
  return allVersions.sort((a, b) => b.globalVersion - a.globalVersion);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const synthesisId = searchParams.get("synthesisId");

  if (!synthesisId) {
    return NextResponse.json(
      { error: "synthesisId is required" },
      { status: 400 }
    );
  }

  try {
    // Find the root of the lineage chain
    const rootId = await findLineageRoot(synthesisId);
    
    // Collect all versions from the entire lineage
    const allVersions = await collectLineageVersions(rootId);
    
    // Mark the actual current version (from the requested synthesisId)
    const versionsWithCurrentMarked = allVersions.map((v) => ({
      ...v,
      isCurrent: v.synthesisId === synthesisId && v.isCurrent,
    }));

    return NextResponse.json({ versions: versionsWithCurrentMarked });
  } catch (error) {
    console.error("Failed to fetch versions:", error);
    return NextResponse.json(
      { error: "Failed to fetch versions" },
      { status: 500 }
    );
  }
}
