"use client";

import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Sparkles, Key, User, PenLine, ChevronRight, PlayCircle } from "lucide-react";
import Link from "next/link";
import { useProductTour } from "./product-tour";

interface WelcomeBannerProps {
  hasApiKeys: boolean;
  onDismiss?: () => void;
}

/**
 * Welcome banner for first-time users
 * Guides them through initial setup steps
 */
export function WelcomeBanner({ hasApiKeys, onDismiss }: WelcomeBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const { startTour } = useProductTour();

  // Check if user has dismissed the banner before
  useEffect(() => {
    const isDismissed = localStorage.getItem("welcome-banner-dismissed");
    if (isDismissed === "true") {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("welcome-banner-dismissed", "true");
    onDismiss?.();
  };

  // Don't show if user has API keys and banner was not manually shown
  if (hasApiKeys && dismissed) {
    return null;
  }

  // Don't show if dismissed
  if (dismissed) {
    return null;
  }

  return (
    <Alert className="border-amber-200/60 bg-amber-50/30">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
        </div>
        
        <div className="flex-1 space-y-3">
          <div>
            <AlertTitle className="text-lg font-semibold mb-1 text-foreground">
              Welcome to PostMaster! 🎉
            </AlertTitle>
            <AlertDescription className="text-base text-foreground/80">
              Generate, compare, and synthesize content using multiple AI models for the best results.
            </AlertDescription>
          </div>

          {!hasApiKeys ? (
            <div className="space-y-3">
              <div className="rounded-lg border bg-background/50 p-3">
                <p className="text-sm font-medium mb-2">Get started in 2 steps:</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="default" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">
                      1
                    </Badge>
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span>Add your API keys (required to use PostMaster)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">
                      2
                    </Badge>
                    <User className="h-4 w-4" />
                    <span>Set up your writing style (optional but recommended)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button asChild size="sm">
                  <Link href="/dashboard/settings">
                    <Key className="mr-2 h-4 w-4" />
                    Add API Keys
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/profile">
                    <User className="mr-2 h-4 w-4" />
                    Set Up Profile
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={startTour}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Take Tour
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                You're all set! Try generating your first piece of content to see how multiple AI models 
                can provide diverse perspectives.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Button asChild size="sm" variant="default">
                  <Link href="/dashboard">
                    <PenLine className="mr-2 h-4 w-4" />
                    Start Writing
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={startTour}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Take Tour
                </Button>
              </div>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0"
          onClick={handleDismiss}
          aria-label="Dismiss welcome banner"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
