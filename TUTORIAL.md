# Tutorial — using the agent team day to day

Read `ONBOARDING.md` first for setup and the mental model. This guide is how you *drive* the system once it's bootstrapped.

## The three ways you interact

**1. Plain prompt (the default — orchestrated).**
Just type what you want. On every substantive prompt, the hook injects the plan-first directive, and your main session analyzes the request, selects the fitting agents, plans, and — in plan mode — shows you the plan before doing anything. This is the full team path. Example: `add a dark-mode toggle to the settings page`.

**2. Name an agent (target one specialist).**
When you want a specific agent to do a specific job, name it. This bypasses selection and runs exactly that agent. Examples:
- `use the flow-reviewer subagent to review the auth module`
- `have task-planner split the checkout refactor into owned sub-tasks`

Your roster is six agents: five in the loop — `task-planner`, `flow-implementer`, `integrator`, `flow-reviewer`, `maintainer` — plus `capability-researcher` on demand, which you rarely name because `/add-role` and `/improve-agent` dispatch it for you. Any specialists bootstrap or `/add-role` created are there too (see `/agents`).

**3. `/direct` (skip the team).**
For quick questions, lookups, or one-line fixes that don't need planning: `/direct what does parseConfig() return?`. It answers directly, no orchestration.

**If something doesn't light up** — no status line, a budget that reads "unknown", `/token-report` saying it needs Node — run **`/deps`**. It checks the framework's prerequisites, says what each missing one costs you, and can install a missing git or Node with your consent. `SCAFFOLD-MANIFEST.md` Tier 0 is the full list.

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

**For a bug, paste the error.** The single most useful thing you can put in a bug prompt is the actual output — the stack trace, the failing assertion, the command that broke. With it, the survey starts at the symptom and follows the trail to the line responsible. Without it, the system has to go and look, which on a large module is most of what the order costs. If you don't include one you'll usually be asked for it before any surveying happens, because one question is far cheaper than a speculative search.

**Small orders run a shorter version of this.** When the work lands in one ownership group — a single file, one module — there is nothing to split and nothing to merge, so steps 2 and 5 lose their point. The main session writes the ledger itself and skips the integrator; on the same fixture that is a 63% cheaper order in the cost model. Everything that protects you stays: the ledger, the context pack, the gate, review with doc-sync, and the build-log entry. And the shortcut is bounded — two or more implementers always get a planner to cut the ownership and an integrator to reconcile the seams, because that is the case where skipping them causes the collisions the split exists to prevent.

## Adding a specialist later

Run **`/add-role`** and describe what you need. It asks 2–3 questions to scope the role, checks it doesn't duplicate an existing agent (offering to extend one instead), and — on your approval — generates just that agent without touching the others. It joins the roster and becomes auto-selectable immediately.

It then offers to *specialize* the new agent: audit the repo, research current practice for its domain at the versions you pin, and write that into a companion practice skill it loads at startup. Decline if the role is thin — `/improve-agent` can do it later.

## Teaching an agent as the project moves

Run **`/improve-agent <name>`** when a framework major changes, a library gets swapped, or an agent's advice starts feeling dated.

It opens with a staleness report — which pinned versions moved, which claims are past their re-check date, which came from open search rather than a curated source — so you can stop right there if nothing has actually changed. If you continue, it researches only what the report flagged, then shows you a diff.

Two things to expect. It **removes** as well as adds: stale claims, guidance the codebase has absorbed as convention, anything that just restates what the model already knows. And it reports the line-count delta, because that knowledge loads on every dispatch of that agent — a file that grows every time is the failure this command is designed to avoid. Your agent's own instructions are never rewritten; only its practice skill changes, and only after you approve the diff.

`--shrink` runs the tidy-up without any research at all.

## Knowing what a plan will cost before you approve it

Every plan arrives with an estimate and a budget line:

```
Estimate: 4.2M tokens (range 3.4M–6.2M) · ~$3.00
  Parallel build, 4 tasks   1.7M
  Report + commit           1.3M
  Bounce allowance          1.0M
  Everything else           2.2M

5-hour window: 23% used, 77% left, resets 18:40
Planning cost so far: 380k (9% of forecast)
→ Fits comfortably.
```

Four things to know about reading it.

**The bounce allowance is shown separately on purpose.** It is the biggest source of variance — a review that sends work back re-runs the build and the review. The low end of the range assumes no bounce; the high end assumes two. When the verdict says *tight*, the bounce allowance is usually what would push you over.

**The verdict compares the upper end against what's left**, because being surprised mid-order is the expensive outcome. *Wait* means the reset time is your friend: the window refills, and the plan is still there.

**The budget number is a snapshot, not a live feed.** It comes from the status line, which is the only place Claude Code exposes your rate limits, and it is machine-local — work you did on another device counts against the same window but shows up here only after the next reading. When it matters, `/usage` is the authority. If the gate says the budget is unknown, the statusline sensor hasn't run: check that Node is available and `/bootstrap` wired it.

**The planning-cost line is money already spent, not a further charge.** Getting to this gate cost something — reading the project, writing the plan — and that spending is already inside the total the order will report. Showing it as a share of the forecast answers a question the estimate alone can't: whether the thinking is proportionate to the doing. A small order where planning is 40% of the forecast is a signal that the planner surveyed more than it needed to; `/token-report --plan-cost` breaks it into the main session's reading versus the planner's own dispatch, which is usually enough to see which one to blame. On a solo order — one the main session planned itself, with no planner dispatch to measure — add `--solo`, and it reports the main session's spend rather than "unknown".

Forecasts improve as the project accumulates history. The first few come from shipped baselines; after three orders the planner calibrates from your own build log, and step 7 records `est → actual` so the maintainer can flag it if the estimates are systematically off. Once three orders have recorded a `plan` figure, the shipped guess at planning overhead is replaced by what your project actually does.

## Watching what it costs

Run **`/token-report`** any time. It reads the current session's transcript and tells you the cache hit rate, where the prefix got thrown away and why, what each agent type cost, and whether the order had a context pack. Three flags narrow it: `--budget` for your five-hour and seven-day windows alone (no transcript needed), `--plan-cost` for what creating the current plan cost (`--solo` when the main session planned it), and `--line` for the one-line form step 7 appends to the build log.

Two habits keep orders cheap, and both are in `.claude/conventions/cache-discipline.md`:

- **Don't switch model or effort mid-order, and don't `/compact` mid-order.** Each throws away the cached prefix and pays to rebuild it. Do them between orders instead. If you abandon a direction, `/rewind` is cheaper than `/compact` — it goes back to a prefix that is still cached.
- **Let the planner write the context pack.** It surveys the repo once and puts the findings in the ledger, so four implementers don't each go exploring. If `/token-report` says "no context pack" on a real order, that survey happened four times.

The statusline shows the hit rate live, with a `!` when the prefix is being rebuilt — if that marker appears right after you did something, that's the thing that broke the cache. Step 7 also records a one-line cost summary per order in `docs/build-log.md`, and the maintainer reads those to flag drift.

If none of that appears — no statusline, `/token-report` saying it needs Node, a budget that reads "unknown" — run **`/deps`**. It checks the framework's external dependencies, says what each missing one is costing you, and offers to install a missing git or Node (only on your yes, one at a time). It's also the quick answer when a teammate clones the repo and something doesn't light up.

## Keeping it healthy

Every few completed orders, or after a structural change, run the `maintainer` (`use the maintainer subagent to reconcile docs and prune memory`). It re-syncs the living docs against the code, trims bloated memory/rules, and refreshes the project map. The append-only build log needs no upkeep; the living docs do — this is that upkeep.

The maintainer also checks whether any agent's practice knowledge has gone stale and tells you which ones to run `/improve-agent` on. It only ever recommends — enrichment touches the web, so it stays behind your approval.

## Tips

- **Keep agent descriptions sharp.** Auto-selection matches your prompt against each agent's `description`. If routing feels off, tighten the descriptions.
- **Trust the ledger.** `docs/tasks/<feature>.md` is how a fresh session resumes — you don't have to re-explain in-flight work.
- **Don't skip the gate to save time.** The plan gate is cheap and it's your only steering point; skipping it trades control for speed you'll usually regret.
