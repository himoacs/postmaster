/**
 * Database Repair Utilities
 * 
 * Attempts to automatically repair database issues detected by health checks.
 * Creates backups before making any changes.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import {
  HealthCheckResult,
  HealthCheckStatus,
  IssueType,
  HealthIssue,
  runHealthCheck,
} from "./db-health-check";
import { createBackup, restoreBackup, listBackups } from "./db-backup";
import { dbLogger, LogCategory } from "./db-logger";

export interface RepairResult {
  success: boolean;
  message: string;
  backupPath?: string;
  issuesFixed: number;
  issuesRemaining: number;
  actions: RepairAction[];
  healthCheckAfter?: HealthCheckResult;
}

export interface RepairAction {
  issue: IssueType;
  description: string;
  success: boolean;
  error?: string;
}

/**
 * Get the database path from environment or default location
 */
function getDatabasePath(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL.replace(/^file:/, "");
  }
  return path.resolve(process.cwd(), "data", "postmaster.db");
}

/**
 * Get template database path
 */
function getTemplatePath(): string | null {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string })
    .resourcesPath;
  
  const templatePaths = [
    path.join(resourcesPath || "", "template.db"),
    path.join(__dirname, "..", "..", "prisma", "template.db"),
    path.join(process.cwd(), "prisma", "template.db"),
  ];

  for (const templatePath of templatePaths) {
    if (fs.existsSync(templatePath)) {
      return templatePath;
    }
  }

  return null;
}

/**
 * Fix missing columns by adding them with ALTER TABLE
 */
function repairMissingColumns(
  dbPath: string,
  missingColumns: Array<{ table: string; column: string }>
): RepairAction[] {
  const actions: RepairAction[] = [];

  try {
    const db = new Database(dbPath);

    for (const missing of missingColumns) {
      try {
        // For missing columns, we'll run the runtime migrations
        // This is already defined in db.ts, so we'll just add the column
        
        // Determine the column type and default based on table/column
        let sql: string;
        
        // Common patterns for adding columns
        if (missing.column.startsWith("enable")) {
          sql = `ALTER TABLE ${missing.table} ADD COLUMN ${missing.column} INTEGER DEFAULT 0`;
        } else if (missing.column.endsWith("Models") || missing.column === "sourceMap") {
          sql = `ALTER TABLE ${missing.table} ADD COLUMN ${missing.column} TEXT`;
        } else if (missing.column.endsWith("At")) {
          sql = `ALTER TABLE ${missing.table} ADD COLUMN ${missing.column} INTEGER`;
        } else {
          sql = `ALTER TABLE ${missing.table} ADD COLUMN ${missing.column} TEXT`;
        }

        db.exec(sql);

        actions.push({
          issue: IssueType.MISSING_COLUMN,
          description: `Added column ${missing.table}.${missing.column}`,
          success: true,
        });

        dbLogger.info(LogCategory.REPAIR, `Repaired missing column: ${missing.table}.${missing.column}`);
      } catch (err) {
        actions.push({
          issue: IssueType.MISSING_COLUMN,
          description: `Failed to add column ${missing.table}.${missing.column}`,
          success: false,
          error: (err as Error).message,
        });

        dbLogger.error(
          LogCategory.REPAIR,
          `Failed to repair column ${missing.table}.${missing.column}`,
          err as Error
        );
      }
    }

    db.close();
  } catch (err) {
    dbLogger.error(
      LogCategory.REPAIR,
      "Failed to repair missing columns",
      err as Error
    );
  }

  return actions;
}

/**
 * Fix version mismatch by recording current version
 */
function repairVersionMismatch(dbPath: string, expectedVersion: string): RepairAction[] {
  const actions: RepairAction[] = [];

  try {
    const db = new Database(dbPath);

    // Ensure SchemaVersion table exists
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='SchemaVersion'")
      .all();

    if (tables.length === 0) {
      // Create SchemaVersion table
      db.exec(`
        CREATE TABLE IF NOT EXISTS "SchemaVersion" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "version" TEXT NOT NULL,
          "description" TEXT NOT NULL,
          "appliedAt" INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS "SchemaVersion_version_idx" ON "SchemaVersion"("version");
        CREATE INDEX IF NOT EXISTS "SchemaVersion_appliedAt_idx" ON "SchemaVersion"("appliedAt");
      `);
      
      actions.push({
        issue: IssueType.VERSION_MISMATCH,
        description: "Created SchemaVersion table",
        success: true,
      });
    }

    // Record current version
    const id = `cuid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    db.prepare(
      "INSERT INTO SchemaVersion (id, version, description, appliedAt) VALUES (?, ?, ?, ?)"
    ).run(
      id,
      expectedVersion,
      `Schema updated to version ${expectedVersion}`,
      Math.floor(Date.now() / 1000)
    );

    actions.push({
      issue: IssueType.VERSION_MISMATCH,
      description: `Updated schema version to ${expectedVersion}`,
      success: true,
    });

    db.close();

    dbLogger.info(LogCategory.REPAIR, `Updated schema version to ${expectedVersion}`);
  } catch (err) {
    actions.push({
      issue: IssueType.VERSION_MISMATCH,
      description: "Failed to update schema version",
      success: false,
      error: (err as Error).message,
    });

    dbLogger.error(
      LogCategory.REPAIR,
      "Failed to repair version mismatch",
      err as Error
    );
  }

  return actions;
}

/**
 * Fix missing database file by copying from template
 */
function repairMissingDatabase(): RepairAction[] {
  const actions: RepairAction[] = [];
  const dbPath = getDatabasePath();

  try {
    const templatePath = getTemplatePath();

    if (!templatePath) {
      actions.push({
        issue: IssueType.FILE_NOT_FOUND,
        description: "Failed to find template database",
        success: false,
        error: "Template database not found in any expected location",
      });
      return actions;
    }

    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Copy template to database location
    fs.copyFileSync(templatePath, dbPath);

    actions.push({
      issue: IssueType.FILE_NOT_FOUND,
      description: "Created new database from template",
      success: true,
    });

    dbLogger.info(LogCategory.REPAIR, "Created new database from template", {
      templatePath,
      dbPath,
    });
  } catch (err) {
    actions.push({
      issue: IssueType.FILE_NOT_FOUND,
      description: "Failed to create database from template",
      success: false,
      error: (err as Error).message,
    });

    dbLogger.error(
      LogCategory.REPAIR,
      "Failed to repair missing database",
      err as Error
    );
  }

  return actions;
}

/**
 * Attempt to repair database corruption by restoring from backup
 */
function repairCorruption(): RepairAction[] {
  const actions: RepairAction[] = [];

  try {
    const backups = listBackups();

    if (backups.length === 0) {
      actions.push({
        issue: IssueType.CORRUPTION,
        description: "No backups available to restore from",
        success: false,
        error: "No backup files found",
      });
      return actions;
    }

    // Try to restore from the most recent backup
    const latestBackup = backups[0];
    const success = restoreBackup(latestBackup.path, false);

    if (success) {
      actions.push({
        issue: IssueType.CORRUPTION,
        description: `Restored database from backup: ${latestBackup.filename}`,
        success: true,
      });

      dbLogger.info(LogCategory.REPAIR, "Restored database from backup", {
        backupPath: latestBackup.path,
      });
    } else {
      actions.push({
        issue: IssueType.CORRUPTION,
        description: "Failed to restore from backup",
        success: false,
      });
    }
  } catch (err) {
    actions.push({
      issue: IssueType.CORRUPTION,
      description: "Failed to repair corruption",
      success: false,
      error: (err as Error).message,
    });

    dbLogger.error(
      LogCategory.REPAIR,
      "Failed to repair corruption",
      err as Error
    );
  }

  return actions;
}

/**
 * Attempt to automatically repair database issues
 * 
 * @param healthCheck - Results from health check
 * @param createBackupFirst - Whether to create backup before repair (recommended)
 * @returns Repair result with actions taken
 */
export function attemptRepair(
  healthCheck: HealthCheckResult,
  createBackupFirst: boolean = true
): RepairResult {
  dbLogger.info(LogCategory.REPAIR, "Starting database repair", {
    status: healthCheck.status,
    issueCount: healthCheck.issues.length,
  });

  let backupPath: string | null = null;
  const actions: RepairAction[] = [];

  // If database is healthy, nothing to repair
  if (healthCheck.status === HealthCheckStatus.HEALTHY) {
    return {
      success: true,
      message: "Database is healthy, no repair needed",
      issuesFixed: 0,
      issuesRemaining: 0,
      actions: [],
    };
  }

  // Create backup before attempting repair (unless database doesn't exist)
  const dbPath = getDatabasePath();
  if (createBackupFirst && fs.existsSync(dbPath)) {
    backupPath = createBackup("before_repair");
    if (!backupPath) {
      dbLogger.warn(LogCategory.REPAIR, "Failed to create backup before repair");
    }
  }

  // Separate auto-fixable and non-fixable issues
  const autoFixableIssues = healthCheck.issues.filter((i) => i.autoFixable);
  const nonFixableIssues = healthCheck.issues.filter((i) => !i.autoFixable);

  dbLogger.info(LogCategory.REPAIR, "Categorized issues", {
    autoFixable: autoFixableIssues.length,
    nonFixable: nonFixableIssues.length,
  });

  // Group issues by type
  const issuesByType = new Map<IssueType, HealthIssue[]>();
  for (const issue of autoFixableIssues) {
    const issues = issuesByType.get(issue.type) || [];
    issues.push(issue);
    issuesByType.set(issue.type, issues);
  }

  // Repair missing database file
  if (issuesByType.has(IssueType.FILE_NOT_FOUND)) {
    actions.push(...repairMissingDatabase());
  }

  // Repair missing columns
  if (issuesByType.has(IssueType.MISSING_COLUMN)) {
    const missingColumnIssues = issuesByType.get(IssueType.MISSING_COLUMN)!;
    const missingColumns = missingColumnIssues.map((issue) => ({
      table: (issue.details?.table as string) || "",
      column: (issue.details?.column as string) || "",
    }));
    actions.push(...repairMissingColumns(dbPath, missingColumns));
  }

  // Repair version mismatch
  if (issuesByType.has(IssueType.VERSION_MISMATCH)) {
    actions.push(...repairVersionMismatch(dbPath, healthCheck.metadata.expectedVersion));
  }

  // Repair corruption (try to restore from backup)
  if (issuesByType.has(IssueType.CORRUPTION)) {
    actions.push(...repairCorruption());
  }

  // Count successful repairs
  const successfulActions = actions.filter((a) => a.success);
  const issuesFixed = successfulActions.length;

  // Run health check again to see if issues are resolved
  dbLogger.info(LogCategory.REPAIR, "Running post-repair health check");
  const healthCheckAfter = runHealthCheck();

  const result: RepairResult = {
    success: healthCheckAfter.status === HealthCheckStatus.HEALTHY,
    message: healthCheckAfter.status === HealthCheckStatus.HEALTHY
      ? "All issues resolved successfully"
      : `Repaired ${issuesFixed} issues, ${healthCheckAfter.issues.length} issues remaining`,
    backupPath: backupPath || undefined,
    issuesFixed,
    issuesRemaining: healthCheckAfter.issues.length,
    actions,
    healthCheckAfter,
  };

  dbLogger.info(LogCategory.REPAIR, "Database repair completed", {
    success: result.success,
    issuesFixed,
    issuesRemaining: result.issuesRemaining,
  });

  return result;
}

/**
 * Reset database to fresh state (copy from template, losing all data)
 * 
 * @param createBackupFirst - Whether to backup current database before reset
 * @returns Success status and backup path
 */
export function resetToFreshDatabase(createBackupFirst: boolean = true): {
  success: boolean;
  message: string;
  backupPath?: string;
} {
  dbLogger.warn(LogCategory.REPAIR, "Resetting database to fresh state");

  const dbPath = getDatabasePath();
  let backupPath: string | null = null;

  // Create backup if requested and database exists
  if (createBackupFirst && fs.existsSync(dbPath)) {
    backupPath = createBackup("before_reset");
  }

  // Get template path
  const templatePath = getTemplatePath();
  if (!templatePath) {
    return {
      success: false,
      message: "Template database not found",
    };
  }

  try {
    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Copy template to database location
    fs.copyFileSync(templatePath, dbPath);

    dbLogger.info(LogCategory.REPAIR, "Database reset to fresh state", {
      templatePath,
      dbPath,
      backupPath,
    });

    return {
      success: true,
      message: "Database reset successfully",
      backupPath: backupPath || undefined,
    };
  } catch (err) {
    dbLogger.error(
      LogCategory.REPAIR,
      "Failed to reset database",
      err as Error
    );

    return {
      success: false,
      message: `Failed to reset database: ${(err as Error).message}`,
      backupPath: backupPath || undefined,
    };
  }
}
