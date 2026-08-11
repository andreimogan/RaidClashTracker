# Convention: Handoff contract

Subagents do not share a context window. Each returns only its result to the main session. So the team coordinates through **files on disk** — this document defines that file bus. Every agent that participates in the operate loop follows it.

## The task ledger

One ledger file per feature/order, at `docs/tasks/<feature-slug>.md`. It is the single source of truth for what is planned, who owns what, and what is done. It survives across sessions, so a fresh session can resume by reading it.

### Ledger schema

The ledger is Markdown with a YAML block per task. The `owns` field is load-bearing — it is what prevents two parallel implementers from clobbering each other.

```md
# Task ledger: <feature-slug>

order: "<the original prompt / order, verbatim>"
status: planning | approved | in-progress | integrating | review | done | blocked
created: <ISO datetime>

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

## Ownership + claim/release protocol

1. **The planner assigns ownership at split time.** Every task's `owns` set must be disjoint from every other task's `owns` set in the same order. No two tasks may own the same file or overlapping globs. If the work can't be partitioned cleanly, the planner says so and proposes a smaller cut — it does not emit overlapping ownership.
2. **Implementers claim before writing.** Before editing, an implementer sets `claimed_by` and `state: claimed` on its task. If the task is already claimed by another run, it must not proceed — it reports the collision to the main session.
3. **Write only what you own.** An implementer edits only files inside its task's `owns` set. Touching a file outside it is a contract violation — stop and report instead.
4. **Release on completion.** On finishing, set `state: done` and record a short changelist in the ledger entry (files touched, what changed). Clear or keep `claimed_by` per the run's convention.

## Shared seams

Files that multiple tasks *read* but only one *owns* (shared types, interfaces, route tables) belong to exactly one task's `owns` set. Other tasks depend on it via `depends_on`. Where a genuine shared-interface change is unavoidable, the planner makes it its own task that others depend on — it is never co-owned.

## Integration

After parallel implementers finish, the `integrator` reads the ledger, merges the owned diffs, and resolves any shared-seam conflicts. It produces one coherent diff and updates the ledger `status` to `review`.

## Review + doc-sync

The `flow-reviewer` reads the merged diff and each task's `docs_touched`. It verifies the living docs actually reflect the code changes. If a task changed behavior without updating its `docs_touched`, review flags it and the cycle bounces back before the result is finalized.

## The build log and living docs

- `docs/build-log.md` — **append-only.** One entry per completed order: decision, rationale, alternatives rejected. Never rewritten.
- `docs/reference/*.md` — **living docs, kept current.** Updated (not just appended) as code changes. The doc-sync check and periodic maintenance keep these honest.

## Cleanup

A completed order's ledger (`status: done`) may be archived or pruned by maintenance. The build log and living docs are permanent.
