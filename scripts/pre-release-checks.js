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
