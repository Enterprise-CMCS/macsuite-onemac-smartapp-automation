import { expect } from '@playwright/test';
import { test } from '../../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../../support/data/spa';
import { currentSpaStore } from '../../../../support/data/spa-store';

const cpocName = 'CPOC4 Automation';
const priorityCode = 'P2';
const priorityRationale = 'testing rationale';
const raiQuestions = [
    'What is the projected annual enrollment impact of this SPA?',
    'What data sources support the fiscal projections in this SPA?',
    'How will the state monitor outcomes for the proposed changes?',
    'Are there any changes to eligibility criteria that need clarification?',
    'What is the timeline for implementation and reporting?',
];

// CPOC_SPA_ID targets a specific Pending - First Clock record. Without it, the newest Pending - First Clock SPA is used.
// On success, the store records the SPA as Pending RAI with the RAI dates shown in SMART.
const raiIssuedDate = new Date().toLocaleDateString('en-US');
let targetSpaId: string;
test.beforeAll(async () => {
    targetSpaId = process.env.CPOC_SPA_ID ?? (await (await currentSpaStore(appUrls.onemac, spaOptionsFromEnv())).latestPendingFirstClock()).spaId;
});
// The shared fixture defaults to the newest submitted SPA, which intake has already handed off.
test.use({ spaId: async ({ }, use) => use(targetSpaId) });
test.use({ smartRole: 'CPOC' });

test('CPOC recommends RAI for a Pending - First Clock SPA', async ({ navigation, recordSearch, spaRecord, page, spaStore }) => {
    await navigation.openSmartHome();
    await recordSearch.openSpa(targetSpaId);
    await test.step('Set Priority Code and Priority Code Rationale on the Details tab', async () => {
        await spaRecord.details.updatePriority(priorityCode, priorityRationale);
    });
    await test.step('Mark Initial Submission Complete as Yes in Submission Information', async () => {
        await spaRecord.details.setInitialSubmissionComplete('Yes');
    });
    await test.step('Set CPOC to Recommending RAI, RAI Needed Yes, the RAI questions, and RAI Questions Completed Yes, then save once', async () => {
        await spaRecord.review.recommendRai(cpocName, targetSpaId, raiQuestions);
    });
    await test.step('Verify CPOC is in Recommending RAI in the First Clock review grid', async () => {
        await spaRecord.review.expectReviewTeamProgress(cpocName, 'Recommending RAI', 'first');
    });
    await test.step('Prepare RAI Questions from the Review tab', async () => {
        await spaRecord.review.prepareRaiQuestions();
    });
    let raiDates: { issuedDate: string; expiresDate: string } | undefined;
    await test.step('Set RAI Issued Date on the RAI record and return to the SPA', async () => {
        raiDates = await spaRecord.review.setRaiIssuedDate(raiIssuedDate, targetSpaId);
    });
    await test.step('Verify SPA status is Pending RAI', async () => {
        await expect(page.getByRole('listbox', { name: 'RAI', exact: true }).getByRole('option', { name: 'Pending RAI', exact: true })).toHaveAttribute('aria-selected', 'true');
    });
    await test.step('Verify Days on Clock and Days Remaining are blank in Pending RAI', async () => {
        // Header values are slotted and not in DOM text, so they are matched by rendered position.
        const headerScript = `(labels) => {
            const roots = [];
            const walk = (scope) => {
                for (const el of scope.querySelectorAll('*')) {
                    if (el.shadowRoot) walk(el.shadowRoot);
                    if (el.classList.contains('test-id__output-root')) roots.push(el);
                }
            };
            walk(document);
            const textNodes = [];
            const collect = (node) => {
                const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
                for (let n = walker.nextNode(); n; n = walker.nextNode()) {
                    if (n.textContent && n.textContent.trim()) textNodes.push(n);
                }
                for (const el of node.querySelectorAll('*')) {
                    if (el.shadowRoot) collect(el.shadowRoot);
                }
            };
            collect(document);
            const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
            const result = {};
            for (const label of labels) {
                const root = roots.find((r) => r.checkVisibility() && [...r.querySelectorAll('.test-id__field-label-container')].some((c) => c.textContent.trim() === label));
                const control = root && root.querySelector('.slds-form-element__control');
                if (!control) throw new Error('Visible header field not found: ' + label);
                const box = control.getBoundingClientRect();
                result[label] = textNodes
                    .filter((t) => {
                        const range = document.createRange();
                        range.selectNodeContents(t);
                        const rect = range.getBoundingClientRect();
                        return rect.width > 0 && overlaps(rect, box);
                    })
                    .map((t) => t.textContent.trim())
                    .join(' | ');
            }
            return result;
        }`;
        const headerValues: Record<string, string> = await page.evaluate(`(${headerScript})(${JSON.stringify(['Priority Code', 'Days on Clock', 'Days Remaining'])})`);
        expect(headerValues['Priority Code'], 'positive control: populated header value is read').toMatch(/^P2\b/);
        expect(headerValues['Days on Clock']).toBe('');
        expect(headerValues['Days Remaining']).toBe('');
    });
    await test.step('Record Pending RAI and RAI dates in the store', async () => {
        if (!raiDates) throw new Error('RAI dates were not read from SMART');
        await spaStore.markPendingRai(targetSpaId, raiDates);
    });
});
