-- CreateTable
CREATE TABLE "ModelAnalytics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "totalRuns" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "totalLatencyMs" INTEGER NOT NULL DEFAULT 0,
    "avgRating" REAL,
    "lastUsed" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SynthesisVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "synthesizedContentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "feedback" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SynthesisVersion_synthesizedContentId_fkey" FOREIGN KEY ("synthesizedContentId") REFERENCES "SynthesizedContent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ModelAnalytics_provider_modelId_key" ON "ModelAnalytics"("provider", "modelId");

-- CreateIndex
CREATE INDEX "SynthesisVersion_synthesizedContentId_idx" ON "SynthesisVersion"("synthesizedContentId");

-- CreateIndex
CREATE UNIQUE INDEX "SynthesisVersion_synthesizedContentId_version_key" ON "SynthesisVersion"("synthesizedContentId", "version");
