# Canonical HTML Spec Workflow Example

This markdown source demonstrates the intended happy path for authoring an HTML-first Softpowers spec.

## Problem and goals

Agents should not hand-build a giant HTML blob just to save a spec. The happy path should:

- start from markdown
- generate the table of contents automatically
- save to the resolved docs root
- validate the finished HTML before handoff

## Scope and non-goals

This example covers the spec-writing workflow only.

- It shows markdown-first authoring.
- It shows automatic section anchors and TOC generation.
- It does not automate implementation-plan authoring yet.

## Happy path command

Use the helper script instead of copying the template by hand. The helper lives in the Softpowers package, not in the project being documented, so resolve `SOFTPOWERS_ROOT` once and use absolute helper paths from there:

```bash
printenv PROJECTS_DOCS_PATH
SOFTPOWERS_ROOT="/absolute/path/to/the/softpowers/package"
node "$SOFTPOWERS_ROOT/scripts/create-spec-doc.mjs" \
  --title "Canonical HTML Spec Workflow Example" \
  --slug canonical-html-spec-workflow \
  --body "$SOFTPOWERS_ROOT/examples/html-docs/canonical-spec.md"
```

Then validate the generated document. This checked-in example lives in the repo-local fallback docs root, so unset `PROJECTS_DOCS_PATH` while validating it:

```bash
env -u PROJECTS_DOCS_PATH node "$SOFTPOWERS_ROOT/scripts/validate-spec-doc.mjs" "$SOFTPOWERS_ROOT/docs/softpowers/specs/2026-05-13-canonical-html-spec-workflow-design.html"
```

## Path resolution rules

When `PROJECTS_DOCS_PATH` is set, the resolved output root is `PROJECTS_DOCS_PATH/{repoName}`.

1. Use the git top-level directory basename as `repoName` when inside a git repo.
2. Otherwise use the current project directory basename.
3. If the project does not exist on disk yet, ask the human for the intended project slug.

## Commit behavior

If the resolved spec path is inside the current project repo, commit it there.

If the resolved spec path is outside the current project repo:

- do not create a second repo-local copy
- report the external path clearly
- commit in that external docs repo only when it exists and the workflow actually calls for a commit

## Validation checklist

A valid generated spec should have:

- a real document title
- a table of contents with working anchors
- no unreplaced template placeholders outside code samples
- a final `.html` path under the resolved specs root
