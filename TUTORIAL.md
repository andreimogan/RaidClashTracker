# Tutorial — using the agent team day to day

Read `ONBOARDING.md` first for setup and the mental model. This guide is how you *drive* the system once it's bootstrapped.

## The three ways you interact

**1. Plain prompt (the default — orchestrated).**
Just type what you want. On every substantive prompt, the hook injects the plan-first directive, and your main session analyzes the request, selects the fitting agents, plans, and — in plan mode — shows you the plan before doing anything. This is the full team path. Example: `add a dark-mode toggle to the settings page`.

**2. Name an agent (target one specialist).**
When you want a specific agent to do a specific job, name it. This bypasses selection and runs exactly that agent. Examples:
- `use the flow-reviewer subagent to review the auth module`
- `have task-planner split the checkout refactor into owned sub-tasks`

Your roster: `task-planner`, `flow-implementer`, `integrator`, `flow-reviewer`, `maintainer`, plus any specialists bootstrap or `/add-role` created (see `/agents`).

**3. `/direct` (skip the team).**
For quick questions, lookups, or one-line fixes that don't need planning: `/direct what does parseConfig() return?`. It answers directly, no orchestration.

### Which do I reach for?
- Quick question or trivial edit → **`/direct`** (or just a plain prompt for a lookup).
- One specific job for one specialist → **name the agent**.
- A real feature or change that needs the team → **plain prompt** and let it orchestrate.

## Plan mode is your gate

The system is built so **you're in every cycle** at one clean point: the plan. Run Claude Code in plan mode (or let the loop propose-and-wait). Before any code is written you'll see:
- which agents were selected,
- the task breakdown,
- the **file-ownership split** (who owns which files).

Approve it, adjust it, or redirect. This is where a bad partition or a misread gets caught — cheaply, before work happens. Approving the plan is you choosing to let the parallel build run.

## A worked example, start to finish

You type: `add rate limiting to the public API endpoints`.

1. **Analyze + select.** The main session reads the prompt, consults the roster, and picks `task-planner`, two `flow-implementer` runs, `integrator`, and `flow-reviewer`.
2. **Plan.** `task-planner` writes `docs/tasks/rate-limiting.md`: e.g. t1 owns `src/middleware/**`, t2 owns `src/config/**` and the docs each must update — disjoint, so they can run in parallel.
3. **Gate (plan mode).** You see the selection, the two tasks, and the ownership split. You approve.
4. **Build (parallel).** Two `flow-implementer`s run at once; each claims its files in the ledger, writes only what it owns, and updates its living docs.
5. **Integrate.** `integrator` merges the two slices and reconciles the shared config/middleware seam into one buildable diff.
6. **Review + doc-sync.** `flow-reviewer` checks the merged result and verifies `docs/reference/` matches the code. Clean → pass. (If not, the flagged task bounces back to its implementer and re-reviews.)
7. **Report + commit.** You get a summary; a decision entry is appended to `docs/build-log.md`.

Next prompt starts the loop again.

## Adding a specialist later

Run **`/add-role`** and describe what you need. It asks 2–3 questions to scope the role, checks it doesn't duplicate an existing agent (offering to extend one instead), and — on your approval — generates just that agent without touching the others. It joins the roster and becomes auto-selectable immediately.

## Keeping it healthy

Every few completed orders, or after a structural change, run the `maintainer` (`use the maintainer subagent to reconcile docs and prune memory`). It re-syncs the living docs against the code, trims bloated memory/rules, and refreshes the project map. The append-only build log needs no upkeep; the living docs do — this is that upkeep.

## Tips

- **Keep agent descriptions sharp.** Auto-selection matches your prompt against each agent's `description`. If routing feels off, tighten the descriptions.
- **Trust the ledger.** `docs/tasks/<feature>.md` is how a fresh session resumes — you don't have to re-explain in-flight work.
- **Don't skip the gate to save time.** The plan gate is cheap and it's your only steering point; skipping it trades control for speed you'll usually regret.
