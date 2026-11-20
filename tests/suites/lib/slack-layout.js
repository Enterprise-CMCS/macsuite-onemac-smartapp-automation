// Loaded by playwright-slack-report's CLI (customLayout), so it must stay plain CommonJS with no imports.
// Slack allows at most 50 blocks per message; the limits below keep the message under that.

const SPA_TYPE = 'Med SPA';
const BROWSER_LABELS = { chromium: 'Chrome', msedge: 'Edge', firefox: 'Firefox' };
const MAX_BLOCKS = 45;
const MAX_SECTION_CHARS = 2800;
// Slack caps each context element's text at 2000 characters.
const MAX_CONTEXT_CHARS = 1900;

const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The parser emits one entry per attempt, so keep only the final attempt of each test.
function finalAttempts(tests) {
    const finals = new Map();
    for (const test of tests) {
        const key = `${test.suiteName}\u0000${test.name}\u0000${test.projectName ?? ''}`;
        const current = finals.get(key);
        if (!current || test.retry > current.retry) finals.set(key, test);
    }
    return [...finals.values()];
}

const FAILED_STATUSES = new Set(['failed', 'timedOut', 'interrupted']);

function browserIconFor(tests) {
    const counts = countStatuses(tests);
    if (tests.length === 0 || counts.failed > 0) return '❌';
    if (counts.flaky > 0) return '!';
    if (counts.passed > 0) return '✅';
    return '–';
}

function browserSummary(tests) {
    const counts = countStatuses(tests);
    const parts = [];
    if (counts.passed) parts.push(`${counts.passed} passed`);
    if (counts.failed) parts.push(`${counts.failed} failed`);
    if (counts.flaky) parts.push(`${counts.flaky} flaky`);
    if (counts.skipped) parts.push(`${counts.skipped} skipped`);
    return parts.join(', ') || 'no result';
}

// Groups by the top-level folder of each test's file. Replace the key when results carry the real suite name.
function groupByName(tests) {
    const groups = new Map();
    for (const test of tests) {
        const name = test.suiteName.split('/')[0];
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(test);
    }
    return groups;
}

function countStatuses(tests) {
    const counts = { passed: 0, failed: 0, skipped: 0, flaky: 0 };
    for (const test of tests) {
        if (FAILED_STATUSES.has(test.status)) counts.failed++;
        else if (test.status === 'skipped') counts.skipped++;
        else if (test.retry > 0) counts.flaky++;
        else counts.passed++;
    }
    return counts;
}

function chunkLines(lines, maxChars = MAX_SECTION_CHARS) {
    const chunks = [];
    let current = '';
    for (const line of lines) {
        if (current && (current + '\n' + line).length > maxChars) {
            chunks.push(current);
            current = line;
        } else {
            current = current ? current + '\n' + line : line;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

exports.generateSuiteLayout = function generateSuiteLayout(summary) {
    const suiteNames = (summary.meta?.find((m) => m.key === 'Suites')?.value ?? '').split('|').filter(Boolean);
    const runStatus = summary.runStatus ?? (summary.failed > 0 ? 'failed' : 'passed');
    const runPassed = runStatus === 'passed' && !summary.runErrors?.length;
    const tests = finalAttempts(summary.tests);
    const totals = countStatuses(tests);
    const groups = groupByName(tests);
    const total = suiteNames.length || groups.size;

    const blocks = [
        { type: 'header', text: { type: 'plain_text', text: `${runPassed ? '✅' : '❌'} Total ${SPA_TYPE}: ${total} ${total === 1 ? 'suite' : 'suites'}` } },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*Test runs:* ${totals.passed} passed, ${totals.failed} failed, ${totals.skipped} skipped, ${totals.flaky} flaky   *Run:* ${runStatus}`,
            },
        },
    ];

    if (summary.runErrors?.length) {
        blocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text: `*Run errors:* ${escape(summary.runErrors[0]).slice(0, 500)}` },
        });
    }

    const names = suiteNames.length ? suiteNames : [...groups.keys()];
    const projects = (summary.meta?.find((m) => m.key === 'Projects')?.value ?? '').split('|').filter(Boolean);
    // Each suite is a normal-size line, with its browser rows in a context block so Slack shows them smaller.
    const suiteBlocks = [];
    for (const name of names) {
        const groupTests = groups.get(name) ?? [];
        const browserNames = projects.length ? projects : [...new Set(groupTests.map((t) => t.projectName ?? ''))];
        const suiteFailed = groupTests.length === 0 || groupTests.some((t) => FAILED_STATUSES.has(t.status));
        const browserLines = [];
        for (const project of browserNames) {
            const browserTests = groupTests.filter((t) => (t.projectName ?? '') === project);
            const label = escape(BROWSER_LABELS[project] ?? project);
            browserLines.push(`${browserIconFor(browserTests)} ${label}: ${browserSummary(browserTests)}`);
            for (const test of browserTests) {
                if (FAILED_STATUSES.has(test.status)) browserLines.push(`    ↳ ${escape(test.name)}`);
            }
        }
        suiteBlocks.push({ type: 'section', text: { type: 'mrkdwn', text: `${suiteFailed ? '✗' : '✓'} *${escape(name)}*` } });
        for (const text of chunkLines(browserLines, MAX_CONTEXT_CHARS)) {
            suiteBlocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text }] });
        }
    }

    const room = MAX_BLOCKS - blocks.length;
    blocks.push(...suiteBlocks.slice(0, room));
    if (suiteBlocks.length > room) {
        blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: 'Some tests were not shown. See the HTML report.' }] });
    }

    return blocks;
};
