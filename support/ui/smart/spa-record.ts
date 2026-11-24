import type { Page } from '@playwright/test';
import { SmartDetails } from './sections/details';
import { SmartAttachments } from './sections/attachments';
import { SmartReview } from './sections/review';
import { SmartFinancialInformation } from './sections/financial-information';
import { SmartNotes } from './sections/notes';
import { SmartAdjudication } from './sections/adjudication';
import { SmartFieldHistory } from './sections/field-history';
import { SmartCompanionLetter } from './sections/companion-letter';
import { SmartSplitSpaDialog } from './split-spa-dialog';

export class SpaRecord {
    readonly splitSpa: SmartSplitSpaDialog;
    readonly details: SmartDetails;
    readonly attachments: SmartAttachments;
    readonly review: SmartReview;
    readonly financialInformation: SmartFinancialInformation;
    readonly notes: SmartNotes;
    readonly adjudication: SmartAdjudication;
    readonly fieldHistory: SmartFieldHistory;
    readonly companionLetter: SmartCompanionLetter;

    constructor(readonly page: Page) {
        this.details = new SmartDetails(page);
        this.attachments = new SmartAttachments(page);
        this.review = new SmartReview(page);
        this.financialInformation = new SmartFinancialInformation(page);
        this.notes = new SmartNotes(page);
        this.adjudication = new SmartAdjudication(page);
        this.fieldHistory = new SmartFieldHistory(page);
        this.companionLetter = new SmartCompanionLetter(page);
        this.splitSpa = new SmartSplitSpaDialog(page);
    }
}