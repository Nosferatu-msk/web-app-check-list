import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config для тестирования на production-сервере
 * https://checkonout.ru
 * 
 * Используется для запуска тестов без локальной БД
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'test-reports/html-prod', open: 'never' }],
    ['list'],
  ],
  outputDir: 'test-results-prod',
  use: {
    baseURL: 'https://checkonout.ru',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  timeout: 60_000,
  globalTimeout: 600_000, // 10 минут максимум
});
