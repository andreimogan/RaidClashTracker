#!/usr/bin/env node
// UserPromptSubmit hook: make plan-first orchestration the default.
//
// Node port of orchestrate-gate.py — this machine has no working Python
// (only the Microsoft Store stub), so settings.json points here instead.
// Keep the two implementations behaviorally identical.
//
// For UserPromptSubmit, anything printed to stdout is added to the context
// the model sees. Guards:
//   - Recursion: if the hook fires inside a subagent (agent_id present), do
//     nothing. A UserPromptSubmit hook that spawns subagents can otherwise loop.
//   - Bypass: if the prompt is a /direct command, do nothing (skip the team).
// Exit 0 always (this hook only augments; it never blocks).

const DIRECTIVE =
  "[orchestration] This project uses an agent team. Follow " +
  ".claude/recipes/operating-recipe.md for this prompt if it asks to build, " +
  "change, fix, or extend the project: analyze the request, select suitable " +
  "agents from .claude/agents/ by their descriptions, have task-planner plan " +
  "first with disjoint file ownership, present the plan for approval in plan " +
  "mode (the one gate), then dispatch parallel implementers (prefer the " +
  "matching specialist: data-pipeline-specialist, ui-design-specialist, " +
  "db-migration-specialist; otherwise flow-implementer) -> integrator " +
  "-> flow-reviewer (with doc-sync) -> report and append to docs/build-log.md. " +
  "For quick questions or one-off lookups, answer directly. Never skip the " +
  "plan-mode gate; never invent APIs or facts.";

let raw = "";
try {
  for await (const chunk of process.stdin) raw += chunk;
} catch {
  process.exit(0);
}

let data;
try {
  data = JSON.parse(raw);
} catch {
  // If we can't parse input, do nothing rather than break the prompt.
  process.exit(0);
}

// Recursion guard: skip when running inside a subagent.
if (data.agent_id || data.agent_type) process.exit(0);

const prompt = (data.prompt || "").trimStart();

// Bypass: /direct opts out of orchestration for this prompt.
if (prompt.startsWith("/direct")) process.exit(0);

console.log(DIRECTIVE);
process.exit(0);
