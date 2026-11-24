# Command Reference

Environment variables go before the command. Run from the repository root.

`playwright.config.ts` runs all specs (`tests/`, excluding `tests/unit`) at a 1820x980 viewport.

`SPA_STATE` selects the state whose record store the OneMAC specs read. The OneMAC workflow specs (`OneMAC-new-SPA`,
`OneMAC-respond-rai`, `OneMAC-withdraw-rai`, and `cpoc-enable-rai-withdrawal`) have no default, so you must set it on every run, and they fail before any browser step if it's
missing. The other specs still default to `CA`. Use the same value for every step of a run. If no record in the store
matches, the spec stops with `No SPA in <status> for <env>, <state>-<year>`.

| Purpose | Command |
| --- | --- |
| Run all local checks (no login or submission) | `npm run quality` |
| Typecheck | `npm run typecheck` |
| Unit tests | `npm run test:unit` |
| List SMART tests | `npm run test:list` |
| Show latest confirmed SPA | `npm run spa:current` |
| Run SMART test as a role | `SF_ROLE=INTAKE npx playwright test tests/smart/med-spa/intake/intake.spec.ts --project=chromium --headed` |
| Run SMART test on a chosen stored SPA (runs only that SPA) | `SPA_ID=CA-26-0086-QA13 SF_ROLE=INTAKE npx playwright test tests/smart/med-spa/intake/intake.spec.ts --project=chromium --headed` |
| Run SMART tests via npm script | `SF_ROLE=CPOC npm run test:smart -- intake.spec.ts --headed` |
| Create a new OneMAC SPA (live: submits a record) | `SPA_STATE=CA npx playwright test --project=chromium --headed tests/onemac/workflow/OneMAC-new-SPA.spec.ts` |
| Create a new OneMAC SPA on Edge or Firefox (live: submits a record) | `SPA_STATE=VA npx playwright test --project=msedge --headed tests/onemac/workflow/OneMAC-new-SPA.spec.ts` (use `--project=firefox` for Firefox) |
| Create a new OneMAC SPA in Chrome, Edge, and Firefox in parallel (live: submits three records, one per browser; one merged report and one Slack message) | `npm run test:browsers` |
| Run OneMAC new-SPA workflow (live: submits a record) | `SPA_STATE=CA npm run test:onemac` |
| Run OneMAC RAI response workflow (live: starts the review clock) | `SPA_STATE=CO npm run test:onemac-rai-response` |
| Run OneMAC "under review" status check only | `SPA_STATE=CA npm run test:onemac-status` |
| Run approval suite (live: starts by creating a SPA) | `BROWSER=chromium SPA_STATE=CA npm run test:all` |
| Run companion letter suite (live: creates a SPA and runs it through final approval) | `BROWSER=chromium SPA_STATE=CA npm run test:companion-letter` |
| Run RAI suite (live: starts by creating a SPA and submits an RAI response) | `BROWSER=chromium SPA_STATE=CA npm run test:rai` |
| Run Intake Needed split suite (live: creates a SPA, splits it before intake, then runs intake and approval) | `BROWSER=chromium SPA_STATE=VA node tests/med-spa-suites/run-suite-split-intake-approval.mjs` |

`npm run test:browsers` runs the create-SPA test in three browsers at once, with a fixed state per browser: Chrome uses
`CA`, Edge uses `VA`, and Firefox uses `CO`. The merged HTML report is written to `playwright-report-parallel/index.html`.
Parallel runs need different states, so keep those assignments when you change them.

Every suite requires `BROWSER`, which must be `chromium`, `msedge`, or `firefox`. There is no default, and the suite exits
before any step runs if it's missing or invalid. `BROWSER` applies to every step, and it replaces any `--project` in a
step's arguments. For either suite, `SPA_STATE` set on the command line applies to every step, so the whole run uses one
state. Change `CA` to the state you want. The variables must come before `npm run`. To run on Edge, use
`BROWSER=msedge SPA_STATE=VA npm run test:all`. The RAI suite creates its own SPA in that state
on its first step, so it doesn't need an existing record.

The Intake Needed split suite has no npm script. It creates a SPA, has the Super User split it while it is still at Intake Needed, then runs intake and the approval steps on the parent and child. Intake and the approval steps run over every waiting SPA in the newest workflow. Set `BROWSER` and `SPA_STATE` as above. To run only the intake loop on one SPA, use `SPA_ID` with the intake command below.

## Run each test individually

Copy and run any line below. Each runs one spec with the role it needs.

### SMART (default config)

| Spec | Command |
| --- | --- |
| Intake | `SF_ROLE=INTAKE npx playwright test tests/smart/med-spa/intake/intake.spec.ts --project=chromium --headed` |
| CPOC recommend RAI | `SF_ROLE=CPOC npx playwright test tests/smart/med-spa/cpoc/recommend-rai.spec.ts --project=chromium --headed` |
| CPOC recommend approval | `SF_ROLE=CPOC npx playwright test tests/smart/med-spa/cpoc/recommend-approval.spec.ts --project=chromium --headed` |
| CPOC recommend RAI approval | `SF_ROLE=CPOC npx playwright test tests/smart/med-spa/cpoc/recommend-rai-approval.spec.ts --project=chromium --headed` |
| SRT recommend RAI | `SF_ROLE=SRT npx playwright test tests/smart/med-spa/srt/recommend-rai.spec.ts --project=chromium --headed` |
| SRT recommend approval | `SF_ROLE=SRT npx playwright test tests/smart/med-spa/srt/recommend-approval.spec.ts --project=chromium --headed` |
| SRT recommend RAI approval | `SF_ROLE=SRT npx playwright test tests/smart/med-spa/srt/recommend-rai-approval.spec.ts --project=chromium --headed` |
| SRT subsequent documents (read-only check of the newest Pending - First Clock SPA) | `SPA_STATE=CA SF_ROLE=SRT npx playwright test tests/smart/med-spa/srt/subsequent-documents.spec.ts --project=chromium --headed` |
| CPOC enable RAI withdrawal (flips withdrawal to Enabled in SMART) | `SPA_STATE=CO SF_ROLE=CPOC npx playwright test tests/smart/med-spa/cpoc/enable-rai-withdrawal.spec.ts --project=chromium --headed` |
| Division Director approve | `SF_ROLE=DIVDIR npx playwright test tests/smart/med-spa/division-director/approve.spec.ts --project=chromium --headed` |
| Group Director concur | `SF_ROLE=GROUPDIR npx playwright test tests/smart/med-spa/group-director/concur.spec.ts --project=chromium --headed` |

Each row uses its own account: the Division Director and Group Director steps run as `DIVDIR` and `GROUPDIR`, and each test checks that its account is recorded in Acted By User.

### OneMAC (OneMAC config)

| Spec | Command |
| --- | --- |
| New SPA (creates a record) | `SPA_STATE=CA npx playwright test --project=chromium --headed tests/onemac/workflow/OneMAC-new-SPA.spec.ts` |
| Respond to RAI (live: starts the review clock) | `SPA_STATE=CO npx playwright test --project=chromium --headed tests/onemac/workflow/OneMAC-respond-rai.spec.ts` |
| Status: under review + subsequent documents upload (live: submits a subsequent-documents package to the newest Pending - First Clock SPA on every run) | `SPA_STATE=CA npx playwright test --project=chromium --headed tests/onemac/status/OneMAC-status-under-review.spec.ts` |
| Withdraw RAI response (live: notifies CMS; needs CPOC enable first) | `SPA_STATE=CO npx playwright test --project=chromium --headed tests/onemac/workflow/OneMAC-withdraw-rai.spec.ts` |
| Status: RAI issued | `SPA_STATE=CA npx playwright test --project=chromium --headed tests/onemac/status/OneMAC-status-rai-issued.spec.ts` |
| Status: final review approved | `SPA_STATE=CA npx playwright test --project=chromium --headed tests/onemac/status/OneMAC-final-review-approved.spec.ts` |

The RAI response row uses `CO` because `CO-26-0001-QA06` is the SPA in `pending_rai`. Use the state of the
pending SPA. The status rows use `CA`, the default. Change `SPA_STATE` to match the SPA you're checking.

Targeting a stored SPA:

- `SPA_ID=<id>` works for specs that use the SMART fixture (for example, intake) and for `spa:current`.
- Workflow specs read their own variables instead, and ignore `SPA_ID`:
  - `CPOC_SPA_ID`: CPOC recommend specs that don't run the approval workflow
  - `SRT_SPA_ID`: SRT recommend specs that don't run the approval workflow
  - `ADJUDICATION_SPA_ID`: Division Director approve after return
  - `RAI_SPA_ID`: OneMAC RAI response
  - `RAI_WITHDRAWAL_SPA_ID`: CPOC enable RAI withdrawal and OneMAC RAI withdrawal
  - Without these variables, each spec uses the newest SPA in the required status.
  - The SRT, CPOC recommend approval, Group Director concur, and Division Director approve specs run every SPA in the workflow (the newest parent and its splits still waiting), parent first. They skip any SPA the role already finished. They don't take a single-SPA variable.
- `RAI_RESPONSE_DATE` overrides the stored formal RAI response date in `srt-recommend-rai-approval.spec.ts`.

`SF_ROLE` accepts `INTAKE`, `CPOC`, `SRT`, `DIVDIR`, `GROUPDIR`, or `SUPERUSR`
(case-insensitive). A stored `SPA_ID` must already exist in the local store; the run
fails otherwise and never creates a record. Append `--list` to any Playwright command to
check discovery without logging in.
