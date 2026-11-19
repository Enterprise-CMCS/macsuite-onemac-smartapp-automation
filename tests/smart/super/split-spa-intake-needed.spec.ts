import type { Page } from '@playwright/test';
import { test, expect } from '../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { currentSpaStore } from '../../../support/data/spa-store';
import { SpaRecord } from '../../../support/ui/smart/spa-record';

// Splits the newest SPA while it is still at Intake Needed, before intake fills it out. SPA_ID overrides the parent.
let parentSpaId: string;
test.beforeAll(async () => {
    const override = process.env.SPA_ID?.trim();
    parentSpaId = override ?? (await (await currentSpaStore(appUrls.onemac, spaOptionsFromEnv())).latestIntakeNeededWorkflow())[0].spaId;
});
test.use({ spaId: async ({ }, use) => use(parentSpaId) });
test.use({ smartRole: 'SUPERUSR' });

const splitIdentifier = 'A';
const splitReason = 'Split before intake for parallel approval';
// The only basic fields checked: the OneMAC submission dates must be set on the parent and carried to the child.
const submissionDateLabels = ['Initial Submission Date', 'Proposed Effective Date'];

test('Super User splits an Intake Needed Med SPA', async ({ navigation, page, recordSearch, spaId, spaStore }) => {
    const childSpaId = `${spaId}-${splitIdentifier}`;
    const parent = new SpaRecord(page);

    await navigation.openSmartHome();
    await recordSearch.openSpa(spaId);

    await test.step('Verify the parent is at Intake Needed and the Split SPA action is available', async () => {
        await parent.details.open();
        await parent.details.expectRowValue('Status', 'Intake Needed');
        await expect(page.getByRole('button', { name: 'Split SPA', exact: true })).toBeVisible();
    });

    let childPage: Page | undefined;
    let parentDates: string[] = [];
    await test.step('Verify the parent has its OneMAC submission dates before splitting', async () => {
        parentDates = [];
        for (const label of submissionDateLabels) {
            const value = await parent.details.readRowValue(label);
            expect(value, `${label} must be set on the parent`).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
            parentDates.push(value);
        }
    });

    await test.step('Open the Split SPA dialog from the parent record', async () => {
        await parent.splitSpa.open();
    });

    await test.step(`Create split ${childSpaId} and open it in a new tab`, async () => {
        const newTab = page.context().waitForEvent('page');
        await parent.splitSpa.createSplit(splitIdentifier, splitReason);
        childPage = await newTab;
        await childPage.waitForLoadState('domcontentloaded');
        await expect(page.getByText(`Split SPA or Waiver "${childSpaId}" was created.`)).toBeVisible();
    });

    await test.step('Verify the child is at Intake Needed, links back to the parent, and keeps the submission dates', async () => {
        const child = new SpaRecord(childPage!);
        await child.details.open();
        await child.details.expectRowValue('Status', 'Intake Needed');
        await expect(childPage!.getByRole('link', { name: spaId, exact: true })).toBeVisible();
        const childDates: string[] = [];
        for (const label of submissionDateLabels) {
            childDates.push(await child.details.readRowValue(label));
        }
        expect(childDates).toEqual(parentDates);
    });

    await test.step('Record the split in the local SPA store under the parent', async () => {
        await spaStore.recordSplit(spaId, splitIdentifier, splitReason);
    });
});
