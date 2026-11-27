import { expect, Page } from '@playwright/test';
import { appUrls } from '../config/urls';
import { getTotpCode } from './totp';

export type SmartCredentials = {
    username: string;
    password: string;
    totpSecret: string;
};

const MAX_VERIFICATION_ATTEMPTS = 3;
const VERIFICATION_RETRY_DELAY_MS = 5_000;
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
        if (attempt < MAX_VERIFICATION_ATTEMPTS) await page.waitForTimeout(VERIFICATION_RETRY_DELAY_MS);
    }
    await expect(appLauncher, 'Salesforce rejected every verification code').toBeVisible();
}