import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const node = process.execPath;
const repoRoot = resolve('.');
const tmpRoot = mkdtempSync(join(tmpdir(), 'softpowers-plan-docs-'));
const projectDir = join(tmpRoot, 'brand-new-project');
const docsRoot = join(tmpRoot, 'projects-docs');
mkdirSync(projectDir, { recursive: true });
mkdirSync(docsRoot, { recursive: true });

const specDir = join(docsRoot, basename(projectDir), 'specs');
mkdirSync(specDir, { recursive: true });
const specPath = join(specDir, '2026-05-15-sample-spec-design.html');
writeFileSync(
  specPath,
  `<!DOCTYPE html><html><body><section id="problem-and-goals"><h2>Problem and goals</h2></section></body></html>`,
  'utf8'
);

const markdownBody = join(projectDir, 'plan.md');
writeFileSync(markdownBody, `# Sample Plan\n\n## Phase 1: Foundation\nGoal: Build the plan HTML tooling.\n\nFiles:\n- Create \`scripts/plan-docs.mjs\`\n- Create \`scripts/create-plan-doc.mjs\`\n\n### Task 1: Add CLI coverage\n\n#### Step 1: Add plan doc CLI tests\nKind: test\nFile: tests/html-docs/plan-docs-cli.test.mjs\nLines: 1-120\nCommand: node tests/html-docs/plan-docs-cli.test.mjs\nSpec section: problem-and-goals\nWatchouts: Keep the temp directories isolated.\n\nWrite the failing test for the markdown-first workflow.\n\n#### Step 2: Run the failing test\nKind: verification\nCommand: node tests/html-docs/plan-docs-cli.test.mjs\nWatchouts: Expect the command to fail before implementation.\n\nRun the targeted test and capture the failure.\n`, 'utf8');

const create = spawnSync(
  node,
  [
    'scripts/create-plan-doc.mjs',
    '--title', 'Sample Plan',
    '--slug', 'sample-feature',
    '--body', markdownBody,
    '--spec', specPath,
    '--project-dir', projectDir,
    '--date', '2026-05-15',
  ],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PROJECTS_DOCS_PATH: docsRoot,
    },
  }
);
assert.equal(create.status, 0, create.stderr || create.stdout);

const expectedHtmlPath = join(docsRoot, basename(projectDir), 'plans', '2026-05-15-sample-feature.html');
assert(existsSync(expectedHtmlPath), `Expected generated plan at ${expectedHtmlPath}`);
assert(create.stdout.includes(`Plan written: ${expectedHtmlPath}`));
assert(create.stdout.includes('Resolved repo name: brand-new-project (project directory basename)'));
assert(create.stdout.includes('Validation: OK'));

const generatedHtml = readFileSync(expectedHtmlPath, 'utf8');
assert(generatedHtml.includes('<h3>Table of contents</h3>'));
assert(generatedHtml.includes('href="#phase-1"'));
assert(generatedHtml.includes('<section id="phase-1" class="sp-phase" data-phase-id="phase-1">'));
assert(generatedHtml.includes('<article id="task-1" class="sp-task" data-task-id="task-1">'));
assert(generatedHtml.includes('data-step-id="step-1"'));
assert(generatedHtml.includes('data-step-kind="test"'));
assert(generatedHtml.includes('../specs/2026-05-15-sample-spec-design.html#problem-and-goals'));
assert(generatedHtml.includes('Write the failing test for the markdown-first workflow.'));
assert(generatedHtml.includes('class="sp-review-checkpoint"'));
assert(!generatedHtml.includes('{{PHASE_TITLE}}'));
assert(!generatedHtml.includes('{{STEP_TITLE}}'));

const escapedTitleOutPath = join(projectDir, 'custom-title-plan.html');
const escapedTitleCreate = spawnSync(
  node,
  [
    'scripts/create-plan-doc.mjs',
    '--title', 'Sample <Plan> & "Doc"',
    '--slug', 'escaped-title-plan',
    '--body', markdownBody,
    '--spec', specPath,
    '--out', escapedTitleOutPath,
    '--project-dir', projectDir,
  ],
  {
    cwd: repoRoot,
    encoding: 'utf8',
  }
);
assert.equal(escapedTitleCreate.status, 0, escapedTitleCreate.stderr || escapedTitleCreate.stdout);
const escapedTitleHtml = readFileSync(escapedTitleOutPath, 'utf8');
assert(escapedTitleHtml.includes('Sample &lt;Plan&gt; &amp; &quot;Doc&quot;'));
assert(!escapedTitleHtml.includes('<h1 id="top">Sample <Plan> & "Doc"</h1>'));

const validate = spawnSync(
  node,
  ['scripts/validate-plan-doc.mjs', expectedHtmlPath, '--project-dir', projectDir],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PROJECTS_DOCS_PATH: docsRoot,
    },
  }
);
assert.equal(validate.status, 0, validate.stderr || validate.stdout);
assert(validate.stdout.includes(`Plan validated: ${expectedHtmlPath}`));

const invalidHtmlPath = join(docsRoot, basename(projectDir), 'plans', '2026-05-15-invalid-plan.html');
writeFileSync(invalidHtmlPath, generatedHtml.replace('Sample Plan', '{{DOC_TITLE}}'), 'utf8');
const invalidValidate = spawnSync(
  node,
  ['scripts/validate-plan-doc.mjs', invalidHtmlPath, '--project-dir', projectDir],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PROJECTS_DOCS_PATH: docsRoot,
    },
  }
);
assert.notEqual(invalidValidate.status, 0);
assert((invalidValidate.stderr + invalidValidate.stdout).includes('Unresolved template placeholders remain'));

const invalidSlugCreate = spawnSync(
  node,
  [
    'scripts/create-plan-doc.mjs',
    '--title', 'Broken Slug Plan',
    '--slug', '!!!',
    '--body', markdownBody,
    '--spec', specPath,
    '--project-dir', projectDir,
    '--date', '2026-05-15',
  ],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PROJECTS_DOCS_PATH: docsRoot,
    },
  }
);
assert.notEqual(invalidSlugCreate.status, 0);
assert((invalidSlugCreate.stderr + invalidSlugCreate.stdout).includes('Plan slug resolved to an empty value'));

const twoPhaseMarkdownBody = join(projectDir, 'two-phase-plan.md');
writeFileSync(
  twoPhaseMarkdownBody,
  `# Two Phase Plan\n\n## Phase 1: Foundation\nGoal: Build the foundation.\n\n### Task 1: First task\n\n#### Step 1: First implementation\nKind: implementation\nSpec section: problem-and-goals\n\nImplement the first phase.\n\n## Phase 2: Follow-up\nGoal: Add the second phase.\n\n### Task 2: Second task\n\n#### Step 2: Second implementation\nKind: implementation\nSpec section: problem-and-goals\n\nImplement the second phase.\n`,
  'utf8'
);
const twoPhaseHtmlPath = join(projectDir, 'two-phase-plan.html');
const twoPhaseCreate = spawnSync(
  node,
  [
    'scripts/create-plan-doc.mjs',
    '--title', 'Two Phase Plan',
    '--slug', 'two-phase-plan',
    '--body', twoPhaseMarkdownBody,
    '--spec', specPath,
    '--out', twoPhaseHtmlPath,
    '--project-dir', projectDir,
  ],
  {
    cwd: repoRoot,
    encoding: 'utf8',
  }
);
assert.equal(twoPhaseCreate.status, 0, twoPhaseCreate.stderr || twoPhaseCreate.stdout);
const twoPhaseHtml = readFileSync(twoPhaseHtmlPath, 'utf8');
const invalidCheckpointPath = join(projectDir, 'two-phase-missing-review.html');
const lastCheckpointStart = twoPhaseHtml.lastIndexOf('<div class="sp-review-checkpoint">');
assert.notEqual(lastCheckpointStart, -1);
const lastCheckpointEnd = twoPhaseHtml.indexOf('</div>', lastCheckpointStart);
assert.notEqual(lastCheckpointEnd, -1);
writeFileSync(
  invalidCheckpointPath,
  `${twoPhaseHtml.slice(0, lastCheckpointStart)}${twoPhaseHtml.slice(lastCheckpointEnd + '</div>'.length)}`,
  'utf8'
);
const invalidCheckpointValidate = spawnSync(
  node,
  ['scripts/validate-plan-doc.mjs', invalidCheckpointPath, '--project-dir', projectDir, '--skip-path-check'],
  {
    cwd: repoRoot,
    encoding: 'utf8',
  }
);
assert.notEqual(invalidCheckpointValidate.status, 0);
assert((invalidCheckpointValidate.stderr + invalidCheckpointValidate.stdout).includes('Each phase should have exactly one review checkpoint'));

const malformedMarkdownBody = join(projectDir, 'bad-plan.md');
writeFileSync(
  malformedMarkdownBody,
  `# Broken Plan\n\n## Phase 1: Foundation\nThis line should have been a Goal.\n\n### Task 1: Oops\n\n#### Step 1: Missing structure\nKind: implementation\n\nThis should fail parsing.\n`,
  'utf8'
);
const malformedCreate = spawnSync(
  node,
  [
    'scripts/create-plan-doc.mjs',
    '--title', 'Broken Plan',
    '--slug', 'broken-plan',
    '--body', malformedMarkdownBody,
    '--spec', specPath,
    '--project-dir', projectDir,
    '--date', '2026-05-15',
  ],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PROJECTS_DOCS_PATH: docsRoot,
    },
  }
);
assert.notEqual(malformedCreate.status, 0);
assert((malformedCreate.stderr + malformedCreate.stdout).includes('Unexpected content in phase'));

console.log('All plan-doc CLI tests passed.');
