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

`npm run test:all` runs the approval workflow in order and stops at the first failure. The step order is defined in `tests/suites/run-suite-approval.mjs`.

`npm run test:rai` runs OneMAC creation, SMART intake, SRT RAI, CPOC RAI, and the OneMAC RAI Issued status check in order. The step order is defined in `tests/suites/run-suite-rai.mjs`. Both suites share the runner in `tests/suites/lib/run-suite.mjs`.

When the suite finishes, open `playwright-report/index.html` for one report that covers every step that ran. Each step's JUnit file is saved as `test-results/junit-<step number>.xml` for TestRail.

## Project Layout

```text
tests/
  onemac/                    OneMAC workflows (SPA creation, status checks)
  smart/                     SMART role workflows (intake, API discovery)
  unit/                      Local unit checks for ID and record logic
  suites/                    Ordered suite runners (npm run test:all, test:rai) and shared runner
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

- `playwright.config.ts`: default SMART suite, Chromium only, one worker, no retries.
- `playwright.onemac.config.ts`: opt-in OneMAC creation suite. It has no dependency on the SMART tests.
- `playwright.unit.config.ts`: local unit checks.

## Important Notes

- Test traces, reports, and captures contain session cookies and record data. Keep `test-results/`, `playwright-report/`, `blob-report/`, and `playwright/` private.
- Do not run concurrent OneMAC creators against the same record range.
- Deleting `playwright/.records/` loses sequence and handoff history.
- Credentials are read from the environment. Do not place them in chat, browser-tool arguments, or committed files.
- Live CI execution, secret injection, and scheduled daily runs are not configured yet.
