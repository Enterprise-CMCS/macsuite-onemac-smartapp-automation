import type { Page } from '@playwright/test';
import { test, expect } from '../../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../../support/data/spa';
import { currentSpaStore } from '../../../../support/data/spa-store';
import { SpaRecord } from '../../../../support/ui/smart/spa-record';

test.use({ smartRole: 'SUPERUSR' });

// SPA_ID picks the parent. Without it, the newest Second Clock parent in the store is used.
// The lookup runs before login, so the test fails without opening a browser when no record is ready.
let parentSpaId: string;
test.beforeAll(async () => {
    parentSpaId = process.env.SPA_ID ?? (await (await currentSpaStore(appUrls.onemac, spaOptionsFromEnv())).latestSecondClockWorkflow())[0].spaId;
});
test.use({ spaId: async ({ }, use) => use(parentSpaId) });

const splitIdentifier = 'A';
const splitReason = 'SRT reviews documents and CPOC reviews financials';

test('Super User splits a Pending - Second Clock Med SPA after OneMAC responds to the formal RAI', async ({ navigation, page, recordSearch, spaId, spaStore }) => {
    const childSpaId = `${spaId}-${splitIdentifier}`;
    const parent = new SpaRecord(page);

    await navigation.openSmartHome();
    await recordSearch.openSpa(spaId);

    await test.step('Verify the parent is in Pending - Second Clock', async () => {
        const status = page.getByRole('option', { name: 'Pending - Second Clock', exact: true });
        await expect(status).toHaveCount(1);
        await expect(status).toHaveAttribute('aria-selected', 'true');
    });
    await spaStore.markPendingSecondClock(spaId);

    let parentReviewRows: string[][] = [];
    let parentNoteRows: string[][] = [];
    let parentSecondClockStart = '';
    await test.step('Read the parent Submission Review Team, Notes, and Second Clock Start Date before splitting', async () => {
        parentReviewRows = await parent.review.readReviewGridRows('second');
        parentNoteRows = await parent.notes.readSidebarNoteRows();
        await parent.details.open();
        parentSecondClockStart = await parent.details.readRowValue('Second Clock Start Date');
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

    await test.step('Verify the child is in Pending - Second Clock', async () => {
        const status = childPage!.getByRole('option', { name: 'Pending - Second Clock', exact: true });
        await expect(status).toHaveCount(1);
        await expect(status).toHaveAttribute('aria-selected', 'true');
    });

    await test.step('Verify the child Second Clock Start Date matches the parent', async () => {
        const child = new SpaRecord(childPage!);
        await child.details.expectRowValue('Second Clock Start Date', parentSecondClockStart);
    });

    await test.step('Verify the child Submission Review Team matches the parent', async () => {
        const child = new SpaRecord(childPage!);
        expect(await child.review.readReviewGridRows('second')).toEqual(parentReviewRows);
    });

    await test.step('Verify the child Notes carry over with the parent note dates', async () => {
        const child = new SpaRecord(childPage!);
        expect(await child.notes.readSidebarNoteRows()).toEqual(parentNoteRows);
    });

    await test.step('Record the split in the local SPA store under the parent', async () => {
        await spaStore.recordSplit(spaId, splitIdentifier, splitReason);
    });
});
