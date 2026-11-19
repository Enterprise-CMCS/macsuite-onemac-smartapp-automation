import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class SmartDetails {
    constructor(readonly page: Page) { }

    async open(): Promise<void> {
        const tab = this.page.getByRole('tab', { name: 'Details', exact: true });
        await expect(tab).toHaveCount(1);
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
    }

    get identifyingInformation(): Locator {
        return this.page.locator('flexipage-field-section2')
            .filter({ has: this.page.getByRole('button', { name: 'Identifying Information', exact: true }) });
    }

    // Read-only record fields have no accessible label association; Salesforce's test-id__ classes tie label to value.
    fieldValue(label: string, scope: Page | Locator = this.page): Locator {
        return scope.locator('.test-id__output-root')
            .filter({ has: this.page.locator('.test-id__field-label').getByText(label, { exact: true }) })
            .filter({ visible: true })
            .locator('.test-id__field-value');
    }

    async expectField(label: string, value: string, scope: Page | Locator = this.page): Promise<void> {
        const field = this.fieldValue(label, scope);
        await expect(field).toHaveCount(1);
        await expect(field).toHaveText(value);
    }

    // Later CPOC steps rely on Priority Code set by the first CPOC action, so fail early if it is blank.
    // The Details value span for Priority Code renders no text; the visible value is in the record highlights panel.
    async expectPriorityCodeSet(): Promise<void> {
        const message = 'Priority Code must be set by the first CPOC action before this step';
        const highlight = this.page.locator('record_flexipage-record-field')
            .filter({ visible: true, hasText: /Priority Code\s+\S/ });
        await expect(highlight, message).toHaveCount(1);
    }

    // Live Details rows are listitems; the label and value share a row container with no sibling link to the label.
    async expectRowValue(label: string, value: string): Promise<void> {
        const row = this.page.getByRole('listitem')
            .filter({ has: this.page.getByText(label, { exact: true }) });
        await expect(row).toHaveCount(1);
        await expect(row).toContainText(value);
    }

    // Returns the value shown in a Details row, skipping the label and the row's "Edit <label>" control text.
    async readRowValue(label: string): Promise<string> {
        const row = this.page.getByRole('listitem')
            .filter({ has: this.page.getByText(label, { exact: true }) });
        await expect(row).toHaveCount(1);
        const lines = (await row.innerText()).split('\n').map((line) => line.trim()).filter(Boolean);
        return lines.find((line) => line !== label && !line.startsWith('Edit ')) ?? '';
    }

    async updateSubmissionSummary(subject: string, description: string, approvedEffectiveDate: string): Promise<void> {
        const tab = this.page.getByRole('tab', { name: 'Details', exact: true });
        await expect(tab).toHaveCount(1);
        await tab.click();
        const editSubject = this.page.getByRole('button', { name: 'Edit Subject', exact: true });
        await expect(editSubject).toHaveCount(1);
        await editSubject.click();
        await this.page.getByRole('textbox', { name: 'Subject', exact: true }).fill(subject);
        await this.page.getByRole('textbox', { name: 'Description', exact: true }).fill(description);
        const date = this.page.getByRole('textbox', { name: 'Approved Effective Date', exact: true });
        await date.fill(approvedEffectiveDate);
        await expect(date).toHaveValue(approvedEffectiveDate);
        await date.press('Enter');
        const save = this.page.getByRole('button', { name: 'Save', exact: true });
        await expect(save).toHaveCount(1);
        await save.click();
        await expect(date).toBeHidden();
    }

    async selectTypeSubtypes(type: string, subtypes: string[]): Promise<void> {
        await this.open();
        await this.page.getByRole('button', { name: 'Edit selections', exact: true }).click();
        const typeCheckbox = this.page.getByRole('group', { name: 'Types', exact: true })
            .getByRole('checkbox', { name: type, exact: true }).first();
        await expect(typeCheckbox).toHaveCount(1);
        if (!(await typeCheckbox.isChecked())) {
            await typeCheckbox.click();
        }
        await expect(typeCheckbox).toBeChecked();
        const group = this.page.getByRole('group', { name: `Subtypes for ${type}`, exact: true });
        await expect(group).toHaveCount(1);
        for (const subtype of subtypes) {
            const checkbox = group.getByRole('checkbox', { name: subtype, exact: true });
            await expect(checkbox).toHaveCount(1);
            await checkbox.click();
            await expect(checkbox).toHaveAttribute('aria-checked', 'true');
        }
        const save = this.page.getByRole('button', { name: 'Save', exact: true });
        await expect(save).toHaveCount(1);
        await save.click();
    }

    get milestonesSection(): Locator {
        return this.page.locator('flexipage-field-section2')
            .filter({ has: this.page.getByRole('button', { name: 'Milestones', exact: true }) });
    }

    // Alert inputs may be open in edit mode or closed behind a per-field pencil button.
    async updateMilestoneAlerts(alerts: Record<string, string>): Promise<void> {
        await this.open();
        const section = this.milestonesSection;
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
        for (const [label, days] of Object.entries(alerts)) {
            await this.expectField(label, days, section);
        }
    }

    async updatePriority(priorityCode: string, rationale: string): Promise<void> {
        await this.open();
        const editPriorityCode = this.page.getByRole('button', { name: 'Edit Priority Code', exact: true });
        await expect(editPriorityCode).toHaveCount(1);
        await editPriorityCode.click();
        const priorityCodeField = this.page.getByRole('combobox', { name: 'Priority Code', exact: true });
        await expect(priorityCodeField).toHaveCount(1);
        await priorityCodeField.click();
        await this.page.getByRole('option', { name: new RegExp(`^${priorityCode}\\b`) }).click();
        await this.page.getByRole('textbox', { name: 'Priority Code Rationale', exact: true }).fill(rationale);
        const save = this.page.getByRole('button', { name: 'Save', exact: true });
        await expect(save).toHaveCount(1);
        await save.click();
        await expect(priorityCodeField).toBeHidden();
        await this.expectRowValue('Priority Code', priorityCode);
    }

    async setInitialSubmissionComplete(answer: 'Yes' | 'No'): Promise<void> {
        await this.open();
        const editField = this.page.getByRole('button', { name: 'Edit Initial Submission Complete', exact: true });
        await expect(editField).toHaveCount(1);
        await editField.click();
        const answerField = this.page.getByRole('combobox', { name: 'Initial Submission Complete', exact: true });
        await expect(answerField).toHaveCount(1);
        await answerField.click();
        await this.page.getByRole('option', { name: answer, exact: true }).click();
        const save = this.page.getByRole('button', { name: 'Save', exact: true });
        await expect(save).toHaveCount(1);
        await save.click();
        await expect(answerField).toBeHidden();
        await this.expectRowValue('Initial Submission Complete', answer);
    }

    async markIntakeComplete(): Promise<void> {
        const tab = this.page.getByRole('tab', { name: 'Review', exact: true });
        await expect(tab).toHaveCount(1);
        await tab.click();
        const editIntakeComplete = this.page.getByRole('button', { name: 'Edit Intake Complete', exact: true });
        await expect(editIntakeComplete).toHaveCount(1);
        await editIntakeComplete.click();
        await this.page.getByRole('checkbox', { name: 'Intake Complete', exact: true }).check();
        const save = this.page.getByRole('button', { name: 'Save', exact: true });
        await expect(save).toHaveCount(1);
        await save.click();
    }
}