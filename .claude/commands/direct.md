---
description: Answer this prompt directly, skipping the agent team. Use for quick questions, lookups, or small one-off edits that don't need planning and dispatch.
argument-hint: [your question or quick task]
---

# /direct — skip the team

Answer the following directly, as a normal Claude Code session. **Do not** run the operate loop: no task-planner, no dispatch, no ledger, no plan-mode orchestration ceremony.

This is the escape hatch. Orchestration is the default (the `UserPromptSubmit` hook injects a plan-first directive on every prompt), which is right for real work but overkill for "what does this function do?" or a one-line fix. `/direct` opts out for this one prompt.

The user's request:

$ARGUMENTS
