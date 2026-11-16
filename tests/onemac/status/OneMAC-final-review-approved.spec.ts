import { test } from '../../../support/fixtures/onemac.fixture';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { createSpaRecordStore } from '../../../support/data/spa-store';
import { OneMacDashboard } from '../../../support/ui/onemac/dashboard';
import { OneMacPackageDetails } from '../../../support/ui/onemac/package-details';

const cpocName = 'CPOC4 Automation';
// Final Disposition Date is set when the Division Director approves, so it is a date rather than a fixed value.
const dateText = /[A-Z][a-z]+ \d{1,2}, \d{4}/;

test('OneMAC approved SPA shows final disposition, effective date, and CPOC', async ({ page }, testInfo) => {
    const record = await createSpaRecordStore(appUrls.onemac, spaOptionsFromEnv()).latestApproved();
    await new OneMacDashboard(page).expectPackageStatus(record.spaId, 'Approved', testInfo);
    const details = new OneMacPackageDetails(page);
    await details.expectDetail('Final Disposition Date', dateText);
    await details.expectTermShown('Approved Effective Date');
    await details.expectDetail('CPOC', cpocName);
});

