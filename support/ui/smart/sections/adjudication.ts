import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export type DecisionSection = 'Concurrence' | 'Adjudication';

export class SmartAdjudication {
    constructor(readonly page: Page) { }

    async open(): Promise<void> {
        const tab = this.page.getByRole('tab', { name: 'Adjudication', exact: true });
        await expect(tab).toHaveCount(1);
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
    }

    // Each decision grid is a named article. Rows are created by a Record Decision save.
    sectionFor(section: DecisionSection): Locator {
        return this.page.getByRole('article', { name: section, exact: true });
    }

    // rowNumber selects that row by its position in the grid, for example 2 for the pending row after a return.
    // blankStatus selects the first row with no decision yet, for grids where an earlier return leaves a row behind.
    async recordDecision(section: DecisionSection, decision: 'Concur' | 'Approve' | 'Disapprove' | 'Return to Review Team', options: { rowNumber?: number; blankStatus?: boolean } = {}): Promise<void> {
        const grid = this.sectionFor(section);
        const rowCheckbox = options.blankStatus
            ? grid.getByRole('row').filter({ hasNotText: /Return to Review|Approve|Disapprove|Concur/ }).getByRole('checkbox', { name: /Select Item/ }).first()
            : grid.getByRole('checkbox', { name: new RegExp(`Select Item ${options.rowNumber ?? 1}\\b`) });
        // The row checkbox's label intercepts pointer clicks, so the input is checked with force.
        await rowCheckbox.check({ force: true });
        await expect(rowCheckbox).toBeChecked();
        await grid.getByRole('button', { name: 'Record Decision', exact: true }).click();

        const dialog = this.page.getByRole('dialog');
        await expect(dialog).toHaveCount(1);
        // The combobox name includes its current value ("Decision --None--"), so match by prefix.
        await dialog.getByRole('combobox', { name: /^Decision/ }).click();
        await this.page.getByRole('option', { name: decision, exact: true }).click();

        await dialog.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(dialog).toHaveCount(0);
    }

    // The Adjudication grid gets a Division Director row once concurrence is saved.
    async expectDivisionDirectorRow(): Promise<void> {
        const rows = this.sectionFor('Adjudication').getByRole('row').filter({ hasText: 'Division Director' });
        await expect(rows).toHaveCount(1);
    }

    // Acted By User shows the account that saved the decision in that section.
    async expectActedBy(section: DecisionSection, name: string): Promise<void> {
        const rows = this.sectionFor(section).getByRole('row').filter({ hasText: name });
        await expect(rows).toHaveCount(1);
    }
}