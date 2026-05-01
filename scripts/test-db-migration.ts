#!/usr/bin/env ts-node
/**
 * Database Migration Test Script
 * 
 * Tests that old databases can be successfully migrated to the current schema.
 * Run this before releasing a new version to ensure backward compatibility.
 * 
 * Usage:
 *   pnpm tsx scripts/test-db-migration.ts
 *   pnpm tsx scripts/test-db-migration.ts --from-version 1.2.3
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { runHealthCheck, HealthCheckStatus } from "../src/lib/db-health-check";
import { attemptRepair } from "../src/lib/db-repair";

const TEST_DB_PATH = path.join(__dirname, "..", "test", "data", "migration-test.db");

/**
 * Create a minimal v1.2.3 style database (before SchemaVersion and enabledModels)
 */
function createOldStyleDatabase(dbPath: string): void {
  // Remove if exists
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Create tables matching v1.2.3 schema (WITHOUT SchemaVersion and enabledModels)
  db.exec(`
    -- _prisma_migrations table
    CREATE TABLE "_prisma_migrations" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
    );

    -- APIKey table (OLD schema - no enabledModels)
    CREATE TABLE "APIKey" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "provider" TEXT NOT NULL,
      "encryptedKey" TEXT NOT NULL,
      "isValid" INTEGER NOT NULL DEFAULT 0,
      "validModels" TEXT NOT NULL DEFAULT '[]',
      "lastValidated" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );
    CREATE UNIQUE INDEX "APIKey_provider_key" ON "APIKey"("provider");

    -- LiteLLMConfig table (OLD schema - no enabledModels)
    CREATE TABLE "LiteLLMConfig" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "endpoint" TEXT NOT NULL,
      "encryptedKey" TEXT,
      "isEnabled" INTEGER NOT NULL DEFAULT 1,
      "isValid" INTEGER NOT NULL DEFAULT 0,
      "cachedModels" TEXT NOT NULL DEFAULT '[]',
      "lastValidated" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );
    CREATE UNIQUE INDEX "LiteLLMConfig_endpoint_key" ON "LiteLLMConfig"("endpoint");

    -- OllamaConfig table (OLD schema - no enabledModels)  
    CREATE TABLE "OllamaConfig" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "endpoint" TEXT NOT NULL,
      "encryptedKey" TEXT,
      "isEnabled" INTEGER NOT NULL DEFAULT 1,
      "isValid" INTEGER NOT NULL DEFAULT 0,
      "cachedModels" TEXT NOT NULL DEFAULT '[]',
      "lastValidated" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );
    CREATE UNIQUE INDEX "OllamaConfig_endpoint_key" ON "OllamaConfig"("endpoint");

    -- StyleProfile table
    CREATE TABLE "StyleProfile" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "tone" TEXT,
      "voice" TEXT,
      "vocabulary" TEXT,
      "sentence" TEXT,
      "formality" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );

    -- ContentSample table
    CREATE TABLE "ContentSample" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "profileId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'BLOG_POST',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("profileId") REFERENCES "StyleProfile"("id") ON DELETE CASCADE
    );

    -- Generation table
    CREATE TABLE "Generation" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "prompt" TEXT NOT NULL,
      "contentType" TEXT NOT NULL DEFAULT 'BLOG_POST',
      "lengthPref" TEXT,
      "contentMode" TEXT NOT NULL DEFAULT 'new',
      "existingContent" TEXT,
      "selectedModels" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "yoloMode" INTEGER NOT NULL DEFAULT 0,
      "references" TEXT NOT NULL DEFAULT '[]',
      "selectedKnowledge" TEXT NOT NULL DEFAULT '[]',
      "enableCitations" INTEGER NOT NULL DEFAULT 0,
      "sourceMap" TEXT,
      "synthesisStrategy" TEXT NOT NULL DEFAULT 'basic',
      "primaryModelProvider" TEXT,
      "primaryModelId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );

    -- GenerationOutput table
    CREATE TABLE "GenerationOutput" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "generationId" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "model" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "error" TEXT,
      "tokensUsed" INTEGER,
      "latencyMs" INTEGER,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE CASCADE
    );

    -- SynthesizedContent table
    CREATE TABLE "SynthesizedContent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "generationId" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "strategy" TEXT NOT NULL DEFAULT 'basic',
      "reasoning" TEXT,
      "feedback" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE CASCADE
    );

    -- UserPreferences table
    CREATE TABLE "UserPreferences" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "defaultContentType" TEXT NOT NULL DEFAULT 'BLOG_POST',
      "defaultLength" TEXT,
      "autoSave" INTEGER NOT NULL DEFAULT 1,
      "enableYoloMode" INTEGER NOT NULL DEFAULT 0,
      "theme" TEXT NOT NULL DEFAULT 'system',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );

    -- Add other required tables
    CREATE TABLE "GenerationCritique" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "generationId" TEXT NOT NULL,
      "outputId" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "rating" INTEGER,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE "ModelAnalytics" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "provider" TEXT NOT NULL,
      "model" TEXT NOT NULL,
      "totalRequests" INTEGER NOT NULL DEFAULT 0,
      "totalTokens" INTEGER NOT NULL DEFAULT 0,
      "totalLatencyMs" INTEGER NOT NULL DEFAULT 0,
      "successCount" INTEGER NOT NULL DEFAULT 0,
      "errorCount" INTEGER NOT NULL DEFAULT 0,
      "lastUsed" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );

    CREATE TABLE "SynthesisContribution" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "synthesisId" TEXT NOT NULL,
      "generationId" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "model" TEXT NOT NULL,
      "aspectCount" INTEGER NOT NULL DEFAULT 0,
      "totalAspects" INTEGER NOT NULL DEFAULT 0,
      "aspectTypes" TEXT NOT NULL DEFAULT '[]',
      "starredCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE "SynthesisVersion" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "synthesizedContentId" TEXT NOT NULL,
      "version" INTEGER NOT NULL,
      "content" TEXT NOT NULL,
      "reasoning" TEXT,
      "feedback" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE "Draft" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "prompt" TEXT NOT NULL,
      "contentType" TEXT NOT NULL DEFAULT 'BLOG_POST',
      "lengthPref" TEXT,
      "contentMode" TEXT NOT NULL DEFAULT 'new',
      "existingContent" TEXT,
      "selectedModels" TEXT NOT NULL,
      "yoloMode" INTEGER NOT NULL DEFAULT 0,
      "references" TEXT NOT NULL DEFAULT '[]',
      "selectedKnowledge" TEXT NOT NULL DEFAULT '[]',
      "enableCitations" INTEGER NOT NULL DEFAULT 0,
      "synthesisStrategy" TEXT NOT NULL DEFAULT 'basic',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );

    CREATE TABLE "KnowledgeEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "source" TEXT NOT NULL,
      "mimeType" TEXT,
      "summary" TEXT,
      "content" TEXT NOT NULL,
      "metadata" TEXT NOT NULL DEFAULT '{}',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );

    -- Insert a mock migration record
    INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
    VALUES ('test-id', 'test-checksum', strftime('%s','now') * 1000, '20260429160555_add_generation_preferences', strftime('%s','now') * 1000, 1);
  `);

  db.close();
  console.log(`✓ Created old-style database at ${dbPath}`);
}

/**
 * Run the migration test
 */
async function runMigrationTest(): Promise<void> {
  console.log("=== Database Migration Test ===\n");

  // Step 1: Create old-style database
  console.log("Step 1: Creating old-style database (v1.2.3 schema)...");
  createOldStyleDatabase(TEST_DB_PATH);

  // Step 2: Set environment to point to test database
  process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;

  // Step 3: Run health check
  console.log("\nStep 2: Running health check on old database...");
  const healthCheck = runHealthCheck();
  
  console.log(`  Status: ${healthCheck.status}`);
  console.log(`  Issues found: ${healthCheck.issues.length}`);
  
  if (healthCheck.issues.length > 0) {
    console.log("  Issues:");
    for (const issue of healthCheck.issues) {
      console.log(`    - [${issue.severity}] ${issue.message} (autoFixable: ${issue.autoFixable})`);
    }
  }

  // Step 4: Attempt repair
  if (healthCheck.status !== HealthCheckStatus.HEALTHY) {
    console.log("\nStep 3: Attempting automatic repair...");
    const repairResult = attemptRepair(healthCheck, false);
    
    console.log(`  Success: ${repairResult.success}`);
    console.log(`  Issues fixed: ${repairResult.issuesFixed}`);
    console.log(`  Issues remaining: ${repairResult.issuesRemaining}`);
    
    if (repairResult.actions.length > 0) {
      console.log("  Actions:");
      for (const action of repairResult.actions) {
        const status = action.success ? "✓" : "✗";
        console.log(`    ${status} ${action.description}`);
        if (action.error) {
          console.log(`      Error: ${action.error}`);
        }
      }
    }

    // Step 5: Verify final state
    console.log("\nStep 4: Verifying final database state...");
    const finalHealth = repairResult.healthCheckAfter || runHealthCheck();
    
    console.log(`  Final status: ${finalHealth.status}`);
    
    if (finalHealth.status === HealthCheckStatus.HEALTHY) {
      console.log("\n✅ MIGRATION TEST PASSED");
      console.log("   Old databases can be successfully migrated to current schema.");
    } else {
      console.log("\n❌ MIGRATION TEST FAILED");
      console.log("   Old databases cannot be fully migrated. Issues:");
      for (const issue of finalHealth.issues) {
        console.log(`   - [${issue.severity}] ${issue.message}`);
      }
      process.exit(1);
    }
  } else {
    console.log("\n✅ Database already healthy (no migration needed)");
  }

  // Cleanup
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
    console.log(`\nCleaned up test database: ${TEST_DB_PATH}`);
  }
}

// Run the test
runMigrationTest().catch((err) => {
  console.error("Migration test failed with error:", err);
  process.exit(1);
});
