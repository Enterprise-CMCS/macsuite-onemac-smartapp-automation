import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const curlConfigFile = 'test-results/slack-curl-config.txt';
const BROWSER_LABELS = { chromium: 'Chrome', msedge: 'Edge', firefox: 'Firefox' };
const STATUS_LABELS = { expected: 'passed', unexpected: 'failed', flaky: 'flaky', skipped: 'skipped' };
const MAX_FAILURES_LISTED = 15;
const DETAIL_MAX_LENGTH = 150;
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

// Returns the first step (deepest first) that carries an error, so the summary names the action that failed.
function findErrorStep(steps = []) {
    for (const step of steps) {
        const nested = findErrorStep(step.steps);
        if (nested) return nested;
        if (step.error) return step;
    }
    return undefined;
}

// Returns "Step: <title> → <first line of the error>" for the last failed attempt, or undefined if there is none.
function failureDetail(test) {
    const result = [...(test.results ?? [])].reverse().find((r) => r.status !== 'passed' && r.status !== 'skipped');
    if (!result) return undefined;
    const step = findErrorStep(result.steps);
    const message = step?.error?.message ?? result.error?.message ?? '';
    const firstLine = message.replace(ANSI_PATTERN, '').split('\n').map((line) => line.trim()).find(Boolean);
    const text = [step?.title && `Step: ${step.title}`, firstLine].filter(Boolean).join(' → ');
    if (!text) return undefined;
    return text.length > DETAIL_MAX_LENGTH ? `${text.slice(0, DETAIL_MAX_LENGTH - 1)}…` : text;
}

// Collects each test's final status from a Playwright JSON suite tree, tagged with its browser project.
function collectTests(suite, tests = []) {
    for (const child of suite.suites ?? []) collectTests(child, tests);
    for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
            tests.push({
                name: spec.title,
                browser: test.projectName ?? 'unknown',
                status: STATUS_LABELS[test.status] ?? test.status,
                detail: test.status === 'unexpected' ? failureDetail(test) : undefined,
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
function buildMessage({ suiteCount, suiteNameFor, tests }) {
    const sections = [];
    const allPassed = tests.every((test) => test.status === 'passed' || test.status === 'skipped');
    sections.push(`${allPassed ? '✅' : '❌'} *Total Med SPA suites ran: ${suiteCount} suite${suiteCount === 1 ? '' : 's'}*`);

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
        const failedLines = failed.slice(0, MAX_FAILURES_LISTED).flatMap((test) => [
            `${INDENT}• ${test.name} (${BROWSER_LABELS[test.browser] ?? test.browser})`,
            ...(test.detail ? [`${INDENT}${INDENT}${test.detail}`] : []),
        ]);
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
export function sendSlackSummary({ suiteNames, jsonFile }) {
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
    // A single CI suite covers the whole report, so its name labels every test. With several suites, each step file is
    // prefixed with its suite name (see combineReports), so tests group under that suite instead of one line per step.
    const suiteNameFor = (fileTitle) =>
        suiteNames.length === 1 ? suiteNames[0] : (suiteNames.find((name) => fileTitle.startsWith(`${name}/`)) ?? fileTitle);
    const text = buildMessage({ suiteCount: suiteNames.length, suiteNameFor, tests });
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
