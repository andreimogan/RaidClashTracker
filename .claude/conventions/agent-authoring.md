# Convention: Agent authoring

How every agent file in `.claude/agents/` must be written. Read this before creating or editing any agent (the `/bootstrap` and `/add-role` commands both follow it).

## File format

Each agent is a single Markdown file with YAML frontmatter. The frontmatter fence is `---` (three hyphens), **not** `***`. A wrong fence silently breaks parsing and the agent's tools/permissions won't apply.

```md
---
name: agent-name
description: One or two sentences describing WHEN to use this agent, written for auto-matching.
tools: Read, Grep, Glob
model: inherit
---

You are agent-name.

## Purpose
...
## Rules
...
## Inputs
...
## Outputs
...
## Escalation
...
```

## Frontmatter fields

- **name** — short, lowercase, hyphenated, memorable. This is what you type to target the agent explicitly ("use the flow-reviewer subagent…"), so keep it clean.
- **description** — the single most important field. The main session auto-selects agents by matching the task against this text. Write it as *when to use me*, concrete and keyword-rich, not *what I am*. Good: "Use to review a merged implementation for correctness and to verify docs match code. Invoke after integration." Bad: "A reviewer agent."
- **tools** — comma-separated allowlist. Omitting this inherits all thread tools; always set it explicitly so read-only agents cannot write. No agent lists `Task` — subagents cannot spawn other subagents (only the main session dispatches).
- **model** — `inherit` (use the session's model) unless a role needs a specific tier.
- **skills** — optional YAML list of skill names whose full content is injected at startup. Used for one thing here: wiring an agent to its companion practice skill (below). Leave it off unless the agent has one.

## Tool grants by role type

- **Read-only (planning, review, analysis):** `Read, Grep, Glob` — plus `Bash` only if it must run builds/tests/`git diff` to inspect. Never `Write`/`Edit`.
- **Write (implementation, integration, maintenance):** `Read, Grep, Glob, Write, Edit, Bash`.
- **Research (bringing outside knowledge in):** `Read, Grep, Glob, WebSearch, WebFetch`. Never `Write`/`Edit`/`Bash` — a web-enabled agent that can also write is how a page's contents end up in a file you keep. Research agents return findings; the main session writes them after the gate. `capability-researcher` is the only one today.

## Permission policy

- Read-only agents never modify files. If they find a problem, they report it; they do not fix it.
- Write agents modify only the files they own for the current task (see `handoff-contract.md`). They must claim ownership before writing and release it when done.
- The human approval gate is **plan mode**, owned by the main session — not by any subagent. Agents never ask the user to approve; they return results to the main session, which surfaces them.

## Core team vs specialists

- The **core team** — five agents in the loop plus `capability-researcher` on demand — (`task-planner`, `flow-implementer`, `integrator`, `flow-reviewer`, `maintainer`) is project-agnostic and committed with this scaffold. These files contain no project facts — they read facts from the knowledge layer (`CLAUDE.md`, `docs/project-map.md`, `.claude/rules/`) at runtime.
- **Specialists** are project-specific agents that `/bootstrap` or `/add-role` may generate into `.claude/agents/` when evidence justifies them (e.g. a `data-model-specialist`). They follow this same format and are additive — generating one never rewrites an existing agent.

## Writing agent bodies

Keep bodies tight. State the agent's job, its hard rules, what it reads, what it produces, and when to escalate. Point to conventions and the knowledge layer rather than restating them. An agent should read neighboring code and the project map before acting, and flag unknowns explicitly rather than inventing facts.

A body is injected on every dispatch and re-read on every turn of that agent's loop, so length is paid repeatedly. Resist the urge to teach an agent its domain here — cut anything that restates what the model already knows, and put durable domain knowledge in a companion skill instead.

## Companion practice skills

An agent may be paired with `.claude/skills/<agent>-practices/`, generated and refreshed by the procedure in `capability-research.md`. The skill carries what the agent should know about doing its domain well in this project's stack; the body stays as short as it always was. Wire it with `skills: [<agent>-practices]` and nothing else changes.

**Bodies are immutable.** Enrichment never edits an agent's prose. The one permitted in-place change to an existing agent file is adding that `skills:` line, and only with the user's approval — everything else about "never rewrite an existing agent" stands, in `/bootstrap`, `/add-role` and `/improve-agent` alike.

This is also what keeps the **core team** portable: `task-planner` and the rest stay project-agnostic and travel between repos unchanged, while anything project-specific they learn lives in a skill that does not.
