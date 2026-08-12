---
description: Refresh one agent's practice knowledge as the project evolves. Re-audits the repo, re-verifies stale sources, and proposes a diff to that agent's companion practice skill — including deletions. Never edits the agent's own prose.
argument-hint: [agent-name] [optional focus, e.g. "state management" or --shrink]
---

# /improve-agent — bring one agent's knowledge back up to date

You are the main session. This is an Amend-flow command, like `/add-role`: do it yourself, don't run the operate loop for it, and don't dispatch implementers. The one subagent you dispatch is `capability-researcher`.

Follow `.claude/conventions/capability-research.md` — it is the procedure; this file is only the entry point and the reporting shape. Read it before starting.

## 1. Resolve the target

Take the agent name from `$1`. If it's missing or doesn't match a file in `.claude/agents/`, list the roster with a one-line note on which agents have a practice skill and which don't, and ask which one. `$2` is an optional focus ("state management", "the new auth flow") — or `--shrink`, which runs steps 3–6 with research skipped entirely.

Read the agent definition, its `.claude/skills/<agent>-practices/SKILL.md` and `SOURCES.md` if they exist, and `CLAUDE.md` plus `docs/project-map.md` for current project state.

**First-time enrichment** — if the agent has no practice skill, say so and treat this as creation rather than refresh. Everything else is the same.

## 2. Staleness report — before spending anything

Report what has actually moved, so the user decides whether a refresh is worth it:

- **Version drift** — dependency versions in `SOURCES.md` under "Versions this was researched against" versus what the manifests and lockfiles say now. A changed major is the strongest possible reason to refresh; a patch bump is usually not.
- **Expired claims** — rows past their TTL, and every `on-change` row whose dependency moved.
- **Low-confidence claims** — `confidence: search` rows, which were never registry-backed.
- **Repo drift** — has the agent's domain changed shape since the skill was written? New directories, a swapped library, a convention the code now contradicts.

If nothing has moved, say exactly that and stop. A refresh that re-verifies unchanged sources costs tokens and buys nothing — this report existing is what makes it cheap to ask.

## 3. Research

Unless `--shrink`, dispatch `capability-researcher` with: the agent's name, description and domain; its existing skill; the pinned versions you resolved; the focus from `$2`; and the specific claims the staleness report flagged. Ask it to prioritise those over a general sweep.

## 4. Synthesize — including what to remove

Patch `SKILL.md` in place. Improvement here means both directions, and the removals are the half that usually gets skipped:

- claims contradicted by current sources, or scoped to a version this project no longer uses
- anything that restates general model knowledge — true of any project on this stack, so not worth a line
- guidance the repo has since adopted as convention (that belongs in `.claude/rules/`, not here)
- persona filler, restated process, and duplicated sections

Move genuinely superseded guidance into the collapsed `Old patterns` block with its deprecation month; delete the rest outright. Update `SOURCES.md`: new rows, refreshed `verified-on` dates for anything actually re-read, the current version table, and one row appended to Revisions.

Enforce the caps from `capability-research.md` — under 500 lines, `name`/`description` frontmatter only. If the result would exceed the cap, consolidate; do not write it and promise to tidy later.

## 5. Gate

Require a clean git working tree first — if it isn't clean, say so and stop, because a clean tree is what makes this revertable in one command. Then show the unified diff and wait for explicit approval.

State the token cost of the change alongside the diff: roughly how many lines the skill gained or lost, and that this is paid on every dispatch of that agent. A skill that grew every refresh is the documented failure mode of this whole category; showing the number is how we notice.

On approval, write, then append a `docs/build-log.md` entry — what changed, what was removed, which sources drove it.

## 6. Report

- What moved and what you refreshed
- **What you removed**, explicitly — if the answer is nothing, say so, it's a signal
- Line-count delta on the skill
- Any open questions the sources couldn't settle, and dead registry entries worth fixing in `source-registry.md`
- Offer the measured check: `/token-report` on a session before the change and one after, comparing the per-agent numbers for the agent you touched. It costs nothing beyond the sessions you were running anyway. (In the framework repo, `/debug-run` does the same against a fixture for roughly $0.35 on haiku to a few dollars on sonnet — **only run that if the user says yes.**)

## Rollback

The change is one commit's worth of files. If it turns out wrong, `git checkout -- .claude/skills/<agent>-practices/` restores it — which is exactly why step 5 demands a clean tree up front.
