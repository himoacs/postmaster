-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SynthesizedContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "reasoning" TEXT,
    "strategy" TEXT NOT NULL DEFAULT 'basic',
    "version" INTEGER NOT NULL DEFAULT 1,
    "feedback" TEXT,
    "imageUrl" TEXT,
    "imagePrompt" TEXT,
    "parentSynthesisId" TEXT,
    "globalVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SynthesizedContent_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SynthesizedContent_parentSynthesisId_fkey" FOREIGN KEY ("parentSynthesisId") REFERENCES "SynthesizedContent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SynthesizedContent" ("content", "createdAt", "feedback", "generationId", "id", "imagePrompt", "imageUrl", "reasoning", "strategy", "updatedAt", "version") SELECT "content", "createdAt", "feedback", "generationId", "id", "imagePrompt", "imageUrl", "reasoning", "strategy", "updatedAt", "version" FROM "SynthesizedContent";
DROP TABLE "SynthesizedContent";
ALTER TABLE "new_SynthesizedContent" RENAME TO "SynthesizedContent";
CREATE UNIQUE INDEX "SynthesizedContent_generationId_key" ON "SynthesizedContent"("generationId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
