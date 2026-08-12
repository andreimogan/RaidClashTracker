# Onboarding — the agent team scaffold

This is the *setup and understanding* guide. For how to drive the system day to day, read `TUTORIAL.md` after this.

## What this is

A self-contained scaffold that turns a repository into a standing team of Claude Code subagents you command. You issue a prompt; the system analyzes it, plans first, and dispatches the right specialists to do the work — with you approving the plan before anything is written. Everything lives inside the repo and is version-controlled with your code. The scaffold never writes files outside your project; the only machine-level change it ever offers is installing a missing runtime, with your explicit yes.

## Prerequisites

`SCAFFOLD-MANIFEST.md` **Tier 0** is the authoritative list — what each thing unlocks and exactly what you lose without it. **`/deps` checks your machine against it** and can install the two that matter; `/bootstrap` runs the same check as its step 0, so you can simply start there. The short version:

- **Claude Code**, 2.1.x or later — needs subagents, project-scoped `.claude/` config, hooks (`UserPromptSubmit` and `InstructionsLoaded`), plan mode, and the statusline's rate-limit field. Developed against 2.1.198. If a feature below doesn't behave, check your version against the current docs.
- **git** — recommended, and **local git, not GitHub**: no account, no remote, nothing leaves your machine. Working entirely offline on one folder is a first-class way to use this. What the framework wants is the history: a clean tree is what makes `/improve-agent` undoable in one command, and a diff is what the reviewer reads. Without it those two lose their basis and the planner can't skip surveying code that hasn't changed — everything else still runs. If the folder has never been a repo, bootstrap offers `git init` (one local directory, nothing published).
- **Node 18+** — recommended, and it buys more than it looks like: the orchestration hook, *and* the whole measurement layer — `/token-report`, the statusline, the budget sensor behind the plan gate's five-hour verdict, and the cost line in your build log. Without it the hook falls back to Python and the measurement layer is simply dark.
- **Python 3.8+** — an alternative hook runtime only, used when Node isn't there. Never installed for you, because Node does this job too. Don't assume `python3` works: on Windows it is usually a Microsoft Store stub that resolves on `PATH` and fails only when executed, which is why every probe runs the command rather than looking for it.
- **Network access** — only for the capability research behind `/add-role` and `/improve-agent`. Offline, they fall back to auditing your repo and say so.
- Basic familiarity with Claude Code subagents and slash commands.

## Mental model

**One self-contained bundle, one project.** There's no user-scope install and no two-scope split — everything is under your project root and travels with the repo. Clone it, and the whole system is present. The framework never puts *its own files* anywhere but your project; external runtimes are the one exception to "nothing global", and they are only ever installed at the preflight, one at a time, with your explicit yes.

**Two kinds of files:**
- *Committed template* — the agents, recipes, conventions, commands, scripts and these docs. You commit them once; they're project-agnostic and carry no project facts.
- *Bootstrap-filled* — `CLAUDE.md`, path rules, the hook config, the project map, the build log, living docs, and the ledger. `/bootstrap` writes these from your repo's evidence (or a short questionnaire) the first time.

`SCAFFOLD-MANIFEST.md` lists every file in both groups and what each is waiting on. Worth a skim now: it is the difference between "this doesn't work" and "this isn't wired up yet". The commands and agents are live the moment you copy them — you can name an agent and it runs — but **nothing routes your prompts through the loop automatically until `/bootstrap` writes `.claude/settings.json`**, because that is what installs the hook.

**Four ways in:**
- **Setup** (`/bootstrap`, once) — checks your machine for the prerequisites, then builds the team and the knowledge layer. `/deps` re-checks the machine on its own any time.
- **Operate** (every prompt) — analyzes, plans, dispatches. This is the daily loop. Orders that touch one ownership group run it leaner: the main session plans them itself and skips integration. The gate never moves.
- **Amend** (`/add-role` and `/improve-agent`, on demand) — adds a specialist mid-project, or refreshes what one knows.
- **Maintenance** (periodic) — reconciles docs against code so nothing drifts.

**One shared memory.** A per-project knowledge layer — facts, rules, per-agent memory, the ledger, the append-only build log, and the living docs — that every phase reads and writes. It's what lets a generic agent behave like a project-tuned one, and what lets a fresh session resume where the last left off.

**The gate is also a budget decision.** Every plan carries an estimate of what running it will cost and how that sits against your five-hour window, with a one-line verdict — fits, tight, or wait until the reset. Approving a plan is then a decision you can actually make, rather than one you discover the consequences of halfway through. It also shows what reaching the gate already cost, as a share of the forecast, which is how you notice a planner reading more of the project than the order warranted.

**Read narrowly, on purpose.** Every path that reads the repo works to a budget — the map and the rules first, then only the files the order touches, sampling large directories rather than consuming them. Bugs get their own style: start from the symptom you pasted and follow it to the fix site, instead of surveying the module it lives in. There is no search index behind this and deliberately so; the reasoning, and the three things we chose not to build, are in `.claude/conventions/cache-discipline.md`.

**Context is the cost.** Almost everything an order spends is context re-sent each turn, which Claude Code caches at about a tenth of the input rate. Two habits follow, and the scaffold builds both in: keep the cached prefix stable (`.claude/conventions/cache-discipline.md` lists what breaks it), and read the project *once* per order rather than once per agent — the planner writes a **context pack** into the ledger and everyone else starts from it. `/token-report` tells you whether either is working, and step 7 records a one-line cost summary in the build log so the trend is visible.

**Two kinds of knowledge, kept apart.** The shared memory above holds project *facts*. What an agent knows about doing its *craft* well — current practice for its domain, at the versions you actually pin — lives separately, in a companion practice skill under `.claude/skills/<agent>-practices/`, built by auditing your repo and researching curated sources. The separation is deliberate: an agent's own prose is re-read on every turn it takes, so it stays short and project-agnostic, while the skill loads only for the agent that owns it. `/improve-agent` refreshes one when the project moves, and it is as willing to delete as to add.

**You are the orchestrator.** The thing that analyzes and dispatches runs in your *main session*, not in a subagent (subagents can't spawn subagents). Your one approval point is **plan mode**: you see the plan and the file-ownership split before any code is written.

**And one way to test the thing itself.** Everything above describes using the team. `tools/debug/` is for changing it: it runs the operate loop against a throwaway fixture — simulated for free, or for real headlessly — and shows you where the tokens went, whether the steps ran in contract order, and whether ownership and doc-sync actually held. It exists because "did that workflow change help?" is otherwise unanswerable except by feel. It lives in the scaffold's own repo and is **not** copied into projects; see `tools/debug/README.md`.

## File map

```
your-project/
├── .claude/
│   ├── agents/        core team (committed) + specialists (generated)
│   ├── commands/      /bootstrap · /deps · /add-role · /improve-agent · /token-report · /direct
│   ├── scripts/       token-report.js · statusline-cache.js (measurement, Node)
│   ├── skills/        companion practice skills, one per enriched agent
│   ├── recipes/       operating-recipe.md (the operate loop)
│   ├── conventions/   elicitation · agent-authoring · handoff-contract ·
│   │                  cache-discipline · cost-forecast · capability-research ·
│   │                  source-registry
│   ├── hooks/         orchestrate-gate.js / .py (auto plan-first; wired by bootstrap)
│   ├── rules/         path-scoped rules (generated)
│   ├── templates/     what /bootstrap fills
│   ├── settings.json  hook + statusline wiring (generated)
│   └── budget-state.json  rate-limit samples (runtime, machine-local, gitignored)
├── CLAUDE.md          facts + orchestration directive (generated)
├── docs/
│   ├── project-map.md current snapshot (generated)
│   ├── build-log.md   append-only decisions (generated)
│   ├── reference/     living docs (generated, maintained)
│   └── tasks/         the ledger (runtime)
├── SCAFFOLD-MANIFEST.md  every file, and what it's waiting on
├── ONBOARDING.md      this file
└── TUTORIAL.md        how to use it day to day
```

Six agents: five in the loop — `task-planner` (splits work + assigns file ownership, writes the context pack), `flow-implementer` (builds one owned slice; dispatched in parallel), `integrator` (merges the slices, resolves seams), `flow-reviewer` (reviews the merged result + checks docs match code), `maintainer` (periodically reconciles docs, prunes memory, re-derives the map) — plus `capability-researcher` on demand, which `/add-role` and `/improve-agent` dispatch for you.

## First-run walkthrough

1. **Drop the bundle into your repo.** Copy `.claude/`, `docs/`, `SCAFFOLD-MANIFEST.md`, `ONBOARDING.md` and `TUTORIAL.md` into your project root, minus the dev-only paths listed at the bottom of the manifest (`tools/`, `.claude/commands/debug-*.md`, `.claude/hooks/__pycache__/`, the architecture diagram). Or clone a repo that already has them. Commit.
2. **Open the project in Claude Code** and run **`/bootstrap`**.
3. **Answer if asked.** If the repo has code or docs, bootstrap reads them and asks little. If it's empty, it runs a short layered questionnaire (what you're building, the stack, the first thing to build, any hard constraints).
4. **Approve the team at the confirm gate.** Bootstrap shows the roles it inferred (plus any it excluded, with reasons, and an option to add them anyway via a short mini-questionnaire). Nothing is generated until you confirm.
5. **Done — it's live.** Bootstrap writes `CLAUDE.md`, the rules, the hook, the project map, the first build-log entry, and a first pass of docs. From here, prompt normally and the operate loop runs (see `TUTORIAL.md`).

## Design rationale (why it works this way)

- **Plan-first is enforced, not hoped for.** A `UserPromptSubmit` hook injects the "plan first, then dispatch" directive on every prompt (deterministic), and plan mode makes you approve before execution (structural). `CLAUDE.md` carries the same directive as a backstop. Belt, suspenders, and a gate.
- **The orchestrator is the main session** because subagents cannot spawn subagents. That's why there's no `orchestrator.md`.
- **Parallel implementers coordinate through files, not shared memory.** The planner assigns disjoint file ownership; implementers claim their files in the ledger before writing. That's what makes "a team working together" safe instead of a clobber-fest.
- **Documentation can't silently drift.** The reviewer's doc-sync check blocks a cycle whose living docs don't match the code, and periodic maintenance reconciles accumulated drift. The build log is append-only (never rots); the living docs are the part that needs upkeep, so upkeep is built in.
- **It's repo-local by choice.** Self-containment means clone-and-go and no cross-project pollution. The cost is that each repo carries its own copy of the generic agents — if that ever bites, the folder layout is plugin-shaped and can graduate to a real Claude Code plugin with version pinning.
