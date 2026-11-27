import { expect } from '@playwright/test';
import path from 'node:path';
import { daysAgo, pickDate } from '../../../support/data/future-date';
import { test } from '../../../support/fixtures/onemac.fixture';
import { chooseSpaId, spaOptionsFromEnv } from '../../../support/data/spa';
import { createSpaRecordStore } from '../../../support/data/spa-store';
import { appUrls } from '../../../support/config/urls';
import { onemacDisplayDate, toSmartDate } from '../../../support/data/onemac-dates';
import { onemacAttachments } from '../../../support/data/onemac-attachments';
import { findPackageOnDashboard } from '../../../support/ui/onemac/dashboard';

const uploadFile = (name: string) => path.resolve(__dirname, '../../../support/documents/upload', name);
const additionalInformationText = 'this is a test';
test('OneMAC creates a new Medicaid SPA', async ({ page }, testInfo) => {
    const testStartedAt = new Date();
    const spaOptions = spaOptionsFromEnv();
    const records = createSpaRecordStore(appUrls.onemac, spaOptions);
    await page.getByRole('link', { name: 'New Submission' }).click();
    await page.getByRole('link', { name: 'State Plan Amendment (SPA)' }).click();
    await page.getByRole('link', { name: 'Medicaid SPA Submit a new' }).click();
    await page.getByRole('link', { name: 'All Other Medicaid SPA' }).click();
    const spaId = await chooseSpaId(page, spaOptions, records.reserve);
    console.log(`Using SPA ID: ${spaId}`);
    await page.getByTestId('proposedEffectiveDate-datepicker').click();
    await pickDate(page, daysAgo(7)); // 7 days in the past

    for (const { testId, fileName } of onemacAttachments) {
        await page.getByTestId(`${testId}-upload`).setInputFiles(uploadFile(fileName));
        // The file name shows only after its upload finishes. Large files can take minutes, so allow time per file.
        await expect(page.getByText(fileName, { exact: true })).toBeVisible({ timeout: 180_000 });
        await expect(page.getByTestId('three-dots-loading')).toHaveCount(0, { timeout: 180_000 });
    }
    await page.getByRole('textbox', { name: 'Add anything else you would' }).click();
    await page.getByRole('textbox', { name: 'Add anything else you would' }).fill(additionalInformationText);
    await expect(page.getByTestId('submit-action-form')).toBeEnabled({ timeout: 60_000 });
    await page.getByTestId('submit-action-form').click();
    await expect(page.getByTestId('banner-header')).toBeVisible();
    await expect(page.getByText('Package submitted')).toBeVisible();
    await records.markSubmitted(spaId);

    // A click can land while the search table is still re-rendering, or OneMAC can show "Page not found" and drop the
    // search box. Each attempt searches again from Home, so a broken route does not leave the retry clicking a missing link.
    await expect(async () => {
        const spaLink = await findPackageOnDashboard(page, spaId);
        await spaLink.click();
        await expect(page).toHaveURL(new RegExp(`/details/Medicaid%20SPA/${spaId}$`), { timeout: 10_000 });
        await expect(page.getByText(/Sorry, we couldn.t find that page/)).toHaveCount(0);
    }).toPass({ timeout: 240_000, intervals: [5_000] });

    const packageDetails = page.locator('#package_details');
    const detailValue = (label: string) => packageDetails
        .locator('dl', { has: page.getByText(label, { exact: true }) })
        .locator('dd');
    await expect(detailValue('Submission ID')).toHaveText(spaId);
    // Status sits in its own section above #package_details, not in a labelled row.
    await expect(page.locator('dt', { hasText: /^Submitted$/ })).toBeVisible();
    const initialSubmissionDateValue = detailValue('Initial Submission Date');
    await expect(initialSubmissionDateValue).toContainText(onemacDisplayDate(testStartedAt));
    const initialSubmissionDate = toSmartDate(await initialSubmissionDateValue.innerText());
    const stateValue = detailValue('State');
    await expect(stateValue).not.toBeEmpty();
    const state = (await stateValue.innerText()).trim();

    const proposedEffectiveDateValue = detailValue('Proposed Effective Date');
    await expect(proposedEffectiveDateValue).toHaveText(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
    const proposedEffectiveDate = (await proposedEffectiveDateValue.innerText()).trim();

    const packageActivity = page.locator('#package_activity');
    const attachmentRows = packageActivity.getByRole('table').locator('tbody tr');
    await expect(attachmentRows).toHaveCount(onemacAttachments.length);
    await expect(page.getByTestId('three-dots-loading')).toHaveCount(0, { timeout: 60_000 });
    await testInfo.attach(`onemac-details-${spaId}-Submitted`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
    });
    for (const { documentType, fileName } of onemacAttachments) {
        const row = attachmentRows.filter({ has: page.getByRole('cell', { name: documentType, exact: true }) });
        await expect(row).toHaveCount(1);
        await expect(row.getByRole('button', { name: fileName, exact: true })).toBeVisible();
    }

    const additionalInformation = packageActivity
        .getByRole('heading', { name: 'Additional Information', exact: true })
        .first()
        .locator('xpath=following-sibling::p');
    await expect(additionalInformation).toHaveText(additionalInformationText);

    await records.saveDetails(spaId, {
        state, initialSubmissionDate, proposedEffectiveDate, additionalInformation: additionalInformationText,
    });
    console.log(`Saved SPA ${spaId} details for SMART: ${state}, submitted ${initialSubmissionDate}, proposed effective ${proposedEffectiveDate}`);
    console.log(`Confirmed SPA ${spaId}; record saved in ${records.file}`);
});





