import { expect } from '@playwright/test';
import { test } from '../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { currentSpaStore } from '../../../support/data/spa-store';

const cpocName = 'CPOC4 Automation';
const priorityCode = 'P2';
const priorityRationale = 'testing rationale';

// CPOC_SPA_ID targets a specific Pending - First Clock record. Without it, the newest Pending - First Clock SPA is used.
// The lookup runs before login, so the test fails without opening a browser when no record is ready.
let targetSpaId: string;
test.beforeAll(async () => {
    targetSpaId = process.env.CPOC_SPA_ID ?? (await (await currentSpaStore(appUrls.onemac, spaOptionsFromEnv())).latestPendingFirstClock()).spaId;
});
// The shared fixture defaults to the newest submitted SPA, which intake has already handed off.
test.use({ spaId: async ({ }, use) => use(targetSpaId) });
test.use({ smartRole: 'CPOC' });

test('CPOC sets priority, marks initial submission complete, and recommends approval', async ({ navigation, page, recordSearch, spaRecord, spaStore }) => {
    await navigation.openSmartHome();
    await recordSearch.openSpa(targetSpaId);
    await test.step('Set Priority Code and Priority Code Rationale on the Details tab', async () => {
        await spaRecord.details.updatePriority(priorityCode, priorityRationale);
    });
    await test.step('Mark Initial Submission Complete as Yes in Submission Information', async () => {
        await spaRecord.details.setInitialSubmissionComplete('Yes');
    });
    await test.step('Set CPOC Review Progress to Recommending Approval and verify the path', async () => {
        await spaRecord.review.setReviewTeamProgress(cpocName, 'Recommending Approval', targetSpaId, 'first');
    });
    await spaStore.markReviewCompleted(targetSpaId, 'cpoc');
    await test.step('Verify Review row and Pending Concurrence on the main SPA page', async () => {
        await spaRecord.review.expectReviewTeamProgress(cpocName, 'Recommending Approval', 'first');
        const status = page.getByRole('option', { name: 'Pending Concurrence', exact: true });
        await expect(status).toHaveCount(1);
        await expect(status).toHaveAttribute('aria-selected', 'true');
    });
});
