import { fileURLToPath } from 'node:url';
import { runSuites } from './lib/run-suite.mjs';

// Edit this list to change the run order. Steps run one at a time and the suite stops at the first failure.
// Runs every step against one SPA_STATE. Set it once, e.g. SPA_STATE=CO npm run test:rai, so the respond step finds
// the SPA that the earlier steps created and moved to Pending RAI. The OneMAC workflow steps require it (no default).
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
        name: 'SMART: Med SPA - SRT recommends RAI',
        config: 'playwright.config.ts',
        file: 'tests/smart/med-spa/srt/recommend-rai.spec.ts',
        args: ['--headed'],
        role: 'SRT',
    },
    {
        // Records the RAI dates in the local store, which the OneMAC status check reads.
        name: 'SMART: Med SPA - CPOC recommends RAI',
        config: 'playwright.config.ts',
        file: 'tests/smart/med-spa/cpoc/recommend-rai.spec.ts',
        args: ['--headed'],
        role: 'CPOC',
    },
    {
        name: 'OneMAC: Med SPA - status is RAI Issued',
        config: 'playwright.config.ts',
        file: 'tests/onemac/status/OneMAC-status-rai-issued.spec.ts',
        args: ['--headed'],
    },
    {
        name: 'OneMAC: Med SPA - responds to formal RAI',
        config: 'playwright.config.ts',
        file: 'tests/onemac/workflow/OneMAC-respond-rai.spec.ts',
        args: ['--headed'],
    },
    {
        // Verifies the RAI response in SMART, then SRT records the second clock review.
        name: 'SMART: Med SPA - SRT validates second clock and recommends approval',
        config: 'playwright.config.ts',
        file: 'tests/smart/med-spa/srt/recommend-rai-approval.spec.ts',
        args: ['--headed'],
        role: 'SRT',
    },
    {
        name: 'SMART: Med SPA - CPOC recommends approval for RAI response',
        config: 'playwright.config.ts',
        file: 'tests/smart/med-spa/cpoc/recommend-rai-approval.spec.ts',
        args: ['--headed'],
        role: 'CPOC',
    },
    {
        name: 'SMART: Med SPA - group director concurs',
        config: 'playwright.config.ts',
        file: 'tests/smart/med-spa/group-director/concur.spec.ts',
        args: ['--headed'],
        role: 'GROUPDIR',
    },
    {
        name: 'SMART: Med SPA - division director approves',
        config: 'playwright.config.ts',
        file: 'tests/smart/med-spa/division-director/approve.spec.ts',
        args: ['--headed'],
        role: 'DIVDIR',
    },
    {
        name: 'OneMAC: Med SPA - final review is Approved',
        config: 'playwright.config.ts',
        file: 'tests/onemac/status/OneMAC-final-review-approved.spec.ts',
        args: ['--headed'],
    },
];

export const suite = { name: 'Med SPA RAI suite', steps };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runSuites([suite], { title: suite.name });
}
