import { fileURLToPath } from 'node:url';
import { runSuites } from './lib/run-suite.mjs';

// Edit this list to change the run order. Steps run one at a time and the suite stops at the first failure.
// Runs every step against one SPA_STATE, like the other suites. SRT and CPOC recommend disapproval first, the Group Director
// returns the SPA to review from Pending - Disapproval, then SRT and CPOC recommend RAI, OneMAC responds to the formal RAI,
// SRT and CPOC recommend approval for the RAI response, and the chain runs through the Division Director.
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
        name: 'SMART: Med SPA - SRT recommends disapproval',
        config: 'playwright.config.ts',
        file: 'tests/smart/med-spa/srt/recommend-disapproval.spec.ts',
        args: ['--headed'],
        role: 'SRT',
    },
    {
        name: 'SMART: Med SPA - CPOC recommends disapproval',
        config: 'playwright.config.ts',
        file: 'tests/smart/med-spa/cpoc/recommend-disapproval.spec.ts',
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
        name: 'SMART: Med SPA - SRT recommends RAI after return',
        config: 'playwright.config.ts',
        file: 'tests/smart/med-spa/srt/recommend-rai.spec.ts',
        args: ['--headed'],
        role: 'SRT',
    },
    {
        // Records the RAI dates in the local store, which the OneMAC status check reads.
        name: 'SMART: Med SPA - CPOC recommends RAI after return',
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
        // Adds the SRT (SME) to the Review Team with Designate as Consulting SME after the RAI response.
        name: 'SMART: intake assigns SRT (SME)',
        config: 'playwright.config.ts',
        file: 'tests/smart/med-spa/intake/assign-sme.spec.ts',
        args: ['--headed'],
        role: 'INTAKE',
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
        name: 'SMART: Med SPA - SRT (SME) recommends approval',
        config: 'playwright.config.ts',
        file: 'tests/smart/med-spa/srt/sme-recommend-approval.spec.ts',
        args: ['--headed'],
        role: 'SRT_SME',
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
        file: 'tests/smart/med-spa/division-director/approve-after-return.spec.ts',
        args: ['--headed'],
        role: 'DIVDIR',
    },
];

export const suite = { name: 'Med SPA disapprove, return, approve suite', steps };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runSuites([suite], { title: suite.name });
}
