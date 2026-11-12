# SMART Test Authoring

## What Is Configured

- **SMART Test Author** in `.github/agents/smart-test-author.agent.md` defines the
  task-to-capture-to-implementation-to-validation process.
- Three project skills cover browser capture, Salesforce locators, and validation.
- `.vscode/mcp.json` configures workspace server `playwright` using pinned
  `@playwright/mcp@0.0.83`, Chrome, an isolated session, and ignored capture output.
  No credentials or `.env` loading are included in the server configuration.
- `.github/copilot-instructions.md` applies the fixture, page-object, record, and
  credential conventions to general coding work too.
- `npm run quality` runs metadata checks, TypeScript without emitted files, all
  local tests, and SMART/OneMAC discovery. It never signs in or submits a record.
- The `Automation Quality` GitHub workflow runs that command on pushes to
  main/master and pull requests. Once published, make its `quality` check required
  in repository branch protection to block merging on failure. Hosted CI execution
  and branch protection have not been verified from this local workspace.

## Run Tests

Run one SMART test as a selected role:

```sh
SF_ROLE=INTAKE npx playwright test tests/smart/intake/intake.spec.ts --project=chromium --headed
SF_ROLE=CPOC npx playwright test tests/smart/intake/intake.spec.ts --project=chromium --headed
```

The SMART fixture loads the latest confirmed SPA ID automatically. Change
`SF_ROLE` to `SRT`, `DIVDIR`, `GROUPDIR`, or `SUPERUSR` to select another account.
Append `--list` to either command to check discovery without logging in.

The SMART fixture handles role-based login for each test. Playwright's built-in
test-scoped browser context is closed automatically after each test, including
failed tests, so cookies and browser storage are not shared with the next role.
There is no explicit UI logout hook. Context cleanup provides browser isolation,
not server-side session invalidation; add logout only when that is a specific
requirement.

SMART tracing is disabled in the project config and started by the fixture after
login, so the password and TOTP code are not recorded. OneMAC does the same in
its spec and reads its login from `ONEMAC_USERNAME` and `ONEMAC_PASSWORD`.
The trace is still
attached as `trace` in the HTML report. Traces still contain the authenticated
session's cookies and record data, so keep `test-results/` and
`playwright-report/` private. If login fails, no trace is produced; use the
error context instead.

SMART's Chromium project uses a 1920 x 1080 viewport to give the SPA record tabs,
including Field History Tracking, more room before they overflow into More.

The intake spec opens Subject editing once to save Subject, Description, and
Approved Effective Date together in Submission Summary. It uses the OneMAC
helper's shared three-month-ahead date calculation (clamped to the target month's
last day), fills SMART's labeled date input in `M/D/YYYY` format, and presses Enter
to commit it before saving. Its named
history step checks the same date and text values in the **New Value** column,
plus the OneMAC creation row attributed to Mulesoft Integration User. Next, the
attachment step opens Attachments and uploads the root-level
`intake-attachment.png` through the file input in Files Uploaded in SMART,
waiting for the file-specific upload-complete message in the Upload Files modal
and clicking its Done button. The spec then checks the exact filename link in
the Files Uploaded in SMART grid before CPOC/SRT assignment. The supplied modal
markup has no dialog role, so the helper scopes its controls to the observed
modal container containing the Upload Files heading. Live persistence still
requires sandbox verification. These
actions require a saved SPA in the initial intake state; local helper checks do
not establish live SMART permissions or persistence.

API discovery (read-only) records which HTTP endpoints load the saved SPA record.
It opens the record and writes a redacted inventory to
`playwright/.capture/api-discovery-<spaId>.json`. The file keeps hosts, paths,
status codes, Aura action names, and response key shapes only. It omits cookies,
headers, tokens, and values:

```sh
SF_ROLE=INTAKE npx playwright test tests/smart/discovery/api-discovery.spec.ts --project=chromium --headed
```

Create a new OneMAC SPA explicitly:

```sh
SPA_STATE=CA npx playwright test --config=playwright.onemac.config.ts --project=chromium --headed
```

OneMAC creation submits a record. Run that command only when you intend to create
one. Append `--list` to check discovery without logging in or submitting. Omit
`--headed` only when intentionally running the live workflow headlessly.

Inspect the latest confirmed record without opening an app:

```sh
npm run spa:current
```

Editor Stop hooks are not configured. Hook schemas and runtime behavior vary
between Copilot/Local/other harnesses; do not assume a file or successful agent
response proves hook execution. The portable local command and CI job are the
initial automated gates. The agent's evidence and live-authorization gates are
instructions, not a security sandbox or automatic proof of business correctness.
The existing `Playwright Tests` workflow is unchanged and separate from this new
quality job; live CI secrets, lifecycle, and scheduling are still pending.

## Connect the Browser

1. Open the project's `.vscode/mcp.json`, review the `playwright` server, and use
  **Start** above its entry or **MCP: List Servers > playwright > Start**.
  Approve workspace trust and tool access only after reviewing the configuration.
  Reuse this server rather than adding a duplicate global installation.
2. The server uses installed Chrome (a Chromium-based browser), independently of
  the Playwright Test projects named `chromium`. It does not use your normal
  browser profile. Captures resolve under the workspace's `playwright/.capture`.
  See the [VS Code setup guide](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
  if the server is not discovered by your installed harness.
3. A real stdio smoke check has verified MCP initialization, discovery of 25 tools,
  Chrome navigation to an in-memory test page, an accessibility snapshot, and
  browser closure. No app was contacted. This proves the configured server works
  locally, not that this chat has acquired its tools. In the editor session,
  enable its tools for **SMART Test Author** and verify a low-impact request with
  an actual tool from that server. Inspect available tool names; this pinned
  server did not expose `browser_run_code` in the default tool set.
4. Authenticate directly in that browser as the task's role, without placing
   credentials in chat or browser-tool arguments. The Playwright test fixture
   authenticates test-runner contexts, not an arbitrary MCP browser. A secure local
   MCP login integration can be added later; it is not currently wired up.
5. The configured isolated session loses authentication when closed. Do not
   silently reuse a different role's browser profile. Local scratch captures go
   under ignored `playwright/.capture` and must exclude secrets/sensitive data.

## Start a Task

Select **SMART Test Author** in the chat agent picker. If it does not appear,
check workspace trust and your installed Copilot custom-agent support. Skills
can be selected from the slash menu where supported, and the agent explicitly
loads the matching skill files. Example task:

```text
As INTAKE, use the saved confirmed CA SPA in the configured sandbox.
Capture opening the record and the Details section using Playwright MCP.
Inspect only; do not save or change workflow status.
Then add the observed locators/actions to the existing page objects and add a
test that asserts the captured field state. Run the local quality gate.
Report live validation separately from local checks.
```

For mutation tasks, specify the exact allowed change and expected final state,
for example a named Details save or a specific workflow transition. This bounds
the manual walkthrough and later test run; a generic inspection request is not
permission to approve, disapprove, delete, or submit anything. If capture consumes
the transition, agree on another valid starting state before rerunning the test.

## File Placement

Each tab-dependent page-object action selects its owning tab before interacting,
even when that tab is already selected. Submission Summary opens Details; intake
completion and assignments open Review; attachment uploads open Attachments; and
history verification opens Field History Tracking. Do not depend on a previous
workflow step leaving the correct tab active. Sidebar notes are independent of
the record tabs and do not open the Notes tab.

- `tests/smart`: role workflows and business assertions, importing the SMART
  fixture from `support/fixtures/smart.fixture.ts`.
- `support/ui/smart/navigation.ts`: shared app/list navigation.
- `support/ui/smart/record-search.ts`: shared saved-SPA lookup.
- `support/ui/smart/spa-record.ts`: record shell, status, Edit, and tabs as captured.
- `support/ui/smart/sections`: section-specific locators/actions in the matching
  details, attachments, review, financial-information, notes, adjudication, or
  field-history file. The captured Intake flow currently has Details, Review,
  and Notes actions; other sections remain scaffolds. These actions are not yet
  live-verified, so do not claim UI coverage just because a method exists.

The Intake test uses the intake fixture/login to edit the Subject, assign CPOC
and SRT, add a note, and mark Intake Complete before asserting Pending - First
Clock. Later CPOC and SRT tests will use their own role logins against the same
saved record; do not fold those users' actions into the Intake session.
The final intake check requires the exact Pending - First Clock path option to
be visible and have `aria-selected="true"`; visibility alone does not establish
the selected status for CPOC handoff.

All roles share these objects. `SF_ROLE` selects the account. Do not hardcode a
SPA ID, duplicate login, or create a fresh SPA as a hidden fallback. Active-SPA
reuse until terminal approval/disapproval is planned in `TASKS.md`, not enforced
by current OneMAC creation or the latest-confirmed-record lookup.

## Validation and Reporting

Run the focused check for the change, then `npm run quality`. New code must not
weaken assertions, silently skip failures, or replace evidence with guessed
selectors to pass. Playwright locators already cross open shadow roots; XPath
does not. Use the Salesforce locator skill for repeated controls, overlays,
frames, closed roots, and Lightning rerendering.

Run the changed live spec only within the task's authorization and initial state.
Report the role and SPA ID, captured actions/outcomes, files changed, commands and
results, and what is still unverified. A green local gate or successful discovery
is never a live Salesforce pass. CI uses the same distinction.