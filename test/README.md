# PostMaster Test Suite

Comprehensive testing infrastructure for PostMaster to ensure quality and prevent regressions during releases.

## Test Structure

```
postmaster/
├── test/
│   ├── setup.ts              # Global test setup
│   ├── fixtures/             # Shared test data
│   ├── mocks/                # Mock factories for AI providers
│   └── helpers/              # Test utilities (DB seeding, etc.)
├── src/
│   ├── lib/__tests__/        # Utility layer tests
│   ├── app/api/__tests__/    # API route tests
│   ├── components/**/__tests__/ # Component tests
│   └── hooks/__tests__/      # React hooks tests
├── e2e/                      # End-to-end tests
│   └── *.spec.ts
├── vitest.config.ts          # Vitest configuration
├── playwright.config.ts      # Playwright configuration
└── scripts/
    └── pre-release-checks.js # Pre-release validation
```

## Running Tests

### Unit & Integration Tests

```bash
# Run all tests once
pnpm test:unit

# Run tests in watch mode (for development)
pnpm test:watch

# Run with coverage report
pnpm test:coverage

# Open interactive UI
pnpm test:ui
```

### E2E Tests

```bash
# Run E2E tests
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui
```

### Pre-Release Validation

```bash
# Run all pre-release checks
pnpm pre-release

# Skip security audit (faster)
SKIP_AUDIT=true pnpm pre-release
```

## Coverage Goals

- **Critical paths** (utilities, AI, API routes): 90%+
- **Components**: 70%+
- **Overall**: 80%+

Current coverage is displayed after running `pnpm test:coverage`.

## Test Categories

### ✅ Utility Layer Tests (60 tests)

Tests for pure functions with no external dependencies:

- **Encryption** (`src/lib/__tests__/encryption.test.ts`): AES-256-GCM encryption, key management
- **Streaming** (`src/lib/__tests__/streaming.test.ts`): SSE formatting, stream creation
- **Providers** (`src/lib/ai/__tests__/providers.test.ts`): Model selection, provider configuration

### 📝 API Route Tests (Sample)

Tests for Next.js API routes:

- **Preferences** (`src/app/api/__tests__/preferences.test.ts`): User preferences CRUD

**TODO**: Add tests for:
- `/api/generate` - Content generation
- `/api/iterate` - Content iteration
- `/api/synthesize` - Multi-model synthesis
- `/api/keys` - API key management
- `/api/litellm` - LiteLLM configuration
- `/api/knowledge` - Knowledge base operations
- `/api/critique` - Model critiques

### 🎭 E2E Tests (Sample)

Tests for critical user flows:

- **Setup** (`e2e/setup.spec.ts`): First-time user experience, API key setup

**TODO**: Add tests for:
- Content generation workflow
- Synthesis strategies (basic, sequential, debate)
- Iteration and refinement
- Knowledge base usage
- History and version diffing

## Adding New Tests

### 1. Unit Test Template

```typescript
import { describe, it, expect } from 'vitest';
import { functionToTest } from '@/lib/module';

describe('Module Name', () => {
  describe('functionToTest', () => {
    it('should handle normal case', () => {
      const result = functionToTest('input');
      expect(result).toBe('expected');
    });

    it('should handle edge case', () => {
      const result = functionToTest('');
      expect(result).toBe('');
    });

    it('should throw on invalid input', () => {
      expect(() => functionToTest(null)).toThrow();
    });
  });
});
```

### 2. API Route Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/route-name/route';

// Mock external dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    model: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('API: /api/route-name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return data', async () => {
    const response = await GET();
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('result');
  });
});
```

### 3. Component Test Template

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  it('should render without crashing', () => {
    render(<ComponentName />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### 4. E2E Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should complete user flow', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.click('button:has-text("Action")');
    await expect(page.locator('text=Success')).toBeVisible();
  });
});
```

## Mocking Strategy

### AI Provider Mocks

All AI provider calls are mocked during tests to:
- Avoid real API costs
- Ensure fast, reliable tests
- Enable testing without API keys

Mock factories are available in `test/mocks/ai-providers.ts`.

### Database Mocks

Prisma operations are mocked using Vitest mocks. For integration tests, use in-memory SQLite.

### External APIs

HTTP calls are mocked using MSW (Mock Service Worker).

## Continuous Integration

GitHub Actions automatically runs:
1. **On every PR**: Unit tests, TypeScript check, lint
2. **On push to main**: Full test suite including E2E
3. **On release tags**: Pre-release validation + Electron build

See `.github/workflows/test.yml` for the complete pipeline.

## Pre-Release Checklist

Before releasing a new version, the pre-release script validates:

- ✅ TypeScript compilation (no errors)
- ✅ ESLint passes
- ✅ All unit tests pass
- ✅ Coverage meets thresholds (80%+ overall)
- ✅ Prisma schema is valid
- ✅ No high-severity security vulnerabilities
- ✅ Version format is correct
- ✅ Critical files exist

## Best Practices

### Test Naming

Use descriptive test names that explain what is being tested:

```typescript
// ✅ Good
it('should return null when no models are available', () => {});

// ❌ Bad
it('works', () => {});
```

### Test Independence

Each test should be independent and not rely on the state from other tests:

```typescript
// ✅ Good
beforeEach(() => {
  vi.clearAllMocks();
  // Reset any shared state
});

// ❌ Bad
// Tests that depend on execution order
```

### Avoid Flaky Tests

- Don't use hardcoded delays (`setTimeout`)
- Use `waitFor` and proper async handling
- Mock time when needed with `vi.useFakeTimers()`

### Keep Tests Fast

- Mock external APIs
- Use in-memory databases
- Parallelize when possible
- Skip expensive operations in unit tests

## Troubleshooting

### Tests are failing locally but pass in CI

- Check Node.js version matches CI (20.x)
- Clear `node_modules` and reinstall: `rm -rf node_modules && pnpm install`
- Regenerate Prisma client: `npx prisma generate`

### Coverage is below threshold

- Run `pnpm test:coverage` to see detailed report
- Open `coverage/index.html` in browser for visual breakdown
- Focus on critical paths first (utilities, API routes)

### E2E tests are timing out

- Increase timeout in `playwright.config.ts`
- Check if dev server is running
- Verify no port conflicts

### Mocks aren't working

- Check that `vi.mock()` is called at the top level
- Use `vi.clearAllMocks()` in `beforeEach`
- Verify mock paths match import paths

## Next Steps

1. **Add more API route tests** - Cover all endpoints in `src/app/api/`
2. **Add component tests** - Test complex components with user interactions
3. **Expand E2E tests** - Cover all critical user flows
4. **Add integration tests** - Test AI provider integrations with mocks
5. **Set up coverage tracking** - Use Codecov or similar service

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [MSW Documentation](https://mswjs.io/)
