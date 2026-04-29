"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ApiStatus {
  validKeyCount: number;
  hasLiteLLM: boolean;
  totalProviders: number;
}

/**
 * Displays API key configuration status in the header
 * Shows number of configured providers or warning if none
 */
export function ApiKeyStatus() {
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
    
    // Refetch when window regains focus (user may have added keys)
    const handleFocus = () => fetchStatus();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/keys/status");
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch API key status:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Checking...</span>
      </div>
    );
  }

  if (!status) return null;

  const hasProviders = status.totalProviders > 0;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant={hasProviders ? "ghost" : "destructive"}
            size="sm"
            className={hasProviders ? "h-auto py-1.5 px-3" : "h-auto py-1.5 px-3"}
          >
            <Link href="/dashboard/settings" className="flex items-center gap-2">
              {hasProviders ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">
                    {status.totalProviders} {status.totalProviders === 1 ? "provider" : "providers"}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Setup Required</span>
                </>
              )}
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs bg-popover border-border">
          {hasProviders ? (
            <div className="space-y-1.5">
              <p className="font-semibold text-foreground">API Keys Configured</p>
              <p className="text-sm text-foreground/70">
                {status.validKeyCount > 0 && `${status.validKeyCount} API key${status.validKeyCount !== 1 ? "s" : ""}`}
                {status.validKeyCount > 0 && status.hasLiteLLM && " · "}
                {status.hasLiteLLM && "LiteLLM proxy"}
              </p>
              <p className="text-sm text-foreground/70">Click to manage in Settings</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="font-semibold text-foreground">No API Keys</p>
              <p className="text-sm text-foreground/70">
                Add API keys or configure LiteLLM to use PostMaster
              </p>
              <p className="text-sm text-foreground/70">Click to open Settings</p>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
