# Operating recipe — the operate loop

This is the procedure the **main session** follows to turn one order into shipped work. You (the main Claude Code session) are the orchestrator — there is no orchestrator subagent, because subagents cannot spawn subagents. You do the analysis, selection, and dispatch; the core team does the bounded work.

`CLAUDE.md` points here, and the `UserPromptSubmit` hook injects a reminder to follow this on every prompt (unless the prompt is `/direct` — see `.claude/commands/direct.md`).

## When this runs

On any substantive prompt. Trivial questions and lookups don't need the loop — answer directly, or the user prefixes `/direct`. Use judgment: if the prompt asks to build, change, fix, or extend the project, run the loop.

## The loop

**1. Analyze + select.** Read the prompt. Consult the agent roster (`.claude/agents/`) and match the task to the suitable specialists by their `description` fields. Decide which agents this order needs and roughly how many implementers (based on how the work partitions).

**Is this a bug?** An order carrying a symptom — an error message, a stack trace, a failing test, "this worked and now doesn't" — is a different retrieval problem from a feature, and gets a different survey. On a feature you survey an *area*. On a bug you follow the *symptom*: take the error text or the failing assertion, grep for it, read the frame it names, follow the call path to the code that produced it, and stop when you can state symptom → cause → fix site. Read what the trail names and nothing else — a bug is not a licence to tour the module. Most of what an agent spends on a bug is finding the fault, so the survey style is most of the cost.

If the symptom is thin ("the export is broken"), ask for the error text or the failing command before surveying. One question is far cheaper than a speculative survey, and the user almost always has it.

Conclude the partition explicitly, because the next two steps turn on it: **two or more ownership groups, or a split you are not sure of** → the team path. **Clearly one group** → the solo path. Uncertainty resolves toward the planner: dispatching it and learning the order was single costs one dispatch, while guessing "solo" wrongly means the main session hand-cuts a disjoint partition as a side task, which is the job the planner exists to do properly.

**2. Plan.** Every order gets a ledger at `docs/tasks/<feature-slug>.md`. Who writes it depends on step 1's conclusion.

**Team path (two or more groups, or unsure).** Dispatch `task-planner` to decompose the order into that ledger, with disjoint file ownership per task, a **context pack** — the survey it did, written down once so the implementers don't each repeat it (see `handoff-contract.md`) — and a **cost forecast** (see `cost-forecast.md`).

**Solo path (clearly one group).** Write the ledger yourself from `.claude/templates/ledger.md.tmpl`: one task with its `owns` set, a context pack, and the forecast (no integrate component — see step 5).

There is nothing to split, so a dispatch would only pay a subagent to confirm it. The pack is usually shorter here but is never omitted: the implementer and the reviewer each start from it and cannot see what you read. If you discover a second ownership group while writing, stop and dispatch the planner — you have just found out it was not solo.

Survey on the same budget the planner works to: start from `CLAUDE.md`, `docs/project-map.md` and the rules, then read only the files this order will actually touch — sampling a large directory rather than reading all of it. This matters more here than it does in a dispatch: measured, the main session's own reading is the larger half of what planning costs, so the solo path is where an unbudgeted survey does the most damage.

On a bug-shaped order, hand the planner the symptom verbatim and whatever localization you already did in step 1 — it verifies and extends a trail rather than starting one.

Before dispatching on the team path, look for a survey it can skip. If a recent ledger in `docs/tasks/` has a context pack covering the same area, run `git diff --stat <that ledger's created date>..HEAD -- <the packed paths>` and hand the planner both the pack and what moved. The planner has no `Bash`, so it cannot check freshness itself — if you don't do this, it re-reads everything. Re-surveying an unchanged area is the single most avoidable cost in the loop.

**3. Gate — plan mode (your approval point).** Present the plan for approval: the selected agents, the task breakdown, and the file-ownership partition. In plan mode this happens automatically — you propose and wait. The user approves, adjusts, or redirects. **Nothing is written until approved.** This is the one gate; the user is in every cycle here.

Include the **budget line** with the plan, so approving is also an informed decision about whether there is room to run it. Run `node .claude/scripts/token-report.js --budget`, then present the forecast, the current five-hour window, and a one-line verdict — *fits comfortably*, *tight* (say what would push it over), or *wait* (give the reset time). Rules and degradation in `cost-forecast.md`; if the budget is unknown, say so and point at `/usage` rather than guessing. The verdict is advice — the user still decides. If the command itself fails because Node is missing, say so once and point at `/deps`, which diagnoses and fixes it.

Include what **planning itself** has already cost. Run `node .claude/scripts/token-report.js --plan-cost` — add `--solo` when you wrote the ledger yourself, since there is no planner dispatch for it to anchor on — fill the ledger's `## Plan cost` section, and present one line beside the verdict — *planning cost so far: 690k (9% of forecast)*. Only you can measure this: the planner cannot see its own transcript. If plan mode blocks the write, present the number now and fill the section on approval, before dispatching step 4. It is a breakdown of what step 7 will report, not an extra charge.

If the user adjusts the plan at the gate, **amend the ledger yourself**. Re-dispatch `task-planner` only when the ownership partition has to be recut — never to re-survey ground it already covered.

**4. Build (parallel).** On approval, dispatch one `flow-implementer` per ownership group, in parallel — a solo order dispatches exactly one. Point each at the ledger and its task id, and tell it to start from the context pack. Each claims its files in the ledger before writing and touches only what it owns.

**5. Integrate.** When all tasks are `done`: if **two or more implementers ran**, dispatch `integrator` to merge the slices and resolve shared seams into one coherent, buildable diff.

If **exactly one ran**, skip it — one diff is already coherent, and there are no seams between a slice and itself. Set the ledger `status` from `in-progress` to `review` yourself, which is the transition the integrator would have made, and say in your progress output that you skipped integration and why. The status sequence is forward-only, not every-step: passing over `integrating` is valid, going backwards is not. This turns on how many implementers *actually ran*, not on how the order looked at plan time.

**6. Review + doc-sync.** Dispatch `flow-reviewer` on the merged result. It checks correctness and convention-fit **and** verifies the living docs match the code. If it flags CRITICAL/HIGH issues or doc-sync failures, bounce the specific tasks back to their implementers (step 4) and re-review. Loop until clean.

**7. Report + commit.** Summarize the result to the user. Append a decision entry to `docs/build-log.md` (what was built, why, alternatives rejected — and say "solo order" when it was one, so the cost line's `plan` figure is read against the right shape) and confirm the living docs are committed. Record what the order cost: run `node .claude/scripts/token-report.js --line` and append its one-line output to that entry, prefixed with the forecast from the ledger so the two sit together — `est 4.2M → actual 4.8M (+14%) · …`. That comparison is what makes the next forecast better; without it the estimates never learn. The line ends with a `plan NNNk` fragment when the session planned an order — keep it; that is what lets the next forecast calibrate its overhead instead of using a shipped guess. Update the ledger `status: done`.

**8. Loop.** Return to the user for the next order.

## Maintenance

Every N completed orders (default 5, set in `CLAUDE.md`), or after an architecture change, dispatch `maintainer` to reconcile docs vs. code, prune memory, and re-derive the project map. This is not part of every cycle — it's periodic.

## Operating rules

- Separate facts, inferences, recommendations, unknowns, and blockers in what you surface.
- Never invent APIs, contracts, or facts — flag unknowns and, if blocked, ask the smallest question.
- Keep the human at the plan gate. Do not skip it to "save time."
- **Hold the cache across an order.** No model or effort switches, and no compaction, between step 1 and step 7 — each throws away the prefix and pays to rebuild it. Compact at order boundaries instead. See `.claude/conventions/cache-discipline.md`.
- Targeting: the user can always name a specific agent to run one job directly, bypassing this loop.
