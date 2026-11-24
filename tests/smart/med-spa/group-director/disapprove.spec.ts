import { expect } from '@playwright/test';
import { test } from '../../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../../support/data/spa';
import { currentSpaStore } from '../../../../support/data/spa-store';

// DISAPPROVAL_SPA_ID targets a specific Pending - Disapproval record. Without it, the newest Pending - Disapproval SPA is used.
// The lookup runs before login, so the test fails without opening a browser when no record is ready.
// Disapproval skips concurrence, so the Group Director decides on the Adjudication row rather than the Concurrence row.
const groupDirectorName = 'GroupPW DirectorPW';
let targetSpaId: string;
test.beforeAll(async () => {
    targetSpaId = process.env.DISAPPROVAL_SPA_ID ?? (await (await currentSpaStore(appUrls.onemac, spaOptionsFromEnv())).latestPendingDisapproval()).spaId;
});
test.use({ spaId: async ({ }, use) => use(targetSpaId) });

test('Disapproves SPA: Group Director disapproves and the SPA moves to Disapproved', async ({ navigation, page, recordSearch, spaRecord, spaStore }) => {
    await navigation.openSmartHome();
    await recordSearch.openSpa(targetSpaId);
    await test.step('Open the Adjudication tab', async () => {
        await spaRecord.adjudication.open();
    });
    await test.step('Record Disapprove on the Adjudication row', async () => {
        await spaRecord.adjudication.recordDecision('Adjudication', 'Disapprove');
    });
    await test.step('Verify the Group Director is recorded as Acted By User', async () => {
        await spaRecord.adjudication.expectActedBy('Adjudication', groupDirectorName);
    });
    await spaStore.markDisapproved(targetSpaId);
    await test.step('Verify the SPA is Disapproved', async () => {
        const status = page.getByRole('option', { name: 'Disapproved', exact: true });
        await expect(status).toHaveCount(1);
        await expect(status).toHaveAttribute('aria-selected', 'true');
    });
});
