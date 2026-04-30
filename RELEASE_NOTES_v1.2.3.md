# Release Notes - v1.2.3

**Release Date:** April 29, 2026

## 🔧 Bug Fixes

### Fixed: "Failed to delete generation" Error

**Problem:** Attempting to delete a generation that had synthesized content would fail with a database constraint error.

**Root Cause:** The `SynthesisContribution` table was missing a proper cascade delete relation to `SynthesizedContent`, causing orphaned records that blocked deletion.

**Fix:** Added the missing Prisma relation with `onDelete: Cascade` to properly clean up related records when a generation is deleted.

---

### Fixed: Knowledge Base Indicator Theme Inconsistency

**Problem:** The Knowledge Base indicator box used hardcoded blue colors that clashed with the warm terracotta/cream editorial theme.

**Fix:** Updated to use theme-aware CSS classes (`bg-muted`, `border-border`, `text-primary`) for consistent appearance across light and dark modes.

---

## 🛡️ Build Reliability Improvements

### Permanent Fix for Native Module Architecture Mismatch

**Problem:** Users on Apple Silicon Macs could intermittently get x86_64 builds of `better-sqlite3`, causing startup failures with "wrong architecture" errors. This happened because pnpm cached Electron-compiled binaries.

**Fix:** 
- Added `.npmrc` configuration to disable pnpm's native module caching (`side-effects-cache=false`, `prefer-built=false`)
- Updated rebuild script to backup and restore the Node.js build after Electron compilation, preventing cross-contamination

---

### Runtime Schema Migrations for Older Databases

Added automatic schema migration support for users upgrading from older versions. New columns (`sourceMap`, `enableCitations`, `enableEmojis`) are automatically added to existing databases without requiring manual migration.

---

## 🚀 Installation

Download the appropriate version for your system:
- **Apple Silicon (M1/M2/M3/M4):** PostMaster-1.2.3-arm64.dmg
- **Intel Mac:** PostMaster-1.2.3.dmg

---

## 📋 Full Changelog

- fix: prevent recurring better-sqlite3 architecture mismatch
- fix: SynthesisContribution cascade delete relation
- fix: Knowledge Base indicator theme colors  
- feat: runtime schema migrations for older databases
