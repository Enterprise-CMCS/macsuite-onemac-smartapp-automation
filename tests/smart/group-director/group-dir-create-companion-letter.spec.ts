import { test } from '../../../support/fixtures/smart.fixture';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { createCompanionLetterStore } from '../../../support/data/companion-letter-store';
import { currentSpaStore } from '../../../support/data/spa-store';
import { CompanionLetterRecord } from '../../../support/ui/smart/sections/companion-letter';

function thirtyDaysFromToday(): string {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

// RECORD_SPA_ID targets a specific record. Without it, the newest SPA awaiting the Group Director must be in Pending - Concurrence.
let targetSpaId: string;
test.beforeAll(async () => {
    const store = await currentSpaStore(appUrls.onemac, spaOptionsFromEnv());
    const record = process.env.RECORD_SPA_ID ? await store.find(process.env.RECORD_SPA_ID) : await store.latestAwaitingGroupDirector();
    if (record.smartStatus !== 'pending_concurrence') {
        throw new Error(`${record.spaId} is in ${record.smartStatus}, not Pending - Concurrence. Refusing to create a companion letter.`);
    }
    targetSpaId = record.spaId;
});
test.use({ smartRole: 'GROUPDIR', spaId: async ({ }, use) => use(targetSpaId) });

test('Creates a companion letter: Group Director requests a companion letter on a Pending - Concurrence SPA', async ({ page, navigation, recordSearch, spaRecord }) => {
    await navigation.openSmartHome();
    await recordSearch.openSpa(targetSpaId);
    await test.step('Open the Adjudication tab', async () => {
        await spaRecord.adjudication.open();
    });
    const store = createCompanionLetterStore(appUrls.onemac);
    const existing = await store.find(targetSpaId);
    const letter = await test.step(existing ? 'Reuse the companion letter already recorded for this SPA' : 'Check Companion Letter Needed and save; the letter appears in the related list', async () => {
        return existing ?? spaRecord.companionLetter.requestLetter(targetSpaId);
    });
    await test.step('Save the companion letter for the CPOC to find under Oversight and Monitoring', async () => {
        await store.record({ spaId: targetSpaId, letterName: letter.letterName, recordId: letter.recordId, createdByRole: existing?.createdByRole ?? 'group_director' });
    });
    await test.step('Fill in the letter Details so the CPOC can set milestones', async () => {
        const letterRecord = new CompanionLetterRecord(page);
        await letterRecord.openById(letter.letterName, letter.recordId);
        await letterRecord.setDetails({
            subject: 'Companion letter automation test',
            description: 'Automated test companion letter created for SMART companion letter workflow validation.',
            responseDueDate: thirtyDaysFromToday(),
        });
    });
});
