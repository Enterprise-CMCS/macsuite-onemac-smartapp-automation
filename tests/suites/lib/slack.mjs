import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const slackConfigFile = 'test-results/slack-cli-config.json';
const slackLayoutFile = fileURLToPath(new URL('./slack-layout.js', import.meta.url));

// Sends one Slack message for a run. The webhook URL is written to a temporary config and removed afterward.
// suiteNames sets the suite count and the order of the rows. projects (Playwright project names) sets the browser rows under each suite.
export function sendSlackSummary({ title, runStatus, suiteNames, projects = [], jsonFile }) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
        console.warn('\nSLACK_WEBHOOK_URL is not set. Skipping the Slack summary.');
        return;
    }
    if (!existsSync(jsonFile)) {
        console.warn(`\nNo ${jsonFile} was written. Skipping the Slack summary.`);
        return;
    }
    const config = {
        sendResults: 'always',
        slackLogLevel: 'error',
        sendUsingWebhook: { webhookUrl },
        showInThread: false,
        disableUnfurl: true,
        meta: [
            { key: 'Suite', value: title },
            // Suite names are passed in run order so the Slack layout lists every suite, even one that stopped before its first test.
            { key: 'Suites', value: suiteNames.join('|') },
            { key: 'Projects', value: projects.join('|') },
        ],
        customLayout: { source: slackLayoutFile, functionName: 'generateSuiteLayout' },
    };
    try {
        writeFileSync(slackConfigFile, JSON.stringify(config), { mode: 0o600 });
        const send = spawnSync(
            'npx',
            ['playwright-slack-report', '-c', slackConfigFile, '-j', jsonFile, '--run-status', runStatus],
            { stdio: 'inherit' },
        );
        if (send.status !== 0) {
            console.error('\nCould not send the Slack summary.');
        }
    } finally {
        rmSync(slackConfigFile, { force: true });
    }
}
