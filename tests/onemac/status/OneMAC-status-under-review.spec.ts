import { test } from '../../../support/fixtures/onemac.fixture';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { createSpaRecordStore } from '../../../support/data/spa-store';
import { OneMacDashboard } from '../../../support/ui/onemac/dashboard';
import { OneMacSubsequentDocuments } from '../../../support/ui/onemac/subsequent-documents';
import { subsequentDocumentsOther, subsequentDocumentsReason } from '../../../support/data/onemac-subsequent-documents';

// Live: the upload step submits a subsequent-documents package to the same SPA the status check validates.
test('OneMAC Medicaid SPA is Under Review and accepts subsequent documents in all formats', async ({ page }, testInfo) => {
    const store = createSpaRecordStore(appUrls.onemac, spaOptionsFromEnv());
    const record = await store.latestPendingFirstClock();
    const dashboard = new OneMacDashboard(page);
    await dashboard.expectPackageStatus(record.spaId, 'Under Review', testInfo);
    await store.markOnemacUnderReview(record.spaId);

    const subsequentDocuments = new OneMacSubsequentDocuments(page);
    await subsequentDocuments.open(record.spaId);
    await subsequentDocuments.attachTitleMatchedFiles();
    await subsequentDocuments.attachOtherFiles(subsequentDocumentsOther);
    await subsequentDocuments.submit(subsequentDocumentsReason);
});
