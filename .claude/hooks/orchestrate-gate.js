#!/usr/bin/env node
/**
 * UserPromptSubmit hook: make plan-first orchestration the default.
 *
 * Node port of orchestrate-gate.py, kept byte-for-byte equivalent in behaviour.
 * Both exist because the hook has to run on whatever the target machine has:
 * a `python3` on PATH is not a given (on Windows it is frequently a Microsoft
 * Store stub that prints an install prompt and exits non-zero), and neither is
 * Node. `/bootstrap` probes for a working runtime and writes the matching
 * command into `.claude/settings.json`.
 *
 * On every top-level prompt this injects a short directive telling the main
 * session to follow the operating recipe (analyze -> select agents -> plan ->
 * plan-mode gate -> dispatch). For UserPromptSubmit, anything printed to
 * stdout is added to the context the model sees.
 *
 * Guards:
 *   - Recursion: if the hook fires inside a subagent (agent_id present), do
 *     nothing. A UserPromptSubmit hook that spawns subagents can otherwise loop.
 *   - Bypass: if the prompt is a /direct command, do nothing (skip the team).
 *
 * Exit 0 always (this hook only augments; it never blocks).
 */

'use strict';

const DIRECTIVE = [
  '[orchestration] This project uses an agent team. Follow',
  '.claude/recipes/operating-recipe.md for this prompt if it asks to build,',
  'change, fix, or extend the project: analyze the request, select suitable',
  'agents from .claude/agents/ by their descriptions, and decide how the work',
  'partitions. Two or more disjoint ownership groups, or an unclear split:',
  'have task-planner plan first. Clearly one group: write the compact ledger',
  'yourself. Present the plan for approval in plan mode (the one gate), then',
  'dispatch parallel flow-implementers -> integrator (skip only when a single',
  'implementer ran; then set the ledger status to review yourself) ->',
  'flow-reviewer (with doc-sync) -> report and append to docs/build-log.md.',
  'For quick questions or one-off lookups, answer directly. Never skip the',
  'plan-mode gate; never invent APIs or facts.',
].join(' ');

function main(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    // If we can't parse input, do nothing rather than break the prompt.
    return;
  }

  // Recursion guard: skip when running inside a subagent.
  if (data.agent_id || data.agent_type) return;

  // Bypass: /direct opts out of orchestration for this prompt.
  const prompt = String(data.prompt || '').replace(/^\s+/, '');
  if (prompt.startsWith('/direct')) return;

  process.stdout.write(`${DIRECTIVE}\n`);
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => { main(input); process.exit(0); });
process.stdin.on('error', () => process.exit(0));
