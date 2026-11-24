import type { Page } from '@playwright/test';
import { test, expect } from '../../../../support/fixtures/smart.fixture';
import { SpaRecord } from '../../../../support/ui/smart/spa-record';

test.use({ smartRole: 'SUPERUSR' });

const splitIdentifier = 'A';
const splitReason = 'SRT reviews documents and CPOC reviews financials';

test('Super User splits a Pending - First Clock Med SPA', async ({ navigation, page, recordSearch, spaId, spaStore }) => {
    const childSpaId = `${spaId}-${splitIdentifier}`;
    const parent = new SpaRecord(page);

    await navigation.openSmartHome();
    await recordSearch.openSpa(spaId);

    let parentReviewRows: string[][] = [];
    let parentNoteRows: string[][] = [];
    await test.step('Read the parent Submission Review Team and Notes before splitting', async () => {
        parentReviewRows = await parent.review.readReviewGridRows();
        parentNoteRows = await parent.notes.readSidebarNoteRows();
        expect(parentReviewRows.length).toBeGreaterThan(0);
    });

    await test.step('Open the Split SPA dialog from the parent record', async () => {
        await parent.splitSpa.open();
    });

    let childPage: Page | undefined;
    await test.step(`Create split ${childSpaId} and open it in a new tab`, async () => {
        const newTab = page.context().waitForEvent('page');
        await parent.splitSpa.createSplit(splitIdentifier, splitReason);
        childPage = await newTab;
        await childPage.waitForLoadState('domcontentloaded');
        await expect(page.getByText(`Split SPA or Waiver "${childSpaId}" was created.`)).toBeVisible();
    });

    await test.step('Verify the child Details tab links back to the parent SPA', async () => {
        const child = new SpaRecord(childPage!);
        await child.details.open();
        await expect(childPage!.getByRole('link', { name: spaId, exact: true })).toBeVisible();
    });

    await test.step('Verify the child Submission Review Team matches the parent', async () => {
        const child = new SpaRecord(childPage!);
        expect(await child.review.readReviewGridRows()).toEqual(parentReviewRows);
    });

    await test.step('Verify the child Notes carry over with the parent note dates', async () => {
        const child = new SpaRecord(childPage!);
        expect(await child.notes.readSidebarNoteRows()).toEqual(parentNoteRows);
    });

    await test.step('Record the split in the local SPA store under the parent', async () => {
        await spaStore.recordSplit(spaId, splitIdentifier, splitReason);
    });
});
