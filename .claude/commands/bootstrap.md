---
description: Set up (or re-sync) this project's agent team and knowledge layer. Inspects the repo, asks only for gaps, and generates the project-specific files. Idempotent — safe to re-run.
---

# /bootstrap — set up the agent team

You are the main session running the one-time (idempotent) setup. Do the work yourself; do not dispatch subagents for this. Follow `.claude/conventions/elicitation.md` for any questions.

## 1. Detect state

Inspect the repo before doing anything:
- Is there source code? → **brownfield**: derive facts from the code.
- No code but there are docs/specs? → **greenfield-with-docs**: derive from those.
- Neither? → **interview**: use the layered questionnaire.

Also detect what already exists (`CLAUDE.md`, `.claude/rules/`, `.claude/settings.json`, `.claude/agents/*`, `docs/project-map.md`). This determines merge vs. generate.

## 2. Derive + (if needed) ask

Derive as much as possible from evidence. For whatever inspection can't fill, run the **layered questionnaire** (`elicitation.md`): batched, high-signal first, deeper only if roles still aren't inferable. Stopping rule: you can name every proposed role with the evidence/answer that justifies it. If you can't after a reasonable second layer, **refuse** — say what's missing; do not scaffold on guesses.

## 3. Infer the team

From the evidence, produce two sets:
- **Needed team** — the core team (always) plus any project-specific specialists the evidence justifies.
- **Excluded roles** — specialists you considered but don't think are needed, each with a one-line reason.

## 4. Dual gate (get approval)

Present, and wait:
- The needed team, each role with its justifying evidence.
- The excluded roles with reasons, and offer: add any anyway?
- For each excluded role the user chooses to add, run the **mini-questionnaire** (`elicitation.md`) so it isn't cold — 2–3 questions to seed its description, tools, and scope.

Do not generate until the user confirms the final team.

## 5. Reconcile + generate

Generate **only what's missing**; for anything that already exists, propose a diff or append — **never overwrite**. This is what makes re-running safe. Using the templates in `.claude/templates/`, write:
- `CLAUDE.md` — project facts + the standing orchestration directive + the maintenance cadence.
- `.claude/rules/<domain>.md` — path-scoped rules; discover the actual directory globs from the repo.
- `.claude/settings.json` + `.claude/hooks/orchestrate-gate.py` — the `UserPromptSubmit` hook that makes plan-first orchestration automatic.
- `.claude/agents/<specialist>.md` — any approved project specialists (per `agent-authoring.md`). Never rewrite existing core agents.
- `docs/project-map.md` — the architecture snapshot.
- `docs/build-log.md` — seed the first entry ("here's what we decided to build").
- `docs/reference/` — a first pass of living docs.

## 6. Report

List what was created vs. skipped-because-present, note any unknowns/blockers, and tell the user they can now prompt normally (the hook will orchestrate) or use `/direct` for quick asks. Remind them plan mode is their approval gate.
