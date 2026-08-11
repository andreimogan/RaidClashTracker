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

## Tool grants by role type

- **Read-only (planning, review, analysis):** `Read, Grep, Glob` — plus `Bash` only if it must run builds/tests/`git diff` to inspect. Never `Write`/`Edit`.
- **Write (implementation, integration, maintenance):** `Read, Grep, Glob, Write, Edit, Bash`.

## Permission policy

- Read-only agents never modify files. If they find a problem, they report it; they do not fix it.
- Write agents modify only the files they own for the current task (see `handoff-contract.md`). They must claim ownership before writing and release it when done.
- The human approval gate is **plan mode**, owned by the main session — not by any subagent. Agents never ask the user to approve; they return results to the main session, which surfaces them.

## Core team vs specialists

- The **core team** (`task-planner`, `flow-implementer`, `integrator`, `flow-reviewer`, `maintainer`) is project-agnostic and committed with this scaffold. These files contain no project facts — they read facts from the knowledge layer (`CLAUDE.md`, `docs/project-map.md`, `.claude/rules/`) at runtime.
- **Specialists** are project-specific agents that `/bootstrap` or `/add-role` may generate into `.claude/agents/` when evidence justifies them (e.g. a `data-model-specialist`). They follow this same format and are additive — generating one never rewrites an existing agent.

## Writing agent bodies

Keep bodies tight. State the agent's job, its hard rules, what it reads, what it produces, and when to escalate. Point to conventions and the knowledge layer rather than restating them. An agent should read neighboring code and the project map before acting, and flag unknowns explicitly rather than inventing facts.
