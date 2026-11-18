import { fileURLToPath } from 'node:url';
import { runSuites } from './lib/run-suite.mjs';

// Runs the approval path for a parent Med SPA and its split child. Every role step runs the parent, then the child.
// Edit this list to change the run order. Steps run one at a time and the suite stops at the first failure.
const steps = [
    {
        name: 'OneMAC: Create Med SPA',
        config: 'playwright.config.ts',
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
        name: 'SMART: Med SPA - Super User splits SPA',
        config: 'playwright.config.ts',
        file: 'tests/smart/super/split-spa.spec.ts',
        args: ['--project=chromium', '--headed'],
        role: 'SUPERUSR',
    },
    {
        name: 'OneMAC: parent and split Med SPAs are Under Review',
        config: 'playwright.config.ts',
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
        file: 'tests/smart/group-director/group-dir-concur.spec.ts',
        args: ['--project=chromium', '--headed'],
        role: 'GROUPDIR',
    },
    {
        name: 'SMART: Med SPA - division director approves',
        config: 'playwright.config.ts',
        file: 'tests/smart/division-director/division-dir-approve.spec.ts',
        args: ['--project=chromium', '--headed'],
        role: 'DIVDIR',
    },
    {
        name: 'OneMAC: Med SPA - final review is Approved',
        config: 'playwright.config.ts',
        file: 'tests/onemac/status/OneMAC-final-review-approved.spec.ts',
        args: ['--headed'],
    },
];

export const suite = { name: 'Split Med SPA Approval suite', steps };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runSuites([suite], { title: suite.name });
}
