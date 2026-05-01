/**
 * Database Health Check
 * 
 * Validates database integrity, schema completeness, and native module compatibility.
 * Used at startup and on-demand to detect issues early.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import {
  EXPECTED_SCHEMA,
  CURRENT_SCHEMA_VERSION,
  getExpectedTableNames,
  getExpectedColumns,
} from "./db-schema-manifest";
import { dbLogger, LogCategory } from "./db-logger";

export enum HealthCheckStatus {
  HEALTHY = "HEALTHY",
  WARNING = "WARNING",
  CRITICAL = "CRITICAL",
}

export enum IssueType {
  MISSING_TABLE = "MISSING_TABLE",
  MISSING_COLUMN = "MISSING_COLUMN",
  CORRUPTION = "CORRUPTION",
  VERSION_MISMATCH = "VERSION_MISMATCH",
  NATIVE_MODULE_ERROR = "NATIVE_MODULE_ERROR",
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  FILE_ACCESS_ERROR = "FILE_ACCESS_ERROR",
}

export interface HealthIssue {
  type: IssueType;
  severity: "error" | "warning";
  message: string;
  details?: Record<string, unknown>;
  autoFixable: boolean;
}

export interface HealthCheckResult {
  status: HealthCheckStatus;
  issues: HealthIssue[];
  checks: {
    nativeModuleLoads: boolean;
    databaseExists: boolean;
    databaseAccessible: boolean;
    schemaComplete: boolean;
    integrityCheck: boolean;
    versionCheck: boolean;
  };
  metadata: {
    dbPath: string;
    dbSize?: number;
    currentVersion?: string;
    expectedVersion: string;
    timestamp: Date;
  };
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
 * Check if better-sqlite3 native module can be loaded
 */
function checkNativeModule(): { success: boolean; error?: Error } {
  try {
    // Try to import better-sqlite3
    // If this succeeds, the native module is compatible
    const Database = require("better-sqlite3");
    
    // Try to create a memory database to verify full functionality
    const testDb = new Database(":memory:");
    testDb.close();
    
    return { success: true };
  } catch (err) {
    return { success: false, error: err as Error };
  }
}

/**
 * Check database file integrity using SQLite's PRAGMA integrity_check
 */
function checkDatabaseIntegrity(dbPath: string): { ok: boolean; errors: string[] } {
  try {
    const db = new Database(dbPath, { readonly: true });
    const result = db.prepare("PRAGMA integrity_check").all() as { integrity_check: string }[];
    db.close();

    const errors = result
      .filter((row) => row.integrity_check !== "ok")
      .map((row) => row.integrity_check);

    return { ok: errors.length === 0, errors };
  } catch (err) {
    dbLogger.error(
      LogCategory.HEALTH_CHECK,
      "Failed to check database integrity",
      err as Error,
      { dbPath }
    );
    return { ok: false, errors: [(err as Error).message] };
  }
}

/**
 * Check schema completeness (all expected tables and columns exist)
 */
function checkSchemaCompleteness(dbPath: string): {
  complete: boolean;
  missingTables: string[];
  missingColumns: Array<{ table: string; column: string }>;
} {
  try {
    const db = new Database(dbPath, { readonly: true });

    // Check tables
    const existingTables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const existingTableNames = existingTables.map((t) => t.name);

    const expectedTableNames = getExpectedTableNames();
    const missingTables = expectedTableNames.filter(
      (name) => !existingTableNames.includes(name)
    );

    // Check columns for existing tables
    const missingColumns: Array<{ table: string; column: string }> = [];

    for (const table of EXPECTED_SCHEMA) {
      if (!existingTableNames.includes(table.name)) {
        continue; // Already tracked in missingTables
      }

      const tableInfo = db
        .prepare(`PRAGMA table_info(${table.name})`)
        .all() as { name: string }[];
      const existingColumnNames = tableInfo.map((c) => c.name);

      for (const expectedColumn of table.columns) {
        if (!existingColumnNames.includes(expectedColumn.name)) {
          missingColumns.push({ table: table.name, column: expectedColumn.name });
        }
      }
    }

    db.close();

    return {
      complete: missingTables.length === 0 && missingColumns.length === 0,
      missingTables,
      missingColumns,
    };
  } catch (err) {
    dbLogger.error(
      LogCategory.HEALTH_CHECK,
      "Failed to check schema completeness",
      err as Error,
      { dbPath }
    );
    return {
      complete: false,
      missingTables: [],
      missingColumns: [],
    };
  }
}

/**
 * Check schema version against expected version
 */
function checkSchemaVersion(dbPath: string): {
  matched: boolean;
  currentVersion?: string;
  expectedVersion: string;
} {
  try {
    const db = new Database(dbPath, { readonly: true });

    // Check if SchemaVersion table exists
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='SchemaVersion'")
      .all();

    if (tables.length === 0) {
      db.close();
      return {
        matched: false,
        currentVersion: undefined,
        expectedVersion: CURRENT_SCHEMA_VERSION,
      };
    }

    // Get the latest schema version from the database
    const latestVersion = db
      .prepare(
        "SELECT version FROM SchemaVersion ORDER BY appliedAt DESC LIMIT 1"
      )
      .get() as { version: string } | undefined;

    db.close();

    const currentVersion = latestVersion?.version;

    return {
      matched: currentVersion === CURRENT_SCHEMA_VERSION,
      currentVersion,
      expectedVersion: CURRENT_SCHEMA_VERSION,
    };
  } catch (err) {
    dbLogger.error(
      LogCategory.HEALTH_CHECK,
      "Failed to check schema version",
      err as Error,
      { dbPath }
    );
    return {
      matched: false,
      expectedVersion: CURRENT_SCHEMA_VERSION,
    };
  }
}

/**
 * Run comprehensive health check on the database
 */
export function runHealthCheck(): HealthCheckResult {
  const dbPath = getDatabasePath();
  const issues: HealthIssue[] = [];
  const checks = {
    nativeModuleLoads: false,
    databaseExists: false,
    databaseAccessible: false,
    schemaComplete: false,
    integrityCheck: false,
    versionCheck: false,
  };

  dbLogger.info(LogCategory.HEALTH_CHECK, "Starting database health check", { dbPath });

  // 1. Check native module
  const nativeModuleCheck = checkNativeModule();
  checks.nativeModuleLoads = nativeModuleCheck.success;
  if (!nativeModuleCheck.success) {
    issues.push({
      type: IssueType.NATIVE_MODULE_ERROR,
      severity: "error",
      message: "Failed to load better-sqlite3 native module",
      details: {
        error: nativeModuleCheck.error?.message,
        stack: nativeModuleCheck.error?.stack,
      },
      autoFixable: false,
    });
    
    // Cannot proceed if native module doesn't load
    return {
      status: HealthCheckStatus.CRITICAL,
      issues,
      checks,
      metadata: {
        dbPath,
        expectedVersion: CURRENT_SCHEMA_VERSION,
        timestamp: new Date(),
      },
    };
  }

  // 2. Check database file exists
  checks.databaseExists = fs.existsSync(dbPath);
  if (!checks.databaseExists) {
    issues.push({
      type: IssueType.FILE_NOT_FOUND,
      severity: "error",
      message: "Database file does not exist",
      details: { dbPath },
      autoFixable: true, // Can be fixed by copying template
    });

    return {
      status: HealthCheckStatus.CRITICAL,
      issues,
      checks,
      metadata: {
        dbPath,
        expectedVersion: CURRENT_SCHEMA_VERSION,
        timestamp: new Date(),
      },
    };
  }

  // 3. Check database file is accessible
  try {
    fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
    checks.databaseAccessible = true;
  } catch (err) {
    checks.databaseAccessible = false;
    issues.push({
      type: IssueType.FILE_ACCESS_ERROR,
      severity: "error",
      message: "Database file is not accessible (permission issue)",
      details: {
        dbPath,
        error: (err as Error).message,
      },
      autoFixable: false,
    });
  }

  // Get database size
  const dbSize = checks.databaseAccessible ? fs.statSync(dbPath).size : undefined;

  // 4. Check database integrity
  if (checks.databaseAccessible) {
    const integrityCheck = checkDatabaseIntegrity(dbPath);
    checks.integrityCheck = integrityCheck.ok;

    if (!integrityCheck.ok) {
      issues.push({
        type: IssueType.CORRUPTION,
        severity: "error",
        message: "Database integrity check failed",
        details: {
          errors: integrityCheck.errors,
        },
        autoFixable: false, // Requires restore from backup or reset
      });
    }
  }

  // 5. Check schema completeness
  if (checks.integrityCheck) {
    const schemaCheck = checkSchemaCompleteness(dbPath);
    checks.schemaComplete = schemaCheck.complete;

    // Internal tables that can be safely auto-created
    const autoCreatableTables = ["SchemaVersion"];

    for (const missingTable of schemaCheck.missingTables) {
      const isAutoCreatable = autoCreatableTables.includes(missingTable);
      issues.push({
        type: IssueType.MISSING_TABLE,
        severity: isAutoCreatable ? "warning" : "error",
        message: `Missing table: ${missingTable}`,
        details: { table: missingTable },
        autoFixable: isAutoCreatable, // Internal tables can be auto-created
      });
    }

    for (const missing of schemaCheck.missingColumns) {
      issues.push({
        type: IssueType.MISSING_COLUMN,
        severity: "warning",
        message: `Missing column: ${missing.table}.${missing.column}`,
        details: missing,
        autoFixable: true, // Columns can be added via runtime migration
      });
    }
  }

  // 6. Check schema version
  if (checks.integrityCheck) {
    const versionCheck = checkSchemaVersion(dbPath);
    checks.versionCheck = versionCheck.matched;

    if (!versionCheck.matched) {
      issues.push({
        type: IssueType.VERSION_MISMATCH,
        severity: "warning",
        message: "Database schema version mismatch",
        details: {
          currentVersion: versionCheck.currentVersion || "unknown",
          expectedVersion: versionCheck.expectedVersion,
        },
        autoFixable: true, // Can apply pending migrations
      });
    }
  }

  // Determine overall status
  let status: HealthCheckStatus;
  const criticalIssues = issues.filter((i) => i.severity === "error");
  const warningIssues = issues.filter((i) => i.severity === "warning");

  if (criticalIssues.length > 0) {
    status = HealthCheckStatus.CRITICAL;
  } else if (warningIssues.length > 0) {
    status = HealthCheckStatus.WARNING;
  } else {
    status = HealthCheckStatus.HEALTHY;
  }

  const result: HealthCheckResult = {
    status,
    issues,
    checks,
    metadata: {
      dbPath,
      dbSize,
      currentVersion: checks.versionCheck ? CURRENT_SCHEMA_VERSION : undefined,
      expectedVersion: CURRENT_SCHEMA_VERSION,
      timestamp: new Date(),
    },
  };

  dbLogger.info(LogCategory.HEALTH_CHECK, "Health check completed", {
    status,
    issueCount: issues.length,
    criticalCount: criticalIssues.length,
    warningCount: warningIssues.length,
  });

  return result;
}

/**
 * Quick health check (just basic checks, no deep validation)
 */
export function runQuickHealthCheck(): {
  healthy: boolean;
  message: string;
} {
  const dbPath = getDatabasePath();

  // Check native module
  const nativeCheck = checkNativeModule();
  if (!nativeCheck.success) {
    return {
      healthy: false,
      message: "Native module (better-sqlite3) failed to load",
    };
  }

  // Check file exists
  if (!fs.existsSync(dbPath)) {
    return {
      healthy: false,
      message: "Database file not found",
    };
  }

  // Try to open and query
  try {
    const db = new Database(dbPath, { readonly: true });
    db.prepare("SELECT 1").get();
    db.close();
    return {
      healthy: true,
      message: "Database is accessible",
    };
  } catch (err) {
    return {
      healthy: false,
      message: `Database error: ${(err as Error).message}`,
    };
  }
}
