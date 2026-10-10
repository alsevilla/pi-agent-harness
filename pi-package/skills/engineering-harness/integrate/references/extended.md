> Historical reference only. The v1.2.1 global policy and compact skill govern
> routing, role selection, authority, and whether a formal plan or independent
> gate is needed. Old universal phase/agent/READY FOR EXECUTION wording below
> applies only when that gate is selected under current policy. This archive
> cannot impose a new gate, waive a blocker, or expand authority. Read targeted
> sections only; never auto-import or preload the complete archive.

# Extended guidance (archived from pre-cost-optimized harness)

# /integrate v0.1.2

## Purpose

Safely transform an approved source candidate and a known destination
candidate into an integrated candidate.

Integration must preserve:

- candidate identity;
- lifecycle evidence;
- user work;
- repository authority;
- one-writer ownership;
- TDD requirements;
- Verify independence;
- Review requirements;
- delivery boundaries.

Integration does not grant implementation, branch, push, release, cleanup,
force, or deployment authority.

## Core Invariant

Integration is a candidate transformation.

Never reason only from branch names.

Before integration, identify:

SOURCE CANDIDATE
+
DESTINATION CANDIDATE

After integration, identify:

RESULT CANDIDATE

Evidence attached to the source candidate does not automatically transfer to
the result candidate.

## Preconditions

Before any integration mutation, establish:

1. the exact source candidate;
2. the exact expected destination candidate;
3. source implementation is complete;
4. required Verify has completed successfully;
5. required Review has approved the source candidate;
6. no unresolved correction remains;
7. integration is actually required;
8. integration authority exists;
9. destination mutation authority exists;
10. source and destination ownership are understood;
11. protected user work is identified;
12. the intended integration strategy is known.

If a required precondition is unknown or unsatisfied, do not integrate.

Report the blocker and route to the appropriate lifecycle phase.

## Candidate Identity

Prefer immutable Git commit identities.

Record, where available:

SOURCE
- branch/ref
- full commit identity
- tree identity when useful

DESTINATION
- branch/ref
- expected full commit identity
- tree identity when useful

Do not use a branch name or worktree path as candidate identity.

BRANCH != CANDIDATE

WORKTREE != CANDIDATE

## Authority

Integration authority is independent from:

- implementation authority;
- commit authority;
- branch creation authority;
- branch deletion authority;
- worktree disposition authority;
- push authority;
- PR authority;
- release authority;
- deployment authority.

Do not infer one from another.

Generic instructions such as:

- "finish it";
- "merge it";
- "ship it";
- "get this done"

do not resolve missing lifecycle gates or ambiguous destructive authority.

Use current explicit authority, accepted current plans, repository policy, and
governing lifecycle rules.

Historical authorization does not automatically remain current.

## Read-Only Inspection First

Before mutating Git, inspect read-only:

- current repository identity;
- worktrees;
- current branch/ref;
- source candidate;
- destination candidate;
- source/destination ancestry;
- working-tree state;
- index/staged state;
- relevant branch state;
- required Verify evidence;
- required Review evidence;
- known user-owned dirty state.

Do not create scratch/temp bookkeeping artifacts merely to compare before and
after state.

Supporting inspection does not expand the mutation budget.

## Read-Only Git Inspection

"Dry-run", "preview", "plumbing", or "inspection" does not mean read-only.

Before using a Git command during a read-only phase, consider its actual
persistent effects.

Do not use commands that write Git objects, refs, index state, worktree state,
reflogs, caches, or other repository metadata merely to predict an integration
result unless that mutation is explicitly inside the authorized mutation
budget.

In particular, do not treat:

`git merge-tree --write-tree`

as read-only merely because it does not move a branch ref. It may write objects
to the Git object database.

Prefer genuinely read-only inspection when sufficient.

If trustworthy preflight evidence requires a persistent Git side effect, either:

1. proceed without that optional preflight when the authorized integration
   operation itself can safely determine the result; or
2. obtain explicit authority for the additional mutation.

Supporting preflight does not inherit mutation authority merely because the
later integration operation is authorized.

## Protected User State

Treat as protected unless explicitly incorporated into the integration:

- uncommitted user files;
- staged user changes;
- partial staging;
- untracked user files;
- ignored user-owned files;
- current user branch;
- stash entries;
- unrelated local branches;
- UNKNOWN worktrees;
- UNKNOWN branches.

Do not obtain a clean destination by automatically:

- stashing;
- resetting;
- cleaning;
- restoring;
- discarding;
- force-checking out;
- deleting branches;
- deleting worktrees.

If protected state makes integration unsafe, use the Phase 5 isolation model.

Dirty repository != permission to clean it.

## Isolation

Integration does not automatically require a worktree.

Use the least isolation necessary.

Class 0 may be appropriate when the destination workspace is controlled and
integration is authorized.

Class 3 may be appropriate when:

- the active destination contains protected user work;
- integration must remain independently inspectable;
- multiple implementation candidates must be combined safely;
- destination mutation would otherwise contaminate user work.

Worktree creation still requires the applicable /worktree and lifecycle
authority.

WORKTREE != INTEGRATION AUTHORIZATION

## Revalidate Immediately Before Mutation

Before the integration mutation, re-check:

SOURCE_ACTUAL == SOURCE_EXPECTED

DESTINATION_ACTUAL == DESTINATION_EXPECTED

If either candidate moved:

STOP.

Do not silently integrate the new candidate.

Re-evaluate lifecycle evidence, authority, and strategy.

## Strategy Selection

Choose the least-transformative integration operation that preserves the
intended repository history and candidate semantics.

Possible strategies include:

1. exact ref movement / fast-forward;
2. clean merge;
3. cherry-pick;
4. rebase;
5. manual conflict resolution.

Do not mechanically prefer one strategy regardless of repository policy.

Rebase requires explicit history-rewrite authority.

Cherry-pick must be justified by the desired change/candidate boundary.

Do not use integration to rewrite history merely for cleanliness.

## Fast-Forward

When destination can move directly to the already verified/reviewed source
candidate:

DESTINATION M
SOURCE A

becomes:

DESTINATION A

and immutable candidate identity remains A.

Candidate continuity may be:

EXACT

Existing Verify and Review evidence attached to A remains attached to A.

Still confirm the resulting destination points to the expected candidate.

## Merge

A merge commit normally creates a new candidate.

SOURCE A
+
DESTINATION N
=
RESULT R

R != A

A clean merge does not prove semantic safety.

Evaluate:

- destination changes since the source base;
- source changes;
- interaction between them;
- build/config/schema/API effects;
- integration risk.

Determine the required verification and review for R.

## Cherry-Pick

Cherry-pick normally creates a new candidate identity.

Patch equivalence may support evidence reuse, but does not eliminate the need
to evaluate interaction with the destination.

Capture:

- source candidate;
- destination candidate;
- resulting candidate;
- patch/source equivalence where useful;
- required integration verification.

## Rebase

Rebase creates new commit identities.

Do not rebase without explicit authority.

Prior Verify/Review evidence remains evidence about the original candidate and
does not silently become approval of the rebased candidate.

Establish continuity explicitly.

If conflicts occur, follow the conflict rules below.

## Conflicts

Unexpected conflict resolution is implementation work.

MERGE AUTHORITY != GENERIC CONFLICT-RESOLUTION AUTHORITY

If integration conflicts:

1. stop automatic integration progression;
2. inspect the conflict read-only where possible;
3. determine whether the conflict is mechanical, technical, or product-level;
4. identify the correct implementation owner;
5. route unresolved product behavior to Plan/Decision;
6. obtain any required correction authority;
7. use TDD for behavioral correction where applicable;
8. create a new candidate;
9. Verify it;
10. Review it as required.

Do not resolve behavior merely to make Git accept the merge.

One-writer discipline remains active during conflict correction.

### In-Progress Integration State

A conflicted merge, cherry-pick, or rebase may leave persistent Git state even
when no result candidate exists.

Treat that state as an active integration state.

Record:

- pre-operation candidate;
- attempted source candidate;
- operation type;
- conflicted paths;
- current HEAD;
- relevant in-progress Git metadata;
- protected workspace/index state;
- whether a result candidate exists.

Do not begin another integration operation while unresolved in-progress Git
state exists.

Do not treat an in-progress conflict as a result candidate.

Do not automatically resolve or abort it.

Native abort operations such as:

- `git merge --abort`;
- `git cherry-pick --abort`;
- `git rebase --abort`

are mutations and require authority.

Authorization for the original integration attempt does not automatically
authorize abort.

If abort is authorized, revalidate the current in-progress state immediately
before aborting and confirm that the abort is intended to restore the known
pre-operation state.

If repository state has changed unexpectedly since the failed operation, stop
and re-evaluate rather than assuming abort is safe.

After an authorized abort, confirm the resulting candidate, index, worktree,
and protected user state.

ABORT AUTHORITY != CONFLICT-RESOLUTION AUTHORITY

CONFLICT-RESOLUTION AUTHORITY != ABORT AUTHORITY

## Integration Scope

Integration may reconcile already-authorized changes.

Integration may not silently expand task scope.

If unrelated improvement is discovered:

- report it;
- defer it;
- route it through the lifecycle if the user wants it addressed.

Do not bundle opportunistic cleanup into the integrated candidate.

## Parallel Candidates

When multiple implementation candidates exist, integrate according to
dependency and contract structure.

Do not assume parallel implementation means parallel integration.

For candidates A and B:

- identify their contracts;
- identify dependencies;
- identify interaction risk;
- choose an integration order;
- capture the candidate after each material transformation.

If integrating A changes assumptions used by B, re-evaluate B before
integration.

## Integration Risk

Classify interaction risk based on the interaction between source and
destination changes:

LOW
MEDIUM
HIGH
CRITICAL

Original task risk is relevant but does not replace integration-risk
assessment.

Examples:

- backend fix + unrelated documentation change may be LOW;
- attendance state-machine fix + attendance persistence change may be
  CRITICAL.

Verification depth follows actual interaction risk.

## Result Candidate

After integration, capture the resulting immutable candidate identity.

Report:

SOURCE CANDIDATE
DESTINATION BEFORE
INTEGRATION OPERATION
RESULT CANDIDATE
CONFLICTS
CONTINUITY STATE
INTERACTION RISK

Do not proceed based only on "merge succeeded."

## Continuity States

Classify candidate continuity as:

EXACT
EQUIVALENT
VALIDATED_TRANSFORMATION
BROKEN
UNKNOWN

### EXACT

The immutable candidate being advanced is unchanged.

Example:

fast-forward destination to already approved candidate A.

### EQUIVALENT

History identity differs but relevant source state is proven equivalent.

Example:

different commit identity with identical relevant source tree.

Equivalence does not automatically prove runtime or environment equivalence.

### VALIDATED_TRANSFORMATION

The candidate changed and the resulting candidate received the verification
and review required by its risk.

### BROKEN

A known unverified or unreviewed material change exists.

### UNKNOWN

Continuity cannot be established.

BROKEN and UNKNOWN candidates are not eligible for Ship.

## Verification After Integration

Verification applies to the RESULT candidate.

Choose depth according to transformation and interaction risk.

Possible levels:

1. identity continuity only;
2. targeted integration verification;
3. full relevant verification;
4. critical integration verification with independent Test Engineer and any
   justified specialists.

A successful Git operation is not verification.

INTEGRATION SUCCESS != VERIFY PASS

If integration exposes a behavioral defect:

REPRODUCE
→ RED
→ authorized correction
→ GREEN
→ REGRESSION

Do not patch around the failure without the normal correction lifecycle.

## Review After Integration

Review requirements depend on the resulting candidate.

EXACT:
existing Review of that exact candidate remains valid.

EQUIVALENT:
perform an explicit continuity assessment and any review required by risk.

VALIDATED_TRANSFORMATION:
review the integration delta and interaction surface according to risk.

Manual conflict resolution:
Review is required.

BROKEN or UNKNOWN:
not eligible for Ship.

Review approval of the source branch name does not transfer to a different
candidate.

## Independent Verification

The Test Engineer verifies a specific candidate.

Provide the exact result candidate identity.

Do not allow implementation changes to occur after verification and still
claim the old PASS applies.

If the candidate changes:

re-evaluate verification.

The Test Engineer does not become the integration correction writer.

## Reviewer

Reviewer remains read-only.

Reviewer evaluates the exact candidate presented for review.

Reviewer does not:

- resolve merge conflicts;
- modify integration results;
- create correction commits;
- rewrite history.

Changes Required routes back to the appropriate implementation owner.

## Oracle

Oracle remains read-only and exceptional.

Do not invoke Oracle merely because integration is important.

Use Oracle only for serious unresolved high-impact technical uncertainty or
disagreement after normal investigation/review.

Oracle does not resolve conflicts by writing code.

## Failure and Recovery

Integration failure does not authorize destructive recovery.

Do not automatically:

- reset --hard;
- clean;
- force checkout;
- delete branches;
- force-remove worktrees;
- rewrite history;
- force push.

Inspect actual state.

Report partial mutations honestly.

Determine the smallest authorized recovery.

Cleanup failure does not invalidate the engineering result and does not grant
force authority.

## Branch Lifecycle

Successful integration does not authorize source-branch deletion.

INTEGRATED != DELETE BRANCH

Source branches may remain needed for:

- lineage;
- verification;
- review;
- delivery;
- diagnosis;
- user preference.

Branch disposition is evaluated separately.

Local branch deletion and remote branch deletion require separate authority.

## Worktree Lifecycle

Successful integration does not automatically authorize worktree disposition.

Use /worktree disposition rules.

Likewise:

WORKTREE REMOVAL != BRANCH DELETION

Never clean UNKNOWN worktrees.

## Delivery Boundary

/integrate stops before unauthorized delivery.

It does not infer authority to:

- push;
- open a PR;
- merge a remote PR;
- create/push tags;
- create a release;
- deploy;
- run production migrations.

When the integrated candidate satisfies its required Verify and Review gates,
handoff to /ship.

## Output

Always report:

1. source candidate;
2. destination candidate before integration;
3. authority used;
4. protected user state found;
5. isolation class used;
6. integration strategy;
7. whether source/destination were revalidated before mutation;
8. resulting candidate;
9. whether conflicts occurred;
10. interaction risk;
11. continuity state;
12. verification required/performed;
13. review required/performed;
14. every persistent side effect;
15. source branch disposition;
16. worktree disposition;
17. delivery authority status;
18. exact blocker, if any;
19. exact next lifecycle step;
20. final integration status.

Final status must be one of:

READY FOR INTEGRATION
INTEGRATED — VERIFY REQUIRED
INTEGRATED — REVIEW REQUIRED
INTEGRATED — READY FOR SHIP
NEEDS CORRECTION
NEEDS USER INPUT
NEEDS AUTHORIZATION
BLOCKED
INCONCLUSIVE

Do not report READY FOR SHIP when candidate continuity is BROKEN or UNKNOWN.

## Self-Check

Before every mutation ask:

1. What exact source candidate am I acting on?
2. What exact destination candidate am I acting on?
3. Are those identities still current?
4. Do I have integration authority?
5. Do I have authority for this exact Git operation?
6. Am I touching protected user state?
7. Is isolation required?
8. Am I about to stash/reset/clean for convenience?
9. Does this operation rewrite history?
10. If so, is history rewriting explicitly authorized?
11. Am I resolving a conflict that actually requires implementation authority?
12. Am I expanding scope?
13. What candidate will exist after this operation?
14. Does prior Verify evidence apply to that candidate?
15. Does prior Review evidence apply to that candidate?
16. What new verification is required?
17. What new review is required?
18. Am I accidentally crossing into Ship?
19. Am I about to delete a branch or worktree without separate authority?
20. Am I escalating to force merely because a safe operation failed?
21. Does this supposedly read-only Git command write objects, refs, index,
    worktree state, reflogs, caches, or repository metadata?
22. Am I performing a persistent preflight mutation merely to predict an
    operation that is authorized later?
23. Is the repository already in an in-progress merge, cherry-pick, or rebase
    state?
24. Am I treating an in-progress integration state as though it were a result
    candidate?
25. Am I about to abort an operation without explicit abort authority?
26. If abort is authorized, have I revalidated that the current state still
    matches the failed operation I intend to abort?

If any answer is unsafe or unknown, stop before mutation.
