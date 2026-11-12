import { expect } from '@playwright/test';
import { test } from '../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { currentSpaStore } from '../../../support/data/spa-store';

const cpocName = 'CPOC4 Automation';

// CPOC_SPA_ID targets a specific Pending - Second Clock record. Without it, the newest Pending - Second Clock SPA is used.
// The lookup runs before login, so the test fails without opening a browser when no record is ready.
let targetSpaId: string;
test.beforeAll(async () => {
    targetSpaId = process.env.CPOC_SPA_ID ?? (await (await currentSpaStore(appUrls.onemac, spaOptionsFromEnv())).latestPendingSecondClock()).spaId;
});
// The shared fixture defaults to the newest submitted SPA, which intake has already handed off.
test.use({ spaId: async ({ }, use) => use(targetSpaId) });
test.use({ smartRole: 'CPOC' });

test('CPOC recommends approval for the RAI response in Pending - Second Clock', async ({ navigation, page, recordSearch, spaRecord, spaStore }) => {
    await navigation.openSmartHome();
    await recordSearch.openSpa(targetSpaId);
    await test.step('Verify the SPA is in Pending - Second Clock', async () => {
        const status = page.getByRole('option', { name: 'Pending - Second Clock', exact: true });
        await expect(status).toHaveCount(1);
        await expect(status).toHaveAttribute('aria-selected', 'true');
    });
    await test.step('Set CPOC Review Progress to Recommending Approval and verify the path', async () => {
        await spaRecord.review.setReviewTeamProgress(cpocName, 'Recommending Approval', targetSpaId, 'second');
    });
    await spaStore.markRaiReviewCompleted(targetSpaId, 'cpoc');
    await test.step('Verify Review row and Pending Concurrence on the main SPA page', async () => {
        await spaRecord.review.expectReviewTeamProgress(cpocName, 'Recommending Approval', 'second');
        const status = page.getByRole('option', { name: 'Pending Concurrence', exact: true });
        await expect(status).toHaveCount(1);
        await expect(status).toHaveAttribute('aria-selected', 'true');
    });
});
