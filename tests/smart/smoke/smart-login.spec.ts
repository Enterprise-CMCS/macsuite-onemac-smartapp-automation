import { test } from '@playwright/test';
import { loginAsUser } from '../../../support/auth/smart-login';
import { smartCredentials } from '../../../support/config/environment';

// Login-only check for CI. Uses no SPA record and writes nothing, so it can run on a fresh runner.
test('SMART login succeeds with password and TOTP', async ({ page }) => {
    await loginAsUser(page, smartCredentials('INTAKE'));
});
