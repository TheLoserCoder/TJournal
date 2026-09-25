import { defineConfig } from '@playwright/test';

/**
 * Electron E2E runs the built desktop app through the local Electron binary.
 * Windows always appear; runs are serial because each scenario owns the
 * application process and a temporary vault workspace.
 */
export default defineConfig({
  expect: { timeout: 15_000 },
  fullyParallel: false,
  outputDir: 'test-results/e2e',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  testDir: './test/e2e',
  timeout: 90_000,
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  workers: 1,
});
