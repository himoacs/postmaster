import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface ModelStats {
  provider: string;
  modelId: string;
  totalRuns: number;
  avgLatencyMs: number | null;
  avgTokens: number | null;
  avgRating: number | null;
  lastUsed: string | null;
}

// GET /api/analytics/models - Get model performance analytics
export async function GET() {
  try {
    // Get aggregated stats from GenerationOutput
    const outputStats = await prisma.generationOutput.groupBy({
      by: ["provider", "model"],
      _count: { id: true },
      _avg: { latencyMs: true, tokensUsed: true },
    });

    // Get rating data from GenerationCritique (if available)
    const critiques = await prisma.generationCritique.findMany({
      select: { critiques: true },
    });

    // Parse critique ratings by model
    const modelRatings: Record<string, number[]> = {};
    for (const critique of critiques) {
      try {
        const data = JSON.parse(critique.critiques);
        if (data.targetDrafts) {
          for (const draft of data.targetDrafts) {
            const key = `${draft.provider || "unknown"}:${draft.model || "unknown"}`;
            if (!modelRatings[key]) modelRatings[key] = [];
            if (draft.rating) modelRatings[key].push(draft.rating);
          }
        }
      } catch {
        // Skip invalid JSON
      }
    }

    // Get last used dates
    const lastUsed = await prisma.generationOutput.groupBy({
      by: ["provider", "model"],
      _max: { createdAt: true },
    });

    const lastUsedMap: Record<string, Date> = {};
    for (const row of lastUsed) {
      if (row._max.createdAt) {
        lastUsedMap[`${row.provider}:${row.model}`] = row._max.createdAt;
      }
    }

    // Combine into final stats
    const stats: ModelStats[] = outputStats.map((row) => {
      const key = `${row.provider}:${row.model}`;
      const ratings = modelRatings[key] || [];
      const avgRating =
        ratings.length > 0
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : null;

      return {
        provider: row.provider,
        modelId: row.model,
        totalRuns: row._count.id,
        avgLatencyMs: row._avg.latencyMs ? Math.round(row._avg.latencyMs) : null,
        avgTokens: row._avg.tokensUsed ? Math.round(row._avg.tokensUsed) : null,
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        lastUsed: lastUsedMap[key]?.toISOString() || null,
      };
    });

    // Sort by total runs descending
    stats.sort((a, b) => b.totalRuns - a.totalRuns);

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Failed to get analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
