import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const brainstorming = readFileSync('skills/brainstorming/SKILL.md', 'utf8');
const companion = readFileSync('skills/brainstorming/visual-companion.md', 'utf8');
assert(brainstorming.includes('specs/YYYY-MM-DD-<topic>-design.html'));
assert(!brainstorming.includes('specs/YYYY-MM-DD-<topic>-design.md'));
assert(brainstorming.includes('templates/spec.template.html'));
assert(brainstorming.includes('printenv PROJECTS_DOCS_PATH'));
assert(brainstorming.includes('scripts/create-spec-doc.mjs'));
assert(brainstorming.includes('scripts/validate-spec-doc.mjs'));
assert(brainstorming.includes('git top-level directory basename'));
assert(brainstorming.includes('do not also create a repo-local copy'));
assert(companion.includes('skills/brainstorming/scripts/frame-template.html'));

const writingPlans = readFileSync('skills/writing-plans/SKILL.md', 'utf8');
assert(writingPlans.includes('plans/YYYY-MM-DD-<feature-name>.html'));
assert(!writingPlans.includes('plans/YYYY-MM-DD-<feature-name>.md'));
assert(writingPlans.includes('templates/plan.template.html'));
assert(writingPlans.includes('printenv PROJECTS_DOCS_PATH'));
assert(writingPlans.includes('git top-level directory basename'));
assert(writingPlans.includes('do not also create a repo-local copy'));
assert(writingPlans.includes('data-phase-id'));
assert(writingPlans.includes('data-task-id'));
assert(writingPlans.includes('targeted snippets'));
assert(writingPlans.includes('full TOC block'));

const softassist = readFileSync('skills/softassist/SKILL.md', 'utf8');
assert(softassist.includes('data-doc-kind="plan"'));
assert(softassist.includes('data-phase-id'));
assert(softassist.includes('data-task-id'));
assert(softassist.includes('data-step-id'));
assert(softassist.includes('data-file'));
assert(softassist.includes('data-lines'));
assert(softassist.includes('data-command'));
assert(softassist.includes('HTML plan remains the canonical readable artifact'));

const reviewerPrompt = readFileSync('skills/brainstorming/spec-document-reviewer-prompt.md', 'utf8');
assert(reviewerPrompt.includes('scripts/validate-spec-doc.mjs'));
assert(reviewerPrompt.includes('unreplaced `{{...}}` placeholders'));

const readme = readFileSync('README.md', 'utf8');
assert(readme.includes('HTML'));
assert(readme.includes('specs and implementation plans'));
assert(readme.includes('softassist'));
assert(readme.includes('ownership split'));
assert(readme.includes('scripts/create-spec-doc.mjs'));
assert(readme.includes('scripts/validate-spec-doc.mjs'));
assert(readme.includes('canonical-html-spec-workflow-design.html'));
