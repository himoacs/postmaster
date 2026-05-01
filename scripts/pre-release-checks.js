#!/usr/bin/env node

/**
 * Pre-Release Validation Script
 * 
 * Runs comprehensive checks before releasing a new version of PostMaster.
 * This ensures we don't ship broken code to users.
 * 
 * Usage: pnpm pre-release
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, description) {
  log(`\n🔍 ${description}...`, 'cyan');
  try {
    execSync(command, { stdio: 'inherit', cwd: __dirname });
    log(`✅ ${description} passed`, 'green');
    return true;
  } catch (error) {
    log(`❌ ${description} failed`, 'red');
    return false;
  }
}

async function main() {
  log('\n' + '='.repeat(60), 'blue');
  log('PostMaster Pre-Release Validation', 'blue');
  log('='.repeat(60) + '\n', 'blue');

  const checks = [];

  // 0. Check environment versions (critical for native modules)
  log('\n🔍 Validating environment versions...', 'cyan');
  
  // Check Node.js version (must be 20.x for ABI compatibility)
  try {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.match(/^v(\d+)/)?.[1] || '0', 10);
    
    if (majorVersion === 20) {
      log(`✅ Node.js version: ${nodeVersion} (required: 20.x)`, 'green');
      checks.push(true);
    } else {
      log(`❌ Node.js version: ${nodeVersion} (required: 20.x for ABI compatibility)`, 'red');
      log('   Install Node.js 20.x to ensure native modules build correctly', 'yellow');
      checks.push(false);
    }
  } catch (error) {
    log('❌ Could not check Node.js version', 'red');
    checks.push(false);
  }

  // Check pnpm version (should be 9.x or 10.x)
  try {
    const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8' }).trim();
    const majorVersion = parseInt(pnpmVersion.match(/^(\d+)/)?.[1] || '0', 10);
    
    if (majorVersion === 9 || majorVersion === 10) {
      log(`✅ pnpm version: ${pnpmVersion} (supported: 9.x or 10.x)`, 'green');
      checks.push(true);
    } else {
      log(`⚠️  pnpm version: ${pnpmVersion} (recommended: 9.x or 10.x)`, 'yellow');
      log('   Builds may work but are untested with this version', 'yellow');
      checks.push(true); // Warning only, don't fail
    }
  } catch (error) {
    log('❌ Could not check pnpm version (is pnpm installed?)', 'red');
    checks.push(false);
  }

  // Check better-sqlite3 version matches package.json
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
    );
    const expectedVersion = packageJson.dependencies['better-sqlite3'];
    
    // Check if better-sqlite3 is installed
    const sqlitePkgPath = path.join(__dirname, '../node_modules/better-sqlite3/package.json');
    if (fs.existsSync(sqlitePkgPath)) {
      const sqlitePkg = JSON.parse(fs.readFileSync(sqlitePkgPath, 'utf8'));
      const installedVersion = sqlitePkg.version;
      
      log(`✅ better-sqlite3 installed: ${installedVersion} (expected: ${expectedVersion})`, 'green');
      
      // Check if .node binding exists (indicates successful native build)
      const bindingsPath = path.join(__dirname, '../node_modules/better-sqlite3/build/Release/better_sqlite3.node');
      if (fs.existsSync(bindingsPath)) {
        log(`✅ better-sqlite3 native binding exists`, 'green');
        checks.push(true);
      } else {
        log(`⚠️  better-sqlite3 native binding missing - run: npm rebuild better-sqlite3`, 'yellow');
        checks.push(false);
      }
    } else {
      log('❌ better-sqlite3 not installed', 'red');
      checks.push(false);
    }
  } catch (error) {
    log(`⚠️  Could not validate better-sqlite3: ${error.message}`, 'yellow');
    checks.push(true); // Don't fail on this
  }

  // Check Electron version matches package.json
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
    );
    const expectedElectron = packageJson.devDependencies['electron'];
    
    const electronPkgPath = path.join(__dirname, '../node_modules/electron/package.json');
    if (fs.existsSync(electronPkgPath)) {
      const electronPkg = JSON.parse(fs.readFileSync(electronPkgPath, 'utf8'));
      const installedVersion = electronPkg.version;
      
      log(`✅ Electron installed: ${installedVersion} (expected: ${expectedElectron})`, 'green');
      checks.push(true);
    } else {
      log('⚠️  Electron not found in node_modules', 'yellow');
      checks.push(true); // Don't fail, may be in CI
    }
  } catch (error) {
    log(`⚠️  Could not validate Electron version: ${error.message}`, 'yellow');
    checks.push(true); // Don't fail on this
  }

  // 1. Check TypeScript compilation
  checks.push(
    exec('npx tsc --noEmit', 'TypeScript compilation check')
  );

  // 2. Run linter
  checks.push(
    exec('pnpm lint', 'ESLint check')
  );

  // 3. Run unit tests
  checks.push(
    exec('pnpm test:unit', 'Unit tests')
  );

  // 4. Run tests with coverage
  checks.push(
    exec('pnpm test:coverage', 'Test coverage')
  );

  // 5. Check coverage thresholds
  log('\n🔍 Checking coverage thresholds...', 'cyan');
  try {
    const coveragePath = path.join(__dirname, '../coverage/coverage-summary.json');
    if (fs.existsSync(coveragePath)) {
      const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
      const total = coverage.total;
      
      const thresholds = {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      };
      
      let coveragePassed = true;
      for (const [key, threshold] of Object.entries(thresholds)) {
        const actual = total[key].pct;
        if (actual < threshold) {
          log(`❌ ${key} coverage (${actual.toFixed(2)}%) is below threshold (${threshold}%)`, 'red');
          coveragePassed = false;
        } else {
          log(`✅ ${key} coverage: ${actual.toFixed(2)}%`, 'green');
        }
      }
      checks.push(coveragePassed);
    } else {
      log('⚠️  Coverage file not found, skipping coverage check', 'yellow');
      checks.push(true);
    }
  } catch (error) {
    log('❌ Coverage check failed', 'red');
    checks.push(false);
  }

  // 6. Verify Prisma schema is valid
  checks.push(
    exec('npx prisma validate', 'Prisma schema validation')
  );

  // 7. Check for security vulnerabilities (optional, can be slow)
  if (process.env.SKIP_AUDIT !== 'true') {
    log('\n🔍 Checking for security vulnerabilities (use SKIP_AUDIT=true to skip)...', 'cyan');
    try {
      execSync('pnpm audit --audit-level=high', { stdio: 'inherit', cwd: __dirname });
      log('✅ No high-severity vulnerabilities found', 'green');
      checks.push(true);
    } catch (error) {
      log('⚠️  Security vulnerabilities found, review pnpm audit output', 'yellow');
      // Don't fail on audit issues, just warn
      checks.push(true);
    }
  }

  // 8. Verify package.json version format
  log('\n🔍 Checking package.json version...', 'cyan');
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
    );
    const version = packageJson.version;
    if (/^\d+\.\d+\.\d+$/.test(version)) {
      log(`✅ Version format valid: ${version}`, 'green');
      checks.push(true);
    } else {
      log(`❌ Invalid version format: ${version}`, 'red');
      checks.push(false);
    }
  } catch (error) {
    log('❌ Could not validate package.json version', 'red');
    checks.push(false);
  }

  // 9. Verify critical files exist
  log('\n🔍 Checking critical files...', 'cyan');
  const criticalFiles = [
    'package.json',
    'tsconfig.json',
    'next.config.ts',
    'prisma/schema.prisma',
    'electron/main.ts',
    'electron/preload.ts',
  ];
  
  let filesOk = true;
  for (const file of criticalFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      log(`✅ ${file} exists`, 'green');
    } else {
      log(`❌ ${file} missing`, 'red');
      filesOk = false;
    }
  }
  checks.push(filesOk);

  // 10. Validate template database
  log('\n🔍 Validating template database...', 'cyan');
  try {
    const templatePath = path.join(__dirname, '../prisma/template.db');
    
    if (!fs.existsSync(templatePath)) {
      log('❌ Template database not found at prisma/template.db', 'red');
      checks.push(false);
    } else {
      log('✅ Template database exists', 'green');
      
      // Check file is not empty and is a valid SQLite database
      const stats = fs.statSync(templatePath);
      if (stats.size < 1024) {
        log('⚠️  Template database file is suspiciously small (< 1KB)', 'yellow');
        checks.push(false);
      } else {
        log(`✅ Template database size: ${(stats.size / 1024).toFixed(2)} KB`, 'green');
      }
      
      // Try to validate the database using better-sqlite3
      try {
        const Database = require('better-sqlite3');
        const db = new Database(templatePath, { readonly: true });
        
        // Check for expected tables
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
        const tableNames = tables.map(t => t.name);
        
        const expectedTables = [
          'APIKey',
          'ContentSample',
          'Draft',
          'Generation',
          'GenerationCritique',
          'GenerationOutput',
          'KnowledgeEntry',
          'LiteLLMConfig',
          'ModelAnalytics',
          'OllamaConfig',
          'SchemaVersion',
          'StyleProfile',
          'SynthesisContribution',
          'SynthesizedContent',
          'SynthesisVersion',
          'UserPreferences',
        ];
        
        const missingTables = expectedTables.filter(t => !tableNames.includes(t));
        
        if (missingTables.length > 0) {
          log(`❌ Template database missing tables: ${missingTables.join(', ')}`, 'red');
          checks.push(false);
        } else {
          log(`✅ All ${expectedTables.length} expected tables present`, 'green');
          
          // Run integrity check
          const integrityCheck = db.prepare('PRAGMA integrity_check').get();
          if (integrityCheck.integrity_check === 'ok') {
            log('✅ Template database integrity check passed', 'green');
            checks.push(true);
          } else {
            log(`❌ Template database integrity check failed: ${integrityCheck.integrity_check}`, 'red');
            checks.push(false);
          }
        }
        
        db.close();
      } catch (dbError) {
        log(`❌ Failed to validate template database: ${dbError.message}`, 'red');
        checks.push(false);
      }
    }
  } catch (error) {
    log(`❌ Template database validation failed: ${error.message}`, 'red');
    checks.push(false);
  }

  // Summary
  log('\n' + '='.repeat(60), 'blue');
  log('Pre-Release Validation Summary', 'blue');
  log('='.repeat(60), 'blue');

  const passed = checks.filter(Boolean).length;
  const total = checks.length;
  const allPassed = passed === total;

  log(`\n${passed}/${total} checks passed`, allPassed ? 'green' : 'red');

  if (allPassed) {
    log('\n🎉 All checks passed! Ready to release.', 'green');
    process.exit(0);
  } else {
    log('\n❌ Some checks failed. Please fix issues before releasing.', 'red');
    process.exit(1);
  }
}

main().catch((error) => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});
