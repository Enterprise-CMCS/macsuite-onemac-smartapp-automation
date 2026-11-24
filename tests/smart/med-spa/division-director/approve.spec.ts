import { expect } from '@playwright/test';
import { test } from '../../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../../support/data/spa';
import { currentSpaStore } from '../../../../support/data/spa-store';
import { eachSpa } from '../../../../support/ui/smart/each-spa';

// The Pending - Approval workflow is the newest parent plus its splits still waiting, parent first.
// The lookup runs before login, so the test fails without opening a browser when no record is ready.
const divisionDirectorName = 'DivisionPW DirectorPW';
let workflowSpaIds: string[];
test.beforeAll(async () => {
    workflowSpaIds = (await (await currentSpaStore(appUrls.onemac, spaOptionsFromEnv())).latestPendingApprovalWorkflow()).map((record) => record.spaId);
});
test.use({ spaId: async ({ }, use) => use(workflowSpaIds[0]) });
test.use({ smartRole: 'DIVDIR' });

test('Approves SPA: Division Director approves each SPA in the workflow, parent first, and each moves to Approved', async ({ navigation, page, recordSearch, spaRecord, spaStore }) => {
    await navigation.openSmartHome();
    await eachSpa(workflowSpaIds, (spaId) => `Division Director approves ${spaId}`, async (spaId) => {
        await recordSearch.openSpa(spaId);
        await test.step('Open the Adjudication tab', async () => {
            await spaRecord.adjudication.open();
        });
        await test.step('Record Approve on the Adjudication row', async () => {
            await spaRecord.adjudication.recordDecision('Adjudication', 'Approve');
        });
        await test.step('Verify the Division Director is recorded as Acted By User', async () => {
            await spaRecord.adjudication.expectActedBy('Adjudication', divisionDirectorName);
        });
        await spaStore.markApproved(spaId);
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
        await navigation.openSmartHomeTab();
    });
});

