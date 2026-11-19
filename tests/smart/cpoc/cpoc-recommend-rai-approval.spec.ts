import { expect } from '@playwright/test';
import { test } from '../../../support/fixtures/smart.fixture';
import { eachSpa } from '../../../support/ui/smart/each-spa';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { currentSpaStore } from '../../../support/data/spa-store';

const cpocName = 'CPOC4 Automation';

// The Second Clock workflow is the newest RAI response parent plus its splits, parent first, skipping any CPOC already finished in the store.
// CPOC_SPA_ID checks only that one SPA. The lookup runs before login, so the test fails without opening a browser when no record is ready.
let workflowTargetIds: string[];
test.beforeAll(async () => {
    const store = await currentSpaStore(appUrls.onemac, spaOptionsFromEnv());
    workflowTargetIds = process.env.CPOC_SPA_ID ? [process.env.CPOC_SPA_ID] : (await store.latestSecondClockWorkflow('cpoc')).map((record) => record.spaId);
});
// The shared fixture defaults to the newest submitted SPA, which intake has already handed off.
test.use({ spaId: async ({ }, use) => use(workflowTargetIds[0]) });
test.use({ smartRole: 'CPOC' });

test('CPOC recommends approval for the RAI response in Pending - Second Clock for each SPA in the workflow, parent first', async ({ navigation, page, recordSearch, spaRecord, spaStore }) => {
    await navigation.openSmartHome();
    await eachSpa(workflowTargetIds, (spaId) => `CPOC recommends approval for ${spaId}`, async (spaId) => {
        await recordSearch.openSpa(spaId);
        await test.step('Verify the SPA is in Pending - Second Clock', async () => {
            const status = page.getByRole('option', { name: 'Pending - Second Clock', exact: true });
            await expect(status).toHaveCount(1);
            await expect(status).toHaveAttribute('aria-selected', 'true');
        });
        await spaStore.markPendingSecondClock(spaId);
        await test.step('Set CPOC Review Progress to Recommending Approval and verify the path', async () => {
            await spaRecord.review.setReviewTeamProgress(cpocName, 'Recommending Approval', spaId, 'second');
        });
        await spaStore.markRaiReviewCompleted(spaId, 'cpoc');
        await test.step('Verify Review row and Pending Concurrence on the main SPA page', async () => {
            await spaRecord.review.expectReviewTeamProgress(cpocName, 'Recommending Approval', 'second');
            const status = page.getByRole('option', { name: 'Pending Concurrence', exact: true });
            await expect(status).toHaveCount(1);
            await expect(status).toHaveAttribute('aria-selected', 'true');
        });
        await navigation.openSmartHomeTab();
    });
});

