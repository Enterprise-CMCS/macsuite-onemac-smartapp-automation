import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { sendSlackSummary } from './slack.mjs';

const blobDir = 'blob-report';
const suiteReportDir = 'test-results/suite-reports';
const junitFile = 'test-results/junit-report.xml';
const jsonFile = 'test-results/suite-results.json';

const blobCount = () => (existsSync(blobDir) ? readdirSync(blobDir).filter((f) => f.endsWith('.zip')).length : 0);

const keyFor = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Joins each suite's JSON report into one. Each top-level suite is prefixed with the suite name so the Slack layout can group by it.
function combineReports(parts) {
    const combined = {
        config: {},
        suites: [],
        errors: [],
        stats: { startTime: new Date().toISOString(), duration: 0, expected: 0, unexpected: 0, flaky: 0, skipped: 0 },
    };
    for (const { name, file } of parts) {
        const report = JSON.parse(readFileSync(file, 'utf8'));
        if (!combined.config.projects) combined.config = report.config ?? {};
        for (const suite of report.suites ?? []) {
            suite.file = `${name}/${suite.file}`;
            suite.title = suite.file;
            combined.suites.push(suite);
        }
        combined.errors.push(...(report.errors ?? []));
        for (const key of ['duration', 'expected', 'unexpected', 'flaky', 'skipped']) {
            combined.stats[key] += report.stats?.[key] ?? 0;
        }
    }
    return combined;
}

// Runs each suite's steps in order. A suite stops at its first failed step, and the other suites still run.
// One Slack message covers all suites, with a section per suite.
export function runSuites(suites, { title = 'Playwright suite' } = {}) {
    // Blobs from older runs are removed so they don't end up in the merged report.
    rmSync(blobDir, { recursive: true, force: true });
    rmSync(suiteReportDir, { recursive: true, force: true });
    rmSync(jsonFile, { force: true });
    mkdirSync('test-results', { recursive: true });

    const failedSuites = [];
    const junitCopies = [];
    const keys = [];
    for (const suite of suites) {
        const key = keyFor(suite.name);
        keys.push({ name: suite.name, key });
        console.log(`\n=== ${suite.name} ===`);
        let failedStep = null;
        for (const [index, step] of suite.steps.entries()) {
            console.log(`\n[${index + 1}/${suite.steps.length}] ${step.name}`);
            rmSync(junitFile, { force: true });
            const blobsBefore = blobCount();
            const result = spawnSync(
                'npx',
                ['playwright', 'test', `--config=${step.config}`, step.file, ...step.args],
                {
                    stdio: 'inherit',
                    // Playwright clears the blob folder on every run unless told not to, which would drop earlier steps.
                    env: {
                        ...process.env,
                        // SMART steps pick their Salesforce user from SF_ROLE. Without it, every step falls back to INTAKE.
                        ...(step.role ? { SF_ROLE: step.role } : {}),
                        SUITE_BLOB: '1',
                        PWTEST_BLOB_DO_NOT_REMOVE: '1',
                        PLAYWRIGHT_BLOB_OUTPUT_NAME: `${key}-step-${index + 1}.zip`,
                    },
                },
            );
            // The JUnit file is overwritten by every run, so keep each step's content. Playwright clears test-results/ at the start of each run, so copies are written after the last step.
            if (existsSync(junitFile)) {
                junitCopies.push({ name: `${key}-${index + 1}`, content: readFileSync(junitFile, 'utf8') });
            }
            if (blobCount() === blobsBefore) {
                console.warn(`Warning: step ${index + 1} (${step.name}) did not write a report to ${blobDir}/. It will be missing from the merged report.`);
            }
            if (result.status !== 0) {
                failedStep = step;
                break;
            }
        }
        if (failedStep) {
            failedSuites.push(suite.name);
            console.error(`\n${suite.name} stopped at: ${failedStep.name}`);
        }
    }

    for (const { name, content } of junitCopies) {
        writeFileSync(`test-results/junit-${name}.xml`, content);
    }

    // Each suite is merged on its own, because the same spec can run in more than one suite and a single merge would mix their results.
    const parts = [];
    let mergeFailed = false;
    for (const { name, key } of keys) {
        const dir = `${suiteReportDir}/${key}`;
        mkdirSync(dir, { recursive: true });
        for (const file of readdirSync(blobDir).filter((f) => f.startsWith(`${key}-step-`) && f.endsWith('.zip'))) {
            copyFileSync(`${blobDir}/${file}`, `${dir}/${file}`);
        }
        const file = `${suiteReportDir}/${key}.json`;
        const merge = spawnSync(
            'npx',
            ['playwright', 'merge-reports', '--config=playwright.merge.config.ts', '--reporter=json', dir],
            { stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: file } },
        );
        if (merge.status === 0 && existsSync(file)) {
            parts.push({ name, file });
        } else {
            mergeFailed = true;
            console.error(`\nCould not merge the step reports for ${name}.`);
        }
    }

    // Merge runs even after a failure so the HTML report shows every step that ran. merge-reports takes the blob directory, not individual zip paths.
    // PLAYWRIGHT_HTML_TITLE sets the report title, so the HTML report opens with the suite name.
    const htmlMerge = spawnSync(
        'npx',
        ['playwright', 'merge-reports', '--config=playwright.merge.config.ts', '--reporter=html', blobDir],
        { stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_HTML_TITLE: title } },
    );
    if (htmlMerge.status !== 0) {
        console.error('\nCould not merge the step reports into playwright-report/.');
    }

    if (parts.length) {
        writeFileSync(jsonFile, JSON.stringify(combineReports(parts)));
    }
    const runStatus = failedSuites.length || mergeFailed || htmlMerge.status !== 0 ? 'failed' : 'passed';
    sendSlackSummary({ title, runStatus, suiteNames: keys.map((k) => k.name), jsonFile });

    if (failedSuites.length) {
        console.error(`\nFailed suites: ${failedSuites.join(', ')}`);
        process.exit(1);
    }
    if (mergeFailed || htmlMerge.status !== 0) {
        process.exit(1);
    }

    console.log('\nAll suites passed. Report: playwright-report/index.html');
}
