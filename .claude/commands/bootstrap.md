---
description: Set up (or re-sync) this project's agent team and knowledge layer. Inspects the repo, asks only for gaps, and generates the project-specific files. Idempotent — safe to re-run.
---

# /bootstrap — set up the agent team

You are the main session running the one-time (idempotent) setup. Do the work yourself; do not dispatch subagents for this. Follow `.claude/conventions/elicitation.md` for any questions.

## 0. Preflight — dependencies

Before asking the user anything, find out what this machine has. `SCAFFOLD-MANIFEST.md` **Tier 0** is the list and the authority; the procedure is in `.claude/commands/deps.md`.

**Sweep everything — do not stop at the first success.** Run `git --version`, `node --version`, and *every* Python variant in the canonical order (`python3`, `python`, `python3.13`, `py -3`), recording which ones actually ran. Step 5 consumes this record, and it needs all of it: a machine can have both Python and Node, and stopping at Python would cost it the entire measurement layer. Also record whether this folder is a git repository (`git rev-parse --is-inside-work-tree`).

Report what's present and what's missing, with what each missing piece costs — Tier 0's "when it's missing" column says it precisely.

Then offer, following `deps.md`: install for a missing **git** or **Node**, and `git init` for a folder that has git but no history. Same rule as everywhere else — **only on an explicit yes, per tool, and a no is final.** Do not repeat the offer later in the run.

**This never blocks setup.** Bootstrap continues after any answer, including "no" to everything; declined pieces become entries in the step-6 report, not a refusal to proceed.

## 1. Detect state

Inspect the repo before doing anything:
- Is there source code? → **brownfield**: derive facts from the code.
- No code but there are docs/specs? → **greenfield-with-docs**: derive from those.
- Neither? → **interview**: use the layered questionnaire.

Also detect what already exists (`CLAUDE.md`, `.claude/rules/`, `.claude/settings.json`, `.claude/agents/*`, `docs/project-map.md`). This determines merge vs. generate.

## 2. Derive + (if needed) ask

Derive as much as possible from evidence — on a read budget, because this runs against a repo of unknown size and is the most expensive read in the scaffold. Work outside-in: manifests and lockfiles for the stack and its versions, the directory tree for the shape, config and entry points for the wiring, then a *sample* of each significant directory — two or three representative files, not the directory. Existing docs and READMEs are cheaper than the code they describe; read those first and only verify against the code where it matters. Stop when you can name every proposed role and fill the templates; you are deriving facts, not reviewing the codebase.

For whatever inspection can't fill, run the **layered questionnaire** (`elicitation.md`): batched, high-signal first, deeper only if roles still aren't inferable. Stopping rule: you can name every proposed role with the evidence/answer that justifies it. If you can't after a reasonable second layer, **refuse** — say what's missing; do not scaffold on guesses.

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
- `.claude/settings.json` + the hook — see **Pick the hook runtime** below.

**For `.claude/settings.json`, "it exists" is not "it's done."** A file that was written by an older scaffold is the normal case on a re-run — the project has been upgraded since, and settings is one of the few files an upgrade deliberately never touches. So open it and check what is *inside*, then propose a diff for each of these that is wrong or missing:

- **The hook command runs a shipped twin.** It must point at `.claude/hooks/orchestrate-gate.js` or `.py`, under a runtime that actually ran at step 0. A hook pointing anywhere else — a hand-written `orchestrate-gate.mjs` from a scaffold that shipped no Node twin, a runtime that no longer works, an absolute path from another machine — gets re-wired to the shipped twin. Say plainly that only `.js` and `.py` receive directive updates, so a stray hook keeps firing while silently falling behind every release; offer to delete it once the re-wire is approved.
- **A `statusLine` block exists whenever Node ran at step 0.** Its absence is a gap, not a preference: it is the budget sensor, and without it the plan gate reports the budget as unknown and `/token-report --budget` has nothing to read. Propose adding it.

Report both in step 6 as changes made, not as things already fine.

On a project brought forward by the framework's updater, those two mechanical repairs have usually already been made — verify rather than redo, and say so. Everything else here still needs you.

### Pick the hook runtime

`settings.json.tmpl` leaves the hook command as `<hook-command>` on purpose. **Do not hardcode `python3`** — on Windows it is commonly a Microsoft Store stub that prints an install prompt and exits non-zero, so the hook never fires and plain prompts silently skip orchestration with no error anywhere.

Use the step-0 record — you already ran these probes; don't run them again. Take the first runtime that worked, in the canonical order from Tier 0:

| Runtime that ran | Command to write |
|---|---|
| `node --version` | `node "$CLAUDE_PROJECT_DIR/.claude/hooks/orchestrate-gate.js"` |
| `python3 --version` | `python3 "$CLAUDE_PROJECT_DIR/.claude/hooks/orchestrate-gate.py"` |
| `python --version` | `python "$CLAUDE_PROJECT_DIR/.claude/hooks/orchestrate-gate.py"` |
| `python3.13 --version` (or another `python3.x` on PATH) | `python3.13 "$CLAUDE_PROJECT_DIR/.claude/hooks/orchestrate-gate.py"` |
| `py -3 --version` | `py -3 "$CLAUDE_PROJECT_DIR/.claude/hooks/orchestrate-gate.py"` |

**Node is first on purpose.** The twins are behaviourally identical, so when both runtimes exist the tie-break is what else the runtime buys: Node also runs the statusline, the budget sensor and `/token-report`, and a machine wiring one runtime for everything has one thing to keep working instead of two. Python remains a full fallback — the hook is exactly as good on it.

A command that *exists* is not enough — it must run. The Store stubs resolve on `PATH` and fail only when executed, so check the exit status, not `which`/`Get-Command`.

Ship the hook file the chosen runtime needs (`.py` or `.js` — they are behaviourally identical), keep the surrounding quotes (`$CLAUDE_PROJECT_DIR` often contains spaces), and **verify before moving on** by feeding it a prompt on stdin:

```sh
# bash / zsh
echo '{"prompt":"add a feature"}' | <hook-command>
```

```powershell
# PowerShell — pipe a *file*, not a string. PS 5.1 mangles inline JSON on the
# way to a native command's stdin and you get a false negative.
'{"prompt":"add a feature"}' | Set-Content $env:TEMP\hk.json -Encoding ascii -NoNewline
cmd /c "<hook-command> < %TEMP%\hk.json"
```

That must print the `[orchestration]` directive. If it prints nothing, the runtime is wrong — fix it now rather than reporting success. If nothing on the list runs, say so explicitly in step 6: the team still works, but the user must invoke it deliberately because the automatic plan-first directive is not being injected.

### Wire the cache statusline (Node only)

`settings.json.tmpl` also leaves `<statusline-command>` for the live cache-health line described in `.claude/conventions/cache-discipline.md`.

If the **step-0 preflight** found Node — not "if the hook probe reached Node", which is a different and much narrower question — write:

```
node "$CLAUDE_PROJECT_DIR/.claude/scripts/statusline-cache.js"
```

If Node is not available, **delete the whole `statusLine` block** — leaving a placeholder or a broken command there is worse than having no status line. Tell the user in step 6 that `/token-report` and the statusline both need Node, and that the cache-discipline convention is still worth reading without them.

Verify by piping it a sample payload; it must print one line and never error:

```sh
echo '{"model":{"display_name":"Sonnet 5"},"context_window":{"used_percentage":12,"current_usage":{"input_tokens":10,"cache_read_input_tokens":9000,"cache_creation_input_tokens":100}},"rate_limits":{"five_hour":{"used_percentage":23.5,"resets_at":1770000000}}}' | node "$CLAUDE_PROJECT_DIR/.claude/scripts/statusline-cache.js"
```

The statusline is also the **budget sensor**: Claude Code hands it the subscription rate limits and exposes them nowhere else, so it records each reading to `.claude/budget-state.json` for the plan gate to read (see `cost-forecast.md`). Add that file to the project's `.gitignore` — it is machine-local and disposable:

```
.claude/budget-state.json
```

Write the pattern on a line of its own. `.gitignore` has no trailing-comment syntax — in `.claude/budget-state.json  # machine-local`, the `#` and everything after it are part of the pattern, so the line matches nothing and the file shows up in `git status` anyway. If you want to explain it, put the comment on the line above.

Without Node there is no sensor, so the plan gate reports the budget as unknown and points at `/usage`. Say so in step 6 rather than letting it look broken later.

- `.claude/agents/<specialist>.md` — any approved project specialists (per `agent-authoring.md`). Never rewrite existing core agents.
- `.claude/scripts/` — copied as-is; nothing to fill in.
- `docs/project-map.md` — the architecture snapshot.
- `docs/build-log.md` — seed the first entry ("here's what we decided to build").
- `docs/reference/` — a first pass of living docs.

## 5b. Offer to specialize the team (optional)

The team you just generated knows the project's facts but not how to do its work well in *this* stack. Offer to run `.claude/conventions/capability-research.md` for the specialists, which gives each one a companion practice skill.

Ask once, for the set — not per agent. It costs real time and tokens on top of an already long setup, so make declining easy and cheap:

- **Now** — run it for the approved specialists, one at a time, each with its own diff gate.
- **Later** — skip entirely; `/improve-agent <name>` does the same thing whenever they want it.

Core agents are project-agnostic by design and usually want no practice skill. Offer one only where a core agent will clearly carry a project-specific burden (an implementer on an unusual stack, a reviewer with a strict compliance bar), and remember the only edit permitted to a core agent file is adding its `skills:` line.

## 6. Report

List what was created vs. skipped-because-present, note any unknowns/blockers, and tell the user they can now prompt normally (the hook will orchestrate) or use `/direct` for quick asks.

**Repeat anything declined at step 0**, with the consequence that is now standing: no Node means no statusline, no `/token-report`, and a plan gate that reports the budget as unknown; no git means `/improve-agent` won't write and the reviewer has no diff to read; no repository means the same. Say `/deps` revisits any of it later. A declined dependency is a choice the user made, so state it once as a fact and don't editorialize. Remind them plan mode is their approval gate. If you skipped specialization, say `/improve-agent` is how to add it later.
