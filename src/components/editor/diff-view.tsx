"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GitCompare, ChevronLeft, ChevronRight, Clock, RefreshCw } from "lucide-react";

interface Version {
  id: string;
  content: string;
  version: number;
  globalVersion: number;
  createdAt: string;
  isCurrent: boolean;
  isRegeneration?: boolean;
  synthesisId?: string;
}

interface DiffViewProps {
  synthesisId: string;
  currentContent: string;
  embedded?: boolean;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const dp: number[][] = Array(oldLines.length + 1)
    .fill(null)
    .map(() => Array(newLines.length + 1).fill(0));

  for (let i = 1; i <= oldLines.length; i++) {
    for (let j = 1; j <= newLines.length; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find diff
  let i = oldLines.length;
  let j = newLines.length;
  const temp: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      temp.push({
        type: "unchanged",
        content: oldLines[i - 1],
        oldLineNumber: i,
        newLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      temp.push({
        type: "added",
        content: newLines[j - 1],
        newLineNumber: j,
      });
      j--;
    } else {
      temp.push({
        type: "removed",
        content: oldLines[i - 1],
        oldLineNumber: i,
      });
      i--;
    }
  }

  return temp.reverse();
}

export function DiffView({ synthesisId, currentContent, embedded = false }: DiffViewProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [showUnchanged, setShowUnchanged] = useState(true);

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const response = await fetch(
          `/api/synthesize/versions?synthesisId=${synthesisId}`
        );
        if (response.ok) {
          const data = await response.json();
          setVersions(data.versions);
          // Default to comparing with previous version if available
          if (data.versions.length > 1) {
            setSelectedVersion(data.versions[1].id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch versions:", error);
      } finally {
        setLoading(false);
      }
    };

    if (synthesisId) {
      fetchVersions();
    }
  }, [synthesisId]);

  const selectedVersionData = versions.find((v) => v.id === selectedVersion);

  const diff = useMemo(() => {
    if (!selectedVersionData) return [];
    return computeDiff(selectedVersionData.content, currentContent);
  }, [selectedVersionData, currentContent]);

  const stats = useMemo(() => {
    const added = diff.filter((d) => d.type === "added").length;
    const removed = diff.filter((d) => d.type === "removed").length;
    return { added, removed };
  }, [diff]);

  const displayDiff = showUnchanged
    ? diff
    : diff.filter((d) => d.type !== "unchanged");

  if (loading) {
    if (embedded) {
      return (
        <div>
          <Skeleton className="h-5 w-32 mb-4" />
          <Skeleton className="h-40 w-full" />
        </div>
      );
    }
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (versions.length <= 1) {
    const emptyMessage = (
      <p className="text-sm text-muted-foreground">
        No previous versions available. Versions are created when you
        iterate on the content.
      </p>
    );

    if (embedded) {
      return (
        <div>
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
            <GitCompare className="h-4 w-4" />
            Version History
          </h3>
          {emptyMessage}
        </div>
      );
    }

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <GitCompare className="h-4 w-4" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }

  const diffContent = (
    <div className="space-y-4">
      {/* Version Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Compare with:</span>
        <Select value={selectedVersion || ""} onValueChange={setSelectedVersion}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select version" />
          </SelectTrigger>
          <SelectContent>
            {versions
              .filter((v) => !v.isCurrent)
              .map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  <div className="flex items-center gap-2">
                    {v.isRegeneration ? (
                      <RefreshCw className="h-3 w-3 text-blue-500" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    <span>
                      v{v.globalVersion}
                      {v.isRegeneration && (
                        <span className="text-blue-500 ml-1">(regenerated)</span>
                      )}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowUnchanged(!showUnchanged)}
        >
          {showUnchanged ? "Hide unchanged" : "Show all"}
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-2">
        <Badge variant="secondary" className="bg-green-100 text-green-800">
          +{stats.added} added
        </Badge>
        <Badge variant="secondary" className="bg-red-100 text-red-800">
          -{stats.removed} removed
        </Badge>
      </div>

      {/* Diff View */}
      {selectedVersionData && (
        <ScrollArea className={embedded ? "h-[300px] rounded-md border" : "h-64 rounded-md border"}>
          <div className="p-4 font-mono text-sm">
            {displayDiff.map((line, index) => (
              <div
                key={index}
                className={`py-0.5 px-2 -mx-2 ${
                  line.type === "added"
                    ? "bg-green-50 text-green-800"
                    : line.type === "removed"
                    ? "bg-red-50 text-red-800"
                    : ""
                }`}
              >
                <span className="inline-block w-6 text-muted-foreground text-right mr-3">
                  {line.type === "added"
                    ? "+"
                    : line.type === "removed"
                    ? "-"
                    : ""}
                </span>
                {line.content || " "}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <GitCompare className="h-4 w-4" />
          Version History
        </h3>
        {diffContent}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <GitCompare className="h-4 w-4" />
          Version History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {diffContent}
      </CardContent>
    </Card>
  );
}
