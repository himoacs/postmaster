#!/usr/bin/env node
/**
 * Fix standalone build for pnpm
 * 
 * pnpm uses symlinks which rsync may not resolve correctly.
 * This script copies missing modules from node_modules to the standalone folder.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const standaloneDir = path.join(__dirname, '..', '.next', 'standalone_flat', 'node_modules');
const nodeModulesDir = path.join(__dirname, '..', 'node_modules');

// Modules that need to be fully copied (not just symlink stubs)
const modulesToCopy = [
  '@swc/helpers',
  '@next/env',
  'next',        // Required for server.js - standalone only copies next/dist
  'caniuse-lite',
  'client-only',
  'server-only',
  'bindings',
  'file-uri-to-path',
  '@prisma/client', // .prisma/client is handled separately below
  'better-sqlite3', // Must copy with native .node bindings
];

function copyModuleRecursive(src, dest) {
  // Create destination directory
  fs.mkdirSync(dest, { recursive: true });
  
  // Copy using Node.js fs.cpSync to follow symlinks (cross-platform)
  try {
    const realSrc = fs.realpathSync(src);
    // Copy contents of src directory to dest
    const entries = fs.readdirSync(realSrc);
    for (const entry of entries) {
      const srcPath = path.join(realSrc, entry);
      const destPath = path.join(dest, entry);
      fs.cpSync(srcPath, destPath, { recursive: true, dereference: true });
    }
    console.log(`  ✓ Copied ${path.basename(src)}`);
  } catch (e) {
    console.log(`  ✗ Failed to copy ${path.basename(src)}: ${e.message}`);
  }
}

function findModuleInPnpm(moduleName) {
  // Try direct path first
  const directPath = path.join(nodeModulesDir, moduleName);
  if (fs.existsSync(directPath)) {
    // Check if it's a real directory or just a stub
    const pkgPath = path.join(directPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const stat = fs.lstatSync(directPath);
      if (!stat.isSymbolicLink()) {
        return directPath;
      }
      // It's a symlink, resolve it
      return fs.realpathSync(directPath);
    }
  }
  
  // Search in .pnpm folder
  const pnpmDir = path.join(nodeModulesDir, '.pnpm');
  if (fs.existsSync(pnpmDir)) {
    const moduleDirName = moduleName.replace(/\//g, '+');
    const entries = fs.readdirSync(pnpmDir);
    for (const entry of entries) {
      if (entry.startsWith(moduleDirName + '@')) {
        const fullPath = path.join(pnpmDir, entry, 'node_modules', moduleName);
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
      }
    }
  }
  
  return null;
}

console.log('Fixing standalone build for pnpm...\n');

for (const moduleName of modulesToCopy) {
  const destPath = path.join(standaloneDir, moduleName);
  
  // Check if module exists in standalone but is incomplete
  const destPkgPath = path.join(destPath, 'package.json');
  let needsCopy = !fs.existsSync(destPkgPath);
  
  if (!needsCopy) {
    // Check if it's just a stub (only package.json, no actual code)
    const files = fs.readdirSync(destPath);
    if (files.length <= 2) { // Just package.json and maybe README
      needsCopy = true;
    }
  }
  
  if (needsCopy) {
    console.log(`Copying ${moduleName}...`);
    const srcPath = findModuleInPnpm(moduleName);
    if (srcPath) {
      // Remove the stub if exists
      if (fs.existsSync(destPath)) {
        fs.rmSync(destPath, { recursive: true, force: true });
      }
      copyModuleRecursive(srcPath, destPath);
    } else {
      console.log(`  ✗ Could not find ${moduleName} in node_modules`);
    }
  }
}

// Special handling for Prisma - copy .prisma/client directory
const prismaClientPath = path.join(standaloneDir, '@prisma', 'client');
if (fs.existsSync(prismaClientPath)) {
  console.log('Copying .prisma/client for Prisma...');
  
  // Find the .prisma/client directory in pnpm structure
  const pnpmDir = path.join(nodeModulesDir, '.pnpm');
  if (fs.existsSync(pnpmDir)) {
    const entries = fs.readdirSync(pnpmDir);
    let foundPrismaClient = false;
    
    for (const entry of entries) {
      if (entry.startsWith('@prisma+client@')) {
        const prismaGenPath = path.join(pnpmDir, entry, 'node_modules', '.prisma', 'client');
        if (fs.existsSync(prismaGenPath)) {
          // Copy to both locations where Prisma might look
          const destLocations = [
            path.join(prismaClientPath, '.prisma', 'client'),
            path.join(standaloneDir, '.prisma', 'client'),
          ];
          
          for (const destPrismaPath of destLocations) {
            fs.mkdirSync(path.dirname(destPrismaPath), { recursive: true });
            try {
              fs.cpSync(prismaGenPath, destPrismaPath, { recursive: true, dereference: true });
            } catch (e) {
              console.log(`  ✗ Failed to copy to ${destPrismaPath}:`, e.message);
            }
          }
          console.log('  ✓ Copied .prisma/client');
          foundPrismaClient = true;
          break;
        }
      }
    }
    
    if (!foundPrismaClient) {
      console.log('  ✗ Could not find .prisma/client in pnpm structure');
    }
  }
}

// Special handling for better-sqlite3 - also copy to .next/node_modules traced directory
// Next.js traces native modules to .next/node_modules/better-sqlite3-xxxx/
const standaloneNextDir = path.join(__dirname, '..', '.next', 'standalone_flat', '.next', 'node_modules');
if (fs.existsSync(standaloneNextDir)) {
  const nextNodeModulesEntries = fs.readdirSync(standaloneNextDir);
  const betterSqliteTraced = nextNodeModulesEntries.find(e => e.startsWith('better-sqlite3-'));
  
  if (betterSqliteTraced) {
    console.log(`\nFound Next.js traced better-sqlite3: ${betterSqliteTraced}`);
    
    // Copy native module from node_modules/better-sqlite3 to the traced directory
    const srcNativeModule = path.join(standaloneDir, 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
    const destTracedDir = path.join(standaloneNextDir, betterSqliteTraced, 'build', 'Release');
    
    if (fs.existsSync(srcNativeModule)) {
      fs.mkdirSync(destTracedDir, { recursive: true });
      const destNativeModule = path.join(destTracedDir, 'better_sqlite3.node');
      fs.cpSync(srcNativeModule, destNativeModule);
      console.log(`  ✓ Copied native module to ${betterSqliteTraced}/build/Release/`);
    } else {
      console.log(`  ⚠ Native module not found at ${srcNativeModule}`);
    }
  }
}

console.log('\nStandalone fix complete!');
