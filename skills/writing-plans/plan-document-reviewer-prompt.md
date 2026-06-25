# Plan Document Reviewer Prompt Template

Use this template when dispatching a plan document reviewer subagent.

**Purpose:** Verify the plan markdown draft is complete, matches the spec, and has proper phase and sub-task decomposition for the selected final plan output.

**Dispatch after:** The plan markdown draft is written to a unique temporary path such as `PLAN_DRAFT="$(mktemp /tmp/softpowers-plan-XXXXXX.md)"`, after the user has chosen `Simple Markdown` or `Enriched HTML`, after the controller has done its own self-review, and before the controller saves the final Markdown file or runs `node "$SOFTPOWERS_ROOT/scripts/create-plan-doc.mjs" ...` for Enriched HTML. The controller resolves `SOFTPOWERS_ROOT` from the Softpowers package that contains this prompt; never assume the target project contains these helper scripts.

```yaml
Task tool (general-purpose):
  description: "Review plan markdown draft"
  prompt: |
    You are a plan document reviewer. Verify this markdown draft is complete and ready for the selected final output and implementation.

    **Plan markdown draft to review:** [PLAN_DRAFT_PATH]
    **Selected output format:** [PLAN_OUTPUT_FORMAT]
    **Planned final output:** [PLAN_OUTPUT_PATH]
    **Spec for reference:** [APPROVED_SPEC_PATH]

    ## What to Check

    | Category | What to Look For |
    |----------|------------------|
    | Completeness | TODOs, placeholders, incomplete phases/sub-tasks, missing steps |
    | Spec Alignment | Plan covers spec requirements, no major scope creep |
    | Phase Decomposition | Phases have clear reviewable outcomes; sub-tasks are actionable |
    | Buildability | Could an engineer follow this plan without getting stuck? |

    ## Calibration

    **Only flag issues that would cause real problems during implementation.**
    An implementer building the wrong thing or getting stuck is an issue.
    Minor wording, stylistic preferences, and "nice to have" suggestions are not.

    Approve unless there are serious gaps: missing requirements from the spec,
    contradictory phases/sub-tasks/steps, placeholder content, or sub-tasks so vague they can't be acted on.

    ## Output Format

    ## Plan Review

    **Status:** Approved | Issues Found

    **Issues (if any):**
    - [Phase X, Sub-task Y]: [specific issue] - [why it matters for implementation]

    **Recommendations (advisory, do not block approval):**
    - [suggestions for improvement]
```

**After approval:** For `Simple Markdown`, the controller copies the approved draft to the final `.md` path. For `Enriched HTML`, the controller generates the final HTML with `node "$SOFTPOWERS_ROOT/scripts/create-plan-doc.mjs" ...` and validates it with `node "$SOFTPOWERS_ROOT/scripts/validate-plan-doc.mjs" <plan-path>`.

**Reviewer returns:** Status, Issues (if any), Recommendations
