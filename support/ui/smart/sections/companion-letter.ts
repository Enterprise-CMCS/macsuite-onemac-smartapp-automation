import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

// The Companion Letter block sits in the Adjudication tab. Checking "Companion Letter Needed" and saving creates the letter.
export class SmartCompanionLetter {
    constructor(readonly page: Page) { }

    section(): Locator {
        return this.page.locator('flexipage-field-section2')
            .filter({ has: this.page.getByRole('button', { name: 'Companion Letter', exact: true }) });
    }

    // The checkbox only exists in edit mode; the read-only field shows True or False with a pencil.
    needed(): Locator {
        return this.page.getByRole('checkbox', { name: 'Companion Letter Needed', exact: true });
    }

    // Returns the letter name shown in the related list, for example CA-26-0086-QA14-CL.
    async requestLetter(spaId: string): Promise<{ letterName: string; recordId: string }> {
        const section = this.section();
        await expect(section).toHaveCount(1);
        const value = section.getByText(/^(True|False)$/);
        await expect(value).toHaveCount(1);
        if ((await value.textContent()) === 'False') {
            const edit = this.page.getByRole('button', { name: 'Edit Companion Letter Needed', exact: true });
            await expect(edit).toHaveCount(1);
            await edit.click();
            await expect(this.needed()).toHaveCount(1);
            await this.needed().check();
            // The inline edit's Save sits in the page footer, not inside the section.
            const save = this.page.getByRole('button', { name: 'Save', exact: true });
            await expect(save).toHaveCount(1);
            await save.click();
            await expect(this.needed()).toHaveCount(0);
            await expect(value).toHaveText('True');
        }
        return this.expectLetterListed(spaId);
    }

    async expectLetterListed(spaId: string): Promise<{ letterName: string; recordId: string }> {
        const letterName = `${spaId}-CL`;
        const link = this.page.getByRole('link', { name: letterName, exact: true });
        await expect(link).toHaveCount(1);
        const href = await link.getAttribute('href');
        const recordId = href?.match(/\/([a-zA-Z0-9]{15,18})\/view/)?.[1];
        if (!recordId) throw new Error(`Could not read the companion letter record ID from ${href}`);
        return { letterName, recordId };
    }
}

// The letter record under Oversight and Monitoring, opened by the CPOC and other roles that work the issues.
export class CompanionLetterRecord {
    constructor(readonly page: Page) { }

    async openFromOversight(letterName: string, recordId: string): Promise<void> {
        const origin = new URL(this.page.url()).origin;
        const link = this.page.getByRole('link', { name: letterName, exact: true });
        // A new letter can take a moment to show in the list, so reload and search again until it appears.
        const attempts = 10;
        let found = false;
        for (let attempt = 1; attempt <= attempts && !found; attempt++) {
            await this.page.goto(`${origin}/lightning/o/SMART_CMCS_Companion_Letter__c/home`);
            const listPicker = this.page.getByRole('button', { name: /Select a List View/ });
            await expect(listPicker).toHaveCount(1);
            await listPicker.click();
            await this.page.getByRole('option', { name: 'All', exact: true }).click();
            const search = this.page.getByRole('searchbox', { name: 'Search this list...' });
            await search.fill(letterName);
            await search.press('Enter');
            found = await link.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true, () => false);
        }
        if (!found) throw new Error(`${letterName} did not appear in Oversight and Monitoring after ${attempts} searches.`);
        await expect(link).toHaveCount(1);
        await expect(link).toHaveAttribute('href', new RegExp(`/${recordId}/view`));
        await link.click();
        await expect(this.page.getByRole('heading', { level: 1, name: letterName })).toBeVisible();
    }

    async status(): Promise<string> {
        const item = this.page.getByRole('listitem').filter({ hasText: /^Status/ });
        await expect(item).toHaveCount(1);
        const lines = (await item.innerText()).split('\n').map((line) => line.trim()).filter(Boolean);
        return lines[lines.length - 1];
    }

    async issueCount(): Promise<number> {
        const article = this.page.getByRole('article', { name: 'Monitoring Action Issues' });
        await expect(article).toHaveCount(1);
        const countText = article.getByText(/^\(\d+\)$/);
        await expect(countText).toHaveCount(1);
        const match = (await countText.textContent())?.match(/\((\d+)\)/);
        if (!match) throw new Error('Could not read the Monitoring Action Issues count');
        return Number(match[1]);
    }

    async openById(letterName: string, recordId: string): Promise<void> {
        const origin = new URL(this.page.url()).origin;
        await this.page.goto(`${origin}/lightning/r/SMART_CMCS_Companion_Letter__c/${recordId}/view`);
        await expect(this.page.getByRole('heading', { level: 1, name: letterName })).toBeVisible();
    }

    // Subject, Description, and Response Due Date must be filled before milestones can be saved.
    async setDetails(details: { subject: string; description: string; responseDueDate: string }): Promise<void> {
        const fields: Array<[string, string]> = [
            ['Subject', details.subject],
            ['Description', details.description],
            ['Response Due Date', details.responseDueDate],
        ];
        for (const [label, value] of fields) {
            const input = this.page.getByRole('textbox', { name: label, exact: true });
            if (!(await input.isVisible())) {
                const edit = this.page.getByRole('button', { name: `Edit ${label}`, exact: true });
                await expect(edit).toHaveCount(1);
                await edit.click();
            }
            await expect(input).toBeVisible();
            await input.fill(value);
            await expect(input).toHaveValue(value);
        }
        const save = this.page.getByRole('button', { name: 'Save', exact: true });
        await expect(save).toHaveCount(1);
        await save.click();
        await expect(this.page.getByRole('textbox', { name: 'Subject', exact: true })).toHaveCount(0);
    }

    // Reads a Details value as the CPOC sees it; the list item text is the label followed by the value.
    async detailValue(label: 'Subject' | 'Description' | 'Response Due Date'): Promise<string> {
        const item = this.page.getByRole('listitem').filter({ hasText: new RegExp(`^${label}`) });
        await expect(item).toHaveCount(1);
        const lines = (await item.innerText()).split('\n').map((line) => line.trim()).filter(Boolean);
        return lines.slice(1).filter((line) => !line.startsWith('Edit ')).join(' ');
    }

    // Milestone alerts are shown read-only until a per-field pencil opens them. One Save writes them all.
    async setMilestones(alerts: Record<string, string>): Promise<void> {
        const section = this.page.locator('flexipage-field-section2')
            .filter({ has: this.page.getByRole('button', { name: 'Milestones', exact: true }) });
        await expect(section).toHaveCount(1);
        for (const [label, days] of Object.entries(alerts)) {
            const input = section.getByRole('spinbutton', { name: label, exact: true });
            if (!(await input.isVisible())) {
                const edit = this.page.getByRole('button', { name: `Edit ${label}`, exact: true });
                await expect(edit).toHaveCount(1);
                await edit.click();
            }
            await expect(input).toBeVisible();
            await input.fill(days);
            await expect(input).toHaveValue(days);
        }
        const save = this.page.getByRole('button', { name: 'Save', exact: true });
        await expect(save).toHaveCount(1);
        await save.click();
        for (const label of Object.keys(alerts)) {
            await expect(section.getByRole('spinbutton', { name: label, exact: true })).toHaveCount(0);
        }
    }

    issueLink(issueName: string): Locator {
        return this.page.getByRole('rowheader', { name: issueName, exact: true });
    }

    async createIssue(issueName: string, citation: string): Promise<void> {
        await this.page.getByRole('button', { name: 'New Issue', exact: true }).click();
        const dialog = this.page.getByRole('dialog', { name: 'New Issue' });
        await expect(dialog).toBeVisible();
        await dialog.getByRole('textbox', { name: 'Monitoring Action Issue', exact: true }).fill(issueName);
        await dialog.getByRole('textbox', { name: 'Citation', exact: true }).fill(citation);
        await dialog.getByLabel('*Issue Status').selectOption({ label: 'Open' });
        await dialog.getByRole('button', { name: 'Next', exact: true }).click();
        await dialog.getByRole('button', { name: 'Finish', exact: true }).click();
        await expect(dialog).toBeHidden();
        await expect(this.issueLink(issueName)).toHaveCount(1);
    }

    // Closing an issue needs a Closed Date. Do not press Escape in that field; it discards the dialog.
    async setIssueStatus(issueName: string, status: 'Open' | 'Closed', closedDate?: string): Promise<void> {
        const row = this.page.getByRole('row').filter({ has: this.issueLink(issueName) });
        await row.getByRole('button', { name: 'Show Actions' }).click();
        await this.page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
        const dialog = this.page.getByRole('dialog', { name: issueName });
        await expect(dialog).toBeVisible();
        await dialog.getByRole('combobox', { name: /Issue Status/ }).click();
        await this.page.getByRole('option', { name: status, exact: true }).click();
        if (closedDate) {
            await dialog.getByRole('textbox', { name: 'Closed Date', exact: true }).fill(closedDate);
        }
        await dialog.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(dialog).toBeHidden();
    }

    // Files sit under the Details tab, not Field History Tracking.
    async openDetails(): Promise<void> {
        const tab = this.page.getByRole('tab', { name: 'Details', exact: true });
        await expect(tab).toHaveCount(1);
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
    }

    // Uploads through the letter's own Files article, not the SPA attachments. The file must be listed afterwards.
    async uploadFile(filePath: string): Promise<void> {
        await this.openDetails();
        const files = this.page.getByRole('article', { name: 'Files', exact: true });
        await expect(files).toHaveCount(1);
        const countBefore = await this.fileCount();
        // The "Upload Files" control resolves to a hidden file input that Lightning overlays, so clicking it retries and scrolls the page.
        await files.locator('input[type="file"]').setInputFiles(filePath);
        await this.page.getByRole('button', { name: 'Done', exact: true }).click();
        await expect.poll(() => this.fileCount(), { timeout: 60_000 }).toBe(countBefore + 1);
    }

    async fileCount(): Promise<number> {
        const heading = this.page.getByRole('article', { name: 'Files', exact: true })
            .getByRole('link', { name: /^Files \(\d+\)$/ });
        await expect(heading).toHaveCount(1);
        const match = (await heading.textContent())?.match(/\((\d+)\)/);
        if (!match) throw new Error('Could not read the Files count');
        return Number(match[1]);
    }

    // The Add Note button stays disabled until text is entered. Once saved, the note appears and the box clears.
    async addNote(text: string): Promise<void> {
        const box = this.page.getByRole('textbox', { name: 'Add Note', exact: true });
        await expect(box).toHaveCount(1);
        await box.fill(text);
        const add = this.page.getByRole('button', { name: 'Add Note', exact: true });
        await expect(add).toBeEnabled();
        await add.click();
        await expect(this.page.getByText(text, { exact: true })).toBeVisible();
        await expect(box).toHaveValue('');
    }
}
