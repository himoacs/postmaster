#!/usr/bin/env node
/**
 * Prepare electron dependencies for packaging
 * 
 * pnpm uses symlinks which electron-builder may not resolve correctly.
 * This script copies electron-updater and its dependencies to a flat structure.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const nodeModulesDir = path.join(projectRoot, 'node_modules');
const electronDepsDir = path.join(projectRoot, 'electron-deps');

// Modules needed by electron main process
const electronDeps = [
  'electron-updater',
  'builder-util-runtime',
  'lazy-val',
  'semver',
  'lodash.isequal',
  'typed-emitter',
  'rxjs',
  'js-yaml',
  'argparse',
  'sax',
  'debug',
  'ms',
];

function findRealPath(moduleName) {
  const modulePath = path.join(nodeModulesDir, moduleName);
  
  if (!fs.existsSync(modulePath)) {
    return null;
  }
  
  try {
    // Resolve symlink to actual path
    return fs.realpathSync(modulePath);
  } catch (e) {
    return null;
  }
}

function copyModule(moduleName) {
  const realPath = findRealPath(moduleName);
  const destPath = path.join(electronDepsDir, 'node_modules', moduleName);
  
  if (!realPath) {
    console.log(`  ⚠ Could not find ${moduleName}`);
    return false;
  }
  
  try {
    // Create parent directory for scoped packages
    const parentDir = path.dirname(destPath);
    fs.mkdirSync(parentDir, { recursive: true });
    
    // Remove existing if any
    if (fs.existsSync(destPath)) {
      fs.rmSync(destPath, { recursive: true, force: true });
    }
    
    // Copy following symlinks (cross-platform)
    fs.cpSync(realPath, destPath, { recursive: true, dereference: true });
    console.log(`  ✓ ${moduleName}`);
    return true;
  } catch (e) {
    console.log(`  ✗ ${moduleName}: ${e.message}`);
    return false;
  }
}

console.log('Preparing electron dependencies for packaging...\n');

// Clean and create destination
if (fs.existsSync(electronDepsDir)) {
  fs.rmSync(electronDepsDir, { recursive: true, force: true });
}
fs.mkdirSync(path.join(electronDepsDir, 'node_modules'), { recursive: true });

// Copy each dependency
let success = 0;
let failed = 0;

for (const dep of electronDeps) {
  if (copyModule(dep)) {
    success++;
  } else {
    failed++;
  }
}

console.log(`\nDone: ${success} copied, ${failed} failed`);

// Exit with error if any critical deps failed
if (!fs.existsSync(path.join(electronDepsDir, 'node_modules', 'electron-updater'))) {
  console.error('\nERROR: electron-updater not copied - build may fail');
  process.exit(1);
}
