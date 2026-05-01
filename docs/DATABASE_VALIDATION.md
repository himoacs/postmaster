# Database Schema Validation & Recovery System

## Overview

PostMaster now includes a comprehensive database validation and recovery system that automatically detects and fixes common database issues. This prevents users from encountering cryptic errors and provides clear recovery paths when problems occur.

## Architecture

### Core Components

1. **Schema Manifest** ([src/lib/db-schema-manifest.ts](src/lib/db-schema-manifest.ts))
   - Defines the expected database structure (19 tables, all columns)
   - Used for validation checks to ensure schema completeness
   - Current version: 1.2.4

2. **Database Logger** ([src/lib/db-logger.ts](src/lib/db-logger.ts))
   - Structured logging to `logs/database-{date}.log` in user data directory
   - Categorized by operation type (validation, repair, backup, migration, health check)
   - Auto-cleanup of old logs (keeps 30 days)
   - JSON format for easy parsing

3. **Backup System** ([src/lib/db-backup.ts](src/lib/db-backup.ts))
   - Automatic backups before repair attempts
   - Restore from backup functionality
   - Backup management (list, delete, export to custom location)
   - Auto-cleanup (keeps last 5 backups)
   - Filenames: `postmaster.db.backup.{timestamp}.{reason}`

4. **Health Check** ([src/lib/db-health-check.ts](src/lib/db-health-check.ts))
   - Validates native module (better-sqlite3) loads correctly
   - Checks database file exists and is accessible
   - Runs SQLite integrity check (`PRAGMA integrity_check`)
   - Validates schema completeness (all expected tables/columns)
   - Checks schema version matches expected version
   - Returns status: HEALTHY, WARNING, or CRITICAL

5. **Automatic Repair** ([src/lib/db-repair.ts](src/lib/db-repair.ts))
   - Fixes missing columns (adds via `ALTER TABLE`)
   - Creates missing database from template
   - Updates schema version tracking
   - Attempts corruption recovery via backup restore
   - Reset to fresh database option

6. **Runtime Integration** ([src/lib/db.ts](src/lib/db.ts))
   - Health check runs automatically on app startup
   - Automatic repair for auto-fixable issues
   - Creates backup before repair attempts
   - Detailed logging of all operations
   - Graceful degradation if critical issues found

7. **Schema Version Tracking** ([prisma/schema.prisma](prisma/schema.prisma))
   - New `SchemaVersion` model tracks applied migrations
   - Runtime migration system now records migration state
   - Provides migration history for debugging
   - Enables idempotent migrations (won't re-apply same migration)

## How It Works

### At Build Time

1. Pre-release checks validate `prisma/template.db`:
   - Checks file exists and isn't corrupted
   - Verifies all 16 expected tables are present
   - Runs SQLite integrity check
   - Ensures schema is valid before distribution

### At App Startup

1. **Health Check** runs automatically:
   ```
   Database initialization detected → Run health check
                                           ↓
                               Check native module loads?
                                           ↓
                               Check database exists?
                                           ↓
                               Check database accessible?
                                           ↓
                               Run integrity check
                                           ↓
                               Validate schema completeness
                                           ↓
                               Check schema version
   ```

2. **Auto-Repair** if issues detected:
   ```
   Issues found → Categorize (auto-fixable vs. critical)
                            ↓
                  Create backup (before_repair)
                            ↓
              Auto-fixable? → Apply fixes
                 ↓                    ↓
           Critical → Show          Success
           error UI    dialog         ↓
                                 Run health
                                 check again
   ```

3. **Error Recovery** for unfixable issues:
   - Shows user-friendly DatabaseErrorDialog
   - Provides recovery options:
     - **Retry**: Re-run validation and repair
     - **Restore Backup**: Restore from most recent backup
     - **Reset Database**: Start fresh with template (loses all data)
     - **View Details**: See technical error information

### API Endpoints

- `GET /api/health` - Returns database health status and backup info
- `GET /api/health?quick=true` - Quick health check (basic connectivity only)
- `POST /api/health/repair` - Manually trigger repair attempt
  - Body: `{ createBackup: boolean }` (default: true)

## What Gets Auto-Fixed

### ✅ Auto-Fixable Issues

1. **Missing Columns** (e.g., upgrading from v1.2.3 → v1.2.4)
   - Adds columns via `ALTER TABLE`
   - Examples: `enabledModels`, `sourceMap`, `enableCitations`, `enableEmojis`
   - Backup created before changes

2. **Schema Version Mismatch**
   - Updates SchemaVersion table to record current version
   - Tracks migration history

3. **Missing Database File**
   - Copies from `prisma/template.db`
   - Fresh database with complete schema

### ⚠️ Requires User Action

1. **Database Corruption**
   - Attempts to restore from most recent backup
   - If no backup, user must reset to fresh state (loses data)

2. **Native Module Failure** (better-sqlite3)
   - Usually requires app restart or reinstall
   - Indicates ABI compatibility issue

3. **Missing Tables**
   - Cannot auto-fix (requires full migration or reset)
   - User must reset database or restore backup

## Important: Prisma Migrations vs. Runtime Migrations

### Prisma Migrations (NOT auto-applied at runtime)

- **What**: Full schema migrations managed by Prisma CLI
- **When**: Applied during build to `prisma/template.db`
- **How**: `prisma migrate deploy` (run by developers)
- **Example**: Creating new tables, adding foreign keys, changing column types

### Runtime Migrations (auto-applied at startup)

- **What**: Simple column additions for backward compatibility
- **When**: Applied at app startup if column missing
- **How**: Direct `ALTER TABLE` SQL commands
- **Example**: Adding `enabledModels` column to existing `APIKey` table

**Why this distinction?**
- Template database ships with all Prisma migrations already applied
- Users never run `prisma migrate` themselves (it's an Electron desktop app)
- Runtime migrations only handle simple columns for users upgrading from older versions

## Schema Version Tracking

### How It Works

1. **SchemaVersion Table**:
   ```sql
   CREATE TABLE SchemaVersion (
     id TEXT PRIMARY KEY,
     version TEXT NOT NULL,         -- Migration ID or app version
     description TEXT NOT NULL,      -- Human-readable description
     appliedAt INTEGER NOT NULL      -- Unix timestamp
   )
   ```

2. **Runtime Migration Tracking**:
   - Each migration in `SCHEMA_MIGRATIONS` array has unique ID
   - Before applying, checks if already recorded in SchemaVersion
   - After applying, records migration with timestamp
   - Idempotent: won't re-apply same migration

3. **Migration IDs**:
   - Format: `migration_{table}_{column}` or `migration_add_{table}_table`
   - Example: `migration_generation_sourcemap`, `migration_add_schemaversion_table`

## Logging

### Log Location

- **Production**: `~/Library/Application Support/PostMaster/logs/database-{date}.log` (macOS)
- **Development**: `./data/logs/database-{date}.log`

### Log Format

JSON lines format:
```json
{
  "timestamp": "2026-04-30T10:30:45.123Z",
  "level": "ERROR",
  "category": "REPAIR",
  "message": "Failed to repair missing column",
  "details": {
    "table": "Generation",
    "column": "sourceMap"
  },
  "error": {
    "name": "SQLiteError",
    "message": "table Generation has no column named sourceMap",
    "stack": "..."
  }
}
```

### Log Categories

- `INITIALIZATION` - Database startup and setup
- `VALIDATION` - Health checks and schema validation
- `MIGRATION` - Runtime migration application
- `REPAIR` - Automatic repair attempts
- `BACKUP` - Backup creation, restoration, cleanup
- `HEALTH_CHECK` - Health check results
- `ERROR` - General errors

### Log Levels

- `DEBUG` - Detailed information for debugging
- `INFO` - General informational messages
- `WARN` - Warnings that don't prevent operation
- `ERROR` - Errors that require attention

## Backup System

### Backup Naming Convention

```
postmaster.db.backup.{timestamp}.{reason}
```

Examples:
- `postmaster.db.backup.2026-04-30T10-30-45-123Z.before_repair`
- `postmaster.db.backup.2026-04-30T11-15-22-456Z.before_restore`
- `postmaster.db.backup.2026-04-30T14-22-33-789Z.manual`

### Backup Management

- **Automatic cleanup**: Keeps only last 5 backups (configurable)
- **Manual backup**: Available via health API or error dialog
- **Export**: Can export database to custom location
- **Restore**: One-click restore from backup list

### Storage Location

Same directory as database:
- **Production**: `~/Library/Application Support/PostMaster/`
- **Development**: `./data/`

## Error Recovery UI

### DatabaseErrorDialog Component

Located: [src/components/DatabaseErrorDialog.tsx](src/components/DatabaseErrorDialog.tsx)

**Features**:
- User-friendly error messages (no technical jargon by default)
- Issue categorization (critical errors vs. warnings)
- Auto-fixable indicator for each issue
- Collapsible technical details
- Recovery actions:
  - **Retry / Auto-Repair**: Attempts automatic fix
  - **Restore Backup**: Shows available backups to restore from
  - **Reset Database**: Fresh start (warns about data loss)
  - **Close**: Dismiss (if non-critical)

**When Shown**:
- Critical database issues that prevent app startup
- Issues that couldn't be auto-fixed
- User-requested via settings or health check page

## Build Validation

### Pre-Release Checks

Script: [scripts/pre-release-checks.js](scripts/pre-release-checks.js)

**Database Validation** (new):
1. Checks `prisma/template.db` exists
2. Verifies file size > 1KB (not empty)
3. Validates all 16 expected tables present
4. Runs `PRAGMA integrity_check` on template
5. **Fails build** if any check fails

**Why Important**:
- Prevents shipping corrupted or incomplete template database
- Catches schema issues before distribution
- Ensures all users get valid starting database

## Testing

### Manual Testing

1. **Test missing column detection**:
   ```bash
   # Remove a column from your dev database
   sqlite3 data/postmaster.db "ALTER TABLE Generation DROP COLUMN sourceMap"
   
   # Start app - should detect and fix automatically
   pnpm electron:dev
   
   # Check logs
   cat data/logs/database-*.log | grep sourceMap
   ```

2. **Test corruption recovery**:
   ```bash
   # Corrupt the database
   echo "corrupted" >> data/postmaster.db
   
   # Start app - should detect corruption and offer restore
   pnpm electron:dev
   ```

3. **Test fresh install**:
   ```bash
   # Remove database
   rm data/postmaster.db
   
   # Start app - should copy from template
   pnpm electron:dev
   ```

### Unit Tests

TODO: Add unit tests for:
- `db-health-check.ts` - Schema validation logic
- `db-repair.ts` - Repair logic with various failure scenarios
- `db-backup.ts` - Backup creation and restoration
- `db-logger.ts` - Log formatting and cleanup

Test files to create:
- `test/unit/db-health-check.test.ts`
- `test/unit/db-repair.test.ts`
- `test/unit/db-backup.test.ts`

## Migration Guide for Developers

### Adding a New Column

1. **Update Prisma Schema**:
   ```prisma
   model Generation {
     // ... existing fields
     newField String? // New field
   }
   ```

2. **Generate Migration**:
   ```bash
   pnpm prisma migrate dev --name add_new_field
   ```

3. **Add Runtime Migration** (for backward compatibility):
   ```typescript
   // In src/lib/db.ts SCHEMA_MIGRATIONS array
   {
     id: "migration_generation_newfield",
     table: "Generation",
     column: "newField",
     sql: "ALTER TABLE Generation ADD COLUMN newField TEXT",
     description: "Add newField column to Generation table",
     version: "1.2.5",
   }
   ```

4. **Update Template Database**:
   ```bash
   # Apply migration to template
   rm prisma/template.db
   pnpm prisma migrate deploy
   cp data/postmaster.db prisma/template.db
   ```

5. **Update Schema Manifest**:
   ```typescript
   // In src/lib/db-schema-manifest.ts
   export const CURRENT_SCHEMA_VERSION = "1.2.5";
   
   // Add to Generation table columns array
   { name: "newField", type: "TEXT", nullable: true }
   ```

6. **Test**:
   - Build app and verify pre-release checks pass
   - Test with old database (should auto-add column)
   - Test with fresh install (should have column already)

## Troubleshooting

### Issue: "Native module failed to load"

**Cause**: better-sqlite3 compiled for wrong Node.js version

**Solution**:
```bash
pnpm rebuild:electron
pnpm electron:rebuild-standalone
```

### Issue: "Database corruption detected"

**Cause**: File corruption, disk full, or improper shutdown

**Solution**:
1. Try "Restore Backup" in error dialog
2. If no backup, "Reset Database" (loses data)
3. Check disk space and file permissions

### Issue: "Missing table: SchemaVersion"

**Cause**: Very old database (pre-v1.2.4)

**Solution**: Runtime migrations will create table automatically

### Issue: "Schema version mismatch"

**Cause**: User upgraded from old version

**Solution**: Automatic - runtime migrations update version

## Future Improvements

1. **Telemetry** (optional, opt-in)
   - Anonymous error reporting
   - Help identify common issues
   - Prioritize fixes based on real data

2. **Schema Migration Preview**
   - Show users what changes will be applied
   - Useful for major version upgrades
   - Currently not implemented

3. **Database Optimization**
   - Run `VACUUM` and `ANALYZE` periodically
   - Improves query performance over time
   - Could add to health check system

4. **Cloud Backup** (future consideration)
   - Optional cloud sync for backups
   - Would require user account system
   - Privacy considerations

## Support

For issues or questions:
- GitHub Issues: https://github.com/himoacs/postmaster/issues
- Include database log file when reporting issues
- Location: `~/Library/Application Support/PostMaster/logs/database-*.log`
