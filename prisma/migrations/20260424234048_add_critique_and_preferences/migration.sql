-- CreateTable
CREATE TABLE "GenerationCritique" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationId" TEXT NOT NULL,
    "fromProvider" TEXT NOT NULL,
    "fromModel" TEXT NOT NULL,
    "critiques" TEXT NOT NULL,
    "debateRound" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GenerationCritique_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "synthesisStrategy" TEXT NOT NULL DEFAULT 'basic',
    "debateMaxRounds" INTEGER NOT NULL DEFAULT 3,
    "showCritiqueDetails" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SynthesizedContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "strategy" TEXT NOT NULL DEFAULT 'basic',
    "version" INTEGER NOT NULL DEFAULT 1,
    "feedback" TEXT,
    "imageUrl" TEXT,
    "imagePrompt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SynthesizedContent_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SynthesizedContent" ("content", "createdAt", "feedback", "generationId", "id", "imagePrompt", "imageUrl", "updatedAt", "version") SELECT "content", "createdAt", "feedback", "generationId", "id", "imagePrompt", "imageUrl", "updatedAt", "version" FROM "SynthesizedContent";
DROP TABLE "SynthesizedContent";
ALTER TABLE "new_SynthesizedContent" RENAME TO "SynthesizedContent";
CREATE UNIQUE INDEX "SynthesizedContent_generationId_key" ON "SynthesizedContent"("generationId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "GenerationCritique_generationId_idx" ON "GenerationCritique"("generationId");

-- CreateIndex
CREATE INDEX "GenerationCritique_generationId_debateRound_idx" ON "GenerationCritique"("generationId", "debateRound");
