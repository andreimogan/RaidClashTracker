# Convention: Cost forecast and budget awareness

Deciding to start an order is partly a budget decision: a four-task feature with a review bounce can consume a large share of a five-hour window, and finding that out halfway through is worse than knowing before you approve. So the plan gate shows what the plan will cost and whether there is room to run it.

Two numbers, from two different places:

- **What it will cost** — estimated, from this project's own history where it exists.
- **What is left** — measured, from Claude Code's own rate-limit reporting.

## Where the budget number comes from

Claude Code's statusline receives the authoritative figures on stdin:

```json
"rate_limits": {
  "five_hour":  { "used_percentage": 23.5, "resets_at": 1738425600 },
  "seven_day":  { "used_percentage": 41.2, "resets_at": 1738857600 }
}
```

`.claude/scripts/statusline-cache.js` displays them and appends each reading to `.claude/budget-state.json`, so the numbers survive into a later turn where nothing is rendering a status line. `.claude/scripts/token-report.js --budget` reads them back.

Three honest limits, which the tooling states rather than hides:

- **As fresh as the last status-line render.** The reading is a snapshot, not a live feed. The reader always prints how old it is.
- **Machine-local.** Usage from another device or from claude.ai counts against the same window but only appears here after the next sample.
- **`/usage` is the authority.** When the numbers matter, check it. This is a convenience layer over the same data.

If there is no state file, say the budget is unknown and point at `/usage`. Never invent a percentage.

## Where the cost number comes from

**Prefer this project's history.** Once `docs/build-log.md` holds three or more `Cost:` lines, use them: mean tokens per implementer task, per bounce, per order overhead. A project's own measurements beat any table. Once three or more of those lines carry a `plan NNNk` fragment, their mean replaces the order-overhead row below outright — that row is a guess about your project that your project has since answered.

Until then, fall back to these baselines. They come from real measured runs of this scaffold and are **estimates for orientation, not predictions** — at Sonnet rates, on small projects:

| Component | Tokens | Note |
|---|---|---|
| Order overhead (analyze + plan + gate) | ~1.4M | Roughly fixed; the gate re-reads the plan |
| Per implementer task | ~430K | Scales with how much of the project the task touches |
| Integrate | ~450K | Skipped entirely on single-implementer orders |
| Review pass | ~460K | |
| Review bounce (rebuild + re-review) | ~1.0M | The swing factor — see below |
| Report + commit (step 7) | ~1.3M | More than integrate and review combined |

Two adjustments worth making: a project much larger than a handful of files reads more per task, and Haiku runs cost roughly a fifth of Sonnet while Opus runs cost more.

## Measuring the overhead

The first row of that table is the only one you can measure *before* deciding to run anything, because by the gate it has already happened. `token-report.js --plan-cost` does exactly that:

```
Plan cost — what creating this plan has cost
  main session (analyze + gate)     659.2k tokens
  task-planner                       33.7k tokens   (from the subagent transcript)
  planning total                    692.9k tokens   — 9% of the 8.1M order forecast
```

It measures from the order's opening prompt to the gate — the main session's own analysis turns plus the `task-planner` dispatch, broken out. The split is the useful part: on our own measured runs the planner dispatch is the *cheap* half, and the main session's reading dominates. Optimising the planner when the main session is doing the reading fixes nothing.

The number surfaces in three places, each answering a different question:

- **At the gate** — what has this plan already cost me, as a share of what running it will cost.
- **In the ledger**, `## Plan cost` — written by the main session at step 3, because a subagent cannot see its own transcript. It sits *below* the forecast: the forecast parser reads the first token figure in its own section, and a plan-cost line above the estimate would be silently read as the estimate.
- **In the build log**, the `plan NNNk` fragment — which is what turns the overhead row above from a shipped guess into your project's own measurement.

Three things it does not claim:

- **It is a breakdown, not an addition.** Those turns are already inside the session total that step 7 reports as the actual. Never add plan cost to it.
- **At the gate it means "so far".** The turn presenting the plan has not been billed yet, so the figure is a slight undercount. After the gate it is bounded exactly.
- **It says where the planner's number came from.** Best evidence is the dispatch result; failing that the subagent turns in the window; failing that the subagent's own transcript. Background dispatches return no totals at all, in which case it reports the main session and says the planner is unknown rather than inventing a figure.

### On solo orders

A solo order has no planner dispatch to anchor on, so the tool needs telling. At the gate, run `--plan-cost --solo`: it measures the main session from the order's opening prompt to now and reports the planner as *not dispatched* rather than *unknown* — a different fact, and the one that is true. After the gate no flag is needed; `--line` at step 7 finds the `ExitPlanMode` and emits the `plan NNNk` fragment as usual.

The forecast itself simply has no integrate component and no planner line — the survey cost is main-session turns. Nothing else changes.

One thing to watch when calibrating: **solo `plan` figures measure a different shape** — main session only — so they run cheaper than team ones by construction. Averaging the two together would produce an overhead figure that describes neither. Step 7 marks solo orders in the Decisions line so the two can be told apart.

## The shape of a forecast

The planner writes `## Cost forecast` into the ledger, beside the context pack. Keep it to a few lines:

```md
## Cost forecast

**Estimate: 4.2M tokens** (range 3.4M–6.2M) · ~$3.00 at claude-sonnet-5 rates
- Parallel build, 4 tasks — 1.7M
- Report + commit — 1.3M
- Bounce allowance (1 review bounce) — 1.0M
- Everything else (analyze, plan, gate, integrate, review) — 2.2M

Basis: 6 prior orders in docs/build-log.md · Window at plan time: 5h 23% used, resets 18:40
```

Rules that keep it useful:

- **Show the bounce allowance separately.** It is the largest single source of variance, and burying it in the total makes the estimate look more certain than it is. The low end of the range assumes no bounce; the high end assumes two.
- **Tokens are the primary unit.** Dollars and window-percentage are derived and only shown when they can be computed honestly.
- **Say what it is based on** — "6 prior orders" or "shipped baselines, no history yet". A reader deserves to know which.
- **Three or four components, not a per-step table.** Our own measurements show step-level estimates drift badly; component-level ones are useful.

## The verdict at the gate

Step 3 presents the forecast, the current window state, and a one-line read. Compare the **upper end** of the range against what remains — the point is to avoid being surprised, and the surprise case is the expensive one.

- **Fits comfortably** — upper end is under about two-thirds of what remains.
- **Tight** — upper end is most of what remains. Say what specifically would push it over (usually the bounce allowance), and note that the window resets at a given time.
- **Wait** — upper end exceeds what remains. Give the reset time and offer the alternatives: run a smaller slice of the plan now, switch to a cheaper model, or wait.

Converting tokens to a percentage needs a tokens-per-percent figure, which `--budget` derives once it has two samples spanning a change in the window. Before that, present the forecast in tokens and the window in percent, side by side, without pretending to relate them. **A verdict you cannot support is worse than no verdict** — say "budget unknown" and move on.

The verdict is advice. The user approves or rejects the plan; nothing here blocks anything.

## Closing the loop

Step 7's cost line records the forecast next to what actually happened:

```
Cost: est 4.2M → actual 4.8M (+14%) · ~$3.40 · cache 97% · 12 dispatches · pack 84L · plan 380k
```

That is what makes forecasts improve. The maintainer reads these lines and flags systematic bias — consistently 30% under means the baselines or the history-derived means need adjusting, and it says so rather than letting the forecast quietly stay wrong. It watches the `plan` fragment on the same cadence: planning overhead climbing across comparable orders, or eating an outsized share of small ones, means the planner is surveying more than the order needs.
