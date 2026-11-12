import { expect } from '@playwright/test';
import { test } from '../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { currentSpaStore } from '../../../support/data/spa-store';

// CONCURRENCE_SPA_ID targets a specific Pending - Concurrence record. Without it, the newest Pending - Concurrence SPA is used.
// The lookup runs before login, so the test fails without opening a browser when no record is ready.
const groupDirectorName = 'GroupPW DirectorPW';
let targetSpaId: string;
test.beforeAll(async () => {
    targetSpaId = process.env.CONCURRENCE_SPA_ID ?? (await (await currentSpaStore(appUrls.onemac, spaOptionsFromEnv())).latestPendingConcurrence()).spaId;
});
test.use({ spaId: async ({ }, use) => use(targetSpaId) });

test('Concur SPA: Group Director concurs and the SPA moves to Pending Approval', async ({ navigation, page, recordSearch, spaRecord, spaStore }) => {
    await navigation.openSmartHome();
    await recordSearch.openSpa(targetSpaId);
    await test.step('Open the Adjudication tab', async () => {
        await spaRecord.adjudication.open();
    });
    await test.step('Record Concur on the Concurrence row', async () => {
        await spaRecord.adjudication.recordDecision('Concurrence', 'Concur');
    });
    await test.step('Verify the Group Director is recorded as Acted By User', async () => {
        await spaRecord.adjudication.expectActedBy('Concurrence', groupDirectorName);
    });
    await spaStore.markConcurred(targetSpaId);
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
});

