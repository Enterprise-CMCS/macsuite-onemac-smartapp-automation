// Loaded by playwright-slack-report's CLI (customLayout), so it must stay plain CommonJS with no imports.
// Slack allows at most 50 blocks per message; the limits below keep the message under that.

const MAX_BLOCKS = 45;
const MAX_SECTION_CHARS = 2800;

const ICONS = { passed: '✅', failed: '❌', timedOut: '❌', interrupted: '❌', skipped: '⏭️' };

const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function iconFor(test) {
    if (test.status === 'passed' && test.retry > 0) return '⚠️';
    return ICONS[test.status] ?? '❔';
}

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

function chunkLines(lines) {
    const chunks = [];
    let current = '';
    for (const line of lines) {
        if (current && (current + '\n' + line).length > MAX_SECTION_CHARS) {
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
    const suiteName = summary.meta?.find((m) => m.key === 'Suite')?.value ?? 'Playwright suite';
    const runStatus = summary.runStatus ?? (summary.failed > 0 ? 'failed' : 'passed');
    const runPassed = runStatus === 'passed' && !summary.runErrors?.length;
    const tests = finalAttempts(summary.tests);
    const totals = countStatuses(tests);

    const blocks = [
        { type: 'header', text: { type: 'plain_text', text: `${runPassed ? '✅' : '❌'} ${suiteName}`.slice(0, 150) } },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*Passed:* ${totals.passed}   *Failed:* ${totals.failed}   *Skipped:* ${totals.skipped}   *Flaky:* ${totals.flaky}   *Run:* ${runStatus}`,
            },
        },
    ];

    if (summary.runErrors?.length) {
        blocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text: `*Run errors:* ${escape(summary.runErrors[0]).slice(0, 500)}` },
        });
    }

    const lines = [];
    for (const [name, groupTests] of groupByName(tests)) {
        const counts = countStatuses(groupTests);
        const icon = counts.failed > 0 ? '❌' : '✅';
        lines.push(`${icon} *${escape(name)}*\nPassed: ${counts.passed}   Failed: ${counts.failed}   Skipped: ${counts.skipped}   Flaky: ${counts.flaky}`);
        for (const test of groupTests) {
            if (test.status === 'skipped' || (test.status === 'passed' && !(test.retry > 0))) continue;
            lines.push(`    ${iconFor(test)} ${escape(test.name)}`);
        }
    }

    const chunks = chunkLines(lines);
    const room = MAX_BLOCKS - blocks.length;
    for (const text of chunks.slice(0, room)) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text } });
    }
    if (chunks.length > room) {
        blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: 'Some tests were not shown. See the HTML report.' }] });
    }

    return blocks;
};
