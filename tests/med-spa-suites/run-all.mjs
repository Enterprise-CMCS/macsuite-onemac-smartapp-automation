import { fileURLToPath } from 'node:url';
import { runSuites } from './lib/run-suite.mjs';
import { loadSuites } from './lib/suite-list.mjs';

const suites = await loadSuites();

// SUITE_LANE=<n>/<total> runs only every <total>th suite starting at position n, so parallel CI lanes split the suites between them.
// SUITE_LIMIT=<count> keeps only the first <count> suites before the lanes split them. Unset or 0 runs every suite.
function selectLane(all) {
    const limit = Number(process.env.SUITE_LIMIT?.trim() || 0);
    const candidates = limit > 0 ? all.slice(0, limit) : all;
    const lane = process.env.SUITE_LANE?.trim();
    if (!lane) return { selected: candidates, title: 'Total: Med SPA suites' };
    const match = /^(\d+)\/(\d+)$/.exec(lane);
    const number = Number(match?.[1]);
    const total = Number(match?.[2]);
    if (!match || number < 1 || number > total) {
        console.error(`SUITE_LANE must look like 1/2 (lane/total). Got: ${lane}`);
        process.exit(2);
    }
    return { selected: candidates.filter((_, index) => index % total === number - 1), title: `Regression lane ${number}/${total}` };
}

// Each suite runs on its own, and one Slack message covers all of them.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const { selected, title } = selectLane(suites);
    runSuites(selected, { title });
}
