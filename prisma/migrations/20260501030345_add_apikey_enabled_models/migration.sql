-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_APIKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "validModels" TEXT NOT NULL DEFAULT '[]',
    "enabledModels" TEXT NOT NULL DEFAULT '[]',
    "lastValidated" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_APIKey" ("createdAt", "encryptedKey", "id", "isValid", "lastValidated", "provider", "updatedAt", "validModels") SELECT "createdAt", "encryptedKey", "id", "isValid", "lastValidated", "provider", "updatedAt", "validModels" FROM "APIKey";
DROP TABLE "APIKey";
ALTER TABLE "new_APIKey" RENAME TO "APIKey";
CREATE UNIQUE INDEX "APIKey_provider_key" ON "APIKey"("provider");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
