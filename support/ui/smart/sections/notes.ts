import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class SmartNotes {
    constructor(readonly page: Page) { }

    async addNote(note: string): Promise<void> {
        const notesPanel = this.page.locator('flexipage-component2[slot="sidebar"][data-component-id="c_smartCmcsNotes2"]')
            .locator('[aria-label="Add new Note"]');
        await notesPanel.getByRole('textbox', { name: 'Add Note' }).fill(note);
        await notesPanel.getByRole('button', { name: 'Add Note', exact: true }).click();
        await expect(this.page.getByText('Note Created')).toBeVisible();
    }

    // The sidebar Notes grid sits on the right side of the SPA record and stays visible on every tab.
    // Each row is its Date followed by the other cell texts, so a cloned note's original timestamp can be compared.
    async readSidebarNoteRows(): Promise<string[][]> {
        const grid = this.page.locator('flexipage-component2[slot="sidebar"][data-component-id="c_smartCmcsNotes2"]')
            .getByRole('grid', { name: 'Notes', exact: true });
        const rows = grid.getByRole('row').filter({ has: this.page.getByRole('rowheader') });
        await expect(rows.first()).toBeVisible();
        const count = await rows.count();
        const result: string[][] = [];
        for (let i = 0; i < count; i++) {
            result.push(await rows.nth(i).locator('[role=rowheader], [role=gridcell]').allInnerTexts());
        }
        return result;
    }
}