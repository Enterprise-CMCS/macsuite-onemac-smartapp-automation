import { test } from '../../../support/fixtures/onemac.fixture';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { createSpaRecordStore } from '../../../support/data/spa-store';
import { OneMacDashboard } from '../../../support/ui/onemac/dashboard';
import { OneMacPackageDetails } from '../../../support/ui/onemac/package-details';

// OneMAC receives only the status from SMART. RAI dates are not shown in OneMAC, so only the status is checked.
test('OneMAC package status is RAI Issued after SMART moves to Pending RAI', async ({ page }, testInfo) => {
    const record = await createSpaRecordStore(appUrls.onemac, spaOptionsFromEnv()).latestPendingRai();
    await new OneMacDashboard(page).expectPackageStatus(record.spaId, 'RAI Issued', testInfo);
    const details = new OneMacPackageDetails(page);
    await details.expectPackageAction('Respond to Formal RAI', `/actions/respond-to-rai/Medicaid%20SPA/${record.spaId}`);
    await details.expectPackageAction('Withdraw Package', `/actions/withdraw-package/Medicaid%20SPA/${record.spaId}`);
});
