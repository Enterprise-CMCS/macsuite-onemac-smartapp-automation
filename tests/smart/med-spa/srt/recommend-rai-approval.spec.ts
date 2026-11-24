import { expect } from '@playwright/test';
import { test } from '../../../../support/fixtures/smart.fixture';
import { eachSpa } from '../../../../support/ui/smart/each-spa';
import { appUrls } from '../../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../../support/data/spa';
import { currentSpaStore } from '../../../../support/data/spa-store';
import { raiResponseFiles } from '../../../../support/data/onemac-attachments';

const srtName = 'SRTUSER PW Automation';
const raiSubmitter = 'George Harrison';
const raiResponseFileNames = [raiResponseFiles.letter];
const secondClockIntakeFields = [
    'CPOC/SRT Assignment Confirmed',
    'CPOC/SRT Assignment Confirmed Date',
    'CPOC/SRT Assignment Confirmed By',
];

// The Second Clock workflow is the newest RAI response parent plus its splits, parent first, skipping any SRT already finished in the store.
// SRT_SPA_ID checks only that one SPA. RAI_RESPONSE_DATE overrides the stored formal RAI response date for every SPA checked.
// The lookup runs before login, so the test fails without opening a browser when no record is ready.
let workflowTargets: Array<{ spaId: string; responseDate: string }>;
test.beforeAll(async () => {
    const store = await currentSpaStore(appUrls.onemac, spaOptionsFromEnv());
    const records = process.env.SRT_SPA_ID ? [await store.find(process.env.SRT_SPA_ID)] : await store.latestSecondClockWorkflow('srt');
    workflowTargets = records.map((record) => {
        const responseDate = process.env.RAI_RESPONSE_DATE ?? record.formalRaiResponseDate ?? '';
        if (!responseDate) throw new Error(`No formal RAI response date for ${record.spaId}. Set RAI_RESPONSE_DATE.`);
        return { spaId: record.spaId, responseDate };
    });
});
// The shared fixture defaults to the newest submitted SPA, which intake has already handed off.
test.use({ spaId: async ({ }, use) => use(workflowTargets[0].spaId) });
test.use({ smartRole: 'SRT' });

test('SRT verifies the RAI response and recommends approval in Pending - Second Clock for each SPA in the workflow, parent first', async ({ navigation, page, recordSearch, spaRecord, spaStore }) => {
    await navigation.openSmartHome();
    await eachSpa(workflowTargets.map((target) => target.spaId), (spaId) => `SRT verifies the RAI response and recommends approval for ${spaId}`, async (spaId) => {
        const { responseDate } = workflowTargets.find((target) => target.spaId === spaId)!;
        await recordSearch.openSpa(spaId);
        await test.step('Verify the SPA is in Pending - Second Clock', async () => {
            const status = page.getByRole('option', { name: 'Pending - Second Clock', exact: true });
            await expect(status).toHaveCount(1);
            await expect(status).toHaveAttribute('aria-selected', 'true');
        });
        await test.step('Details: Second Clock Start Date is the RAI response date', async () => {
            await spaRecord.details.open();
            await spaRecord.details.expectRowValue('Second Clock Start Date', responseDate);
        });
        await test.step(`Attachments: RAI Response Submitted by ${raiSubmitter} lists the OneMAC uploads`, async () => {
            await spaRecord.attachments.verifyRaiResponseSubmitted(raiSubmitter, raiResponseFileNames);
        });
        await test.step('Review: First Clock Review and Second Clock Intake fields', async () => {
            await spaRecord.review.expectFirstClockReview();
            await spaRecord.review.expectSecondClockIntake(secondClockIntakeFields);
        });
        await spaStore.markPendingSecondClock(spaId);
        await test.step('Confirm CPOC/SRT Assignment so the submission can move forward', async () => {
            await spaRecord.review.confirmCpocSrtAssignment();
        });
        await test.step('Set SRT Review Progress to Recommending Approval and verify the path', async () => {
            await spaRecord.review.setReviewTeamProgress(srtName, 'Recommending Approval', spaId, 'second');
        });
        await spaStore.markRaiReviewCompleted(spaId, 'srt');
        await navigation.openSmartHomeTab();
    });
});
