import { fileURLToPath } from 'node:url';
import { runSuites } from './lib/run-suite.mjs';

// Edit this list to change the run order. Steps run one at a time and the suite stops at the first failure.
// Runs every step against one SPA_STATE, like the other suites. SRT and CPOC approve first, the Group Director returns
// the SPA to review from Pending - Concurrence, then SRT and CPOC recommend disapproval and the Group Director disapproves.
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
        file: 'tests/smart/med-spa/intake/intake.spec.ts',
        args: ['--headed'],
        role: 'INTAKE',
    },
    {
        name: 'OneMAC: Med SPA - status is Under Review',
        config: 'playwright.config.ts',
        file: 'tests/onemac/status/OneMAC-status-under-review.spec.ts',
        args: ['--headed'],
    },
    {
        name: 'SMART: Med SPA - SRT recommends approval',
        config: 'playwright.config.ts',
        file: 'tests/smart/med-spa/srt/recommend-approval.spec.ts',
        args: ['--headed'],
        role: 'SRT',
    },
    {
        name: 'SMART: Med SPA - CPOC recommends approval',
        config: 'playwright.config.ts',
        file: 'tests/smart/med-spa/cpoc/recommend-approval.spec.ts',
        args: ['--headed'],
        role: 'CPOC',
    },
    {
        name: 'SMART: Med SPA - group director returns to review',
        config: 'playwright.config.ts',
        file: 'tests/smart/med-spa/group-director/return-to-review.spec.ts',
        args: ['--headed'],
        role: 'GROUPDIR',
    },
    {
        name: 'SMART: Med SPA - SRT recommends disapproval',
        config: 'playwright.config.ts',
        file: 'tests/smart/med-spa/srt/recommend-disapproval.spec.ts',
        args: ['--headed'],
        role: 'SRT',
    },
    {
        name: 'SMART: Med SPA - CPOC recommends disapproval after approval',
        config: 'playwright.config.ts',
        file: 'tests/smart/med-spa/cpoc/recommend-disapproval-after-approval.spec.ts',
        args: ['--headed'],
        role: 'CPOC',
    },
    {
        name: 'SMART: Med SPA - group director disapproves',
        config: 'playwright.config.ts',
        file: 'tests/smart/med-spa/group-director/disapprove.spec.ts',
        args: ['--headed'],
        role: 'GROUPDIR',
    },
];

export const suite = { name: 'Med SPA approve, return, disapprove suite', steps };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runSuites([suite], { title: suite.name });
}
