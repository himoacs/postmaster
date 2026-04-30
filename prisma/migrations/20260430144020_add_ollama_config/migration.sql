-- CreateTable
CREATE TABLE "OllamaConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL DEFAULT 'http://localhost:11434',
    "encryptedKey" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "cachedModels" TEXT NOT NULL DEFAULT '[]',
    "lastValidated" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
