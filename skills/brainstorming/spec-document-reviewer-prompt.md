# Spec Document Reviewer Prompt Template

Use this template when dispatching a spec document reviewer subagent.

**Purpose:** Verify the markdown draft is complete, consistent, and ready to be turned into the canonical HTML spec.

**Dispatch after:** The spec markdown draft is written to a unique temporary markdown path such as `SPEC_DRAFT="$(mktemp /tmp/softpowers-spec-XXXXXX.md)"`, and the controller has already done its own self-review. This review happens **before** `node scripts/create-spec-doc.mjs ...` generates the final HTML document.

```
Task tool (general-purpose):
  description: "Review spec markdown draft"
  prompt: |
    You are a spec document reviewer. Verify this markdown draft is complete and ready for HTML generation and implementation planning.

    **Spec markdown draft to review:** [SPEC_DRAFT_PATH]
    **Planned canonical HTML output:** [SPEC_HTML_PATH]

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

**After approval:** The controller generates the final HTML with `node scripts/create-spec-doc.mjs ...` and validates it with `node scripts/validate-spec-doc.mjs <spec-path>`.

**Reviewer returns:** Status, Issues (if any), Recommendations
