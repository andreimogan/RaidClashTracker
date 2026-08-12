# Scaffold manifest — what ships, and when it comes alive

**Scaffold version: 2.**

What your machine needs first (**Tier 0**), then everything the scaffold contains in three tiers: what you **copy in**, what **`/bootstrap` generates**, and what **accumulates as you work**. Plus the short list of things that deliberately stay behind in the framework repo.

That version line is how a project says which scaffold it is running, and it is the one thing here you should not edit by hand. When a newer framework exists, its `tools/update/update-project.js` reads this line, works out what changed since, and replaces the files it shipped while leaving everything your project generated — specialists, rules, `CLAUDE.md`, skills, all of `docs/` — untouched. A project with no version line at all predates the stamp and is treated as version 1.

The rule this file encodes: **everything we build ships into your project unless it is named in the dev-only register at the bottom.** `tools/debug/harness/selftest.js` enforces it — a shipped file that isn't listed here fails the test.

---

## Tier 0 — external prerequisites

What has to exist on the machine before any of the files below matter. **`/deps` checks this list any time; `/bootstrap` runs the same check as its step 0.** Only two things are ever installed for you — git and Node — and only when you say yes to each.

| Dependency | Needed for | Status | When it's missing | How `/bootstrap` and `/deps` handle it |
|---|---|---|---|---|
| **Claude Code** — 2.1.x or later. Needs subagents, project-scoped `.claude/`, hooks (`UserPromptSubmit`, `InstructionsLoaded`), plan mode, and the statusline `rate_limits` field. Developed against 2.1.198. | The host. Everything. | Required | Nothing runs. If one named feature misbehaves, check your version against the current docs. | Documented only — it is the thing running these commands, so it is never probed. |
| **git** — any modern 2.x | `/improve-agent` and capability research use a clean tree as their one-command undo; the reviewer reads `git diff` of the merged result; step 2 uses `git diff --stat` to let the planner skip a survey of code that hasn't moved. | Recommended | Those three lose their basis: `/improve-agent` declines to write (it has no undo), the reviewer reviews files instead of a diff, and the survey-skip is off. Everything else works. | Probed by running `git --version`. Offered for install, only on your explicit yes. If git is present but the folder isn't a repo yet, offers `git init`. |
| **Node** — 18 or newer (any maintained LTS) | The entire measurement layer: `/token-report`, the statusline, the budget sensor behind `.claude/budget-state.json`, the gate's `--budget` and `--plan-cost` lines, step 7's cost line. Also the preferred hook runtime. | Strongly recommended | The hook falls back to the Python twin; the statusline block is removed rather than left broken; the budget reads "unknown" and points at `/usage`; build-log entries carry no cost line. The loop itself is unaffected. | Probed by running `node --version`. Offered for install, only on your explicit yes. |
| **Python 3** — 3.8 or newer | An alternative runtime for the orchestration hook (`orchestrate-gate.py`, behaviourally identical to the Node twin). | Optional — superseded when Node is present | Nothing, as long as Node is there. | Probed, **never installed.** Node does everything Python would do here and more, so offering both would install two runtimes to fill one gap. |
| **Network access** | `capability-researcher`'s web search and fetch, used by `/add-role`, `/improve-agent`, and bootstrap's capability pass. | Optional | Research falls back to auditing your repo alone; practice skills come out thinner and say so. | Documented only — not something an installer can fix. |

**git here is a local tool, not GitHub.** No account, no remote, no push, no internet. What the framework uses is the history in the `.git` folder on your disk: a clean tree means "one command puts this back", and a diff means the reviewer sees exactly what changed. Developing entirely locally is a first-class way to use this, and `git init` on a folder that has never been a repo is a purely local act — it creates one directory and publishes nothing.

**Canonical runtime probe order: `node → python3 → python → python3.13 → py -3`.** Probe by *executing* each (`node --version`, `python3 --version`, …), never by `which` or `Get-Command`: on Windows `python3` is commonly a Microsoft Store stub that resolves on `PATH` and fails only when run. Node comes first because it is the only runtime the measurement layer accepts — when it is present, one runtime covers the hook, the statusline and the reporting.

> **Developing the framework itself** additionally needs the `claude` CLI on `PATH` and git for `tools/debug` real runs (both guarded with a clear error), Chrome to re-render the architecture diagram, and optionally Python for the selftest's hook-parity section, which skips cleanly without it. None of that ships — see `tools/debug/README.md`.

---

## Tier 1 — copied into your project before bootstrap

Copy `.claude/`, `docs/`, `SCAFFOLD-MANIFEST.md`, `ONBOARDING.md` and `TUTORIAL.md` into your project root, minus the dev-only paths at the bottom of this file.

### Active the moment they land

Claude Code discovers commands and agents from `.claude/` automatically, so these work before you run anything.

| Path | What it gives you |
|---|---|
| `.claude/commands/bootstrap.md` | `/bootstrap` — sets up the team and the knowledge layer. The one you run first. |
| `.claude/commands/add-role.md` | `/add-role` — add a specialist mid-project, with optional capability research. |
| `.claude/commands/improve-agent.md` | `/improve-agent` — refresh an agent's practice knowledge as the project moves. |
| `.claude/commands/token-report.md` | `/token-report` — cache hit rate, cache breaks and their causes, per-agent cost, context-pack size; `--budget` for your rate-limit windows, `--plan-cost` (`--solo`) for what planning cost. Needs Node. |
| `.claude/commands/deps.md` | `/deps` — check the Tier 0 prerequisites above, and offer to install a missing git or Node. Consent per tool. |
| `.claude/commands/direct.md` | `/direct` — answer without the team. |
| `.claude/agents/task-planner.md` | Splits an order into disjoint file ownership and writes the context pack. |
| `.claude/agents/flow-implementer.md` | Builds one owned slice. Dispatched in parallel. |
| `.claude/agents/integrator.md` | Merges the parallel slices and resolves shared seams. |
| `.claude/agents/flow-reviewer.md` | Reviews the merged result and checks docs match code. Read-only. |
| `.claude/agents/maintainer.md` | Periodic reconciliation: docs vs code, memory pruning, staleness and cost drift. |
| `.claude/agents/capability-researcher.md` | Audits the repo and researches current practice. Read-only + web; never writes. |
| `.claude/scripts/token-report.js` | The measurement itself — parses the session transcript. Node, zero dependencies. |
| `.claude/recipes/operating-recipe.md` | The eight-step operate loop the main session follows. |
| `.claude/conventions/agent-authoring.md` | How agent files must be written; the three tool-grant tiers. |
| `.claude/conventions/elicitation.md` | How to ask: infer from evidence, ask only for real gaps, refuse rather than guess. |
| `.claude/conventions/handoff-contract.md` | The ledger, file ownership, claim/release, and the context pack. |
| `.claude/conventions/cache-discipline.md` | Which layer content belongs in, and what throws the prompt cache away. |
| `.claude/conventions/cost-forecast.md` | How the planner estimates what an order will cost, and how the gate weighs it against your five-hour window. |
| `.claude/conventions/capability-research.md` | The audit + research procedure behind `/add-role` and `/improve-agent`. |
| `.claude/conventions/source-registry.md` | Curated sources the researcher consults before open web search. |

> **One nuance.** The agents and the recipe are present, but nothing *automatically* routes your prompts through the loop yet — that takes the hook, which takes `.claude/settings.json`, which `/bootstrap` writes. Before bootstrap you can still name an agent explicitly ("use the flow-reviewer subagent to…") and it will run.

### Present but dormant until bootstrap wires them

| Path | Waiting on |
|---|---|
| `.claude/hooks/orchestrate-gate.py` | `settings.json`. Injects the plan-first directive on every substantive prompt. |
| `.claude/hooks/orchestrate-gate.js` | Same hook, Node twin. Bootstrap picks whichever runtime actually runs. |
| `.claude/scripts/statusline-cache.js` | `settings.json`. Live cache hit rate and five-hour window in the status line — and the **budget sensor**: it is the only place Claude Code exposes your rate limits, so it records them to `.claude/budget-state.json` for the plan gate to read. |
| `.claude/rules/.gitkeep` | Bootstrap fills this directory with path-scoped rules. |
| `.claude/skills/.gitkeep` | `/add-role` and `/improve-agent` fill it with companion practice skills. |
| `docs/reference/.gitkeep` | Living docs land here. |
| `docs/tasks/.gitkeep` | Task ledgers land here at runtime. |

### Templates — inputs to bootstrap, never read at runtime

| Path | Becomes |
|---|---|
| `.claude/templates/CLAUDE.md.tmpl` | `CLAUDE.md` |
| `.claude/templates/settings.json.tmpl` | `.claude/settings.json` (hook + statusline commands filled in) |
| `.claude/templates/rule.md.tmpl` | `.claude/rules/<domain>.md` |
| `.claude/templates/project-map.md.tmpl` | `docs/project-map.md` |
| `.claude/templates/build-log.md.tmpl` | `docs/build-log.md` |
| `.claude/templates/ledger.md.tmpl` | `docs/tasks/<slug>.md`, written per order by the planner |
| `.claude/templates/practices-skill.md.tmpl` | `.claude/skills/<agent>-practices/SKILL.md` |
| `.claude/templates/sources.md.tmpl` | `.claude/skills/<agent>-practices/SOURCES.md` |

### Reading material

`SCAFFOLD-MANIFEST.md` (this file), `ONBOARDING.md` (setup and mental model), `TUTORIAL.md` (day-to-day use).

---

## Tier 2 — generated by `/bootstrap`

Idempotent: it generates only what's missing and proposes diffs for what exists. Re-running it is safe.

| Generated | Notes |
|---|---|
| `CLAUDE.md` | Project facts, the standing orchestration directive, the maintenance cadence. Kept under ~200 lines — it loads every session. |
| `.claude/settings.json` | **The activation step.** Wires the hook (after probing for a runtime that actually *runs* — on Windows `python3` is often a Store stub that fails only when executed) and the statusline if Node is present. |
| `.claude/rules/<domain>.md` | Path-scoped conventions. Load only when a matching file is touched, so they cost nothing elsewhere. |
| `.claude/agents/<specialist>.md` | Project specialists, only where evidence justifies them. Core agents are never rewritten. |
| `.claude/skills/<specialist>-practices/` | Optional. Offered per specialist; produces `SKILL.md` + `SOURCES.md`. Decline and run `/improve-agent` later. |
| `docs/project-map.md` | Architecture snapshot, including the active team. |
| `docs/build-log.md` | Seeded with the setup decision. Append-only from then on. |
| `docs/reference/*.md` | First pass of living docs. |

**Node-dependent:** the statusline and `/token-report` only. If Node isn't available, bootstrap says so, removes the `statusLine` block rather than leaving a broken command, and everything else works — including the hook, via the Python twin.

---

## Tier 3 — generated as you work

| Path | Written by |
|---|---|
| `docs/tasks/<slug>.md` | The planner, one per order — or the main session itself on a solo order. Holds the `## Context pack`, written once and immutable after approval; the `## Cost forecast` the gate weighs against your window; and the `## Plan cost` the main session measures at the gate. |
| `.claude/budget-state.json` | The statusline sensor, every render. Rate-limit samples the plan gate reads. Machine-local and disposable — `/bootstrap` adds it to your `.gitignore`. |
| `docs/build-log.md` entries | Step 7 of each order, including the `Cost:` line from `token-report.js --line` — `est → actual`, cache hit rate, and the `plan NNNk` fragment that calibrates the next forecast. |
| `docs/reference/*.md` updates | Implementers (via each task's `docs_touched`) and the maintainer. |
| `.claude/skills/<agent>-practices/` | `/add-role` at creation, `/improve-agent` on refresh. |
| `.claude/conventions/source-registry.md` additions | The research procedure, appending project-specific sources. |
| `.claude/agents/<agent>.md` frontmatter `skills:` line | The one permitted in-place edit to an existing agent, and only with your approval. |

---

## Dev-only register — stays in the framework repo

These are for **building and testing the framework**, not for using it. Exclude them when you copy.

| Path | Why it stays |
|---|---|
| `tools/` | The debug harness: sandboxed fixture runs, mock scenarios, the trace viewer, the selftest. It needs fixtures and a sandbox, and it measures *the workflow*, not your project. Your project measures itself with `/token-report`. |
| `tools/update/` | The upgrade tool, run **from the framework repo and pointed at your project**. It needs this repo's git history to tell a file the scaffold shipped from one you changed, so it cannot work from inside your project — and a project never needs it present to be upgraded. |
| `.claude/commands/debug-sim.md` | Drives the harness. The sandbox builder strips it too, so a debug run can't invoke itself. |
| `.claude/commands/debug-run.md` | Same. |
| `.claude/hooks/__pycache__/` | Python bytecode. Gitignored, but a filesystem copy would carry it. |
| `ATS-architecture.html` · `ATS-architecture.png` | The framework's own architecture diagram. |
| `tools/architecture-diagram.md` | How to maintain that diagram. |
| `README.md` | Describes the framework repo, not your project. `ONBOARDING.md` and `TUTORIAL.md` are the ones your project wants. |

---

## Adding to the scaffold

When a new feature adds a file under `.claude/` or `docs/`, add it to Tier 1, 2 or 3 above — or to the dev-only register with a reason. The selftest's **install boundary** section compares this manifest against the real tree and fails on anything undocumented, so the two cannot drift.
