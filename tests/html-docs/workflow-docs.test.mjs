import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const brainstorming = readFileSync('skills/brainstorming/SKILL.md', 'utf8');
const companion = readFileSync('skills/brainstorming/visual-companion.md', 'utf8');
assert(brainstorming.includes('specs/YYYY-MM-DD-<topic>-design.html'));
assert(brainstorming.includes('templates/spec.template.html'));
assert(companion.includes('skills/brainstorming/scripts/frame-template.html'));
