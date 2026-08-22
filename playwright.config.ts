import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results/e2e',
  timeout: 120_000,
  expect: {
    timeout: 90_000
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    trace: 'retain-on-failure'
  }
})
