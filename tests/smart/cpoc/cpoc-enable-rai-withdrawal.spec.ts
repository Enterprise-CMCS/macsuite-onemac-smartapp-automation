import { expect } from '@playwright/test';
import { test } from '../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../support/config/urls';
import { requiredSpaOptionsFromEnv } from '../../../support/data/spa';
import { createSpaRecordStore } from '../../../support/data/spa-store';

// RAI_WITHDRAWAL_SPA_ID targets a specific Pending - RAI SPA (one with a formal RAI response submitted).
// Without it, the newest Pending - RAI SPA for SPA_STATE is used. SPA_STATE is required (no default).
// The store is moved to Pending - Second Clock during the run once SMART shows that status.
let targetSpaId: string;
// Evaluated at file load so a missing SPA_STATE fails before the fixture logs in.
const spaOptions = requiredSpaOptionsFromEnv();
test.beforeAll(async () => {
    targetSpaId = process.env.RAI_WITHDRAWAL_SPA_ID ?? (await createSpaRecordStore(appUrls.onemac, spaOptions).latestPendingRai()).spaId;
});
test.use({ spaId: async ({ }, use) => use(targetSpaId) });
test.use({ smartRole: 'CPOC' });

const withdrawalComments = 'testing RAI response withdrawal';

test('CPOC opens the RAI record to enable RAI response withdrawal', async ({ navigation, recordSearch, spaRecord, spaStore, page }) => {
    await navigation.openSmartHome();
    await recordSearch.openSpa(targetSpaId);
    await test.step('Verify the SPA is in Pending - Second Clock and record it in the store', async () => {
        const status = page.getByRole('option', { name: 'Pending - Second Clock', exact: true });
        await expect(status).toHaveCount(1);
        await expect(status).toHaveAttribute('aria-selected', 'true');
        await spaStore.markPendingSecondClock(targetSpaId);
    });
    await test.step('Open the Review tab', async () => {
        await spaRecord.review.openReviewTab();
    });
    await test.step('Open the RAI record from the RAI link in the RAI Details section', async () => {
        await spaRecord.review.openRaiRecord(targetSpaId);
        await expect(page).toHaveURL(/SMART_Request_for_Additional_Information__c/);
    });
    await test.step('Click Enable RAI Response Withdrawal in the record actions', async () => {
        await page.getByRole('button', { name: 'Enable RAI Response Withdrawal', exact: true }).click();
    });
    await test.step('Enter RAI response withdrawal comments and click Enable in the modal', async () => {
        await expect(page.getByRole('heading', { name: 'Enable RAI Response Withdrawal', exact: true })).toBeVisible();
        const comments = page.getByRole('textbox', { name: 'RAI Response Withdrawal Comments', exact: true });
        await comments.fill(withdrawalComments);
        await expect(comments).toHaveValue(withdrawalComments);
        await page.getByRole('button', { name: 'Enable', exact: true }).click();
    });
    await test.step('Confirm withdrawal is enabled and close the modal with X', async () => {
        await expect(page.getByText('RAI Response Withdrawal has been enabled in OneMAC.', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Cancel and close', exact: true }).click();
        await expect(page.getByText('RAI Response Withdrawal has been enabled in OneMAC.', { exact: true })).toBeHidden();
    });
    await test.step('Verify RAI Response Withdrawal is Enabled with the comments in the sidebar', async () => {
        const withdrawalField = page.locator('[data-field-id="RecordRAI_Response_Withdrawal_PL_cField"]');
        const commentsField = page.locator('[data-field-id="RecordSMART_CMCS_RAI_Rsp_Withdrawal_Comments_cField"]');
        await withdrawalField.scrollIntoViewIfNeeded();
        await expect(withdrawalField).toContainText('Enabled');
        await expect(commentsField).toContainText(withdrawalComments);
    });
});
