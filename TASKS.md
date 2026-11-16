# Automation Roadmap

## Goal

Create a OneMAC submission once per new sequential SPA ID and persist that ID
for reuse across separate Salesforce SMART test runs. Salesforce tests must not
recreate the submission or depend on rerunning OneMAC. Establish the structure
first, implement persistent record allocation and selection next, then expand
role tests and add GitHub Copilot agent and Playwright MCP authoring guidance.

## Current Structure Progress

- [x] Move SMART specs into `tests/smart` and authentication helpers
  into `support/auth`.
- [x] Use SMART application names for the fixture, login helper, role registry,
  and `test:smart` command. Keep existing `SF_*` environment variables unchanged.
- [x] Extract existing SMART navigation and dynamic SPA search into page objects.
  Provide `navigation` and `recordSearch` through the authenticated fixture; keep
  saved-ID selection and login there. Three isolated browser checks passed, as
  did intake discovery. Live verification of the refactored flow remains pending.
- [x] Add a typed six-role registry and an authenticated page fixture. Each test
  gets its own context, and credential validation occurs for its selected role.
- [x] Select the role through CLI environment variable `SF_ROLE`, not hardcoded
  spec options. Remove standalone login tests; authentication belongs to the
  shared fixture used by all Salesforce browser tests.
- [x] Replace fixed login sleeps with an App Launcher readiness assertion. Live
  intake login and search passed in the user's run before the naming-only SMART
  rename. Optional MFA/session handling remains pending.
- [x] Make default runs Salesforce-only, Chromium-only, single-worker, and
  retry-free. Add a separate opt-in OneMAC config with no dependency on it.
- [x] Correct `.env` ignore rules and reserve ignored `playwright/.records` for
  persistent local record data, outside Playwright's disposable output folders.
- [x] Verify discovery: one Salesforce test by default; one OneMAC test with
  the opt-in config. Validate all six CLI roles, lowercase input, and rejection
  of unknown or empty roles. Post-rename checks were discovery only, not live
  browser tests.
- [x] Review official Playwright fixture, configuration, and authentication docs.
  The current `test.extend()` / overridden `page` pattern is supported; fixture
  placement under `tests/fixtures` is an organizational choice, not a requirement.

Available commands:

```sh
npm run test:list
npm run quality
npm run spa:current
SF_ROLE=INTAKE npx playwright test tests/smart/intake/intake.spec.ts --headed --project=chromium
SF_ROLE=CPOC npm run test:smart -- intake.spec.ts --headed
npm run test:onemac -- --list
npx playwright test --config=playwright.unit.config.ts
SPA_STATE=CA npx playwright test --project=chromium --headed
```

The direct `npx playwright test` command above is the current intake command.
`--headed` displays the browser; `--project=chromium` selects the browser project.
For discovery without login or application changes, append `--list`.

For manual testing, `npm run spa:current` prints the latest confirmed SPA ID,
submission time, environment, state, year, and absolute JSON file location.
It reads the same local store as SMART without opening a browser, allocating an
ID, or writing a second copy. It defaults to `CA` and the current year; use
`SPA_STATE=MD npm run spa:current` to inspect another allowed state. Missing or
invalid records produce an error and a nonzero exit code, never a new record.
The TypeScript command runs through the `tsx` development dependency.

All three configs name their browser project `chromium`. `--config` selects the
suite; `--project=chromium` selects its browser settings. The default config runs
SMART only; OneMAC record creation remains an explicit opt-in.

Helper checks do not need to precede every manual UI test. Run them locally when
changing ID generation, persistence, retry logic, or related configuration. For
automated regression, run them once as a prerequisite to live UI tests on each
CI run, including a future daily schedule. The current GitHub workflow only runs
on pushes and pull requests; helper gating and daily scheduling are not configured.
Daily mutating UI scenarios need a known starting record state; loading yesterday's
completed SPA does not reset it. Fresh CI machines also need protected durable
sequence/record storage before reusing the local-file approach across runs.

`SF_ROLE` applies to every Salesforce test in that invocation. Supported roles:
`INTAKE`, `CPOC`, `SRT`, `DIVDIR`, `GROUPDIR`, and `SUPERUSR` (case-insensitive).
Omitting it defaults to `INTAKE`; empty or unknown values fail before execution.
The fixture logs in before each test that requests `page`, using that role's
environment credentials and an isolated browser context. Every Salesforce browser
spec must import `test` from `support/fixtures/smart.fixture.ts`, not directly
from `@playwright/test`. Role selection does not bypass app permissions or record
state requirements. Run separate commands to use different roles for different
tests.

`test:onemac` without `--list` runs the headed submission test with sequential
SPA ID selection. Defaults: state `CA`, current two-digit year, starting sequence
`37`, and at most `25` candidate checks (`SPA_MAX_ATTEMPTS` supports 1-100).
The SPA year always comes from the computer's current local calendar year in
two-digit format. No CLI year is needed; any old `SPA_YEAR` setting is ignored.
At year rollover, the separate store for that year is used automatically.
`SPA_START_SEQUENCE` is a seed for a new environment/state/year store only.
Existing stores always continue after their last reserved candidate, even if the
seed changes. A confirmed `CA-26-0037-QA01` normally makes the next run reserve
`CA-26-0037-QA02`; rejected or interrupted attempts are also consumed, so gaps are
intentional. No number is assumed available until OneMAC validates it.
The state must also be authorized for the logged-in OneMAC user. The selected ID
is logged. Validation waits up to 10 seconds for each candidate's `/itemExists`
response and stops on validation failures rather than treating them as available.
Uploads are automated: `CMS-179 Form.png` goes into `cmsForm179-upload`, and
`SPA pages.png` goes into `spaPages-upload`. Paths resolve relative to the spec;
no file-picker clicks or manual pauses remain. Both real image files passed a
local Chromium input check; live application upload/submission verification is
still pending. Inline OneMAC credentials remain. Do not run concurrent creators
against the same record range.
No live OneMAC submission was run during this change; all 13 local checks passed,
including restart persistence, confirmed handoff, interrupted reservations,
environment/state/year isolation, duplicate skips, and file-safety failures.

The persistent allocator stores records under ignored
`playwright/.records/<environment-hash>/<STATE>-<YY>.json`, outside disposable
reports and test results. It uses atomic updates and an exclusive local lock;
an overlapping update fails clearly rather than resetting or sharing a candidate.
After confirmed submission, the same file stores the successful SPA ID, origin,
state, year, and reservation/submission timestamps. `latestSubmitted()` reads only
confirmed submissions and fails if none exist. It never triggers OneMAC creation.

Keep these files between runs; deleting them loses sequence and handoff history.
After an interrupted update, remove a leftover `.lock` only after verifying that
no process still uses it. This is local coordination, not a cross-machine or CI
allocator. Other machines can still select the same ID before either submits.
The SMART fixture now reads the latest confirmed submission for the shared
OneMAC environment, `SPA_STATE` (default `CA`), and current two-digit year before
login. It exposes `spaId`, includes that ID in the test report annotations, and
fails clearly if no confirmed submission exists. It never reserves an ID or
creates a record. Intake opens the saved `spaId`, updates its Subject, assigns
CPOC and SRT, adds a note, marks Intake Complete, and expects Pending - First
Clock. Later CPOC/SRT workflow tests will use their own selected logins. Repeated
Intake runs use the same record until a newer OneMAC submission is confirmed for
that environment/state/year. Record data comes from the local JSON store, not
chat memory. The newly captured Intake actions still need live sandbox validation.

After submission, the OneMAC test opens the new package from the dashboard,
verifies its Submission ID and today's Initial Submission Date, and saves the
State, Initial Submission Date, Proposed Effective Date, and Additional
Information as `details` on the confirmed record. The SMART `onemacSubmission`
fixture exposes them and fails if the latest record has none. The Intake test
first verifies Identifying Information (ID, Authority, Source System, State,
Initial Submission Date) and Proposed Effective Date on the Details tab. It then
checks the OneMAC Attachments section on the Attachments tab: every file in
`support/data/onemac-attachments.ts` with its document type, plus the saved
Additional Information. The OneMAC test uploads that same list and checks it on
the OneMAC package details page. The remaining Intake actions are temporarily
commented out during this validation. Neither step has been validated live.

## Initial Review Findings

- The Salesforce intake test imports `loginAsUser` but never calls it. Each
  Playwright test receives a fresh context, so separate login tests do not
  authenticate later tests.
- `sf-login.ts` and `totp-helper.ts` are reusable helpers. A fixture should own
  authenticated contexts and call those helpers; the helpers need not become
  fixtures themselves.
- Login currently finishes with an eight-second delay and `networkidle`, not an
  assertion that the expected Salesforce app and user are ready.
- The TOTP helper avoids codes near expiry but does not prevent reuse of the
  same user's code by concurrent or closely spaced logins.
- OneMAC has inline credentials, a fixed SPA ID, manual upload pauses, and no
  machine-readable record handoff. It cannot yet run unattended.
- Configuration runs every test in Chromium, Firefox, and WebKit with full
  parallelism. There is no OneMAC-to-Salesforce dependency or workflow ordering.
- Environment loading occurs in individual Salesforce specs. Configuration has
  dotenv loading commented out, and required variables are not validated.
- Environment variable names define INTAKE, CPOC, SRT, DIVDIR, GROUPDIR, and
  SUPERUSR accounts. Their business order and responsibilities still need to be
  confirmed. Secret values were not inspected during this review.
- `.gitignore` has `/.env/`, a directory rule, but `.env` is a file. Correct this
  before initializing or publishing a repository. This folder currently has no
  Git repository, so tracking and history could not be checked.
- GitHub Actions runs the entire suite without explicit application secret
  injection and uploads reports with a 30-day retention period.

## Proposed Structure

```text
tests/
  fixtures/
    smart.fixture.ts            # Typed role selection and context lifecycle
  onemac/
    create-spa.spec.ts          # Explicit creation only; migrate existing spec
  smart/
    intake.spec.ts             # Isolated behavior with prepared starting state
support/
  auth/
    smart-login.ts             # Existing login helper, moved and hardened
    totp.ts                    # Existing TOTP helper
  config/
    environment.ts             # Validated URLs and role credential mapping
  data/
    spa.ts                     # Sequential allocation and persistent handoff
  ui/
    onemac-submission.ts        # Reusable submission actions
    smart/
      navigation.ts            # App Launcher and Medicaid record list
      record-search.ts         # Search for and open the saved SPA ID
      spa-record.ts            # Shared record shell and section composition
      sections/
        details.ts
        attachments.ts
        review.ts
        financial-information.ts
        notes.ts
        adjudication.ts
        field-history.ts
    date-picker.ts             # Existing date helper, moved when used
test-data/
  attachments/                # Approved, synthetic upload fixtures
playwright.config.ts
.env.example                  # Variable names and placeholders only
TASKS.md
```

Keep helpers small and add role-specific UI modules only as repetition appears.
The requested SMART record/section files are typed scaffolds; other proposed
modules should be created only when their behavior is needed.

### SMART Page Objects

The fixture handles login, the saved `spaId`, and page-object construction. Page
objects own reusable locators and UI actions; tests own workflow sequencing and
business assertions. The intake uses:

```ts
test('search for Medicaid SPA', async ({ navigation, recordSearch, spaId }) => {
  await navigation.openMedicaidRecords();
  await recordSearch.openSpa(spaId);
});
```

`SmartNavigation` preserves the recorded App Launcher and record-list steps.
`SmartRecordSearch` preserves the recorded search selectors and result readiness
assertion. `SpaRecord` composes all seven shared sections and is available as the
`spaRecord` fixture. Details, Review, and Notes now contain the captured Intake
actions; the remaining sections are scaffolds. Local quality checks validate
types and test discovery but do not validate these locators against live SMART.

Placement rules for new tests and page-object methods:

- Keep role-specific workflows and business assertions in `tests/smart`.
- Put app-level navigation in `navigation.ts` and SPA lookup in `record-search.ts`.
- Put shared header, workflow status, Edit, and tab-selection behavior in
  `spa-record.ts` as the corresponding locators are captured.
- Put each section's locators and UI actions in its matching `sections` file;
  access it through `spaRecord.details`, `spaRecord.attachments`,
  `spaRecord.review`, `spaRecord.financialInformation`, `spaRecord.notes`,
  `spaRecord.adjudication`, or `spaRecord.fieldHistory`.
- Put reusable dialogs beside their owning section only when needed.

Add UI methods only after the corresponding interactions have been captured;
do not guess locators from screenshots or create placeholder methods that pass.
Avoid copying the same page object for each user role. Authentication and role
selection remain in the fixture, not in page-object methods.

## Phase 1: Structure and Authentication

- [ ] Correct secret ignore rules; ignore environment variants while allowing
  `.env.example`. Protect auth state, traces, screenshots, and generated record
  manifests from accidental publication. Review any previously shared secrets
  and rotate them if exposure is confirmed.
- [ ] Centralize environment loading and fail with missing variable names only,
  never credential values. Move OneMAC credentials and URLs to configuration.
- [x] Define a typed role registry mapping the six current Salesforce accounts;
  validate only credentials needed for the selected workflow.
- [x] Move the existing login and TOTP helpers under `support/auth` and add a
  role-aware fixture. Never overwrite a shared mutable global current user.
- [x] Replace fixed login sleeps and `networkidle` with an authenticated UI
  assertion. The user confirmed intake login and search passed.
- [ ] Handle optional MFA or an existing session based on observed behavior,
  without bypassing authentication.
- [ ] Start with fresh, isolated authenticated contexts per role, always closed
  by fixture teardown. Evaluate per-role storage-state reuse only after verifying
  Salesforce session behavior; auth files are credentials, not test data.
- [ ] Begin with Chromium and one worker for the mutating workflow. Prevent
  concurrent login attempts for the same account, including across projects or
  CI jobs; reusing a still-valid TOTP needs more than an expiry check.
- [ ] Add explicit npm commands for discovery, role-based Salesforce runs, creation,
  and typechecking. Keep live mutation tests out of default CI until credentials
  and the intended target environment are configured.

## Phase 2: Create Once, Reuse Across Salesforce Runs

### SPA ID Rules and Next Work

- [x] Confirm the ID format: `STATE-YY-NNNN`. In `CA-26-0037`, `CA` is the state,
  `26` is the two-digit year, and `0037` is sequence number 37, padded to four
  digits. State is selectable and must not be hardcoded to California.
- [x] Confirm that OneMAC rejects an already-used SPA ID. A candidate generated
  locally is not proof of availability; OneMAC's duplicate validation is needed.
- [x] Confirm allowed states: Alabama (`AL`), California (`CA`), Colorado (`CO`),
  Florida (`FL`), Georgia (`GA`), and Maryland (`MD`). Use an explicitly selected
  state for reproducible runs rather than random selection.
- [x] Implement the generator with configurable state and starting number, using
  the current two-digit calendar year automatically (no `SPA_YEAR` override).
  Increment
  only the numeric suffix (`0037` -> `0038`); never change state or year to resolve
  a collision. Validate inputs and stop at four-digit exhaustion rather than wrap.
- [x] Receive the duplicate-ID screenshot and timing confirmation. Exact message:
  "According to our records, this SPA ID already exists. Please check the SPA ID
  and try entering it again." The message appears beneath the SPA ID input about
  half a second after typing the final digit, without blur or submit.
- [x] Inspect the public OneMAC source: on-entry validation posts the candidate's
  `id` to `/itemExists`, whose response has an `exists` boolean. Match the response
  to the current candidate and wait for its duplicate UI message before advancing.
  Do not infer availability from an immediately absent message or a fixed sleep.
- [ ] Verify that validation contract against the deployed dev application in a
  live run. Source inspection and local mocked tests do not prove deployment parity.
- [x] Add bounded duplicate-ID retry handling using that observed error. On a
  confirmed collision, try the next candidate while retaining other input.
  This is application-level ID selection,
  not a Playwright retry of the entire creation test. Fail clearly at the limit.
- [x] Stop the current selection loop on HTTP failures, malformed validation
  responses, or missing responses. Do not resubmit the package in this helper.
  The already-reserved candidate remains consumed for safety on the next run.
- [x] Add eight focused checks for allowed states/year formatting, zero padding,
  input validation, delayed duplicate progression, exhaustion, retry limits, and
  validation failures using an isolated local browser form.
- [x] Add persistent counter isolation, restart progression, confirmed-record
  handoff, interrupted reservation, duplicate skip, and file-safety checks.
- [ ] Reconcile ambiguous submission outcomes before attempting another submission
  to avoid creating two records.

The generator and UI retry helper are implemented in `support/data/spa.ts` and
wired into the existing OneMAC test. `support/data/spa-store.ts` now persists
candidates and successful submissions; the SMART fixture now consumes the latest
confirmed handoff and intake searches for that ID.
The default seed of 1 is not a claim of availability; the generator probes
`/itemExists` upward from it. Cross-machine sequence ownership remains unconfirmed.

### Record Creation and Handoff

- [ ] Design active-SPA lifecycle management (future work, not implemented).
  Once a new SPA is successfully created, use that same ID across all role tests
  and reruns until the full process ends in approval or disapproval. Do not create
  a replacement merely because a test restarts, fails, or changes users.
- [ ] Persist the active flow's SPA reference separately from "latest submitted"
  selection so another submission or a calendar-year change cannot silently
  switch an unfinished flow to a different record. Resume the active SPA's actual
  business state rather than replaying completed transitions.
- [ ] Confirm the exact SMART terminal statuses for approved and disapproved,
  capture how to read them, and define how completion is verified and persisted.
  Do not treat an intermediate status or test failure as process completion.
- [ ] Gate creation of the next flow's SPA on verified terminal completion of the
  active SPA. Cover initial creation when no active SPA exists, interrupted runs,
  and repeated completion checks without duplicate creation. Decide the trigger
  and orchestration later; current OneMAC creation does not enforce this gate.
- [ ] Confirm the business sequence, actions, and expected state transitions for
  intake, CPOC, SRT, division director, group director, and superuser. Do not infer
  that all accounts participate or that the listed order is correct.
- [ ] Confirm the desired starting sequence and whether ownership is local or
  shared with other users and CI. The old hardcoded `CA-26-0037` is not evidence
  that `CA-26-0038` is available; advance past observed duplicate IDs as above.
- [x] Implement an environment/state/year-scoped local persistent sequence store.
  Reserve the next number under a lock before entry and write atomically. Never silently
  reset the counter or reuse a reserved ID after an ambiguous failure. A local
  counter cannot guarantee uniqueness across machines.
- [ ] Establish shared coordination before enabling concurrent creators across
  machines or CI. An availability check alone cannot prevent submission races.
- [x] Replace manual upload pauses with `setInputFiles()` for the project's CMS
  179 form and SPA pages demo images, targeting their respective file inputs.
- [ ] Verify the automated uploads and successful submission in the live app.
  Move the existing spec into `tests/onemac` and remove inline credentials.
- [x] Persist a typed confirmed submission after the success UI assertions, with
  SPA ID, environment, state, year, and reservation/submission times. Reserved-only
  attempts remain separate from the latest confirmed handoff.
- [ ] Capture a separate application submission identifier if exposed, and add
  Salesforce record ID or URL after ingestion.
- [x] Add a saved-record fixture that reads the latest confirmed submission for
  the selected environment/state/year without triggering OneMAC. Fail clearly
  when absent; never create a record as a hidden fallback. Preserve the store
  without advancing its counter during SMART runs.
- [x] Add a read-only `spa:current` command for manual record lookup. Verify that
  the summary excludes unconfirmed candidates, preserves existing JSON content,
  and does not create a missing store. Both focused local checks passed; the
  workspace currently reports no confirmed `CA` submission for the current year.
- [x] Replace the recorded intake search ID with the fixture's `spaId` and click
  the matching SPA option. Verify repeated read-only selection locally.
- [ ] Verify the saved-ID search and opened form in the live SMART application.
- [ ] Add explicit selection by SPA ID for pinning development to an older record
  when needed. Default selection currently follows the latest confirmed record.
- [ ] Use bounded polling for the exact record's arrival in Salesforce; treat
  ingestion as asynchronous and provide a useful timeout failure.
- [ ] Implement intake and subsequent role tests as separately runnable actions
  against the selected saved record. They may run at different times without
  OneMAC. Add an explicit combined journey only if useful, not as a prerequisite.
- [ ] Assert the record identity and expected state before and after each role's
  actions. Login success and successful clicks alone are insufficient.
- [ ] Define retry, resume, and cleanup policies before enabling retries. Creation
  must not repeat on a Salesforce retry. A saved ID does not reset business state:
  check each action's prerequisites and fail clearly when the record has already
  advanced, rather than blindly replaying a transition.
- [ ] Keep Salesforce role runs independent of the OneMAC config. Do not add a
  project dependency that creates a record every time Salesforce tests run.
- [ ] Keep login readiness assertions in the fixture; add environment checks and focused
  checks for handoff data and TOTP timing where practical.

## Phase 3: GitHub Agent and Playwright MCP Skills

- [x] Confirm project-scoped VS Code/GitHub Copilot custom agent and skills under
  `.github`, with a codegen-like manual capture stage before implementation.
- [x] Configure workspace Playwright MCP in `.vscode/mcp.json` with a pinned
  package, isolated Chrome, and ignored capture output, without credential loading.
  Verify actual MCP initialization, 25-tool discovery, local-page navigation,
  accessibility snapshot, and closure via stdio. No live app was contacted.
- [ ] Start/approve the workspace server in VS Code and verify its tools in the
  authoring chat. Confirm the approved sandbox and authenticate the task's role
  directly in its browser; secure automatic MCP login remains future work.
- [x] Add repository instructions explaining structure, test commands, fixture
  usage, role selection, record handoff, and locator conventions.
- [x] Add `SMART Test Author` with task, capture, implementation, focused-validation,
  local-quality, and separately reported live-validation gates. No delegation or
  assumed MCP server alias is needed.
- [x] Add three skills: `smart-browser-capture`, `salesforce-locators`, and
  `playwright-test-validation`. Cover open/closed/synthetic Shadow DOM, frame
  boundaries, scoped accessible locators, Lightning overlays, and rerendering.
- [x] Require fixture-based authentication and environment references in generated
  tests. Never put passwords, TOTP seeds/codes, session state, or sensitive page
  content into prompts, source, logs, screenshots, or committed artifacts.
- [x] Define task-specific approval boundaries for live saves, submissions,
  workflow transitions, and deletions. Explicitly authorized task actions can be
  captured; generic inspection does not authorize mutations. No production changes.
- [x] Add `npm run quality`: validate customization metadata/links and CI YAML,
  typecheck without emitting, run all local checks, and discover both app suites.
  The complete local gate passed with 20 tests; it did not execute live app tests.
- [x] Add a separate `Automation Quality` CI workflow without credentials or live
  test execution. Existing live CI is unchanged. Editor hooks are not configured;
  see the runtime/enforcement limitations in the usage guide.
- [ ] After publishing, verify the hosted quality workflow and configure its
  `quality` status check as required in branch protection. Local execution alone
  does not prove hosted enforcement or prevent edits to checks.
- [ ] Validate the authoring workflow on one intake interaction, review generated
  assertions, and run it successfully before expanding to other roles.

Usage, setup prerequisites, and a sample task are in
[docs/test-authoring.md](docs/test-authoring.md). The manual capture stage requires
a verified Playwright MCP connection and authenticated sandbox browser; the test
fixture does not automatically authenticate that separate browser session.

## Phase 4: CI and Expansion

- [ ] Configure protected CI secrets and environment selection, same-account run
  coordination, artifact access/retention, and a synthetic-data cleanup policy.
  Add a workflow `concurrency` group on live jobs with `cancel-in-progress: false`.
  Hosted CI uses its own store, so a local run does not share SPA records with CI.
  Local and CI runs still share Salesforce accounts, so the per-account login lock
  must cover both. Self-hosted runners that share a disk with local runs must use
  the same store lock, and their store reads need coordination too.
- [ ] Confirm safe behavior for pull requests without secrets, especially forks;
  do not expose secrets through privileged execution of untrusted PR code.
- [ ] Expand scenarios and browser coverage after the Chromium journey is stable.
  Each independent mutating workflow must own its record and account allocation.

## First Milestone

An explicit creation command reserves the next sequential SPA ID, submits it in
OneMAC, and saves its manifest. A separate Salesforce intake command loads that
same ID, locates it in SMART, and asserts the expected next state. Later role
commands reuse the selected record without rerunning OneMAC. Starting another
record requires an explicit creation request, never an implicit test dependency.