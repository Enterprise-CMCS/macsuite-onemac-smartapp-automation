import path from 'node:path';
import { test } from '../../../support/fixtures/onemac.fixture';
import { appUrls } from '../../../support/config/urls';
import { requiredSpaOptionsFromEnv } from '../../../support/data/spa';
import { createSpaRecordStore } from '../../../support/data/spa-store';
import { OneMacRespondToRai } from '../../../support/ui/onemac/respond-to-rai';
import { OneMacPackageDetails } from '../../../support/ui/onemac/package-details';
import { OneMacDashboard } from '../../../support/ui/onemac/dashboard';
import { raiResponseFiles } from '../../../support/data/onemac-attachments';

// Submits a formal RAI response for an existing OneMAC package.
// Required: SPA_STATE (no default). SPA_STATE must match the state of the RAI-issued SPA.
// RAI_SPA_ID targets a specific RAI-issued SPA; without it, the newest Pending RAI SPA is used.
// RAI_LETTER_PATH is optional and defaults to the file in support/documents/upload named by raiResponseFiles.letter.
let targetSpaId: string;
// Evaluated at file load so a missing SPA_STATE fails before the fixture logs in.
const spaOptions = requiredSpaOptionsFromEnv();
test.beforeAll(async () => {
    targetSpaId = process.env.RAI_SPA_ID ?? (await createSpaRecordStore(appUrls.onemac, spaOptions).latestPendingRai()).spaId;
});

// OneMAC shows the formal response date as "Wed, Nov 4 2026, 09:49:04 AM EST"; the store keeps the M/D/YYYY form.
function toSpaDate(displayed: string): string {
    const match = /([A-Za-z]{3} \d{1,2} \d{4})/.exec(displayed);
    if (!match) throw new Error(`Unrecognized formal RAI response date shown in OneMAC: ${displayed}`);
    return new Date(match[1]).toLocaleDateString('en-US');
}

test('OneMAC responds to a formal RAI', async ({ page }, testInfo) => {
    const spaId = targetSpaId;
    const letterPath = process.env.RAI_LETTER_PATH ?? path.resolve(__dirname, '../../../support/documents/upload', raiResponseFiles.letter);
    const additionalInformation = process.env.RAI_ADDITIONAL_INFORMATION ?? 'testing additional information';

    await new OneMacRespondToRai(page).submit(spaId, letterPath, additionalInformation);

    const details = new OneMacPackageDetails(page);
    await details.open(spaId);
    const formalResponseDate = toSpaDate(await details.readDetail('Formal RAI Response Date'));
    await createSpaRecordStore(appUrls.onemac, spaOptions).markFormalRaiResponse(spaId, formalResponseDate);

    await testInfo.attach(`onemac-rai-response-${spaId}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
    });
    const shown = await new OneMacDashboard(page).expectPackageStatus(spaId, ['Submitted', 'Under Review'], testInfo);
    await createSpaRecordStore(appUrls.onemac, spaOptions).markOnemacStatus(spaId, shown === 'Under Review' ? 'under_review' : 'submitted');
});
