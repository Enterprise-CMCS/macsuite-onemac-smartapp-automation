import { expect, Locator, Page } from '@playwright/test';

const SEARCH_TIMEOUT_MS = 5 * 60_000;
const SEARCH_ATTEMPT_MS = 20_000;

export class SmartRecordSearch {
    readonly searchButton: Locator;
    readonly searchInput: Locator;

    constructor(private readonly page: Page) {
        this.searchButton = page.getByRole('button', { name: 'Search' });
        this.searchInput = page.getByRole('searchbox', { name: 'Search...' });
    }

    async openSpa(spaId: string): Promise<void> {
        // The RAI results table also links the SPA ID in its "SPA or Waiver" column, so match only the SPA table.
        const spaResults = this.page.getByRole('grid')
            .filter({ has: this.page.getByRole('columnheader', { name: 'Initial Submission Date', exact: true }) });
        const record = spaResults
            .getByRole('link', { name: spaId, exact: true })
            .and(this.page.locator('a[data-refid="recordId"]'));
        const deadline = Date.now() + SEARCH_TIMEOUT_MS;
        let attempt = 0;

        // A newly submitted SPA can take minutes to index in SMART, so reload and search again until it appears.
        for (;;) {
            attempt++;
            await this.searchButton.click();
            await this.searchInput.fill(spaId);
            await this.searchInput.press('Enter');
            try {
                await expect(record).toHaveCount(1, { timeout: SEARCH_ATTEMPT_MS });
                break;
            } catch (error) {
                if (Date.now() >= deadline) {
                    throw new Error(`SPA ${spaId} did not appear in SMART search after ${attempt} attempts.`, { cause: error });
                }
                await this.page.reload();
            }
        }
        await expect(record).toBeVisible();
        await record.click();
    }
}