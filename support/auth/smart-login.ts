import { expect, Page } from '@playwright/test';
import { appUrls } from '../config/urls';
import { getTotpCode } from './totp';

export type SmartCredentials = {
    username: string;
    password: string;
    totpSecret: string;
};

const MAX_VERIFICATION_ATTEMPTS = 3;
// TOTP codes change every 30 seconds, and Salesforce rejects a code that was already used. A retry must wait for the next window.
const TOTP_PERIOD_MS = 30_000;
const CODE_REJECTED = /Invalid or expired verification code/i;

export async function loginAsUser(page: Page, creds: SmartCredentials) {
    await page.goto(appUrls.smartLogin);
    await page.fill('#username', creds.username);
    await page.click('#Login');
    await page.fill('#password', creds.password);
    await page.click('#Login');

    const codeInput = page.locator('input[name="code"], #tc');
    const appLauncher = page.getByRole('button', { name: 'App Launcher' });
    await codeInput.waitFor();

    for (let attempt = 1; attempt <= MAX_VERIFICATION_ATTEMPTS; attempt++) {
        await codeInput.fill(await getTotpCode(creds.totpSecret));
        await page.click('button[type="submit"], #save');
        await appLauncher.or(page.getByText(CODE_REJECTED)).first().waitFor();
        if (await appLauncher.isVisible()) return;
        if (attempt < MAX_VERIFICATION_ATTEMPTS) {
            // Wait 1s past the next 30-second boundary so the retry gets a code that has not been used.
            await page.waitForTimeout(TOTP_PERIOD_MS - (Date.now() % TOTP_PERIOD_MS) + 1_000);
        }
    }
    await expect(appLauncher, 'Salesforce rejected every verification code').toBeVisible();
}