"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Rocket,
  Info,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error"
  | "dev-mode"
  | "not-configured";

interface UpdateState {
  status: UpdateStatus;
  version?: string;
  releaseDate?: string;
  releaseNotes?: string;
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
  errorMessage?: string;
}

interface AppInfo {
  version: string;
  platform: string;
  arch: string;
  isPackaged: boolean;
}

export function UpdateSettings() {
  const [updateState, setUpdateState] = useState<UpdateState>({ status: "idle" });
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [isElectron, setIsElectron] = useState(false);

  // Check if we're in Electron
  useEffect(() => {
    const electronAvailable = typeof window !== "undefined" && !!window.electron?.isElectron;
    setIsElectron(electronAvailable);

    if (electronAvailable && window.electron) {
      const electron = window.electron;
      // Get app info
      electron.getAppInfo().then(setAppInfo).catch(console.error);

      // Subscribe to update status events
      const unsubscribe = electron.onUpdateStatus((event) => {
        setUpdateState((prev) => {
          const newState: UpdateState = { ...prev, status: event.status as UpdateStatus };
          
          if (event.version) newState.version = event.version;
          if (event.releaseDate) newState.releaseDate = event.releaseDate;
          if (event.percent !== undefined) newState.percent = event.percent;
          if (event.transferred !== undefined) newState.transferred = event.transferred;
          if (event.total !== undefined) newState.total = event.total;
          if (event.bytesPerSecond !== undefined) newState.bytesPerSecond = event.bytesPerSecond;
          if (event.message) newState.errorMessage = event.message;
          
          // Parse release notes
          if (event.releaseNotes) {
            if (typeof event.releaseNotes === "string") {
              newState.releaseNotes = event.releaseNotes;
            } else if (Array.isArray(event.releaseNotes)) {
              newState.releaseNotes = event.releaseNotes
                .map((n: unknown) => {
                  if (typeof n === 'object' && n !== null && 'body' in n) {
                    return (n as { body?: string }).body || "";
                  }
                  return "";
                })
                .join("\n");
            } else if (typeof event.releaseNotes === "object" && event.releaseNotes !== null) {
              const notes = event.releaseNotes as { body?: string };
              newState.releaseNotes = notes.body || "";
            }
          }

          return newState;
        });

        // Show toast notifications for important events
        if (event.status === "available") {
          toast.info(`Update available: v${event.version}`, {
            description: "Click Download to get the latest version.",
            duration: 10000,
          });
        } else if (event.status === "downloaded") {
          toast.success("Update downloaded!", {
            description: "Restart the app to install the update.",
            duration: 10000,
          });
        } else if (event.status === "error") {
          toast.error("Update failed", {
            description: event.message || "An error occurred while checking for updates.",
          });
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    if (!isElectron || !window.electron) return;
    
    setUpdateState({ status: "checking" });
    try {
      const result = await window.electron.checkForUpdates();
      if (result.status === "dev-mode") {
        setUpdateState({ status: "dev-mode", errorMessage: result.message });
        toast.info("Update check skipped in development mode");
      } else if (result.status === "not-configured") {
        setUpdateState({ status: "not-configured", errorMessage: result.message });
        toast.info("Auto-updates not configured");
      } else if (result.status === "error") {
        setUpdateState({ status: "error", errorMessage: result.message });
      }
      // Other statuses will be handled by the event listener
    } catch (error) {
      setUpdateState({ status: "error", errorMessage: "Failed to check for updates" });
    }
  }, [isElectron]);

  const handleDownloadUpdate = useCallback(async () => {
    if (!isElectron || !window.electron) return;
    
    try {
      await window.electron.downloadUpdate();
      // Progress will be handled by the event listener
    } catch (error) {
      toast.error("Failed to start download");
    }
  }, [isElectron]);

  const handleInstallUpdate = useCallback(async () => {
    if (!isElectron || !window.electron) return;
    const electron = window.electron;
    
    toast.info("Installing update...", {
      description: "The app will restart automatically.",
    });
    
    // Small delay to show the toast
    setTimeout(() => {
      electron.installUpdate();
    }, 500);
  }, [isElectron]);

  const handleOpenReleases = useCallback(() => {
    const url = "https://github.com/himoacs/postmaster/releases";
    if (isElectron && window.electron) {
      window.electron.openExternal(url);
    } else {
      window.open(url, "_blank");
    }
  }, [isElectron]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  // Don't render anything in web mode
  if (!isElectron) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              App Updates
            </CardTitle>
            <CardDescription>
              Check for new versions and keep PostMaster up to date
            </CardDescription>
          </div>
          {appInfo && (
            <Badge variant="secondary" className="font-mono">
              v{appInfo.version}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Display */}
        <div className="rounded-lg border bg-muted/30 p-4">
          {updateState.status === "idle" && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Info className="h-5 w-5" />
              <span>Click the button below to check for updates.</span>
            </div>
          )}

          {updateState.status === "checking" && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Checking for updates...</span>
            </div>
          )}

          {updateState.status === "not-available" && (
            <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span>You&apos;re running the latest version!</span>
            </div>
          )}

          {updateState.status === "available" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-primary">
                <Download className="h-5 w-5" />
                <span>
                  New version available: <strong>v{updateState.version}</strong>
                </span>
              </div>
              {updateState.releaseNotes && (
                <div 
                  className="text-sm text-muted-foreground line-clamp-3"
                  dangerouslySetInnerHTML={{ __html: updateState.releaseNotes }}
                />
              )}
            </div>
          )}

          {updateState.status === "downloading" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Downloading update...
                </span>
                <span className="text-sm font-mono">
                  {updateState.percent?.toFixed(1)}%
                </span>
              </div>
              <Progress value={updateState.percent} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {updateState.transferred && updateState.total
                    ? `${formatBytes(updateState.transferred)} / ${formatBytes(updateState.total)}`
                    : "Calculating..."}
                </span>
                <span>
                  {updateState.bytesPerSecond
                    ? formatSpeed(updateState.bytesPerSecond)
                    : ""}
                </span>
              </div>
            </div>
          )}

          {updateState.status === "downloaded" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span>
                  Update v{updateState.version} is ready to install!
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Restart the app to complete the installation.
              </p>
            </div>
          )}

          {updateState.status === "error" && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
                <span>Update check failed</span>
              </div>
              {updateState.errorMessage && (
                <p className="text-sm text-muted-foreground">
                  {updateState.errorMessage}
                </p>
              )}
            </div>
          )}

          {updateState.status === "dev-mode" && (
            <div className="flex items-center gap-3 text-yellow-600 dark:text-yellow-400">
              <Info className="h-5 w-5" />
              <span>Auto-updates are disabled in development mode.</span>
            </div>
          )}

          {updateState.status === "not-configured" && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-yellow-600 dark:text-yellow-400">
                <Info className="h-5 w-5" />
                <span>Auto-updates not configured</span>
              </div>
              <p className="text-sm text-muted-foreground">
                No release repository has been set up. Updates must be downloaded manually.
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {updateState.status === "checking" && (
            <Button disabled variant="outline" size="sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </Button>
          )}
          
          {(updateState.status === "idle" ||
            updateState.status === "not-available" ||
            updateState.status === "error" ||
            updateState.status === "dev-mode" ||
            updateState.status === "not-configured") && (
            <Button
              onClick={handleCheckForUpdates}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Check for Updates
            </Button>
          )}

          {updateState.status === "available" && (
            <Button onClick={handleDownloadUpdate} size="sm">
              <Download className="mr-2 h-4 w-4" />
              Download Update
            </Button>
          )}

          {updateState.status === "downloaded" && (
            <Button onClick={handleInstallUpdate} size="sm">
              <Rocket className="mr-2 h-4 w-4" />
              Restart &amp; Install
            </Button>
          )}

          <Button
            onClick={handleOpenReleases}
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            View Releases
          </Button>
        </div>

        {/* Platform Info */}
        {appInfo && (
          <div className="flex gap-2 pt-2">
            <Badge variant="outline" className="text-xs font-normal">
              {appInfo.platform === "darwin"
                ? "macOS"
                : appInfo.platform === "win32"
                ? "Windows"
                : "Linux"}
            </Badge>
            <Badge variant="outline" className="text-xs font-normal">
              {appInfo.arch}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
