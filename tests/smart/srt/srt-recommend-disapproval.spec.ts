import { test } from '../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { currentSpaStore } from '../../../support/data/spa-store';

const srtName = 'SRTUSER PW Automation';

// SRT_SPA_ID targets a specific Pending - First Clock record. Without it, the newest Pending - First Clock SPA is used.
// The lookup runs before login, so the test fails without opening a browser when no record is ready.
let targetSpaId: string;
test.beforeAll(async () => {
    targetSpaId = process.env.SRT_SPA_ID ?? (await (await currentSpaStore(appUrls.onemac, spaOptionsFromEnv())).latestPendingFirstClock()).spaId;
});
// The shared fixture defaults to the newest submitted SPA, which intake has already handed off.
test.use({ spaId: async ({ }, use) => use(targetSpaId) });
test.use({ smartRole: 'SRT' });

test('SRT recommends disapproval for a Pending - First Clock SPA', async ({ navigation, recordSearch, spaRecord, spaStore }) => {
    await navigation.openSmartHome();
    await recordSearch.openSpa(targetSpaId);
    await test.step('Set SRT Review Progress to Recommending Disapproval and verify the path', async () => {
        await spaRecord.review.setReviewTeamProgress(srtName, 'Recommending Disapproval', targetSpaId, 'first');
    });
    await spaStore.markReviewCompleted(targetSpaId, 'srt', 'disapprove');
});
