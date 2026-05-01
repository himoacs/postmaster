/**
 * Database-specific structured logging
 * 
 * Logs database errors, validation failures, and repair attempts
 * to help diagnose issues and provide better support.
 */

import fs from "fs";
import path from "path";

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export enum LogCategory {
  INITIALIZATION = "INITIALIZATION",
  VALIDATION = "VALIDATION",
  MIGRATION = "MIGRATION",
  REPAIR = "REPAIR",
  BACKUP = "BACKUP",
  HEALTH_CHECK = "HEALTH_CHECK",
  ERROR = "ERROR",
}

export interface DatabaseLogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class DatabaseLogger {
  private logDir: string;
  private currentLogFile: string;

  constructor() {
    // Determine log directory based on environment
    if (process.env.DATABASE_URL) {
      // Production: Use user data directory
      const dbPath = process.env.DATABASE_URL.replace(/^file:/, "");
      this.logDir = path.join(path.dirname(dbPath), "logs");
    } else {
      // Development: Use project data directory
      this.logDir = path.resolve(process.cwd(), "data", "logs");
    }

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Create log file for today
    const today = new Date().toISOString().split("T")[0];
    this.currentLogFile = path.join(this.logDir, `database-${today}.log`);
  }

  /**
   * Log a message with structured data
   */
  log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    details?: Record<string, unknown>,
    error?: Error
  ): void {
    const entry: DatabaseLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Write to log file
    try {
      const logLine = JSON.stringify(entry) + "\n";
      fs.appendFileSync(this.currentLogFile, logLine, "utf-8");
    } catch (err) {
      console.error("Failed to write to database log:", err);
    }

    // Also log to console in development
    if (process.env.NODE_ENV === "development") {
      const consoleMessage = `[${level}] [${category}] ${message}`;
      switch (level) {
        case LogLevel.ERROR:
          console.error(consoleMessage, details, error);
          break;
        case LogLevel.WARN:
          console.warn(consoleMessage, details);
          break;
        case LogLevel.INFO:
          console.log(consoleMessage, details);
          break;
        case LogLevel.DEBUG:
          console.debug(consoleMessage, details);
          break;
      }
    }
  }

  /**
   * Log debug information
   */
  debug(category: LogCategory, message: string, details?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, category, message, details);
  }

  /**
   * Log informational message
   */
  info(category: LogCategory, message: string, details?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, category, message, details);
  }

  /**
   * Log warning
   */
  warn(category: LogCategory, message: string, details?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, category, message, details);
  }

  /**
   * Log error
   */
  error(
    category: LogCategory,
    message: string,
    error?: Error,
    details?: Record<string, unknown>
  ): void {
    this.log(LogLevel.ERROR, category, message, details, error);
  }

  /**
   * Get path to current log file
   */
  getCurrentLogPath(): string {
    return this.currentLogFile;
  }

  /**
   * Get all log files in the log directory
   */
  getLogFiles(): string[] {
    try {
      const files = fs.readdirSync(this.logDir);
      return files
        .filter((f) => f.startsWith("database-") && f.endsWith(".log"))
        .map((f) => path.join(this.logDir, f))
        .sort()
        .reverse(); // Most recent first
    } catch (err) {
      console.error("Failed to read log directory:", err);
      return [];
    }
  }

  /**
   * Read log entries from a specific log file
   */
  readLogFile(logFilePath: string): DatabaseLogEntry[] {
    try {
      const content = fs.readFileSync(logFilePath, "utf-8");
      const lines = content.trim().split("\n");
      return lines
        .map((line) => {
          try {
            return JSON.parse(line) as DatabaseLogEntry;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is DatabaseLogEntry => entry !== null);
    } catch (err) {
      console.error("Failed to read log file:", err);
      return [];
    }
  }

  /**
   * Get recent log entries (last N entries from current log)
   */
  getRecentLogs(count: number = 100): DatabaseLogEntry[] {
    const entries = this.readLogFile(this.currentLogFile);
    return entries.slice(-count);
  }

  /**
   * Clean up old log files (keep only last N days)
   */
  cleanupOldLogs(daysToKeep: number = 30): void {
    try {
      const files = this.getLogFiles();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      for (const file of files) {
        const stats = fs.statSync(file);
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(file);
          this.info(
            LogCategory.INITIALIZATION,
            `Cleaned up old log file: ${path.basename(file)}`
          );
        }
      }
    } catch (err) {
      console.error("Failed to cleanup old logs:", err);
    }
  }
}

// Singleton instance
export const dbLogger = new DatabaseLogger();

// Cleanup old logs on initialization (runs once when module is imported)
if (process.env.NODE_ENV === "production") {
  dbLogger.cleanupOldLogs(30);
}
