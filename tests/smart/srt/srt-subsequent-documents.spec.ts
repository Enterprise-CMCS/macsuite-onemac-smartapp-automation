import path from 'node:path';
import { test } from '../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { currentSpaStore } from '../../../support/data/spa-store';
import { eachSpa } from '../../../support/ui/smart/each-spa';
import { onemacAttachments } from '../../../support/data/onemac-attachments';
import { subsequentDocumentsOther, subsequentDocumentsSubmitter } from '../../../support/data/onemac-subsequent-documents';

const otherFileNames = subsequentDocumentsOther.map((file) => path.basename(file));

// Same SPAs the OneMAC under-review test uploads to: the newest Pending - First Clock parent and its splits, parent first.
// SRT_SPA_ID, when set, checks only that one SPA.
let workflowSpaIds: string[];
test.beforeAll(async () => {
    workflowSpaIds = process.env.SRT_SPA_ID
        ? [process.env.SRT_SPA_ID]
        : (await (await currentSpaStore(appUrls.onemac, spaOptionsFromEnv())).latestPendingFirstClockWorkflow()).map((record) => record.spaId);
});
test.use({ spaId: async ({ }, use) => use(workflowSpaIds[0]) });
test.use({ smartRole: 'SRT' });

test('SRT sees every subsequent document format on the SPA Attachments tab for each SPA in the workflow', async ({ navigation, recordSearch, spaRecord }) => {
    await navigation.openSmartHome();
    await eachSpa(workflowSpaIds, (spaId) => `SRT sees subsequent documents on ${spaId}`, async (spaId) => {
        await recordSearch.openSpa(spaId);
        await test.step('Verify the subsequent documents group lists title-matched and Other files', async () => {
            await spaRecord.attachments.verifySubsequentDocuments(subsequentDocumentsSubmitter, onemacAttachments, otherFileNames);
        });
        await navigation.openSmartHomeTab();
    });
});
