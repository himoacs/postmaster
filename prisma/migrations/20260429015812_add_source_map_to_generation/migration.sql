-- AlterTable
ALTER TABLE "StyleProfile" ADD COLUMN "avoidPatterns" TEXT;
ALTER TABLE "StyleProfile" ADD COLUMN "closingStyles" TEXT;
ALTER TABLE "StyleProfile" ADD COLUMN "openingStyles" TEXT;
ALTER TABLE "StyleProfile" ADD COLUMN "sampleExcerpts" TEXT;
ALTER TABLE "StyleProfile" ADD COLUMN "uniqueVocabulary" TEXT;
ALTER TABLE "StyleProfile" ADD COLUMN "writingQuirks" TEXT;

-- CreateTable
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

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Generation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prompt" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'BLOG_POST',
    "lengthPref" TEXT,
    "styleContext" TEXT,
    "contentMode" TEXT NOT NULL DEFAULT 'new',
    "sourceContent" TEXT,
    "sourceMap" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Generation" ("contentType", "createdAt", "id", "lengthPref", "prompt", "status", "styleContext", "updatedAt") SELECT "contentType", "createdAt", "id", "lengthPref", "prompt", "status", "styleContext", "updatedAt" FROM "Generation";
DROP TABLE "Generation";
ALTER TABLE "new_Generation" RENAME TO "Generation";
CREATE INDEX "Generation_createdAt_idx" ON "Generation"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SynthesisContribution_synthesisId_idx" ON "SynthesisContribution"("synthesisId");

-- CreateIndex
CREATE INDEX "SynthesisContribution_provider_model_idx" ON "SynthesisContribution"("provider", "model");

-- CreateIndex
CREATE INDEX "SynthesisContribution_generationId_idx" ON "SynthesisContribution"("generationId");
