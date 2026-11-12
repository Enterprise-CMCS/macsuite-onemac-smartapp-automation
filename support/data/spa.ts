import { expect, Page } from '@playwright/test';
import { ciStates, localStates } from '../config/states';

export const spaStates = [...new Set([...localStates, ...ciStates, 'FL'])] as const;
export const duplicateSpaMessage = 'According to our records, this SPA ID already exists. Please check the SPA ID and try entering it again.';

export type SpaOptions = {
    state: string;
    year: string;
    startSequence: number;
    maxAttempts: number;
    validationTimeout: number;
};

export function formatSpaId(state: string, year: string, sequence: number, suffix?: string): string {
    const normalizedState = state.trim().toUpperCase();
    if (!spaStates.some((allowed) => allowed === normalizedState)) {
        throw new Error(`SPA_STATE must be one of: ${spaStates.join(', ')}`);
    }
    if (!/^\d{2}$/.test(year)) {
        throw new Error('SPA year must contain exactly two digits.');
    }
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9999) {
        throw new Error('SPA sequence must be an integer between 1 and 9999.');
    }
    if (suffix !== undefined && !/^QA(0[1-9]|[1-9]\d)$/.test(suffix)) {
        throw new Error('SPA suffix must be QA01 through QA99.');
    }
    return `${normalizedState}-${year}-${String(sequence).padStart(4, '0')}${suffix ? `-${suffix}` : ''}`;
}

// For OneMAC workflow specs that create or mutate records: no default state, so a missing SPA_STATE fails before any browser step.
export function requiredSpaOptionsFromEnv(): SpaOptions {
    if (!process.env.SPA_STATE?.trim()) {
        throw new Error(`Set SPA_STATE to the state for this run (one of: ${spaStates.join(', ')}), e.g. SPA_STATE=CA.`);
    }
    return spaOptionsFromEnv();
}

export function spaOptionsFromEnv(): SpaOptions {
    const options = {
        state: process.env.SPA_STATE ?? 'CA',
        year: String(new Date().getFullYear()).slice(-2),
        startSequence: Number(process.env.SPA_START_SEQUENCE ?? '1'),
        maxAttempts: Number(process.env.SPA_MAX_ATTEMPTS ?? '25'),
        validationTimeout: 10_000,
    };
    formatSpaId(options.state, options.year, options.startSequence);
    if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1 || options.maxAttempts > 100) {
        throw new Error('SPA_MAX_ATTEMPTS must be an integer between 1 and 100.');
    }
    return options;
}

export async function chooseSpaId(page: Page, options: SpaOptions, reserve?: () => Promise<string>): Promise<string> {
    if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1 || options.maxAttempts > 100) {
        throw new Error('SPA_MAX_ATTEMPTS must be an integer between 1 and 100.');
    }
    const input = page.getByRole('textbox', { name: 'SPA ID *', exact: true });
    const duplicate = page.getByText(duplicateSpaMessage, { exact: true });
    let lastCandidate = '';

    for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
        const spaId = reserve
            ? await reserve()
            : formatSpaId(options.state, options.year, options.startSequence + attempt);
        lastCandidate = spaId;
        const [response] = await Promise.all([
            page.waitForResponse((candidate) => {
                const request = candidate.request();
                if (request.method() !== 'POST' || !new URL(candidate.url()).pathname.endsWith('/itemExists')) {
                    return false;
                }
                try {
                    return request.postDataJSON()?.id === spaId;
                } catch {
                    return false;
                }
            }, { timeout: options.validationTimeout }),
            input.fill(spaId),
        ]);

        if (!response.ok()) {
            throw new Error(`SPA ID validation failed for ${spaId}: HTTP ${response.status()}`);
        }
        const result = await response.json();
        if (typeof result?.exists !== 'boolean') {
            throw new Error(`SPA ID validation returned an unexpected response for ${spaId}.`);
        }
        if (result.exists) {
            await expect(duplicate).toBeVisible({ timeout: options.validationTimeout });
            continue;
        }

        await expect(duplicate).toBeHidden({ timeout: options.validationTimeout });
        await expect(input).not.toHaveAttribute('aria-invalid', 'true', { timeout: options.validationTimeout });
        return spaId;
    }
    throw new Error(`No available SPA ID found after ${options.maxAttempts} candidates; last candidate: ${lastCandidate}`);
}