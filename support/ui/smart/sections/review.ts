import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export type ReviewClock = 'first' | 'second';
const reviewGridHeading: Record<ReviewClock, string> = {
    first: 'Submission Review Team',
    second: 'Second Clock Review',
};

export class SmartReview {
    constructor(readonly page: Page) { }

    async assignCpoc(searchText: string, notes: string): Promise<void> {
        await this.assignUser(searchText, notes, 'cpoc');
    }

    // Searching by name can match several users. rowText picks the row to select, for example the user's email.
    async assignSrt(searchText: string, notes: string, designation: 'none' | 'sme' = 'none', rowText: string = searchText): Promise<void> {
        await this.assignUser(searchText, notes, designation, rowText);
    }

    // SRT and CPOC review progress are both set on the Submission Review Team record, opened from the Review tab.
    // The SPA ID link on that record is the only way back to the main SPA page, so it is clicked after the save.
    // Disapproving Groups only appears once Recommending Disapproval is selected, so it is set after Review Progress.
    async setReviewTeamProgress(memberName: string, progress: string, spaId: string, clock: ReviewClock, disapprovingGroup?: string): Promise<void> {
        await this.openReviewTeamRecord(memberName);
        // Review Progress is saved from its own edit control in Information; the Path bar only shows the stage.
        await this.page.getByRole('button', { name: 'Edit Review Progress', exact: true }).click();
        const progressField = this.page.getByRole('combobox', { name: 'Review Progress', exact: true });
        await this.selectComboboxOption(progressField, progress);
        if (disapprovingGroup) {
            await this.selectComboboxOption(this.page.getByRole('combobox', { name: 'Disapproving Groups', exact: true }), disapprovingGroup);
        }
        await this.saveReviewTeamRecord(progressField, spaId);
        await this.expectReviewTeamProgress(memberName, progress, clock);
    }

    // Sets Review Progress to Recommending RAI, RAI Needed = Yes, the numbered RAI questions, and RAI Questions Completed = Yes,
    // then saves once. The caller verifies the saved progress afterward on the Review tab.
    async recommendRai(memberName: string, spaId: string, questions: string[]): Promise<void> {
        await this.openReviewTeamRecord(memberName);
        await this.page.getByRole('button', { name: 'Edit Review Progress', exact: true }).click();
        await this.selectComboboxOption(this.page.getByRole('combobox', { name: 'Review Progress', exact: true }), 'Recommending RAI');
        await this.selectComboboxOption(this.page.getByRole('combobox', { name: 'RAI Needed', exact: true }), 'Yes');
        await this.typeRaiQuestions(questions);
        // Blurring the editor directly keeps the next click from being spent on the focus change.
        await this.page.getByRole('group', { name: 'RAI Questions', exact: true }).locator('.ql-editor').filter({ visible: true }).blur();
        await this.selectComboboxOption(this.page.getByRole('combobox', { name: 'RAI Questions Completed', exact: true }), 'Yes');
        await this.saveRaiSection(spaId);
        await expect(this.page.getByText('Edit RAI Questions Completed', { exact: true })).toHaveCount(1);
    }

    // The rich-text body is not in the accessibility tree, so focus it by clicking near the bottom of the group.
    // The Numbered list button is turned on before typing; typed "1." prefixes would double up with auto-numbering.
    private async typeRaiQuestions(questions: string[]): Promise<void> {
        const group = this.page.getByRole('group', { name: 'RAI Questions', exact: true });
        await expect(group).toHaveCount(1);
        const box = await group.boundingBox();
        if (!box) {
            throw new Error('RAI Questions editor has no bounding box');
        }
        await this.page.mouse.click(box.x + box.width / 2, box.y + box.height - 25);
        await this.page.keyboard.press('Meta+A');
        await this.page.keyboard.press('Backspace');
        await this.page.keyboard.press('Backspace');
        await this.page.getByRole('button', { name: 'Numbered list', exact: true }).click();
        await this.page.keyboard.type(questions.join('\n'));
    }

    // Creates the consolidated RAI from the Review tab. The dialog closes and the page returns to the SPA record.
    async prepareRaiQuestions(): Promise<void> {
        await this.openReviewTab();
        await this.page.getByRole('button', { name: 'Prepare RAI Questions', exact: true }).click();
        const dialog = this.page.getByRole('dialog').first();
        await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toHaveCount(1);
        await dialog.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(this.page.getByRole('dialog')).toHaveCount(0);
    }

    // Opens the RAI record from the RAI link in the RAI Details card at the bottom of the SPA record. No-op if already on it.
    async openRaiRecord(spaId: string): Promise<void> {
        if (this.page.url().includes('SMART_Request_for_Additional_Information__c')) return;
        const raiLink = this.page.getByRole('link', { name: `${spaId}-RAI`, exact: true });
        // The RAI Details card is below the fold and its rows render only once the card is in view, so scroll to the card first.
        await this.page.getByRole('heading', { name: 'RAI Details', exact: true }).scrollIntoViewIfNeeded();
        await expect(raiLink).toBeVisible();
        await raiLink.scrollIntoViewIfNeeded();
        await raiLink.click();
        await this.page.waitForURL(/SMART_Request_for_Additional_Information__c/);
    }

    // Saves RAI Issued Date on the RAI record, reads RAI Request Expires, then returns to the SPA through its ID link.
    // The RAI link sits in the RAI Details card on the SPA record page, which loads after Prepare RAI Questions.
    async setRaiIssuedDate(date: string, spaId: string): Promise<{ issuedDate: string; expiresDate: string }> {
        await this.openRaiRecord(spaId);
        await this.page.getByRole('button', { name: 'Edit RAI Issued Date', exact: true }).click();
        const issuedDate = this.page.getByRole('textbox', { name: 'RAI Issued Date', exact: true });
        await expect(issuedDate).toHaveCount(1);
        await issuedDate.fill(date);
        await issuedDate.press('Tab');
        await this.page.getByRole('button', { name: 'Save', exact: true }).first().click();
        await expect(issuedDate).toBeHidden();
        const expires = this.page.getByRole('listitem').filter({ has: this.page.getByText('RAI Request Expires', { exact: true }) });
        await expect(expires).toHaveCount(1);
        const expiresText = (await expires.getByText(/^\d{1,2}\/\d{1,2}\/\d{4}$/).first().innerText()).trim();
        const spaLink = this.page.getByRole('link', { name: spaId, exact: true });
        await expect(spaLink).toHaveCount(1);
        await spaLink.click();
        await this.page.waitForURL(/SMART_CMCS_SPA_Waiver__c/);
        return { issuedDate: date, expiresDate: expiresText };
    }

    private async saveRaiSection(spaId: string): Promise<void> {
        const save = this.page.getByRole('button', { name: 'Save', exact: true });
        await expect(save).toHaveCount(1);
        await save.click();
        await expect(this.page.getByRole('combobox', { name: 'RAI Needed', exact: true })).toBeHidden();
        const spaLink = this.page.locator('a[href*="SMART_CMCS_SPA_Waiver__c"]', { hasText: spaId }).first();
        await expect(spaLink).toHaveCount(1);
        await spaLink.click();
        await this.page.waitForURL(/SMART_CMCS_SPA_Waiver__c/);
    }

    private async openReviewTeamRecord(memberName: string): Promise<void> {
        await this.openReviewTab();
        // The same member name also appears in the RAI Questions grid, so match only the Review Team record link.
        const memberLink = this.page.locator('a[href*="SMART_CMCS_Submission_Review_Team__c"]')
            .filter({ hasText: new RegExp(`^${memberName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
        await expect(memberLink).toHaveCount(1);
        // A click on this link can be swallowed while the Review tab is still rendering, so the click is retried until the record opens.
        await expect(async () => {
            await memberLink.click();
            await this.page.waitForURL(/SMART_CMCS_Submission_Review_Team__c/, { timeout: 10_000 });
        }).toPass({ timeout: 60_000 });
    }

    // Options from other comboboxes stay in the DOM with the same data-value, so wait for this field to expand
    // and click only the visible option.
    private async selectComboboxOption(field: Locator, value: string): Promise<void> {
        await expect(field).toHaveCount(1);
        await field.click();
        await expect(field).toHaveAttribute('aria-expanded', 'true');
        await this.page.locator(`lightning-base-combobox-item[data-value="${value}"]`)
            .filter({ visible: true })
            .click();
    }

    // Returns to the SPA through its ID link after the save, since that link is the only way back to the main SPA page.
    private async saveReviewTeamRecord(progressField: Locator, spaId: string): Promise<void> {
        const save = this.page.getByRole('button', { name: 'Save', exact: true });
        await expect(save).toHaveCount(1);
        await save.click();
        await expect(progressField).toBeHidden();
        const spaLink = this.page.locator('a[href*="SMART_CMCS_SPA_Waiver__c"]', { hasText: spaId }).first();
        await expect(spaLink).toHaveCount(1);
        await spaLink.click();
        await this.page.waitForURL(/SMART_CMCS_SPA_Waiver__c/);
    }

    // Reads the saved value from the clock's review grid on the Review tab, not the record page, so an unsaved change fails.
    // A page reload does not refresh the grid, so its Refresh button is clicked on each poll.
    async expectReviewTeamProgress(memberName: string, progress: string, clock: ReviewClock): Promise<void> {
        const grid = this.page.locator('article')
            .filter({ has: this.page.getByRole('heading', { name: reviewGridHeading[clock], exact: true }) });
        const refresh = grid.getByRole('button', { name: 'Refresh', exact: true });
        await expect.poll(async () => {
            await this.openReviewTab();
            await refresh.click();
            const row = grid.getByRole('row').filter({ hasText: memberName }).first();
            return row.textContent();
        }, { timeout: 60000 }).toContain(progress);
    }

    // Each row is its name cell followed by the cell texts, so two SPAs' grids can be compared with toEqual.
    async readReviewGridRows(clock: ReviewClock = 'first'): Promise<string[][]> {
        await this.openReviewTab();
        const grid = this.page.locator('article')
            .filter({ has: this.page.getByRole('heading', { name: reviewGridHeading[clock], exact: true }) });
        const rows = grid.getByRole('row').filter({ has: this.page.getByRole('rowheader') });
        await expect(rows.first()).toBeVisible();
        const count = await rows.count();
        const result: string[][] = [];
        for (let i = 0; i < count; i++) {
            result.push(await rows.nth(i).locator('[role=rowheader], [role=gridcell]').allInnerTexts());
        }
        return result;
    }

    async expectFirstClockReview(): Promise<void> {
        await this.openReviewTab();
        const section = this.page.getByText('First Clock Review', { exact: true }).filter({ visible: true });
        await expect(section).toHaveCount(1);
    }

    async expectSecondClockIntake(fields: readonly string[]): Promise<void> {
        await this.openReviewTab();
        await expect(this.page.getByText('Second Clock Intake', { exact: true }).filter({ visible: true })).toHaveCount(1);
        for (const field of fields) {
            await expect(this.page.getByText(field, { exact: true }).filter({ visible: true }).first()).toBeVisible();
        }
    }

    // The checkbox is saved from the page-level Save footer, not from the Intake field itself.
    async confirmCpocSrtAssignment(): Promise<void> {
        await this.openReviewTab();
        await this.page.getByRole('button', { name: 'Edit CPOC/SRT Assignment Confirmed', exact: true }).click();
        const confirmed = this.page.getByRole('checkbox', { name: 'CPOC/SRT Assignment Confirmed', exact: true });
        await expect(confirmed).toHaveCount(1);
        await confirmed.check();
        const save = this.page.getByRole('button', { name: 'Save', exact: true });
        await expect(save).toHaveCount(1);
        await save.click();
        await expect(this.page.getByRole('button', { name: 'Cancel', exact: true })).toBeHidden();
    }

    async openReviewTab(): Promise<void> {
        const tab = this.page.getByRole('tab', { name: 'Review', exact: true });
        await expect(tab).toHaveCount(1);
        await tab.click();
    }

    private async assignUser(searchText: string, notes: string, designation: 'cpoc' | 'sme' | 'none', rowText: string = searchText): Promise<void> {
        const tab = this.page.getByRole('tab', { name: 'Review', exact: true });
        await expect(tab).toHaveCount(1);
        await tab.click();
        const search = this.page.getByRole('searchbox', { name: 'Search by Name or Email' });
        if (await search.inputValue()) {
            await this.page.getByRole('button', { name: 'Clear', exact: true }).click();
        }
        await search.fill(searchText);
        await search.press('Enter');
        const resultRow = this.page.getByRole('row').filter({ hasText: rowText });
        await expect(resultRow).toHaveCount(1);
        const selectionCell = resultRow.getByRole('gridcell', { name: /Select Item/ });
        await expect(selectionCell).toBeVisible();
        await selectionCell.click();
        await expect(resultRow).toHaveAttribute('aria-selected', 'true');
        await this.page.getByRole('button', { name: 'Assign', exact: true }).click();
        const dialog = this.page.getByRole('dialog', { name: 'Assignment Notes', exact: true });
        await expect(dialog).toBeVisible();
        await dialog.getByRole('textbox', { name: 'Assignment Notes', exact: true }).fill(notes);
        if (designation !== 'none') {
            const control = dialog.locator(`lightning-input[data-role="${designation === 'cpoc' ? 'cpoc' : 'sme'}"]`);
            await expect(control).toHaveCount(1);
            const checkbox = control.locator('input[type="checkbox"]');
            if (!await checkbox.isChecked()) {
                await control.locator('label').click();
            }
            await expect(checkbox).toBeChecked();
        }
        await dialog.getByRole('button', { name: 'Save Assignments', exact: true }).click();
        await expect(this.page.getByText('Success notification.', { exact: true }).filter({ visible: true })).toHaveCount(1);
    }
}