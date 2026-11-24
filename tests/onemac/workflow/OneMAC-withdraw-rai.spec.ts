import path from 'node:path';
import { test } from '../../../support/fixtures/onemac.fixture';
import { expect } from '@playwright/test';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { createSpaRecordStore } from '../../../support/data/spa-store';
import { OneMacDashboard } from '../../../support/ui/onemac/dashboard';
import { raiResponseFiles } from '../../../support/data/onemac-attachments';

// Withdraws a formal RAI response in OneMAC after CPOC enables RAI response withdrawal in SMART.
// Required: SPA_STATE (no default). SPA_STATE must match the state of the SPA.
// RAI_WITHDRAWAL_SPA_ID targets a specific SPA; without it, the newest Pending - Second Clock SPA for SPA_STATE is used.
let targetSpaId: string;
let store: ReturnType<typeof createSpaRecordStore>;
test.beforeAll(async () => {
    store = createSpaRecordStore(appUrls.onemac, spaOptionsFromEnv());
    targetSpaId = process.env.RAI_WITHDRAWAL_SPA_ID ?? (await store.latestPendingSecondClock()).spaId;
});

const withdrawalAdditionalInformation = 'test add responding with new RAI information';

test('OneMAC withdraws the formal RAI response for an RAI withdrawal', async ({ page }, testInfo) => {
    const spaId = targetSpaId;

    await test.step('Find the package on the dashboard and open its details (status Submitted or Under Review)', async () => {
        const shown = await new OneMacDashboard(page).expectPackageStatus(spaId, ['Submitted', 'Under Review'], testInfo);
        await store.markOnemacStatus(spaId, shown === 'Under Review' ? 'under_review' : 'submitted');
    });
    await test.step('Open Withdraw Formal RAI Response from Package Actions', async () => {
        const withdrawAction = page.getByRole('link', { name: 'Withdraw Formal RAI Response', exact: true });
        await expect(withdrawAction).toHaveCount(1);
        await withdrawAction.click();
        await page.waitForURL(/\/actions\/withdraw-rai\//);
    });
    await test.step('Attach the supporting document and enter the additional information', async () => {
        // The "choose from folder" span intercepts clicks on the upload button, so click the span and take the file chooser.
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.getByTestId('supportingDocumentation-click').click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(path.resolve(__dirname, '../../../support/documents/upload', raiResponseFiles.letter));
        await expect(page.getByText(raiResponseFiles.letter, { exact: true })).toBeVisible();
        await page.getByRole('textbox', { name: 'Explain your need for withdrawal.', exact: true }).fill(withdrawalAdditionalInformation);
    });
    await test.step('Submit and confirm the withdrawal', async () => {
        await page.getByTestId('submit-action-form').click();
        await page.getByTestId('dialog-accept').click();
        await expect(page.getByText('Withdraw Formal RAI Response request has been submitted.', { exact: true })).toBeVisible();
    });
    await test.step('Capture the Withdrawal Requested status for verification', async () => {
        // Wait for the status and the expanded latest activity entry (the submitted additional information) to render.
        await expect(page.locator('dt', { hasText: /^Formal RAI Response - Withdrawal Requested$/ })).toBeVisible();
        await expect(page.getByText(withdrawalAdditionalInformation, { exact: true })).toBeVisible();
        await testInfo.attach(`onemac-withdrawal-requested-${spaId}`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: 'image/png',
        });
    });
});
