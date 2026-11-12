import { runSuite } from './lib/run-suite.mjs';

// Edit this list to change the run order. Steps run one at a time and the suite stops at the first failure.
const suite = [
    {
        name: 'OneMAC: create Med SPA',
        config: 'playwright.onemac.config.ts',
        file: 'tests/onemac/workflow/OneMAC-new-SPA.spec.ts',
        args: ['--headed'],
    },
    {
        name: 'SMART: Med SPA intake',
        config: 'playwright.config.ts',
        file: 'tests/smart/intake/intake.spec.ts',
        args: ['--project=chromium', '--headed'],
        role: 'INTAKE',
    },
    {
        name: 'OneMAC: Med SPA status is Under Review',
        config: 'playwright.onemac.config.ts',
        file: 'tests/onemac/status/OneMAC-status-under-review.spec.ts',
        args: ['--headed'],
    },
    {
        name: 'SMART: Med SPA - SRT validates subsequent documents',
        config: 'playwright.config.ts',
        file: 'tests/smart/srt/srt-subsequent-documents.spec.ts',
        args: ['--project=chromium', '--headed'],
        role: 'SRT',
    },
    {
        name: 'SMART: Med SPA - SRT recommends approval',
        config: 'playwright.config.ts',
        file: 'tests/smart/srt/srt-recommend-approval.spec.ts',
        args: ['--project=chromium', '--headed'],
        role: 'SRT',
    },
    {
        name: 'SMART: Med SPA - CPOC recommends approval',
        config: 'playwright.config.ts',
        file: 'tests/smart/cpoc/cpoc-recommend-approval.spec.ts',
        args: ['--project=chromium', '--headed'],
        role: 'CPOC',
    },
    {
        name: 'SMART: Med SPA - group director concurs',
        config: 'playwright.config.ts',
        file: 'tests/smart/concurrence/group-dir-concur.spec.ts',
        args: ['--project=chromium', '--headed'],
        role: 'GROUPDIR',
    },
    {
        name: 'SMART: Med SPA - division director approves',
        config: 'playwright.config.ts',
        file: 'tests/smart/approval/division-dir-approve.spec.ts',
        args: ['--project=chromium', '--headed'],
        role: 'DIVDIR',
    },
    {
        name: 'OneMAC: Med SPA - final review is Approved',
        config: 'playwright.onemac.config.ts',
        file: 'tests/onemac/status/OneMAC-final-review-approved.spec.ts',
        args: ['--headed'],
    },
];

runSuite(suite);
