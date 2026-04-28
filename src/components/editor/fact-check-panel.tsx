"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  XCircle,
  ChevronDown,
  Loader2,
  Search,
  Database,
} from "lucide-react";
import { toast } from "sonner";

interface Claim {
  id: string;
  text: string;
  type: string;
  verifiability: string;
}

interface ClaimResult {
  claim: Claim;
  confidence: "verified" | "likely" | "uncertain" | "conflicting" | "unverifiable";
  kbSources: { title: string; excerpt: string }[];
  reasoning: string;
}

interface FactCheckPanelProps {
  content: string;
}

const confidenceConfig = {
  verified: {
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-200 dark:border-green-800",
    label: "Verified",
  },
  likely: {
    icon: CheckCircle2,
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
    label: "Likely True",
  },
  uncertain: {
    icon: HelpCircle,
    color: "text-yellow-600",
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    border: "border-yellow-200 dark:border-yellow-800",
    label: "Uncertain",
  },
  conflicting: {
    icon: AlertTriangle,
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    label: "Conflicting",
  },
  unverifiable: {
    icon: XCircle,
    color: "text-gray-500",
    bg: "bg-gray-50 dark:bg-gray-900/30",
    border: "border-gray-200 dark:border-gray-700",
    label: "Unverifiable",
  },
};

export function FactCheckPanel({ content }: FactCheckPanelProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ClaimResult[] | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    verified: number;
    uncertain: number;
    unverifiable: number;
  } | null>(null);
  const [expandedClaims, setExpandedClaims] = useState<Set<string>>(new Set());

  const runFactCheck = async () => {
    setLoading(true);
    setResults(null);
    setSummary(null);
    
    try {
      const response = await fetch("/api/factcheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fact check failed");
      }

      const data = await response.json();
      setResults(data.claims);
      setSummary(data.summary);
      
      if (data.claims.length === 0) {
        toast.info("No factual claims found in the content");
      } else {
        toast.success(`Found ${data.claims.length} claims to verify`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check facts");
    } finally {
      setLoading(false);
    }
  };

  const toggleClaim = (id: string) => {
    const newExpanded = new Set(expandedClaims);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedClaims(newExpanded);
  };

  return (
    <div className="h-full flex flex-col p-4">
      <div className="pb-3 flex-shrink-0">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Search className="h-4 w-4" />
          Fact Check
        </h3>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {!results ? (
          <div className="text-center py-8 flex-1 flex flex-col items-center justify-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">Verify Content Claims</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-[250px]">
              Extract factual claims and verify them against your knowledge base
            </p>
            <Button onClick={runFactCheck} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Check Facts
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4 flex-shrink-0">
              <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <div className="text-lg font-bold text-green-600">{summary?.verified || 0}</div>
                <div className="text-xs text-muted-foreground">Verified</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
                <div className="text-lg font-bold text-yellow-600">{summary?.uncertain || 0}</div>
                <div className="text-xs text-muted-foreground">Uncertain</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700">
                <div className="text-lg font-bold text-gray-500">{summary?.unverifiable || 0}</div>
                <div className="text-xs text-muted-foreground">Unverifiable</div>
              </div>
            </div>

            {/* Claims List */}
            {results.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <p>No factual claims found in the content.</p>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="space-y-2 pr-2">
                  {results.map((result) => {
                    const config = confidenceConfig[result.confidence];
                    const Icon = config.icon;
                    const isExpanded = expandedClaims.has(result.claim.id);

                    return (
                      <Collapsible
                        key={result.claim.id}
                        open={isExpanded}
                        onOpenChange={() => toggleClaim(result.claim.id)}
                      >
                        <CollapsibleTrigger asChild>
                          <button
                            className={`w-full p-3 rounded-lg text-left transition-colors border ${config.bg} ${config.border} hover:opacity-90`}
                          >
                            <div className="flex items-start gap-2">
                              <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm line-clamp-2">&quot;{result.claim.text}&quot;</p>
                                <div className="flex gap-2 mt-1.5 flex-wrap">
                                  <Badge variant="outline" className="text-xs">
                                    {result.claim.type}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {config.label}
                                  </Badge>
                                </div>
                              </div>
                              <ChevronDown
                                className={`h-4 w-4 flex-shrink-0 transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </div>
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 px-3 pb-3">
                            <div className="text-sm text-muted-foreground border-l-2 border-muted pl-3 space-y-2">
                              <p>{result.reasoning}</p>
                              {result.kbSources.length > 0 && (
                                <div className="mt-2">
                                  <div className="flex items-center gap-1 text-xs font-medium mb-1">
                                    <Database className="h-3 w-3" />
                                    Knowledge Base Sources:
                                  </div>
                                  {result.kbSources.map((source, i) => (
                                    <div
                                      key={i}
                                      className="mt-1 text-xs bg-muted p-2 rounded"
                                    >
                                      <strong>{source.title}:</strong>{" "}
                                      {source.excerpt.slice(0, 150)}
                                      {source.excerpt.length > 150 && "..."}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            {/* Re-check button */}
            <div className="pt-3 flex-shrink-0 border-t mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={runFactCheck}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Re-checking...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Re-check Facts
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
