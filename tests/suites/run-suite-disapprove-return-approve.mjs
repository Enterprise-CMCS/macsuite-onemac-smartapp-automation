import { fileURLToPath } from 'node:url';
import { runSuites } from './lib/run-suite.mjs';

// Edit this list to change the run order. Steps run one at a time and the suite stops at the first failure.
// Runs every step against one SPA_STATE, like the other suites. SRT and CPOC recommend disapproval first, the Group Director
// returns the SPA to review from Pending - Disapproval, then SRT and CPOC approve and the chain runs through the Division Director.
const steps = [
    {
        name: 'OneMAC: Med SPA - create SPA',
        config: 'playwright.config.ts',
        file: 'tests/onemac/workflow/OneMAC-new-SPA.spec.ts',
        args: ['--headed'],
    },
    {
        name: 'SMART: intake',
        config: 'playwright.config.ts',
        file: 'tests/smart/intake/intake.spec.ts',
        args: ['--project=chromium', '--headed'],
        role: 'INTAKE',
    },
    {
        name: 'OneMAC: Med SPA - status is Under Review',
        config: 'playwright.config.ts',
        file: 'tests/onemac/status/OneMAC-status-under-review.spec.ts',
        args: ['--headed'],
    },
    {
        name: 'SMART: Med SPA - SRT recommends disapproval',
        config: 'playwright.config.ts',
        file: 'tests/smart/srt/srt-recommend-disapproval.spec.ts',
        args: ['--project=chromium', '--headed'],
        role: 'SRT',
    },
    {
        name: 'SMART: Med SPA - CPOC recommends disapproval',
        config: 'playwright.config.ts',
        file: 'tests/smart/cpoc/cpoc-recommend-disapproval.spec.ts',
        args: ['--project=chromium', '--headed'],
        role: 'CPOC',
    },
    {
        name: 'SMART: Med SPA - group director returns to review',
        config: 'playwright.config.ts',
        file: 'tests/smart/group-director/group-dir-return-to-review.spec.ts',
        args: ['--project=chromium', '--headed'],
        role: 'GROUPDIR',
    },
    // add new SRT
    // request RAI
    // onemac formal response
    // check for spending second review
    {
        name: 'SMART: Med SPA - SRT recommends approval',
        config: 'playwright.config.ts',
        file: 'tests/smart/srt/srt-recommend-approval.spec.ts',
        args: ['--project=chromium', '--headed'],
        role: 'SRT',
    },
    {
        name: 'SMART: Med SPA - CPOC recommends approval after disapproval',
        config: 'playwright.config.ts',
        file: 'tests/smart/cpoc/cpoc-recommend-approval-after-disapproval.spec.ts',
        args: ['--project=chromium', '--headed'],
        role: 'CPOC',
    },
    {
        name: 'SMART: Med SPA - group director concurs',
        config: 'playwright.config.ts',
        file: 'tests/smart/group-director/group-dir-concur.spec.ts',
        args: ['--project=chromium', '--headed'],
        role: 'GROUPDIR',
    },
    {
        name: 'SMART: Med SPA - division director approves',
        config: 'playwright.config.ts',
        file: 'tests/smart/division-director/division-dir-approve-after-return.spec.ts',
        args: ['--project=chromium', '--headed'],
        role: 'DIVDIR',
    },
];

export const suite = { name: 'Med SPA disapprove, return, approve suite', steps };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runSuites([suite], { title: suite.name });
}
