import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import path from 'node:path';
import type { OnemacAttachment } from '../../../data/onemac-attachments';

export class SmartAttachments {
    constructor(readonly page: Page) { }

    get uploadedFiles() {
        return this.page.getByRole('region', { name: 'Files Uploaded in SMART', exact: true });
    }

    get onemacAttachments() {
        return this.page.getByRole('region', { name: 'OneMAC Attachments', exact: true });
    }

    async open(): Promise<void> {
        const tab = this.page.getByRole('tab', { name: 'Attachments', exact: true });
        await expect(tab).toHaveCount(1);
        await tab.click();
    }

    async verifyOnemacSubmission(expectedFiles: readonly OnemacAttachment[], additionalInformation: string): Promise<void> {
        await this.open();
        const section = this.onemacAttachments;
        await expect(section).toBeVisible();
        // Each OneMAC package action is an accordion section whose table is labelled with the action title.
        const submission = section.locator('.slds-accordion__content')
            .filter({ has: this.page.getByRole('grid', { name: /^Initial Package Submitted By / }) });
        await expect(submission).toHaveCount(1);
        await expect(submission).toBeVisible();
        const rows = submission.getByRole('grid').locator('tbody tr');
        await expect(rows).toHaveCount(expectedFiles.length);
        for (const { documentType, fileName } of expectedFiles) {
            const row = rows.filter({ has: this.page.getByRole('gridcell', { name: documentType, exact: true }) });
            await expect(row).toHaveCount(1);
            await expect(row.getByRole('link', { name: fileName, exact: true })).toBeVisible();
        }
        await expect(submission.locator('.docs-additional-info__text')).toHaveText(additionalInformation);
    }

    async verifyRaiResponseSubmitted(submitter: string, expectedFileNames: readonly string[]): Promise<void> {
        await this.open();
        const section = this.onemacAttachments;
        await expect(section).toBeVisible();
        // The grid name appends the submission timestamp after the submitter.
        const submission = section.locator('.slds-accordion__content')
            .filter({ has: this.page.getByRole('grid', { name: new RegExp(`^RAI Response Submitted By ${submitter} - `) }) });
        await expect(submission).toHaveCount(1);
        for (const fileName of expectedFileNames) {
            await expect(submission.getByRole('link', { name: fileName, exact: true })).toBeVisible();
        }
    }

    // Title-matched files use their document type; files attached to Other use the "Other" type.
    async verifySubsequentDocuments(submitter: string, titleMatched: readonly OnemacAttachment[], otherFileNames: readonly string[]): Promise<void> {
        await this.open();
        const section = this.onemacAttachments;
        await expect(section).toBeVisible();
        // Earlier subsequent packages share the same grid label, so select the one that holds this run's Other files.
        const grid = section.getByRole('grid', { name: new RegExp(`^Subsequent Document\\(s\\) Uploaded By ${submitter} - `) })
            .filter({ has: this.page.getByRole('link', { name: otherFileNames[0], exact: true }) });
        await expect(grid).toHaveCount(1);
        const rows = grid.locator('tbody tr');
        await expect(rows).toHaveCount(titleMatched.length + otherFileNames.length);
        for (const { documentType, fileName } of titleMatched) {
            const row = rows.filter({ has: this.page.getByRole('gridcell', { name: documentType, exact: true }) });
            await expect(row).toHaveCount(1);
            await expect(row.getByRole('link', { name: fileName, exact: true })).toBeVisible();
        }
        for (const fileName of otherFileNames) {
            const row = rows.filter({ has: this.page.getByRole('gridcell', { name: 'Other', exact: true }) })
                .filter({ has: this.page.getByRole('link', { name: fileName, exact: true }) });
            await expect(row).toHaveCount(1);
        }
    }

    async upload(filePath: string): Promise<void> {
        await this.open();
        await expect(this.uploadedFiles).toBeVisible();
        const input = this.uploadedFiles.locator('input[type="file"][name="smartFileUploader"]');
        await expect(input).toHaveCount(1);
        await input.setInputFiles(filePath);
        const modal = this.page.locator('.modal-container').filter({
            has: this.page.getByRole('heading', { name: 'Upload Files', exact: true }),
        });
        await expect(modal).toHaveCount(1);
        await expect(modal).toBeVisible();
        await expect(modal.getByText(`Upload of ${path.basename(filePath)} complete`, { exact: true })).toBeVisible();
        const done = modal.getByRole('button', { name: 'Done', exact: true });
        await expect(done).toHaveCount(1);
        await expect(done).toBeEnabled();
        await done.click();
        await expect(modal).toBeHidden();
    }
}