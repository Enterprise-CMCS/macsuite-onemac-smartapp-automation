import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export interface IntakeHistoryExpectations {
    subject: string;
    description: string;
    /** Formatted as "Type - Subtype1, Subtype2". */
    typeSubtype: string;
    /** Field label to expected New Value, e.g. { 'Alert 1 Day': '45' }. */
    alerts: Record<string, string>;
    /** Formatted as MM/DD/YYYY. */
    intakeCompleteDate: string;
}

export class SmartFieldHistory {
    constructor(readonly page: Page) { }

    async open(): Promise<void> {
        const tab = this.page.getByRole('tab', { name: 'Field History Tracking', exact: true });
        await expect(tab).toHaveCount(1);
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
    }

    // Checks the newest Status change. Field History records Status only, not the Concurrence or Adjudication decision.
    async expectLatestStatusChange(from: string, to: string): Promise<void> {
        const historyGrid = this.page.getByRole('grid', { name: 'Field history', exact: true })
            .filter({ hasNotText: 'Related Record' })
            .filter({ has: this.page.getByRole('gridcell', { name: 'Status', exact: true }) });
        await expect(historyGrid).toHaveCount(1);
        const status = historyGrid.getByRole('row').filter({
            has: this.page.getByRole('gridcell', { name: 'Status', exact: true }),
        }).first();
        await expect(status.locator('[role="gridcell"][data-label="Original Value"]')).toHaveText(from);
        await expect(status.locator('[role="gridcell"][data-label="New Value"]')).toHaveText(to);
    }

    async verifyIntakeChanges(expected: IntakeHistoryExpectations): Promise<void> {
        const tab = this.page.getByRole('tab', { name: 'Field History Tracking', exact: true });
        await expect(tab).toHaveCount(1);
        await tab.click();

        // The page has two grids named "Field history"; the related-records one is labeled "Related Record" in its sort controls.
        const historyGrid = this.page.getByRole('grid', { name: 'Field history', exact: true })
            .filter({ hasNotText: 'Related Record' });
        await expect(historyGrid).toHaveCount(1);
        await expect(historyGrid).toBeVisible();

        // History is newest-first, so the first match reflects the latest change to that field.
        const rowFor = (field: string) => historyGrid.getByRole('row').filter({
            has: this.page.getByRole('gridcell', { name: field, exact: true }),
        }).first();
        const expectNewValue = async (field: string, value: string) => {
            await expect(rowFor(field).locator('[role="gridcell"][data-label="New Value"]')).toHaveText(value);
        };

        await expectNewValue('Subject', expected.subject);
        await expectNewValue('Description', expected.description);
        await expectNewValue('Type / Subtype', expected.typeSubtype);
        for (const [field, value] of Object.entries(expected.alerts)) {
            await expectNewValue(field, value);
        }

        const status = rowFor('Status');
        await expect(status.locator('[role="gridcell"][data-label="Original Value"]')).toHaveText('Intake Needed');
        await expect(status.locator('[role="gridcell"][data-label="New Value"]')).toHaveText('Pending - First Clock');

        // The Intake Complete value is a checkbox icon, so only its presence is checked.
        await expect(rowFor('Intake Complete')).toBeVisible();
        await expectNewValue('Intake Complete Date', expected.intakeCompleteDate);

        // "Created." is the oldest entry, so it sits on the last page of the history grid.
        const createdRow = historyGrid.getByRole('row').filter({
            has: this.page.getByRole('gridcell', { name: 'Created.', exact: true }),
        });
        if (await createdRow.count() === 0) {
            await this.page.getByRole('button', { name: 'Next', exact: true }).click();
        }
        await expect(createdRow).toHaveCount(1);
        await expect(createdRow.getByRole('gridcell', { name: 'Mulesoft Integration User', exact: true })).toBeVisible();
    }
}