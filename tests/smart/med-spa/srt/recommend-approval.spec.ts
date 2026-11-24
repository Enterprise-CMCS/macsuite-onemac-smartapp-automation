import { test } from '../../../../support/fixtures/smart.fixture';
import { eachSpa } from '../../../../support/ui/smart/each-spa';
import { appUrls } from '../../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../../support/data/spa';
import { currentSpaStore } from '../../../../support/data/spa-store';

const srtName = 'SRTUSER PW Automation';

// The Pending - First Clock workflow is the newest parent plus its splits, parent first, skipping any SRT already finished in the store.
// The lookup runs before login, so the test fails without opening a browser when no record is ready.
let workflowSpaIds: string[];
test.beforeAll(async () => {
    workflowSpaIds = (await (await currentSpaStore(appUrls.onemac, spaOptionsFromEnv())).latestPendingFirstClockWorkflow('srt')).map((record) => record.spaId);
});
// The shared fixture defaults to the newest submitted SPA, which intake has already handed off.
test.use({ spaId: async ({ }, use) => use(workflowSpaIds[0]) });
test.use({ smartRole: 'SRT' });

test('SRT recommends approval for each Pending - First Clock SPA in the workflow, parent first', async ({ navigation, recordSearch, spaRecord, spaStore }) => {
    await navigation.openSmartHome();
    await eachSpa(workflowSpaIds, (spaId) => `SRT recommends approval for ${spaId}`, async (spaId) => {
        await recordSearch.openSpa(spaId);
        await spaRecord.review.setReviewTeamProgress(srtName, 'Recommending Approval', spaId, 'first');
        await spaStore.markReviewCompleted(spaId, 'srt');
        await navigation.openSmartHomeTab();
    });
});
