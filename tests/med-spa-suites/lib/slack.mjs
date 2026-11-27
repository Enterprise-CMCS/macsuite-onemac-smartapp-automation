import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const curlConfigFile = 'test-results/slack-curl-config.txt';
const BROWSER_LABELS = { chromium: 'Chrome', msedge: 'Edge', firefox: 'Firefox' };
const STATUS_LABELS = { expected: 'passed', unexpected: 'failed', flaky: 'flaky', skipped: 'skipped' };
const MAX_FAILURES_LISTED = 15;

// Collects each test's final status from a Playwright JSON suite tree, tagged with its browser project.
function collectTests(suite, parentTitles = [], tests = []) {
    const titles = suite.title ? [...parentTitles, suite.title] : parentTitles;
    for (const child of suite.suites ?? []) collectTests(child, titles, tests);
    for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
            tests.push({
                name: [...titles, spec.title].join(' › '),
                browser: test.projectName ?? 'unknown',
                status: STATUS_LABELS[test.status] ?? test.status,
            });
        }
    }
    return tests;
}

// Slack can collapse ordinary leading spaces, so indented lines use non-breaking spaces.
const INDENT = '\u00A0\u00A0\u00A0\u00A0';
const STATUS_ORDER = ['passed', 'failed', 'skipped', 'flaky'];

const countStatuses = (tests) => {
    const counts = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0]));
    for (const test of tests) counts[test.status] = (counts[test.status] ?? 0) + 1;
    return counts;
};

const groupBy = (items, keyOf) => {
    const groups = new Map();
    for (const item of items) {
        const key = keyOf(item);
        groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return groups;
};

// One suite per run in CI. The test view can be a multi-file report, so each file is its own block.
function buildMessage({ title, suiteCount, suiteNameFor, tests }) {
    const sections = [];
    const allPassed = tests.every((test) => test.status === 'passed' || test.status === 'skipped');
    sections.push(`${allPassed ? '✅' : '❌'} *Total ${title}: ${suiteCount} suite${suiteCount === 1 ? '' : 's'}*`);

    for (const [suite, suiteTests] of groupBy(tests, (test) => suiteNameFor(test.suite))) {
        const counts = countStatuses(suiteTests);
        const suiteFailed = counts.failed > 0;
        const summary = STATUS_ORDER.map((status) => `${counts[status]} ${status}`).join(', ');
        const lines = [`${suiteFailed ? '✗' : '✓'} *${suite}*  ${summary}`];
        for (const [browser, browserTests] of groupBy(suiteTests, (test) => test.browser)) {
            const browserCounts = countStatuses(browserTests);
            const browserSummary = STATUS_ORDER.filter((status) => browserCounts[status])
                .map((status) => `${browserCounts[status]} ${status}`)
                .join(', ');
            const browserFailed = browserCounts.failed > 0;
            lines.push(`${INDENT}${browserFailed ? '❌' : '✅'} ${BROWSER_LABELS[browser] ?? browser}: ${browserSummary}`);
        }
        sections.push(lines.join('\n'));
    }

    const failed = tests.filter((test) => test.status === 'failed');
    if (failed.length) {
        const failedLines = failed
            .slice(0, MAX_FAILURES_LISTED)
            .map((test) => `${INDENT}• ${test.name} (${BROWSER_LABELS[test.browser] ?? test.browser})`);
        if (failed.length > MAX_FAILURES_LISTED) {
            failedLines.push(`${INDENT}…and ${failed.length - MAX_FAILURES_LISTED} more`);
        }
        sections.push(['*Failed tests*', ...failedLines].join('\n'));
    }

    const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
    if (GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID) {
        const runUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
        sections.push(`<${runUrl}|View the run in GitHub Actions>`);
    }
    return sections.join('\n\n');
}

// Sends one plain-text message to the Slack workflow webhook. The URL is kept in a temporary curl config and removed afterward.
// suiteNames lists the suites in run order. jsonFile is the Playwright JSON report for the run.
export function sendSlackSummary({ title, suiteNames, jsonFile }) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
        console.warn('\nSLACK_WEBHOOK_URL is not set. Skipping the Slack summary.');
        return;
    }
    if (!existsSync(jsonFile)) {
        console.warn(`\nNo ${jsonFile} was written. Skipping the Slack summary.`);
        return;
    }
    const report = JSON.parse(readFileSync(jsonFile, 'utf8'));
    const tests = (report.suites ?? []).flatMap((suite) =>
        collectTests(suite).map((test) => ({ ...test, suite: suite.title || 'Tests' })),
    );
    // A single CI suite covers the whole report, so its name labels every test.
    const suiteNameFor = (fileTitle) => (suiteNames.length === 1 ? suiteNames[0] : fileTitle);
    const text = buildMessage({ title, suiteCount: suiteNames.length, suiteNameFor, tests });
    try {
        writeFileSync(curlConfigFile, `url = "${webhookUrl}"\nheader = "Content-Type: application/json"\n`, { mode: 0o600 });
        const send = spawnSync(
            'curl',
            ['--silent', '--show-error', '--fail', '--config', curlConfigFile, '--data-binary', '@-'],
            { input: JSON.stringify({ text }), encoding: 'utf8' },
        );
        if (send.status !== 0) {
            console.error(`\nCould not send the Slack summary. ${send.stderr}`);
        }
    } finally {
        rmSync(curlConfigFile, { force: true });
    }
}
