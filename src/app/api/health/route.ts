/**
 * Database Health Check API
 * 
 * GET /api/health - Returns database health status
 * POST /api/health/repair - Attempts to repair database issues
 */

import { NextResponse } from "next/server";
import { runHealthCheck, runQuickHealthCheck } from "@/lib/db-health-check";
import { attemptRepair } from "@/lib/db-repair";
import { listBackups, cleanupOldBackups } from "@/lib/db-backup";

/**
 * GET /api/health
 * 
 * Returns current database health status.
 * Query params:
 * - quick=true : Run quick check instead of full validation
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const quick = searchParams.get("quick") === "true";

    if (quick) {
      const result = runQuickHealthCheck();
      return NextResponse.json(result);
    }

    const healthCheck = runHealthCheck();
    
    // Also include backup information
    const backups = listBackups();
    
    return NextResponse.json({
      ...healthCheck,
      backups: {
        count: backups.length,
        latestBackup: backups[0] || null,
        totalSize: backups.reduce((sum, b) => sum + b.size, 0),
      },
    });
  } catch (error) {
    console.error("Health check API error:", error);
    return NextResponse.json(
      {
        error: "Failed to run health check",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/health/repair
 * 
 * Attempts to repair database issues.
 * Body:
 * - createBackup: boolean (default: true) - Create backup before repair
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const createBackup = body.createBackup !== false; // default true

    // Run health check first
    const healthCheck = runHealthCheck();

    // Attempt repair
    const repairResult = attemptRepair(healthCheck, createBackup);

    // Cleanup old backups after repair
    if (repairResult.success) {
      cleanupOldBackups(5);
    }

    return NextResponse.json(repairResult);
  } catch (error) {
    console.error("Database repair API error:", error);
    return NextResponse.json(
      {
        error: "Failed to repair database",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
