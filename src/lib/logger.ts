/**
 * Centralized logging utility for PostMaster
 * 
 * In production (Electron), logs are written to:
 * - macOS: ~/Library/Application Support/PostMaster/logs/
 * - Windows: %USERPROFILE%\AppData\Roaming\PostMaster\logs\
 * - Linux: ~/.config/PostMaster/logs/
 * 
 * Log levels: ERROR, WARN, INFO, DEBUG
 */

import fs from "fs";
import path from "path";

type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// In-memory buffer for recent logs (useful for error reporting)
const LOG_BUFFER_SIZE = 100;
const logBuffer: LogEntry[] = [];

// Log file path (determined once on initialization)
let logFilePath: string | null = null;
let logDirInitialized = false;

function getLogDir(): string {
  // Use DATABASE_URL to infer user data directory
  if (process.env.DATABASE_URL) {
    const dbPath = process.env.DATABASE_URL.replace(/^file:/, "");
    return path.join(path.dirname(dbPath), "logs");
  }
  // Fallback to project data directory
  return path.resolve(process.cwd(), "data", "logs");
}

function ensureLogDir(): void {
  if (logDirInitialized) return;
  
  try {
    const logDir = getLogDir();
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const today = new Date().toISOString().split("T")[0];
    logFilePath = path.join(logDir, `app-${today}.log`);
    logDirInitialized = true;
  } catch {
    // Can't create log directory, will only log to console
    logDirInitialized = true;
  }
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function addToBuffer(entry: LogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
}

function formatLogMessage(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level}]`,
    `[${entry.context}]`,
    entry.message,
  ];
  
  if (entry.data) {
    try {
      parts.push(`| data=${JSON.stringify(entry.data)}`);
    } catch {
      parts.push(`| data=[non-serializable]`);
    }
  }
  
  if (entry.error) {
    parts.push(`| error=${entry.error.name}: ${entry.error.message}`);
    if (entry.error.stack) {
      parts.push(`\n${entry.error.stack}`);
    }
  }
  
  return parts.join(" ");
}

function log(level: LogLevel, context: string, message: string, data?: unknown, error?: unknown): void {
  ensureLogDir();
  
  const entry: LogEntry = {
    timestamp: formatTimestamp(),
    level,
    context,
    message,
  };
  
  if (data !== undefined) {
    entry.data = data;
  }
  
  if (error instanceof Error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  } else if (error) {
    entry.error = {
      name: "Unknown",
      message: String(error),
    };
  }
  
  addToBuffer(entry);
  
  const formattedMessage = formatLogMessage(entry);
  
  // Write to log file (always, not just development)
  if (logFilePath) {
    try {
      fs.appendFileSync(logFilePath, formattedMessage + "\n", "utf-8");
    } catch {
      // Silently fail if can't write to log file
    }
  }
  
  switch (level) {
    case "ERROR":
      console.error(formattedMessage);
      break;
    case "WARN":
      console.warn(formattedMessage);
      break;
    case "DEBUG":
      if (process.env.NODE_ENV === "development" || process.env.DEBUG) {
        console.debug(formattedMessage);
      }
      break;
    default:
      console.log(formattedMessage);
  }
}

/**
 * Create a logger instance for a specific context (e.g., "API:Synthesize", "DB", "Encryption")
 */
export function createLogger(context: string) {
  return {
    error: (message: string, data?: unknown, error?: unknown) => 
      log("ERROR", context, message, data, error),
    
    warn: (message: string, data?: unknown) => 
      log("WARN", context, message, data),
    
    info: (message: string, data?: unknown) => 
      log("INFO", context, message, data),
    
    debug: (message: string, data?: unknown) => 
      log("DEBUG", context, message, data),
  };
}

/**
 * Get recent log entries (useful for error reporting or diagnostics)
 */
export function getRecentLogs(count: number = 50): LogEntry[] {
  return logBuffer.slice(-count);
}

/**
 * Get recent logs as formatted string
 */
export function getRecentLogsAsString(count: number = 50): string {
  return getRecentLogs(count)
    .map(formatLogMessage)
    .join("\n");
}

/**
 * Get path to current log file (useful for debugging)
 */
export function getLogFilePath(): string | null {
  ensureLogDir();
  return logFilePath;
}

/**
 * Get path to log directory
 */
export function getLogDirectory(): string {
  return getLogDir();
}

// Pre-configured loggers for common contexts
export const serverLogger = createLogger("Server");
export const apiLogger = createLogger("API");
export const encryptionLogger = createLogger("Encryption");
export const aiLogger = createLogger("AI");
export const synthesisLogger = createLogger("Synthesis");
export const generationLogger = createLogger("Generation");
