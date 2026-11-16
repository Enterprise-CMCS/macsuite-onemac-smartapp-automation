import { fileURLToPath } from 'node:url';
import { runSuites } from './lib/run-suite.mjs';

// Edit this list to change the run order. Steps run one at a time and the suite stops at the first failure.
// Runs every step against one SPA_STATE, like the other suites. Disapproval skips concurrence, so the Group Director
// decides on the Adjudication row after SRT and CPOC both recommend disapproval.
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
        name: 'SMART: Med SPA - group director disapproves',
        config: 'playwright.config.ts',
        file: 'tests/smart/group-director/group-dir-disapprove.spec.ts',
        args: ['--project=chromium', '--headed'],
        role: 'GROUPDIR',
    },
];

export const suite = { name: 'Med SPA disapproval suite', steps };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runSuites([suite], { title: suite.name });
}
