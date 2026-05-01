#!/usr/bin/env node

/**
 * Fix test fixtures by adding missing fields to mocks
 */

const fs = require('fs');
const path = require('path');

const testFiles = [
  'src/app/api/__tests__/critique.test.ts',
  'src/app/api/__tests__/iterate.test.ts',
  'src/app/api/__tests__/keys.test.ts',
  'src/app/api/__tests__/generate.test.ts',
];

function fixFile(filePath) {
  console.log(`Fixing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changeCount = 0;

  // Pattern 1: Add enabledModels to LiteLLMConfig/OllamaConfig after cachedModels
  const pattern1 = /(cachedModels:\s*'[^']*'),\s*\n(\s*lastValidated:)/g;
  const newContent1 = content.replace(pattern1, (match, cachedModelsLine, lastValidatedLine) => {
    changeCount++;
    return `${cachedModelsLine},\n          enabledModels: '[]',\n${lastValidatedLine}`;
  });
  
  if (newContent1 !== content) {
    content = newContent1;
  }

  // Pattern 2: Add enableCitations and enableEmojis to Generation after sourceMap
  const pattern2 = /(sourceMap:\s*(?:null|'[^']*')),\s*\n(\s*createdAt:)/g;
  const newContent2 = content.replace(pattern2, (match, sourceMapLine, createdAtLine) => {
    changeCount++;
    return `${sourceMapLine},\n          enableCitations: false,\n          enableEmojis: false,\n${createdAtLine}`;
  });
  
  if (newContent2 !== content) {
    content = newContent2;
  }

  // Pattern 3: Fix Generation mocks with sourceMap after createdAt/updatedAt (wrong order)
  // Find patterns like: createdAt: ..., updatedAt: ..., sourceMap: null
  // And convert to: sourceMap: null, enableCitations: false, enableEmojis: false, createdAt: ..., updatedAt: ...
  const pattern3 = /(contentMode:\s*'[^']*',\s*\n\s*sourceContent:\s*(?:null|'[^']*'),\s*\n\s*)(createdAt:\s*new Date\(\),\s*\n\s*updatedAt:\s*new Date\(\),\s*\n\s*sourceMap:\s*null)/g;
  const newContent3 = content.replace(pattern3, (match, prefix, wrongOrder) => {
    changeCount++;
    return `${prefix}sourceMap: null,\n          enableCitations: false,\n          enableEmojis: false,\n          createdAt: new Date(),\n          updatedAt: new Date()`;
  });
  
  if (newContent3 !== content) {
    content = newContent3;
  }

  // Pattern 4: Add missing fields to StyleProfile
  const pattern4 = /(vocabulary:\s*'[^']*'),\s*\n(\s*createdAt:)/g;
  const newContent4 = content.replace(pattern4, (match, vocabularyLine, createdAtLine) => {
    changeCount++;
    return `${vocabularyLine},\n          sentence: null,\n          patterns: null,\n          uniqueVocabulary: null,\n          avoidPatterns: null,\n          writingQuirks: null,\n          sampleExcerpts: null,\n          openingStyles: null,\n          closingStyles: null,\n          bio: null,\n          context: null,\n          overrides: null,\n          analyzedAt: null,\n${createdAtLine}`;
  });
  
  if (newContent4 !== content) {
    content = newContent4;
  }

  if (changeCount > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed ${changeCount} patterns in ${filePath}`);
  } else {
    console.log(`⏭️  No changes needed in ${filePath}`);
  }
  
  return changeCount;
}

let totalFixes = 0;
for (const file of testFiles) {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    totalFixes += fixFile(fullPath);
  } else {
    console.log(`⚠️  File not found: ${file}`);
  }
}

console.log(`\n✅ Total fix patterns applied: ${totalFixes}`);
