#!/usr/bin/env node
/**
 * Rebuild native modules in standalone for Electron
 * 
 * This script:
 * 1. Backs up the current better-sqlite3 build (compiled for Node.js)
 * 2. Rebuilds for Electron
 * 3. Copies to standalone
 * 4. Restores the original build (to avoid polluting node_modules with Electron builds)
 * 
 * This prevents the recurring x86_64/arm64 architecture mismatch issue.
 * 
 * Environment variables:
 *   TARGET_ARCH - Target architecture (arm64, x64). Defaults to process.arch.
 *                 Use this for cross-compilation (e.g., building x64 on ARM runner).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const standalonePath = path.join(projectRoot, '.next', 'standalone_flat');
const nodeModulesPath = path.join(projectRoot, 'node_modules');

// Allow cross-compilation via TARGET_ARCH env var
const targetArch = process.env.TARGET_ARCH || process.arch;

console.log('Rebuilding native modules for Electron in standalone...');
console.log(`  Host architecture: ${process.arch}`);
console.log(`  Target architecture: ${targetArch}\n`);

// Check if standalone exists
if (!fs.existsSync(standalonePath)) {
  console.error('Error: Standalone folder not found at', standalonePath);
  process.exit(1);
}

// Find the actual better-sqlite3 location (may be in pnpm virtual store)
function findBetterSqlitePath() {
  // Try direct path first
  const directPath = path.join(nodeModulesPath, 'better-sqlite3');
  if (fs.existsSync(directPath)) {
    // Check if it's a symlink (pnpm)
    const realPath = fs.realpathSync(directPath);
    return { symlink: directPath, real: realPath };
  }
  throw new Error('better-sqlite3 not found in node_modules');
}

try {
  const { symlink: betterSqliteSrc, real: realPath } = findBetterSqlitePath();
  const buildDir = path.join(realPath, 'build');
  const backupDir = path.join(realPath, 'build.node-backup');
  
  console.log(`Found better-sqlite3 at: ${realPath}`);
  
  // Step 1: Back up the current Node.js build
  console.log('\nStep 1: Backing up current Node.js build...');
  if (fs.existsSync(buildDir)) {
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
    fs.cpSync(buildDir, backupDir, { recursive: true });
    console.log('✓ Backup created');
  } else {
    console.log('⚠ No existing build directory to back up');
  }
  
  // Step 2: Rebuild for Electron with explicit architecture
  console.log('\nStep 2: Rebuilding better-sqlite3 for Electron...');
  console.log(`  Target architecture: ${targetArch}`);
  
  // Use --force to ignore prebuilt binaries and rebuild from source
  // Use --arch to explicitly specify the architecture (enables cross-compilation)
  execSync(`npx electron-rebuild -f -w better-sqlite3 --arch ${targetArch}`, {
    cwd: projectRoot,
    stdio: 'inherit'
  });
  
  // Verify the rebuilt module has correct architecture (macOS/Linux only - `file` command not available on Windows)
  const rebuiltModulePath = path.join(realPath, 'build', 'Release', 'better_sqlite3.node');
  if (fs.existsSync(rebuiltModulePath) && process.platform !== 'win32') {
    const fileOutput = execSync(`file "${rebuiltModulePath}"`, { encoding: 'utf-8' });
    console.log(`  Rebuilt module: ${fileOutput.trim()}`);
    
    const expectedArch = targetArch === 'arm64' ? 'arm64' : 'x86_64';
    if (!fileOutput.includes(expectedArch)) {
      throw new Error(`Architecture mismatch! Expected ${expectedArch} but got: ${fileOutput}`);
    }
    console.log(`  ✓ Architecture verified: ${expectedArch}`);
  } else if (fs.existsSync(rebuiltModulePath)) {
    console.log(`  ✓ Module rebuilt (architecture verification skipped on Windows)`);
  }
  
  // Step 3: Copy the rebuilt module to standalone
  console.log('\nStep 3: Copying rebuilt module to standalone...');
  
  const betterSqliteDest = path.join(standalonePath, 'node_modules', 'better-sqlite3');
  
  // Remove existing standalone module
  if (fs.existsSync(betterSqliteDest)) {
    fs.rmSync(betterSqliteDest, { recursive: true, force: true });
  }
  
  // Copy the rebuilt module (dereference symlinks)
  fs.cpSync(fs.realpathSync(betterSqliteSrc), betterSqliteDest, { recursive: true, dereference: true });
  
  // Verify the .node file exists
  const nodeFile = path.join(betterSqliteDest, 'build', 'Release', 'better_sqlite3.node');
  if (fs.existsSync(nodeFile)) {
    const stats = fs.statSync(nodeFile);
    console.log(`✓ Native module copied successfully (${(stats.size / 1024).toFixed(2)} KB)`);
    console.log(`  Location: ${nodeFile}`);
  } else {
    console.error('✗ Warning: better_sqlite3.node not found after copy!');
    process.exit(1);
  }
  
  // Also copy to .next/node_modules traced directory (Next.js traces native modules here)
  const standaloneNextDir = path.join(standalonePath, '.next', 'node_modules');
  if (fs.existsSync(standaloneNextDir)) {
    const entries = fs.readdirSync(standaloneNextDir);
    const tracedDir = entries.find(e => e.startsWith('better-sqlite3-'));
    
    if (tracedDir) {
      console.log(`\nStep 3b: Also copying to traced directory: ${tracedDir}`);
      const destTracedRelease = path.join(standaloneNextDir, tracedDir, 'build', 'Release');
      fs.mkdirSync(destTracedRelease, { recursive: true });
      fs.cpSync(nodeFile, path.join(destTracedRelease, 'better_sqlite3.node'));
      console.log('✓ Native module also copied to traced directory');
    }
  }
  
  // Step 4: Restore the original Node.js build
  console.log('\nStep 4: Restoring original Node.js build...');
  if (fs.existsSync(backupDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
    fs.renameSync(backupDir, buildDir);
    console.log('✓ Original build restored (node_modules unchanged)');
  } else {
    // No backup - rebuild for Node.js
    console.log('⚠ No backup found, rebuilding for Node.js...');
    execSync('pnpm rebuild better-sqlite3', {
      cwd: projectRoot,
      stdio: 'ignore'
    });
  }
  
  console.log('\n✅ Standalone native module rebuild complete!');
  console.log('   Node.js build in node_modules: preserved');
  console.log('   Electron build in standalone: ready');
  
} catch (error) {
  console.error('\n❌ Rebuild failed:', error.message);
  process.exit(1);
}
