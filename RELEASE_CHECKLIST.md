# Release Checklist

Quick reference for releasing PostMaster. Print this and check off items as you go. For detailed instructions, see [RELEASING.md](RELEASING.md).

---

## 📋 Pre-Release (Do First!)

### Code Preparation
- [ ] All features merged to `main`
- [ ] Code review completed
- [ ] No known critical bugs
- [ ] Documentation updated

### Version Updates
- [ ] Update `package.json` version: `"version": "X.Y.Z"`
- [ ] Create `RELEASE_NOTES_vX.Y.Z.md`
- [ ] (Optional) Update `docs/index.html` feature highlights for major releases
- [ ] Commit: `git commit -m "chore: bump version to vX.Y.Z"`
- [ ] Push: `git push origin main`

**Note**: Download links in `docs/index.html` are auto-updated during release!

---

## ✅ Mandatory Testing

### Automated Tests (MUST PASS)
```bash
pnpm pre-release
```

- [ ] TypeScript compilation: PASS
- [ ] Linting: PASS
- [ ] Unit tests (206+): PASS
- [ ] Coverage thresholds (80%/75%/80%/80%): PASS

### Manual Smoke Tests
```bash
pnpm electron:dev
```

- [ ] Add API keys (OpenAI/Anthropic/Mistral)
- [ ] Generate with 2+ models
- [ ] Compare outputs
- [ ] Run synthesis
- [ ] Save to history
- [ ] Add knowledge base item
- [ ] Theme switching
- [ ] Navigation (Dashboard ↔ Settings ↔ History)

### Production Build Test
```bash
pnpm electron:build:mac  # or :win, :linux
```

- [ ] Build completes without errors
- [ ] App launches from `dist/`
- [ ] Repeat smoke tests in production build
- [ ] No console errors

---

## 🚀 Create Release

### Create and Push Tag
```bash
# Create tag
git tag -a vX.Y.Z -m "Release vX.Y.Z"

# Push tag (triggers CI/CD)
git push origin vX.Y.Z
```

### Monitor CI/CD
```bash
# Watch build progress
gh run list --workflow=build-release.yml

# View logs if needed
gh run view <run-id> --log
```

**Expected time**: ~20-30 minutes

- [ ] macOS build: SUCCESS
- [ ] Windows build: SUCCESS
- [ ] Release created: SUCCESS
- [ ] Landing page deployed: SUCCESS

### Verify Artifacts
```bash
gh release view vX.Y.Z
```

**Expected files**:
- [ ] `PostMaster-X.Y.Z-arm64.dmg` (macOS ARM)
- [ ] `PostMaster-X.Y.Z-arm64-mac.zip` (macOS ARM)
- [ ] `PostMaster-X.Y.Z.dmg` (macOS Intel)
- [ ] `PostMaster-X.Y.Z-mac.zip` (macOS Intel)
- [ ] `PostMaster Setup X.Y.Z.exe` (Windows)
- [ ] `PostMaster-X.Y.Z.AppImage` (Linux)
- [ ] `PostMaster_X.Y.Z_amd64.deb` (Linux)

### Edit GitHub Release
1. Go to: https://github.com/himoacs/postmaster/releases/tag/vX.Y.Z
2. Click "Edit release"
3. Review release notes
4. Check "Set as the latest release" (if applicable)
5. Save

---

## 🌐 Landing Page Verification

### Wait for Deployment
```bash
# Wait 2-3 minutes
sleep 180
```

### Check Live Site
```bash
# Test connectivity
curl -I https://himoacs.github.io/postmaster/

# Or open in browser
open https://himoacs.github.io/postmaster/
```

- [ ] Page loads (HTTP 200)
- [ ] No console errors
- [ ] Version numbers match (if displayed)
- [ ] New features highlighted
- [ ] Download links work
- [ ] Theme toggle works (defaults to light)
- [ ] Responsive design (mobile + desktop)

---

## ✅ Post-Release Verification

### Download and Test Artifacts

**macOS**:
```bash
gh release download vX.Y.Z --pattern '*-arm64.dmg'
open PostMaster-X.Y.Z-arm64.dmg
```
- [ ] Install succeeds
- [ ] App launches
- [ ] Core features work
- [ ] No crashes

**Windows** (from Windows machine):
```bash
gh release download vX.Y.Z --pattern '*.exe'
```
- [ ] Installer runs
- [ ] App launches
- [ ] Core features work

**Linux**:
```bash
gh release download vX.Y.Z --pattern '*.AppImage'
chmod +x PostMaster-X.Y.Z.AppImage
./PostMaster-X.Y.Z.AppImage
```
- [ ] App launches
- [ ] Core features work

### Test Auto-Updater (if updating existing version)
- [ ] Previous version installed
- [ ] Launches successfully
- [ ] Detects new version (may take 5-10 minutes)
- [ ] Update prompt appears
- [ ] Update downloads successfully
- [ ] App restarts with new version
- [ ] Data/settings preserved

---

## 📢 Post-Release Tasks

### Documentation
- [ ] Update README.md badges (if version shown)
- [ ] Update getting started guides (if needed)
- [ ] Close completed GitHub milestones
- [ ] Create milestone for next version

### Communication
- [ ] Announce on social media (if applicable)
- [ ] Post on blog/forum (if applicable)
- [ ] Notify beta testers
- [ ] Update product website

### Monitoring
- [ ] Watch GitHub Issues for bug reports
- [ ] Monitor error logs/analytics
- [ ] Check auto-updater metrics
- [ ] Track download counts

---

## 🚨 Rollback (If Needed)

### Option 1: Hot Fix (Preferred)
```bash
git checkout -b hotfix/vX.Y.Z+1
# Fix the issue
pnpm pre-release
npm version patch
git checkout main
git merge hotfix/vX.Y.Z+1
git tag vX.Y.Z+1
git push origin main vX.Y.Z+1
```

### Option 2: Mark as Pre-Release
1. Edit release on GitHub
2. Check "This is a pre-release"
3. Prevents auto-updater from promoting it
4. Fix issues and create proper release

### Option 3: Unpublish (Last Resort)
```bash
gh release delete vX.Y.Z --yes
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z
# Create GitHub issue explaining the situation
```

---

## 🐛 Common Issues

### CI/CD Build Fails
```bash
# Check logs
gh run view --log-failed

# Common causes:
# - TypeScript errors: pnpm tsc --noEmit
# - Test failures: pnpm test
# - Signing issues: Check MAC_CERTS secret
```

### Artifacts Missing
```bash
# Download from workflow run
gh run download <run-id>

# Upload manually
gh release upload vX.Y.Z dist/*.dmg dist/*.zip
```

### Landing Page Not Updating
```bash
# Force deploy
gh workflow run deploy-landing.yml

# Check deployment status
gh run list --workflow=deploy-landing.yml
```

---

## 📊 Version Number Guide

**Format**: `MAJOR.MINOR.PATCH` (e.g., `1.2.3`)

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features, backward compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes

---

## 🔗 See Also

- **Detailed release guide**: [RELEASING.md](RELEASING.md)
- **Build procedures**: [BUILDING.md](BUILDING.md)
- **Build checklist**: [BUILD_CHECKLIST.md](BUILD_CHECKLIST.md)
- **Test documentation**: [test/README.md](test/README.md)

---

## ⏱️ Estimated Timeline

| Phase | Time |
|-------|------|
| Pre-release prep | 30-60 min |
| Automated tests | 5-10 min |
| Manual testing | 15-30 min |
| Version bump + commit | 5 min |
| CI/CD build | 20-30 min |
| Verification | 15-30 min |
| **Total** | **~90-165 min** |

---

**Last Updated**: April 2026

**Remember**: Never skip testing. A bad release damages user trust more than a delayed release.
