# Convention: Handoff contract

Subagents do not share a context window. Each returns only its result to the main session. So the team coordinates through **files on disk** — this document defines that file bus. Every agent that participates in the operate loop follows it.

## The task ledger

One ledger file per feature/order, at `docs/tasks/<feature-slug>.md`. It is the single source of truth for what is planned, who owns what, and what is done. It survives across sessions, so a fresh session can resume by reading it.

**Every order has one, including the small ones.** Who *writes* it depends on how the work partitions: `task-planner` on orders that split into two or more ownership groups, the main session itself on a solo order (see below). The file is the contract; its author is not.

### Solo orders

An order that partitions into exactly **one** ownership group does not need a planner dispatch to split what is already single. On those, the main session writes the ledger itself — same template, one task, a compact but present context pack, the cost forecast — and presents it at the same gate.

Two rules keep this from becoming a loophole:

- **Uncertainty resolves toward the planner.** Only a partition you are *sure* is single qualifies. If you are unsure, dispatch the planner. A planner that comes back with a one-task ledger has given a correct answer, not a failed one.
- **Two or more implementers always get a planner.** Disjoint ownership is the mechanism that stops parallel writers clobbering each other; it earns a dedicated pass.

### Ledger schema

The ledger is Markdown with a YAML block per task. The `owns` field is load-bearing — it is what prevents two parallel implementers from clobbering each other.

```md
# Task ledger: <feature-slug>

order: "<the original prompt / order, verbatim>"
status: planning | approved | in-progress | integrating | review | done | blocked
       # forward only. `integrating` is entered only when an integrator runs —
       # a solo order goes in-progress -> review. Skipping ahead is valid;
       # moving backwards is a contract violation.
created: <ISO datetime>

## Context pack

<written once by the planner — see below>

## Cost forecast

<written by the planner at plan time — see .claude/conventions/cost-forecast.md>

## Plan cost

<written by the MAIN SESSION at the gate, never by the planner — a subagent
 cannot see its own transcript. Must stay below the forecast: the forecast
 parser reads the first token figure in its own section.>

## Tasks

- id: t1
  summary: <one line>
  owns:            # files/globs this task exclusively owns for this order
    - src/foo/**
    - src/lib/bar.ts
  depends_on: []   # task ids that must land first
  done_when: <acceptance criteria>
  claimed_by: <agent run id or empty>
  state: pending | claimed | building | done | blocked
  docs_touched:    # reference/ docs this task must update
    - docs/reference/foo.md

- id: t2
  ...
```

## The context pack

The planner reads widely to split an order. Without a pack, every implementer then repeats that reading — four parallel implementers re-exploring the same repo was the single largest cost in our measured runs. The pack is that exploration, done once and written down.

**The planner writes it at plan time, into the `## Context pack` section above the task table** — or the main session does, on a solo order. A solo pack is usually shorter, because one task touches less, but it is never omitted: the implementer and the reviewer both start from it, and neither knows what the main session read. It is immutable after approval: claims and state changes edit the task entries below it and never touch it. If it turns out to be wrong mid-order, that is a finding to report, not a file to quietly rewrite.

Budget: **120 lines.** It is a briefing, not a mirror of the codebase.

What goes in:

- **The diagnosis, on a bug order — first, before anything else.** Symptom → cause → the site of the fix, with the evidence for each link (the failing test, the frame in the trace, the commit that introduced it). On a bug, this *is* the survey: everything else in the pack exists to support it, and a bug pack that opens with a file inventory instead of a diagnosis has buried the one thing the implementer needs.
- **Stack and pinned versions** — read from the manifests, not remembered.
- **The relevant files**, each with a one-line role. Paths, not contents.
- **The seams** — the interfaces where tasks meet, and which task owns each.
- **Binding constraints** — the conventions, rules and invariants this order must respect.
- **Relevant prior decisions** — from the build log, only where they constrain this order.
- **Non-goals** — what is deliberately out of scope, so nobody re-litigates it.

What stays out: pasted code, anything already in `CLAUDE.md`, general knowledge about the language or framework, and anything that is not load-bearing for *this* order.

**For every agent that reads it:** read `CLAUDE.md` and the context pack first, then read your owned files and the seams the pack names. The pack replaces broad exploration — it does not forbid reading a file it points you at, and it is never a substitute for reading the code you are about to change.

**The pack is where to start, not the boundary of what exists.** It is one agent's survey, written before the work began, and it can be incomplete or simply wrong. If what you find doesn't match it, or the answer isn't in the files it names, go look — following the pack off a cliff is worse than spending the tokens. Say so when it happens: a pack that misled you is a finding for the report, and the next order's survey gets better for it.

## Ownership + claim/release protocol

1. **The planner assigns ownership at split time.** Every task's `owns` set must be disjoint from every other task's `owns` set in the same order. No two tasks may own the same file or overlapping globs. If the work can't be partitioned cleanly, the planner says so and proposes a smaller cut — it does not emit overlapping ownership.
2. **Implementers claim before writing.** Before editing, an implementer sets `claimed_by` and `state: claimed` on its task. If the task is already claimed by another run, it must not proceed — it reports the collision to the main session.
3. **Write only what you own.** An implementer edits only files inside its task's `owns` set. Touching a file outside it is a contract violation — stop and report instead.
4. **Release on completion.** On finishing, set `state: done` and record a short changelist in the ledger entry (files touched, what changed). Clear or keep `claimed_by` per the run's convention.

## Shared seams

Files that multiple tasks *read* but only one *owns* (shared types, interfaces, route tables) belong to exactly one task's `owns` set. Other tasks depend on it via `depends_on`. Where a genuine shared-interface change is unavoidable, the planner makes it its own task that others depend on — it is never co-owned.

## Integration

After parallel implementers finish, the `integrator` reads the ledger, merges the owned diffs, and resolves any shared-seam conflicts. It produces one coherent diff and updates the ledger `status` to `review`.

**When a single implementer ran there is nothing to merge**, and the integrator is not dispatched — one diff is already coherent. The main session makes the `in-progress → review` transition itself, so the handoff to review is never lost. This is decided by how many implementers actually ran, not by how the order looked at plan time.

## Review + doc-sync

The `flow-reviewer` reads the merged diff and each task's `docs_touched`. It verifies the living docs actually reflect the code changes. If a task changed behavior without updating its `docs_touched`, review flags it and the cycle bounces back before the result is finalized.

## The build log and living docs

- `docs/build-log.md` — **append-only.** One entry per completed order: decision, rationale, alternatives rejected. Never rewritten.
- `docs/reference/*.md` — **living docs, kept current.** Updated (not just appended) as code changes. The doc-sync check and periodic maintenance keep these honest.

## Cleanup

A completed order's ledger (`status: done`) may be archived or pruned by maintenance. The build log and living docs are permanent.
