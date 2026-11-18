import { expect } from '@playwright/test';
import { test } from '../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { currentSpaStore } from '../../../support/data/spa-store';
import { eachSpa } from '../../../support/ui/smart/each-spa';

const cpocName = 'CPOC4 Automation';
const priorityCode = 'P2';
const priorityRationale = 'testing rationale';

// The Pending - First Clock workflow is the newest parent plus its splits, parent first, skipping any CPOC review already finished in the store.
// The lookup runs before login, so the test fails without opening a browser when no record is ready.
let workflowSpaIds: string[];
test.beforeAll(async () => {
    workflowSpaIds = (await (await currentSpaStore(appUrls.onemac, spaOptionsFromEnv())).latestPendingFirstClockWorkflow('cpoc')).map((record) => record.spaId);
});
// The shared fixture defaults to the newest submitted SPA, which intake has already handed off.
test.use({ spaId: async ({ }, use) => use(workflowSpaIds[0]) });
test.use({ smartRole: 'CPOC' });

test('CPOC sets priority, marks initial submission complete, and recommends approval for each SPA in the workflow, parent first', async ({ navigation, page, recordSearch, spaRecord, spaStore }) => {
    await navigation.openSmartHome();
    await eachSpa(workflowSpaIds, (spaId) => `CPOC recommends approval for ${spaId}`, async (spaId) => {
        await recordSearch.openSpa(spaId);
        await test.step('Set Priority Code and Priority Code Rationale on the Details tab', async () => {
            await spaRecord.details.updatePriority(priorityCode, priorityRationale);
        });
        await test.step('Mark Initial Submission Complete as Yes in Submission Information', async () => {
            await spaRecord.details.setInitialSubmissionComplete('Yes');
        });
        await test.step('Set CPOC Review Progress to Recommending Approval and verify the path', async () => {
            await spaRecord.review.setReviewTeamProgress(cpocName, 'Recommending Approval', spaId, 'first');
        });
        await spaStore.markReviewCompleted(spaId, 'cpoc');
        await test.step('Verify Review row and Pending Concurrence on the main SPA page', async () => {
            await spaRecord.review.expectReviewTeamProgress(cpocName, 'Recommending Approval', 'first');
            const status = page.getByRole('option', { name: 'Pending Concurrence', exact: true });
            await expect(status).toHaveCount(1);
            await expect(status).toHaveAttribute('aria-selected', 'true');
        });
        await navigation.openSmartHomeTab();
    });
});
