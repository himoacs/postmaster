-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LiteLLMConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "encryptedKey" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "cachedModels" TEXT NOT NULL DEFAULT '[]',
    "enabledModels" TEXT NOT NULL DEFAULT '[]',
    "lastValidated" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_LiteLLMConfig" ("cachedModels", "createdAt", "encryptedKey", "endpoint", "id", "isEnabled", "isValid", "lastValidated", "updatedAt") SELECT "cachedModels", "createdAt", "encryptedKey", "endpoint", "id", "isEnabled", "isValid", "lastValidated", "updatedAt" FROM "LiteLLMConfig";
DROP TABLE "LiteLLMConfig";
ALTER TABLE "new_LiteLLMConfig" RENAME TO "LiteLLMConfig";
CREATE TABLE "new_OllamaConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL DEFAULT 'http://localhost:11434',
    "encryptedKey" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "cachedModels" TEXT NOT NULL DEFAULT '[]',
    "enabledModels" TEXT NOT NULL DEFAULT '[]',
    "lastValidated" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_OllamaConfig" ("cachedModels", "createdAt", "encryptedKey", "endpoint", "id", "isEnabled", "isValid", "lastValidated", "updatedAt") SELECT "cachedModels", "createdAt", "encryptedKey", "endpoint", "id", "isEnabled", "isValid", "lastValidated", "updatedAt" FROM "OllamaConfig";
DROP TABLE "OllamaConfig";
ALTER TABLE "new_OllamaConfig" RENAME TO "OllamaConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
