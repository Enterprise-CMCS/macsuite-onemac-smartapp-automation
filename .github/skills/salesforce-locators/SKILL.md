---
name: salesforce-locators
description: "Use when creating or debugging Playwright locators in Salesforce SMART Lightning, LWC or Aura components, Shadow DOM, repeated Save/Edit controls, dialogs, tabs, lookups, comboboxes, or iframe boundaries."
---

# Salesforce Locator Discipline

## Inspect First

Use the current accessibility snapshot or inspected DOM, not a screenshot alone.
Determine the actual role, accessible name, containing dialog/tab panel, and frame
boundary. Lightning implementations can use native shadow roots, synthetic
shadow, or light DOM; do not assume all components have the same structure.

## Selectors

1. Prefer `getByRole` with the observed accessible name and `exact: true` where
   appropriate, then associated labels or stable application test IDs. Use text
   for meaningful noninteractive content and placeholders only where appropriate.
2. Scope repeated controls to the observed active dialog, tab panel, row, or
   section. A portal-rendered lookup menu may be outside its input's container;
   inspect the active overlay and choose the exact saved SPA option there.
3. Verify `await expect(locator).toHaveCount(1)` before a newly authored action
   where uniqueness is in doubt. Resolve strict-mode failures by scope, not by
   adding `.first()` or `.nth()` without a demonstrated positional contract.
4. Avoid generated Salesforce IDs, framework internals, hashed CSS classes,
   deeply nested CSS, and XPath. A stable observed attribute is a fallback only
   when accessible locators are insufficient; explain the evidence/tradeoff.

## Shadow DOM and Frames

- Playwright role/text/label/test-ID and CSS locators generally pierce open shadow
  roots automatically. Do not add Selenium-style shadow-root traversal helpers.
- XPath does not pierce shadow roots. Closed shadow roots are unsupported by
  normal Playwright locator traversal. If a control is inaccessible, report the
  limitation and seek a supported host interaction or application test contract;
  do not patch `attachShadow`, bypass Lightning security, or claim it is covered.
- An iframe is not a shadow root. Use `frameLocator` with an observed stable frame
  selector, then locate inside it. Do not try to cross it with plain CSS.
- Use locators rather than cached ElementHandles so rerendering resolves fresh
  elements. JavaScript `document.querySelector` does not have Playwright's shadow
  piercing behavior and must not become the default interaction mechanism.

## Timing and Outcome

Use web-first assertions and Playwright actionability. Use `fill`, `check`, or
`selectOption` only for controls whose actual semantics support those operations;
custom Lightning comboboxes often require click plus selection of an observed
option. Re-snapshot after an overlay or tab change. Replace fixed sleeps and
`networkidle` assumptions with a meaningful UI state or correlated response.
Avoid `force: true`, coordinate clicks, synthetic events, and swallowed exceptions
as stability fixes. They can hide real permission or interaction failures.

Observe both record identity and the expected persisted outcome. Clicking Save
or seeing a toast alone is not always proof of the required business state.

## References

- [Playwright Shadow DOM](https://playwright.dev/docs/locators#locate-in-shadow-dom)
- [Playwright locator strictness](https://playwright.dev/docs/locators#strictness)
- [Playwright frames](https://playwright.dev/docs/frames)