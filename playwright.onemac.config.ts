import { defineConfig, devices } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
    ...config,
    timeout: 5 * 60 * 1_000,
    testDir: './tests/onemac',
    retries: 0,
    projects: [{
        name: 'chromium',
        // The spec starts tracing after login so credentials are not recorded.
        use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 }, trace: 'off' },
    }],
});