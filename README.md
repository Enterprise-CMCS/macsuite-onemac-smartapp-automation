# OneMAC SmartApp Automation

Playwright end-to-end automation for two related Medicaid workflows:

- **OneMAC**: creates a State Plan Amendment (SPA) submission and records its confirmed SPA ID.
- **SMART (Salesforce)**: opens the latest confirmed SPA and runs role-based workflow steps against it.

The goal is to create a OneMAC submission once per new sequential SPA ID, persist that ID locally, and let separate SMART test runs reuse it without recreating a submission or depending on OneMAC.


## How It Works

1. **SPA ID allocation.** IDs follow `STATE-YY-NNNN-QANN` (for example `CA-26-0086-QA01`), where `QA01`-`QA99` marks automation-created IDs under each base number. The generator uses the current two-digit year and an explicitly selected state. It cycles `QA01`-`QA99` under a base number before advancing the base, and checks each candidate against OneMAC's `/itemExists` validation before use.
2. **Persistent record store.** Allocations and confirmed submissions are saved as JSON under `playwright/.records/`, one file per environment, state, and year. Updates are atomic and use a local lock. The store is ignored by Git and must be kept between runs.
3. **OneMAC creation.** The OneMAC test creates a package, uploads the configured attachments, verifies the submission on the dashboard, and saves its details to the confirmed record.
4. **SMART workflow.** The SMART fixture reads the latest confirmed SPA ID, logs in as the selected role, and exposes the ID and saved submission details to tests. SMART tests never reserve an ID or create a record.

## Running the Suite

Suites run their steps in order against one SPA, one step at a time, and stop at the first failed step. Live suites need `SPA_STATE` set to one of `VA`, `CO`, `MD`, `CA`, or `AL`, because the OneMAC creation step has no default state. Each suite's steps are defined in its `tests/med-spa-suites/run-suite-*.mjs` file, which exports `suite`. All suites share the runner in `tests/med-spa-suites/lib/run-suite.mjs`.

- `SPA_STATE=CA npm run test:all` runs the approval suite (`run-suite-approval.mjs`): create the SPA, SMART intake, SRT validates subsequent documents, SRT and CPOC recommend approval, group director concurs, division director approves, then the final review is checked in OneMAC.
- `SPA_STATE=CA npm run test:rai` runs the RAI suite (`run-suite-rai-approve.mjs`): create the SPA, intake, SRT and CPOC recommend RAI, OneMAC shows RAI Issued, OneMAC responds to the formal RAI, SRT and CPOC recommend approval for the RAI response, group director concurs, division director approves, then the final review is checked.
- `SPA_STATE=CA npm run test:rai-withdrawal` runs the RAI withdrawal suite (`run-suite-rai-withdrawal.mjs`): the RAI path above, except that after the first RAI response CPOC enables RAI withdrawal, OneMAC withdraws the response and responds again, and then the approvals run.
- The split RAI suite (`run-suite-split-rai-approval.mjs`) has no npm script. Run it directly, for example `SPA_STATE=CA node tests/med-spa-suites/run-suite-split-rai-approval.mjs`. It follows the RAI suite through OneMAC's formal RAI response, then a Super User splits the SPA at Pending - Second Clock. SRT and CPOC then recommend approval for the parent and the split, followed by the director approvals and the final review.
- `SPA_STATE=CA npm run test:all-suites` runs every `tests/med-spa-suites/run-suite-*.mjs` file in filename order, each stopping at its own first failure, and posts one combined Slack message. The message shows totals across all suites, a count line per suite, and only the failed or flaky tests under each suite. The entry point is `tests/med-spa-suites/run-all.mjs`.
- The disapproval suites have no npm script. Run them directly, for example `SPA_STATE=VA node tests/med-spa-suites/run-suite-disapprove-return-approve.mjs`. The others are `run-suite-disapproval.mjs` and `run-suite-approve-return-disapprove.mjs`.

When `SLACK_WEBHOOK_URL` is set, each run posts one plain-text Slack message through a Slack Workflow Builder webhook that takes a `text` variable. The message is built in `tests/med-spa-suites/lib/slack.mjs`. Set the variable in your shell with `read -s SLACK_WEBHOOK_URL && export SLACK_WEBHOOK_URL` so the URL stays out of shell history. If the variable is unset, the run skips Slack and continues.

When the suite finishes, open `playwright-report/index.html` (or run `npx playwright show-report`) for one report that covers every step that ran. Its title is the suite name. Each step's JUnit file is saved as `test-results/junit-<suite>-<step number>.xml` for TestRail, where `<suite>` is the suite name in lowercase with hyphens (for example `med-spa-rai-suite-3`).

## Project Layout

```text
tests/
  onemac/                    OneMAC workflows (SPA creation, RAI responses and withdrawal, status checks)
  smart/                     SMART role workflows (intake, SRT, CPOC, group director, division director)
  unit/                      Local unit checks for ID and record logic
  suites/                    Ordered suite runners (see Running the Suite) and shared runner
support/
  auth/                      OneMAC and SMART login helpers, TOTP
  config/                    Environment variables, URLs, role registry
  data/                      SPA ID allocation, record store, attachment list
  documents/upload/          Sample files for OneMAC title-matched uploads
  documents/additional/      Sample files for OneMAC "Other" uploads
  fixtures/smart.fixture.ts  Role-aware authenticated page fixture
  ui/smart/                  SMART page objects and record sections
docs/test-authoring.md       Guide for capturing and adding SMART tests
scripts/checks/check-customizations.cjs
```

## Configurations

- `playwright.config.ts`: default Playwright suite (SMART and OneMAC), Chromium only, one worker, no retries.
- `playwright.unit.config.ts`: local unit checks.

## Important Notes

- Test traces, reports, and captures contain session cookies and record data. Keep `test-results/`, `playwright-report/`, `blob-report/`, and `playwright/` private.
- Do not run concurrent OneMAC creators against the same record range.
- Deleting `playwright/.records/` loses sequence and handoff history.
- Credentials are read from the environment. Do not place them in chat, browser-tool arguments, or committed files.
- Live CI execution, secret injection, and scheduled daily runs are not configured yet.
