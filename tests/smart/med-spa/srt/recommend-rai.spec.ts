import { test } from '../../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../../support/data/spa';
import { currentSpaStore } from '../../../../support/data/spa-store';

const srtName = 'SRTUSER PW Automation';
const raiQuestions = [
    'What is the projected annual enrollment impact of this SPA?',
    'What public comment process was followed before submission?',
    'How will the state monitor outcomes for the proposed changes?',
    'Are there any changes to eligibility criteria that need clarification?',
    'What is the timeline for implementation and reporting?',
];

// SRT_SPA_ID targets a specific Pending - First Clock record. Without it, the newest Pending - First Clock SPA is used.
// The store is not changed here, so the record stays at Pending - First Clock for the CPOC RAI step.
let targetSpaId: string;
test.beforeAll(async () => {
    targetSpaId = process.env.SRT_SPA_ID ?? (await (await currentSpaStore(appUrls.onemac, spaOptionsFromEnv())).latestPendingFirstClock()).spaId;
});
// The shared fixture defaults to the newest submitted SPA, which intake has already handed off.
test.use({ spaId: async ({ }, use) => use(targetSpaId) });
test.use({ smartRole: 'SRT' });

test('SRT recommends RAI for a Pending - First Clock SPA', async ({ navigation, recordSearch, spaRecord, spaStore }) => {
    await navigation.openSmartHome();
    await recordSearch.openSpa(targetSpaId);
    await test.step('Set Review Progress to Recommending RAI, RAI Needed Yes, numbered RAI questions, and RAI Questions Completed Yes, then save once', async () => {
        await spaRecord.review.recommendRai(srtName, targetSpaId, raiQuestions);
    });
    await test.step('Verify SRT is in Recommending RAI on the Review tab', async () => {
        await spaRecord.review.expectReviewTeamProgress(srtName, 'Recommending RAI', 'first');
    });
});
