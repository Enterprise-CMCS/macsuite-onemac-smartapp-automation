---
name: playwright-test-validation
description: "Use when creating, extending, reviewing, or fixing SMART and OneMAC Playwright specs, fixtures, or page objects; apply quality gates, focused local checks, safe discovery, and truthful live-validation reporting."
---

# Validate Playwright Changes

## Before Editing

Read the nearest spec, fixture, and owning page object. State one local behavior
hypothesis and a cheap check that could disprove it. Confirm the role, record
preconditions, expected outcome, and authorization for any live mutation. Keep
changes small; do not refactor unrelated captured locators or bypass failing gates.

## Required Gates

1. After the first substantive edit, run the smallest affected local check before
   widening scope. Repair local failures and rerun that same check.
2. Run `npm run quality`: customization metadata validation, TypeScript no-emit
   checking, all local helper/POM checks, and SMART/OneMAC discovery. These commands
   do not log in or submit records. They are not substitutes for live validation.
3. Run the changed spec against the approved sandbox only if authorized and its
   initial business state still exists. Read-only local discovery example:
   `SF_ROLE=INTAKE npx playwright test tests/smart/intake/intake.spec.ts --project=chromium --list`.
   Removing `--list` makes it a live run; `--headed` is optional visibility, not
   an authorization or safety boundary.
4. Do not automatically retry mutating live tests, run them with `--repeat-each`,
   reset record state, or create replacement SPAs to obtain a green result.
5. Assert identity and meaningful before/after state, not only clicks or UI
   presence. Keep authenticated contexts isolated. Do not hardcode SPA IDs or
   duplicate login; consume the existing fixture's `spaId` and role behavior.
6. Inspect diff/diagnostics for accidental `.env` or auth-state changes, sensitive
   capture files, focused/skipped tests, swallowed failures, and guessed locators.
   Do not print secret-bearing file contents to perform this review.

## Commands

- `npm run typecheck`: TypeScript validation without emitted JS.
- `npm run test:unit -- smart.spec.ts`: local POM checks, no live SMART access.
- `npm run test:unit -- spa.spec.ts`: local SPA/store checks using temporary data.
- `npm run quality`: the automated local gate; also run by the quality CI job.
- `npm run spa:current`: optional read-only lookup, not test preparation.

## Completion Contract

Report commands, outcomes, selected role/SPA, implemented assertions, and live
verification separately. If MCP/authentication, permissions, ingestion, record
state, or sandbox access blocks a live run, say exactly what is unverified and
what is needed next. Never describe discovery or mock tests as a live pass.
The custom agent follows this process; CI enforces only the executable local
checks. Neither proves locator evidence, permissions, or business correctness.