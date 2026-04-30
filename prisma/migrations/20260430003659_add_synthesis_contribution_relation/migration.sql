-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SynthesisContribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "synthesisId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "aspectCount" INTEGER NOT NULL DEFAULT 0,
    "totalAspects" INTEGER NOT NULL DEFAULT 0,
    "aspectTypes" TEXT NOT NULL DEFAULT '[]',
    "starredCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SynthesisContribution_synthesisId_fkey" FOREIGN KEY ("synthesisId") REFERENCES "SynthesizedContent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SynthesisContribution" ("aspectCount", "aspectTypes", "createdAt", "generationId", "id", "model", "provider", "starredCount", "synthesisId", "totalAspects") SELECT "aspectCount", "aspectTypes", "createdAt", "generationId", "id", "model", "provider", "starredCount", "synthesisId", "totalAspects" FROM "SynthesisContribution";
DROP TABLE "SynthesisContribution";
ALTER TABLE "new_SynthesisContribution" RENAME TO "SynthesisContribution";
CREATE INDEX "SynthesisContribution_synthesisId_idx" ON "SynthesisContribution"("synthesisId");
CREATE INDEX "SynthesisContribution_provider_model_idx" ON "SynthesisContribution"("provider", "model");
CREATE INDEX "SynthesisContribution_generationId_idx" ON "SynthesisContribution"("generationId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
