import { expect, Page } from '@playwright/test';
import { appUrls } from '../config/urls';

export type OnemacCredentials = {
    username: string;
    password: string;
};

export async function loginToOnemac(page: Page, creds: OnemacCredentials) {
    await page.goto(appUrls.onemac);
    await page.getByTestId('sign-in-button-d').click();
    await page.getByRole('textbox', { name: 'name@host.com' }).fill(creds.username);
    await page.getByRole('textbox', { name: 'Password' }).fill(creds.password);
    await page.getByRole('button', { name: 'submit' }).click();
    await expect(page.getByRole('link', { name: 'New Submission' })).toBeVisible();
}
