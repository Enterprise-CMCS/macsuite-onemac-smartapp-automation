import 'dotenv/config';
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { sendSlackSummary } from './lib/slack.mjs';

// Each browser gets its own SPA state, so the parallel runs don't write to the same store.
// CI uses its own states (see support/config/states.ts) so it never shares SPA IDs with local runs.
const BROWSERS = process.env.CI === 'true'
    ? [
        { project: 'chromium', label: 'Chrome', state: 'SC' },
        { project: 'msedge', label: 'Edge', state: 'PR' },
        { project: 'firefox', label: 'Firefox', state: 'MT' },
    ]
    : [
        { project: 'chromium', label: 'Chrome', state: 'CA' },
        { project: 'msedge', label: 'Edge', state: 'VA' },
        { project: 'firefox', label: 'Firefox', state: 'CO' },
    ];

const [specFile, suiteName] = process.argv.slice(2);
if (!specFile || !suiteName) {
    console.error('Usage: node tests/med-spa-suites/run-browsers.mjs <spec file> "<suite name>"');
    process.exit(2);
}

const mergedBlobDir = 'blob-browsers';
const htmlDir = 'playwright-report-parallel';
const jsonFile = 'test-results/suite-results.json';

const blobDirFor = (project) => `blob-${project}`;

function runBrowser({ project, state }) {
    return new Promise((resolve) => {
        const child = spawn(
            'npx',
            ['playwright', 'test', `--project=${project}`, '--headed', `--output=test-results/browser-${project}`, specFile],
            {
                stdio: 'inherit',
                env: {
                    ...process.env,
                    SPA_STATE: state,
                    SUITE_BLOB: '1',
                    BLOB_REPORT_DIR: blobDirFor(project),
                },
            },
        );
        child.on('close', (code) => resolve(code ?? 1));
    });
}

// Playwright clears its blob folder at the start of each run, so each browser writes to its own folder.
// Their zips are copied into one folder here so a single merge covers every browser.
const cleanup = () => {
    for (const { project } of BROWSERS) rmSync(blobDirFor(project), { recursive: true, force: true });
    rmSync(mergedBlobDir, { recursive: true, force: true });
};

cleanup();
rmSync(htmlDir, { recursive: true, force: true });
rmSync(jsonFile, { force: true });
mkdirSync('test-results', { recursive: true });

const exitCodes = await Promise.all(BROWSERS.map(runBrowser));
const failedBrowsers = BROWSERS.filter((_, i) => exitCodes[i] !== 0).map((b) => b.label);

mkdirSync(mergedBlobDir, { recursive: true });
for (const { project } of BROWSERS) {
    const dir = blobDirFor(project);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.zip'))) {
        copyFileSync(`${dir}/${file}`, `${mergedBlobDir}/${file}`);
    }
}

const jsonMerge = spawnSync(
    'npx',
    ['playwright', 'merge-reports', '--config=playwright.merge.config.ts', '--reporter=json', mergedBlobDir],
    { stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonFile } },
);
if (jsonMerge.status === 0 && existsSync(jsonFile)) {
    // The Slack layout groups tests by the top-level folder of their file, so the suite name is the first folder.
    const report = JSON.parse(readFileSync(jsonFile, 'utf8'));
    for (const suite of report.suites ?? []) {
        suite.file = `${suiteName}/${suite.file}`;
        suite.title = suite.file;
    }
    writeFileSync(jsonFile, JSON.stringify(report));
}

const htmlMerge = spawnSync(
    'npx',
    ['playwright', 'merge-reports', '--config=playwright.merge.config.ts', '--reporter=html', mergedBlobDir],
    { stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_HTML_OUTPUT_DIR: htmlDir, PLAYWRIGHT_HTML_TITLE: suiteName } },
);
if (htmlMerge.status !== 0) {
    console.error(`\nCould not merge the browser reports into ${htmlDir}/.`);
}

const mergeFailed = jsonMerge.status !== 0 || htmlMerge.status !== 0;
const runStatus = failedBrowsers.length || mergeFailed ? 'failed' : 'passed';
sendSlackSummary({
        runStatus,
        suiteNames: [suiteName],
        projects: BROWSERS.map((b) => b.project),
        jsonFile,
    });

cleanup();

if (failedBrowsers.length) {
    console.error(`\nFailed browsers: ${failedBrowsers.join(', ')}. Report: ${htmlDir}/index.html`);
}
if (mergeFailed) process.exit(1);
if (failedBrowsers.length) process.exit(1);
console.log(`\nAll browsers passed. Report: ${htmlDir}/index.html`);
