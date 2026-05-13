import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const node = process.execPath;
const nodeBinDir = dirname(node);
const repoRoot = resolve('.');
const tmpRoot = mkdtempSync(join(tmpdir(), 'softpowers-html-docs-'));
const projectDir = join(tmpRoot, 'brand-new-project');
const docsRoot = join(tmpRoot, 'projects-docs');
mkdirSync(projectDir, { recursive: true });
mkdirSync(docsRoot, { recursive: true });

const markdownBody = join(projectDir, 'spec.md');
writeFileSync(markdownBody, `# Sample Spec\n\n## Problem and goals\n\nThis workflow should start from markdown.\n\n- Generate HTML\n- Generate a TOC\n\n## Chosen solution\n\nUse the helper scripts.\n\n\`\`\`bash\nnode scripts/create-spec-doc.mjs --title \"Sample Spec\" --body spec.md\n\`\`\`\n`, 'utf8');

const create = spawnSync(
  node,
  [
    'scripts/create-spec-doc.mjs',
    '--title', 'Sample Spec',
    '--slug', 'sample-spec',
    '--body', markdownBody,
    '--project-dir', projectDir,
    '--date', '2026-05-13',
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

const expectedHtmlPath = join(docsRoot, basename(projectDir), 'specs', '2026-05-13-sample-spec-design.html');
assert(existsSync(expectedHtmlPath), `Expected generated spec at ${expectedHtmlPath}`);
assert(create.stdout.includes(`Spec written: ${expectedHtmlPath}`));
assert(create.stdout.includes('Resolved repo name: brand-new-project (project directory basename)'));
assert(create.stdout.includes('Validation: OK'));

const generatedHtml = readFileSync(expectedHtmlPath, 'utf8');
assert(generatedHtml.includes('<h3>Table of contents</h3>'));
assert(generatedHtml.includes('href="#problem-and-goals"'));
assert(generatedHtml.includes('<section id="problem-and-goals" data-section="problem-and-goals">'));
assert(generatedHtml.includes('<pre><code class="language-bash">'));
assert(!generatedHtml.includes('{{OVERVIEW}}'));
assert(!generatedHtml.includes('{{TOC_ITEMS}}'));

const validate = spawnSync(
  node,
  ['scripts/validate-spec-doc.mjs', expectedHtmlPath, '--project-dir', projectDir],
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
assert(validate.stdout.includes(`Spec validated: ${expectedHtmlPath}`));

const htmlFragmentsPath = join(projectDir, 'spec-fragments.html');
writeFileSync(
  htmlFragmentsPath,
  `<section id="scope-and-non-goals">\n  <h2>Scope and non-goals</h2>\n  <p>Only improve the spec workflow.</p>\n</section>`,
  'utf8'
);

const customOutPath = join(projectDir, 'custom-output.html');
const createFromHtml = spawnSync(
  node,
  [
    'scripts/create-spec-doc.mjs',
    '--title', 'HTML fragments spec',
    '--body', htmlFragmentsPath,
    '--body-format', 'html',
    '--out', customOutPath,
    '--project-dir', projectDir,
    '--skip-path-check',
  ],
  {
    cwd: repoRoot,
    encoding: 'utf8',
  }
);
assert.equal(createFromHtml.status, 0, createFromHtml.stderr || createFromHtml.stdout);
const customOutHtml = readFileSync(customOutPath, 'utf8');
assert(customOutHtml.includes('href="#scope-and-non-goals"'));
assert(customOutHtml.includes('<section id="scope-and-non-goals">'));

const invalidHtmlPath = join(docsRoot, basename(projectDir), 'specs', '2026-05-13-invalid-design.html');
writeFileSync(invalidHtmlPath, generatedHtml.replace('Sample Spec', '{{DOC_TITLE}}'), 'utf8');
const invalidValidate = spawnSync(
  node,
  ['scripts/validate-spec-doc.mjs', invalidHtmlPath, '--project-dir', projectDir],
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

const noGitBodyPath = join(projectDir, 'no-git-spec.md');
writeFileSync(noGitBodyPath, `# No Git Spec\n\n## Problem and goals\n\nThis should still work when git is unavailable.\n`, 'utf8');
const noGitCreate = spawnSync(
  node,
  [
    'scripts/create-spec-doc.mjs',
    '--title', 'No Git Spec',
    '--body', noGitBodyPath,
    '--project-dir', projectDir,
    '--date', '2026-05-13',
  ],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: nodeBinDir,
      PROJECTS_DOCS_PATH: docsRoot,
    },
  }
);
assert.equal(noGitCreate.status, 0, noGitCreate.stderr || noGitCreate.stdout);
assert(noGitCreate.stdout.includes('Resolved repo name: brand-new-project (project directory basename)'));

console.log('All spec-doc CLI tests passed.');
