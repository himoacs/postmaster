/**
 * Example E2E Test - Setup Flow
 * This demonstrates the pattern for E2E testing with Playwright
 */
import { test, expect } from '@playwright/test';

test.describe('First-time Setup Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000');
  });

  test('should show API key setup on first visit', async ({ page }) => {
    // Check if we're redirected to settings or shown a setup modal
    await expect(page.locator('text=API Key').first()).toBeVisible({ timeout: 10000 });
  });

  test('should allow adding an API key', async ({ page }) => {
    // Navigate to settings
    await page.click('text=Settings');
    
    // Find the API key input
    const keyInput = page.locator('input[placeholder*="API"]').first();
    await keyInput.fill('sk-test-key-for-testing');
    
    // Submit the form
    await page.click('button:has-text("Add Key")');
    
    // Verify success message
    await expect(page.locator('text=API key added').or(page.locator('text=Success'))).toBeVisible({
      timeout: 5000,
    });
  });

  test('should auto-select primary model after adding keys', async ({ page }) => {
    // This test assumes keys are already configured
    // Navigate to workspace
    await page.goto('http://localhost:3000/dashboard');
    
    // Check for auto-selection notification
    await expect(
      page.locator('text=Primary model').or(page.locator('text=auto-selected'))
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Content Generation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Assume API keys are already set up
    await page.goto('http://localhost:3000/dashboard');
  });

  test('should allow entering a prompt', async ({ page }) => {
    const promptInput = page.locator('textarea[placeholder*="prompt"]').first();
    await promptInput.fill('Write a blog post about AI testing');
    
    await expect(promptInput).toHaveValue('Write a blog post about AI testing');
  });

  test('should allow selecting models', async ({ page }) => {
    // Find model selector checkboxes
    const modelCheckbox = page.locator('input[type="checkbox"]').first();
    await modelCheckbox.check();
    
    await expect(modelCheckbox).toBeChecked();
  });

  test.skip('should generate content (requires real API)', async ({ page }) => {
    // This test requires real API keys and makes actual API calls
    // Skip by default to avoid costs and external dependencies
    
    const promptInput = page.locator('textarea').first();
    await promptInput.fill('Test prompt');
    
    // Select a model
    await page.locator('input[type="checkbox"]').first().check();
    
    // Click generate
    await page.click('button:has-text("Generate")');
    
    // Wait for generation to complete
    await expect(page.locator('text=Generation complete')).toBeVisible({
      timeout: 60000,
    });
  });
});
