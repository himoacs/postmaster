/**
 * Database Error Dialog
 * 
 * Displays when database validation fails and offers recovery options.
 * Allows users to retry, restore from backup, or reset to fresh state.
 */

"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  HealthCheckResult,
  HealthCheckStatus,
  IssueType,
} from "@/lib/db-health-check";

interface DatabaseErrorDialogProps {
  open: boolean;
  healthCheck: HealthCheckResult;
  onRetry: () => void;
  onRestoreBackup: () => void;
  onReset: () => void;
  onClose?: () => void;
}

export function DatabaseErrorDialog({
  open,
  healthCheck,
  onRetry,
  onRestoreBackup,
  onReset,
  onClose,
}: DatabaseErrorDialogProps) {
  const [showDetails, setShowDetails] = useState(false);

  const criticalIssues = healthCheck.issues.filter(
    (i) => i.severity === "error"
  );
  const warningIssues = healthCheck.issues.filter(
    (i) => i.severity === "warning"
  );

  const getIssueIcon = (type: IssueType) => {
    switch (type) {
      case IssueType.CORRUPTION:
        return "⚠️";
      case IssueType.MISSING_TABLE:
        return "📋";
      case IssueType.MISSING_COLUMN:
        return "🔧";
      case IssueType.VERSION_MISMATCH:
        return "🔄";
      case IssueType.NATIVE_MODULE_ERROR:
        return "⚙️";
      case IssueType.FILE_NOT_FOUND:
        return "📁";
      default:
        return "❌";
    }
  };

  const getRecoveryMessage = () => {
    if (healthCheck.status === HealthCheckStatus.CRITICAL) {
      if (criticalIssues.some((i) => i.type === IssueType.CORRUPTION)) {
        return "Your database appears to be corrupted. We recommend restoring from a backup or resetting to a fresh state.";
      }
      if (criticalIssues.some((i) => i.type === IssueType.NATIVE_MODULE_ERROR)) {
        return "The database native module failed to load. This usually indicates a compatibility issue. Please restart the application.";
      }
      if (criticalIssues.some((i) => i.type === IssueType.FILE_NOT_FOUND)) {
        return "Database file is missing. Click 'Reset Database' to create a new one.";
      }
      return "Critical database issues detected. Please try one of the recovery options below.";
    }

    return "Database issues detected, but automatic repair may be able to fix them. Click 'Retry' to attempt automatic repair.";
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <span className="text-2xl">⚠️</span>
            Database Health Check Failed
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p className="text-base">{getRecoveryMessage()}</p>

            {/* Issue Summary */}
            <Card className="p-4 bg-muted/50">
              <div className="space-y-2">
                <div className="font-medium">Issues Found:</div>
                {criticalIssues.length > 0 && (
                  <div className="text-red-600 dark:text-red-400">
                    • {criticalIssues.length} critical error
                    {criticalIssues.length !== 1 ? "s" : ""}
                  </div>
                )}
                {warningIssues.length > 0 && (
                  <div className="text-yellow-600 dark:text-yellow-400">
                    • {warningIssues.length} warning
                    {warningIssues.length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </Card>

            {/* Detailed Issues (collapsible) */}
            {showDetails && (
              <Card className="p-4">
                <div className="font-medium mb-2">Issue Details:</div>
                <ScrollArea className="max-h-64">
                  <div className="space-y-2">
                    {healthCheck.issues.map((issue, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-md ${
                          issue.severity === "error"
                            ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900"
                            : "bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-lg">
                            {getIssueIcon(issue.type)}
                          </span>
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {issue.message}
                            </div>
                            {issue.autoFixable && (
                              <div className="text-xs mt-1 opacity-70">
                                ✓ Auto-fixable
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </Card>
            )}

            {/* Toggle Details Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="w-full"
            >
              {showDetails ? "Hide Details" : "Show Details"}
            </Button>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col sm:flex-col gap-2">
          {/* Primary Actions */}
          <div className="flex gap-2 w-full">
            <AlertDialogAction
              onClick={onRetry}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              Retry / Auto-Repair
            </AlertDialogAction>
          </div>

          {/* Secondary Actions */}
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              onClick={onRestoreBackup}
              className="flex-1"
            >
              Restore Backup
            </Button>
            <Button
              variant="outline"
              onClick={onReset}
              className="flex-1 text-red-600 hover:text-red-700 dark:text-red-400"
            >
              Reset Database
            </Button>
          </div>

          {/* Cancel */}
          {onClose && (
            <AlertDialogCancel onClick={onClose} className="w-full">
              Close
            </AlertDialogCancel>
          )}

          {/* Help Text */}
          <div className="text-xs text-muted-foreground text-center mt-2">
            <p>
              Need help?{" "}
              <a
                href="https://github.com/himoacs/postmaster/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                Report this issue on GitHub
              </a>
            </p>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Simplified error message component for when dialog can't render
 */
export function DatabaseErrorFallback({
  message,
  onRestart,
}: {
  message: string;
  onRestart?: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">⚠️</span>
          <h1 className="text-2xl font-bold">Database Error</h1>
        </div>
        <p className="text-muted-foreground">{message}</p>
        {onRestart && (
          <Button onClick={onRestart} className="w-full">
            Restart Application
          </Button>
        )}
      </Card>
    </div>
  );
}
