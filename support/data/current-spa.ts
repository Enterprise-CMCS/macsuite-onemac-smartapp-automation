import { appUrls } from '../config/urls';
import { spaOptionsFromEnv } from './spa';
import { createSpaRecordStore, selectSpaTarget } from './spa-store';

export async function currentSpaSummary(records: ReturnType<typeof createSpaRecordStore>, spaId?: string): Promise<string> {
    const record = spaId ? await records.find(spaId) : await records.latestSubmitted();
    return [
        `SPA ID: ${record.spaId}`,
        `OneMAC status: ${record.onemacStatus}`,
        `SMART status: ${record.smartStatus ?? 'not started'}`,
        `Submitted: ${record.submittedAt}`,
        `Environment: ${record.environment}`,
        `State: ${record.state}`,
        `Year: ${record.year}`,
        `Record file: ${records.file}`,
    ].join('\n');
}

if (require.main === module) {
    async function main() {
        const target = await selectSpaTarget(appUrls.onemac, process.env.SPA_ID?.trim(), spaOptionsFromEnv());
        const records = createSpaRecordStore(appUrls.onemac, { state: target.state, year: target.year, startSequence: 1 });
        console.log(await currentSpaSummary(records, target.spaId));
    }

    main().catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : 'Unable to read the saved SPA record.');
        process.exitCode = 1;
    });
}