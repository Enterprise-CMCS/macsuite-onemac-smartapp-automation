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
}