> Historical reference only. The v1.2.1 global policy and compact skill govern
> routing, role selection, authority, and whether a formal plan or independent
> gate is needed. Old universal phase/agent/READY FOR EXECUTION wording below
> applies only when that gate is selected under current policy. This archive
> cannot impose a new gate, waive a blocker, or expand authority. Read targeted
> sections only; never auto-import or preload the complete archive.

# Extended guidance (archived from pre-cost-optimized harness)

# /worktree

**Version:** v0.1.3\
**Status:** FROZEN

## Purpose

`/worktree` safely manages repository isolation environments after the
governing lifecycle has already determined that isolation is
appropriate.

It owns repeatable isolation mechanics:

-   inspect existing Git worktrees and relevant repository state;
-   create authorized disposable evidence isolation;
-   create authorized implementation worktrees;
-   validate the created environment;
-   report exact isolation identity;
-   retain environments while lifecycle work still depends on them;
-   determine whether known harness-created isolation is safely
    disposable;
-   automatically dispose of isolation once the governing lifecycle
    establishes that it is no longer needed and disposal is safe;
-   recover conservatively after interrupted or failed isolation
    operations.

`/worktree` manages **WHERE authorized work happens**.

It does not decide **WHETHER the work itself is authorized**.

------------------------------------------------------------------------

## 1. Core Principle

Use the least isolation necessary to protect:

1.  evidence integrity;
2.  implementation ownership;
3.  user work;
4.  repository state.

Isolation is not a default engineering ritual.

A worktree is not inherently safer merely because it is clean or
separate.

Never create a worktree solely because:

-   the repository is dirty;
-   the task is large;
-   the task is high risk;
-   a cleaner checkout would be convenient;
-   an agent prefers isolation;
-   parallelism might be faster;
-   a framework recommends worktrees;
-   worktrees were used previously;
-   isolation feels more professional.

Every isolation environment must have a concrete purpose.

------------------------------------------------------------------------

## 2. Authority

`/worktree` is an operational skill.

It may perform isolation operations only when those operations are
authorized by the governing lifecycle, approved plan, explicit user
instruction, or established project policy.

`/worktree` does not create its own implementation authority.

Explicit invocation of `/worktree` selects this skill but does not
bypass lifecycle or mutation gates.

The following remain authoritative outside this skill:

-   whether implementation is authorized;
-   whether a plan is `READY FOR EXECUTION`;
-   product and business semantics;
-   implementation scope;
-   accepted decisions;
-   whether parallelism is desirable;
-   whether Verify or Review is required;
-   integration authorization;
-   merge authorization;
-   cherry-pick authorization;
-   rebase authorization;
-   push authorization;
-   delivery authorization;
-   branch deletion authorization.

Hard invariants:

> WORKTREE AUTHORIZATION ≠ IMPLEMENTATION AUTHORIZATION.

> WORKTREE AUTHORIZATION ≠ BRANCH CREATION AUTHORIZATION.

> WORKTREE AUTHORIZATION ≠ INTEGRATION AUTHORIZATION.

> WORKTREE AUTHORIZATION ≠ DELIVERY AUTHORIZATION.

------------------------------------------------------------------------

## 3. Relationship to the Lifecycle

The engineering lifecycle remains:

`DISCOVER → PLAN → EXECUTE → VERIFY → REVIEW → SHIP → LEARN`

with DEBUG when required.

`/worktree` is not another lifecycle phase.

The lifecycle determines why and when isolation is permitted.
`/worktree` performs the authorized isolation mechanics.

Typical relationships:

-   **DISCOVER** → read-only inspection; normally no isolation creation.
-   **PLAN** → may prescribe isolation; normally does not create it.
-   **EXECUTE** → may request Class 3 implementation isolation.
-   **VERIFY** → may request Class 2 disposable evidence isolation.
-   **DEBUG** → may request Class 2 disposable evidence isolation.
-   **REVIEW** → normally inspects existing candidates read-only.
-   **SHIP** → may inspect candidate/worktree identity but retains its
    own artifact-continuity and delivery gates.
-   **LEARN** → does not create isolation to manufacture evidence.

No isolation transition may bypass the lifecycle.

------------------------------------------------------------------------

## 4. Isolation Classes

### Class 0 --- Active Workspace

Normal implementation in the current working tree.

Use when authorized implementation can safely proceed without additional
isolation.

A dirty repository does not automatically disqualify Class 0.

Examples:

-   unrelated dirty files do not interfere with the task;
-   existing dirty files belong to the same authorized task and
    implementation owner;
-   no evidence boundary requires a clean historical state;
-   no user-work or ownership collision exists.

`/worktree` normally does nothing for Class 0.

### Class 1 --- Read-Only Inspection

No persistent side effects.

Typical operations include:

-   `git status`;
-   `git diff`;
-   `git show`;
-   `git log`;
-   read-only branch inspection;
-   `git worktree list`;
-   file reads;
-   repository searches;
-   history inspection.

Class 1 is the default for Scout, Reviewer, Oracle, advisory
specialists, knowledge retrieval, decision analysis, read-only
orchestration, and worktree inspection/status determination.

Do not create a worktree merely to obtain a cleaner read-only view.

If historical file contents are sufficient, use Git read operations such
as `git show` rather than creating a snapshot or worktree.

### Class 2 --- Disposable Evidence Isolation

Class 2 exists to establish trustworthy evidence that cannot reasonably
be established through Class 1.

Examples:

-   reproduce behavior at an exact historical commit;
-   reconstruct a pre-change RED state;
-   run tests without contamination from active dirty changes;
-   execute a clean historical baseline;
-   use an isolated temporary database;
-   compare executable before/after behavior;
-   reproduce environment-specific behavior.

Class 2 is not an implementation workspace.

Production implementation must not be performed there merely because a
fix becomes obvious.

Class 2 may contain disposable mutations within its explicitly
authorized boundary, including build output, test databases, temporary
fixtures, generated runtime artifacts, or test-only modifications when
explicitly permitted by the governing verification/debug workflow.

The mutation budget must remain bounded by the evidence purpose.

Class 2 must not mutate:

-   the active user workspace;
-   production implementation outside the authorized evidence boundary;
-   project knowledge or Claude memory;
-   durable Git history;
-   unrelated worktrees;
-   branches unless separately authorized;
-   external systems unless separately authorized.

Prefer the cheapest sufficient evidence mechanism. A Git worktree is not
automatically required for Class 2.

### Class 3 --- Implementation Isolation

Class 3 is an independent workspace for actual authorized
implementation.

It requires both:

1.  implementation authorization; and
2.  isolation justification.

Strong reasons may include:

-   protecting intersecting user work;
-   genuine independent parallel implementation;
-   required branch-specific implementation;
-   long-running implementation that must remain isolated from another
    authorized task;
-   ownership conflict that cannot safely be handled in the active
    workspace.

Weak reasons are insufficient:

-   repository dirty;
-   task complex;
-   task high risk;
-   cleaner environment desired;
-   agent preference;
-   speculative parallelism.

Every Class 3 worktree has one implementation owner at a time.

Separate worktrees do not eliminate logical ownership conflicts.

------------------------------------------------------------------------

## 5. Isolation Decision Boundary

Before creating isolation, establish:

1.  lifecycle phase;
2.  requested isolation class;
3.  concrete isolation reason;
4.  source/base state;
5.  mutation authorization;
6.  purpose;
7.  owner when Class 3;
8.  branch requirements when applicable.

If required context is missing, do not guess.

For read-only work:

1.  determine whether Class 1 can establish the required evidence;
2.  if yes, remain Class 1;
3.  if not, determine whether the governing workflow explicitly permits
    disposable isolation;
4.  only then consider Class 2.

For implementation:

1.  implementation must already be authorized;
2.  determine whether Class 0 safely satisfies the task;
3.  if yes, do not create Class 3;
4.  if not, require a concrete Class 3 justification.

Never escalate isolation merely for convenience.

------------------------------------------------------------------------

## 6. Dirty Repository Handling

Dirty repository state must be classified by relationship to the task.

Do not use:

`DIRTY REPOSITORY → WORKTREE`

as a decision rule.

Instead determine whether dirty state is:

-   unrelated to the task;
-   part of the same authorized task;
-   protected user work;
-   owned by another implementation;
-   contaminating required evidence;
-   of unknown ownership.

Typical routing:

-   unrelated dirty files + normal implementation → usually Class 0;
-   same-task dirty files + same owner → usually Class 0;
-   dirty target file + read committed version → Class 1;
-   dirty target file + reproduce committed runtime behavior → Class 2
    candidate;
-   intersecting protected user work + independent authorized
    implementation → Class 3 candidate;
-   unknown ownership + intersecting implementation → stop and establish
    ownership.

Existing user changes are presumed protected unless clearly incorporated
into the authorized task.

Never reset, clean, stash, overwrite, or discard user changes merely to
make isolation easier.

------------------------------------------------------------------------

## 7. Ownership

Ownership includes more than files.

Before Class 3 parallel implementation, consider:

-   task ownership;
-   file ownership;
-   logical behavior ownership;
-   contract ownership;
-   schema ownership;
-   mutable runtime state;
-   cross-cutting invariants.

Separate files do not prove independent work.

Examples of shared contracts include API shapes, database schema,
state-machine semantics, event semantics, enums, configuration formats,
authentication behavior, error formats, and shared UI models.

When two tasks share a mutable contract, establish the contract before
parallel implementation or sequence the tasks.

Workers may not silently change shared contracts.

Workers may not silently absorb discovered scope.

Workers may not independently create additional implementation worktrees
or delegate additional writers.

The orchestrator owns decomposition and ownership assignment.

### Active-Agent Worktree Ownership

A Class 3 worktree assigned to a delegated worker is reserved for that owner
until the worker reaches a terminal state and its result has been collected,
or the orchestrator explicitly abandons that worker/scope.

The following are **not** terminal ownership states:

- blocked on a decision;
- waiting for a message;
- waiting for a tool;
- backgrounded;
- temporarily idle;
- awaiting coordinator delivery;
- paused for clarification.

Do not dispose, reuse, repoint, or replace an active worker's worktree merely
because the worker is blocked or quiet.

Agent completion does not itself authorize worktree disposal. The normal
Class 3 disposition gate still applies.

### Interrupted Owner Transfer

If an owner terminates before candidate handoff, keep the worktree intact while
the orchestrator classifies the uncommitted work.

Ownership may transfer only after:

- the prior owner is terminal or explicitly abandoned;
- the complete diff is inspected;
- overlapping active ownership is excluded;
- one adopter is explicitly named.

The adopter inherits the workspace candidate **and all unmet completion
requirements**, not merely the files.

Do not clean the worktree just because the worker process ended if recoverable
candidate work may still be present.

------------------------------------------------------------------------

## 8. Parallelism

Parallelism is an optimization, not a default.

Parallel implementation requires sufficiently independent authorized
tasks.

Before parallel Class 3 work, establish that:

-   both tasks are independently authorized;
-   each has one implementation owner;
-   file ownership is clear;
-   logical ownership is sufficiently independent;
-   shared contracts are already established;
-   neither depends on unresolved output from the other;
-   neither depends on a pending product decision;
-   mutable runtime state will not contaminate the other;
-   integration order is understood;
-   verification can distinguish failures;
-   parallel execution provides meaningful benefit.

Prefer:

> Parallelize siblings; sequence dependencies.

If independence becomes uncertain, sequence the work.

------------------------------------------------------------------------

## 9. Supported Operational Intents

`/worktree` recognizes five operational intents:

### INSPECT

Read-only.

Determine relevant repository/worktree state without mutation.

May report:

-   registered worktrees;
-   path;
-   branch or detached state;
-   HEAD;
-   dirty state;
-   relationship to the requested task when evidence supports it;
-   whether ownership/purpose is known or unknown.

INSPECT never cleans anything.

### CREATE

Mutating.

Creates an already-authorized Class 2 or Class 3 isolation environment.

Creation must never be ambiguous about class and purpose.

### STATUS

Read-only.

Determine an isolation environment's current disposition state using
available lifecycle evidence.

Possible states include:

-   `ACTIVE`;
-   `KEEP FOR VERIFICATION`;
-   `KEEP FOR REVIEW`;
-   `KEEP FOR CORRECTION`;
-   `READY FOR DISPOSITION`;
-   `DISPOSITION BLOCKED`;
-   `UNKNOWN`.

STATUS does not invent lifecycle completion.

### DISPOSE

Mutating.

Runs the applicable safety gate and removes only isolation proven
eligible for disposal.

Ordinary disposal removes the worktree only. It does not delete the
associated branch.

### RECOVER

Conservative recovery after:

-   interrupted session;
-   partial creation;
-   failed cleanup;
-   tooling failure;
-   uncertain existing isolation state.

RECOVER begins read-only.

It reconstructs only what evidence supports.

`RECOVER` does not mean "clean everything up."

If ownership, purpose, or disposability cannot be established, return
`UNKNOWN` and leave the environment intact.

------------------------------------------------------------------------

## 10. Class 2 Creation Contract

Before creating Class 2, establish at minimum:

-   **Class:** 2;
-   **Purpose:** evidence;
-   **Source:** exact revision/state to be tested;
-   **Governing workflow:** normally Verify or Debug;
-   **Authorization:** disposable isolation is permitted.

When relevant, also establish:

-   expected evidence;
-   whether active dirty state is intentionally excluded;
-   mutation budget;
-   required runtime state;
-   build-output isolation requirements.

Do not invent a durable branch merely for disposable evidence.

Prefer non-branch mechanisms such as a snapshot, archive, or detached
worktree when sufficient.

A clean checkout alone does not establish evidence correctness.

The exact source state being tested must be identified.

------------------------------------------------------------------------

## 11. Class 3 Creation Contract

Before creating Class 3, establish at minimum:

-   **Class:** 3;
-   **Purpose:** implementation;
-   **Source/Base:** known;
-   **Owner:** known;
-   **Authorized scope:** known;
-   **Execution state:** `READY FOR EXECUTION`;
-   **Isolation justification:** concrete and valid;
-   **Protected user state:** identified when relevant;
-   **Branch requirement:** authorized or permitted by established
    project policy.

If a required item is missing, do not create the implementation
worktree.

Do not invent branch structure merely because a worktree would be
convenient.

------------------------------------------------------------------------

## 12. Branch Safety

Branch operations are distinct from worktree operations.

Creating a worktree does not automatically authorize:

-   branch creation;
-   branch switching in the active workspace;
-   merge;
-   rebase;
-   cherry-pick;
-   reset;
-   push;
-   branch deletion.

For Class 2, prefer detached evidence isolation when branch semantics
are unnecessary.

For Class 3, use only a branch arrangement already authorized by the
governing lifecycle, user instruction, or established project policy.

Never create a durable branch merely to satisfy an implementation
convenience when branch authority is unresolved.

A delegated worker operating in Class 3 must not switch, checkout, restore,
reset, clean, or otherwise mutate the orchestrator/main checkout. Its Git
mutations must target its assigned worktree only.

If the worker discovers that its session or a tool is targeting the main
checkout, it must stop and report rather than attempting self-repair there.

------------------------------------------------------------------------

## 13. Worktree Path Selection

Choose a deterministic, non-conflicting path that:

-   does not overwrite an existing path;
-   does not interfere with the active repository;
-   is suitable for the current OS/tooling environment;
-   follows established project/environment policy when one exists.

Use the configured parent/module placement rule in ../index.md: unless the user/project explicitly chooses another location, create worktrees under `<primary-parent>/worktrees/<repo>/<task>`. This current convention supersedes historical ad hoc sibling-folder examples. Keep task scratch/evidence under that same repo worktree folder; retain active/paused candidate paths until safe disposition.

Prefer worktree infrastructure outside the active checkout's project namespace.
Do not place harness worktrees under the active repository root when doing so
would appear as tracked/untracked project content, unless an established
project policy explicitly designates and safely ignores that location.

Exact path conventions should be validated by runtime evidence before
becoming policy.

------------------------------------------------------------------------

## 14. Creation Validation

After a mutating CREATE operation, validate the resulting environment
before reporting success.

Confirm as applicable:

-   worktree is registered;
-   path exists;
-   it belongs to the expected repository;
-   expected revision is checked out;
-   expected branch or detached state is correct;
-   initial dirty state is understood;
-   active user workspace remains unchanged;
-   unrelated worktrees remain unchanged;
-   source/base identity matches the creation contract.

Only report `CREATED` when postconditions are satisfied.

Creation validation establishes Git/worktree identity; it does **not** prove
that every external editor/MCP/write tool respects that identity.

### Tool-Path Confinement Before First Write

Before implementation begins in Class 3, verify the effective target of every
write-capable mechanism the worker intends to use, including as applicable:

- shell commands;
- editor/file APIs;
- MCP tools;
- patch/apply tools;
- formatters;
- code generators;
- Git commands.

A tool is worktree-safe only when its mutation target is known to resolve
inside the assigned worktree for that operation.

If a tool resolves paths against the orchestrator/main checkout, ignores the
worker's `cwd`, or has uncertain target semantics:

- do not use it for mutation in that worker;
- use a worktree-safe mechanism instead; or
- stop and report the limitation.

Read capability does not imply safe write capability.

If creation partially succeeds or resulting state is uncertain:

1.  stop;
2.  inspect resulting Git state;
3.  do not blindly retry;
4.  report `CREATION INCOMPLETE`, `UNKNOWN`, or `BLOCKED` as
    appropriate.

Never use destructive Git operations to force creation into the expected
shape.

------------------------------------------------------------------------

## 15. Evidence Identity

Class 2 evidence must identify what was actually tested.

Record in the workflow report:

-   source commit/revision;
-   whether dirty state was included;
-   purpose;
-   relevant test/check;
-   result;
-   relationship to the active implementation;
-   disposition of the isolation environment.

Correct test + wrong revision is invalid evidence.

A clean checkout does not by itself prove relevance.

------------------------------------------------------------------------

## 16. Build and Runtime State

Source-worktree isolation and build-output isolation are separate
decisions.

Do not establish a universal rule that every worktree requires a unique
build directory or `CARGO_TARGET_DIR`.

Use separate build-output isolation only when justified by:

-   evidence integrity;
-   concurrent tool behavior;
-   contamination already observed;
-   established project policy;
-   a specific workflow requirement.

Likewise, parallel workspaces must not accidentally share mutable
runtime state when that sharing can contaminate implementation or
evidence.

Examples include:

-   build outputs locked by a concurrently running executable (for example,
    a Windows Rust binary using a shared Cargo target directory);
-   SQLite databases;
-   queues;
-   uploaded files;
-   generated mutable fixtures;
-   local service state;
-   sockets;
-   ports;
-   caches when correctness depends on them.

Isolate only the mutable resources that materially require isolation.

------------------------------------------------------------------------

## 17. Class 2 Is Not Implementation

If Verify or Debug discovers an obvious fix while operating in Class 2:

1.  capture the evidence;
2.  report the root cause/finding;
3.  determine the appropriate lifecycle handoff;
4.  do not convert the evidence environment into an implementation
    workspace.

Possible handoffs include:

-   `READY FOR PLANNING`;
-   `READY FOR EXECUTION`;
-   `NEEDS DECISION`;
-   another status defined by the governing workflow.

`CLASS 2 → CLASS 3` is never automatic.

------------------------------------------------------------------------

## 18. Class 3 Ownership

Every Class 3 worktree has one implementation owner at a time.

Multiple read-only agents may inspect the workspace.

Inspection does not grant write ownership.

Advisory agents do not become implementation writers merely because they
find the fix.

Reviewer, Oracle, Scout, Test Engineer, and advisory specialists remain
within their governing role unless the orchestrator explicitly
establishes a new authorized implementation assignment.

Corrections normally return to the original implementation owner.

Ownership transfer must be explicit.

------------------------------------------------------------------------

## 19. Scope Expansion

A worker discovering required work outside its authorized scope must not
silently absorb it.

Classify the discovery:

-   implied implementation dependency;
-   unrelated defect;
-   shared-contract change;
-   product decision;
-   new scope;
-   unknown.

Report it to the orchestrator.

If the discovery invalidates the independence assumption of parallel
work, stop the affected path and re-evaluate sequencing or planning.

Workers do not negotiate new product contracts between themselves.

------------------------------------------------------------------------

## 20. Integration

`/worktree` does not own integration.

It must not automatically:

-   merge;
-   rebase;
-   cherry-pick;
-   push;
-   resolve semantic conflicts;
-   delete branches.

Integration remains governed by the orchestrator and Ship/project Git
policy.

A merge conflict may indicate that the assumed independence between
tasks was wrong.

Before resolving a conflict, classify it as:

-   mechanical; or
-   semantic.

Mechanical conflicts may be routed to the appropriate implementation
owner.

Semantic conflicts involving API contracts, schemas, state transitions,
business rules, or other shared semantics require the appropriate
Plan/Decision/lifecycle handling.

Never choose product semantics merely to make Git merge.

------------------------------------------------------------------------

## 21. Verification and Review Retention

Do not automatically dispose of a Class 3 worktree when Execute
finishes.

The environment may still be required for:

-   Verify;
-   Review;
-   correction after Verify failure;
-   correction after Review findings;
-   integration comparison;
-   artifact continuity.

Typical lifecycle:

`IMPLEMENT → VERIFY → REVIEW → CORRECTION if needed → INTEGRATION/SAFE REPRESENTATION → DISPOSITION`

If Verify fails, retain the implementation worktree and normally return
correction to the original owner.

If Review requires changes, retain it for correction.

Parallel implementations require verification of the integrated
candidate; independent branch success alone is insufficient.

Materially interacting parallel changes should be reviewed as an
integrated candidate.

------------------------------------------------------------------------

## 22. Automatic Disposition Principle

Harness-created isolation should not accumulate indefinitely.

Once the governing lifecycle establishes that an isolation environment
is no longer needed, `/worktree` should automatically attempt safe
disposition without requiring the user to manually request routine
cleanup.

Automatic disposition is lifecycle-aware.

It is not a background daemon, cron job, watcher, or persistent cleanup
service.

Cleanup occurs as part of normal workflow progression.

Automatic disposition never overrides a stricter mutation or read-only
contract.

------------------------------------------------------------------------

## 23. Class 2 Disposition Gate

Class 2 is explicitly disposable.

It is eligible for automatic disposition when all applicable conditions
hold:

-   the environment is known to be harness-created;
-   required evidence has been captured outside the environment;
-   no active workflow still needs it;
-   no user work exists inside it;
-   no required artifact exists only inside it;
-   disposable mutations fall within the authorized evidence budget;
-   cleanup is permitted by the current mutation contract.

Class 2 may naturally be dirty because of disposable test/build/runtime
artifacts.

Dirty state alone does not block Class 2 disposal.

Instead determine whether anything valuable, user-owned, durable, or
not-yet-captured would be lost.

If yes or uncertain, retain and report.

------------------------------------------------------------------------

## 24. Class 3 Disposition Gate

Class 3 automatic disposition is more conservative.

All applicable conditions must hold:

1.  implementation is complete;
2.  required Verify has passed;
3.  required Review has passed;
4.  no correction is pending;
5.  candidate is safely represented outside the disposable worktree;
6.  no uncommitted implementation or user work would be lost;
7.  no evidence depends exclusively on the worktree;
8.  no active lifecycle phase still needs it;
9.  no delegated owner is running, blocked, waiting, paused, or awaiting result
    collection;
10. the owning worker has reached a terminal state and its result has been
    collected, or the worker/scope was explicitly abandoned;
11. cleanup is permitted by the current mutation contract;
12. worktree removal will not perform an unauthorized branch operation.

If any required condition is false or unknown:

`DISPOSITION BLOCKED`

or:

`RETAINED`

as appropriate.

------------------------------------------------------------------------

## 25. Safely Represented

For Class 3 disposal, "safely represented" requires durable evidence
that the implementation no longer exists only inside the disposable
workspace.

Examples may include:

-   committed on an authorized branch;
-   integrated into an authorized target;
-   another durable Git state explicitly recognized by the governing
    workflow.

Do not infer safe representation from statements such as:

-   "the files were probably copied";
-   "the diff looked right";
-   "the worker said it was done."

Uncommitted changes existing only inside the worktree block automatic
disposition.

------------------------------------------------------------------------

## 26. Dirty Class 3 Protection

Before Class 3 disposal, inspect working-tree state.

If meaningful uncommitted changes exist:

`DISPOSITION BLOCKED`

Do not automatically:

-   `git reset --hard`;
-   `git clean -fd`;
-   stash changes;
-   discard files;
-   overwrite changes;
-   force-remove the worktree.

Dirty Class 3 implementation state is presumed valuable until proven
otherwise.

------------------------------------------------------------------------

## 27. Branch Deletion Protection

Ordinary worktree disposition removes the worktree only.

It does not delete the associated branch.

Hard invariant:

> REMOVE WORKTREE ≠ DELETE BRANCH.

Branch deletion requires separate authority.

Do not treat branch deletion as routine cleanup.

------------------------------------------------------------------------

## 28. Unknown and User-Created Worktrees

Automatic disposition applies only to isolation whose harness ownership
and lifecycle purpose are sufficiently established.

Do not automatically remove:

-   user-created worktrees;
-   pre-existing worktrees of unknown origin;
-   worktrees whose task relationship cannot be established;
-   worktrees whose lifecycle status is uncertain;
-   worktrees discovered after a restart when disposability cannot be
    reconstructed.

If ownership or purpose is uncertain:

`UNKNOWN`

and leave the environment intact.

Apparent age or inactivity does not prove disposability.

------------------------------------------------------------------------

## 29. Strict Read-Only Interaction

The global read-only contract overrides this skill.

When the governing task, workflow, phase, runtime test, or user
instruction requires strict read-only behavior:

-   do not create a worktree;
-   do not create snapshots or scratch files;
-   do not remove a worktree;
-   do not clean temporary artifacts;
-   do not mutate branches;
-   do not modify Git state;
-   do not perform "temporary" create-then-delete mutations.

If mutation is required and no explicit disposable-isolation exception
exists, report the limitation or request the required authorization.

Automatic cleanup is subordinate to the current mutation contract.

An environment may therefore be:

`READY FOR DISPOSITION`

while cleanup remains deferred.

------------------------------------------------------------------------

## 30. Supporting Evidence Does Not Expand the Mutation Budget

Authorization to create or dispose of an isolation environment applies only to the explicitly authorized isolation mutations.

Supporting inspection, comparison, bookkeeping, validation, and before/after checks remain read-only unless separately authorized.

Do not create scratch files, temporary files, snapshots, logs, marker files, or other persistent artifacts merely to compare pre-operation and post-operation state.

Prefer:

- direct command output;
- shell variables or other non-persistent in-process state;
- repeated read-only inspection;
- existing Git metadata.

A mutation that would be convenient for proving another authorized mutation is not automatically authorized.

If required validation genuinely cannot be performed without an additional persistent side effect, stop and report the limitation or request authorization.

Never widen the mutation budget merely because the additional artifact is temporary or outside the repository.

------------------------------------------------------------------------

## 31. Recovery

Recovery begins with read-only inspection.

Use it after:

-   partial creation;
-   interrupted execution;
-   failed disposal;
-   process crash;
-   stale-looking isolation;
-   uncertain worktree state.

Determine, when evidence permits:

-   registered path;
-   repository identity;
-   branch/detached state;
-   HEAD;
-   dirty state;
-   likely source/base;
-   whether harness ownership is established;
-   whether lifecycle purpose is established;
-   whether disposition eligibility is established.

Do not infer missing ownership or purpose from a convenient directory
name alone.

If recovery cannot establish safety:

`UNKNOWN`

and retain the environment.

Do not convert uncertainty into cleanup authority.

Recovery mutation is separate from recovery inspection.

Creating a backup patch, scratch file, `/tmp` artifact, stash, temporary
branch, or other recovery aid is itself a persistent side effect and must fit
an explicit recovery mutation budget. Do not create it merely because it feels
safer.

If worker-induced leakage reached the orchestrator/main checkout, recovery
must preserve user work and may revert only changes whose worker ownership and
safe representation elsewhere are established.

------------------------------------------------------------------------

## 32. Failure Behavior

Mutating isolation operations must fail safe.

### Creation failure

If creation fails or partially succeeds:

1.  stop;
2.  inspect resulting state;
3.  do not blindly repeat the same mutation;
4.  do not reset or clean unrelated state;
5.  report the exact known result.

### Disposal failure

If normal worktree removal fails:

1.  inspect;
2.  report the failure;
3.  leave the environment intact unless another explicitly authorized
    safe action exists.

Do not automatically escalate to destructive operations such as:

-   forced worktree removal;
-   hard reset;
-   recursive deletion;
-   branch deletion.

Cleanup failure is preferable to destruction of valuable work.

Cleanup status is separate from engineering correctness.

A successfully implemented, verified, reviewed, and integrated change
may still report:

`Delivery: COMPLETE`

`Isolation disposition: CLEANUP BLOCKED`

when cleanup fails for an operational reason.

------------------------------------------------------------------------

## 33. Post-Disposition Validation

After successful worktree removal, confirm as applicable:

-   worktree is no longer registered;
-   intended path disposition is confirmed;
-   active user workspace is unchanged;
-   unrelated worktrees are unchanged;
-   associated branch still exists when applicable;
-   no unauthorized Git operation occurred.

Only then report:

`DISPOSED`

------------------------------------------------------------------------

## 34. No Persistent Registry by Default

Do not create a repository worktree registry by default.

Do not create:

-   `.worktrees.json`;
-   `.worktree-state.yaml`;
-   `.engineering/worktrees.md`;
-   equivalent tracking infrastructure.

Do not use Claude memory as an active worktree registry.

Active worktree state is not durable project knowledge.

Prefer existing evidence:

-   Git worktree metadata;
-   branch/HEAD state;
-   repository status;
-   current lifecycle context;
-   retained workflow evidence.

If future runtime testing demonstrates that restart recovery cannot be
handled safely without durable metadata, report that observed failure
and evaluate the smallest necessary solution separately.

Do not preemptively create infrastructure.

------------------------------------------------------------------------

## 35. No Background Cleanup System

Automatic disposition does not require:

-   daemon;
-   watcher;
-   cron job;
-   scheduled task;
-   background process.

The orchestrator invokes safe disposition during normal lifecycle
progression when eligibility becomes established.

------------------------------------------------------------------------

## 36. Reporting

For meaningful worktree operations, report enough information to
identify the environment and its safety state.

### CREATE report

Include as applicable:

-   isolation class;
-   purpose;
-   governing lifecycle phase/workflow;
-   source/base revision;
-   branch or detached state;
-   path;
-   owner for Class 3;
-   protected user state;
-   initial dirty state;
-   validation result.

### STATUS report

Include:

-   current known identity;
-   lifecycle need;
-   dirty state;
-   whether evidence/work remains;
-   disposition state;
-   blockers or unknowns.

### DISPOSE report

Include:

-   environment disposed;
-   safety gate result;
-   branch retained;
-   active workspace unchanged;
-   any cleanup failure/blocker.

### RECOVER report

Separate:

-   VERIFIED;
-   INFERRED;
-   UNKNOWN.

Do not present inference as verified ownership or lifecycle state.

------------------------------------------------------------------------

## 37. Status Vocabulary

Use the smallest accurate status.

Operational statuses:

-   `INSPECTED`
-   `CREATED`
-   `RETAINED`
-   `READY FOR DISPOSITION`
-   `DISPOSED`
-   `NEEDS AUTHORIZATION`
-   `NEEDS CONTEXT`
-   `DISPOSITION BLOCKED`
-   `CREATION INCOMPLETE`
-   `UNKNOWN`
-   `BLOCKED`

Lifecycle-specific states such as `KEEP FOR VERIFICATION`,
`KEEP FOR REVIEW`, or `KEEP FOR CORRECTION` may be reported when
supported.

Never report success merely because the Git command returned without
obvious error. Validate postconditions.

------------------------------------------------------------------------

## 38. Self-Check Before Mutation

Before any CREATE or DISPOSE mutation, ask:

1.  What lifecycle phase currently governs this action?
2.  Is mutation authorized?
3.  Is the requested isolation class established?
4.  Is isolation actually necessary?
5.  Could Class 1 or Class 0 safely satisfy the task instead?
6.  What exact evidence/ownership/repository risk does isolation
    protect?
7.  What source/base state is intended?
8.  Does branch creation require separate authorization?
9.  Is protected user work present?
10. For Class 3, is implementation already authorized?
11. For Class 3, is one implementation owner established?
12. Does this action accidentally alter another worktree or the active
    workspace?
13. Does this action bypass Plan, Execute, Verify, Review, Ship, or
    Decision gates?
14. Is strict read-only currently in force?
15. If disposing, is the environment proven harness-created?
16. If disposing Class 3, is the candidate safely represented elsewhere?
17. If disposing, could any uncommitted or user work be lost?
18. Does disposal attempt to delete a branch or perform integration?
19. If an operation fails, will the recovery path remain
    non-destructive?
20. Can the resulting state be validated and reported precisely?
21. Am I about to create a scratch or temporary artifact merely to support or compare an otherwise authorized operation?
22. Is every persistent side effect independently inside the explicit mutation budget rather than merely convenient for validation?
23. Is a delegated owner still running, blocked, waiting, paused, or awaiting result collection?
24. For Class 3, have the worker's actual write-capable tools been proven to target the assigned worktree?
25. Could this path appear as project content in the orchestrator/main checkout?
26. Does any recovery step mutate the main checkout, create a backup artifact, or otherwise require separate recovery authority?

If a critical answer is unknown, stop rather than guessing.

------------------------------------------------------------------------

## 39. Hard Invariants

1.  Use the least isolation necessary.
2.  Isolation protects evidence, ownership, user work, or repository
    state; it is not ceremony.
3.  Dirty state does not automatically require a worktree.
4.  Read-only inspection does not create isolation for convenience.
5.  Disposable evidence isolation is not an implementation workspace.
6.  Worktree creation does not authorize implementation.
7.  Every Class 3 worktree has one implementation owner at a time.
8.  An active/blocked/waiting delegated owner retains its assigned worktree.
9.  Agent completion does not itself authorize disposal.
10. Separate worktrees do not resolve logical ownership collisions.
11. Parallelize independent siblings; sequence dependencies.
12. Shared mutable contracts must be established before dependent
    implementations parallelize.
13. Worktree `cwd` does not prove tool-level write confinement.
14. Every write-capable tool used by an isolated worker must target the
    assigned worktree or not be used for mutation.
15. Delegated workers do not mutate the orchestrator/main checkout.
16. Evidence isolation identifies the exact source state tested.
17. Clean checkout does not by itself prove evidence relevance.
18. Build-output isolation and source-worktree isolation are separate
    decisions.
19. No universal unique-`CARGO_TARGET_DIR` rule is established.
20. Isolation transitions never bypass lifecycle gates.
21. Strict read-only boundaries propagate into isolation decisions.
22. Automatic cleanup is mutation and remains subject to the current
    mutation contract.
23. Class 2 should be disposed automatically when safely disposable.
24. Class 3 should be disposed automatically only after lifecycle, owner-state,
    and safety gates establish disposability.
25. Dirty Class 3 state blocks automatic disposition.
26. Cleanup failure does not authorize destructive escalation.
27. Worktree removal does not authorize branch deletion.
28. Integration and delivery remain separate from worktree mechanics.
29. Unknown or user-created worktrees are never automatically removed.
30. Worktree infrastructure should not pollute the active project checkout.
31. Isolation infrastructure is not project knowledge or task tracking.
32. Recovery inspection does not grant recovery mutation authority.
33. Recovery artifacts such as `/tmp` patches, stashes, or backup branches are
    mutations and require an explicit mutation budget.
34. Interrupted worker termination does not transfer ownership automatically.
35. An adopter inherits unmet completion requirements with the candidate.
36. No persistent registry is introduced without observed evidence that one is
    needed.
37. No new agent is required for worktree mechanics.
38. `/worktree` executes an isolation decision; it does not manufacture one.
39. Supporting evidence and validation do not inherit mutation authority;
    every persistent side effect must independently fit the explicit mutation
    budget.

------------------------------------------------------------------------

## 40. Runtime-Hardening Record

This is `/worktree v0.1.3`.

**Status:** FROZEN after evidence-backed hardening.

Observed multi-agent runtime evidence demonstrated that:

- a blocked worker's worktree could be cleaned up before terminal handoff;
- a write-capable external tool could resolve paths against the main checkout
  despite the worker having an isolated worktree;
- delegated activity could mutate/switch the orchestrator checkout;
- worktree infrastructure placed under the project could appear as untracked
  project content;
- concurrent Rust builds on Windows could require separate build output when a
  running executable locks the shared target;
- recovery helpers such as temporary patch files are mutations, not free
  read-only safety measures.

v0.1.3 retains those isolation boundaries and additionally hardens interrupted-writer ownership transfer without adding a new agent,
persistent registry, cleanup daemon, deployment workflow, or universal build
directory rule.

Future changes remain evidence-driven:

> NO OBSERVED FAILURE -> NO NEW RULE.

> NO DISTINCT REPEATABLE FLOW -> NO NEW SKILL.

> NO DISTINCT RECURRING ROLE -> NO NEW AGENT.
