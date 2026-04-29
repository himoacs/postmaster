# Releasing PostMaster

Complete guide for releasing new versions of PostMaster. Follow this process to ensure consistent, high-quality releases that don't break user installations.

## Table of Contents

- [Pre-Release Checklist](#pre-release-checklist)
- [Mandatory Testing](#mandatory-testing)
- [Version Bumping](#version-bumping)
- [Creating a Release](#creating-a-release)
- [Landing Page Deployment](#landing-page-deployment)
- [Post-Release Verification](#post-release-verification)
- [Rollback Procedures](#rollback-procedures)
- [Troubleshooting Releases](#troubleshooting-releases)

---

## Pre-Release Checklist

Complete ALL items before creating a release tag. Use [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) for a printable version.

### 1. Code Preparation

- [ ] All features merged to `main` branch
- [ ] Code review completed
- [ ] No known critical bugs
- [ ] Documentation updated
- [ ] RELEASE_NOTES prepared (see template below)

### 2. Version Updates

Update version numbers in **all** of these files:

- [ ] `package.json` → `"version": "X.Y.Z"`
- [ ] `electron/package.json` (if exists) → `"version": "X.Y.Z"`
- [ ] Create `RELEASE_NOTES_vX.Y.Z.md` in project root

**Version Number Format**: `MAJOR.MINOR.PATCH` (e.g., `1.2.0`)
- **MAJOR**: Breaking changes, major new features
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, minor improvements

### 3. Landing Page Updates

**The landing page download links are automatically updated** when you create a release tag!

Optionally, for major releases with new features:

- [ ] Update `docs/index.html` with new feature highlights (if applicable)
- [ ] Test landing page locally: `open docs/index.html`

**Note**: The `deploy-landing` job in `.github/workflows/build-release.yml` automatically:
1. Updates download links to the new version
2. Updates the version text (e.g., "v1.2.2 •")
3. Commits the changes
4. Deploys to GitHub Pages

---

## Mandatory Testing

**CRITICAL**: Run these tests before EVERY release. No exceptions.

### Automated Test Suite

```bash
# Run the comprehensive pre-release validation script
pnpm pre-release
```

This script automatically checks:

1. **TypeScript Compilation** - `tsc --noEmit`
2. **Linting** - `eslint` across all files
3. **Unit Tests** - 206+ tests must pass
4. **Test Coverage** - Minimum thresholds:
   - Statements: 80%
   - Branches: 75%
   - Functions: 80%
   - Lines: 80%
5. **Electron Build** (on tag push) - Ensures builds complete without errors

**If ANY test fails, DO NOT release. Fix the issue first.**

### Manual Smoke Tests

After automated tests pass, perform manual testing:

```bash
# 1. Run development build
pnpm electron:dev

# 2. Test core workflows:
- [ ] Add API keys (OpenAI, Anthropic, or Mistral)
- [ ] Generate content with 2+ models
- [ ] Compare outputs side-by-side
- [ ] Run synthesis
- [ ] Save to history
- [ ] Add knowledge base item
- [ ] Test theme switching
- [ ] Test navigation (Dashboard → Settings → History)

# 3. Test production build (your platform)
pnpm electron:build:mac  # or :win, :linux
open dist/mac-arm64/PostMaster.app

# 4. Repeat core workflows in production build
```

**Common issues to watch for:**
- Database initialization errors
- API key encryption/decryption issues
- Missing native modules (better-sqlite3)
- Theme flickering or incorrect defaults
- Navigation errors

---

## Version Bumping

### Update package.json

```bash
# Option 1: Manual edit
vim package.json
# Change: "version": "1.1.0" → "version": "1.2.0"

# Option 2: Use npm version command
npm version minor  # 1.1.0 → 1.2.0
npm version patch  # 1.1.0 → 1.1.1
npm version major  # 1.1.0 → 2.0.0
```

### Create Release Notes

Create a new file: `RELEASE_NOTES_vX.Y.Z.md`

**Template**:

```markdown
# PostMaster vX.Y.Z - Release Title

**Release Date**: Month Day, Year

## ✨ New Features

- **Feature Name**: Brief description of what it does and why it matters
- **Another Feature**: Description

## 🐛 Bug Fixes

- Fixed [issue description]
- Resolved [problem description]

## 🔧 Improvements

- Improved [aspect]
- Enhanced [feature]

## ⚠️ Breaking Changes

[Only if MAJOR version bump]

- **Change Description**: What changed and how to migrate

## 📋 Technical Changes

- Updated dependency X to version Y
- Refactored Z for better performance
- Added tests for A, B, C

## ⚠️ Important Installation Notes

[If any special installation steps required]

## 🔗 Assets

- [Download for macOS (ARM64)](link)
- [Download for macOS (Intel)](link)
- [Download for Windows](link)
- [Download for Linux](link)

## 📝 Full Changelog

See the [full diff](link-to-github-compare) for all changes.

---

For support or feedback, please open an issue on GitHub.
```

### Commit Version Changes

```bash
git add package.json RELEASE_NOTES_vX.Y.Z.md
git commit -m "chore: bump version to vX.Y.Z"
git push origin main

# Note: docs/index.html download links are updated automatically during release
```

---

## Creating a Release

### Step 1: Create and Push Git Tag

```bash
# Create annotated tag (recommended)
git tag -a vX.Y.Z -m "Release vX.Y.Z"

# Or create lightweight tag
git tag vX.Y.Z

# Push tag to trigger CI/CD
git push origin vX.Y.Z
```

**This automatically triggers**:
1. GitHub Actions workflow: `.github/workflows/build-release.yml`
2. Builds for macOS (ARM64 + Intel), Windows, Linux
3. Uploads artifacts to GitHub Releases
4. Deploys landing page to GitHub Pages

### Step 2: Monitor CI/CD Build

```bash
# Watch workflow progress
gh run list --workflow=build-release.yml

# View logs for specific run
gh run view <run-id> --log

# Or visit GitHub Actions in browser:
https://github.com/himoacs/postmaster/actions
```

**Build times**:
- macOS: ~8-12 minutes
- Windows: ~6-10 minutes
- Linux: ~5-8 minutes
- Total: ~20-30 minutes

**What the workflow does**:

1. **build-mac**:
   - Checks out code
   - Installs dependencies (pnpm)
   - Generates Prisma client
   - Builds Next.js
   - Compiles Electron
   - Runs electron-builder for macOS
   - Signs the app (if certificates available)
   - Uploads DMG and ZIP artifacts

2. **build-windows**:
   - Same steps as macOS
   - Creates NSIS installer
   - Uploads EXE artifact

3. **release**:
   - Downloads all build artifacts
   - Creates GitHub Release with tag
   - Attaches release notes from `RELEASE_NOTES_vX.Y.Z.md`
   - Uploads all installers/packages

4. **deploy-landing**:
   - **Auto-updates** download links in `docs/index.html` to new version
   - Commits the version update to `main` branch
   - Deploys `docs/` folder to GitHub Pages
   - Updates https://himoacs.github.io/postmaster/

### Step 3: Verify Artifacts

Once CI/CD completes, verify the artifacts:

```bash
# List release assets
gh release view vX.Y.Z

# Or visit:
https://github.com/himoacs/postmaster/releases/tag/vX.Y.Z
```

**Expected artifacts**:
- `PostMaster-X.Y.Z-arm64.dmg` (macOS ARM64)
- `PostMaster-X.Y.Z-arm64-mac.zip` (macOS ARM64)
- `PostMaster-X.Y.Z.dmg` (macOS Intel)
- `PostMaster-X.Y.Z-mac.zip` (macOS Intel)
- `PostMaster Setup X.Y.Z.exe` (Windows)
- `PostMaster-X.Y.Z.AppImage` (Linux)
- `PostMaster_X.Y.Z_amd64.deb` (Linux)

### Step 4: Edit GitHub Release

The release is created automatically, but you should review it:

1. Go to https://github.com/himoacs/postmaster/releases/tag/vX.Y.Z
2. Click "Edit release"
3. Verify release notes are correct
4. Add any additional context
5. Check "Set as the latest release" (if applicable)
6. Save changes

---

## Landing Page Deployment

The landing page is **automatically deployed** when you create a release tag. Here's how it works:

### Automatic Deployment (Preferred)

**Trigger**: Creating and pushing a git tag (e.g., `vX.Y.Z`)

**Workflow**: `.github/workflows/build-release.yml` → `deploy-landing` job

**Steps**:
1. Checks out repository (main branch)
2. Extracts version from tag
3. **Auto-updates** download links in `docs/index.html`
4. Commits the changes to main
5. Deploys `docs/` folder to GitHub Pages
6. GitHub Pages serves it at https://himoacs.github.io/postmaster/

**Important**: The landing page source is `docs/index.html` (NOT `landing/`)

**DNS Setup** (if using custom domain):
- CNAME record: `postmaster.app` → `himoacs.github.io`

### Manual Version Update (Fallback)

If automatic update fails, manually update the version:

```bash
# Update download links in docs/index.html
sed -i '' 's/v[0-9.]*\/PostMaster-[0-9.]*/vX.Y.Z\/PostMaster-X.Y.Z/g' docs/index.html
git add docs/index.html
git commit -m "Update landing page to vX.Y.Z"
git push origin main
```

### Verify Landing Page Deployment

After release, check:

```bash
# Wait 2-3 minutes for GitHub Pages to update
sleep 180

# Check the live site
curl -I https://himoacs.github.io/postmaster/
# Should return: HTTP/2 200

# Or open in browser
open https://himoacs.github.io/postmaster/
```

**What to verify**:
- [ ] Page loads without errors
- [ ] Version numbers match release (if displayed)
- [ ] New features are highlighted
- [ ] Download links work (point to latest release)
- [ ] Theme toggle works (defaults to light)
- [ ] Responsive design works (mobile + desktop)

---

## Post-Release Verification

After the release is published, perform these checks:

### 1. Download and Install

Test the actual release artifacts:

```bash
# macOS
gh release download vX.Y.Z --pattern '*-arm64.dmg'
open PostMaster-X.Y.Z-arm64.dmg
# Install and launch

# Windows (from Windows machine)
gh release download vX.Y.Z --pattern '*.exe'
# Run installer

# Linux
gh release download vX.Y.Z --pattern '*.AppImage'
chmod +x PostMaster-X.Y.Z.AppImage
./PostMaster-X.Y.Z.AppImage
```

### 2. Test Auto-Updater

If this is an update to an existing version:

1. Install previous version
2. Launch app
3. App should detect new version (may take a few minutes)
4. Test update flow
5. Verify app restarts successfully with new version

**Auto-update configuration**:
- Checks GitHub Releases for updates
- Downloads in background
- Prompts user to restart
- Rollback on failure

### 3. Monitor for Issues

Watch for user reports:

- GitHub Issues
- Social media mentions
- Email support
- Analytics (crash reports)

**Common post-release issues**:
- Database migration failures
- API key decryption errors
- Theme persistence issues
- Native module crashes

### 4. Update Documentation

After successful release:

- [ ] Update main README.md badges (if version is shown)
- [ ] Update any getting started guides
- [ ] Announce on social media/blog/forum
- [ ] Close completed GitHub milestones
- [ ] Create milestone for next version

---

## Rollback Procedures

If a release has critical issues:

### Option 1: Hot Fix Release (Preferred)

```bash
# 1. Create fix branch
git checkout -b hotfix/vX.Y.Z+1

# 2. Apply fix
# ... make changes ...

# 3. Test thoroughly
pnpm pre-release

# 4. Bump patch version
npm version patch  # X.Y.Z → X.Y.Z+1

# 5. Merge and release
git checkout main
git merge hotfix/vX.Y.Z+1
git tag vX.Y.Z+1
git push origin main vX.Y.Z+1
```

### Option 2: Unpublish Release (Last Resort)

**WARNING**: Only use if release is severely broken and immediately after publishing.

```bash
# 1. Delete the GitHub release
gh release delete vX.Y.Z --yes

# 2. Delete the git tag
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z

# 3. Notify users (if any downloads occurred)
# Create GitHub issue explaining the situation

# 4. Fix issues and re-release
```

### Option 3: Mark as Pre-Release

If you catch issues quickly:

1. Edit the release on GitHub
2. Check "This is a pre-release"
3. This prevents auto-updater from promoting it
4. Gives you time to fix and create a proper release

---

## Troubleshooting Releases

### Issue: CI/CD Build Fails

**Check the logs**:
```bash
gh run view --log-failed
```

**Common causes**:

1. **TypeScript errors**:
   ```bash
   pnpm tsc --noEmit
   # Fix errors and commit
   ```

2. **Test failures**:
   ```bash
   pnpm test
   # Fix failing tests
   ```

3. **Signing failures** (macOS):
   - Verify `MAC_CERTS` secret is set
   - Verify `MAC_CERTS_PASSWORD` is correct
   - Certificate may have expired

4. **Out of disk space**:
   - GitHub runners have limited space
   - May need to clean up artifacts

### Issue: Artifacts Missing from Release

**Cause**: Build succeeded but upload failed.

**Solution**:
```bash
# 1. Find the workflow run
gh run list --workflow=build-release.yml

# 2. Download artifacts manually
gh run download <run-id>

# 3. Upload to release
gh release upload vX.Y.Z dist/*.dmg dist/*.zip dist/*.exe
```

### Issue: Landing Page Not Updating

**Check deployment**:
```bash
# View recent workflow runs
gh run list --workflow=deploy-landing.yml

# Check gh-pages branch
git fetch origin gh-pages
git log origin/gh-pages
```

**Manual fix**:
```bash
# Force deploy landing page
gh workflow run deploy-landing.yml
```

**Check GitHub Pages settings**:
1. Go to: Settings → Pages
2. Verify source is `gh-pages` branch
3. Check custom domain configuration

### Issue: Auto-Updater Not Working

**Debugging**:

1. **Check release format**:
   - Must follow semantic versioning: `vX.Y.Z`
   - Must be a GitHub Release (not just a tag)
   - Artifacts must be attached

2. **Check user's version**:
   - App must be checking for updates
   - Network connectivity required
   - May take up to 1 hour for update check

3. **Force update check**:
   - Restart the app
   - Check app logs for update errors

**electron-updater configuration** (`electron-builder.yml`):
```yaml
publish:
  provider: github
  owner: himoacs
  repo: postmaster
```

---

## Release Frequency

**Recommended schedule**:
- **Patch releases**: As needed for critical bugs (within 24-48 hours)
- **Minor releases**: Every 2-4 weeks with new features
- **Major releases**: Every 3-6 months with breaking changes

**Emergency hotfix process**:
1. Fix the critical bug
2. Run `pnpm pre-release` (abbreviated testing OK for hotfixes)
3. Bump patch version
4. Tag and release immediately
5. Monitor closely for next 24 hours

---

## Quick Reference

For a condensed checklist, see [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

For build procedures, see [BUILDING.md](BUILDING.md).

---

## Additional Resources

- [Semantic Versioning](https://semver.org/)
- [electron-builder Documentation](https://www.electron.build/)
- [GitHub Releases Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
