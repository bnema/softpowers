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
writeFileSync(markdownBody, `# Sample Spec\n\n## Problem and goals\n\nThis workflow should start from markdown.\n\n- Generate HTML\n- Generate a TOC\n\n## Chosen solution\n\nUse the helper scripts.\n\n\`\`\`bash\nnode scripts/create-spec-doc.mjs --title \"Sample Spec\" --body spec.md\n\`\`\`\n\n\`\`\`json\n{\n  "enabled": true,\n  "count": 2\n}\n\`\`\`\n`, 'utf8');

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
assert(generatedHtml.includes('<pre><code class="language-json sp-code-highlighted">'));
assert(generatedHtml.includes('<span class="sp-token-key">&quot;enabled&quot;</span>'));
assert(generatedHtml.includes('<span class="sp-token-boolean">true</span>'));
assert(generatedHtml.includes('<span class="sp-token-number">2</span>'));
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

const absoluteScriptOutPath = join(projectDir, 'absolute-script-spec.html');
const absoluteScriptCreate = spawnSync(
  node,
  [
    join(repoRoot, 'scripts/create-spec-doc.mjs'),
    '--title', 'Sample Spec',
    '--body', 'spec.md',
    '--out', 'absolute-script-spec.html',
    '--project-dir', projectDir,
    '--skip-path-check',
  ],
  {
    cwd: tmpRoot,
    encoding: 'utf8',
  }
);
assert.equal(absoluteScriptCreate.status, 0, absoluteScriptCreate.stderr || absoluteScriptCreate.stdout);
assert(existsSync(absoluteScriptOutPath));
const absoluteScriptValidate = spawnSync(
  node,
  [join(repoRoot, 'scripts/validate-spec-doc.mjs'), 'absolute-script-spec.html', '--project-dir', projectDir, '--skip-path-check'],
  {
    cwd: tmpRoot,
    encoding: 'utf8',
  }
);
assert.equal(absoluteScriptValidate.status, 0, absoluteScriptValidate.stderr || absoluteScriptValidate.stdout);

const createHelp = spawnSync(node, ['scripts/create-spec-doc.mjs', '--help'], {
  cwd: repoRoot,
  encoding: 'utf8',
});
assert.equal(createHelp.status, 0, createHelp.stderr || createHelp.stdout);
assert((createHelp.stderr + createHelp.stdout).includes('Usage:'));
assert((createHelp.stderr + createHelp.stdout).includes('create-spec-doc.mjs'));
assert((createHelp.stderr + createHelp.stdout).includes('create --title <title> --body <file>'));

const createShortHelp = spawnSync(node, ['scripts/create-spec-doc.mjs', '-h'], {
  cwd: repoRoot,
  encoding: 'utf8',
});
assert.equal(createShortHelp.status, 0, createShortHelp.stderr || createShortHelp.stdout);
assert((createShortHelp.stderr + createShortHelp.stdout).includes('Usage:'));

const createDashHelp = spawnSync(node, ['scripts/create-spec-doc.mjs', '-help'], {
  cwd: repoRoot,
  encoding: 'utf8',
});
assert.equal(createDashHelp.status, 0, createDashHelp.stderr || createDashHelp.stdout);
assert((createDashHelp.stderr + createDashHelp.stdout).includes('Usage:'));

const validateHelp = spawnSync(node, ['scripts/validate-spec-doc.mjs', '--help'], {
  cwd: repoRoot,
  encoding: 'utf8',
});
assert.equal(validateHelp.status, 0, validateHelp.stderr || validateHelp.stdout);
assert((validateHelp.stderr + validateHelp.stdout).includes('Usage:'));
assert((validateHelp.stderr + validateHelp.stdout).includes('validate-spec-doc.mjs'));
assert((validateHelp.stderr + validateHelp.stdout).includes('validate <path>'));

const validateShortHelp = spawnSync(node, ['scripts/validate-spec-doc.mjs', '-h'], {
  cwd: repoRoot,
  encoding: 'utf8',
});
assert.equal(validateShortHelp.status, 0, validateShortHelp.stderr || validateShortHelp.stdout);
assert((validateShortHelp.stderr + validateShortHelp.stdout).includes('Usage:'));

const validateDashHelp = spawnSync(node, ['scripts/validate-spec-doc.mjs', '-help'], {
  cwd: repoRoot,
  encoding: 'utf8',
});
assert.equal(validateDashHelp.status, 0, validateDashHelp.stderr || validateDashHelp.stdout);
assert((validateDashHelp.stderr + validateDashHelp.stdout).includes('Usage:'));

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
