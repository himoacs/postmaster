import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { runHealthCheck, HealthCheckStatus } from "./db-health-check";
import { attemptRepair } from "./db-repair";
import { dbLogger, LogCategory } from "./db-logger";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Schema migrations for existing databases
// Add new columns here as they're added to the schema
interface SchemaMigration {
  id: string; // Unique migration ID for tracking
  table: string;
  column: string;
  sql: string;
  description: string;
  version: string; // App version when migration was added
}

const SCHEMA_MIGRATIONS: SchemaMigration[] = [
  // Migration: Add sourceMap column to Generation (v1.2.3)
  {
    id: "migration_generation_sourcemap",
    table: "Generation",
    column: "sourceMap",
    sql: "ALTER TABLE Generation ADD COLUMN sourceMap TEXT",
    description: "Add sourceMap column to Generation table for citation tracking",
    version: "1.2.3",
  },
  // Migration: Add enableCitations column to Generation (v1.2.3)
  {
    id: "migration_generation_enablecitations",
    table: "Generation",
    column: "enableCitations",
    sql: "ALTER TABLE Generation ADD COLUMN enableCitations INTEGER DEFAULT 0",
    description: "Add enableCitations column to Generation table",
    version: "1.2.3",
  },
  // Migration: Add enableEmojis column to Generation (v1.2.3)
  {
    id: "migration_generation_enableemojis",
    table: "Generation",
    column: "enableEmojis",
    sql: "ALTER TABLE Generation ADD COLUMN enableEmojis INTEGER DEFAULT 0",
    description: "Add enableEmojis column to Generation table",
    version: "1.2.3",
  },
  // Migration: Add enabledModels column to LiteLLMConfig (v1.2.4)
  {
    id: "migration_litellmconfig_enabledmodels",
    table: "LiteLLMConfig",
    column: "enabledModels",
    sql: "ALTER TABLE LiteLLMConfig ADD COLUMN enabledModels TEXT DEFAULT '[]'",
    description: "Add enabledModels column to LiteLLMConfig for model filtering",
    version: "1.2.4",
  },
  // Migration: Add enabledModels column to OllamaConfig (v1.2.4)
  {
    id: "migration_ollamaconfig_enabledmodels",
    table: "OllamaConfig",
    column: "enabledModels",
    sql: "ALTER TABLE OllamaConfig ADD COLUMN enabledModels TEXT DEFAULT '[]'",
    description: "Add enabledModels column to OllamaConfig for model filtering",
    version: "1.2.4",
  },
  // Migration: Add enabledModels column to APIKey (v1.2.4)
  {
    id: "migration_apikey_enabledmodels",
    table: "APIKey",
    column: "enabledModels",
    sql: "ALTER TABLE APIKey ADD COLUMN enabledModels TEXT DEFAULT '[]'",
    description: "Add enabledModels column to APIKey for model filtering",
    version: "1.2.4",
  },
  // Migration: Add SchemaVersion table for tracking (v1.2.4)
  {
    id: "migration_add_schemaversion_table",
    table: "SchemaVersion",
    column: "id", // Use id to check if table exists
    sql: `CREATE TABLE IF NOT EXISTS "SchemaVersion" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "version" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "appliedAt" INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS "SchemaVersion_version_idx" ON "SchemaVersion"("version");
    CREATE INDEX IF NOT EXISTS "SchemaVersion_appliedAt_idx" ON "SchemaVersion"("appliedAt");`,
    description: "Create SchemaVersion table for migration tracking",
    version: "1.2.4",
  },
];

/**
 * Apply runtime schema migrations to an existing database.
 * This ensures old databases get new columns without requiring Prisma migrate.
 */
function applyRuntimeMigrations(dbPath: string): void {
  try {
    const db = new Database(dbPath);
    
    for (const migration of SCHEMA_MIGRATIONS) {
      // Check if column exists
      const tableInfo = db.prepare(`PRAGMA table_info(${migration.table})`).all() as { name: string }[];
      const columnExists = tableInfo.some((col) => col.name === migration.column);
      
      if (!columnExists) {
        try {
          db.exec(migration.sql);
          console.log(`Applied migration: Added ${migration.column} to ${migration.table}`);
        } catch (err) {
          console.error(`Failed to apply migration for ${migration.column}:`, err);
        }
      }
    }
    
    db.close();
  } catch (err) {
    console.error("Failed to apply runtime migrations:", err);
  }
}

function createPrismaClient() {
  // Use DATABASE_URL environment variable if set (for packaged Electron app)
  // Otherwise, resolve relative to project root (for development)
  let dbPath: string;
  
  if (process.env.DATABASE_URL) {
    // DATABASE_URL format: file:/path/to/db.db
    dbPath = process.env.DATABASE_URL.replace(/^file:/, "");
  } else {
    dbPath = path.resolve(process.cwd(), "data", "postmaster.db");
  }
  
  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // Run health check before proceeding
  dbLogger.info(LogCategory.INITIALIZATION, "Starting database initialization", { dbPath });
  
  const healthCheck = runHealthCheck();
  
  // If database has issues, attempt automatic repair
  if (healthCheck.status !== HealthCheckStatus.HEALTHY) {
    dbLogger.warn(
      LogCategory.INITIALIZATION,
      "Database health check detected issues",
      {
        status: healthCheck.status,
        issueCount: healthCheck.issues.length,
        issues: healthCheck.issues.map(i => ({
          type: i.type,
          severity: i.severity,
          message: i.message,
          details: i.details,
          autoFixable: i.autoFixable
        })),
        checks: healthCheck.checks,
      }
    );
    
    // Attempt automatic repair for auto-fixable issues
    const autoFixableCount = healthCheck.issues.filter((i) => i.autoFixable).length;
    
    if (autoFixableCount > 0) {
      dbLogger.info(
        LogCategory.INITIALIZATION,
        `Attempting automatic repair for ${autoFixableCount} auto-fixable issues`
      );
      
      const repairResult = attemptRepair(healthCheck, true);
      
      if (repairResult.success) {
        dbLogger.info(
          LogCategory.INITIALIZATION,
          "Database repair completed successfully",
          {
            issuesFixed: repairResult.issuesFixed,
            backupPath: repairResult.backupPath,
          }
        );
      } else {
        dbLogger.error(
          LogCategory.INITIALIZATION,
          "Database repair failed",
          undefined,
          {
            issuesFixed: repairResult.issuesFixed,
            issuesRemaining: repairResult.issuesRemaining,
            message: repairResult.message,
          }
        );
        
        // Critical issues that couldn't be auto-fixed
        // In production, this would trigger the DatabaseErrorDialog
        // For now, we log the error and continue
        console.error("Database has critical issues:", repairResult.message);
      }
    }
  } else {
    dbLogger.info(LogCategory.INITIALIZATION, "Database health check passed");
  }
  
  // If database doesn't exist and we have a template, copy it
  // (health check may have already done this via repair)
  if (!fs.existsSync(dbPath)) {
    // Check for template database in resources (Electron packaged app)
    // resourcesPath is an Electron-specific property
    const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
    const templatePaths = [
      path.join(resourcesPath || "", "template.db"),
      path.join(__dirname, "..", "..", "prisma", "template.db"),
      path.join(process.cwd(), "prisma", "template.db"),
    ];
    
    for (const templatePath of templatePaths) {
      if (fs.existsSync(templatePath)) {
        fs.copyFileSync(templatePath, dbPath);
        dbLogger.info(
          LogCategory.INITIALIZATION,
          "Initialized database from template",
          { templatePath }
        );
        break;
      }
    }
  }
  
  // Apply any pending runtime schema migrations to existing databases
  if (fs.existsSync(dbPath)) {
    applyRuntimeMigrations(dbPath);
  }
  
  const adapter = new PrismaBetterSqlite3({ url: dbPath });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
