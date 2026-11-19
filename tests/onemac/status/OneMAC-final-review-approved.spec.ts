import { test } from '../../../support/fixtures/onemac.fixture';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { createSpaRecordStore } from '../../../support/data/spa-store';
import { OneMacDashboard } from '../../../support/ui/onemac/dashboard';
import { OneMacPackageDetails } from '../../../support/ui/onemac/package-details';
import { eachSpa } from '../../../support/ui/smart/each-spa';

const cpocName = 'CPOC4 Automation';
// Final Disposition Date is set when the Division Director approves, so it is a date rather than a fixed value.
const dateText = /[A-Z][a-z]+ \d{1,2}, \d{4}/;

// Checks the newest approved parent and each approved split in the store, parent first, so one run covers both SPAs.
test('OneMAC approved SPAs show final disposition, effective date, and CPOC', async ({ page }, testInfo) => {
    const store = createSpaRecordStore(appUrls.onemac, spaOptionsFromEnv());
    const records = await store.latestApprovedWorkflow();
    await eachSpa(records.map((record) => record.spaId), (spaId) => `OneMAC shows ${spaId} as approved`, async (spaId) => {
        await new OneMacDashboard(page).expectPackageStatus(spaId, 'Approved', testInfo);
        const details = new OneMacPackageDetails(page);
        await details.expectDetail('Final Disposition Date', dateText);
        await details.expectTermShown('Approved Effective Date');
        await details.expectDetail('CPOC', cpocName);
        await store.markOnemacStatus(spaId, 'approved');
    });
});

