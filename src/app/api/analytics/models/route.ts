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
  // Quality metrics
  synthesisContributionRate: number | null; // % of synthesis decisions where model was selected
  totalSynthesisParticipations: number;     // Number of synthesis events this model participated in
  totalAspectsSelected: number;              // Total aspects where this model was chosen
  starredRate: number | null;               // % of participations with starred content
  totalStarredSections: number;             // Total starred sections from this model
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
            // Handle both new format (targetModel.provider) and legacy format (provider)
            const provider = draft.targetModel?.provider || draft.provider || "unknown";
            const model = draft.targetModel?.modelId || draft.model || "unknown";
            const key = `${provider}:${model}`;
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

    // Get synthesis contribution data for quality metrics
    // Wrapped in try-catch since table may not exist in older databases
    let contributions: { provider: string; model: string; aspectCount: number; totalAspects: number; starredCount: number }[] = [];
    try {
      contributions = await prisma.synthesisContribution.findMany({
        select: {
          provider: true,
          model: true,
          aspectCount: true,
          totalAspects: true,
          starredCount: true,
        },
      });
    } catch {
      // Table may not exist yet - continue with empty contributions
      console.log("SynthesisContribution table not available yet");
    }

    // Aggregate contribution data by model
    const contributionStats: Record<string, {
      participations: number;
      totalAspectsSelected: number;
      totalAspectsPossible: number;
      totalStarred: number;
      participationsWithStars: number;
    }> = {};

    for (const contrib of contributions) {
      const key = `${contrib.provider}:${contrib.model}`;
      if (!contributionStats[key]) {
        contributionStats[key] = {
          participations: 0,
          totalAspectsSelected: 0,
          totalAspectsPossible: 0,
          totalStarred: 0,
          participationsWithStars: 0,
        };
      }
      contributionStats[key].participations++;
      contributionStats[key].totalAspectsSelected += contrib.aspectCount;
      contributionStats[key].totalAspectsPossible += contrib.totalAspects;
      contributionStats[key].totalStarred += contrib.starredCount;
      if (contrib.starredCount > 0) {
        contributionStats[key].participationsWithStars++;
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

      const contribData = contributionStats[key];
      const synthesisContributionRate = contribData && contribData.totalAspectsPossible > 0
        ? Math.round((contribData.totalAspectsSelected / contribData.totalAspectsPossible) * 100)
        : null;
      const starredRate = contribData && contribData.participations > 0
        ? Math.round((contribData.participationsWithStars / contribData.participations) * 100)
        : null;

      return {
        provider: row.provider,
        modelId: row.model,
        totalRuns: row._count.id,
        avgLatencyMs: row._avg.latencyMs ? Math.round(row._avg.latencyMs) : null,
        avgTokens: row._avg.tokensUsed ? Math.round(row._avg.tokensUsed) : null,
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        lastUsed: lastUsedMap[key]?.toISOString() || null,
        // Quality metrics
        synthesisContributionRate,
        totalSynthesisParticipations: contribData?.participations || 0,
        totalAspectsSelected: contribData?.totalAspectsSelected || 0,
        starredRate,
        totalStarredSections: contribData?.totalStarred || 0,
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
