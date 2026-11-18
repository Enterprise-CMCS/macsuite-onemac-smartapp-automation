import { expect, Locator, Page } from '@playwright/test';

export class SmartSplitSpaDialog {
    readonly splitAction: Locator;
    readonly originalSpaId: Locator;
    readonly splitIdentifier: Locator;
    readonly newSplitSpaId: Locator;
    readonly splitReason: Locator;
    readonly createButton: Locator;
    readonly cancelButton: Locator;

    constructor(private readonly page: Page) {
        this.splitAction = page.getByRole('button', { name: 'Split SPA', exact: true });
        this.originalSpaId = page.getByRole('textbox', { name: 'Original SPA ID', exact: true });
        this.splitIdentifier = page.getByRole('textbox', { name: 'Split Identifier', exact: true });
        this.newSplitSpaId = page.getByRole('textbox', { name: 'New Split SPA ID', exact: true });
        this.splitReason = page.getByRole('textbox', { name: 'Split Reason', exact: true });
        this.createButton = page.getByRole('button', { name: 'Create Split SPA', exact: true });
        this.cancelButton = page.getByRole('button', { name: 'Cancel and close', exact: true });
    }

    async open(): Promise<void> {
        await this.splitAction.click();
        await expect(this.createButton).toBeVisible();
    }

    async createSplit(identifier: string, reason: string): Promise<void> {
        await this.splitIdentifier.fill(identifier);
        await this.splitReason.fill(reason);
        await this.createButton.click();
    }
}
