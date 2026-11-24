import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defaultRecordsDirectory, environmentFolder } from './spa-store';

// Roles that can create a companion letter in SMART.
export type CompanionLetterCreator = 'group_director' | 'division_director' | 'super_user';

// One saved companion letter per SPA. The CPOC reads it back to find the letter under Oversight and Monitoring.
export type CompanionLetterRecord = {
    spaId: string;
    letterName: string;
    recordId: string;
    createdByRole: CompanionLetterCreator;
    createdAt: string;
};

type CompanionLetterData = {
    version: 1;
    environment: string;
    records: CompanionLetterRecord[];
};

const fileName = 'companion-letters.json';

export function createCompanionLetterStore(environmentUrl: string, directory = defaultRecordsDirectory) {
    const environment = new URL(environmentUrl).origin;
    const folder = environmentFolder(directory, environmentUrl);
    const file = path.join(folder, fileName);
    const lockFile = `${file}.lock`;

    async function read(): Promise<CompanionLetterData> {
        let text: string;
        try {
            text = await readFile(file, 'utf8');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            return { version: 1, environment, records: [] };
        }
        const stored = JSON.parse(text) as CompanionLetterData;
        const invalidRecord = (record: CompanionLetterRecord) => !record?.spaId || !record.letterName || !record.recordId
            || !record.createdByRole || !Number.isFinite(Date.parse(record.createdAt));
        if (stored.version !== 1 || stored.environment !== environment || !Array.isArray(stored.records)
            || stored.records.some(invalidRecord)) {
            throw new Error(`Invalid companion letter store: ${file}. Refusing to reset it.`);
        }
        return stored;
    }

    async function update<Result>(change: (data: CompanionLetterData) => Result): Promise<Result> {
        await mkdir(folder, { recursive: true, mode: 0o700 });
        let lock;
        try {
            lock = await open(lockFile, 'wx', 0o600);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
                throw new Error(`Companion letter store is locked: ${lockFile}. Verify no run is active before removing a stale lock.`);
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

    return {
        file,
        // Saving the same letter again is a no-op. A different letter for the same SPA is refused.
        record: (letter: Omit<CompanionLetterRecord, 'createdAt'>) => update((data) => {
            const existing = data.records.find((candidate) => candidate.spaId === letter.spaId);
            if (existing) {
                if (existing.recordId === letter.recordId) return existing;
                throw new Error(`${letter.spaId} already has companion letter ${existing.letterName} (${existing.recordId}).`);
            }
            const saved: CompanionLetterRecord = { ...letter, createdAt: new Date().toISOString() };
            data.records.push(saved);
            return saved;
        }),
        find: async (spaId: string): Promise<CompanionLetterRecord | undefined> => {
            const data = await read();
            return data.records.find((candidate) => candidate.spaId === spaId);
        },
    };
}
