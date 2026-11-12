import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { formatSpaId, SpaOptions } from './spa';

// OneMAC package status. Under Review is a check on the record, not what the tests drive from.
export type OnemacStatus = 'reserved' | 'submitted' | 'under_review';

// SMART workflow stage. The tests use it to pick the record they run against. Null until intake sets it.
export type SmartStatus = 'pending_first_clock' | 'pending_rai' | 'pending_second_clock' | 'pending_concurrence' | 'pending_approval' | 'approved';

// Reviewer roles that must both finish during Pending - First Clock before the SPA moves to Pending - Concurrence.
export type ReviewRole = 'srt' | 'cpoc';
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
    raiReviewsCompleted?: Partial<Record<ReviewRole, string>>;
    details?: SpaSubmissionDetails;
    raiDetails?: SpaRaiDetails;
    formalRaiResponseDate?: string;
};

// Records written before the split kept one `status` field, which held the OneMAC status.
type StoredRecord = Omit<SpaRecord, 'onemacStatus' | 'smartStatus'> & {
    status?: OnemacStatus;
    onemacStatus?: OnemacStatus;
    smartStatus?: SmartStatus | null;
};

const onemacStatuses: OnemacStatus[] = ['reserved', 'submitted', 'under_review'];
const smartStatuses: SmartStatus[] = ['pending_first_clock', 'pending_rai', 'pending_second_clock', 'pending_concurrence', 'pending_approval', 'approved'];

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
        for (const record of data.records) {
            const match = /^[A-Z]{2}-\d{2}-(\d{4})(?:-(QA\d{2}))?$/.exec(record.spaId ?? '');
            const sequence = Number(match?.[1]);
            const smart = record.smartStatus;
            if (!match || record.spaId !== formatSpaId(state, options.year, sequence, match[2])
                || sequence > data.lastReserved || ids.has(record.spaId)
                || !Number.isFinite(Date.parse(record.reservedAt))
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
                    || detailKeys.some((key) => typeof record.details?.[key] !== 'string'))
                    || (record.raiDetails !== undefined && (smart === null
                        || raiDetailKeys.some((key) => typeof record.raiDetails?.[key] !== 'string')))
                    || (record.formalRaiResponseDate !== undefined && typeof record.formalRaiResponseDate !== 'string'))) {
                throw new Error(`Invalid SPA record in ${file}. Refusing to reset it.`);
            }
            ids.add(record.spaId);
        }
        if (data.latestSubmittedSpaId !== null
            && !data.records.some((record) => record.spaId === data.latestSubmittedSpaId && record.onemacStatus === 'submitted')) {
            throw new Error(`Invalid submitted SPA reference in ${file}.`);
        }
        return data;
    }

    // Moves a record between SMART stages. Repeating the target stage is a no-op, so a rerun does not fail.
    function moveSmartStatus(data: SequenceData, spaId: string, from: SmartStatus, to: SmartStatus): void {
        const record = data.records.find((candidate) => candidate.spaId === spaId);
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
                const record = data.records.find((candidate) => candidate.spaId === spaId);
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
            const record = data.records.find((candidate) => candidate.spaId === spaId);
            if (!record || record.onemacStatus === 'reserved') throw new Error(`Cannot mark an unsubmitted SPA ID Pending - First Clock: ${spaId}`);
            if (record.smartStatus === 'pending_first_clock') return;
            record.smartStatus = 'pending_first_clock';
            record.smartStatusAt = new Date().toISOString();
            // Intake is done for this SPA, so the latest-submitted lookup must not return it again.
            if (data.latestSubmittedSpaId === spaId) data.latestSubmittedSpaId = null;
        }),
        // Called when a reviewer finishes. Once SRT and CPOC are both done, the SPA moves to Pending - Concurrence.
        markReviewCompleted: (spaId: string, role: ReviewRole) => update((data) => {
            const record = data.records.find((candidate) => candidate.spaId === spaId);
            if (!record || record.smartStatus === null) {
                throw new Error(`Cannot record ${role.toUpperCase()} completion for an SPA not in Pending - First Clock: ${spaId}`);
            }
            if (record.smartStatus !== 'pending_first_clock') return;
            record.reviewsCompleted = { ...record.reviewsCompleted, [role]: record.reviewsCompleted?.[role] ?? new Date().toISOString() };
            if (reviewRoles.every((reviewRole) => record.reviewsCompleted?.[reviewRole])) {
                record.smartStatus = 'pending_concurrence';
                record.smartStatusAt = new Date().toISOString();
            }
        }),
        // Called after CPOC finishes the RAI steps and the RAI Issued Date is saved. The SPA moves to Pending RAI.
        markPendingRai: (spaId: string, raiDetails: SpaRaiDetails) => update((data) => {
            moveSmartStatus(data, spaId, 'pending_first_clock', 'pending_rai');
            const record = data.records.find((candidate) => candidate.spaId === spaId);
            if (record) record.raiDetails = { ...raiDetails };
        }),
        // Called after OneMAC shows Submitted for the formal RAI response, using the date OneMAC displays.
        // OneMAC leaves Under Review once the RAI response is submitted, so the status returns to submitted.
        markFormalRaiResponse: (spaId: string, formalResponseDate: string) => update((data) => {
            const record = data.records.find((candidate) => candidate.spaId === spaId);
            if (!record || record.onemacStatus === 'reserved') throw new Error(`Cannot record a formal RAI response for an unsubmitted SPA ID: ${spaId}`);
            record.formalRaiResponseDate = formalResponseDate;
            record.onemacStatus = 'submitted';
            delete record.underReviewAt;
        }),
        // Called after SMART shows Pending - Second Clock for the RAI response. The SPA moves from Pending RAI.
        markPendingSecondClock: (spaId: string) => update((data) => moveSmartStatus(data, spaId, 'pending_rai', 'pending_second_clock')),
        // Called when SRT or CPOC finishes the second clock review. Once both finish, the SPA moves to Pending - Concurrence.
        markRaiReviewCompleted: (spaId: string, role: ReviewRole) => update((data) => {
            const record = data.records.find((candidate) => candidate.spaId === spaId);
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
        // Called after the OneMAC status check sees Under Review for this SPA.
        markOnemacUnderReview: (spaId: string) => update((data) => {
            const record = data.records.find((candidate) => candidate.spaId === spaId);
            if (!record || record.onemacStatus === 'reserved') throw new Error(`Cannot mark an unsubmitted SPA ID Under Review: ${spaId}`);
            if (record.onemacStatus === 'under_review') return;
            record.onemacStatus = 'under_review';
            record.underReviewAt = new Date().toISOString();
        }),
        // Called after the OneMAC status check sees the status OneMAC shows for this SPA.
        markOnemacStatus: (spaId: string, status: 'submitted' | 'under_review') => update((data) => {
            const record = data.records.find((candidate) => candidate.spaId === spaId);
            if (!record || record.onemacStatus === 'reserved') throw new Error(`Cannot set OneMAC status for an unsubmitted SPA ID: ${spaId}`);
            if (record.onemacStatus === status) return;
            record.onemacStatus = status;
            if (status === 'under_review') record.underReviewAt = new Date().toISOString();
            else delete record.underReviewAt;
        }),
        saveDetails: (spaId: string, details: SpaSubmissionDetails) => update((data) => {
            const record = data.records.find((candidate) => candidate.spaId === spaId);
            if (!record || record.onemacStatus === 'reserved') throw new Error(`Cannot save details for an unsubmitted SPA ID: ${spaId}`);
            record.details = { ...details };
        }),
        // Looks up an existing record only; never reserves or creates one.
        find: async (spaId: string) => {
            const data = await read();
            const record = data.records.find((candidate) => candidate.spaId === spaId);
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
