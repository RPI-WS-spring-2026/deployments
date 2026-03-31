const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3003',
    headless: true,
  },
  // Start the dev server before running E2E tests (if not already running)
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3003',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
