import { expect, Page } from '@playwright/test';

// OneMAC sometimes renders "Page not found" for a direct route, so load the URL again until the real page shows.
export async function openOneMacPage(page: Page, url: string): Promise<void> {
    await expect(async () => {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        await expect(page.getByText(/Sorry, we couldn.t find that page/)).toHaveCount(0);
    }).toPass({ timeout: 90_000, intervals: [5_000] });
}
