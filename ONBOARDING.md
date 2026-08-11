# Onboarding — the agent team scaffold

This is the *setup and understanding* guide. For how to drive the system day to day, read `TUTORIAL.md` after this.

## What this is

A self-contained scaffold that turns a repository into a standing team of Claude Code subagents you command. You issue a prompt; the system analyzes it, plans first, and dispatches the right specialists to do the work — with you approving the plan before anything is written. Everything lives inside the repo and is version-controlled with your code. Nothing is installed globally.

## Prerequisites

- **Claude Code**, recent enough to support subagents, project-scoped `.claude/` config, hooks (`UserPromptSubmit`), and plan mode. If a feature below doesn't behave, check your Claude Code version against the current docs.
- **A git repository** — this scaffold is meant to be committed alongside your project.
- **Python 3** on your PATH — the orchestration hook is a small Python script.
- Basic familiarity with Claude Code subagents and slash commands.

## Mental model

**One self-contained bundle, one project.** There's no user-scope install and no two-scope split — everything is under your project root and travels with the repo. Clone it, and the whole system is present.

**Two kinds of files:**
- *Committed template* — the agents, recipes, conventions, commands, and these docs. You commit them once; they're project-agnostic and carry no project facts.
- *Bootstrap-filled* — `CLAUDE.md`, path rules, the hook config, the project map, the build log, living docs, and the ledger. `/bootstrap` writes these from your repo's evidence (or a short questionnaire) the first time.

**Four ways in:**
- **Setup** (`/bootstrap`, once) — builds the team and the knowledge layer.
- **Operate** (every prompt) — analyzes, plans, dispatches. This is the daily loop.
- **Amend** (`/add-role`, on demand) — adds a specialist mid-project.
- **Maintenance** (periodic) — reconciles docs against code so nothing drifts.

**One shared memory.** A per-project knowledge layer — facts, rules, per-agent memory, the ledger, the append-only build log, and the living docs — that every phase reads and writes. It's what lets a generic agent behave like a project-tuned one, and what lets a fresh session resume where the last left off.

**You are the orchestrator.** The thing that analyzes and dispatches runs in your *main session*, not in a subagent (subagents can't spawn subagents). Your one approval point is **plan mode**: you see the plan and the file-ownership split before any code is written.

## File map

```
your-project/
├── .claude/
│   ├── agents/        core team (committed) + specialists (generated)
│   ├── commands/      /bootstrap · /add-role · /direct
│   ├── recipes/       operating-recipe.md (the operate loop)
│   ├── conventions/   elicitation · agent-authoring · handoff-contract
│   ├── hooks/         orchestrate-gate.py (auto plan-first)
│   ├── rules/         path-scoped rules (generated)
│   └── templates/     what /bootstrap fills
├── CLAUDE.md          facts + orchestration directive (generated)
├── docs/
│   ├── project-map.md current snapshot (generated)
│   ├── build-log.md   append-only decisions (generated)
│   ├── reference/     living docs (generated, maintained)
│   └── tasks/         the ledger (runtime)
├── ONBOARDING.md      this file
└── TUTORIAL.md        how to use it day to day
```

The core team: `task-planner` (splits work + assigns file ownership), `flow-implementer` (builds one owned slice; dispatched in parallel), `integrator` (merges the slices, resolves seams), `flow-reviewer` (reviews the merged result + checks docs match code), `maintainer` (periodically reconciles docs, prunes memory, re-derives the map).

## First-run walkthrough

1. **Drop the bundle into your repo.** Copy `.claude/`, `docs/`, `ONBOARDING.md`, and `TUTORIAL.md` into your project root (or clone a repo that already has them). Commit.
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
