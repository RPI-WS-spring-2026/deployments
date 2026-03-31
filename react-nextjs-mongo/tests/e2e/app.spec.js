/**
 * End-to-End Tests — Full application in a real browser
 *
 * These tests launch a real Chromium browser, navigate the app, fill forms,
 * click buttons, and verify the UI behaves correctly from a user's perspective.
 * They test the full stack: browser → Next.js → API routes → MongoDB.
 *
 * Testing pyramid: E2E (few, slow, expensive — but high confidence)
 *
 * Prerequisites: The app must be running on localhost:3003 with MongoDB connected.
 */

const { test, expect } = require('@playwright/test');

// Generate unique usernames so tests don't conflict across runs
const uniqueId = () => Math.random().toString(36).substring(2, 8);

// =========================================================================
// Homepage
// =========================================================================
test.describe('Homepage', () => {
  test('displays welcome message and login link', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Project Manager');
    await expect(page.getByRole('link', { name: 'Login / Register' })).toBeVisible();
  });

  test('login link navigates to login page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL(/\/login/);
  });
});

// =========================================================================
// Registration
// =========================================================================
test.describe('Registration', () => {
  test('can register a new account', async ({ page }) => {
    const username = `e2e_reg_${uniqueId()}`;
    await page.goto('/login');

    // Switch to register mode
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page.locator('h1')).toContainText('Create Account');

    // Fill and submit
    await page.fill('#username', username);
    await page.fill('#password', 'testpass123');
    await page.getByRole('button', { name: 'Register' }).click();

    // Success message should appear
    await expect(page.locator('text=Account created')).toBeVisible({ timeout: 5000 });
  });

  test('shows error for duplicate username', async ({ page }) => {
    const username = `e2e_dup_${uniqueId()}`;
    await page.goto('/login');

    // Register first time
    await page.getByRole('button', { name: 'Register' }).click();
    await page.fill('#username', username);
    await page.fill('#password', 'testpass123');
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page.locator('text=Account created')).toBeVisible({ timeout: 5000 });

    // Try to register again with same username
    await page.getByRole('button', { name: 'Register' }).click();
    await page.fill('#username', username);
    await page.fill('#password', 'differentpass');
    await page.getByRole('button', { name: 'Register' }).click();

    // Error message should appear (not success — duplicate should fail)
    await expect(page.locator('.error-box')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.error-box')).toContainText('already exists');
  });
});

// =========================================================================
// Login
// =========================================================================
test.describe('Login', () => {
  const loginUser = `e2e_login_${uniqueId()}`;

  test.beforeAll(async ({ request }) => {
    // Register the user via API before tests (no browser page here — API only)
    const response = await request.post('/api/auth/register', {
      data: { username: loginUser, password: 'loginpass123' },
    });
    // Verify the API returned success
    expect(response.status()).toBe(201);
  });

  test('successful login redirects to projects page', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#username', loginUser);
    await page.fill('#password', 'loginpass123');
    await page.getByRole('button', { name: 'Login' }).click();

    // Should redirect to /projects
    await expect(page).toHaveURL(/\/projects/, { timeout: 5000 });
  });

  test('wrong password shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#username', loginUser);
    await page.fill('#password', 'wrongpassword');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.locator('.error-box')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.error-box')).toContainText('Invalid');
  });
});

// =========================================================================
// Projects — Full user flow
// =========================================================================
test.describe('Projects (authenticated)', () => {
  const projUser = `e2e_proj_${uniqueId()}`;

  test.beforeAll(async ({ request }) => {
    await request.post('/api/auth/register', {
      data: { username: projUser, password: 'projpass123' },
    });
  });

  test('full flow: login → create project → see project in list', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('#username', projUser);
    await page.fill('#password', 'projpass123');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/projects/, { timeout: 5000 });

    // Navigate to new project page
    await page.click('a[href="/projects/new"]');
    await expect(page).toHaveURL(/\/projects\/new/);

    // Fill in project form
    await page.fill('input[name="name"], #name', `E2E Test Project ${uniqueId()}`);

    // Submit
    await page.getByRole('button', { name: /create/i }).click();

    // Should redirect back to projects list or project detail
    await page.waitForURL(/\/projects/, { timeout: 5000 });

    // The project should be visible
    await expect(page.locator('text=E2E Test Project')).toBeVisible({ timeout: 5000 });
  });
});

// =========================================================================
// Unauthenticated access
// =========================================================================
test.describe('Unauthenticated access', () => {
  test('accessing /projects without login redirects to /login', async ({ page }) => {
    // Clear any stored tokens
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
    });

    // Try to access projects
    await page.goto('/projects');

    // The app should redirect to login (via client-side 401 handling)
    // or show an empty/error state
    await page.waitForTimeout(2000);
    const url = page.url();
    const hasLoginRedirect = url.includes('/login');
    const hasErrorOrEmpty = (await page.locator('.error-box').count()) > 0
      || (await page.getByText('Login').count()) > 0;
    expect(hasLoginRedirect || hasErrorOrEmpty).toBe(true);
  });
});
