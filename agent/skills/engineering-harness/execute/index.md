## EXECUTE procedure

1. Confirm the accepted task contract: scope, acceptance criteria, mutation
   boundary/authority, and required checks. If a formal plan is required or governs
   this task, require READY FOR EXECUTION. An existing BLOCKED/non-ready plan cannot
   be bypassed by calling the task localized or by generic "proceed" language.
2. If a material decision or requirement is unresolved, stop affected writes and
   return the missing decision. Do not invent product/persistence/security semantics.
3. Main session: launch rust-worker/frontend-worker for non-trivial implementation.
   Only standalone T0 work outside assigned implementation/recovery may be edited
   directly. Compiler/reviewer fixes and failed edits within delegated work remain
   worker-owned, even when mechanical. Inspect failures, then steer the active worker
   or dispatch a smaller evidence-based recovery packet to the same role. Partial
   completion leaves authorized work to finish; no fixed retry count or renewed
   approval is required. Unknown-cause failure returns to debugger; BLOCKED needs
   a concrete external dependency or evidenced impasse. Leaf worker: implement
   assigned scope directly; do not spawn agents or re-run orchestration.
4. For meaningful behavior, establish a focused failing test/check before production
   changes when feasible. Record the actual failure and cause. If infeasible, explain
   the exception and replacement evidence; small size alone is not an exception.
5. Make the smallest correct change; run focused checks, then broader regression
   only when relevant. Do not weaken valid expectations to fit incorrect behavior.
6. Return RED/GREEN commands and outcomes (or exception/replacement evidence),
   the exact candidate, changed files, checks/results, missing evidence and
   residual risk. The main session selects independent Verify/Review using global
   criteria; worker confidence is not independent verification.

Do not automatically run Scout, specialists, tester, or reviewer. Read relevant
sections of `references/extended.md` only for complex execution/isolation/recovery.
Archived universal gates do not override this current conditional plan policy.

Resolve relative references from this module folder. This procedure supplies guidance; the selected named role still must actually run.
