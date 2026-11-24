import { defineConfig } from '@playwright/test';

// Used only by tests/med-spa-suites/lib/run-suite.mjs to merge step reports. The steps use different testDirs
// (tests/smart and tests/onemac), so the merge needs their common parent.
export default defineConfig({
    testDir: './tests',
});
