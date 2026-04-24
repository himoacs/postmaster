-- CreateTable
CREATE TABLE "LiteLLMConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "encryptedKey" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "cachedModels" TEXT NOT NULL DEFAULT '[]',
    "lastValidated" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
