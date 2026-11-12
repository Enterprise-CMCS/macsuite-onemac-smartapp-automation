import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const blobDir = 'blob-report';
const junitFile = 'test-results/junit-report.xml';

const blobCount = () => (existsSync(blobDir) ? readdirSync(blobDir).filter((f) => f.endsWith('.zip')).length : 0);

// Runs the steps in order, one at a time. The suite stops at the first failure.
export function runSuite(suite) {
    // Each step writes a blob report. Blobs from older runs are removed so they don't end up in the merged report.
    rmSync(blobDir, { recursive: true, force: true });
    mkdirSync('test-results', { recursive: true });

    let failedStep = null;
    const junitCopies = [];
    for (const [index, step] of suite.entries()) {
        console.log(`\n[${index + 1}/${suite.length}] ${step.name}`);
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
                    PLAYWRIGHT_BLOB_OUTPUT_NAME: `report-step-${index + 1}.zip`,
                },
            },
        );
        // The JUnit file is overwritten by every run, so keep each step's content. Playwright clears test-results/ at the start of each run, so copies are written after the last step.
        if (existsSync(junitFile)) {
            junitCopies.push({ index, content: readFileSync(junitFile, 'utf8') });
        }
        if (blobCount() === blobsBefore) {
            console.warn(`Warning: step ${index + 1} (${step.name}) did not write a report to ${blobDir}/. It will be missing from the merged report.`);
        }
        if (result.status !== 0) {
            failedStep = step;
            break;
        }
    }

    for (const { index, content } of junitCopies) {
        writeFileSync(`test-results/junit-${index + 1}.xml`, content);
    }

    // Merge runs even after a failure so the HTML report shows every step that ran. merge-reports takes the blob directory, not individual zip paths.
    const merge = spawnSync(
        'npx',
        ['playwright', 'merge-reports', '--config=playwright.merge.config.ts', '--reporter=html', blobDir],
        { stdio: 'inherit' },
    );
    if (merge.status !== 0) {
        console.error('\nCould not merge the step reports into playwright-report/.');
    }

    if (failedStep) {
        console.error(`\nSuite stopped at: ${failedStep.name}`);
        process.exit(1);
    }
    if (merge.status !== 0) {
        process.exit(merge.status ?? 1);
    }

    console.log('\nSuite passed. Report: playwright-report/index.html');
}
