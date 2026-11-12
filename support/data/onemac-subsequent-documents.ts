// Subsequent-documents package used to validate upload formats in OneMAC.
// Title-matched files go to their named slot; the rest go to Other. RTF is excluded
// because OneMAC rejects the whole Other batch when any file has an unsupported type.
export const subsequentDocumentsReason = 'adding subsequent documents';
// The OneMAC user shown in the "Subsequent Document(s) Uploaded By" grid name.
export const subsequentDocumentsSubmitter = 'George Harrison';

export const subsequentDocumentsOther = [
    'support/documents/upload/RAI response.png',
    'support/documents/upload/TEST-RAI-response-letter.docx',
    'support/documents/additional/additional-Good-Faith Tribal Engagement.docx',
    'support/documents/additional/additional-Sample Document 13.pptx',
    'support/documents/additional/additional-SPA pages.bmp',
    'support/documents/additional/additional-Cover Letter.gif',
    'support/documents/additional/additional-Public Notice.odp',
    'support/documents/additional/additional-TEST-RAI-response-letter.png',
    'support/documents/additional/additional-CMS-179 Form.jpeg',
    'support/documents/additional/additional-RAI response.ods',
    'support/documents/additional/additional-SFQs.odt',
    'support/documents/additional/additional-Sample Document 17.xls',
    'support/documents/additional/additional-Sample Document 15.tif',
    'support/documents/additional/additional-Tribal Consultation.csv',
    'support/documents/additional/additional-Sample Document 11.pdf',
    'support/documents/additional/additional-Sample Document 16.txt',
    'support/documents/additional/additional-Sample Document 18.xlsx',
] as const;
