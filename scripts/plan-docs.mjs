#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveDocsRoot, resolveRepoName } from './spec-docs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const PLAN_TEMPLATE_PATH = resolve(root, 'templates', 'plan.template.html');
const PLACEHOLDER_PATTERN = /\{\{[A-Z0-9_:-]+\}\}/g;
const ALLOWED_STEP_KINDS = new Set(['implementation', 'test', 'verification', 'commit', 'review']);

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", '&#39;');
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function tokenizeInline(text, regex, toHtml, tokens) {
  return text.replace(regex, (...args) => {
    const html = toHtml(...args);
    const token = `__PLAN_DOC_TOKEN_${tokens.length}__`;
    tokens.push(html);
    return token;
  });
}

function formatInline(text) {
  const tokens = [];
  let value = String(text);

  value = tokenizeInline(value, /`([^`]+)`/g, (_, code) => {
    return `<code>${escapeHtml(code)}</code>`;
  }, tokens);

  value = tokenizeInline(value, /\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    return `<a href="${escapeAttribute(href)}">${escapeHtml(label)}</a>`;
  }, tokens);

  value = escapeHtml(value);
  value = value.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  value = value.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  value = value.replace(/__PLAN_DOC_TOKEN_(\d+)__/g, (_, index) => tokens[Number(index)]);
  return value;
}

function renderCodeBlock(language, lines) {
  const langAttr = language ? ` class="language-${escapeAttribute(language)}"` : '';
  return `<pre><code${langAttr}>${escapeHtml(lines.join('\n'))}</code></pre>`;
}

function renderMarkdownFragment(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const parts = [];
  let paragraph = [];
  let list = null;
  let codeBlock = null;

  function flushParagraph() {
    if (!paragraph.length) {
      return;
    }
    parts.push(`<p>${formatInline(paragraph.join(' ').trim())}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!list) {
      return;
    }
    const items = list.items.map((item) => `  <li>${formatInline(item)}</li>`).join('\n');
    parts.push(`<${list.type}>\n${items}\n</${list.type}>`);
    list = null;
  }

  function flushCodeBlock() {
    if (!codeBlock) {
      return;
    }
    parts.push(renderCodeBlock(codeBlock.language, codeBlock.lines));
    codeBlock = null;
  }

  function flushFlowContent() {
    flushParagraph();
    flushList();
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '  ');
    const trimmed = line.trim();

    if (codeBlock) {
      if (trimmed.startsWith('```')) {
        flushCodeBlock();
      } else {
        codeBlock.lines.push(rawLine);
      }
      continue;
    }

    if (trimmed.startsWith('```')) {
      flushFlowContent();
      codeBlock = {
        language: trimmed.slice(3).trim(),
        lines: [],
      };
      continue;
    }

    if (!trimmed) {
      flushFlowContent();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushFlowContent();
      const level = Math.min(6, headingMatch[1].length + 1);
      parts.push(`<h${level}>${formatInline(headingMatch[2].trim())}</h${level}>`);
      continue;
    }

    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (!list || list.type !== 'ol') {
        flushList();
        list = { type: 'ol', items: [] };
      }
      list.items.push(orderedMatch[2].trim());
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (!list || list.type !== 'ul') {
        flushList();
        list = { type: 'ul', items: [] };
      }
      list.items.push(unorderedMatch[1].trim());
      continue;
    }

    paragraph.push(trimmed);
  }

  flushFlowContent();
  flushCodeBlock();
  return parts.join('\n\n');
}

function normalizePhaseTitle(value) {
  return String(value).replace(/^Phase\s+\d+:\s*/i, '').trim();
}

function normalizeTaskTitle(value) {
  return String(value).replace(/^Task\s+\d+:\s*/i, '').trim();
}

function normalizeStepTitle(value) {
  return String(value).replace(/^Step\s+\d+:\s*/i, '').trim();
}

function parseStepMetadata(step, trimmed) {
  const metadata = [
    ['kind', /^Kind:\s*(.+)$/i],
    ['file', /^File:\s*(.+)$/i],
    ['lines', /^Lines:\s*(.+)$/i],
    ['command', /^Command:\s*(.+)$/i],
    ['specSection', /^Spec section:\s*(.+)$/i],
    ['watchouts', /^Watchouts:\s*(.+)$/i],
  ];

  for (const [key, pattern] of metadata) {
    const match = trimmed.match(pattern);
    if (match) {
      step[key] = match[1].trim();
      return true;
    }
  }

  return false;
}

function parsePlanMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const phases = [];
  let currentPhase = null;
  let currentTask = null;
  let currentStep = null;
  let currentStepBody = [];
  let filesMode = false;
  let stepMetadataMode = false;
  let title = null;

  function flushStep() {
    if (!currentStep) {
      return;
    }
    currentStep.bodyHtml = renderMarkdownFragment(currentStepBody.join('\n').trim());
    currentStepBody = [];

    if (!currentStep.title) {
      throw new Error('Each plan step needs a heading like "#### Step 1: Name".');
    }
    if (!ALLOWED_STEP_KINDS.has(currentStep.kind)) {
      throw new Error(`Unsupported step kind "${currentStep.kind}" for step "${currentStep.title}".`);
    }

    currentTask.steps.push(currentStep);
    currentStep = null;
    stepMetadataMode = false;
  }

  function flushTask() {
    flushStep();
    if (!currentTask) {
      return;
    }
    if (!currentTask.steps.length) {
      throw new Error(`Task "${currentTask.title}" must contain at least one step.`);
    }
    currentPhase.tasks.push(currentTask);
    currentTask = null;
  }

  function flushPhase() {
    flushTask();
    if (!currentPhase) {
      return;
    }
    if (!currentPhase.goal) {
      throw new Error(`Phase "${currentPhase.title}" is missing a "Goal:" line.`);
    }
    if (!currentPhase.tasks.length) {
      throw new Error(`Phase "${currentPhase.title}" must contain at least one task.`);
    }
    phases.push(currentPhase);
    currentPhase = null;
    filesMode = false;
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);

    if (headingMatch) {
      filesMode = false;
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();

      if (level === 1) {
        title ??= headingText;
        continue;
      }

      if (level === 2) {
        flushPhase();
        currentPhase = {
          title: normalizePhaseTitle(headingText),
          goal: '',
          files: [],
          tasks: [],
        };
        continue;
      }

      if (level === 3) {
        if (!currentPhase) {
          throw new Error(`Task heading appears before any phase: ${headingText}`);
        }
        flushTask();
        currentTask = {
          title: normalizeTaskTitle(headingText),
          steps: [],
        };
        continue;
      }

      if (level === 4) {
        if (!currentTask) {
          throw new Error(`Step heading appears before any task: ${headingText}`);
        }
        flushStep();
        currentStep = {
          title: normalizeStepTitle(headingText),
          kind: 'implementation',
          file: '',
          lines: '',
          command: '',
          specSection: '',
          watchouts: '',
          bodyHtml: '',
        };
        currentStepBody = [];
        stepMetadataMode = true;
        continue;
      }
    }

    if (!trimmed) {
      if (currentStep) {
        if (stepMetadataMode && currentStepBody.length === 0) {
          stepMetadataMode = false;
        } else {
          currentStepBody.push('');
        }
      }
      filesMode = filesMode && !currentTask && !currentStep;
      continue;
    }

    if (currentStep) {
      if (stepMetadataMode && parseStepMetadata(currentStep, trimmed)) {
        continue;
      }
      stepMetadataMode = false;
      currentStepBody.push(rawLine);
      continue;
    }

    if (currentTask) {
      throw new Error(`Unexpected content inside task "${currentTask.title}" before a step heading: ${trimmed}`);
    }

    if (filesMode) {
      const fileItem = trimmed.match(/^[-*]\s+(.*)$/);
      if (fileItem) {
        currentPhase.files.push(fileItem[1].trim());
        continue;
      }
      throw new Error(`Unexpected content in Files block for phase "${currentPhase.title}": ${trimmed}`);
    }

    if (currentPhase) {
      const goalMatch = trimmed.match(/^Goal:\s*(.+)$/i);
      if (goalMatch) {
        if (currentPhase.goal) {
          throw new Error(`Phase "${currentPhase.title}" has multiple Goal lines.`);
        }
        currentPhase.goal = goalMatch[1].trim();
        continue;
      }
      if (/^Files:\s*$/i.test(trimmed)) {
        if (!currentPhase.goal) {
          throw new Error(`Phase "${currentPhase.title}" must declare Goal before Files.`);
        }
        filesMode = true;
        continue;
      }
      throw new Error(`Unexpected content in phase "${currentPhase.title}" before any task: ${trimmed}`);
    }
  }

  flushPhase();

  if (!phases.length) {
    throw new Error('Markdown plan body must contain at least one H2 phase heading (for example: "## Phase 1: Foundation").');
  }

  return {
    inferredTitle: title || phases[0].title,
    phases,
  };
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripCodeContent(html) {
  return html
    .replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, '')
    .replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, '');
}

function pathInside(rootPath, targetPath) {
  const rel = relative(rootPath, targetPath);
  return rel === '' || (!rel.startsWith('..') && rel !== '..' && !isAbsolute(rel));
}

function getGitTopLevelFrom(dir) {
  try {
    const result = spawnSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      return null;
    }
    return result.stdout.trim();
  } catch {
    return null;
  }
}

function getGitRepoRoot(targetDir) {
  return getGitTopLevelFrom(targetDir);
}

function buildCommitGuidance({ projectDir, outPath }) {
  const projectRepoRoot = getGitTopLevelFrom(projectDir);
  if (projectRepoRoot && pathInside(projectRepoRoot, outPath)) {
    return 'Commit guidance: the plan is inside the current project repo, so commit it there when the workflow calls for a commit.';
  }

  const externalRepoRoot = getGitRepoRoot(dirname(outPath));
  if (externalRepoRoot) {
    return `Commit guidance: the plan is outside the current project repo. Do not create a repo-local copy. Commit it from the external docs repo at ${externalRepoRoot} if needed.`;
  }

  return 'Commit guidance: the plan is outside the current project repo and no git repo was detected at the target path. Do not create a repo-local copy; report the saved path and skip committing unless the human tells you where that external docs repo lives.';
}

function parseFlagArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    const key = arg.slice(2);
    if (key === 'skip-path-check') {
      options.skipPathCheck = true;
      continue;
    }
    const value = argv[index + 1];
    if (value == null || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

function readPlanTemplate() {
  if (!existsSync(PLAN_TEMPLATE_PATH)) {
    throw new Error(`Plan template not found at ${PLAN_TEMPLATE_PATH}. Run node scripts/sync-html-templates.mjs first.`);
  }
  return readFileSync(PLAN_TEMPLATE_PATH, 'utf8');
}

function buildPlanToc(phases) {
  const items = phases
    .map((phase) => `  <li><a href="#${phase.id}">${escapeHtml(phase.displayTitle)}</a></li>`)
    .join('\n');
  return `<h3>Table of contents</h3>\n<ol>\n${items}\n</ol>`;
}

function renderFilesBlock(files) {
  if (!files.length) {
    return '';
  }
  const items = files.map((file) => `        <li>${formatInline(file)}</li>`).join('\n');
  return `\n      <div class="sp-phase-files">\n        <p><strong>Files:</strong></p>\n        <ul>\n${items}\n        </ul>\n      </div>`;
}

function renderSpecLink(step, specRelativePath) {
  if (!step.specSection) {
    return '';
  }
  return `\n          <a class="sp-spec-link" href="${escapeAttribute(specRelativePath)}#${escapeAttribute(step.specSection)}">See spec rationale</a>`;
}

function renderVerifyBlock(step) {
  if (!step.command) {
    return '';
  }
  return `\n          <div class="sp-verify-block"><code>${escapeHtml(step.command)}</code></div>`;
}

function renderWatchouts(step) {
  if (!step.watchouts) {
    return '';
  }
  return `\n          <div class="sp-watchouts">${formatInline(step.watchouts)}</div>`;
}

function renderStepBody(step) {
  if (!step.bodyHtml) {
    return '';
  }
  return `\n          ${step.bodyHtml.replace(/\n/g, '\n          ')}`;
}

function renderStep(step, specRelativePath) {
  const attrs = [
    `id="${escapeAttribute(step.id)}"`,
    'class="sp-step"',
    `data-step-id="${escapeAttribute(step.dataStepId)}"`,
    `data-step-kind="${escapeAttribute(step.kind)}"`,
  ];

  if (step.file) {
    attrs.push(`data-file="${escapeAttribute(step.file)}"`);
  }
  if (step.lines) {
    attrs.push(`data-lines="${escapeAttribute(step.lines)}"`);
  }
  if (step.command) {
    attrs.push(`data-command="${escapeAttribute(step.command)}"`);
  }

  return `        <li ${attrs.join(' ')}>\n          <h4>${formatInline(step.title)}</h4>${renderSpecLink(step, specRelativePath)}${renderStepBody(step)}${renderVerifyBlock(step)}${renderWatchouts(step)}\n        </li>`;
}

function renderTask(task, specRelativePath) {
  const stepsHtml = task.steps.map((step) => renderStep(step, specRelativePath)).join('\n');
  return `    <article id="${escapeAttribute(task.id)}" class="sp-task" data-task-id="${escapeAttribute(task.dataTaskId)}">\n      <ol class="sp-step-list">\n${stepsHtml}\n      </ol>\n    </article>`;
}

function renderPhase(phase, specRelativePath) {
  const tasksHtml = phase.tasks.map((task) => renderTask(task, specRelativePath)).join('\n');
  return `<section id="${escapeAttribute(phase.id)}" class="sp-phase" data-phase-id="${escapeAttribute(phase.dataPhaseId)}">\n    <header class="sp-phase-header">\n      <h2>${formatInline(phase.displayTitle)}</h2>\n      <p class="sp-phase-goal">${formatInline(phase.goal)}</p>${renderFilesBlock(phase.files)}\n    </header>\n${tasksHtml}\n    <div class="sp-review-checkpoint">\n      <p><strong>Phase review checkpoint:</strong></p>\n      <ul>\n        <li>Spec compliance review for the full phase</li>\n        <li>Code quality review for the full phase, only after spec compliance passes</li>\n      </ul>\n    </div>\n  </section>`;
}

function preparePlan(plan, { specPath, outPath }) {
  const specRelativePath = relative(dirname(outPath), specPath).replaceAll('\\', '/');
  let taskCounter = 1;
  let stepCounter = 1;

  const phases = plan.phases.map((phase, phaseIndex) => {
    const phaseId = `phase-${phaseIndex + 1}`;
    return {
      ...phase,
      id: phaseId,
      dataPhaseId: phaseId,
      displayTitle: `Phase ${phaseIndex + 1}: ${phase.title}`,
      tasks: phase.tasks.map((task) => {
        const taskId = `task-${taskCounter++}`;
        return {
          ...task,
          id: taskId,
          dataTaskId: taskId,
          steps: task.steps.map((step) => {
            const stepId = `step-${stepCounter++}`;
            return {
              ...step,
              id: stepId,
              dataStepId: stepId,
            };
          }),
        };
      }),
    };
  });

  return {
    title: plan.inferredTitle,
    tocHtml: buildPlanToc(phases),
    contentHtml: phases.map((phase) => renderPhase(phase, specRelativePath)).join('\n\n'),
  };
}

function renderPlanTemplate({ title, tocHtml, contentHtml }) {
  const template = readPlanTemplate();
  const phaseBlockPattern = /<section id="phase-1" class="sp-phase" data-phase-id="phase-1">[\s\S]*?<\/section>/;
  if (!phaseBlockPattern.test(template)) {
    throw new Error('Plan template does not contain the expected sample phase block.');
  }

  const safeTitle = escapeHtml(title);

  return template
    .replaceAll('{{DOC_TITLE}}', safeTitle)
    .replace('{{TOC_ITEMS}}', tocHtml)
    .replace(phaseBlockPattern, contentHtml);
}

export function resolvePlanOutputPath({ projectDir, repoName, slug, out, date }) {
  const normalizedSlug = slugify(slug);
  if (!normalizedSlug) {
    throw new Error('Plan slug resolved to an empty value. Pass --slug with letters or numbers.');
  }
  if (out) {
    return {
      outPath: resolve(projectDir, out),
      slug: normalizedSlug,
      pathSource: '--out',
      pathCheckRequired: false,
    };
  }
  const { docsRoot, source } = resolveDocsRoot({ projectDir, repoName });
  return {
    outPath: resolve(docsRoot, 'plans', `${date}-${normalizedSlug}.html`),
    slug: normalizedSlug,
    pathSource: source,
    pathCheckRequired: true,
  };
}

export function validatePlanHtmlDocument({ html, filePath, projectDir, repoName, skipPathCheck = false }) {
  const errors = [];
  const stripped = stripCodeContent(html);
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : '';

  if (!title || title === 'DOC_TITLE') {
    errors.push('Document title is missing or empty.');
  }

  const placeholders = [...new Set(stripped.match(PLACEHOLDER_PATTERN) || [])];
  if (placeholders.length) {
    errors.push(`Unresolved template placeholders remain: ${placeholders.join(', ')}`);
  }

  if (!html.includes('data-doc-kind="plan"')) {
    errors.push('Plan document shell is missing data-doc-kind="plan".');
  }

  const tocMatch = html.match(/<nav class="sp-toc"[^>]*>([\s\S]*?)<\/nav>/i);
  if (!tocMatch) {
    errors.push('Table of contents nav (.sp-toc) is missing.');
  }

  const hrefTargets = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
  if (!hrefTargets.length) {
    errors.push('Table of contents does not contain any in-document anchors.');
  }

  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  for (const target of hrefTargets) {
    if (!ids.has(target)) {
      errors.push(`TOC anchor target is missing: #${target}`);
    }
  }

  const phaseIds = [...html.matchAll(/<section\b[^>]*\bid="(phase-\d+)"[^>]*\bdata-phase-id="([^"]+)"/g)];
  if (!phaseIds.length) {
    errors.push('Plan must contain at least one phase section with matching id/data-phase-id.');
  }
  for (const [, id, dataId] of phaseIds) {
    if (id !== dataId) {
      errors.push(`Phase id mismatch: id="${id}" but data-phase-id="${dataId}".`);
    }
  }

  const taskMatches = [...html.matchAll(/<article\b[^>]*\bid="([^"]+)"[^>]*\bdata-task-id="([^"]+)"/g)];
  if (!taskMatches.length) {
    errors.push('Plan must contain at least one task article with id/data-task-id.');
  }
  for (const [, id, dataId] of taskMatches) {
    if (id !== dataId) {
      errors.push(`Task id mismatch: id="${id}" but data-task-id="${dataId}".`);
    }
  }

  const stepMatches = [...html.matchAll(/<li\b[^>]*\bid="([^"]+)"[^>]*\bdata-step-id="([^"]+)"[^>]*\bdata-step-kind="([^"]+)"/g)];
  if (!stepMatches.length) {
    errors.push('Plan must contain at least one step with id/data-step-id/data-step-kind.');
  }
  for (const [, id, dataId, kind] of stepMatches) {
    if (id !== dataId) {
      errors.push(`Step id mismatch: id="${id}" but data-step-id="${dataId}".`);
    }
    if (!ALLOWED_STEP_KINDS.has(kind)) {
      errors.push(`Unsupported step kind in rendered HTML: ${kind}`);
    }
  }

  const reviewCheckpointCount = (html.match(/class="sp-review-checkpoint"/g) || []).length;
  if (!reviewCheckpointCount) {
    errors.push('Each plan should include a phase review checkpoint block.');
  } else if (phaseIds.length && reviewCheckpointCount !== phaseIds.length) {
    errors.push(`Each phase should have exactly one review checkpoint. Found ${reviewCheckpointCount} checkpoint(s) for ${phaseIds.length} phase(s).`);
  }

  if (!skipPathCheck) {
    const { repoName: resolvedRepoName } = resolveRepoName({ projectDir, repoName });
    const { docsRoot } = resolveDocsRoot({ projectDir, repoName: resolvedRepoName });
    const expectedPlansRoot = resolve(docsRoot, 'plans');
    if (!pathInside(expectedPlansRoot, filePath)) {
      errors.push(`Plan path is outside the configured docs root. Expected under ${expectedPlansRoot}, got ${filePath}`);
    }
  }

  return errors;
}

export function createPlanDoc(rawOptions) {
  const projectDir = resolve(rawOptions['project-dir'] || process.cwd());
  const bodyPath = resolve(process.cwd(), rawOptions.body || '');
  const specPath = resolve(process.cwd(), rawOptions.spec || '');
  const date = rawOptions.date || getTodayDate();

  if (!rawOptions.title) {
    throw new Error('Missing required --title.');
  }
  if (!rawOptions.body) {
    throw new Error('Missing required --body pointing to a markdown plan file.');
  }
  if (!rawOptions.spec) {
    throw new Error('Missing required --spec pointing to the canonical spec HTML file.');
  }
  if (!existsSync(bodyPath)) {
    throw new Error(`Body file does not exist: ${bodyPath}`);
  }
  if (!existsSync(specPath)) {
    throw new Error(`Spec file does not exist: ${specPath}`);
  }

  const { repoName, source: repoNameSource } = resolveRepoName({
    projectDir,
    repoName: rawOptions['repo-name'],
  });
  const { docsRoot, source: docsRootSource } = resolveDocsRoot({ projectDir, repoName });
  const { outPath, slug, pathCheckRequired } = resolvePlanOutputPath({
    projectDir,
    repoName,
    slug: rawOptions.slug || rawOptions.title,
    out: rawOptions.out,
    date,
  });

  const planMarkdown = readFileSync(bodyPath, 'utf8');
  const parsedPlan = parsePlanMarkdown(planMarkdown);
  const renderedPlan = preparePlan(parsedPlan, { specPath, outPath });
  const html = renderPlanTemplate({
    title: rawOptions.title || renderedPlan.title,
    tocHtml: renderedPlan.tocHtml,
    contentHtml: renderedPlan.contentHtml,
  });

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, 'utf8');

  const validationErrors = validatePlanHtmlDocument({
    html,
    filePath: outPath,
    projectDir,
    repoName,
    skipPathCheck: rawOptions.skipPathCheck || !pathCheckRequired,
  });
  if (validationErrors.length) {
    throw new Error(validationErrors.join('\n'));
  }

  return {
    projectDir,
    repoName,
    repoNameSource,
    docsRoot,
    docsRootSource,
    slug,
    outPath,
    bodyPath,
    specPath,
    commitGuidance: buildCommitGuidance({ projectDir, outPath }),
  };
}

export function validatePlanDoc(rawOptions) {
  const fileArg = rawOptions.file || rawOptions.path;
  if (!fileArg) {
    throw new Error('Missing plan file path. Usage: validate --file <path> or validate <path>.');
  }

  const filePath = resolve(process.cwd(), fileArg);
  if (!existsSync(filePath)) {
    throw new Error(`Plan file does not exist: ${filePath}`);
  }

  const projectDir = resolve(rawOptions['project-dir'] || process.cwd());
  const html = readFileSync(filePath, 'utf8');
  const errors = validatePlanHtmlDocument({
    html,
    filePath,
    projectDir,
    repoName: rawOptions['repo-name'],
    skipPathCheck: Boolean(rawOptions.skipPathCheck),
  });

  if (errors.length) {
    throw new Error(errors.join('\n'));
  }

  return { filePath };
}

function printCreateResult(result) {
  console.log(`Resolved repo name: ${result.repoName} (${result.repoNameSource})`);
  console.log(`Resolved docs root: ${result.docsRoot} (${result.docsRootSource})`);
  console.log(`Body source: ${result.bodyPath} (markdown)`);
  console.log(`Spec source: ${result.specPath}`);
  console.log(`Slug: ${result.slug}`);
  console.log(`Plan written: ${result.outPath}`);
  console.log('Validation: OK');
  console.log(result.commitGuidance);
}

function printValidateResult(result) {
  console.log(`Plan validated: ${result.filePath}`);
}

export async function runCli(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === 'help') {
    console.log(`Usage:\n  node scripts/plan-docs.mjs create --title <title> --body <file> --spec <spec-html> [--slug <slug>] [--repo-name <name>] [--project-dir <dir>] [--date YYYY-MM-DD] [--out <path>]\n  node scripts/plan-docs.mjs validate <path> [--project-dir <dir>] [--repo-name <name>] [--skip-path-check]`);
    return;
  }

  try {
    if (command === 'create') {
      const options = parseFlagArgs(rest);
      const result = createPlanDoc(options);
      printCreateResult(result);
      return;
    }

    if (command === 'validate') {
      let validateArgs = rest;
      if (rest[0] && !rest[0].startsWith('--')) {
        validateArgs = ['--file', rest[0], ...rest.slice(1)];
      }
      const options = parseFlagArgs(validateArgs);
      const result = validatePlanDoc(options);
      printValidateResult(result);
      return;
    }

    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli();
}
