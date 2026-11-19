import { test, expect } from '../../../support/fixtures/smart.fixture';
import { eachSpa } from '../../../support/ui/smart/each-spa';
import { futureDate } from '../../../support/data/future-date';
import { toSmartDate } from '../../../support/data/onemac-dates';
import { onemacAttachments } from '../../../support/data/onemac-attachments';
import { appUrls } from '../../../support/config/urls';
import { spaOptionsFromEnv } from '../../../support/data/spa';
import { currentSpaStore } from '../../../support/data/spa-store';
import path from 'node:path';

// The Intake Needed workflow is the newest parent plus any splits a Super User made before intake, parent first.
// SPA_ID runs only that one SPA. The lookup runs before login, so the test fails without opening a browser when nothing is waiting.
let workflowSpaIds: string[];
test.beforeAll(async () => {
    const override = process.env.SPA_ID?.trim();
    workflowSpaIds = override
        ? [override]
        : (await (await currentSpaStore(appUrls.onemac, spaOptionsFromEnv())).latestIntakeNeededWorkflow()).map((record) => record.spaId);
});
// The shared fixture would otherwise pick a single SPA. Intake reads the store's list instead.
test.use({ spaId: async ({ }, use) => use(workflowSpaIds[0]) });
test.use({ smartRole: 'INTAKE' });

test('Intake completes each OneMAC Medicaid SPA in the workflow and moves it to Pending - First Clock', async ({ navigation, onemacSubmission, page, recordSearch, spaRecord, spaStore }) => {
    const subject = 'testing';
    const description = 'testing description';
    const typeName = 'Administrative';
    const subtypes = ['Authority Change', 'Electronic Claims', 'Policy Update'];
    const alerts = { 'Alert 1 Day': '45', 'Alert 2 Day': '60', 'Alert 3 Day': '75' };
    const targetDate = futureDate(3);
    const approvedEffectiveDate = `${targetDate.getMonth() + 1}/${targetDate.getDate()}/${targetDate.getFullYear()}`;

    await navigation.openSmartHome();
    await eachSpa(workflowSpaIds, (spaId) => `Intake completes ${spaId}`, async (spaId) => {
        await recordSearch.openSpa(spaId);
        await test.step('Verify OneMAC submission details on the Details tab', async () => {
            const { details } = spaRecord;
            await details.open();
            await details.expectRowValue('Proposed Effective Date', toSmartDate(onemacSubmission.proposedEffectiveDate));
            // Intake only starts on an SPA that is still at Intake Needed, parent or split.
            await details.expectRowValue('Status', 'Intake Needed');
        });

        await test.step('Verify OneMAC attachments and Additional Information on the Attachments tab', async () => {
            await spaRecord.attachments.verifyOnemacSubmission(onemacAttachments, onemacSubmission.additionalInformation);
        });

        await test.step('Save Subject, Description, and a future Approved Effective Date', async () => {
            await spaRecord.details.updateSubmissionSummary(subject, description, approvedEffectiveDate);
        });

        await test.step('Upload intake attachment in Files Uploaded in SMART', async () => {
            await spaRecord.attachments.upload(path.resolve(__dirname, '../../../support/documents/intake-attachment.png'));
            const files = spaRecord.attachments.uploadedFiles.getByRole('grid', { name: 'Files Uploaded in SMART', exact: true });
            await expect(files.getByRole('link', { name: 'intake-attachment.png', exact: true }).first()).toBeVisible();
        });

        await test.step('Select Administrative type with subtypes and save', async () => {
            await spaRecord.details.selectTypeSubtypes(typeName, subtypes);
        });

        await test.step('Set Milestones alert days to 45, 60, and 75', async () => {
            await spaRecord.details.updateMilestoneAlerts(alerts);
        });

        // await test.step('Set Priority Code to P2 with rationale and save', async () => {
        //     await spaRecord.details.updatePriority('P2', 'testing priority');
        // });

        await spaRecord.review.assignCpoc('CPOC4', 'testing');
        await spaRecord.review.assignSrt('SRTUSER PW', 'assign SRT user');
        await spaRecord.notes.addNote('testing new notes');
        await spaRecord.details.markIntakeComplete();
        await test.step('Verify Pending - First Clock is the selected status for CPOC handoff', async () => {
            const status = page.getByRole('option', { name: 'Pending - First Clock', exact: true });
            await expect(status).toHaveCount(1);
            await expect(status).toBeVisible();
            await expect(status).toHaveAttribute('aria-selected', 'true');
        });

        await test.step('Record the SPA as Pending - First Clock in the local SPA store', async () => {
            await spaStore.markPendingFirstClock(spaId);
        });

        await test.step('Verify intake changes and OneMAC creation in Field History Tracking', async () => {
            const intakeCompleteDate = new Date().toLocaleDateString('en-US');
            await spaRecord.fieldHistory.verifyIntakeChanges({
                subject,
                description,
                typeSubtype: `${typeName} - ${subtypes.join(', ')}`,
                alerts,
                intakeCompleteDate,
                // A split's field history starts new, so only the parent keeps the OneMAC "Created." row.
                expectOnemacCreated: !/-[A-Z]$/.test(spaId),
            });
        });
        await navigation.openSmartHomeTab();
    });
});
