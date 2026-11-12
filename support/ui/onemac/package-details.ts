import { expect, Page } from '@playwright/test';
import { appUrls } from '../../config/urls';

export class OneMacPackageDetails {
    constructor(private readonly page: Page) { }

    async open(spaId: string): Promise<void> {
        await this.page.goto(`${appUrls.onemac.replace(/\/$/, '')}/details/Medicaid%20SPA/${spaId}`);
        await this.page.waitForLoadState('networkidle');
    }

    // Reads the value shown next to a details term, e.g. "Final Disposition Date".
    private valueFor(term: string) {
        return this.page.locator('dt', { hasText: new RegExp(`^${term}$`) }).locator('xpath=following-sibling::dd[1]');
    }

    async readDetail(term: string): Promise<string> {
        const value = this.valueFor(term);
        await expect(value).toBeVisible();
        return ((await value.textContent()) ?? '').trim();
    }

    async expectDetail(term: string, value: string | RegExp): Promise<void> {
        await expect(this.valueFor(term)).toContainText(value);
    }

    async expectTermShown(term: string): Promise<void> {
        await expect(this.page.locator('dt', { hasText: new RegExp(`^${term}$`) })).toBeVisible();
    }

    async expectPackageAction(name: string, actionPath: string): Promise<void> {
        const action = this.page.getByRole('link', { name, exact: true });
        await expect(action).toHaveCount(1);
        // OneMAC renders the href with a literal space and a query string, so compare decoded paths.
        await expect.poll(async () => decodeURIComponent((await action.getAttribute('href')) ?? ''))
            .toContain(decodeURIComponent(actionPath));
    }
}
