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

## VERIFY procedure
This procedure belongs to `test-engineer`.

Verify the exact candidate against the approved contract. Do not modify production code.

Return one disposition:
- PASS: evidence supports required behavior.
- FAIL: provide concrete failing evidence and scope.
- INCONCLUSIVE: explain what could not be established.

Prefer focused, high-value checks before broad suites.
Do not rerun expensive suites without a reason.
Include commands/checks actually run and relevant results.

Load `references/extended.md` only for complex verification strategy or critical logic.

Resolve relative references from this module folder. This procedure supplies guidance; the selected named role still must actually run.

## Refusal and failure routing
If an assigned baseline or verification scope is too broad, return the specific missing input or bounded targets needed for a smaller packet; the orchestrator narrows and redispatches rather than assuming this role. New failing tests/panics are FAIL evidence with exact target, candidate, command, and full error details; return them for debugger diagnosis. Do not weaken tests, patch the candidate, or treat a shell pipeline's zero exit as PASS when captured output reports failure.
