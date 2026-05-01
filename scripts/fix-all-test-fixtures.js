#!/usr/bin/env node

/**
 * Comprehensive test fixture fixes - Add missing enabledModels to all config types
 */

const fs = require('fs');
const path = require('path');

function findTestFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && file === '__tests__') {
      const testFiles = fs.readdirSync(filePath);
      testFiles.forEach(testFile => {
        if (testFile.endsWith('.test.ts')) {
          fileList.push(path.join(filePath, testFile));
        }
      });
    } else if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      findTestFiles(filePath, fileList);
    }
  });
  
  return fileList;
}

// Find all test files starting from src
const testFiles = findTestFiles(path.join(process.cwd(), 'src'));

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changeCount = 0;
  const originalContent = content;

  // Fix 1: Add enabledModels to LiteLLMConfig/OllamaConfig after cachedModels
  content = content.replace(
    /(cachedModels:\s*JSON\.stringify\([^)]+\)),\s*\n(\s+lastValidated:)/g,
    (match, cachedModelsLine, indent) => {
      changeCount++;
      return `${cachedModelsLine},\n${indent.slice(0, -15)}enabledModels: '[]',\n${indent}`;
    }
  );

  // Fix 2: Add enableCitations and enableEmojis to Generation mocks with sourceMap: JSON.stringify
  content = content.replace(
    /(sourceMap:\s*JSON\.stringify\([^)]+\)),\s*\n(\s+createdAt:)/g,
    (match, sourceMapLine, indent) => {
      changeCount++;
      return `${sourceMapLine},\n${indent.slice(0, -10)}enableCitations: false,\n${indent.slice(0, -10)}enableEmojis: false,\n${indent}`;
    }
  );

  // Fix 3: Add voice field to StyleProfile mocks
  content = content.replace(
    /(tone:\s*'[^']*',\s*\n\s+vocabulary:)/g,
    (match, toneLine) => {
      changeCount++;
      return toneLine.replace(/(tone:\s*'[^']*',)/, '$1\n        voice: null,');
    }
  );

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed ${changeCount} patterns in ${filePath}`);
    return changeCount;
  } else {
    return 0;
  }
}

let totalFixes = 0;
for (const file of testFiles) {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    totalFixes += fixFile(fullPath);
  }
}

console.log(`\n✅ Total fix patterns applied across ${testFiles.length} files: ${totalFixes}`);