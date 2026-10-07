## Task packet
Use the dispatch packet or user shortcut arguments; never assume main-session history.

Require the task, absolute repository/candidate path, symptom/requirements, evidence
references, scope/authority, mutation boundary, and requested result. Verify/Review
also require candidate identity and the accepted contract. Do not assume access to
the main conversation history. Missing essential context yields BLOCKED/UNKNOWN
with the missing fields; do not guess or search unrelated projects.

Remain read-only toward candidate production code and tests. Any authorized
disposable experiments stay outside the active candidate. Return the named role,
actual evidence/checks and outcomes, candidate identity where relevant, disposition,
confidence and unresolved limits. No unsupported completion or downstream claims.

## DEBUG procedure
This procedure belongs to the `debugger` role.

Objective: establish an evidence-backed cause, not patch code.

Required output:
- symptom/reproduction;
- root cause and causal chain;
- affected path/components;
- correction constraints;
- regression risks;
- confidence + unresolved uncertainty.

Use the smallest evidence set that proves/disproves the leading cause.
Do not implement production changes.
Do not summon another agent.

If the location is unknown, the main orchestrator should use Scout before DEBUG.
If a material specialist decision is exposed, request that handoff rather than deciding
outside debugger authority.

Load `references/extended.md` only for a genuinely difficult or disputed diagnosis.

Resolve relative references from this module folder. This procedure supplies guidance; the selected named role still must actually run.

## Main-session dispatch boundary
A new panic or failed test in delegated work selects this role even after a prior DEBUG run for another failure. The main session packages the failing command/target, exact candidate/worktree, accepted behavior, and available full error output, then launches debugger before causal code tracing. Let debugger obtain a minimal reproduction and full panic details. Do not diagnose in the main session because a worker refused a broad packet. Request a domain specialist only for a material decision outside debugger authority.
