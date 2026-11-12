import { test, expect } from '@playwright/test';
import { SmartNavigation } from '../../support/ui/smart/navigation';
import { SmartRecordSearch } from '../../support/ui/smart/record-search';
import { SpaRecord } from '../../support/ui/smart/spa-record';
import { SmartReview } from '../../support/ui/smart/sections/review';
import { SmartNotes } from '../../support/ui/smart/sections/notes';
import { futureDate } from '../../support/data/future-date';
import path from 'node:path';
import { onemacAttachments } from '../../support/data/onemac-attachments';

test('intake attachment waits for completion and clicks modal Done before checking the SMART table', async ({ page }) => {
    await page.setContent(`
        <button role="tab" onclick="document.querySelector('section').hidden = false">Attachments</button>
        <input type="file" name="smartFileUploader" aria-label="Other upload">
        <section aria-label="Files Uploaded in SMART" hidden>
            <input type="file" name="smartFileUploader">
            <p role="status">No files uploaded.</p>
            <table role="grid" aria-label="Files Uploaded in SMART" hidden>
                <tbody><tr><td role="gridcell"><a href="#file">intake-attachment.png</a></td></tr></tbody>
            </table>
        </section>
        <button onclick="document.body.dataset.wrongDone = 'clicked'">Done</button>
        <div class="modal-container" hidden>
            <h1>Upload Files</h1>
            <p class="complete" hidden></p>
            <button disabled>Done</button>
        </div>
        <script>
            const modal = document.querySelector('.modal-container');
            const done = modal.querySelector('button');
            document.querySelector('section input').addEventListener('change', (event) => {
                modal.hidden = false;
                setTimeout(() => {
                    const complete = modal.querySelector('.complete');
                    complete.textContent = 'Upload of ' + event.target.files[0].name + ' complete';
                    complete.hidden = false;
                    done.disabled = false;
                }, 150);
            });
            done.addEventListener('click', () => {
                modal.hidden = true;
                document.querySelector('table').hidden = false;
                document.querySelector('section p').hidden = true;
            });
        </script>
    `);
    const record = new SpaRecord(page);
    await record.attachments.upload(path.resolve(__dirname, '../../support/documents/intake-attachment.png'));
    const files = record.attachments.uploadedFiles.getByRole('grid', { name: 'Files Uploaded in SMART', exact: true });
    await expect(files.getByRole('link', { name: 'intake-attachment.png', exact: true })).toBeVisible();
    await expect(page.locator('.modal-container')).toBeHidden();
    await expect(page.locator('body')).not.toHaveAttribute('data-wrong-done', 'clicked');
    await expect(page.getByLabel('Other upload')).toHaveValue('');
});

test('future dates preserve the day where possible and clamp at month end', () => {
    for (const [today, expected] of [
        [new Date(2026, 9, 22), new Date(2027, 0, 22)],
        [new Date(2026, 10, 30), new Date(2027, 1, 28)],
        [new Date(2027, 10, 30), new Date(2028, 1, 29)],
    ]) {
        const original = today.getTime();
        const target = futureDate(3, today);
        expect(target).toEqual(expected);
        expect(target.getTime()).toBeGreaterThan(today.getTime());
        expect(today.getTime()).toBe(original);
    }
});

for (const initiallySelected of [false, true]) {
    test(`submission summary selects Details and saves all three fields (initially selected: ${initiallySelected})`, async ({ page }) => {
        await page.setContent(`
            <button role="tab" aria-selected="${!initiallySelected}">Attachments</button>
            <button role="tab" aria-selected="${initiallySelected}" onclick="
                document.querySelector('section').hidden = false;
                this.setAttribute('aria-selected', 'true');
                this.dataset.clicked = 'true';">Details</button>
            <section ${initiallySelected ? '' : 'hidden'}>
                <button onclick="document.querySelector('form').hidden = false">Edit Subject</button>
                <form hidden onsubmit="event.preventDefault(); document.querySelector('output').textContent =
                    Array.from(this.elements).filter(element => element.name).map(element => element.value).join('|');
                    this.hidden = true;">
                    <label>Subject<input name="subject"></label>
                    <label>Description<textarea name="description"></textarea></label>
                    <label>Approved Effective Date<input type="text" name="approvedEffectiveDate"
                        onkeydown="if (event.key === 'Enter') { event.preventDefault(); this.dataset.committed = this.value; }"></label>
                    <button type="submit">Save</button>
                </form>
                <output></output>
            </section>
        `);
        const record = new SpaRecord(page);
        await record.details.updateSubmissionSummary('testing', 'testing description', '1/22/2027');
        await expect(page.locator('input[name="approvedEffectiveDate"]')).toHaveAttribute('data-committed', '1/22/2027');
        await expect(page.locator('output')).toHaveText('testing|testing description|1/22/2027');
        await expect(page.getByRole('tab', { name: 'Details', exact: true })).toHaveAttribute('data-clicked', 'true');
    });

    test(`intake completion selects Review and saves only the exact field (initially selected: ${initiallySelected})`, async ({ page }) => {
        await page.setContent(`
            <button role="tab" aria-selected="${!initiallySelected}">Details</button>
            <button role="tab" aria-selected="${initiallySelected}" onclick="
                document.querySelector('section').hidden = false;
                this.setAttribute('aria-selected', 'true');
                this.dataset.clicked = 'true';">Review</button>
            <section ${initiallySelected ? '' : 'hidden'}>
                <button title="Edit Intake Complete" onclick="document.querySelector('form').hidden = false"></button>
                <button title="Edit Intake Complete Date" onclick="document.body.dataset.wrongEdit = 'date'"></button>
                <button title="Edit Intake Completed By" onclick="document.body.dataset.wrongEdit = 'user'"></button>
                <form hidden onsubmit="event.preventDefault();
                    document.querySelector('output').textContent = this.elements.intakeComplete.checked ? 'complete' : 'incomplete';
                    this.hidden = true;">
                    <label>Intake Complete<input type="checkbox" name="intakeComplete"></label>
                    <button type="submit">Save</button>
                </form>
                <output>incomplete</output>
            </section>
        `);
        const record = new SpaRecord(page);
        await expect(page.locator('output')).toHaveText('incomplete');
        await record.details.markIntakeComplete();
        await expect(page.locator('output')).toHaveText('complete');
        await expect(page.locator('form')).toBeHidden();
        await expect(page.locator('body')).not.toHaveAttribute('data-wrong-edit');
        await expect(page.getByRole('tab', { name: 'Review', exact: true })).toHaveAttribute('data-clicked', 'true');
    });
}

for (const correctNewValue of [true, false]) {
    test(`field history verifies the New Value column (correct: ${correctNewValue})`, async ({ page }) => {
        await page.setContent(`
            <button role="tab" onclick="document.querySelector('table').hidden = false">Field History Tracking</button>
            <table role="grid" aria-label="Field history" hidden>
                <thead><tr><th>Field</th><th>Original Value</th><th>New Value</th></tr></thead>
                <tbody>
                <tr><td role="gridcell">Intake Complete Date</td>
                    <td role="gridcell" data-label="New Value">01/23/2027</td></tr>
                <tr><td role="gridcell">Intake Complete</td>
                    <td role="gridcell" data-label="Original Value"></td>
                    <td role="gridcell" data-label="New Value">☑</td></tr>
                <tr><td role="gridcell">Status</td>
                    <td role="gridcell" data-label="Original Value">Intake Needed</td>
                    <td role="gridcell" data-label="New Value">Pending - First Clock</td></tr>
                <tr><td role="gridcell">Alert 3 Day</td>
                    <td role="gridcell" data-label="New Value">75</td></tr>
                <tr><td role="gridcell">Alert 2 Day</td>
                    <td role="gridcell" data-label="New Value">60</td></tr>
                <tr><td role="gridcell">Alert 1 Day</td>
                    <td role="gridcell" data-label="New Value">${correctNewValue ? '45' : '15'}</td></tr>
                <tr><td role="gridcell">Type / Subtype</td>
                    <td role="gridcell" data-label="New Value">Administrative - Authority Change, Electronic Claims, Policy Update</td></tr>
                <tr><td role="gridcell">Description</td>
                    <td role="gridcell" data-label="New Value">testing description</td></tr>
                <tr><td role="gridcell">Subject</td>
                    <td role="gridcell" data-label="New Value">testing</td></tr>
                <tr><td role="gridcell">Created.</td><td role="gridcell">Mulesoft Integration User</td></tr>
            </tbody></table>
        `);
        const record = new SpaRecord(page);
        const verification = record.fieldHistory.verifyIntakeChanges({
            subject: 'testing',
            description: 'testing description',
            typeSubtype: 'Administrative - Authority Change, Electronic Claims, Policy Update',
            alerts: { 'Alert 1 Day': '45', 'Alert 2 Day': '60', 'Alert 3 Day': '75' },
            intakeCompleteDate: '01/23/2027',
        });
        if (correctNewValue) {
            await verification;
        } else {
            await expect(verification).rejects.toThrow(/toHaveText/);
        }
    });
}

for (const initiallyChecked of [false, true]) {
    test(`CPOC assignment selects only CPOC through its label (initially checked: ${initiallyChecked})`, async ({ page }) => {
        page.on('pageerror', (error) => { throw error; });
        await page.setContent(`
            <button role="tab">Review</button>
            <input type="search" aria-label="Search by Name or Email" />
            <table role="grid"><tbody><tr role="row" aria-selected="false">
                <td role="gridcell" onclick="this.parentElement.setAttribute('aria-selected', 'true')">Select Item 1</td>
                <th role="rowheader">CPOC4 Automation</th>
            </tr></tbody></table>
            <button onclick="document.querySelector('[role=dialog]').hidden = false">Assign</button>
            <div role="dialog" aria-label="Assignment Notes" hidden>
                <label>Assignment Notes<textarea></textarea></label>
                <lightning-input data-role="cpoc"></lightning-input>
                <lightning-input data-role="sme"></lightning-input>
                <button onclick="document.querySelector('output').textContent = 'saved'">Save Assignments</button>
            </div>
            <output></output>
            <p hidden>Success notification.</p>
            <script>
            for (const role of ['cpoc', 'sme']) {
                const host = document.querySelector('lightning-input[data-role="' + role + '"]');
                const root = host.attachShadow({ mode: 'open' });
                root.innerHTML = '<style>input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; } label { display: inline-block; padding: 8px; }</style>' +
                    '<input type="checkbox" id="generated-' + role + '" />' +
                    '<label for="generated-' + role + '">' + (role === 'cpoc' ? 'Designate as\\nCPOC' : 'Designate as Consulting SME') + '</label>';
                if (role === 'cpoc') root.querySelector('input').checked = ${initiallyChecked};
            }
            document.querySelector('[role=dialog] button').addEventListener('click', () => {
                document.querySelector('p').hidden = false;
            });
            </script>
        `);
        const review = new SmartReview(page);
        await review.assignCpoc('CPOC4', 'test assignment');
        await expect(page.locator('lightning-input[data-role="cpoc"] input')).toBeChecked();
        await expect(page.locator('lightning-input[data-role="sme"] input')).not.toBeChecked();
        await expect(page.getByRole('textbox', { name: 'Assignment Notes' })).toHaveValue('test assignment');
        await expect(page.locator('output')).toHaveText('saved');
    });
}

test('notes are added in the sidebar composer without opening the Notes tab', async ({ page }) => {
    await page.setContent(`
        <button role="tab" onclick="document.body.dataset.notesTab = 'opened'">Notes</button>
        <flexipage-tab2 role="tabpanel" aria-label="Main Notes">
            <div aria-label="Add new Note" data-panel="main">
                <label>Add Note<textarea aria-label="Add Note"></textarea></label>
                <button disabled>Add Note</button>
            </div>
        </flexipage-tab2>
        <flexipage-component2 slot="sidebar" data-component-id="c_smartCmcsNotes2">
            <div aria-label="Add new Note" data-panel="sidebar">
                <label>Add Note<textarea aria-label="Add Note"></textarea></label>
                <button disabled>Add Note</button>
            </div>
        </flexipage-component2>
        <p role="status" hidden>Note Created</p>
        <script>
        for (const panel of document.querySelectorAll('[aria-label="Add new Note"]')) {
            const textarea = panel.querySelector('textarea');
            const button = panel.querySelector('button');
            textarea.addEventListener('input', () => button.disabled = !textarea.value);
            button.addEventListener('click', () => {
                panel.dataset.saved = textarea.value;
                document.querySelector('[role="status"]').hidden = false;
            });
        }
        </script>
    `);
    const notes = new SmartNotes(page);
    await notes.addNote('intake sidebar note');
    const sidebar = page.locator('flexipage-component2[slot="sidebar"][data-component-id="c_smartCmcsNotes2"]');
    await expect(sidebar.getByRole('textbox', { name: 'Add Note' })).toHaveValue('intake sidebar note');
    await expect(sidebar.locator('[aria-label="Add new Note"]')).toHaveAttribute('data-saved', 'intake sidebar note');
    await expect(page.locator('flexipage-tab2 [aria-label="Add new Note"]')).not.toHaveAttribute('data-saved', 'intake sidebar note');
    await expect(page.locator('body')).not.toHaveAttribute('data-notes-tab', 'opened');
});

test('SPA record composes all shared sections on the same page without navigation', async ({ page }) => {
    const initialUrl = page.url();
    const record = new SpaRecord(page);
    const sections = [
        record.details, record.attachments, record.review, record.financialInformation,
        record.notes, record.adjudication, record.fieldHistory,
    ];
    expect(new Set(sections).size).toBe(7);
    for (const section of sections) {
        expect(section.page).toBe(page);
    }
    expect(record.page).toBe(page);
    expect(page.url()).toBe(initialUrl);
});

test('SMART navigation waits for the SPA menu without opening its dropdown', async ({ page }) => {
    await page.setContent(`
        <button>App Launcher</button>
        <div role="option" tabindex="0" hidden>SMART</div>
        <button hidden>SPAs or Waivers List</button>
        <script>
        const steps = Array.from(document.querySelectorAll('button, [role]'));
        document.body.dataset.actions = '';
        steps.forEach((element, index) => element.addEventListener('click', () => {
            document.body.dataset.actions += element.textContent + '|';
            if (steps[index + 1]) steps[index + 1].hidden = false;
        }));
        </script>
    `);
    const navigation = new SmartNavigation(page);
    await navigation.openSmartHome();
    await expect(navigation.spaWaiversList).toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-actions', 'App Launcher|SMART|');
});

for (const spaId of ['CA-26-0037', 'MD-27-0012']) {
    test(`SMART search opens the requested saved ID ${spaId}`, async ({ page }) => {
        await page.setContent(`
            <button onclick="document.querySelector('input').hidden = false">Search</button>
            <input type="search" aria-label="Search..." hidden />
            <a href="#recent">${spaId}</a>
            <div role="option" tabindex="0" hidden aria-labelledby="result-a-id result-a-kind">
                <div aria-hidden="true">${spaId} SPA or Waiver</div>
                <span id="result-a-id">${spaId}</span><span id="result-a-kind">SPA or Waiver</span>
            </div>
            <div role="option" tabindex="0" hidden aria-labelledby="result-b-id result-b-kind">
                <div aria-hidden="true">${spaId} SPA or Waiver</div>
                <span id="result-b-id">${spaId}</span><span id="result-b-kind">SPA or Waiver</span>
            </div>
            <table role="grid" hidden><tbody><tr><th scope="row"><a data-refid="recordId" title="${spaId}" href="#record">${spaId}</a></th></tr></tbody></table>
            <h1></h1>
            <script>
            document.querySelector('input').addEventListener('input', () => {
                document.querySelectorAll('[role="option"]').forEach((option) => option.hidden = false);
            });
            document.querySelector('input').addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    document.querySelectorAll('[role="option"]').forEach((option) => option.hidden = true);
                    document.querySelector('[role="grid"]').hidden = false;
                }
            });
            document.querySelector('a[data-refid="recordId"]').addEventListener('click', () => document.querySelector('h1').textContent = 'search results record');
            document.querySelector('a[href="#recent"]').addEventListener('click', () => document.querySelector('h1').textContent = 'recent record');
            </script>
        `);
        const recordSearch = new SmartRecordSearch(page);
        await recordSearch.openSpa(spaId);
        await expect(recordSearch.searchInput).toHaveValue(spaId);
        await expect(page.getByRole('heading')).toHaveText('search results record');
    });
}
test('details fields read Salesforce output values scoped to Identifying Information', async ({ page }) => {
    const field = (label: string, value: string, hidden = false) => `
        <div class="slds-form-element test-id__output-root"${hidden ? ' hidden' : ''}>
            <div class="test-id__field-label-container"><span class="test-id__field-label">${label}</span></div>
            <div class="slds-form-element__control">
                <span class="test-id__field-value"><slot name="output"><lightning-formatted-text>${value}</lightning-formatted-text></slot></span>
                <button title="Edit ${label}"><span class="slds-assistive-text">Edit ${label}</span></button>
            </div>
        </div>`;
    await page.setContent(`
        <div role="tablist"><button role="tab" aria-selected="false"
            onclick="this.setAttribute('aria-selected', 'true'); document.querySelector('main').hidden = false">Details</button></div>
        <main hidden>
            <flexipage-field-section2>
                <h3><button aria-expanded="true"><span title="Identifying Information">Identifying Information</span></button></h3>
                ${field('ID', 'GA-26-0047')}${field('State', 'Georgia')}${field('Initial Submission Date', '10/26/2026')}
            </flexipage-field-section2>
            <flexipage-field-section2>
                <h3><button aria-expanded="true"><span title="Dates">Dates</span></button></h3>
                ${field('State Code', 'GA')}${field('Proposed Effective Date', '1/15/2027')}
            </flexipage-field-section2>
            ${field('Proposed Effective Date', '1/1/2000', true)}
        </main>
    `);
    const { details } = new SpaRecord(page);
    await details.open();
    const section = details.identifyingInformation;
    await expect(section).toHaveCount(1);
    await details.expectField('ID', 'GA-26-0047', section);
    await details.expectField('State', 'Georgia', section);
    await details.expectField('Initial Submission Date', '10/26/2026', section);
    await details.expectField('Proposed Effective Date', '1/15/2027');
    await expect(details.fieldValue('Proposed Effective Date', section)).toHaveCount(0);
});

test('OneMAC attachments verification checks every initial-package file and its Additional Information', async ({ page }) => {
    const accordion = (title: string, files: readonly { documentType: string; fileName: string }[], info: string) => `
        <section class="slds-accordion__section slds-is-open">
            <h2><button aria-expanded="true"><span title="${title}">${title}</span></button></h2>
            <div class="slds-accordion__content">
                <table role="grid" aria-label="${title}">
                    <thead><tr><th>Row number</th><th>Document Type</th><th>Attached File</th></tr></thead>
                    <tbody>${files.map(({ documentType, fileName }, index) => `
                        <tr><td role="gridcell"><span aria-hidden="true">${index + 1}</span></td>
                            <td role="gridcell"><div title="${documentType}">${documentType}</div></td>
                            <td role="gridcell"><a href="#" aria-label="${fileName}">${fileName}</a></td></tr>`).join('')}
                    </tbody>
                </table>
                <div class="docs-additional-info"><p>Additional Information</p><p class="docs-additional-info__text">${info}</p></div>
            </div>
        </section>`;
    await page.setContent(`
        <div role="tablist"><button role="tab" aria-selected="false"
            onclick="this.setAttribute('aria-selected', 'true'); document.querySelector('main').hidden = false">Attachments</button></div>
        <main hidden>
            <section aria-label="OneMAC Attachments">
                <div role="button" aria-expanded="true"><h2>OneMAC Attachments</h2></div>
                ${accordion('Initial Package Submitted By George Harrison - Mon, Oct 26, 2026, 8:23:09 AM CDT', onemacAttachments, 'this is a test')}
                ${accordion('RAI Response Submitted By George Harrison - Tue, Oct 27, 2026', [{ documentType: 'Other', fileName: 'other.png' }], 'later response')}
            </section>
            <section aria-label="Files Uploaded in SMART">
                <table role="grid" aria-label="Files Uploaded in SMART"><tbody><tr><td role="gridcell">CMS-179 Form</td></tr></tbody></table>
            </section>
        </main>
    `);
    const { attachments } = new SpaRecord(page);
    await attachments.verifyOnemacSubmission(onemacAttachments, 'this is a test');

    await page.locator('a[aria-label="SFQs.png"]').evaluate((link) => link.closest('tr')?.remove());
    await expect(attachments.verifyOnemacSubmission(onemacAttachments, 'this is a test')).rejects.toThrow();
});
