import path from 'node:path';
import { test } from '../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { currentSpaStore } from '../../../support/data/spa-store';
import { onemacAttachments } from '../../../support/data/onemac-attachments';
import { subsequentDocumentsOther, subsequentDocumentsSubmitter } from '../../../support/data/onemac-subsequent-documents';

const otherFileNames = subsequentDocumentsOther.map((file) => path.basename(file));

// Same SPA the OneMAC under-review test uploads to: the newest Pending - First Clock record.
let targetSpaId: string;
test.beforeAll(async () => {
    targetSpaId = process.env.SRT_SPA_ID ?? (await (await currentSpaStore(appUrls.onemac, spaOptionsFromEnv())).latestPendingFirstClock()).spaId;
});
test.use({ spaId: async ({ }, use) => use(targetSpaId) });
test.use({ smartRole: 'SRT' });

test('SRT sees every subsequent document format on the SPA Attachments tab', async ({ navigation, recordSearch, spaRecord, spaId }) => {
    await navigation.openSmartHome();
    await recordSearch.openSpa(spaId);
    await test.step('Verify the subsequent documents group lists title-matched and Other files', async () => {
        await spaRecord.attachments.verifySubsequentDocuments(subsequentDocumentsSubmitter, onemacAttachments, otherFileNames);
    });
});
