# Phase Fix Subagent Prompt Template

Use this template when dispatching a fix subagent after a phase-level review finds issues.

```
Task tool (general-purpose):
  description: "Fix Phase N review findings"
  prompt: |
    You are fixing review findings for Phase N: [phase name]

    ## Phase Requirements

    [FULL TEXT of phase requirements, including all sub-tasks and acceptance criteria]

    ## Completed Phase Context

    [Reports from all sub-task implementers and any previous fix subagents]

    ## Review Findings to Fix

    [Paste the exact spec compliance or code quality findings]

    ## Your Job

    1. Fix exactly the listed findings
    2. Do not add unrelated improvements or new scope
    3. Run the relevant verification commands
    4. Commit your fixes
    5. Report what changed and what you verified

    Work from: [directory]

    If a finding is wrong, explain why with code/test evidence instead of changing code.

    ## Report Format

    - **Status:** DONE | BLOCKED | NEEDS_CONTEXT
    - Findings addressed
    - Files changed
    - Verification run and results
    - Any findings you believe are invalid, with evidence
```
