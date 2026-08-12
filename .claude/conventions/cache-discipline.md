# Convention: Cache discipline

Most of what an order costs is the same context re-sent every turn. Claude Code caches that context, and cache reads bill at about a tenth of the input rate — so the difference between a cheap order and an expensive one is mostly *whether the cache holds*. This document is how the team keeps it holding.

Verified against Claude Code 2.1.198. Measured on a real 4-task brownfield order: 7.6M of 8.1M tokens were cache reads.

## What we control, and what we don't

**Claude Code places the cache breakpoints. We cannot.** There is no setting, flag, or frontmatter field for it. What we choose is *which layer* our content lands in, and Claude Code's layers already give us the structure we want:

| Layer | Holds | Rebuilt when |
|---|---|---|
| System prompt | Claude Code's own instructions, tool definitions | Tool set changes, or Claude Code is upgraded |
| Project context | `CLAUDE.md`, auto memory, unscoped rules | Session start, `/clear`, `/compact` |
| Conversation | Prompts, replies, tool results, **command and skill invocations** | Every turn |

Three consequences we design around:

1. **The stable prefix is `CLAUDE.md` and the unscoped rules.** Small and frozen keeps the whole prefix warm. This is why `CLAUDE.md` has a ~200-line ceiling.
2. **Per-order context belongs in the conversation, never in `CLAUDE.md`.** Commands and skills inject their content as a user message at the moment of invocation, which changes nothing before it — always cache-safe. See the context pack in `handoff-contract.md`.
3. **Editing `CLAUDE.md` mid-session is the worst option available.** It is cache-safe but *inert* — the file is read once at session start and held in memory, so the edit does not apply until `/clear`, `/compact`, or a restart. Worse, it poisons the next compaction: project context reloads from disk and only cache-hits if `CLAUDE.md` is unchanged since the session began. Batch knowledge-layer edits to session boundaries.

Model and effort are part of the cache key even though they are not text.

### Path-scoped rules really are free until they match

A rule file under `.claude/rules/` with a `paths:` glob in its frontmatter does not load at session start. It loads the first time Claude reads a file the glob matches, and it lands in the conversation layer like any other mid-session read — so it costs nothing on sessions that never touch that area, and nothing in the stable prefix when it does.

**Measured** (Claude Code 2.1.198, haiku, 2026-08-10), using the `InstructionsLoaded` hook, which reports every instruction file with a `load_reason`:

| The session | Rule loaded | `load_reason` |
|---|---|---|
| read nothing | no | — |
| read a file matching the glob | **yes** | `path_glob_match` |
| read a file not matching it | no | — |

A rule *without* a `paths:` field is a different animal: it loads unconditionally at launch with the same priority as `CLAUDE.md`, and counts against the same prefix budget. Two practical consequences:

- **Scope every rule you can.** A path-scoped rule is the cheapest place in the scaffold to put a folder's conventions — it is genuinely free elsewhere. An unscoped one is `CLAUDE.md` by another name.
- **Path-scoped rules do not survive `/compact`.** Project-root `CLAUDE.md` is re-injected; scoped rules are not, and reload only the next time a matching file is read. If an agent seems to forget a folder convention after a compaction, that is why.

If you ever need to check what actually loaded, the `InstructionsLoaded` hook is the instrument — it beats asking the model, which will happily read the rule file itself and report the contents as though they had been injected.

## Cache-breaking operations

Each of these throws away the prefix and pays to rebuild it. None are forbidden — they are things to do deliberately, at a boundary, not in the middle of an order:

- **`/model` switch.** Including every plan-mode toggle under `opusplan`, and automatic model fallback.
- **`/effort` change.** A no-op change to the same resolved level is free.
- **Enabling fast mode** — once per conversation; toggling it later is free.
- **MCP server connect or disconnect**, when its tools load into the prefix. Can happen without you doing anything: a stdio process exits, an HTTP session expires, auto-reconnect fires.
- **Enabling or disabling a plugin that provides MCP servers.** Plugins that only add skills, commands, agents or hooks are safe.
- **Adding or removing a bare tool-name deny rule** (`Bash`, `WebFetch`, `"*"`). Scoped rules like `Bash(rm *)` and all allow/ask rules are safe.
- **`/compact`** — by design; the new history shares no prefix with the old.
- **A Claude Code upgrade mid-session.**

Not cache-breaking, despite looking like it: dispatching a subagent, editing repo files, invoking commands and skills, `/rewind`, `/recap`, permission-mode changes, and editing `CLAUDE.md` (which is inert instead — see above).

**Cache is scoped to one machine and directory.** Parallel sessions in the same directory share it; two worktrees of the same repo do not. Using a worktree for isolation means deliberately buying a second cold cache.

## Rules for the loop

- **Choose model and effort at the start of an order and leave them alone.** Switching mid-order re-reads everything built so far.
- **Compact at order boundaries, never mid-order.** A warm `/compact` is cheap because the summarization runs as a cache-safe fork; a cold one reprocesses the entire history at full price. For a path you are abandoning, prefer `/rewind` — it truncates back to a prefix that is already cached, instead of building a new one.
- **Batch knowledge-layer edits.** `CLAUDE.md` and rules changes from step 7 or a maintenance pass take effect next session anyway; writing them mid-order buys nothing and costs the next compaction.
- **Hook output must be byte-identical across prompts.** The `UserPromptSubmit` directive is fixed text, and it must stay that way — a timestamp, counter, or changing SHA in injected text invalidates the prefix on every single prompt. If you add a hook, that is the rule to check first. Note what the rule does *not* forbid: changing the fixed text itself, as a scaffold upgrade does, costs exactly one break on the next prompt and nothing after. Across-prompt stability is the requirement, not permanence.
- **Put the load-bearing lines first in every skill.** Only skills that were actually invoked survive a compaction, and their bodies are truncated from the top.

## Subagents

Dispatching a subagent never disturbs the parent's cache — the call and its result simply append.

Each named subagent starts **cold**, with its own prefix (its system prompt, the `CLAUDE.md` hierarchy, a git-status snapshot, and any preloaded skills), and gets a **5-minute cache TTL** even when the main session has an hour. That cold start is the price of context isolation, and isolation is usually worth it — but it means:

- **Do not expect two dispatches of the same agent type to share a cache.** It is intuitive that they should — identical agent prompt, identical `CLAUDE.md`, identical git snapshot — and it is wrong. **Measured**: two sequential `probe-reader` dispatches six seconds apart, same session, same model, wrote 6,647 and 6,646 prefix tokens and read **zero** cached tokens each (Claude Code 2.1.198, haiku, 2026-08-08). The near-identical write sizes suggest the differing task message sits inside the written block, so the prefixes diverge before any breakpoint. Budget every dispatch as a cold start.
- **A cache entry becomes readable only once the first response starts streaming.** Firing N identical dispatches simultaneously means all N pay full price — and per the measurement above, staggering them does not appear to help either.
- **The lever that does work is dispatching less.** Since each dispatch pays for its own prefix regardless, the way to spend less on them is to send fewer and give each one a briefing instead of a repo to explore. That is what the context pack in `handoff-contract.md` is for.
- **Keep each agent's frontmatter stable anyway.** Reordering a `skills:` list changes what gets injected at startup; stability costs nothing and removes a variable.

## Retrieval: what we build, and what we deliberately don't

The scaffold's answer to "load only what's needed" is three things it already has: the **context pack** (one curated survey per order, ≤120 lines, reused when git says the area hasn't moved), **`docs/project-map.md`** (the standing architecture summary the planner starts from instead of crawling), and the **three-tier loading discipline** above — always-loaded (`CLAUDE.md`, unscoped rules), conditional (path-scoped rules, per-agent `skills:`), on-demand (`SOURCES.md`, `docs/reference/`, ledgers).

Three things that look like the obvious next step are deliberately not built. Recorded here so they are declined once rather than re-proposed every few months:

- **No embedding index / vector search.** Claude Code shipped one early and removed it in favour of agentic search; the measured benefit of codebase embeddings concentrates on repositories in the thousand-file range, and below that a grep-driven agent matches or beats it. An index also adds a second, staleable copy of the source.
- **No "top 3–5 documents" cap.** Aggressive top-k is where recall dies — Anthropic's own retrieval work found top-20 outperformed top-10 and top-5 at fixed budget. Cap *bytes*, not *count*: the pack's 120-line budget is the right shape of limit.
- **No document-ranking layer.** Claude Code already ranks instructions for us — skill descriptions are the routing signal, and path globs filter rules before they cost anything (measured above). A second ranker would duplicate that and drift from it.

And one claim this scaffold does not make: the **"60–90% context savings"** that circulates with these ideas comes from document-QA retrieval, not coding agents. Matched-design studies on coding agents report 20–40% total token reduction, and only when the resolve rate holds. Quote the honest band or none.

What *is* worth doing is cheaper than any of them: **start from the symptom on a bug** (see the operating recipe's step 1), and **keep the survey budget** on every path that reads the repo.

`/token-report` in any scaffolded project prints the hit rate, flags cache-write spikes with their likely cause from the list above, and shows what each agent type cost. Step 7 records a one-line summary per order in `docs/build-log.md`, so the trend is visible over time; the maintainer reads those lines and flags drift.

Nothing reports a hit rate directly — it is computed as `cache_read / (cache_read + cache_creation + input)`. A high read-to-creation ratio means the cache is working. Creation staying high turn after turn means something in the prefix keeps changing, and the list above is where to look.
