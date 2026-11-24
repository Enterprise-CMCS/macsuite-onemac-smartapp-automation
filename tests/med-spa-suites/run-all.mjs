import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runSuites } from './lib/run-suite.mjs';

// Every tests/med-spa-suites/run-suite-*.mjs file that exports `suite` is included, in filename order.
// New suite files are picked up automatically; no edit to this file is needed.
const suiteFiles = readdirSync(new URL('.', import.meta.url))
    .filter((file) => /^run-suite-.*\.mjs$/.test(file))
    .sort();

const suites = [];
for (const file of suiteFiles) {
    const { suite } = await import(pathToFileURL(fileURLToPath(new URL(file, import.meta.url))).href);
    if (suite) suites.push(suite);
}

// Each suite runs on its own, and one Slack message covers all of them.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runSuites(suites, { title: 'Total: Med SPA suites' });
}
