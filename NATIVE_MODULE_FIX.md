# Native Module Fix for "Server Error" Issue

## Problem Summary

Users running the distributed macOS app see:
```
This page couldn't load
A server error occurred. Reload to try again.
ERROR 843696988
```

**Root Cause**: The `better-sqlite3` native module (`.node` binary) was compiled for the developer's Node.js version (v24.1.0), but needs to be compiled for Electron's internal Node.js version (v22.x for Electron v36). This causes a `NODE_MODULE_VERSION` mismatch when users launch the app.

## Technical Details

- **Your System**: Node.js v24.1.0 → NODE_MODULE_VERSION 137
- **Electron v36**: Uses Node.js v22.x → NODE_MODULE_VERSION 135
- **Error**: `ERR_DLOPEN_FAILED` - Native module version mismatch

When the embedded Next.js server starts, Prisma tries to load `better-sqlite3.node`, which fails due to the version mismatch. All database operations fail, causing the "server error" page.

## Solution Implemented

### 1. Added Electron-specific rebuild script

**package.json** now includes:
```json
{
  "rebuild:electron": "npx electron-rebuild -f -w better-sqlite3"
}
```

This rebuilds native modules using Electron's Node.js headers instead of system Node.js.

### 2. Updated build workflow

All `electron:build:*` scripts now:
1. **First**: Run `rebuild:electron` to compile for Electron
2. **Then**: Build Next.js (copies Electron-compatible binaries)
3. **Finally**: Package the app

### 3. Added build verification

**scripts/after-pack.js** now checks for `better-sqlite3.node` and warns if missing.

### 4. Updated documentation

**BUILD_CHECKLIST.md** now includes troubleshooting for this specific issue.

## What You Need to Do

### Immediate Fix

Build a new release with the corrected workflow:

```bash
# 1. Pull the latest changes (with the fixes above)
git pull

# 2. Build for macOS using the updated script
pnpm electron:build:mac

# 3. Verify the build output shows:
#    "✓ Found better-sqlite3.node"
#    If you see a warning, the native module is missing!

# 4. Test the built app before distributing
open dist/mac-arm64/PostMaster.app
```

### For Users Currently Experiencing Issues

Users running affected versions (v1.1.0, v1.2.0, v1.2.1) should:

1. **Download and install the new release** (once you publish v1.2.2 with this fix)
2. The auto-updater should prompt them automatically

### Optional: Quick Test Without Full Build

To verify the fix works locally:

```bash
# Rebuild for Electron
pnpm rebuild:electron

# Start in dev mode
pnpm electron:dev

# The app should now launch without database errors
```

## Release Notes for v1.2.2

Suggested release notes:

```markdown
## Critical Bug Fix

- **Fixed**: "Server error" on launch for users with different Node.js configurations
- Fixed native module compilation to match Electron's Node.js version
- Added build verification to prevent future native module issues

This release fixes a critical issue where the app would fail to start on some systems
due to a native module version mismatch. All users should update to this version.
```

## Prevention for Future

- **Always use** `pnpm electron:build:mac` (not manual steps)
- **Never** manually rebuild with `npm rebuild` before Electron builds
- **Verify** after-pack output shows "✓ Found better-sqlite3.node"
- **Test** built app on a clean macOS system before public release

## Files Modified

- `package.json` - Updated build scripts
- `scripts/fix-standalone.js` - Added better-sqlite3 to copy list  
- `scripts/after-pack.js` - Added native module verification
- `BUILD_CHECKLIST.md` - Added troubleshooting section

## Questions?

If the issue persists after rebuilding:
1. Check `~/Library/Logs/PostMaster/main.log` for errors
2. Verify Electron version: `npx electron --version`
3. Check Node version used in build: `node --version`
4. Ensure `@electron/rebuild` is installed: `pnpm list @electron/rebuild`
