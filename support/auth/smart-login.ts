import { expect, Page } from '@playwright/test';
import { appUrls } from '../config/urls';
import { getTotpCode } from './totp';

export type SmartCredentials = {
    username: string;
    password: string;
    totpSecret: string;
};

export async function loginAsUser(page: Page, creds: SmartCredentials) {
    await page.goto(appUrls.smartLogin);
    await page.fill('#username', creds.username);
    await page.click('#Login');
    await page.fill('#password', creds.password);
    await page.click('#Login');

    const codeInput = page.locator('input[name="code"], #tc');
    await codeInput.waitFor();
    await codeInput.fill(await getTotpCode(creds.totpSecret));
    await page.click('button[type="submit"], #save');
    await expect(page.getByRole('button', { name: 'App Launcher' })).toBeVisible();
}