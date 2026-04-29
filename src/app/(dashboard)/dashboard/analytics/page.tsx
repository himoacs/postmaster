"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { HeartHandshake, Trophy, Sparkles, Target, RefreshCw } from "lucide-react";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { AIProvider } from "@/types";
import { Button } from "@/components/ui/button";

interface ModelStats {
  provider: string;
  modelId: string;
  totalRuns: number;
  avgLatencyMs: number | null;
  avgTokens: number | null;
  avgRating: number | null;
  lastUsed: string | null;
  // Quality metrics
  synthesisContributionRate: number | null;
  totalSynthesisParticipations: number;
  totalAspectsSelected: number;
  starredRate: number | null;
  totalStarredSections: number;
  // Detailed rating metrics
  ratingDistribution: {
    min: number;
    max: number;
    median: number;
    stdDev: number;
    count: number;
  } | null;
  ratingHistogram: Record<number, number> | null;
  critiqueCount: number;
  qualityPercentile: number | null;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<ModelStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Helper functions for formatting
  const formatTokens = (tokens: number | null): string => {
    if (!tokens) return "—";
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
  };

  const formatSpeed = (ms: number | null): string => {
    if (!ms) return "—";
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const fetchAnalytics = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const response = await fetch("/api/analytics/models");
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    
    // Refetch when page becomes visible (e.g., switching tabs or navigating back)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchAnalytics(true);
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [fetchAnalytics]);

  const totalRuns = stats.reduce((sum, s) => sum + s.totalRuns, 0);

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4 flex-shrink-0">
        <div>
          <h1 className="font-serif text-xl font-medium">Model Analytics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Track model performance across your generations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
            className="text-muted-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <a href="https://paypal.me/himoacs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
              <HeartHandshake className="h-4 w-4" />
              Donate
            </a>
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-6 max-w-6xl mx-auto w-full">
        {/* Overview Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Generations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRuns}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Models Used
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Response Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.length > 0
                  ? `${Math.round(
                      stats
                        .filter((s) => s.avgLatencyMs)
                        .reduce((sum, s) => sum + (s.avgLatencyMs || 0), 0) /
                        stats.filter((s) => s.avgLatencyMs).length /
                        1000
                    )}s`
                  : "—"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quality Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Performance metrics from multi-model synthesis and critique rounds.
            </p>
            
            {/* Metrics explanation */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 rounded-lg bg-muted/30 text-xs">
              <div>
                <div className="font-medium mb-1">Peer Rating</div>
                <div className="text-muted-foreground">Average quality score (0-10) from other AI models during critique rounds</div>
              </div>
              <div>
                <div className="font-medium mb-1">Selection Rate</div>
                <div className="text-muted-foreground">Percentage of times this model's content was chosen for the final output</div>
              </div>
              <div>
                <div className="font-medium mb-1">Avg Speed</div>
                <div className="text-muted-foreground">Average response time per generation request</div>
              </div>
              <div>
                <div className="font-medium mb-1">Tokens/Response</div>
                <div className="text-muted-foreground">Average tokens used per response (lower = more efficient)</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            ) : stats.filter(s => s.totalSynthesisParticipations > 0 || s.avgRating !== null).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No performance data yet.</p>
                <p className="text-sm">Use multi-model synthesis to see which models produce the best content.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats
                  .filter(s => s.totalSynthesisParticipations > 0 || s.avgRating !== null)
                  .sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0))
                  .map((stat, index) => {
                    const provider = AI_PROVIDERS[stat.provider as AIProvider];
                    
                    return (
                      <div 
                        key={`quality-${stat.provider}-${stat.modelId}`} 
                        className={`p-4 rounded-lg space-y-4 ${index % 2 === 0 ? 'bg-muted/30' : 'bg-background'}`}
                      >
                        {/* Model header */}
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {provider?.name || stat.provider}
                          </Badge>
                          <span className="font-medium">{stat.modelId}</span>
                        </div>

                        {/* Single-row compact metrics */}
                        <div className="flex items-start gap-20 px-3 py-2">
                            {/* Peer Rating */}
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">Peer Rating</div>
                              <div className="text-lg font-semibold">
                                {stat.avgRating !== null ? stat.avgRating.toFixed(1) : '—'}
                                <span className="text-xs font-normal text-muted-foreground">/10</span>
                              </div>
                              {stat.avgRating !== null && (
                                <Progress value={stat.avgRating * 10} className="h-2 w-24" />
                              )}
                            </div>

                            {/* Selected */}
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">Selection Rate</div>
                              <div className="text-lg font-semibold">
                                {stat.totalAspectsSelected > 0 ? `${stat.synthesisContributionRate}%` : '—'}
                              </div>
                              {stat.totalAspectsSelected > 0 && (
                                <Progress value={stat.synthesisContributionRate} className="h-2 w-24" />
                              )}
                            </div>

                            {/* Speed */}
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">Avg Speed</div>
                              <div className="text-lg font-semibold">
                                {stat.avgLatencyMs !== null ? formatSpeed(stat.avgLatencyMs) : '—'}
                              </div>
                            </div>

                            {/* Efficiency */}
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">Tokens/Response</div>
                              <div className="text-lg font-semibold">
                                {stat.avgTokens !== null ? formatTokens(stat.avgTokens) : '—'}
                              </div>
                            </div>

                            {/* Additional info */}
                            {stat.critiqueCount > 0 && (
                              <div className="ml-auto text-xs text-muted-foreground">
                                Based on {stat.critiqueCount} critique{stat.critiqueCount !== 1 ? 's' : ''} from {stat.totalRuns} generation{stat.totalRuns !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
