import { expect, Page } from '@playwright/test';
import path from 'node:path';
import { appUrls } from '../../config/urls';
import { openOneMacPage } from './open-page';

export class OneMacRespondToRai {
    constructor(private readonly page: Page) { }

    // Opens the Formal RAI response form, uploads the letter, and submits after the confirmation dialog.
    // This is a live submission. Callers must have the user's explicit authorization.
    async submit(spaId: string, letterPath: string, additionalInformation: string): Promise<void> {
        await openOneMacPage(this.page, `${appUrls.onemac.replace(/\/$/, '')}/actions/respond-to-rai/Medicaid%20SPA/${spaId}?origin=details`);

        // The first file input is the required RAI Response Letter.
        const fileInputs = this.page.locator('input[type="file"]');
        await fileInputs.nth(0).setInputFiles(letterPath);
        await expect(this.page.getByText(path.basename(letterPath))).toBeVisible();

        await this.page.getByLabel('Additional Information').or(this.page.locator('textarea')).first().fill(additionalInformation);

        await this.page.getByRole('button', { name: 'Submit', exact: true }).click();
        await expect(this.page.getByText('Do you want to submit your official formal RAI response?')).toBeVisible();
        await this.page.getByRole('button', { name: 'Yes, Submit', exact: true }).click();
        await expect(this.page.getByText('RAI response submitted', { exact: true })).toBeVisible({ timeout: 60_000 });
        await expect(this.page.getByText(`The RAI response for ${spaId} has been submitted.`)).toBeVisible();
    }
}
