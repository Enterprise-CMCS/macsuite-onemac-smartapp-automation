import { test } from '../../../support/fixtures/smart.fixture';

test.use({ smartRole: 'INTAKE' });

// Two users share the name "SRT5 JohnSRT"; the row with the SME email is selected.
const smeSearchText = 'SRT5 JohnSRT';
const smeEmail = 'macproemailnotification@gmail.com';
const assignmentNotes = 'assign SRT (SME) after RAI response';

test('Intake assigns SRT (SME) after the RAI response and designates them as Consulting SME', async ({ navigation, recordSearch, spaId, spaRecord }) => {
    await navigation.openSmartHome();
    await recordSearch.openSpa(spaId);
    await test.step('Assign the SRT (SME) on the Review tab as a Consulting SME', async () => {
        await spaRecord.review.assignSrt(smeSearchText, assignmentNotes, 'sme', smeEmail);
    });
});
