import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Every tests/med-spa-suites/run-suite-*.mjs file that exports `suite` is included, in filename order.
// New suite files are picked up automatically.
export async function loadSuites() {
    const directory = new URL('..', import.meta.url);
    const suiteFiles = readdirSync(directory)
        .filter((file) => /^run-suite-.*\.mjs$/.test(file))
        .sort();
    const suites = [];
    for (const file of suiteFiles) {
        const { suite } = await import(pathToFileURL(fileURLToPath(new URL(file, directory))).href);
        if (suite) suites.push(suite);
    }
    return suites;
}
