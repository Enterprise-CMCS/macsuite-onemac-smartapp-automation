import { test as base } from '@playwright/test';
import { loginToOnemac } from '../auth/onemac-login';
import { onemacCredentials } from '../config/environment';

// Logs in first, then traces the rest of the test so credentials are not recorded.
export const test = base.extend({
    page: async ({ page }, use, testInfo) => {
        await loginToOnemac(page, onemacCredentials());
        const tracing = page.context().tracing;
        await tracing.start({ screenshots: true, snapshots: true, sources: true });
        try {
            await use(page);
        } finally {
            const tracePath = testInfo.outputPath('trace.zip');
            await tracing.stop({ path: tracePath });
            await testInfo.attach('trace', { path: tracePath, contentType: 'application/zip' });
        }
    },
});
