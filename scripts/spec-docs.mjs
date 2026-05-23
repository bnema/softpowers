#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderHighlightedCode } from './html-code-highlight.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const SPEC_TEMPLATE_PATH = resolve(root, 'templates', 'spec.template.html');
const PLACEHOLDER_PATTERN = /\{\{[A-Z0-9_:-]+\}\}/g;
const HELP_FLAGS = new Set(['--help', '-h', '-help']);

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
    .replace(/^-+|-+$/g, '') || 'section';
}

function dedupeSlug(baseSlug, used) {
  let candidate = baseSlug;
  let index = 2;
  while (used.has(candidate)) {
    candidate = `${baseSlug}-${index}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

function tokenizeInline(text, regex, toHtml, tokens) {
  return text.replace(regex, (...args) => {
    const html = toHtml(...args);
    const token = `__HTML_DOC_TOKEN_${tokens.length}__`;
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
  value = value.replace(/__HTML_DOC_TOKEN_(\d+)__/g, (_, index) => tokens[Number(index)]);
  return value;
}

function renderCodeBlock(language, lines) {
  const source = lines.join('\n');
  const highlighted = renderHighlightedCode(language, source);
  const classes = [];
  if (language) {
    classes.push(`language-${escapeAttribute(language)}`);
  }
  if (highlighted.highlighted) {
    classes.push('sp-code-highlighted');
  }
  const classAttr = classes.length ? ` class="${classes.join(' ')}"` : '';
  return `<pre><code${classAttr}>${highlighted.html}</code></pre>`;
}

function parseMarkdownBody(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const usedSlugs = new Set();
  const sections = [];
  const preamble = [];
  let currentSection = null;
  let paragraph = [];
  let list = null;
  let codeBlock = null;
  let firstHeading = null;

  function targetParts() {
    return currentSection ? currentSection.parts : preamble;
  }

  function flushParagraph() {
    if (!paragraph.length) {
      return;
    }
    targetParts().push(`<p>${formatInline(paragraph.join(' ').trim())}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!list) {
      return;
    }
    const items = list.items.map((item) => `  <li>${formatInline(item)}</li>`).join('\n');
    targetParts().push(`<${list.type}>\n${items}\n</${list.type}>`);
    list = null;
  }

  function flushCodeBlock() {
    if (!codeBlock) {
      return;
    }
    targetParts().push(renderCodeBlock(codeBlock.language, codeBlock.lines));
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

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      flushFlowContent();
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();
      firstHeading ??= headingText;

      if (level === 1) {
        continue;
      }

      if (level === 2) {
        currentSection = {
          title: headingText,
          id: dedupeSlug(slugify(headingText), usedSlugs),
          parts: [],
        };
        sections.push(currentSection);
        continue;
      }

      targetParts().push(`<h${level}>${formatInline(headingText)}</h${level}>`);
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

  if (!sections.length) {
    throw new Error('Markdown spec body must contain at least one H2 section (for example: "## Problem and goals").');
  }

  const tocItems = sections
    .map((section) => `  <li><a href="#${section.id}">${escapeHtml(section.title)}</a></li>`)
    .join('\n');

  const overviewParts = [];
  if (preamble.length) {
    overviewParts.push(...preamble);
  }
  for (const section of sections) {
    const body = section.parts.length ? `\n${section.parts.join('\n')}\n` : '\n';
    overviewParts.push(`<section id="${section.id}" data-section="${section.id}">\n<h2>${formatInline(section.title)}</h2>${body}</section>`);
  }

  return {
    inferredTitle: firstHeading,
    tocHtml: `<h3>Table of contents</h3>\n<ol>\n${tocItems}\n</ol>`,
    overviewHtml: overviewParts.join('\n\n'),
  };
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseHtmlBody(html) {
  const sectionMatches = [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>[\s\S]*?<\/section>/gi)];
  if (!sectionMatches.length) {
    throw new Error('HTML spec fragments must contain <section id="..."> blocks with <h2> headings, or use --body-format markdown.');
  }

  const tocItems = sectionMatches
    .map(([, id, headingHtml]) => {
      const title = stripTags(headingHtml);
      return `  <li><a href="#${escapeAttribute(id)}">${escapeHtml(title)}</a></li>`;
    })
    .join('\n');

  return {
    inferredTitle: null,
    tocHtml: `<h3>Table of contents</h3>\n<ol>\n${tocItems}\n</ol>`,
    overviewHtml: html.trim(),
  };
}

function renderSpecBody(body, bodyFormat) {
  if (bodyFormat === 'html') {
    return parseHtmlBody(body);
  }
  if (bodyFormat !== 'markdown') {
    throw new Error(`Unsupported body format: ${bodyFormat}. Expected "markdown" or "html".`);
  }
  return parseMarkdownBody(body);
}

function readSpecTemplate() {
  if (!existsSync(SPEC_TEMPLATE_PATH)) {
    throw new Error(`Spec template not found at ${SPEC_TEMPLATE_PATH}. Run node scripts/sync-html-templates.mjs first.`);
  }
  return readFileSync(SPEC_TEMPLATE_PATH, 'utf8');
}

function renderSpecTemplate({ title, tocHtml, overviewHtml }) {
  return readSpecTemplate()
    .replaceAll('{{DOC_TITLE}}', title)
    .replace('{{TOC_ITEMS}}', tocHtml)
    .replace('{{OVERVIEW}}', overviewHtml);
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

function getGitTopLevel(projectDir) {
  return getGitTopLevelFrom(projectDir);
}

function getGitRepoRoot(targetDir) {
  return getGitTopLevelFrom(targetDir);
}

export function resolveRepoName({ projectDir, repoName }) {
  if (repoName) {
    return { repoName, source: '--repo-name' };
  }
  const gitTopLevel = getGitTopLevel(projectDir);
  if (gitTopLevel) {
    return {
      repoName: basename(gitTopLevel),
      source: 'git top-level directory basename',
    };
  }
  return {
    repoName: basename(projectDir),
    source: 'project directory basename',
  };
}

export function resolveDocsRoot({ projectDir, repoName }) {
  if (process.env.PROJECTS_DOCS_PATH) {
    return {
      docsRoot: resolve(process.env.PROJECTS_DOCS_PATH, repoName),
      source: 'PROJECTS_DOCS_PATH',
    };
  }
  return {
    docsRoot: resolve(projectDir, 'docs', 'softpowers'),
    source: 'repo-local docs/softpowers',
  };
}

export function resolveSpecOutputPath({ projectDir, repoName, slug, out, date }) {
  const normalizedSlug = slugify(slug);
  if (!normalizedSlug) {
    throw new Error('Spec slug resolved to an empty value. Pass --slug with letters or numbers.');
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
    outPath: resolve(docsRoot, 'specs', `${date}-${normalizedSlug}-design.html`),
    slug: normalizedSlug,
    pathSource: source,
    pathCheckRequired: true,
  };
}

export function validateSpecHtmlDocument({ html, filePath, projectDir, repoName, skipPathCheck = false }) {
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

  if (!skipPathCheck) {
    const { repoName: resolvedRepoName } = resolveRepoName({ projectDir, repoName });
    const { docsRoot } = resolveDocsRoot({ projectDir, repoName: resolvedRepoName });
    const expectedSpecsRoot = resolve(docsRoot, 'specs');
    if (!pathInside(expectedSpecsRoot, filePath)) {
      errors.push(`Spec path is outside the configured docs root. Expected under ${expectedSpecsRoot}, got ${filePath}`);
    }
  }

  return errors;
}

function buildCommitGuidance({ projectDir, outPath }) {
  const projectRepoRoot = getGitTopLevel(projectDir);
  if (projectRepoRoot && pathInside(projectRepoRoot, outPath)) {
    return 'Commit guidance: the spec is inside the current project repo, so commit it there when the workflow calls for a commit.';
  }

  const externalRepoRoot = getGitRepoRoot(dirname(outPath));
  if (externalRepoRoot) {
    return `Commit guidance: the spec is outside the current project repo. Do not create a repo-local copy. Commit it from the external docs repo at ${externalRepoRoot} if needed.`;
  }

  return 'Commit guidance: the spec is outside the current project repo and no git repo was detected at the target path. Do not create a repo-local copy; report the saved path and skip committing unless the human tells you where that external docs repo lives.';
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

function isHelpFlag(value) {
  return HELP_FLAGS.has(value);
}

function formatUsage(command) {
  const createLines = [
    '  node scripts/create-spec-doc.mjs --title <title> --body <file> [--slug <slug>] [--repo-name <name>] [--project-dir <dir>] [--date YYYY-MM-DD] [--out <path>] [--body-format markdown|html] [--skip-path-check]',
    '  node scripts/spec-docs.mjs create --title <title> --body <file> [--slug <slug>] [--repo-name <name>] [--project-dir <dir>] [--date YYYY-MM-DD] [--out <path>] [--body-format markdown|html] [--skip-path-check]',
  ];
  const validateLines = [
    '  node scripts/validate-spec-doc.mjs <path> [--project-dir <dir>] [--repo-name <name>] [--skip-path-check]',
    '  node scripts/spec-docs.mjs validate <path> [--project-dir <dir>] [--repo-name <name>] [--skip-path-check]',
  ];

  if (command === 'create') {
    return `Usage:\n${createLines.join('\n')}`;
  }
  if (command === 'validate') {
    return `Usage:\n${validateLines.join('\n')}`;
  }
  return `Usage:\n${createLines.join('\n')}\n${validateLines.join('\n')}`;
}

export function createSpecDoc(rawOptions) {
  const projectDir = resolve(rawOptions['project-dir'] || process.cwd());
  const bodyPath = resolve(projectDir, rawOptions.body || '');
  const bodyFormat = rawOptions['body-format'] || 'markdown';
  const date = rawOptions.date || getTodayDate();

  if (!rawOptions.title) {
    throw new Error('Missing required --title.');
  }
  if (!rawOptions.body) {
    throw new Error('Missing required --body pointing to a markdown or HTML fragment file.');
  }
  if (!existsSync(bodyPath)) {
    throw new Error(`Body file does not exist: ${bodyPath}`);
  }

  const { repoName, source: repoNameSource } = resolveRepoName({
    projectDir,
    repoName: rawOptions['repo-name'],
  });
  const { docsRoot, source: docsRootSource } = resolveDocsRoot({ projectDir, repoName });
  const { outPath, slug, pathCheckRequired } = resolveSpecOutputPath({
    projectDir,
    repoName,
    slug: rawOptions.slug || rawOptions.title,
    out: rawOptions.out,
    date,
  });

  const body = readFileSync(bodyPath, 'utf8');
  const renderedBody = renderSpecBody(body, bodyFormat);
  const title = rawOptions.title || renderedBody.inferredTitle;
  const html = renderSpecTemplate({
    title,
    tocHtml: renderedBody.tocHtml,
    overviewHtml: renderedBody.overviewHtml,
  });

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, 'utf8');

  const validationErrors = validateSpecHtmlDocument({
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
    bodyFormat,
    commitGuidance: buildCommitGuidance({ projectDir, outPath }),
  };
}

export function validateSpecDoc(rawOptions) {
  const fileArg = rawOptions.file || rawOptions.path;
  if (!fileArg) {
    throw new Error('Missing spec file path. Usage: validate --file <path> or validate <path>.');
  }

  const projectDir = resolve(rawOptions['project-dir'] || process.cwd());
  const filePath = resolve(projectDir, fileArg);
  if (!existsSync(filePath)) {
    throw new Error(`Spec file does not exist: ${filePath}`);
  }

  const html = readFileSync(filePath, 'utf8');
  const errors = validateSpecHtmlDocument({
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
  console.log(`Body source: ${result.bodyPath} (${result.bodyFormat})`);
  console.log(`Slug: ${result.slug}`);
  console.log(`Spec written: ${result.outPath}`);
  console.log('Validation: OK');
  console.log(result.commitGuidance);
}

function printValidateResult(result) {
  console.log(`Spec validated: ${result.filePath}`);
}

export async function runCli(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;
  if (!command || isHelpFlag(command)) {
    console.log(formatUsage());
    return;
  }

  if (command === 'help') {
    console.log(formatUsage(rest[0]));
    return;
  }

  try {
    if (command === 'create') {
      if (rest.some(isHelpFlag)) {
        console.log(formatUsage('create'));
        return;
      }
      const options = parseFlagArgs(rest);
      const result = createSpecDoc(options);
      printCreateResult(result);
      return;
    }

    if (command === 'validate') {
      if (rest.some(isHelpFlag)) {
        console.log(formatUsage('validate'));
        return;
      }
      let validateArgs = rest;
      if (rest[0] && !rest[0].startsWith('--')) {
        validateArgs = ['--file', rest[0], ...rest.slice(1)];
      }
      const options = parseFlagArgs(validateArgs);
      const result = validateSpecDoc(options);
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
