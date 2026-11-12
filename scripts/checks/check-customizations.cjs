const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseDocument } = require('yaml');

const root = path.resolve(__dirname, '../..');
const entries = [
    '.github/agents/smart-test-author.agent.md',
    '.github/skills/smart-browser-capture/SKILL.md',
    '.github/skills/salesforce-locators/SKILL.md',
    '.github/skills/playwright-test-validation/SKILL.md',
    '.github/skills/requirements-to-automation/SKILL.md',
];

for (const entry of entries) {
    const filename = path.join(root, entry);
    const source = fs.readFileSync(filename, 'utf8');
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/);
    assert.ok(match, `Missing frontmatter or body: ${entry}`);
    const document = parseDocument(match[1], { uniqueKeys: true });
    assert.equal(document.errors.length, 0, `Invalid YAML: ${entry}`);
    const metadata = document.toJS();
    assert.ok(typeof metadata.description === 'string' && metadata.description.trim(), `Missing description: ${entry}`);
    assert.ok(typeof metadata.name === 'string' && metadata.name.trim(), `Missing name: ${entry}`);
    if (path.basename(filename) === 'SKILL.md') {
        assert.equal(metadata.name, path.basename(path.dirname(filename)), `Skill name/folder mismatch: ${entry}`);
        assert.match(metadata.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        assert.ok(metadata.name.length <= 64 && metadata.description.length <= 1024);
    }
    for (const link of match[2].matchAll(/\]\(([^)]+)\)/g)) {
        if (/^https?:\/\//.test(link[1])) continue;
        assert.ok(fs.existsSync(path.resolve(path.dirname(filename), link[1].split('#')[0])), `Broken local link in ${entry}: ${link[1]}`);
    }
    console.log(`PASS ${entry}`);
}
assert.ok(fs.existsSync(path.join(root, '.github/copilot-instructions.md')));

const workflowFile = '.github/workflows/quality.yml';
const workflowDocument = parseDocument(fs.readFileSync(path.join(root, workflowFile), 'utf8'), { uniqueKeys: true });
assert.equal(workflowDocument.errors.length, 0, `Invalid workflow YAML: ${workflowFile}`);
const workflow = workflowDocument.toJS();
assert.ok(workflow.on.pull_request !== undefined || Object.hasOwn(workflow.on, 'pull_request'));
assert.equal(workflow.permissions.contents, 'read');
assert.ok(workflow.jobs.quality.steps.some((step) => step.run === 'npm run quality'));
console.log(`PASS ${workflowFile}`);