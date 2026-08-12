---
description: Answer this prompt directly, skipping the agent team. Use for quick questions, lookups, or small one-off edits that don't need planning and dispatch.
argument-hint: [your question or quick task]
---

# /direct — skip the team

Answer the following directly, as a normal Claude Code session. **Do not** run the operate loop: no task-planner, no dispatch, no ledger, no plan-mode orchestration ceremony.

This is the escape hatch. Orchestration is the default (the `UserPromptSubmit` hook injects a plan-first directive on every prompt), which is right for real work but overkill for "what does this function do?" or a one-line fix. `/direct` opts out for this one prompt.

**Skipping the ceremony is not licence to read everything.** Answer on a budget: `CLAUDE.md` and `docs/project-map.md` for orientation, then the specific thing you were asked about. If the prompt carries an error or a stack trace, follow it — grep the message, read the frame it names — rather than surveying the area it came from. A `/direct` prompt that turns into a repo crawl has cost more than the loop it was meant to avoid; if it genuinely needs a survey, say so and suggest running it as a normal order instead.

The user's request:

$ARGUMENTS
