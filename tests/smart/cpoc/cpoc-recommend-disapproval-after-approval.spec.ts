import { expect } from '@playwright/test';
import { test } from '../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { currentSpaStore } from '../../../support/data/spa-store';

const cpocName = 'CPOC4 Automation';
// The adjudicating group must match one of the disapproving groups on the submission. SDG is the group this record accepted.
const disapprovingGroup = 'SDG';

// CPOC_RETURNED_SPA_ID targets a Pending - First Clock SPA that was approved, then returned to the review team.
// Without it, the newest Pending - First Clock SPA is used. The lookup runs before login.
let targetSpaId: string;
test.beforeAll(async () => {
    targetSpaId = process.env.CPOC_RETURNED_SPA_ID ?? (await (await currentSpaStore(appUrls.onemac, spaOptionsFromEnv())).latestPendingFirstClock()).spaId;
});
test.use({ spaId: async ({ }, use) => use(targetSpaId) });
test.use({ smartRole: 'CPOC' });

test('CPOC recommends disapproval after approval and return, without resetting Priority or Initial Submission', async ({ navigation, page, recordSearch, spaRecord, spaStore }) => {
    await navigation.openSmartHome();
    await recordSearch.openSpa(targetSpaId);
    await test.step('Verify Priority Code was already set by the earlier CPOC approval', async () => {
        await spaRecord.details.open();
        await spaRecord.details.expectPriorityCodeSet();
    });
    await test.step('Set CPOC Review Progress to Recommending Disapproval with the disapproving group', async () => {
        await spaRecord.review.setReviewTeamProgress(cpocName, 'Recommending Disapproval', targetSpaId, 'first', disapprovingGroup);
    });
    await spaStore.markReviewCompleted(targetSpaId, 'cpoc', 'disapprove');
    await test.step('Verify Review row and Pending Disapproval on the main SPA page', async () => {
        await spaRecord.review.expectReviewTeamProgress(cpocName, 'Recommending Disapproval', 'first');
        const status = page.getByRole('option', { name: 'Pending Disapproval', exact: true });
        await expect(status).toHaveCount(1);
        await expect(status).toHaveAttribute('aria-selected', 'true');
    });
});
