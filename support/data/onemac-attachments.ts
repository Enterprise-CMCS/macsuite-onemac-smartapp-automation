// Files uploaded on the OneMAC Medicaid SPA form. Document types match the OneMAC form labels,
// which OneMAC and SMART both display in their attachment tables.
export const onemacAttachments = [
    { testId: 'cmsForm179', documentType: 'CMS-179 Form', fileName: 'CMS-179 Form.png' },
    { testId: 'spaPages', documentType: 'SPA Pages', fileName: 'SPA pages.png' },
    { testId: 'coverLetter', documentType: 'Cover Letter', fileName: 'Cover Letter.png' },
    { testId: 'tribalEngagement', documentType: 'Document Demonstrating Good-Faith Tribal Engagement', fileName: 'Good-Faith Tribal Engagement.png' },
    { testId: 'existingStatePlanPages', documentType: 'Existing State Plan Page(s)', fileName: 'Existing State Plan Pages.png' },
    { testId: 'publicNotice', documentType: 'Public Notice', fileName: 'Public Notice.png' },
    { testId: 'sfq', documentType: 'Standard Funding Questions (SFQs)', fileName: 'SFQs.png' },
    { testId: 'tribalConsultation', documentType: 'Tribal Consultation', fileName: 'Tribal Consultation.png' },
] as const;

export type OnemacAttachment = { documentType: string; fileName: string };

// Files uploaded with the formal RAI response in OneMAC. Names match files in support/documents/upload.
export const raiResponseFiles = { letter: 'TEST-RAI-response-letter.docx' } as const;
