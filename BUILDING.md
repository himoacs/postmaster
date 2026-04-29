# Building PostMaster

Comprehensive guide for building the PostMaster Electron application. Follow this guide to set up your development environment and create production builds.

## Table of Contents

- [Environment Requirements](#environment-requirements)
- [Version Compatibility Matrix](#version-compatibility-matrix)
- [Development Setup](#development-setup)
- [Building for Production](#building-for-production)
- [Native Module Dependencies](#native-module-dependencies)
- [Platform-Specific Notes](#platform-specific-notes)
- [Troubleshooting](#troubleshooting)

---

## Environment Requirements

### Required Software

- **Node.js**: 20.x (required for ABI compatibility with Electron 36.3.2)
- **pnpm**: 9.x or 10.x
- **Electron**: 36.3.2 (specified in package.json)
- **Python**: 3.x (for native module compilation)
- **Build Tools**: Platform-specific (see below)

### Platform-Specific Prerequisites

#### macOS
```bash
# Xcode Command Line Tools
xcode-select --install

# Verify installation
xcode-select -p
```

#### Windows
```powershell
# Install Windows Build Tools
npm install --global windows-build-tools

# Or install Visual Studio 2022 Build Tools
# https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install -y build-essential python3 libsqlite3-dev
```

---

## Version Compatibility Matrix

**Critical**: These versions MUST match to avoid ABI compatibility issues with native modules (especially better-sqlite3).

| Component | Version | Notes |
|-----------|---------|-------|
| **Electron** | 36.3.2 | Bundles Node.js 22.x internally |
| **Node.js (Build)** | 20.x | Used for local development & CI builds |
| **pnpm** | 9.x or 10.x | CI uses 10.x, local can use 9.x |
| **better-sqlite3** | 12.9.0 | Native module - must rebuild for platform |
| **Prisma** | 7.8.0 | Uses better-sqlite3 adapter |
| **Next.js** | 16.2.4 | Standalone output mode required |
| **TypeScript** | 5.x | For electron and app compilation |

### Electron ↔ Node.js ABI Compatibility

| Electron Version | Node.js Version | ABI Version | Module Rebuild Required? |
|-----------------|----------------|-------------|-------------------------|
| 36.3.2 | 22.x | 127 | Yes - for target platform |
| 35.x | 20.x | 115 | Yes |
| 34.x | 20.x | 115 | Yes |

**Why this matters**: Native modules (like better-sqlite3) compile against a specific Node.js ABI. If the ABI version doesn't match, you'll get errors like:
- `Error: The module was compiled against a different Node.js version`
- `MODULE_NOT_FOUND` for `.node` files
- Segmentation faults or crashes on startup

---

## Development Setup

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/himoacs/postmaster.git
cd postmaster

# Verify Node.js version (MUST be 20.x)
node --version  # Should output v20.x.x

# Install dependencies
pnpm install

# Rebuild native modules for your platform
npm rebuild better-sqlite3

# Generate Prisma client
npx prisma generate

# Start development server
pnpm dev
```

### Running Electron in Development

```bash
# Terminal 1: Start Next.js dev server (port 3456)
pnpm dev

# Terminal 2: Start Electron app
pnpm electron:start

# Or run both concurrently
pnpm electron:dev
```

The `electron:dev` script automatically:
1. Starts Next.js on port 3456
2. Waits for the server to be ready
3. Launches Electron pointing to `http://localhost:3456`

---

## Building for Production

### Complete Build Process

The build process consists of several critical steps that must run in sequence:

```bash
# Full build pipeline for macOS
pnpm electron:build:mac

# Full build pipeline for Windows
pnpm electron:build:win

# Full build pipeline for Linux
pnpm electron:build:linux
```

### Build Pipeline Breakdown

Each `electron:build:*` script runs these steps in order:

```bash
# 1. Rebuild native modules for current platform
pnpm rebuild:native
# → Runs: npm rebuild better-sqlite3

# 2. Build Next.js in standalone mode
pnpm build
# → Creates: .next/standalone/ with self-contained server

# 3. Prepare standalone output (resolve pnpm symlinks)
pnpm electron:prepare
# → Runs: scripts/fix-standalone.js
# → Creates: .next/standalone_flat/ with real files (not symlinks)

# 4. Prepare electron-updater dependencies
pnpm electron:deps
# → Runs: scripts/prepare-electron-deps.js
# → Copies electron-updater + deps to electron-deps/

# 5. Compile TypeScript (electron main process)
pnpm electron:compile
# → Runs: tsc -p electron/tsconfig.json
# → Creates: electron/dist/main.js

# 6. Package with electron-builder
electron-builder --mac  # or --win, --linux
# → Creates: dist/*.dmg, dist/*.zip, etc.
```

### Understanding pnpm Symlink Workarounds

**Problem**: electron-builder doesn't properly follow pnpm's symlinked `node_modules` structure, causing modules to be missing in packaged builds.

**Solution**: Two custom scripts resolve this:

#### 1. `scripts/fix-standalone.js`
```bash
# What it does:
- Copies .next/standalone/ to .next/standalone_flat/
- Uses rsync -aL to follow symlinks and copy real files
- Ensures all Next.js dependencies are physically present
```

#### 2. `scripts/prepare-electron-deps.js`
```bash
# What it does:
- Identifies electron-updater and its dependencies
- Copies them to electron-deps/node_modules/ (flat structure)
- electron-builder includes this via extraFiles in electron-builder.yml
```

**Why not use npm/yarn instead?** We use pnpm for faster installs and workspace support. These workarounds are a one-time setup cost that runs automatically during builds.

---

## Native Module Dependencies

### better-sqlite3 (v12.9.0)

The most critical native dependency. Must be rebuilt for the target platform.

**Configuration in `electron-builder.yml`:**
```yaml
electronVersion: "36.3.2"
npmRebuild: true          # Rebuild for target Electron version
nodeGypRebuild: false     # electron-builder handles this
nativeRebuilder: sequential
asarUnpack:
  - "**/*.node"           # Extract native bindings from asar
  - "**/better-sqlite3/**"
```

**Rebuild Process:**
```bash
# Rebuild for current platform
npm rebuild better-sqlite3

# Or use the package script
pnpm rebuild:native
```

**In postinstall Hook:**
```json
"postinstall": "npm rebuild better-sqlite3 && npx prisma generate"
```

This ensures native modules are rebuilt whenever dependencies are installed.

### Prisma (v7.8.0)

Uses better-sqlite3 under the hood via `@prisma/adapter-better-sqlite3`.

**Next.js Configuration** (`next.config.ts`):
```typescript
transpilePackages: ["@prisma/client"],
serverExternalPackages: ["better-sqlite3"],
outputFileTracingIncludes: {
  "/**": [
    "./node_modules/.prisma/**/*",
    "./node_modules/@prisma/client/**/*",
    "./node_modules/**/better-sqlite3/**/*.node",
    "./node_modules/**/better-sqlite3/build/**/*",
  ],
}
```

**Database Template:**
- Ships with `prisma/template.db` as a seed database
- Electron copies it to user data directory on first run
- Location priority:
  1. `{resourcesPath}/template.db` (production)
  2. `prisma/template.db` (development)

---

## Platform-Specific Notes

### macOS

**Code Signing:**
```bash
# Set these environment variables for signing:
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="certificate-password"

# Or in CI/CD:
CSC_LINK: ${{ secrets.MAC_CERTS }}
CSC_KEY_PASSWORD: ${{ secrets.MAC_CERTS_PASSWORD }}
```

**Notarization Status:**
- Currently: **Signed but NOT notarized**
- User impact: Must right-click → Open on first launch
- To enable notarization: Add Apple ID credentials and set `notarize: true` in electron-builder.yml

**Build Targets:**
```yaml
mac:
  target:
    - target: dmg
      arch: [arm64, x64]  # Universal binary support
    - target: zip
      arch: [arm64, x64]
```

**Output Files:**
```
dist/PostMaster-{version}-arm64.dmg
dist/PostMaster-{version}-arm64-mac.zip
dist/PostMaster-{version}.dmg          # x64
dist/PostMaster-{version}-mac.zip      # x64
```

### Windows

**Build Targets:**
```yaml
win:
  target:
    - target: nsis
      arch: [x64]
```

**Output Files:**
```
dist/PostMaster Setup {version}.exe
```

**Installer Options:**
- Two-click installer (not one-click)
- User can choose installation directory
- Creates desktop shortcut
- Creates start menu shortcut

### Linux

**Build Targets:**
```yaml
linux:
  target:
    - target: AppImage
      arch: [x64]
    - target: deb
      arch: [x64]
```

**Output Files:**
```
dist/PostMaster-{version}.AppImage
dist/PostMaster_{version}_amd64.deb
```

---

## Troubleshooting

### Issue: `Error: The module was compiled against a different Node.js version`

**Cause**: ABI version mismatch between build Node.js and Electron's bundled Node.js.

**Solution**:
```bash
# 1. Verify Node.js version (must be 20.x)
node --version

# 2. Clean and rebuild
rm -rf node_modules
pnpm install

# 3. Rebuild native modules
npm rebuild better-sqlite3

# 4. Clear Electron cache
rm -rf ~/.electron
rm -rf ~/Library/Caches/electron-builder

# 5. Rebuild
pnpm electron:build:mac
```

### Issue: `MODULE_NOT_FOUND` for `.node` files

**Cause**: Native bindings not properly unpacked from asar archive.

**Solution**: Verify `electron-builder.yml` has:
```yaml
asarUnpack:
  - "**/*.node"
  - "**/better-sqlite3/**"
```

If still failing, check that `npmRebuild: true` is set.

### Issue: `Cannot find module` in packaged app

**Cause**: pnpm symlinks not resolved, electron-builder can't follow them.

**Solution**: Run the preparation scripts:
```bash
pnpm electron:prepare  # Creates .next/standalone_flat/
pnpm electron:deps     # Prepares electron-deps/
```

These should run automatically as part of `electron:build:*`, but can be run manually for debugging.

### Issue: Code signing fails on macOS

**Symptoms**:
```
Error: Command failed: codesign ...
```

**Solutions**:

1. **Certificate not found**:
```bash
# List available signing identities
security find-identity -v -p codesigning

# Make sure CSC_LINK and CSC_KEY_PASSWORD are set
echo $CSC_LINK
echo $CSC_KEY_PASSWORD
```

2. **Skip code signing** (development only):
```bash
CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --mac
```

3. **Keychain locked**:
```bash
# Unlock the keychain
security unlock-keychain ~/Library/Keychains/login.keychain-db
```

### Issue: Build succeeds but app won't launch

**Debugging steps**:

1. **Check Console.app** (macOS):
```bash
# Open Console app and filter by "PostMaster"
open /Applications/Utilities/Console.app
```

2. **Check Electron logs**:
```bash
# macOS
~/Library/Logs/PostMaster/

# Windows
%APPDATA%\PostMaster\logs\

# Linux
~/.config/PostMaster/logs/
```

3. **Run from terminal** (macOS):
```bash
# Run the app directly to see console output
./dist/mac-arm64/PostMaster.app/Contents/MacOS/PostMaster
```

4. **Common causes**:
- Missing environment variables (ENCRYPTION_KEY)
- Database initialization failed
- Port 3456 already in use
- Native module not rebuilt correctly

### Issue: Prisma client not found in production

**Cause**: Prisma client not generated or not included in bundle.

**Solution**:
```bash
# Regenerate Prisma client
npx prisma generate

# Verify .prisma folder exists
ls -la node_modules/.prisma/

# Rebuild
pnpm build
```

Ensure `next.config.ts` includes:
```typescript
outputFileTracingIncludes: {
  "/**": ["./node_modules/.prisma/**/*"]
}
```

### Issue: Tests failing before build

**Solution**: Always run the pre-release validation script:
```bash
pnpm pre-release
```

This checks:
- TypeScript compilation
- Linting
- Unit tests
- Test coverage thresholds (80%)
- Builds a test artifact (if running on tag)

See [RELEASING.md](RELEASING.md) for the complete release process.

---

## Quick Reference

For a condensed checklist, see [BUILD_CHECKLIST.md](BUILD_CHECKLIST.md).

For release procedures, see [RELEASING.md](RELEASING.md).

---

## Getting Help

1. Check the [Troubleshooting](#troubleshooting) section above
2. Review [GitHub Actions logs](.github/workflows/build-release.yml) for CI build examples
3. Open an issue on [GitHub](https://github.com/himoacs/postmaster/issues)
4. Check Electron Builder docs: https://www.electron.build/
