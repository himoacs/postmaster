import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Schema migrations for existing databases
// Add new columns here as they're added to the schema
const SCHEMA_MIGRATIONS = [
  // Migration: Add sourceMap column to Generation (v1.2.3)
  {
    table: "Generation",
    column: "sourceMap",
    sql: "ALTER TABLE Generation ADD COLUMN sourceMap TEXT",
  },
  // Migration: Add enableCitations column to Generation (v1.2.3)
  {
    table: "Generation",
    column: "enableCitations",
    sql: "ALTER TABLE Generation ADD COLUMN enableCitations INTEGER DEFAULT 0",
  },
  // Migration: Add enableEmojis column to Generation (v1.2.3)
  {
    table: "Generation",
    column: "enableEmojis",
    sql: "ALTER TABLE Generation ADD COLUMN enableEmojis INTEGER DEFAULT 0",
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
  
  // If database doesn't exist and we have a template, copy it
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
        console.log(`Initialized database from template: ${templatePath}`);
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
