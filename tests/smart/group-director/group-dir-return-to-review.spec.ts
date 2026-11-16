import { expect } from '@playwright/test';
import { test } from '../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { currentSpaStore } from '../../../support/data/spa-store';

// RETURN_SPA_ID targets a specific record. Without it, the newest SPA awaiting the Group Director is used, whether it is in
// Pending - Concurrence (after approvals, decided on the Concurrence row) or Pending - Disapproval (decided on the Adjudication row).
const groupDirectorName = 'GroupPW DirectorPW';
let targetSpaId: string;
let section: 'Concurrence' | 'Adjudication';
test.beforeAll(async () => {
    const store = await currentSpaStore(appUrls.onemac, spaOptionsFromEnv());
    const record = process.env.RETURN_SPA_ID ? await store.find(process.env.RETURN_SPA_ID) : await store.latestAwaitingGroupDirector();
    if (record.smartStatus !== 'pending_concurrence' && record.smartStatus !== 'pending_disapproval') {
        throw new Error(`${record.spaId} is in ${record.smartStatus}, not Pending - Concurrence or Pending - Disapproval. Refusing to return it to review.`);
    }
    targetSpaId = record.spaId;
    section = record.smartStatus === 'pending_disapproval' ? 'Adjudication' : 'Concurrence';
});
test.use({ spaId: async ({ }, use) => use(targetSpaId) });

test('Returns SPA to review: Group Director returns to review and the SPA moves to Pending - First Clock', async ({ navigation, page, recordSearch, spaRecord, spaStore }) => {
    await navigation.openSmartHome();
    await recordSearch.openSpa(targetSpaId);
    await test.step('Open the Adjudication tab', async () => {
        await spaRecord.adjudication.open();
    });
    await test.step(`Record Return to Review Team on the ${section} row`, async () => {
        await spaRecord.adjudication.recordDecision(section, 'Return to Review Team');
    });
    await test.step('Verify the Group Director is recorded as Acted By User', async () => {
        await spaRecord.adjudication.expectActedBy(section, groupDirectorName);
    });
    await spaStore.markReturnedToReview(targetSpaId);
    await test.step('Verify the SPA is Pending - First Clock', async () => {
        const status = page.getByRole('option', { name: 'Pending - First Clock', exact: true });
        await expect(status).toHaveCount(1);
        await expect(status).toHaveAttribute('aria-selected', 'true');
    });
});
