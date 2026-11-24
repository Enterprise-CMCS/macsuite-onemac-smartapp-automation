import { expect, Page } from '@playwright/test';
import path from 'node:path';
import { appUrls } from '../../config/urls';
import { onemacAttachments } from '../../data/onemac-attachments';
import { openOneMacPage } from './open-page';


const repoRoot = path.resolve(__dirname, '../../..');

export class OneMacSubsequentDocuments {
    constructor(private readonly page: Page) { }

    // Opens the subsequent-documents form from the package details page.
    async open(spaId: string): Promise<void> {
        await openOneMacPage(this.page, `${appUrls.onemac.replace(/\/$/, '')}/actions/upload-subsequent-documents/Medicaid%20SPA/${spaId}?origin=details`);
    }

    // Each slot opens a file chooser from its "-click" span; the chooser sets files on the slot.
    private async attachToSlot(testId: string, files: string[]): Promise<void> {
        const chooser = this.page.waitForEvent('filechooser');
        await this.page.getByTestId(`${testId}-click`).click();
        await (await chooser).setFiles(files.map((file) => path.resolve(repoRoot, file)));
        for (const file of files) {
            await expect(this.page.getByText(path.basename(file), { exact: true }).first()).toBeVisible();
        }
    }

    async attachTitleMatchedFiles(): Promise<void> {
        for (const { testId, fileName } of onemacAttachments) {
            await this.attachToSlot(testId, [`support/documents/upload/${fileName}`]);
        }
    }

    // OneMAC validates an Other batch as a whole, so all files are attached in one call.
    async attachOtherFiles(files: readonly string[]): Promise<void> {
        await this.attachToSlot('other', [...files]);
    }

    // This is a live submission. Callers must have the user's explicit authorization.
    async submit(reason: string): Promise<void> {
        await this.page.getByRole('textbox', { name: 'Explain why additional documents are being submitted.' }).fill(reason);
        await this.page.getByTestId('submit-action-form').click();
        await this.page.getByTestId('dialog-accept').click();
        await expect(this.page.getByRole('heading', { name: 'Documents submitted', exact: true })).toBeVisible({ timeout: 60_000 });
    }
}
