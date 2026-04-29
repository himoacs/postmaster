-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prompt" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'BLOG_POST',
    "lengthPref" TEXT,
    "contentMode" TEXT NOT NULL DEFAULT 'new',
    "existingContent" TEXT,
    "selectedModels" TEXT NOT NULL,
    "yoloMode" BOOLEAN NOT NULL DEFAULT false,
    "references" TEXT NOT NULL DEFAULT '[]',
    "selectedKnowledge" TEXT NOT NULL DEFAULT '[]',
    "enableCitations" BOOLEAN NOT NULL DEFAULT false,
    "synthesisStrategy" TEXT NOT NULL DEFAULT 'basic',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Draft_updatedAt_idx" ON "Draft"("updatedAt");
