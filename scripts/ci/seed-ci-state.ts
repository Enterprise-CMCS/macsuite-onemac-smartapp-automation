import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ciStates } from '../../support/config/states';
import { appUrls } from '../../support/config/urls';
import { environmentFolder } from '../../support/data/spa-store';

// Writes one starting store per CI state so the ci-state branch begins with real files.
// Each holds a placeholder approved <STATE>-<YY>-0001-QA01 (never created in OneMAC), so the first real run reserves QA02.
// Usage: npm run ci-state:seed [outputDir]
const directory = path.resolve(process.argv[2] ?? 'playwright/.ci-seed');
const year = String(new Date().getFullYear()).slice(-2);
const placeholderDate = '2026-01-01T00:00:00.000Z';

async function main() {
    const folder = environmentFolder(directory, appUrls.onemac);
    await mkdir(folder, { recursive: true });
    for (const state of ciStates) {
        const store = {
            version: 1,
            environment: new URL(appUrls.onemac).origin,
            state,
            year,
            lastReserved: 1,
            lastSuffix: 1,
            latestSubmittedSpaId: null,
            records: [{
                spaId: `${state}-${year}-0001-QA01`,
                onemacStatus: 'approved',
                smartStatus: 'approved',
                reservedAt: placeholderDate,
                submittedAt: placeholderDate,
                underReviewAt: placeholderDate,
                smartStatusAt: placeholderDate,
            }],
        };
        const file = path.join(folder, `${state}-${year}.json`);
        await writeFile(file, `${JSON.stringify(store, null, 2)}\n`);
        console.log(`Seeded ${file}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
