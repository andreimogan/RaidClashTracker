# Operating recipe — the operate loop

This is the procedure the **main session** follows to turn one order into shipped work. You (the main Claude Code session) are the orchestrator — there is no orchestrator subagent, because subagents cannot spawn subagents. You do the analysis, selection, and dispatch; the core team does the bounded work.

`CLAUDE.md` points here, and the `UserPromptSubmit` hook injects a reminder to follow this on every prompt (unless the prompt is `/direct` — see `.claude/commands/direct.md`).

## When this runs

On any substantive prompt. Trivial questions and lookups don't need the loop — answer directly, or the user prefixes `/direct`. Use judgment: if the prompt asks to build, change, fix, or extend the project, run the loop.

## The loop

**1. Analyze + select.** Read the prompt. Consult the agent roster (`.claude/agents/`) and match the task to the suitable specialists by their `description` fields. Decide which agents this order needs and roughly how many implementers (based on how the work partitions).

**2. Plan.** Dispatch `task-planner` to decompose the order into a ledger at `docs/tasks/<feature-slug>.md`, with disjoint file ownership per task (see `handoff-contract.md`).

**3. Gate — plan mode (your approval point).** Present the plan for approval: the selected agents, the task breakdown, and the file-ownership partition. In plan mode this happens automatically — you propose and wait. The user approves, adjusts, or redirects. **Nothing is written until approved.** This is the one gate; the user is in every cycle here.

**4. Build (parallel).** On approval, dispatch one `flow-implementer` per ownership group, in parallel. Each claims its files in the ledger before writing and touches only what it owns.

**5. Integrate.** When all tasks are `done`, dispatch `integrator` to merge the slices and resolve shared seams into one coherent, buildable diff.

**6. Review + doc-sync.** Dispatch `flow-reviewer` on the merged result. It checks correctness and convention-fit **and** verifies the living docs match the code. If it flags CRITICAL/HIGH issues or doc-sync failures, bounce the specific tasks back to their implementers (step 4) and re-review. Loop until clean.

**7. Report + commit.** Summarize the result to the user. Append a decision entry to `docs/build-log.md` (what was built, why, alternatives rejected) and confirm the living docs are committed. Update the ledger `status: done`.

**8. Loop.** Return to the user for the next order.

## Maintenance

Every N completed orders (default 5, set in `CLAUDE.md`), or after an architecture change, dispatch `maintainer` to reconcile docs vs. code, prune memory, and re-derive the project map. This is not part of every cycle — it's periodic.

## Operating rules

- Separate facts, inferences, recommendations, unknowns, and blockers in what you surface.
- Never invent APIs, contracts, or facts — flag unknowns and, if blocked, ask the smallest question.
- Keep the human at the plan gate. Do not skip it to "save time."
- Targeting: the user can always name a specific agent to run one job directly, bypassing this loop.
