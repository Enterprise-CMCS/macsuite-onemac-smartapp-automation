import { expect, Page, TestInfo } from '@playwright/test';

export class OneMacDashboard {
    constructor(private readonly page: Page) {}

    // Opens the dashboard, searches for the package, checks its status in the row,
    // then opens the package details, checks the status there, and attaches a full-page screenshot.
    // Accepts one or more allowed statuses and returns the one OneMAC shows.
    async expectPackageStatus<T extends string>(spaId: string, status: T | T[], testInfo: TestInfo): Promise<T> {
        const allowed = Array.isArray(status) ? status : [status];
        const searchBox = this.page.getByRole('textbox', { name: 'Search by Package ID, CPOC Name, or Submitter Name' });
        // The dashboard route sometimes renders "Page not found" on the first click, so reopen it until the search box shows.
        await expect(async () => {
            await this.page.getByRole('link', { name: 'Home', exact: true }).first().click();
            await this.page.getByTestId('Dashboard-d').click();
            await expect(searchBox).toBeVisible({ timeout: 15_000 });
        }).toPass({ timeout: 90_000, intervals: [5_000] });
        const spaLink = this.page.getByTestId('os-table').getByRole('link', { name: spaId, exact: true });
        // New packages can lag behind in search, so retry the search until the row appears.
        await expect(async () => {
            await searchBox.fill(spaId);
            await searchBox.press('Enter');
            await expect(spaLink).toBeVisible({ timeout: 10_000 });
        }).toPass({ timeout: 120_000, intervals: [5_000] });
        const spaRow = this.page.getByTestId('os-table').getByRole('row').filter({ has: this.page.getByRole('link', { name: spaId, exact: true }) });
        let observed: T | undefined;
        await expect.poll(async () => {
            for (const candidate of allowed) {
                // The cell can hold a sub-status after the status, e.g. "Under Review · Withdraw Formal RAI Response - Enabled".
                if (await spaRow.getByRole('cell', { name: new RegExp(`^${candidate}\\b`) }).isVisible()) {
                    observed = candidate;
                    break;
                }
            }
            return observed;
        }).toBeDefined();
        const shown = observed as T;

        // The row link can ignore a click while the table is still re-rendering, so retry until the route changes.
        await expect(async () => {
            await spaLink.click();
            await expect(this.page).toHaveURL(new RegExp(`/details/Medicaid%20SPA/${spaId}$`), { timeout: 10_000 });
        }).toPass({ timeout: 60_000, intervals: [3_000] });
        await expect(this.page.locator('dt', { hasText: new RegExp(`^${shown}$`) })).toBeVisible();
        // The details page keeps loading sections after the status appears, so let it settle before the screenshot.
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(5_000);
        await testInfo.attach(`onemac-details-${spaId}-${shown.replace(/\s+/g, '-')}`, {
            body: await this.page.screenshot({ fullPage: true }),
            contentType: 'image/png',
        });
        return shown;
    }
}
