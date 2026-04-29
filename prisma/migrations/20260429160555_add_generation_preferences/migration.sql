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
    "enableCitations" BOOLEAN NOT NULL DEFAULT false,
    "enableEmojis" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Generation" ("contentMode", "contentType", "createdAt", "id", "lengthPref", "prompt", "sourceContent", "sourceMap", "status", "styleContext", "updatedAt") SELECT "contentMode", "contentType", "createdAt", "id", "lengthPref", "prompt", "sourceContent", "sourceMap", "status", "styleContext", "updatedAt" FROM "Generation";
DROP TABLE "Generation";
ALTER TABLE "new_Generation" RENAME TO "Generation";
CREATE INDEX "Generation_createdAt_idx" ON "Generation"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
