import { test } from '../../../support/fixtures/onemac.fixture';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { createSpaRecordStore } from '../../../support/data/spa-store';
import { OneMacDashboard } from '../../../support/ui/onemac/dashboard';
import { OneMacSubsequentDocuments } from '../../../support/ui/onemac/subsequent-documents';
import { subsequentDocumentsOther, subsequentDocumentsReason } from '../../../support/data/onemac-subsequent-documents';
import { eachSpa } from '../../../support/ui/smart/each-spa';

// Live: the upload step submits a subsequent-documents package to the same SPA the status check validates.
// Checks the newest submitted parent and each split in the store that OneMAC has not yet marked Under Review, parent first, so one run covers both SPAs.
test('OneMAC Medicaid SPA is Under Review and accepts subsequent documents in all formats', async ({ page }, testInfo) => {
    const store = createSpaRecordStore(appUrls.onemac, spaOptionsFromEnv());
    const records = await store.latestSubmittedWorkflow();
    await eachSpa(records.map((record) => record.spaId), (spaId) => `OneMAC shows ${spaId} Under Review and accepts subsequent documents`, async (spaId) => {
        await new OneMacDashboard(page).expectPackageStatus(spaId, 'Under Review', testInfo);
        await store.markOnemacUnderReview(spaId);

        const subsequentDocuments = new OneMacSubsequentDocuments(page);
        await subsequentDocuments.open(spaId);
        await subsequentDocuments.attachTitleMatchedFiles();
        await subsequentDocuments.attachOtherFiles(subsequentDocumentsOther);
        await subsequentDocuments.submit(subsequentDocumentsReason);
    });
});
