import { expect } from '@playwright/test';
import { test } from '../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { currentSpaStore } from '../../../support/data/spa-store';
import { eachSpa } from '../../../support/ui/smart/each-spa';

// The Pending - Concurrence workflow is the newest parent plus its splits still waiting, parent first.
// The lookup runs before login, so the test fails without opening a browser when no record is ready.
const groupDirectorName = 'GroupPW DirectorPW';
let workflowSpaIds: string[];
test.beforeAll(async () => {
    workflowSpaIds = (await (await currentSpaStore(appUrls.onemac, spaOptionsFromEnv())).latestPendingConcurrenceWorkflow()).map((record) => record.spaId);
});
test.use({ spaId: async ({ }, use) => use(workflowSpaIds[0]) });
test.use({ smartRole: 'GROUPDIR' });

test('Concur SPA: Group Director concurs with each SPA in the workflow, parent first, and each moves to Pending Approval', async ({ navigation, page, recordSearch, spaRecord, spaStore }) => {
    await navigation.openSmartHome();
    await eachSpa(workflowSpaIds, (spaId) => `Group Director concurs with ${spaId}`, async (spaId) => {
        await recordSearch.openSpa(spaId);
        await test.step('Open the Adjudication tab', async () => {
            await spaRecord.adjudication.open();
        });
        await test.step('Record Concur on the Concurrence row', async () => {
            await spaRecord.adjudication.recordDecision('Concurrence', 'Concur');
        });
        await test.step('Verify the Group Director is recorded as Acted By User', async () => {
            await spaRecord.adjudication.expectActedBy('Concurrence', groupDirectorName);
        });
        await spaStore.markConcurred(spaId);
        await test.step('Verify the SPA is Pending Approval', async () => {
            const status = page.getByRole('option', { name: 'Pending Approval', exact: true });
            await expect(status).toHaveCount(1);
            await expect(status).toHaveAttribute('aria-selected', 'true');
        });
        await test.step('Verify a Division Director row appears in the Adjudication grid', async () => {
            await spaRecord.adjudication.expectDivisionDirectorRow();
        });
        await test.step('Verify Field History records Pending Concurrence to Pending Approval', async () => {
            await spaRecord.fieldHistory.open();
            await spaRecord.fieldHistory.expectLatestStatusChange('Pending Concurrence', 'Pending Approval');
        });
        await navigation.openSmartHomeTab();
    });
});

