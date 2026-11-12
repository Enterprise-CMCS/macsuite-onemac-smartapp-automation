import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/unit',
    timeout: 15_000,
    workers: 1,
    retries: 0,
    reporter: 'list',
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});