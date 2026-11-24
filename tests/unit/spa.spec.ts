import { test, expect, Page } from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chooseSpaId, duplicateSpaMessage, formatSpaId, formatSplitSpaId, SpaOptions, spaOptionsFromEnv, spaStates } from '../../support/data/spa';
import { createSpaRecordStore, selectSpaTarget } from '../../support/data/spa-store';
import { createCompanionLetterStore } from '../../support/data/companion-letter-store';
import { currentSpaSummary } from '../../support/data/current-spa';
import { onemacDisplayDate, toSmartDate } from '../../support/data/onemac-dates';

const options: SpaOptions = {
    state: 'CA', year: '26', startSequence: 36, maxAttempts: 3, validationTimeout: 2000,
};

async function spaForm(page: Page) {
    page.on('pageerror', (error) => {
        throw error;
    });
    await page.route('https://spa.test/', (route) => route.fulfill({
        contentType: 'text/html',
        body: `<label>SPA ID *<input aria-invalid="false" /></label><p hidden></p>
        <script>
        const input = document.querySelector('input');
        const error = document.querySelector('p');
        input.addEventListener('input', async () => {
            const id = input.value;
            const response = await fetch('/itemExists', {
                method: 'POST', body: JSON.stringify({ id }),
            }).catch(() => null);
            if (!response?.ok) return;
            const result = await response.json();
            if (input.value !== id || typeof result.exists !== 'boolean') return;
            error.textContent = ${JSON.stringify(duplicateSpaMessage)};
            error.hidden = !result.exists;
            input.setAttribute('aria-invalid', String(result.exists));
        });
        </script>`,
    }));
    await page.goto('https://spa.test/');
}

test('formats all allowed states and rejects malformed IDs', () => {
    for (const state of spaStates) {
        expect(formatSpaId(state.toLowerCase(), '26', 37)).toBe(`${state}-26-0037`);
    }
    expect(formatSpaId('CA', '27', 1)).toBe('CA-27-0001');
    expect(formatSpaId('CA', '26', 37, 'QA01')).toBe('CA-26-0037-QA01');
    for (const suffix of ['QA00', 'QA100', 'qa01', 'QA1']) {
        expect(() => formatSpaId('CA', '26', 37, suffix)).toThrow('SPA suffix');
    }
    for (const sequence of [0, -1, 1.5, 10000, NaN]) {
        expect(() => formatSpaId('CA', '26', sequence)).toThrow();
    }
    expect(() => formatSpaId('TX', '26', 37)).toThrow('SPA_STATE');
    expect(() => formatSpaId('CA', '2026', 37)).toThrow('SPA year');
});

test('requires SPA_STATE with no default', () => {
    const original = { ...process.env };
    try {
        delete process.env.SPA_STATE;
        expect(() => spaOptionsFromEnv()).toThrow('Set SPA_STATE');
        process.env.SPA_STATE = '  ';
        expect(() => spaOptionsFromEnv()).toThrow('Set SPA_STATE');
        process.env.SPA_STATE = 'CO';
        expect(spaOptionsFromEnv()).toMatchObject({ state: 'CO' });
    } finally {
        process.env = original;
    }
});

test('reads configurable state, starting sequence, and attempt limit with the current year', () => {
    const original = { ...process.env };
    try {
        process.env.SPA_STATE = 'md';
        process.env.SPA_YEAR = '00';
        process.env.SPA_START_SEQUENCE = '50';
        process.env.SPA_MAX_ATTEMPTS = '4';
        expect(spaOptionsFromEnv()).toMatchObject({
            state: 'md', year: String(new Date().getFullYear()).slice(-2), startSequence: 50, maxAttempts: 4,
        });
        process.env.SPA_MAX_ATTEMPTS = '0';
        expect(() => spaOptionsFromEnv()).toThrow('SPA_MAX_ATTEMPTS');
    } finally {
        process.env = original;
    }
});

test('waits for delayed validation and advances only confirmed duplicates', async ({ page }) => {
    const candidates: string[] = [];
    await page.route('**/itemExists', async (route) => {
        const id = route.request().postDataJSON().id;
        candidates.push(id);
        await new Promise((resolve) => setTimeout(resolve, 550));
        await route.fulfill({ json: { exists: id !== 'CA-26-0038' } });
    });
    await spaForm(page);
    expect(await chooseSpaId(page, options)).toBe('CA-26-0038');
    expect(candidates).toEqual(['CA-26-0036', 'CA-26-0037', 'CA-26-0038']);
    await expect(page.getByRole('textbox')).toHaveValue('CA-26-0038');
});

test('stops at the duplicate retry limit', async ({ page }) => {
    await page.route('**/itemExists', (route) => route.fulfill({ json: { exists: true } }));
    await spaForm(page);
    await expect(chooseSpaId(page, options)).rejects.toThrow('No available SPA ID found after 3 candidates');
});

test('stops at sequence exhaustion instead of wrapping', async ({ page }) => {
    await page.route('**/itemExists', (route) => route.fulfill({ json: { exists: true } }));
    await spaForm(page);
    await expect(chooseSpaId(page, { ...options, startSequence: 9999 })).rejects.toThrow('between 1 and 9999');
});

for (const scenario of ['http-error', 'invalid-response', 'missing-validation'] as const) {
    test(`fails without incrementing on ${scenario}`, async ({ page }) => {
        let requests = 0;
        await page.route('**/itemExists', async (route) => {
            requests++;
            if (scenario === 'http-error') await route.fulfill({ status: 503 });
            else if (scenario === 'invalid-response') await route.fulfill({ json: {} });
            else await route.abort();
        });
        await spaForm(page);
        await expect(chooseSpaId(page, { ...options, validationTimeout: 500 })).rejects.toThrow();
        expect(requests).toBe(1);
        await expect(page.getByRole('textbox')).toHaveValue('CA-26-0036');
    });
}

test('OneMAC dates convert to the SMART display format', () => {
    expect(toSmartDate('January 15, 2027')).toBe('1/15/2027');
    expect(toSmartDate('Mon, Oct 26 2026, 09:23:09 AM EDT')).toBe('10/26/2026');
    expect(() => toSmartDate('-- --')).toThrow('Unrecognized OneMAC date');
    expect(onemacDisplayDate(new Date('2026-10-26T13:23:09Z'))).toBe('Mon, Oct 26 2026');
    expect(onemacDisplayDate(new Date('2026-10-27T02:00:00Z'))).toBe('Mon, Oct 26 2026');
});

test.describe('persistent SPA records', () => {
    let directory: string;
    const environment = 'https://mako-dev.cms.gov/';
    const seed = { state: 'CA', year: '26', startSequence: 37 };

    test.beforeEach(async () => {
        directory = await mkdtemp(path.join(tmpdir(), 'spa-store-'));
    });

    test.afterEach(async () => {
        await rm(directory, { recursive: true, force: true });
    });

    test('a confirmed 0037 is handed off and the next run reserves 0038', async () => {
        const firstRun = createSpaRecordStore(environment, seed, directory);
        expect(await firstRun.reserve()).toBe('CA-26-0037-QA01');
        await expect(firstRun.latestSubmitted()).rejects.toThrow('No confirmed SPA');
        await firstRun.markSubmitted('CA-26-0037-QA01');
        const nextRun = createSpaRecordStore(environment, { ...seed, startSequence: 1 }, directory);
        expect(await nextRun.latestSubmitted()).toMatchObject({ spaId: 'CA-26-0037-QA01', onemacStatus: 'submitted', smartStatus: 'intake_needed', environment: 'https://mako-dev.cms.gov' });
        expect((await nextRun.latestIntakeNeededWorkflow()).map((record) => record.spaId)).toEqual(['CA-26-0037-QA01']);
        expect(await nextRun.reserve()).toBe('CA-26-0037-QA02');
        expect((await nextRun.latestSubmitted()).spaId).toBe('CA-26-0037-QA01');
    });

    test('intake marks a submitted SPA Pending - First Clock, handing it to SRT and CPOC', async () => {
        const store = createSpaRecordStore(environment, seed, directory);
        await expect(store.latestPendingFirstClock()).rejects.toThrow('Run the earlier suite steps first');
        const first = await store.reserve();
        await store.markSubmitted(first);
        await store.markPendingFirstClock(first);
        await expect(store.latestSubmitted()).rejects.toThrow('No confirmed SPA');
        expect(await createSpaRecordStore(environment, seed, directory).latestPendingFirstClock())
            .toMatchObject({ spaId: first, onemacStatus: 'submitted', smartStatus: 'pending_first_clock' });
        await store.markPendingFirstClock(first);
        await expect(store.markPendingFirstClock('CA-26-0099')).rejects.toThrow('unsubmitted');
        await store.markOnemacUnderReview(first);
        await store.markOnemacUnderReview(first);
        expect(await createSpaRecordStore(environment, seed, directory).latestPendingFirstClock())
            .toMatchObject({ spaId: first, onemacStatus: 'under_review', smartStatus: 'pending_first_clock' });
        await expect(store.markOnemacUnderReview('CA-26-0099')).rejects.toThrow('unsubmitted');

        const second = await store.reserve();
        await store.markSubmitted(second);
        expect((await store.latestSubmitted()).spaId).toBe(second);
        expect((await store.latestPendingFirstClock()).spaId).toBe(first);
        await store.markPendingFirstClock(second);
        expect((await store.latestPendingFirstClock()).spaId).toBe(second);
    });

    test('OneMAC status moves between submitted and under review, and a formal RAI response returns it to submitted', async () => {
        const store = createSpaRecordStore(environment, seed, directory);
        const spaId = await store.reserve();
        await store.markSubmitted(spaId);
        await store.markPendingFirstClock(spaId);
        await store.markOnemacStatus(spaId, 'under_review');
        expect(await createSpaRecordStore(environment, seed, directory).find(spaId))
            .toMatchObject({ onemacStatus: 'under_review', underReviewAt: expect.any(String) });
        await store.markOnemacStatus(spaId, 'under_review');
        await store.markOnemacStatus(spaId, 'submitted');
        const submitted = await createSpaRecordStore(environment, seed, directory).find(spaId);
        expect(submitted.onemacStatus).toBe('submitted');
        expect(submitted.underReviewAt).toBeUndefined();
        await store.markOnemacStatus(spaId, 'under_review');
        await store.markFormalRaiResponse(spaId, '11/10/2026');
        expect(await createSpaRecordStore(environment, seed, directory).find(spaId))
            .toMatchObject({ onemacStatus: 'submitted', formalRaiResponseDate: '11/10/2026' });
        expect((await createSpaRecordStore(environment, seed, directory).find(spaId)).underReviewAt).toBeUndefined();
        await expect(store.markOnemacStatus('CA-26-0099', 'submitted')).rejects.toThrow('unsubmitted');
    });

    test('SRT and CPOC both finishing moves a Pending - First Clock SPA to Pending - Concurrence', async () => {
        const store = createSpaRecordStore(environment, seed, directory);
        const spaId = await store.reserve();
        await store.markSubmitted(spaId);
        await store.markPendingFirstClock(spaId);
        await store.markReviewCompleted(spaId, 'srt');
        expect(await store.latestPendingFirstClock()).toMatchObject({ spaId, smartStatus: 'pending_first_clock', reviewsCompleted: { srt: expect.any(String) } });
        await store.markReviewCompleted(spaId, 'srt');
        await store.markReviewCompleted(spaId, 'cpoc');
        const newest = await createSpaRecordStore(environment, seed, directory).latestPendingFirstClock().catch(() => null);
        expect(newest?.spaId).not.toBe(spaId);
        const record = await createSpaRecordStore(environment, seed, directory).latestSubmitted().catch(() => null);
        expect(record?.spaId).not.toBe(spaId);
        await expect(store.markReviewCompleted('CA-26-0099', 'srt')).rejects.toThrow('not in Pending - First Clock');
    });

    test('SRT and CPOC recommending disapproval moves the SPA to Pending - Disapproval, then Disapproved', async () => {
        const store = createSpaRecordStore(environment, seed, directory);
        const spaId = await store.reserve();
        await store.markSubmitted(spaId);
        await store.markPendingFirstClock(spaId);
        await store.markReviewCompleted(spaId, 'srt', 'disapprove');
        await store.markReviewCompleted(spaId, 'cpoc', 'disapprove');
        expect(await store.latestPendingDisapproval()).toMatchObject({ spaId, smartStatus: 'pending_disapproval' });
        await store.markDisapproved(spaId);
        expect(await createSpaRecordStore(environment, seed, directory).find(spaId)).toMatchObject({ smartStatus: 'disapproved' });
    });

    test('returning to review clears earlier reviewer decisions so SRT and CPOC must finish again', async () => {
        const store = createSpaRecordStore(environment, seed, directory);
        const spaId = await store.reserve();
        await store.markSubmitted(spaId);
        await store.markPendingFirstClock(spaId);
        await store.markReviewCompleted(spaId, 'srt', 'disapprove');
        await store.markReviewCompleted(spaId, 'cpoc', 'disapprove');
        await store.markReturnedToReview(spaId);
        expect(await store.find(spaId)).toMatchObject({ smartStatus: 'pending_first_clock' });
        expect((await store.find(spaId)).reviewsCompleted).toBeUndefined();
        expect((await store.find(spaId)).reviewRecommendations).toBeUndefined();
        await store.markReviewCompleted(spaId, 'srt', 'approve');
        await store.markReviewCompleted(spaId, 'cpoc', 'approve');
        expect(await store.find(spaId)).toMatchObject({ smartStatus: 'pending_concurrence' });
        expect(await store.latestAwaitingGroupDirector()).toMatchObject({ spaId, smartStatus: 'pending_concurrence' });
        await expect(store.markReturnedToReview('CA-26-0099')).rejects.toThrow('no SMART status');
    });

    test('saved OneMAC details are handed off with the submitted SPA', async () => {
        const store = createSpaRecordStore(environment, seed, directory);
        const spaId = await store.reserve();
        const details = {
            state: 'California', initialSubmissionDate: '10/26/2026',
            proposedEffectiveDate: 'January 26, 2027', additionalInformation: 'this is a test',
        };
        await expect(store.saveDetails(spaId, details)).rejects.toThrow('unsubmitted');
        await store.markSubmitted(spaId);
        await store.saveDetails(spaId, details);
        const smartRun = createSpaRecordStore(environment, seed, directory);
        expect(await smartRun.latestSubmitted()).toMatchObject({ spaId, details });
    });

    test('a split appends one character to a SPA ID and leaves standard IDs unchanged', () => {
    expect(formatSplitSpaId('CA-26-0085-QA01', 'A')).toBe('CA-26-0085-QA01-A');
    expect(formatSplitSpaId('MD-26-1234', 'B')).toBe('MD-26-1234-B');
    for (const identifier of ['AB', 'a', '1', '']) {
        expect(() => formatSplitSpaId('CA-26-0085-QA01', identifier)).toThrow('one character');
    }
    expect(() => formatSplitSpaId('CA-26-0085-QA01-A', 'B')).toThrow('standard SPA ID');
});

test('a split clones its parent, leaves the parent unchanged, and moves through its own stages', async () => {
    const store = createSpaRecordStore(environment, seed, directory);
    const parentId = await store.reserve();
    await store.markSubmitted(parentId);
    await store.markPendingFirstClock(parentId);
    await store.saveDetails(parentId, { state: 'CA', initialSubmissionDate: '11/01/2026', proposedEffectiveDate: '01/01/2027', additionalInformation: 'test' });
    const parentBefore = await store.find(parentId);

    const splitId = await store.recordSplit(parentId, 'A', 'SRT reviews documents and CPOC reviews financials');
    expect(splitId).toBe(`${parentId}-A`);
    const reopened = createSpaRecordStore(environment, seed, directory);
    expect(await reopened.find(splitId)).toMatchObject({
        spaId: splitId,
        onemacStatus: 'submitted',
        smartStatus: 'pending_first_clock',
        details: { additionalInformation: 'test' },
        splitIdentifier: 'A',
        splitReason: 'SRT reviews documents and CPOC reviews financials',
    });
    const withoutSplits = (record: object) => ({ ...record, splits: undefined });
    expect(withoutSplits(await reopened.find(parentId))).toEqual(withoutSplits(parentBefore));
    expect(await reopened.find(parentId)).toMatchObject({ splits: [{ spaId: splitId }] });
    expect((await reopened.latestPendingFirstClock()).spaId).toBe(parentId);
    expect((await reopened.latestPendingFirstClockWorkflow('srt')).map((record) => record.spaId)).toEqual([parentId, splitId]);

    await store.markReviewCompleted(splitId, 'srt');
    await store.markReviewCompleted(splitId, 'cpoc');
    expect(await createSpaRecordStore(environment, seed, directory).find(splitId)).toMatchObject({ smartStatus: 'pending_concurrence' });
    expect(withoutSplits(await createSpaRecordStore(environment, seed, directory).find(parentId))).toEqual(withoutSplits(parentBefore));
});

test('a finished SRT review is skipped on rerun, so the workflow moves on to the split', async () => {
    const store = createSpaRecordStore(environment, seed, directory);
    const parentId = await store.reserve();
    await store.markSubmitted(parentId);
    await store.markPendingFirstClock(parentId);
    await store.markReviewCompleted(parentId, 'srt');
    const splitId = await store.recordSplit(parentId, 'A', 'SRT reviews documents and CPOC reviews financials');
    expect((await store.find(splitId)).reviewsCompleted).toBeUndefined();
    expect((await store.latestPendingFirstClockWorkflow('srt')).map((record) => record.spaId)).toEqual([splitId]);
});

test('director workflows list SPAs still in their status, parent first, and drop each one once it moves on', async () => {
    const store = createSpaRecordStore(environment, seed, directory);
    const parentId = await store.reserve();
    await store.markSubmitted(parentId);
    await store.markPendingFirstClock(parentId);
    const splitId = await store.recordSplit(parentId, 'A', 'SRT reviews documents and CPOC reviews financials');
    await store.markReviewCompleted(parentId, 'srt');
    await store.markReviewCompleted(parentId, 'cpoc');
    await store.markReviewCompleted(splitId, 'srt');
    await store.markReviewCompleted(splitId, 'cpoc');
    expect((await store.latestPendingConcurrenceWorkflow()).map((record) => record.spaId)).toEqual([parentId, splitId]);
    await store.markConcurred(parentId);
    expect((await store.latestPendingConcurrenceWorkflow()).map((record) => record.spaId)).toEqual([splitId]);
});

test('a split is allowed from Intake Needed, refused once the SPA reaches concurrence, and cannot be split again', async () => {
    const store = createSpaRecordStore(environment, seed, directory);
    const spaId = await store.reserve();
    await store.markSubmitted(spaId);
    await expect(store.recordSplit(spaId, 'A', '  ')).rejects.toThrow('reason is required');
    const splitId = await store.recordSplit(spaId, 'A', 'split at intake');
    expect(await store.find(splitId)).toMatchObject({ smartStatus: 'intake_needed' });
    await expect(store.recordSplit(spaId, 'A', 'again')).rejects.toThrow('already exists');
    await expect(store.recordSplit(splitId, 'B', 'nested')).rejects.toThrow('standard SPA');

    await store.markPendingFirstClock(spaId);
    await store.markReviewCompleted(spaId, 'srt');
    await store.markReviewCompleted(spaId, 'cpoc');
    await expect(store.recordSplit(spaId, 'B', 'too late')).rejects.toThrow('from pending_concurrence');
});

test('a Second Clock split is tracked per role, so SRT and CPOC each finish the parent and the child', async () => {
    const store = createSpaRecordStore(environment, seed, directory);
    const parentId = await store.reserve();
    await store.markSubmitted(parentId);
    await store.markPendingFirstClock(parentId);
    await store.markPendingRai(parentId, { issuedDate: '01/02/2027', expiresDate: '03/02/2027' });
    await store.markPendingSecondClock(parentId);
    const splitId = await store.recordSplit(parentId, 'A', 'SRT reviews documents and CPOC reviews financials');
    expect(await store.find(splitId)).toMatchObject({ smartStatus: 'pending_second_clock' });
    expect((await store.latestSecondClockWorkflow('srt')).map((record) => record.spaId)).toEqual([parentId, splitId]);

    await store.markRaiReviewCompleted(parentId, 'srt');
    await store.markRaiReviewCompleted(splitId, 'srt');
    await expect(store.latestSecondClockWorkflow('srt')).rejects.toThrow('No SPA');
    expect((await store.latestSecondClockWorkflow('cpoc')).map((record) => record.spaId)).toEqual([parentId, splitId]);
});

test('an interrupted reservation is never reused or handed off', async () => {
        const firstRun = createSpaRecordStore(environment, seed, directory);
        await firstRun.reserve();
        const nextRun = createSpaRecordStore(environment, seed, directory);
        expect(await nextRun.reserve()).toBe('CA-26-0037-QA02');
        await expect(nextRun.latestSubmitted()).rejects.toThrow('No confirmed SPA');
        await expect(nextRun.markSubmitted('CA-26-0099')).rejects.toThrow('unreserved');
    });

    test('repeated SMART reads use the latest confirmed submission without reserving IDs', async () => {
        const store = createSpaRecordStore(environment, seed, directory);
        const first = await store.reserve();
        await store.markSubmitted(first);
        const second = await store.reserve();
        const beforeRead = await readFile(store.file, 'utf8');
        for (let run = 0; run < 2; run++) {
            const smartRun = createSpaRecordStore(environment, seed, directory);
            expect((await smartRun.latestSubmitted()).spaId).toBe(first);
        }
        expect(await readFile(store.file, 'utf8')).toBe(beforeRead);
        await store.markSubmitted(second);
        expect((await createSpaRecordStore(environment, seed, directory).latestSubmitted()).spaId).toBe(second);
    });

    test('current SPA summary shows confirmed metadata without changing the store', async () => {
        const store = createSpaRecordStore(environment, seed, directory);
        const spaId = await store.reserve();
        await store.markSubmitted(spaId);
        await store.reserve();
        const before = await readFile(store.file, 'utf8');
        const summary = await currentSpaSummary(store);
        expect(summary).toContain('SPA ID: CA-26-0037-QA01');
        expect(summary).not.toContain('CA-26-0037-QA02');
        expect(summary).toContain(`Submitted: ${(await store.latestSubmitted()).submittedAt}`);
        expect(summary).toContain('Environment: https://mako-dev.cms.gov');
        expect(summary).toContain('State: CA');
        expect(summary).toContain('Year: 26');
        expect(summary).toContain(`Record file: ${store.file}`);
        expect(await readFile(store.file, 'utf8')).toBe(before);
    });

    test('SMART target is the most recent submission across states, not the per-state latest', async () => {
        const ca = createSpaRecordStore(environment, seed, directory);
        const caId = await ca.reserve();
        await ca.markSubmitted(caId);
        const va = createSpaRecordStore(environment, { state: 'VA', year: '26', startSequence: 1 }, directory);
        const vaId = await va.reserve();
        await va.markSubmitted(vaId);
        expect(await selectSpaTarget(environment, undefined, seed, directory)).toMatchObject({ spaId: vaId, state: 'VA', year: '26' });
        const caLaterId = await ca.reserve();
        await ca.markSubmitted(caLaterId);
        expect(await selectSpaTarget(environment, undefined, seed, directory)).toMatchObject({ spaId: caLaterId, state: 'CA' });
        expect(await selectSpaTarget(environment, caId, seed, directory)).toMatchObject({ spaId: caId, state: 'CA' });
    });

    test('current SPA summary fails clearly without creating a missing store', async () => {
        const store = createSpaRecordStore(environment, seed, directory);
        await expect(currentSpaSummary(store)).rejects.toThrow('No confirmed SPA submission');
        await expect(readFile(store.file, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    });

    test('isolates environment, state, and year sequences', async () => {
        const original = createSpaRecordStore(environment, seed, directory);
        await original.reserve();
        expect(await createSpaRecordStore('https://other.test/', seed, directory).reserve()).toBe('CA-26-0037-QA01');
        expect(await createSpaRecordStore(environment, { ...seed, state: 'MD' }, directory).reserve()).toBe('MD-26-0037-QA01');
        expect(await createSpaRecordStore(environment, { ...seed, year: '27' }, directory).reserve()).toBe('CA-27-0037-QA01');
        expect(await original.reserve()).toBe('CA-26-0037-QA02');
    });

    test('persists duplicate skips and the accepted ID across runs', async ({ page }) => {
        const store = createSpaRecordStore(environment, seed, directory);
        await page.route('**/itemExists', (route) => route.fulfill({
            json: { exists: route.request().postDataJSON().id !== 'CA-26-0037-QA02' },
        }));
        await spaForm(page);
        const accepted = await chooseSpaId(page, { ...options, startSequence: 37 }, store.reserve);
        expect(accepted).toBe('CA-26-0037-QA02');
        await store.markSubmitted(accepted);
        const nextRun = createSpaRecordStore(environment, seed, directory);
        expect((await nextRun.latestSubmitted()).spaId).toBe(accepted);
        expect(await nextRun.reserve()).toBe('CA-26-0037-QA03');
    });

    test('fails safely on a held lock, corrupt data, and sequence exhaustion', async () => {
        const store = createSpaRecordStore(environment, seed, directory);
        await store.reserve();
        const previous = await readFile(store.file, 'utf8');
        await writeFile(`${store.file}.lock`, '');
        await expect(store.reserve()).rejects.toThrow('locked');
        expect(await readFile(store.file, 'utf8')).toBe(previous);
        await rm(`${store.file}.lock`);
        await writeFile(store.file, '{broken');
        await expect(store.reserve()).rejects.toThrow();
        expect(await readFile(store.file, 'utf8')).toBe('{broken');
        const exhausted = createSpaRecordStore(environment, { ...seed, state: 'AL', startSequence: 9999 }, directory);
        expect(await exhausted.reserve()).toBe('AL-26-9999-QA01');
        await writeFile(exhausted.file, JSON.stringify({ ...JSON.parse(await readFile(exhausted.file, 'utf8')), lastSuffix: 99 }));
        await expect(exhausted.reserve()).rejects.toThrow('between 1 and 9999');
    });

    test('a saved companion letter is found by a later run, and a second letter for the same SPA is refused', async () => {
        const letter = { spaId: 'CA-26-0086-QA14', letterName: 'CA-26-0086-QA14-CL', recordId: 'a1iSL000006qb4rYAA', createdByRole: 'group_director' as const };
        await createCompanionLetterStore(environment, directory).record(letter);
        expect(await createCompanionLetterStore(environment, directory).find('CA-26-0086-QA14'))
            .toMatchObject({ ...letter, createdAt: expect.any(String) });
        await createCompanionLetterStore(environment, directory).record(letter);
        await expect(createCompanionLetterStore(environment, directory).record({ ...letter, recordId: 'a1iSL000006other' }))
            .rejects.toThrow('already has companion letter');
    });
});