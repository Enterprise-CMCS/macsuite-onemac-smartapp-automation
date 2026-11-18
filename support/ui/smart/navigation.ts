import { expect, Locator, Page } from '@playwright/test';

export class SmartNavigation {
    readonly appLauncher: Locator;
    readonly smartApp: Locator;
    readonly spaWaiversList: Locator;

    constructor(private readonly page: Page) {
        this.appLauncher = page.getByRole('button', { name: 'App Launcher' });
        this.smartApp = page.getByRole('option', { name: 'SMART' });
        this.spaWaiversList = page.getByRole('button', { name: 'SPAs or Waivers List' });
    }

    async openSmartHome(): Promise<void> {
        await this.appLauncher.click();
        await this.smartApp.click();
        await expect(this.spaWaiversList).toBeVisible();
        // Allow SMART to settle before opening SPA search.
        await this.page.waitForTimeout(2_000);
    }

    // SMART reopens its last tab, so leaving a record needs the Home tab rather than the app launcher.
    async openSmartHomeTab(): Promise<void> {
        await this.page.getByRole('link', { name: 'Home', exact: true }).click();
        await expect(this.spaWaiversList).toBeVisible();
        await this.page.waitForTimeout(2_000);
    }
}