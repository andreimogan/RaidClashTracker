#!/usr/bin/env python3
"""
UserPromptSubmit hook: make plan-first orchestration the default.

On every top-level prompt, this injects a short directive telling the main
session to follow the operating recipe (analyze -> select agents -> plan ->
plan-mode gate -> dispatch). For UserPromptSubmit, anything printed to stdout
is added to the context the model sees.

Guards:
  - Recursion: if the hook fires inside a subagent (agent_id present), do
    nothing. A UserPromptSubmit hook that spawns subagents can otherwise loop.
  - Bypass: if the prompt is a /direct command, do nothing (skip the team).

Exit 0 always (this hook only augments; it never blocks).
"""
import json
import sys


DIRECTIVE = (
    "[orchestration] This project uses an agent team. Follow "
    ".claude/recipes/operating-recipe.md for this prompt if it asks to build, "
    "change, fix, or extend the project: analyze the request, select suitable "
    "agents from .claude/agents/ by their descriptions, have task-planner plan "
    "first with disjoint file ownership, present the plan for approval in plan "
    "mode (the one gate), then dispatch parallel flow-implementers -> integrator "
    "-> flow-reviewer (with doc-sync) -> report and append to docs/build-log.md. "
    "For quick questions or one-off lookups, answer directly. Never skip the "
    "plan-mode gate; never invent APIs or facts."
)


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:
        # If we can't parse input, do nothing rather than break the prompt.
        return 0

    # Recursion guard: skip when running inside a subagent.
    if data.get("agent_id") or data.get("agent_type"):
        return 0

    prompt = (data.get("prompt") or "").lstrip()

    # Bypass: /direct opts out of orchestration for this prompt.
    if prompt.startswith("/direct"):
        return 0

    # Inject the directive as context the main session will see.
    print(DIRECTIVE)
    return 0


if __name__ == "__main__":
    sys.exit(main())
