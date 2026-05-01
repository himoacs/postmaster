-- CreateTable
CREATE TABLE "SchemaVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "SchemaVersion_version_idx" ON "SchemaVersion"("version");

-- CreateIndex
CREATE INDEX "SchemaVersion_appliedAt_idx" ON "SchemaVersion"("appliedAt");
