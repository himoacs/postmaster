import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import fs from "fs";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

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
