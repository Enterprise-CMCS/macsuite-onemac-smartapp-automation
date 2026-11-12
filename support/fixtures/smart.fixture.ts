import { test as base } from '@playwright/test';
import { loginAsUser } from '../auth/smart-login';
import { selectedSmartRole, smartCredentials, SmartRole } from '../config/environment';
import { appUrls } from '../config/urls';
import { spaOptionsFromEnv } from '../data/spa';
import { createSpaRecordStore, selectSpaTarget, SpaSubmissionDetails } from '../data/spa-store';
import { SmartNavigation } from '../ui/smart/navigation';
import { SmartRecordSearch } from '../ui/smart/record-search';
import { SpaRecord } from '../ui/smart/spa-record';

type SpaTarget = Awaited<ReturnType<typeof selectSpaTarget>>;

type SmartFixtures = {
    spaTarget: SpaTarget;
    spaId: string;
    spaStore: ReturnType<typeof createSpaRecordStore>;
    onemacSubmission: SpaSubmissionDetails;
    navigation: SmartNavigation;
    recordSearch: SmartRecordSearch;
    spaRecord: SpaRecord;
};

// Specs pin their role with test.use({ smartRole }); otherwise the SF_ROLE environment value is used.
type SmartOptions = {
    smartRole: SmartRole;
};

export const test = base.extend<SmartFixtures & SmartOptions>({
    smartRole: [selectedSmartRole(), { option: true }],
    // SPA_ID selects an existing stored record; otherwise the most recent OneMAC submission in any state. The fixture never creates one.
    spaTarget: async ({ }, use) => {
        await use(await selectSpaTarget(appUrls.onemac, process.env.SPA_ID?.trim(), spaOptionsFromEnv()));
    },
    spaId: async ({ spaTarget }, use) => {
        await use(spaTarget.spaId);
    },
    spaStore: async ({ spaTarget }, use) => {
        await use(createSpaRecordStore(appUrls.onemac, { state: spaTarget.state, year: spaTarget.year, startSequence: 1 }));
    },
    onemacSubmission: async ({ spaTarget }, use) => {
        const record = await createSpaRecordStore(appUrls.onemac, { state: spaTarget.state, year: spaTarget.year, startSequence: 1 }).find(spaTarget.spaId);
        if (!record.details) {
            throw new Error(`No saved OneMAC details for ${spaTarget.spaId}. Rerun OneMAC creation to capture them.`);
        }
        await use(record.details);
    },
    page: async ({ page, spaId, smartRole }, use, testInfo) => {
        testInfo.annotations.push({ type: 'SPA ID', description: spaId });
        testInfo.annotations.push({ type: 'SMART role', description: smartRole });
        await loginAsUser(page, smartCredentials(smartRole));
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
    navigation: async ({ page }, use) => {
        await use(new SmartNavigation(page));
    },
    recordSearch: async ({ page }, use) => {
        await use(new SmartRecordSearch(page));
    },
    spaRecord: async ({ page }, use) => {
        await use(new SpaRecord(page));
    },
});

// Failure screenshots are attached to TestRail results via the testrail_attachment annotation.
test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
        const screenshotPath = testInfo.outputPath('failure.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        testInfo.annotations.push({ type: 'testrail_attachment', description: screenshotPath });
    }
});

export { expect } from '@playwright/test';