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
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const standalonePath = path.join(projectRoot, '.next', 'standalone_flat');
const nodeModulesPath = path.join(projectRoot, 'node_modules');

console.log('Rebuilding native modules for Electron in standalone...\n');

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
  
  // Step 2: Rebuild for Electron
  console.log('\nStep 2: Rebuilding better-sqlite3 for Electron...');
  execSync('npx electron-rebuild -f -w better-sqlite3', {
    cwd: projectRoot,
    stdio: 'inherit'
  });
  
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
