---
description: Report what this session cost and whether the prompt cache is holding — hit rate, cache breaks with their causes, per-agent costs, and context-pack size. Read-only and free.
argument-hint: [optional path to a session transcript]
---

# /token-report — where the tokens went

You are the main session. This is a `/direct`-style command: run the script and interpret the result. **Do not run the operate loop for it** — nothing is being built.

## What to do

1. Run it from the project root:

   ```
   node .claude/scripts/token-report.js
   ```

   With no argument it finds this project's most recent session transcript. Pass a path as `$1` to analyse a specific one. `--json` gives the same data machine-readably; `--line` gives the one-line form step 7 appends to the build log; **`--budget`** skips the transcript entirely and reports just the subscription windows; **`--plan-cost`** (add **`--solo`** when the main session planned the order itself, with no planner dispatch to measure) reports what creating the current plan cost — the main session's analysis turns plus the `task-planner` dispatch, from the order's opening prompt to the gate. The gate uses the last two together.

   If Node isn't available, say so — this script and the statusline are the two parts of the scaffold that require it — and point at `.claude/conventions/cache-discipline.md`, which is useful without any tooling. `/deps` will install Node if the user wants it (see `SCAFFOLD-MANIFEST.md` Tier 0).

2. **Read the numbers back in plain language.** The raw output is dense; the value you add is interpretation:

   - **Hit rate** — cache reads as a share of all input. High is good. It is normal for this to be 90%+ on a long session, and *that is not the interesting number on its own*: cache reads bill at about a tenth of the input rate, so a high hit rate on a huge total can still be expensive. Quote the estimated cost alongside it.
   - **Main vs subagents** — subagents start cold on a 5-minute TTL by design, so a low subagent hit rate is expected and is the price of context isolation, not a defect.
   - **Cache breaks** — each one threw away the prefix and paid to rebuild it. The script names the cause when the transcript proves it (a model switch is visible in the data); otherwise it lists the candidates. Attribute what you can from what you know happened in the session.
   - **Context pack** — present and within budget, or missing. Missing on a session that ran the loop means implementers each re-explored the repo.
   - **Plan cost** — what creating the current plan cost. Compare it against the *order's forecast*, not the session total: "planning was 9% of what running this will cost" is the useful framing. It is a breakdown of the total above, never an addition to it. If the planner's own figure reads `unknown`, the dispatch was asynchronous and returned no totals — the main-session number is still sound. Outside a session that ran the loop this reports "unknown" and that is correct, not a fault.
   - **Budget** — the five-hour and seven-day windows, how much is left, and when they reset. Two caveats to pass on when they matter: the reading is only as fresh as the last status-line render, and it is machine-local, so work done on another device counts against the same window but is not reflected here. `/usage` is the authority. If the report says the budget is unknown, the statusline sensor has not run — check that `/bootstrap` wired it and that Node is available.

3. **Recommend at most two concrete things**, only if the data supports them. Examples of a supported recommendation: "seven of these breaks were model switches mid-order — pick one model per order"; "`CLAUDE.md` is 240 lines and reloads every session — the maintainer can prune it". Do not manufacture advice when the numbers look fine; "this session was healthy" is a complete answer.

## What this cannot tell you

Claude Code places the cache breakpoints, not the scaffold — so there is no knob to turn here, only behaviour to change. The break causes are inferred from token patterns except for model switches, which are recorded. Costs are estimates at list rates, not billing.
