import { expect } from '@playwright/test';
import { test } from '../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { currentSpaStore } from '../../../support/data/spa-store';

// RETURN_SPA_ID targets a specific record. Without it, the newest SPA awaiting the Division Director in Pending - Approval is used.
// The lookup runs before login, so the test fails without opening a browser when no record is ready.
const divisionDirectorName = 'DivisionPW DirectorPW';
let targetSpaId: string;
test.beforeAll(async () => {
    const store = await currentSpaStore(appUrls.onemac, spaOptionsFromEnv());
    const record = process.env.RETURN_SPA_ID ? await store.find(process.env.RETURN_SPA_ID) : await store.latestPendingApproval();
    if (record.smartStatus !== 'pending_approval') {
        throw new Error(`${record.spaId} is in ${record.smartStatus}, not Pending - Approval. Refusing to return it to review.`);
    }
    targetSpaId = record.spaId;
});
test.use({ spaId: async ({ }, use) => use(targetSpaId) });
test.use({ smartRole: 'DIVDIR' });

test('Returns SPA to review: Division Director returns to review and the SPA moves to Pending - First Clock', async ({ navigation, page, recordSearch, spaRecord, spaStore }) => {
    await navigation.openSmartHome();
    await recordSearch.openSpa(targetSpaId);
    await test.step('Open the Adjudication tab', async () => {
        await spaRecord.adjudication.open();
    });
    await test.step('Record Return to Review Team on the Adjudication row', async () => {
        await spaRecord.adjudication.recordDecision('Adjudication', 'Return to Review Team');
    });
    await test.step('Verify the Division Director is recorded as Acted By User', async () => {
        await spaRecord.adjudication.expectActedBy('Adjudication', divisionDirectorName);
    });
    await spaStore.markReturnedToReview(targetSpaId);
    await test.step('Verify the SPA is Pending - First Clock', async () => {
        const status = page.getByRole('option', { name: 'Pending - First Clock', exact: true });
        await expect(status).toHaveCount(1);
        await expect(status).toHaveAttribute('aria-selected', 'true');
    });
});
