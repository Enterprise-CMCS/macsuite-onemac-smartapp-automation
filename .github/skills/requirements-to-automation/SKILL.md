---
name: requirements-to-automation
description: "Use when turning a Jira ticket, requirement, or manual test steps into SMART or OneMAC Playwright automation: explore the app manually, reuse existing page objects, write the spec, run it, verify, and update skills when a new pattern is found."
---

# Requirements to Automation

This skill chains the other skills in order. Load them as needed:
`smart-browser-capture` for exploration, `salesforce-locators` for locators,
`playwright-test-validation` for gates and reporting.

## 1. Read the Requirement

Write down the role, starting state, actions, and expected outcome. If any of
these is missing or ambiguous, ask the user before exploring. For a new flow
with several scenarios, follow `test-planning` first and get the plan approved
before writing any spec.

## 2. Scan Existing Code for Reuse

Before any browser work, search for what already exists:

- `support/ui/smart` and `support/ui/onemac` for navigation, record search,
  record shell, section, and dashboard methods.
- `tests/smart` and `tests/onemac` for similar flows and assertions.
- `support/fixtures/smart.fixture.ts` for role login and `spaId` handling.

Reuse existing page objects and methods. Add a new method only when none fits,
and place it in the matching owner file. Record what you reused and what is new.

## 3. Explore Manually

Follow `smart-browser-capture`. Use Playwright MCP to perform the steps as the
user would, and record the accessible role/name, section, frame or shadow
boundary, and the readiness signal for each element. Do not infer selectors from
screenshots alone.

If exploration stops or the MCP server is not connected, report that and ask
the user for codegen output or for the missing access. Do not guess the rest.

## 4. Ask Before Any Live Run

Live runs in nonproduction can create or change records. Before any live run,
ask the user for explicit authorization that names:

- the spec and role,
- the SPA or record to use,
- the actions allowed (for example, submit, approve, or withdraw).

Read-only checks still need the role and record confirmed, but do not need a
mutation authorization. A previous authorization does not carry over to a new
ticket.

## 5. Write the Automation

- Use the fixture for login and `spaId`. Do not duplicate login.
- Put locators in the owning page object. Keep business assertions in the spec.
- Assert the business state (status, field values, ID), not only clicks.
- Attach a screenshot for every validated status, as the existing OneMAC tests do.

## 6. Quality Gates and Retries

1. Run `npx tsc --noEmit -p tsconfig.json` after each substantive edit. Fix
   errors and rerun. Stop after 3 failed attempts on the same error and ask.
2. Run the smallest local check: `--list` discovery for the spec.
3. Read-only live checks: if a run fails on a timeout or a locator, diagnose from
   the error context or trace, fix the locator or wait, and rerun. Allow up to 2
   reruns. If the test passes only on a rerun, report it as flaky.
4. Mutating live tests: do not retry automatically. Report the failure with the
   failing step, and ask before running again. Do not create replacement records
   to get a green run. A record that was already created is part of the report.
5. Run `npm run quality` before reporting as complete.

## 7. Verify and Report

Report separately: local gates (typecheck, discovery), live results per test,
the SPA IDs used or created, and attachments. Never call discovery a live pass.

## 8. Update Skills When Needed

If this task surfaced a pattern that a skill should cover (a new wait, a locator
trap, a new state in the SPA lifecycle), update the matching `SKILL.md` and say
so in the report. Do not edit skills for one-off app quirks.
