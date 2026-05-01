import { NextResponse } from "next/server";
import { getRecentLogsAsString, getLogFilePath, getLogDirectory } from "@/lib/logger";
import fs from "fs";
import path from "path";

/**
 * GET /api/diagnostics/logs
 * Returns recent application logs for debugging
 */
export async function GET() {
  try {
    const logDir = getLogDirectory();
    const currentLogFile = getLogFilePath();
    
    // Get list of available log files
    let logFiles: string[] = [];
    if (fs.existsSync(logDir)) {
      logFiles = fs.readdirSync(logDir)
        .filter(f => f.endsWith(".log"))
        .sort()
        .reverse()
        .slice(0, 7); // Last 7 days
    }
    
    // Read current log file content (last 500 lines)
    let currentLogContent = "";
    if (currentLogFile && fs.existsSync(currentLogFile)) {
      const content = fs.readFileSync(currentLogFile, "utf-8");
      const lines = content.split("\n");
      currentLogContent = lines.slice(-500).join("\n");
    }
    
    // Also get in-memory recent logs
    const recentLogs = getRecentLogsAsString(100);
    
    return NextResponse.json({
      logDirectory: logDir,
      currentLogFile,
      availableLogFiles: logFiles,
      recentLogs: {
        inMemory: recentLogs,
        fromFile: currentLogContent,
      },
      databasePath: process.env.DATABASE_URL || "not set",
      nodeEnv: process.env.NODE_ENV,
      platform: process.platform,
      arch: process.arch,
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: "Failed to get logs",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
