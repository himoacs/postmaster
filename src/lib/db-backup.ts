/**
 * Database Backup Utilities
 * 
 * Handles database backup creation, restoration, and management.
 * Backups are created before repair attempts to prevent data loss.
 */

import fs from "fs";
import path from "path";
import { dbLogger, LogCategory } from "./db-logger";

export interface BackupInfo {
  path: string;
  filename: string;
  timestamp: Date;
  size: number; // in bytes
}

/**
 * Get the database path from environment or default location
 */
function getDatabasePath(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL.replace(/^file:/, "");
  }
  return path.resolve(process.cwd(), "data", "postmaster.db");
}

/**
 * Create a backup of the database
 * 
 * @param reason - Reason for backup (e.g., "before_repair", "manual")
 * @returns Path to backup file
 */
export function createBackup(reason: string = "manual"): string | null {
  try {
    const dbPath = getDatabasePath();
    
    if (!fs.existsSync(dbPath)) {
      dbLogger.warn(LogCategory.BACKUP, "Database file does not exist, cannot create backup", {
        dbPath,
      });
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFilename = `postmaster.db.backup.${timestamp}.${reason}`;
    const backupPath = path.join(path.dirname(dbPath), backupFilename);

    // Copy database file
    fs.copyFileSync(dbPath, backupPath);

    const stats = fs.statSync(backupPath);
    dbLogger.info(LogCategory.BACKUP, "Database backup created", {
      backupPath,
      reason,
      size: stats.size,
    });

    return backupPath;
  } catch (err) {
    dbLogger.error(
      LogCategory.BACKUP,
      "Failed to create database backup",
      err as Error,
      { reason }
    );
    return null;
  }
}

/**
 * Restore database from a backup
 * 
 * @param backupPath - Path to backup file
 * @param createBackupBeforeRestore - Whether to backup current DB before restoring
 * @returns Success status
 */
export function restoreBackup(
  backupPath: string,
  createBackupBeforeRestore: boolean = true
): boolean {
  try {
    if (!fs.existsSync(backupPath)) {
      dbLogger.error(
        LogCategory.BACKUP,
        "Backup file does not exist",
        undefined,
        { backupPath }
      );
      return false;
    }

    const dbPath = getDatabasePath();

    // Optionally backup current database before restoring
    if (createBackupBeforeRestore && fs.existsSync(dbPath)) {
      createBackup("before_restore");
    }

    // Copy backup to database location
    fs.copyFileSync(backupPath, dbPath);

    dbLogger.info(LogCategory.BACKUP, "Database restored from backup", {
      backupPath,
      dbPath,
    });

    return true;
  } catch (err) {
    dbLogger.error(
      LogCategory.BACKUP,
      "Failed to restore database from backup",
      err as Error,
      { backupPath }
    );
    return false;
  }
}

/**
 * List all available backups
 * 
 * @returns Array of backup information, sorted by timestamp (newest first)
 */
export function listBackups(): BackupInfo[] {
  try {
    const dbPath = getDatabasePath();
    const dbDir = path.dirname(dbPath);

    if (!fs.existsSync(dbDir)) {
      return [];
    }

    const files = fs.readdirSync(dbDir);
    const backupFiles = files.filter((f) => f.startsWith("postmaster.db.backup."));

    const backups: BackupInfo[] = backupFiles.map((filename) => {
      const fullPath = path.join(dbDir, filename);
      const stats = fs.statSync(fullPath);
      
      // Extract timestamp from filename (format: postmaster.db.backup.YYYY-MM-DDTHH-MM-SS-mmmZ.reason)
      const timestampMatch = filename.match(/backup\.(.+?)\.[^.]+$/);
      const timestampStr = timestampMatch?.[1] || "";
      const timestamp = new Date(timestampStr.replace(/-/g, ":").replace("T", "T").replace("Z", ".000Z"));

      return {
        path: fullPath,
        filename,
        timestamp,
        size: stats.size,
      };
    });

    // Sort by timestamp, newest first
    backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return backups;
  } catch (err) {
    dbLogger.error(
      LogCategory.BACKUP,
      "Failed to list backups",
      err as Error
    );
    return [];
  }
}

/**
 * Delete a backup file
 * 
 * @param backupPath - Path to backup file to delete
 * @returns Success status
 */
export function deleteBackup(backupPath: string): boolean {
  try {
    if (!fs.existsSync(backupPath)) {
      dbLogger.warn(LogCategory.BACKUP, "Backup file does not exist", {
        backupPath,
      });
      return false;
    }

    fs.unlinkSync(backupPath);
    dbLogger.info(LogCategory.BACKUP, "Backup file deleted", { backupPath });
    return true;
  } catch (err) {
    dbLogger.error(
      LogCategory.BACKUP,
      "Failed to delete backup",
      err as Error,
      { backupPath }
    );
    return false;
  }
}

/**
 * Clean up old backups, keeping only the most recent N backups
 * 
 * @param keepCount - Number of most recent backups to keep
 * @returns Number of backups deleted
 */
export function cleanupOldBackups(keepCount: number = 5): number {
  try {
    const backups = listBackups();

    if (backups.length <= keepCount) {
      return 0;
    }

    const backupsToDelete = backups.slice(keepCount);
    let deletedCount = 0;

    for (const backup of backupsToDelete) {
      if (deleteBackup(backup.path)) {
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      dbLogger.info(LogCategory.BACKUP, "Cleaned up old backups", {
        deletedCount,
        remainingCount: backups.length - deletedCount,
      });
    }

    return deletedCount;
  } catch (err) {
    dbLogger.error(
      LogCategory.BACKUP,
      "Failed to cleanup old backups",
      err as Error
    );
    return 0;
  }
}

/**
 * Export database to a user-selected location
 * 
 * @param destinationPath - Full path where to export the database
 * @returns Success status
 */
export function exportDatabase(destinationPath: string): boolean {
  try {
    const dbPath = getDatabasePath();

    if (!fs.existsSync(dbPath)) {
      dbLogger.error(
        LogCategory.BACKUP,
        "Cannot export: database file does not exist",
        undefined,
        { dbPath }
      );
      return false;
    }

    // Ensure destination directory exists
    const destDir = path.dirname(destinationPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.copyFileSync(dbPath, destinationPath);

    dbLogger.info(LogCategory.BACKUP, "Database exported", {
      dbPath,
      destinationPath,
    });

    return true;
  } catch (err) {
    dbLogger.error(
      LogCategory.BACKUP,
      "Failed to export database",
      err as Error,
      { destinationPath }
    );
    return false;
  }
}

/**
 * Get total size of all backups
 * 
 * @returns Total size in bytes
 */
export function getTotalBackupSize(): number {
  const backups = listBackups();
  return backups.reduce((total, backup) => total + backup.size, 0);
}

/**
 * Format bytes to human-readable size
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
