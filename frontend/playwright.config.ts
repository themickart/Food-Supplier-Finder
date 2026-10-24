import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || (process.env.PLAYWRIGHT_STANDALONE ? 'http://127.0.0.1:4173/Food-Supplier-Finder/' : 'http://127.0.0.1:8000'), trace: 'retain-on-failure' },
  webServer: process.env.PLAYWRIGHT_STANDALONE ? {
    command: 'npm run preview -- --mode pages --port 4173',
    url: 'http://127.0.0.1:4173/Food-Supplier-Finder/',
    reuseExistingServer: !process.env.CI,
  } : undefined,
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
})
