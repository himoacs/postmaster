# Release Notes - v1.2.2

**Release Date:** April 29, 2026

## 🔧 Critical Bug Fix

### Fixed: "Server Error" on Launch (Native Module Issue)

**Problem:** Users on certain macOS systems experienced a "This page couldn't load - A server error occurred" message when launching the app. This affected v1.1.0, v1.2.0, and v1.2.1.

**Root Cause:** The `better-sqlite3` native module was compiled for the developer's Node.js version (v24) instead of Electron's internal Node.js version (v22), causing a `NODE_MODULE_VERSION` mismatch on user machines.

**Fix:** 
- Implemented proper Electron-specific native module compilation workflow
- Added build verification to ensure correct native binaries are included
- Updated build scripts to rebuild native modules specifically for Electron's Node.js version

**Impact:** This fix resolves all database-related startup failures. Users who experienced the "server error" should update immediately.

---

## 📦 Build Improvements

- Added automated native module verification in build process
- Enhanced after-pack script to detect missing native binaries
- Improved build documentation with troubleshooting guide
- Created dedicated rebuild script for standalone builds

---

## 🚀 Installation

### For Existing Users

If you're experiencing the "server error":
1. Download and install v1.2.2 from the releases page
2. Your data and settings will be preserved
3. The app should now launch without issues

### For New Users

Download the appropriate version for your system:
- **Apple Silicon (M1/M2/M3):** PostMaster-1.2.2-arm64.dmg
- **Intel Mac:** PostMaster-1.2.2.dmg

---

## 🔍 Technical Details

For developers or those interested in the technical details, see [NATIVE_MODULE_FIX.md](NATIVE_MODULE_FIX.md) for a complete explanation of the issue and fix.

---

## 📝 Files Changed

- `package.json` - Updated build scripts
- `scripts/rebuild-standalone-native.js` - New custom rebuild script
- `scripts/fix-standalone.js` - Added better-sqlite3 to copy list
- `scripts/after-pack.js` - Added native module verification
- `BUILD_CHECKLIST.md` - Updated with troubleshooting section

---

## ⚠️ Known Issues

None in this release.

---

## 🙏 Thanks

Special thanks to users who reported this issue and helped with testing.
