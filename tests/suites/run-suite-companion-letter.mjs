import { fileURLToPath } from 'node:url';
import { runSuites } from './lib/run-suite.mjs';

// Full Med SPA flow from creation through final approval, with the companion letter inserted while the SPA is in Pending - Concurrence.
// Run with SPA_STATE set, e.g. SPA_STATE=CA npm run test:companion-letter. Every step uses the same SPA. The companion letter
// steps need a fresh SPA, so a re-run should start from new OneMAC creation.
const steps = [
    {
        name: 'OneMAC: create Med SPA',
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
        name: 'OneMAC: Med SPA status is Under Review',
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
        name: 'SMART: Med SPA - group director creates companion letter',
        config: 'playwright.config.ts',
        file: 'tests/smart/group-director/group-dir-create-companion-letter.spec.ts',
        args: ['--project=chromium', '--headed'],
        role: 'GROUPDIR',
    },
    {
        name: 'SMART: Med SPA - CPOC works companion letter lifecycle',
        config: 'playwright.config.ts',
        file: 'tests/smart/cpoc/cpoc-companion-letter-lifecycle.spec.ts',
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

export const suite = { name: 'Med SPA approval with companion letter suite', steps };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runSuites([suite], { title: suite.name });
}
