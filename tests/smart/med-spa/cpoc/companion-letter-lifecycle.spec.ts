import path from 'node:path';
import { expect, test } from '../../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../../support/data/spa';
import { createCompanionLetterStore } from '../../../../support/data/companion-letter-store';
import { createSpaRecordStore, currentSpaStore } from '../../../../support/data/spa-store';
import { CompanionLetterRecord } from '../../../../support/ui/smart/sections/companion-letter';
import { SmartFieldHistory } from '../../../../support/ui/smart/sections/field-history';

// RECORD_SPA_ID targets a specific letter. Without it, the newest SPA awaiting the Group Director is used.
let targetSpaId: string;
let savedLetter: { letterName: string; recordId: string };
test.beforeAll(async () => {
    // An explicit SPA ID uses SPA_STATE and year. The latest-submission pointer can point at another state.
    const record = process.env.RECORD_SPA_ID
        ? await createSpaRecordStore(appUrls.onemac, spaOptionsFromEnv()).find(process.env.RECORD_SPA_ID)
        : await (await currentSpaStore(appUrls.onemac, spaOptionsFromEnv())).latestAwaitingGroupDirector();
    const letter = await createCompanionLetterStore(appUrls.onemac).find(record.spaId);
    if (!letter) {
        throw new Error(`${record.spaId} has no companion letter in the store. Create one first.`);
    }
    targetSpaId = record.spaId;
    savedLetter = letter;
});
test.use({ smartRole: 'CPOC', spaId: async ({ }, use) => use(targetSpaId) });

test('CPOC works the companion letter: sets milestones, opens and closes issues, and reopens the letter with a new issue', async ({ page, navigation }) => {
    const letter = new CompanionLetterRecord(page);
    const closedDate = new Date().toLocaleDateString('en-US');
    const issues = [1, 2, 3].map((n) => `Automation issue ${n}`);
    const [first, second, third] = issues;

    await navigation.openSmartHome();
    await test.step('Open the stored letter from Oversight and Monitoring', async () => {
        await letter.openFromOversight(savedLetter.letterName, savedLetter.recordId);
        expect(await letter.status()).toBe('Draft');
    });
    await test.step('Confirm the Group Director filled in Details', async () => {
        expect(await letter.detailValue('Subject')).not.toBe('');
        expect(await letter.detailValue('Description')).not.toBe('');
        expect(await letter.detailValue('Response Due Date')).not.toBe('');
    });
    await test.step('Stop if the lifecycle already ran on this letter', async () => {
        expect(await letter.issueCount(), 'Letter already has issues; a re-run would duplicate them.').toBe(0);
    });
    await test.step('Set milestones 45, 60, and 75 once, before closing issues', async () => {
        await letter.setMilestones({ 'Alert 1 Day': '45', 'Alert 2 Day': '60', 'Alert 3 Day': '75' });
    });
    await test.step('Create two issues; the letter moves to Open', async () => {
        for (const [index, name] of [first, second].entries()) {
            await letter.createIssue(name, `Citation for ${name}`);
            expect(await letter.issueCount()).toBe(index + 1);
        }
        expect(await letter.status()).toBe('Open');
    });
    await test.step('Close the first issue; the letter stays Open while the second is open', async () => {
        await letter.setIssueStatus(first, 'Closed', closedDate);
        expect(await letter.status()).toBe('Open');
    });
    await test.step('Close the second issue; the letter moves to Closed', async () => {
        await letter.setIssueStatus(second, 'Closed', closedDate);
        expect(await letter.status()).toBe('Closed');
    });
    await test.step('Create a third issue; the letter moves back to Open', async () => {
        await letter.createIssue(third, `Citation for ${third}`);
        expect(await letter.issueCount()).toBe(3);
        expect(await letter.status()).toBe('Open');
    });
    await test.step('Close the third issue; the letter moves to Closed', async () => {
        await letter.setIssueStatus(third, 'Closed', closedDate);
        expect(await letter.status()).toBe('Closed');
    });
    await test.step('Issue history shows the CPOC closed the issue and set its Closed Date', async () => {
        const history = new SmartFieldHistory(page);
        await history.open();
        await history.expectLatestIssueChange(third, 'Issue Status', { original: 'Open', newValue: 'Closed', user: /^CPOC/ });
        await history.expectLatestIssueChange(third, 'Closed Date', { newValue: closedDate, user: /^CPOC/ });
    });
    await test.step('Upload a file to the companion letter', async () => {
        await letter.uploadFile(path.resolve(__dirname, '../../../support/documents/upload/Cover Letter.png'));
    });
    await test.step('Add a Monitoring Action Note', async () => {
        await letter.addNote(`Automation note ${closedDate}`);
    });
});
