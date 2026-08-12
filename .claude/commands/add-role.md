---
description: Add a new specialist agent to this project's team mid-project. Scopes it with a short mini-questionnaire, checks it doesn't duplicate an existing agent, and generates it additively without touching existing agents.
argument-hint: [what the new role should do]
---

# /add-role — add a specialist mid-project

You are the main session. This is the Amend flow — the Amend entry point — one of the four ways in, separate from setup and the operate loop. Do it yourself; the only subagent you may dispatch is `capability-researcher` in step 4b. Follow `.claude/conventions/elicitation.md` and `agent-authoring.md`.

## 1. Mini-questionnaire

Scope the new role with 2–3 questions (`elicitation.md`): what it does and when to invoke it, whether it writes or is read-only, and what part of the codebase/concerns it owns or watches. Loop until the role is specified enough to author. If it can't be, don't create it.

## 2. Fit check vs. existing team

Read `.claude/agents/` and compare the proposed role against what's already there. If it overlaps an existing agent's domain, say so and offer to **extend the existing agent** instead of creating a duplicate. The goal is no redundant roles.

## 3. Confirm

Present the proposed agent — name, description, tools, scope — and wait for approval. Say whether you intend to specialize it (step 4b) so the user can decline that part up front.

## 4. Generate (additive)

On approval, write one new `.claude/agents/<name>.md` per `agent-authoring.md`, and seed its slice of the knowledge layer (a `.claude/rules/` entry and/or a project-map note) from the mini-questionnaire answers. **Existing agents are never rewritten.** Append a note to `docs/build-log.md` recording the new role and why.

## 4b. Specialize

A brand-new agent knows nothing about doing its job *in this stack*. Run the procedure in `.claude/conventions/capability-research.md` for it: audit the repo, dispatch `capability-researcher`, and generate `.claude/skills/<name>-practices/` (`SKILL.md` + `SOURCES.md`) plus the `skills:` line in the new agent's frontmatter.

The step 3 approval covers creating the agent; the capability-research gate still applies to the skill's content — show the diff before writing it.

Skip this when the role is thin, purely project-mechanical, or the user declined. Say you skipped it and that `/improve-agent <name>` can do it later.

## 5. Report

Confirm the new agent is live (it'll show in `/agents`), and that it's now part of the roster the operate loop can auto-select. If you specialized it, name the sources the practice skill was built from and how many claims it carries; if you skipped, say so.
