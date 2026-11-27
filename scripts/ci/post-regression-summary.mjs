import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadSuites } from '../../tests/med-spa-suites/lib/suite-list.mjs';
import { sendSlackSummary } from '../../tests/med-spa-suites/lib/slack.mjs';

// Combines each lane's suite-results.json into one report and posts a single Slack message.
// Usage: node scripts/ci/post-regression-summary.mjs <directory holding one folder per lane artifact>
// RUN_STATUS (passed or failed) comes from the workflow, which knows whether every lane passed.
const lanesDirectory = process.argv[2];
if (!lanesDirectory || !existsSync(lanesDirectory)) {
    console.error('Usage: node scripts/ci/post-regression-summary.mjs <lanes directory>');
    process.exit(2);
}

const combined = {
    config: {},
    suites: [],
    errors: [],
    stats: { startTime: new Date().toISOString(), duration: 0, expected: 0, unexpected: 0, flaky: 0, skipped: 0 },
};
for (const lane of readdirSync(lanesDirectory).sort()) {
    const file = path.join(lanesDirectory, lane, 'suite-results.json');
    if (!existsSync(file)) {
        console.warn(`No suite-results.json in ${lane}. That lane may have stopped before writing a report.`);
        continue;
    }
    const report = JSON.parse(readFileSync(file, 'utf8'));
    if (!combined.config.projects) combined.config = report.config ?? {};
    combined.suites.push(...(report.suites ?? []));
    combined.errors.push(...(report.errors ?? []));
    for (const key of ['duration', 'expected', 'unexpected', 'flaky', 'skipped']) {
        combined.stats[key] += report.stats?.[key] ?? 0;
    }
}

mkdirSync('test-results', { recursive: true });
const jsonFile = 'test-results/regression-results.json';
writeFileSync(jsonFile, JSON.stringify(combined));

const suiteNames = (await loadSuites()).map((suite) => suite.name);
sendSlackSummary({
    runStatus: process.env.RUN_STATUS === 'passed' ? 'passed' : 'failed',
    suiteNames,
    jsonFile,
});
