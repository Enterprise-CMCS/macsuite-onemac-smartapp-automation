import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { formatSpaId, formatSplitSpaId, splitIdentifierPattern, SpaOptions } from './spa';

// OneMAC package status. Under Review is a check on the record, not what the tests drive from.
export type OnemacStatus = 'reserved' | 'submitted' | 'under_review';

// SMART workflow stage. The tests use it to pick the record they run against. Null until intake sets it.
export type SmartStatus = 'pending_first_clock' | 'pending_rai' | 'pending_second_clock' | 'pending_concurrence' | 'pending_approval' | 'approved' | 'pending_disapproval' | 'disapproved';

// Reviewer roles that must both finish during Pending - First Clock before the SPA moves to Pending - Concurrence.
export type ReviewRole = 'srt' | 'cpoc';
export type ReviewRecommendation = 'approve' | 'disapprove';
const reviewRoles: ReviewRole[] = ['srt', 'cpoc'];

type SpaRecord = {
    spaId: string;
    onemacStatus: OnemacStatus;
    smartStatus: SmartStatus | null;
    reservedAt: string;
    submittedAt?: string;
    underReviewAt?: string;
    smartStatusAt?: string;
    reviewsCompleted?: Partial<Record<ReviewRole, string>>;
    reviewRecommendations?: Partial<Record<ReviewRole, ReviewRecommendation>>;
    raiReviewsCompleted?: Partial<Record<ReviewRole, string>>;
    details?: SpaSubmissionDetails;
    raiDetails?: SpaRaiDetails;
    formalRaiResponseDate?: string;
    // Split SPAs are nested under the parent so the status pickers, which only read top-level records, never return them.
    splits?: SpaSplit[];
};

// A clone of its parent at the time of the split. It has its own status, reviews, and approvals from then on.
export type SpaSplit = Omit<SpaRecord, 'splits'> & {
    splitIdentifier: string;
    splitReason: string;
    splitAt: string;
};

// SMART stages a split can be created in. Intake Needed is smartStatus null, so it is handled separately.
const splittableSmartStatuses: SmartStatus[] = ['pending_first_clock', 'pending_rai', 'pending_second_clock'];

// Records written before the split kept one `status` field, which held the OneMAC status.
type StoredRecord = Omit<SpaRecord, 'onemacStatus' | 'smartStatus'> & {
    status?: OnemacStatus;
    onemacStatus?: OnemacStatus;
    smartStatus?: SmartStatus | null;
};

const onemacStatuses: OnemacStatus[] = ['reserved', 'submitted', 'under_review'];
const smartStatuses: SmartStatus[] = ['pending_first_clock', 'pending_rai', 'pending_second_clock', 'pending_concurrence', 'pending_approval', 'approved', 'pending_disapproval', 'disapproved'];

// Values captured from the OneMAC package details page for verification in SMART.
export type SpaSubmissionDetails = {
    state: string;
    initialSubmissionDate: string;
    proposedEffectiveDate: string;
    additionalInformation: string;
};

const detailKeys: (keyof SpaSubmissionDetails)[] = ['state', 'initialSubmissionDate', 'proposedEffectiveDate', 'additionalInformation'];

// RAI dates as entered and shown in SMART, kept for confirmation in OneMAC.
export type SpaRaiDetails = {
    issuedDate: string;
    expiresDate: string;
};

const raiDetailKeys: (keyof SpaRaiDetails)[] = ['issuedDate', 'expiresDate'];

type SequenceData = {
    version: 1;
    environment: string;
    state: string;
    year: string;
    lastReserved: number;
    lastSuffix: number;
    latestSubmittedSpaId: string | null;
    records: SpaRecord[];
};

const defaultRecordsDirectory = path.resolve(__dirname, '../../playwright/.records');
const latestFileName = 'latest.json';

// Pointer to the most recent OneMAC submission across all states for one environment.
type LatestSubmission = { spaId: string; state: string; year: string; submittedAt: string };

function environmentFolder(directory: string, environmentUrl: string): string {
    return path.join(directory, createHash('sha256').update(new URL(environmentUrl).origin).digest('hex'));
}

// Checks a record's own fields. Callers check its SPA ID and its place in the store.
function hasInvalidFields(record: SpaRecord | SpaSplit): boolean {
    const smart = record.smartStatus;
    return !Number.isFinite(Date.parse(record.reservedAt))
        || !onemacStatuses.includes(record.onemacStatus)
        || (record.onemacStatus !== 'reserved' && !Number.isFinite(Date.parse(record.submittedAt ?? '')))
        || (record.onemacStatus === 'under_review' && !Number.isFinite(Date.parse(record.underReviewAt ?? '')))
        || (smart !== null && (record.onemacStatus === 'reserved'
            || !smartStatuses.includes(smart)
            || !Number.isFinite(Date.parse(record.smartStatusAt ?? ''))))
        || (record.reviewsCompleted !== undefined && (smart === null
            || Object.entries(record.reviewsCompleted).some(([role, at]) => !reviewRoles.includes(role as ReviewRole)
                || !Number.isFinite(Date.parse(at ?? '')))))
        || (record.details !== undefined && (record.onemacStatus === 'reserved'
            || detailKeys.some((key) => typeof record.details?.[key] !== 'string')))
        || (record.raiDetails !== undefined && (smart === null
            || raiDetailKeys.some((key) => typeof record.raiDetails?.[key] !== 'string')))
        || (record.formalRaiResponseDate !== undefined && typeof record.formalRaiResponseDate !== 'string');
}

// Finds a parent or split record by SPA ID. Mutators use this so a split can move through its own stages.
function findRecord(data: SequenceData, spaId: string): SpaRecord | SpaSplit | undefined {
    for (const record of data.records) {
        if (record.spaId === spaId) return record;
        const split = record.splits?.find((candidate) => candidate.spaId === spaId);
        if (split) return split;
    }
    return undefined;
}

export function createSpaRecordStore(
    environmentUrl: string,
    options: Pick<SpaOptions, 'state' | 'year' | 'startSequence'>,
    directory = defaultRecordsDirectory,
) {
    const environment = new URL(environmentUrl).origin;
    const state = formatSpaId(options.state, options.year, options.startSequence).split('-')[0];
    const folder = environmentFolder(directory, environmentUrl);
    const file = path.join(folder, `${state}-${options.year}.json`);
    const lockFile = `${file}.lock`;

    function migrateRecord(record: StoredRecord): SpaRecord {
        if (!record || typeof record !== 'object') throw new Error(`Invalid SPA record in ${file}. Refusing to reset it.`);
        const { status, onemacStatus, smartStatus, ...rest } = record;
        return { ...rest, onemacStatus: onemacStatus ?? (status as OnemacStatus), smartStatus: smartStatus ?? null };
    }

    async function read(): Promise<SequenceData> {
        let text: string;
        try {
            text = await readFile(file, 'utf8');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            return {
                version: 1, environment, state, year: options.year,
                lastReserved: options.startSequence - 1, lastSuffix: 0,
                latestSubmittedSpaId: null, records: [],
            };
        }
        const stored = JSON.parse(text) as Omit<SequenceData, 'records' | 'lastSuffix'> & { lastSuffix?: number; records: StoredRecord[] };
        if (stored.version !== 1 || stored.environment !== environment || stored.state !== state
            || stored.year !== options.year || !Number.isInteger(stored.lastReserved)
            || stored.lastReserved < 0 || stored.lastReserved > 9999 || !Array.isArray(stored.records)
            || (stored.latestSubmittedSpaId !== null && typeof stored.latestSubmittedSpaId !== 'string')
            || !Number.isInteger(stored.lastSuffix ?? 0) || (stored.lastSuffix ?? 0) < 0 || (stored.lastSuffix ?? 0) > 99) {
            throw new Error(`Invalid SPA sequence store: ${file}. Refusing to reset it.`);
        }
        const data: SequenceData = { ...stored, lastSuffix: stored.lastSuffix ?? 0, records: stored.records.map(migrateRecord) };
        const ids = new Set<string>();
        const invalid = () => new Error(`Invalid SPA record in ${file}. Refusing to reset it.`);
        for (const record of data.records) {
            const match = /^[A-Z]{2}-\d{2}-(\d{4})(?:-(QA\d{2}))?$/.exec(record.spaId ?? '');
            const sequence = Number(match?.[1]);
            if (!match || record.spaId !== formatSpaId(state, options.year, sequence, match[2])
                || sequence > data.lastReserved || ids.has(record.spaId) || hasInvalidFields(record)) {
                throw invalid();
            }
            ids.add(record.spaId);
            for (const split of record.splits ?? []) {
                if (!splitIdentifierPattern.test(split.splitIdentifier) || split.spaId !== `${record.spaId}-${split.splitIdentifier}`
                    || ids.has(split.spaId) || typeof split.splitReason !== 'string' || split.splitReason.trim() === ''
                    || !Number.isFinite(Date.parse(split.splitAt)) || hasInvalidFields(split)) {
                    throw invalid();
                }
                ids.add(split.spaId);
            }
        }
        if (data.latestSubmittedSpaId !== null
            && !data.records.some((record) => record.spaId === data.latestSubmittedSpaId && record.onemacStatus === 'submitted')) {
            throw new Error(`Invalid submitted SPA reference in ${file}.`);
        }
        return data;
    }

    // Moves a record between SMART stages. Repeating the target stage is a no-op, so a rerun does not fail.
    function moveSmartStatus(data: SequenceData, spaId: string, from: SmartStatus, to: SmartStatus): void {
        const record = findRecord(data, spaId);
        if (!record || record.smartStatus === null) throw new Error(`Cannot move ${spaId} to ${to}: no SMART status recorded.`);
        if (record.smartStatus === to) return;
        if (record.smartStatus !== from) throw new Error(`Cannot move ${spaId} from ${record.smartStatus} to ${to}; expected ${from}.`);
        record.smartStatus = to;
        record.smartStatusAt = new Date().toISOString();
    }

    async function latestInSmartStatus(status: SmartStatus): Promise<SpaRecord & { environment: string; state: string; year: string }> {
        const data = await read();
        const record = [...data.records].reverse().find((candidate) => candidate.smartStatus === status);
        if (!record) {
            throw new Error(`No SPA in ${status} for ${environment}, ${state}-${options.year}. Run the earlier suite steps first.`);
        }
        return { ...record, environment, state, year: options.year };
    }

    // The newest top-level SPA (or split) in a status that is still waiting, parent first, then its splits still waiting.
    // With a role, "waiting" also means that role has not finished its review yet; director steps pass no role and rely on the status change.
    async function latestWorkflowInSmartStatus(status: SmartStatus, role?: ReviewRole): Promise<Array<SpaRecord & { environment: string; state: string; year: string }>> {
        const data = await read();
        const waiting = (record: SpaRecord | SpaSplit) => record.smartStatus === status && (role === undefined || !record.reviewsCompleted?.[role]);
        const parent = [...data.records].reverse().find((candidate) => waiting(candidate) || (candidate.splits ?? []).some(waiting));
        if (!parent) {
            throw new Error(`No SPA in ${status}${role ? ` waiting for ${role}` : ''} in ${environment}, ${state}-${options.year}. Run the earlier suite steps first.`);
        }
        const members = [...(waiting(parent) ? [parent] : []), ...(parent.splits ?? []).filter(waiting)];
        return members.map((record) => ({ ...record, environment, state, year: options.year }));
    }

    // The newest parent and splits that intake has moved to Pending - First Clock but OneMAC has not yet marked Under Review, parent first.
    async function latestSubmittedWorkflow(): Promise<Array<SpaRecord & { environment: string; state: string; year: string }>> {
        const data = await read();
        const waiting = (record: SpaRecord | SpaSplit) => record.smartStatus === 'pending_first_clock' && record.onemacStatus === 'submitted';
        const parent = [...data.records].reverse().find((candidate) => waiting(candidate) || (candidate.splits ?? []).some(waiting));
        if (!parent) {
            throw new Error(`No submitted SPA waiting for OneMAC Under Review in ${environment}, ${state}-${options.year}. Run OneMAC creation and intake first.`);
        }
        const members = [...(waiting(parent) ? [parent] : []), ...(parent.splits ?? []).filter(waiting)];
        return members.map((record) => ({ ...record, environment, state, year: options.year }));
    }

    async function update<Result>(change: (data: SequenceData) => Result): Promise<Result> {
        await mkdir(folder, { recursive: true, mode: 0o700 });
        let lock;
        try {
            lock = await open(lockFile, 'wx', 0o600);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
                throw new Error(`SPA sequence is locked: ${lockFile}. Another run may be updating it; verify no run is active before removing a stale lock.`);
            }
            throw error;
        }
        const temporary = `${file}.${randomUUID()}.tmp`;
        try {
            const data = await read();
            const result = change(data);
            await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
            await rename(temporary, file);
            return result;
        } finally {
            await rm(temporary, { force: true });
            await lock.close();
            await rm(lockFile, { force: true });
        }
    }

    async function writeLatest(submission: LatestSubmission): Promise<void> {
        await mkdir(folder, { recursive: true, mode: 0o700 });
        const target = path.join(folder, latestFileName);
        const temporary = `${target}.${randomUUID()}.tmp`;
        try {
            await writeFile(temporary, `${JSON.stringify(submission, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
            await rename(temporary, target);
        } finally {
            await rm(temporary, { force: true });
        }
    }

    return {
        file,
        reserve: () => update((data) => {
            const continuesBase = data.lastSuffix > 0 && data.lastSuffix < 99;
            const sequence = continuesBase ? data.lastReserved : data.lastReserved + 1;
            const suffix = continuesBase ? data.lastSuffix + 1 : 1;
            const spaId = formatSpaId(state, options.year, sequence, `QA${String(suffix).padStart(2, '0')}`);
            data.lastReserved = sequence;
            data.lastSuffix = suffix;
            data.records.push({ spaId, onemacStatus: 'reserved', smartStatus: null, reservedAt: new Date().toISOString() });
            return spaId;
        }),
        markSubmitted: async (spaId: string) => {
            const submittedAt = await update((data) => {
                const record = findRecord(data, spaId);
                if (!record) throw new Error(`Cannot confirm an unreserved SPA ID: ${spaId}`);
                if (record.onemacStatus !== 'reserved') return null;
                record.onemacStatus = 'submitted';
                record.submittedAt = new Date().toISOString();
                data.latestSubmittedSpaId = spaId;
                return record.submittedAt;
            });
            // Only a fresh submission moves the global pointer; repeat calls leave it unchanged.
            if (submittedAt) await writeLatest({ spaId, state, year: options.year, submittedAt });
        },
        markPendingFirstClock: (spaId: string) => update((data) => {
            const record = findRecord(data, spaId);
            if (!record || record.onemacStatus === 'reserved') throw new Error(`Cannot mark an unsubmitted SPA ID Pending - First Clock: ${spaId}`);
            if (record.smartStatus === 'pending_first_clock') return;
            record.smartStatus = 'pending_first_clock';
            record.smartStatusAt = new Date().toISOString();
            // Intake is done for this SPA, so the latest-submitted lookup must not return it again.
            if (data.latestSubmittedSpaId === spaId) data.latestSubmittedSpaId = null;
        }),
        // Called when a reviewer finishes. Once SRT and CPOC are both done, the SPA moves to Pending - Concurrence,
        // or to Pending - Disapproval when either reviewer recommended disapproval (disapproval skips concurrence).
        markReviewCompleted: (spaId: string, role: ReviewRole, recommendation: ReviewRecommendation = 'approve') => update((data) => {
            const record = findRecord(data, spaId);
            if (!record || record.smartStatus === null) {
                throw new Error(`Cannot record ${role.toUpperCase()} completion for an SPA not in Pending - First Clock: ${spaId}`);
            }
            if (record.smartStatus !== 'pending_first_clock') return;
            record.reviewsCompleted = { ...record.reviewsCompleted, [role]: record.reviewsCompleted?.[role] ?? new Date().toISOString() };
            record.reviewRecommendations = { ...record.reviewRecommendations, [role]: recommendation };
            if (reviewRoles.every((reviewRole) => record.reviewsCompleted?.[reviewRole])) {
                const disapproved = reviewRoles.some((reviewRole) => record.reviewRecommendations?.[reviewRole] === 'disapprove');
                record.smartStatus = disapproved ? 'pending_disapproval' : 'pending_concurrence';
                record.smartStatusAt = new Date().toISOString();
            }
        }),
        // Called after CPOC finishes the RAI steps and the RAI Issued Date is saved. The SPA moves to Pending RAI.
        markPendingRai: (spaId: string, raiDetails: SpaRaiDetails) => update((data) => {
            moveSmartStatus(data, spaId, 'pending_first_clock', 'pending_rai');
            const record = findRecord(data, spaId);
            if (record) record.raiDetails = { ...raiDetails };
        }),
        // Called after OneMAC shows Submitted for the formal RAI response, using the date OneMAC displays.
        // OneMAC leaves Under Review once the RAI response is submitted, so the status returns to submitted.
        markFormalRaiResponse: (spaId: string, formalResponseDate: string) => update((data) => {
            const record = findRecord(data, spaId);
            if (!record || record.onemacStatus === 'reserved') throw new Error(`Cannot record a formal RAI response for an unsubmitted SPA ID: ${spaId}`);
            record.formalRaiResponseDate = formalResponseDate;
            record.onemacStatus = 'submitted';
            delete record.underReviewAt;
        }),
        // Called after SMART shows Pending - Second Clock for the RAI response. The SPA moves from Pending RAI.
        markPendingSecondClock: (spaId: string) => update((data) => moveSmartStatus(data, spaId, 'pending_rai', 'pending_second_clock')),
        // Called when SRT or CPOC finishes the second clock review. Once both finish, the SPA moves to Pending - Concurrence.
        markRaiReviewCompleted: (spaId: string, role: ReviewRole) => update((data) => {
            const record = findRecord(data, spaId);
            if (!record || record.smartStatus === null) {
                throw new Error(`Cannot record ${role.toUpperCase()} second clock completion for an SPA not in Pending - Second Clock: ${spaId}`);
            }
            if (record.smartStatus !== 'pending_second_clock') return;
            record.raiReviewsCompleted = { ...record.raiReviewsCompleted, [role]: record.raiReviewsCompleted?.[role] ?? new Date().toISOString() };
            if (reviewRoles.every((reviewRole) => record.raiReviewsCompleted?.[reviewRole])) {
                record.smartStatus = 'pending_concurrence';
                record.smartStatusAt = new Date().toISOString();
            }
        }),
        // Called after the Group Director records Concur. The SPA moves to Pending - Approval.
        markConcurred: (spaId: string) => update((data) => moveSmartStatus(data, spaId, 'pending_concurrence', 'pending_approval')),
        // Called after the Division Director records Approve.
        markApproved: (spaId: string) => update((data) => moveSmartStatus(data, spaId, 'pending_approval', 'approved')),
        // Called after the Group Director records Disapprove on the Adjudication row.
        markDisapproved: (spaId: string) => update((data) => moveSmartStatus(data, spaId, 'pending_disapproval', 'disapproved')),
        // Called after the Group Director records Return to Review Team on the Concurrence or Adjudication row, or after the
        // Division Director does so on the Adjudication row in Pending - Approval.
        // SRT and CPOC must finish again, so their completions and recommendations are cleared.
        markReturnedToReview: (spaId: string) => update((data) => {
            const record = findRecord(data, spaId);
            if (!record || record.smartStatus === null) throw new Error(`Cannot return ${spaId} to review: no SMART status recorded.`);
            if (record.smartStatus === 'pending_first_clock') return;
            if (record.smartStatus !== 'pending_concurrence' && record.smartStatus !== 'pending_disapproval' && record.smartStatus !== 'pending_approval') {
                throw new Error(`Cannot return ${spaId} to review from ${record.smartStatus}.`);
            }
            record.smartStatus = 'pending_first_clock';
            record.smartStatusAt = new Date().toISOString();
            delete record.reviewsCompleted;
            delete record.reviewRecommendations;
        }),
        // Called after the OneMAC status check sees Under Review for this SPA.
        markOnemacUnderReview: (spaId: string) => update((data) => {
            const record = findRecord(data, spaId);
            if (!record || record.onemacStatus === 'reserved') throw new Error(`Cannot mark an unsubmitted SPA ID Under Review: ${spaId}`);
            if (record.onemacStatus === 'under_review') return;
            record.onemacStatus = 'under_review';
            record.underReviewAt = new Date().toISOString();
        }),
        // Called after the OneMAC status check sees the status OneMAC shows for this SPA.
        markOnemacStatus: (spaId: string, status: 'submitted' | 'under_review') => update((data) => {
            const record = findRecord(data, spaId);
            if (!record || record.onemacStatus === 'reserved') throw new Error(`Cannot set OneMAC status for an unsubmitted SPA ID: ${spaId}`);
            if (record.onemacStatus === status) return;
            record.onemacStatus = status;
            if (status === 'under_review') record.underReviewAt = new Date().toISOString();
            else delete record.underReviewAt;
        }),
        saveDetails: (spaId: string, details: SpaSubmissionDetails) => update((data) => {
            const record = findRecord(data, spaId);
            if (!record || record.onemacStatus === 'reserved') throw new Error(`Cannot save details for an unsubmitted SPA ID: ${spaId}`);
            record.details = { ...details };
        }),
        // Called after SMART creates a Split SPA. The split is a clone of the parent's current state; its field history starts empty.
        recordSplit: (parentSpaId: string, identifier: string, reason: string) => update((data) => {
            const parent = data.records.find((candidate) => candidate.spaId === parentSpaId);
            if (!parent) throw new Error(`Cannot split ${parentSpaId}: it is not a standard SPA in the store.`);
            if (parent.onemacStatus === 'reserved' || (parent.smartStatus !== null && !splittableSmartStatuses.includes(parent.smartStatus))) {
                throw new Error(`Cannot split ${parentSpaId} from ${parent.smartStatus ?? 'Intake Needed'}.`);
            }
            if (reason.trim() === '') throw new Error(`A split reason is required to split ${parentSpaId}.`);
            const spaId = formatSplitSpaId(parentSpaId, identifier);
            if (findRecord(data, spaId)) throw new Error(`SPA ID ${spaId} already exists.`);
            const fields = structuredClone(parent);
            delete fields.splits;
            delete fields.reviewsCompleted;
            delete fields.reviewRecommendations;
            delete fields.raiReviewsCompleted;
            const now = new Date().toISOString();
            const split: SpaSplit = { ...fields, spaId, reservedAt: now, splitIdentifier: identifier, splitReason: reason.trim(), splitAt: now };
            parent.splits = [...(parent.splits ?? []), split];
            return spaId;
        }),
        // Looks up an existing record only; never reserves or creates one. Split SPAs resolve by their own ID.
        find: async (spaId: string) => {
            const data = await read();
            const record = findRecord(data, spaId);
            if (!record) throw new Error(`SPA ${spaId} is not in the store for ${environment}, ${state}-${options.year}: ${file}`);
            return { ...record, environment, state, year: options.year };
        },
        // The newest SPA still awaiting intake; cleared once intake marks it Pending - First Clock.
        latestSubmitted: async () => {
            const data = await read();
            const record = data.records.find((candidate) => candidate.spaId === data.latestSubmittedSpaId);
            if (!record) throw new Error(`No confirmed SPA submission for ${environment}, ${state}-${options.year}. Run OneMAC creation first.`);
            return { ...record, environment, state, year: options.year };
        },
        // The newest SPA intake has moved to Pending - First Clock (OneMAC Under Review), ready for SRT and CPOC.
        latestPendingFirstClock: () => latestInSmartStatus('pending_first_clock'),
        // The Pending - First Clock parent and its splits, parent first. Pass a role to skip SPAs that role already finished.
        latestPendingFirstClockWorkflow: (role?: ReviewRole) => latestWorkflowInSmartStatus('pending_first_clock', role),
        latestSubmittedWorkflow,
        // Concurrence and approval steps run on whatever is in that status; the director's action moves each SPA out of it.
        latestPendingConcurrenceWorkflow: () => latestWorkflowInSmartStatus('pending_concurrence'),
        latestPendingApprovalWorkflow: () => latestWorkflowInSmartStatus('pending_approval'),
        // The newest SPA with RAI issued in SMART; the OneMAC RAI check confirms the stored dates.
        latestPendingRai: () => latestInSmartStatus('pending_rai'),
        // The newest SPA that OneMAC has received the formal RAI response for; SMART moves it to Pending - Second Clock.
        latestPendingSecondClock: () => latestInSmartStatus('pending_second_clock'),
        // The newest SPA SRT and CPOC have finished; the Group Director concurs next.
        latestPendingConcurrence: () => latestInSmartStatus('pending_concurrence'),
        // The newest SPA the Group Director has concurred; the Division Director approves next.
        latestPendingApproval: () => latestInSmartStatus('pending_approval'),
        // The newest SPA the Division Director has approved; the OneMAC final review checks it.
        latestApproved: () => latestInSmartStatus('approved'),
        // The newest approved parent and its approved splits, parent first; the OneMAC final review checks each one.
        latestApprovedWorkflow: () => latestWorkflowInSmartStatus('approved'),
        // The newest SPA SRT and CPOC recommended for disapproval; the Group Director records the decision next.
        latestPendingDisapproval: () => latestInSmartStatus('pending_disapproval'),
        // The newest SPA the Group Director returns to review, from either Pending - Concurrence or Pending - Disapproval.
        latestAwaitingGroupDirector: async () => {
            const data = await read();
            const record = [...data.records].reverse().find((candidate) => candidate.smartStatus === 'pending_concurrence' || candidate.smartStatus === 'pending_disapproval');
            if (!record) {
                throw new Error(`No SPA awaiting the Group Director for ${environment}, ${state}-${options.year}. Run the earlier suite steps first.`);
            }
            return { ...record, environment, state, year: options.year };
        },
    };
}

// Resolves the SPA SMART should use: SPA_ID when set, otherwise the most recent OneMAC submission in any state.
export async function selectSpaTarget(
    environmentUrl: string,
    overrideSpaId: string | undefined,
    envOptions: Pick<SpaOptions, 'state' | 'year' | 'startSequence'>,
    directory = defaultRecordsDirectory,
): Promise<{ spaId: string; state: string; year: string }> {
    if (overrideSpaId) {
        const record = await createSpaRecordStore(environmentUrl, envOptions, directory).find(overrideSpaId);
        return { spaId: record.spaId, state: record.state, year: record.year };
    }
    const pointer = path.join(environmentFolder(directory, environmentUrl), latestFileName);
    let stored: Partial<LatestSubmission>;
    try {
        stored = JSON.parse(await readFile(pointer, 'utf8')) as Partial<LatestSubmission>;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(`No confirmed SPA submission for ${new URL(environmentUrl).origin}. Run OneMAC creation first.`);
        }
        throw error;
    }
    if (typeof stored.spaId !== 'string' || typeof stored.state !== 'string' || typeof stored.year !== 'string') {
        throw new Error(`Invalid latest SPA pointer: ${pointer}. Refusing to use it.`);
    }
    const record = await createSpaRecordStore(environmentUrl, { state: stored.state, year: stored.year, startSequence: 1 }, directory).find(stored.spaId);
    return { spaId: record.spaId, state: record.state, year: record.year };
}

// Store for the state and year of the most recent OneMAC submission, so SMART lookups match the target.
export async function currentSpaStore(
    environmentUrl: string,
    envOptions: Pick<SpaOptions, 'state' | 'year' | 'startSequence'>,
    directory = defaultRecordsDirectory,
) {
    const target = await selectSpaTarget(environmentUrl, undefined, envOptions, directory);
    return createSpaRecordStore(environmentUrl, { state: target.state, year: target.year, startSequence: 1 }, directory);
}
