"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Clock, Layers, Star, TrendingUp, HeartHandshake, Trophy, Sparkles, Target, RefreshCw } from "lucide-react";
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
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<ModelStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
  const maxRuns = Math.max(...stats.map((s) => s.totalRuns), 1);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

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

        {/* Model Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Model Performance
            </CardTitle>
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
            ) : stats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No model usage data yet.</p>
                <p className="text-sm">Generate some content to see analytics.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {stats.map((stat) => {
                  const provider = AI_PROVIDERS[stat.provider as AIProvider];
                  return (
                    <div key={`${stat.provider}-${stat.modelId}`} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {provider?.name || stat.provider}
                          </Badge>
                          <span className="font-medium">{stat.modelId}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {stat.avgLatencyMs && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {(stat.avgLatencyMs / 1000).toFixed(1)}s
                            </span>
                          )}
                          {stat.avgRating && (
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              {stat.avgRating.toFixed(1)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Layers className="h-3 w-3" />
                            {stat.totalRuns} runs
                          </span>
                        </div>
                      </div>
                      <Progress
                        value={(stat.totalRuns / maxRuns) * 100}
                        className="h-2"
                      />
                      <div className="text-xs text-muted-foreground">
                        Last used: {formatDate(stat.lastUsed)}
                        {stat.avgTokens && ` • Avg tokens: ${Math.round(stat.avgTokens)}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quality Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Quality Metrics
            </CardTitle>
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
                <p>No quality data yet.</p>
                <p className="text-sm">Use multi-model synthesis to see which models produce the best content.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {stats
                  .filter(s => s.totalSynthesisParticipations > 0 || s.avgRating !== null)
                  .sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0))
                  .map((stat) => {
                    const provider = AI_PROVIDERS[stat.provider as AIProvider];
                    return (
                      <div key={`quality-${stat.provider}-${stat.modelId}`} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {provider?.name || stat.provider}
                            </Badge>
                            <span className="font-medium">{stat.modelId}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {stat.avgRating !== null && (
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3" />
                                {stat.avgRating.toFixed(1)}/10
                              </span>
                            )}
                            {stat.synthesisContributionRate !== null && stat.synthesisContributionRate > 0 && (
                              <span className="flex items-center gap-1">
                                <Sparkles className="h-3 w-3" />
                                {stat.synthesisContributionRate}% selected
                              </span>
                            )}
                            {stat.totalStarredSections > 0 && (
                              <span className="flex items-center gap-1">
                                <Target className="h-3 w-3" />
                                {stat.totalStarredSections} starred
                              </span>
                            )}
                          </div>
                        </div>
                        {stat.avgRating !== null && (
                          <div className="space-y-1">
                            <Progress
                              value={(stat.avgRating / 10) * 100}
                              className="h-2"
                            />
                            <div className="text-xs text-muted-foreground">
                              Peer-rated quality score from critique rounds
                              {stat.synthesisContributionRate !== null && (
                                <> • Content selected in {stat.totalAspectsSelected} synthesis decisions</>
                              )}
                              {stat.starredRate !== null && stat.starredRate > 0 && (
                                <> • {stat.starredRate}% sessions with user-starred content</>
                              )}
                            </div>
                          </div>
                        )}
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
