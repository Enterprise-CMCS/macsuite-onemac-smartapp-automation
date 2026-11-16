import { expect } from '@playwright/test';
import { test } from '../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { currentSpaStore } from '../../../support/data/spa-store';

// ADJUDICATION_SPA_ID targets a specific Pending - Approval record. Without it, the newest Pending - Approval SPA is used.
// After a disapproval and return, the Adjudication grid has the Group Director's decided row 1 and the Division Director's pending row 2.
// The lookup runs before login, so the test fails without opening a browser when no record is ready.
const divisionDirectorName = 'DivisionPW DirectorPW';
let targetSpaId: string;
test.beforeAll(async () => {
    targetSpaId = process.env.ADJUDICATION_SPA_ID ?? (await (await currentSpaStore(appUrls.onemac, spaOptionsFromEnv())).latestPendingApproval()).spaId;
});
test.use({ spaId: async ({ }, use) => use(targetSpaId) });

test('Approves SPA after return: Division Director approves the pending row and the SPA moves to Approved', async ({ navigation, page, recordSearch, spaRecord, spaStore }) => {
    await navigation.openSmartHome();
    await recordSearch.openSpa(targetSpaId);
    await test.step('Open the Adjudication tab', async () => {
        await spaRecord.adjudication.open();
    });
    await test.step('Record Approve on the Division Director row', async () => {
        await spaRecord.adjudication.recordDecision('Adjudication', 'Approve', { rowNumber: 2 });
    });
    await test.step('Verify the Division Director is recorded as Acted By User', async () => {
        await spaRecord.adjudication.expectActedBy('Adjudication', divisionDirectorName);
    });
    await spaStore.markApproved(targetSpaId);
    await test.step('Verify the SPA is Approved', async () => {
        const status = page.getByRole('option', { name: 'Approved', exact: true });
        await expect(status).toHaveCount(1);
        await expect(status).toHaveAttribute('aria-selected', 'true');
    });
    await test.step('Verify Field History records Pending Approval to Approved', async () => {
        // Field History does not refresh after a save until the page reloads.
        await page.reload({ waitUntil: 'domcontentloaded' });
        await spaRecord.fieldHistory.open();
        await spaRecord.fieldHistory.expectLatestStatusChange('Pending Approval', 'Approved');
    });
});
