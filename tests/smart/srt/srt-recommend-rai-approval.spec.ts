import { expect } from '@playwright/test';
import { test } from '../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { currentSpaStore } from '../../../support/data/spa-store';
import { raiResponseFiles } from '../../../support/data/onemac-attachments';

const srtName = 'SRTUSER PW Automation';
const raiSubmitter = 'George Harrison';
const raiResponseFileNames = [raiResponseFiles.letter];
const secondClockIntakeFields = [
    'CPOC/SRT Assignment Confirmed',
    'CPOC/SRT Assignment Confirmed Date',
    'CPOC/SRT Assignment Confirmed By',
];

// SRT_SPA_ID targets a specific Pending RAI record. RAI_RESPONSE_DATE overrides the stored formal RAI response date.
// The lookup runs before login, so the test fails without opening a browser when no record is ready.
let targetSpaId: string;
let responseDate: string;
test.beforeAll(async () => {
    if (process.env.SRT_SPA_ID) {
        targetSpaId = process.env.SRT_SPA_ID;
        responseDate = process.env.RAI_RESPONSE_DATE ?? '';
    } else {
        const latest = await (await currentSpaStore(appUrls.onemac, spaOptionsFromEnv())).latestPendingRai();
        targetSpaId = latest.spaId;
        responseDate = process.env.RAI_RESPONSE_DATE ?? latest.formalRaiResponseDate ?? '';
    }
    if (!responseDate) throw new Error(`No formal RAI response date for ${targetSpaId}. Set RAI_RESPONSE_DATE.`);
});
// The shared fixture defaults to the newest submitted SPA, which intake has already handed off.
test.use({ spaId: async ({ }, use) => use(targetSpaId) });
test.use({ smartRole: 'SRT' });

test('SRT verifies the RAI response and recommends approval in Pending - Second Clock', async ({ navigation, page, recordSearch, spaRecord, spaStore }) => {
    await navigation.openSmartHome();
    await recordSearch.openSpa(targetSpaId);
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
    await spaStore.markPendingSecondClock(targetSpaId);
    await test.step('Confirm CPOC/SRT Assignment so the submission can move forward', async () => {
        await spaRecord.review.confirmCpocSrtAssignment();
    });
    await test.step('Set SRT Review Progress to Recommending Approval and verify the path', async () => {
        await spaRecord.review.setReviewTeamProgress(srtName, 'Recommending Approval', targetSpaId, 'second');
    });
    await spaStore.markRaiReviewCompleted(targetSpaId, 'srt');
});
