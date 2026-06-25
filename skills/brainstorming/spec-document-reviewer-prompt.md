# Spec Document Reviewer Prompt Template

Use this template when dispatching a spec document reviewer subagent.

**Purpose:** Verify the markdown draft is complete, consistent, and ready for the selected final spec output.

**Dispatch after:** The spec markdown draft is written to a unique temporary markdown path such as `SPEC_DRAFT="$(mktemp /tmp/softpowers-spec-XXXXXX.md)"`, the user has chosen `Simple Markdown` or `Enriched HTML`, and the controller has already done its own self-review. This review happens **before** the controller saves the final Markdown file or runs `node "$SOFTPOWERS_ROOT/scripts/create-spec-doc.mjs" ...` for Enriched HTML. The controller resolves `SOFTPOWERS_ROOT` from the Softpowers package that contains this prompt; never assume the target project contains these helper scripts.

```yaml
Task tool (general-purpose):
  description: "Review spec markdown draft"
  prompt: |
    You are a spec document reviewer. Verify this markdown draft is complete and ready for the selected final output and implementation planning.

    **Spec markdown draft to review:** [SPEC_DRAFT_PATH]
    **Selected output format:** [SPEC_OUTPUT_FORMAT]
    **Planned final output:** [SPEC_OUTPUT_PATH]

    ## What to Check

    | Category | What to Look For |
    |----------|------------------|
    | Completeness | TODOs, unreplaced `{{...}}` placeholders copied into the draft, "TBD", incomplete sections |
    | Consistency | Internal contradictions, conflicting requirements |
    | Clarity | Requirements ambiguous enough to cause someone to build the wrong thing |
    | Scope | Focused enough for a single plan: not covering multiple independent subsystems |
    | YAGNI | Unrequested features, over-engineering |

    ## Calibration

    **Only flag issues that would cause real problems during implementation planning.**
    A missing section, a contradiction, or a requirement so ambiguous it could be
    interpreted two different ways: those are issues. Minor wording improvements,
    stylistic preferences, and "sections less detailed than others" are not.

    Approve unless there are serious gaps that would lead to a flawed plan.

    ## Output Format

    ## Spec Review

    **Status:** Approved | Issues Found

    **Issues (if any):**
    - [Section X]: [specific issue] - [why it matters for planning]

    **Recommendations (advisory, do not block approval):**
    - [suggestions for improvement]
```

**After approval:** For `Simple Markdown`, the controller copies the approved draft to the final `.md` path. For `Enriched HTML`, the controller generates the final HTML with `node "$SOFTPOWERS_ROOT/scripts/create-spec-doc.mjs" ...` and validates it with `node "$SOFTPOWERS_ROOT/scripts/validate-spec-doc.mjs" <spec-path>`.

**Reviewer returns:** Status, Issues (if any), Recommendations
