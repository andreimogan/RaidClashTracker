# Convention: Elicitation (questionnaire protocol)

When evidence is missing, the system asks — it does not invent. This document defines how it asks. It is used in three places: the **layered questionnaire** during `/bootstrap`, and the **mini-questionnaire** for an excluded-role opt-in (bootstrap) and for `/add-role`.

## Core rule

Prefer inference from evidence (code, docs). Ask only for gaps you cannot infer and cannot proceed without. Never fabricate project facts, roles, or capabilities to avoid asking. If, after asking, there is still not enough to proceed, **refuse to generate** and say what is missing — do not scaffold on guesses.

## Layered questionnaire (setup, when evidence is thin)

Used by `/bootstrap` when the repo has little or no code/docs to read.

- **Batched, not turn-by-turn.** Ask a small set at once, not one question per message.
- **Layered.** Start with the few questions that most shape the team. Only go deeper if the answers are still insufficient to name each role with justification.
- **Stopping rule (this is the definition of "sufficient"):** stop when you can state *every* proposed role plus the one piece of evidence or answer that justifies it. If you can, proceed to the confirm gate. If you cannot after a reasonable second layer, refuse and explain the gap.

### First-layer questions (the high-signal four)

1. What are you building, in one line? (type + purpose → shapes domain/implementer roles)
2. What's the stack — languages, key frameworks? (seeds memory; decides frontend/backend split)
3. What's the first thing you want the team to build? (right-sizes the team; gives the planner a concrete target)
4. Any hard constraints — deadline, must-use tech, deploy target, things to avoid? (optional; seeds path rules)

Go to a second layer only for genuinely unresolved role questions.

## Mini-questionnaire (per-role seed)

Used (a) in bootstrap when the user opts to add an **excluded** role anyway, and (b) by `/add-role`. Its job is to give one new agent enough to not start cold.

- **Short:** two or three questions, scoped to that one role.
- **Purpose:** produce enough to write the agent's `description`, tool grant, and the piece of the knowledge layer it depends on.

### Mini questions

1. What should this role do, and when should it be invoked? (→ description, for auto-matching)
2. Does it need to write files, or is it read-only? (→ tool grant per `agent-authoring.md`)
3. What part of the codebase / which concerns does it own or watch? (→ path rules, project-map linkage)

Loop until the role is specified enough to author it; if it can't be, don't create it.

## What answers become

Answers are written straight into the knowledge layer — `CLAUDE.md`, `docs/project-map.md`, and `.claude/rules/` — exactly where read-from-docs facts would land. Once captured, a no-docs project is indistinguishable from a docs project to every downstream agent. The questionnaire is an ingest path, not a separate channel.
