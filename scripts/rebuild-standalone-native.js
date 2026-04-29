#!/usr/bin/env node
/**
 * Rebuild native modules in standalone for Electron
 * 
 * Since electron-rebuild expects a standard npm project structure,
 * we rebuild in the main node_modules and then copy to standalone.
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

try {
  // Step 1: Rebuild in main node_modules for Electron
  console.log('Step 1: Rebuilding better-sqlite3 for Electron...');
  execSync('npx electron-rebuild -f -w better-sqlite3', {
    cwd: projectRoot,
    stdio: 'inherit'
  });
  
  // Step 2: Copy the rebuilt module to standalone
  console.log('\nStep 2: Copying rebuilt module to standalone...');
  
  const betterSqliteSrc = path.join(nodeModulesPath, 'better-sqlite3');
  const betterSqliteDest = path.join(standalonePath, 'node_modules', 'better-sqlite3');
  
  if (!fs.existsSync(betterSqliteSrc)) {
    console.error('Error: better-sqlite3 not found in node_modules');
    process.exit(1);
  }
  
  // Remove existing standalone module
  if (fs.existsSync(betterSqliteDest)) {
    fs.rmSync(betterSqliteDest, { recursive: true, force: true });
  }
  
  // Copy the rebuilt module
  execSync(`cp -RL "${betterSqliteSrc}" "${betterSqliteDest}"`, { stdio: 'ignore' });
  
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
  
  // Step 3: Rebuild for system Node.js (for development)
  console.log('\nStep 3: Rebuilding better-sqlite3 for system Node.js (development use)...');
  execSync('npm rebuild better-sqlite3', {
    cwd: projectRoot,
    stdio: 'ignore'
  });
  
  console.log('\n✅ Standalone native module rebuild complete!');
  
} catch (error) {
  console.error('\n❌ Rebuild failed:', error.message);
  process.exit(1);
}
