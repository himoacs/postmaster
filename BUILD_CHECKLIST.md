# Build Checklist

Quick reference for building PostMaster locally. For detailed instructions, see [BUILDING.md](BUILDING.md).

---

## ✅ Pre-Build Checklist

### Environment Setup
- [ ] Node.js 20.x installed (`node --version`)
- [ ] pnpm 9.x or 10.x installed (`pnpm --version`)
- [ ] Platform build tools installed (Xcode CLI / Visual Studio / build-essential)
- [ ] Python 3.x available for native module compilation

### Verify Critical Versions
```bash
node --version    # Must be v20.x.x
pnpm --version    # Should be 9.x or 10.x
python3 --version # Should be 3.x
```

---

## 📦 Initial Setup

```bash
# Clone and navigate
git clone https://github.com/himoacs/postmaster.git
cd postmaster

# Install dependencies
pnpm install

# Rebuild native modules
npm rebuild better-sqlite3

# Generate Prisma client
npx prisma generate

# Generate fresh template database
rm prisma/template.db
npx prisma migrate deploy
cp data/postmaster.db prisma/template.db
```

---

## �️ Database Migrations (Check Before Building!)

If schema has changed since your last build:

```bash
# Check migration status
pnpm prisma migrate status

# Apply migrations (if needed)
pnpm prisma migrate dev

# Regenerate client
pnpm prisma generate

# Update template for fresh installs
cp data/postmaster.db prisma/template.db
```

> **Note:** Runtime migrations in `src/lib/db.ts` auto-update existing user databases. But you must update `prisma/template.db` for new installations.

---

## �🔨 Development Build

```bash
# Option 1: Run Next.js + Electron separately
# Terminal 1:
pnpm dev

# Terminal 2:
pnpm electron:start

# Option 2: Run concurrently
pnpm electron:dev
```

**Check**:
- [ ] Next.js running on http://localhost:3456
- [ ] Electron window opens
- [ ] No console errors
- [ ] Can add API keys
- [ ] Can generate content

---

## 🏗️ Production Build

**CRITICAL**: The build process uses `rebuild:electron` to compile native modules (better-sqlite3) for Electron's Node.js version, not your system Node.js. This prevents "NODE_MODULE_VERSION mismatch" errors on user machines.

### macOS
```bash
pnpm electron:build:mac
```

**Output**:
- [ ] `dist/PostMaster-{version}-arm64.dmg`
- [ ] `dist/PostMaster-{version}-arm64-mac.zip`
- [ ] `dist/PostMaster-{version}.dmg` (Intel)
- [ ] `dist/PostMaster-{version}-mac.zip` (Intel)

**Verify native modules**: Check build output for "✓ Found better-sqlite3.node" message

### Windows
```bash
pnpm electron:build:win
```

**Output**:
- [ ] `dist/PostMaster Setup {version}.exe`

### Linux
```bash
pnpm electron:build:linux
```

**Output**:
- [ ] `dist/PostMaster-{version}.AppImage`
- [ ] `dist/PostMaster_{version}_amd64.deb`

---

## 🧪 Testing Build

```bash
# Run from dist (macOS example)
open dist/mac-arm64/PostMaster.app

# Or from terminal for logs
./dist/mac-arm64/PostMaster.app/Contents/MacOS/PostMaster
```

**Manual Test Checklist**:
- [ ] App launches without errors
- [ ] Database initializes (check `~/Library/Application Support/PostMaster/`)
- [ ] Add API key (test encryption)
- [ ] Generate content with 2+ models
- [ ] Run synthesis
- [ ] Save to history
- [ ] Add knowledge base item
- [ ] Theme switching works
- [ ] Navigation works (Dashboard ↔ Settings ↔ History)
- [ ] App quits cleanly

---

## 🐛 Quick Troubleshooting

### "Server error" or database errors in packaged app
**Cause**: Native module (better-sqlite3) compiled for wrong Node.js version

**Fix**: Rebuild with correct workflow:
```bash
# Rebuild for Electron's Node version (not system Node)
pnpm rebuild:electron

# Then build the app
pnpm electron:build:mac  # or :win, :linux
```

**Verify**: Check after-pack output for "✓ Found better-sqlite3.node" message

### Build fails with ABI error or NODE_MODULE_VERSION error
```bash
rm -rf node_modules
pnpm install
pnpm rebuild:electron  # Use Electron rebuild, not npm rebuild
```

### Module not found in packaged app
```bash
pnpm electron:prepare  # Resolves pnpm symlinks
pnpm electron:deps     # Prepares electron-updater deps
```

### Code signing fails (macOS)
```bash
# Skip signing for local development
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm electron:build:mac
```

### App won't launch after build
```bash
# Check logs
tail -f ~/Library/Logs/PostMaster/main.log

# Run from terminal
./dist/mac-arm64/PostMaster.app/Contents/MacOS/PostMaster
```

---

## 📊 Version Compatibility Matrix

| Component | Required Version |
|-----------|-----------------|
| Node.js | 20.x |
| pnpm | 9.x or 10.x |
| Electron | 36.3.2 |
| better-sqlite3 | 12.9.0 |
| Prisma | 7.8.0 |
| Next.js | 16.2.4 |

---

## 🔗 See Also

- **Detailed build guide**: [BUILDING.md](BUILDING.md)
- **Release process**: [RELEASING.md](RELEASING.md)
- **Release checklist**: [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)
- **Test documentation**: [test/README.md](test/README.md)

---

**Last Updated**: April 2026
