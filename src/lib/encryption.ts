import crypto from "crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { encryptionLogger } from "./logger";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Cache the derived key
let cachedKey: Buffer | null = null;

/**
 * Get or generate a machine-local encryption key.
 * For Electron apps, we generate a key file in the user data directory.
 * This provides local encryption without requiring environment variables.
 */
function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  
  // First check environment variable
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    encryptionLogger.debug("Using encryption key from environment variable");
    cachedKey = crypto.scryptSync(envKey, "postmaster-salt", 32);
    return cachedKey;
  }
  
  // For local-first apps, generate a machine-specific key
  // This key is stored alongside the database
  const dbUrl = process.env.DATABASE_URL || "";
  const dbPath = dbUrl.replace("file:", "");
  
  if (dbPath) {
    const keyPath = join(dirname(dbPath), ".postmaster-key");
    encryptionLogger.debug("Key file path", { keyPath });
    
    try {
      if (existsSync(keyPath)) {
        // Read existing key
        encryptionLogger.info("Loading existing encryption key");
        const storedKey = readFileSync(keyPath, "utf8").trim();
        cachedKey = crypto.scryptSync(storedKey, "postmaster-salt", 32);
        return cachedKey;
      } else {
        // Generate new key and save it
        encryptionLogger.info("Generating new encryption key", { keyPath });
        const newKey = crypto.randomBytes(32).toString("hex");
        mkdirSync(dirname(keyPath), { recursive: true });
        writeFileSync(keyPath, newKey, { mode: 0o600 }); // Owner read/write only
        cachedKey = crypto.scryptSync(newKey, "postmaster-salt", 32);
        return cachedKey;
      }
    } catch (error) {
      encryptionLogger.error("Error managing encryption key file", { keyPath, dbPath }, error);
      // Fall through to default key
    }
  } else {
    encryptionLogger.warn("No DATABASE_URL set, cannot determine key file location");
  }
  
  // Fallback: Use a deterministic key based on environment
  // This is less secure but ensures the app works
  encryptionLogger.warn("Using fallback encryption key - API keys may not persist across reinstalls");
  const fallbackSeed = `postmaster-local-${process.platform}-${process.arch}`;
  cachedKey = crypto.scryptSync(fallbackSeed, "postmaster-salt", 32);
  return cachedKey;
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns: iv:authTag:encryptedData (all base64)
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  // Combine iv:authTag:encrypted for storage
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * Decrypt a string encrypted with encrypt()
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const parts = encryptedData.split(":");

  if (parts.length !== 3) {
    encryptionLogger.error("Invalid encrypted data format", { partsCount: parts.length });
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const encrypted = parts[2];

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    // GCM authentication failures happen when keys don't match
    // (e.g., data encrypted in dev server, decrypted in packaged app)
    if (error instanceof Error && 
        (error.message.includes("Unsupported state") || 
         error.message.includes("unable to authenticate"))) {
      encryptionLogger.error("API key decryption failed - key mismatch", { 
        ivLength: iv.length, 
        authTagLength: authTag.length,
        encryptedLength: encrypted.length 
      }, error);
      throw new Error("API key decryption failed. Please re-enter your API key in Settings.");
    }
    encryptionLogger.error("Unexpected decryption error", undefined, error);
    throw error;
  }
}

/**
 * Mask an API key for display (show first 4 and last 4 characters)
 */
export function maskApiKey(key: string): string {
  if (key.length <= 12) {
    return "****";
  }
  return `${key.slice(0, 4)}${"*".repeat(Math.min(key.length - 8, 20))}${key.slice(-4)}`;
}
