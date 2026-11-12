---
name: test-planning
description: "Use when planning SMART or OneMAC test coverage before automation: explore a flow with Playwright MCP, list scenarios with steps, expected outcomes, and negative cases, and save the plan as Markdown for review. Use before requirements-to-automation writes any spec."
---

# Test Planning

Use this skill to produce a reviewable plan before automation. It does not
write specs. Hand the approved plan to `requirements-to-automation`.

## 1. Set the Scope

Confirm the role, starting state (the SPA, record, or status the flow needs),
and the flow or ticket to cover. Ask the user if any of these is unclear.

## 2. Explore the Flow

Follow `smart-browser-capture` and `salesforce-locators`. Walk the flow with
Playwright MCP and note each page, section, and interactive element. Do not
take screenshots unless the accessible names or states are unclear from the
snapshot.

Explore only in the confirmed role and record. Exploration that submits,
approves, disapproves, withdraws, or deletes is a live mutation. Do not do it
without the authorization described in `requirements-to-automation`.

## 3. Write the Scenarios

Each scenario includes:

- A clear title that names the outcome.
- Numbered steps, specific enough for a tester to follow.
- The expected outcome for each step that changes state, such as a status or
  field value.
- Starting state, stated as a dependency on earlier steps or the store, not as
  a blank slate. Scenarios in these suites depend on the local SPA store and
  run in sequence.
- Negative and validation cases, such as an empty required field or a rejected
  transition.
- Success and failure conditions.

Do not include steps that replay a completed transition to prove it works again.

## 4. Save the Plan

Save the plan as a Markdown file in the location the user confirms. Use headings
for scenarios and numbered steps. Keep the plan separate from specs and do not
add a new `specs/` folder without confirmation.

## 5. Hand Off

Report the scenarios, the state each one depends on, and which steps are
read-only versus mutating. Mark which scenarios need live authorization before
automation. Ask the user to approve the plan before writing automation.

## Out of Scope

- Writing `tests/` files or page objects. Use `requirements-to-automation`.
- Healing or changing assertions in existing tests.
- Setting up or changing Playwright agent definitions.
