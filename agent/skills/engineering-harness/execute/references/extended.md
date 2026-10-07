> Historical reference only. The v1.2.1 global policy and compact skill govern
> routing, role selection, authority, and whether a formal plan or independent
> gate is needed. Old universal phase/agent/READY FOR EXECUTION wording below
> applies only when that gate is selected under current policy. This archive
> cannot impose a new gate, waive a blocker, or expand authority. Read targeted
> sections only; never auto-import or preload the complete archive.

# Extended guidance (archived from pre-cost-optimized harness)

## Dispatch before role work

For the main conversation, loading this router is preparation, not execution of
the selected role. After prerequisites and domain routing are satisfied, the next
substantive role action must be an actual named-agent launch, followed by its
returned evidence. Do not begin that role's diagnosis, independent verification,
review, specialist analysis, or non-trivial writing in the main session.

`debug`, `verify`, and `review` are synchronous named-agent fork skills: call
Skill with a complete task packet in `args`, or call the named Agent using its
preloaded skill, but do not do both for the same work. Other roles require an
explicit Agent call with the exact `subagent_type`. Pass absolute paths, authority,
scope, evidence, mutation boundaries, and expected output. Do not rely on shared
conversation history. A failed launch blocks the role; it does not authorize
orchestrator substitution. A leaf subagent seeing this router follows only its
assigned role and returns requests for other roles to the main conversation.
# Execute

> **Main-session dispatch boundary:** Any instruction in this skill to invoke a worker, test engineer, reviewer, debugger, specialist, or oracle is an instruction for the **main Pi conversation only**. If Execute is visible inside a custom subagent, that subagent must not call `Agent` / legacy `Task`; it must return a handoff request to the main conversation.


Implement an approved Execution Plan safely and with evidence.


## Main-Session Worker Dispatch — Mandatory for Non-Trivial Writes

Loading `execute` establishes execution gates; it does not make the main
orchestrator the implementation worker.

Once READY FOR EXECUTION is established:

- backend source mutation routes to `rust-worker`;
- frontend source mutation routes to `frontend-worker`;
- cross-stack work uses explicit non-overlapping ownership;
- specialist analysis runs first when a material unresolved domain decision
  requires it.

The orchestrator coordinates and integrates handoffs. It does not implement a
non-trivial delegated change itself merely because the Execute skill is loaded.
Existing narrow direct-edit exceptions in this skill remain the only exception.

If the required writer cannot be launched, Execution is BLOCKED. Do not silently
fall back to orchestrator implementation.

Execute is the write-authorized stage of the engineering workflow.

Normal lifecycle:

DISCOVER
→ PLAN
→ EXECUTE
→ VERIFY
→ REVIEW
→ SHIP
→ LEARN

Execution does not mean:

"Start coding until the feature seems finished."

Execution means:

"Implement an explicitly ready plan while preserving its requirements, invariants, decisions, dependencies, TDD obligations, verification requirements, review requirements, and scope."

---

# Core Principle

The Execution Plan is the implementation contract.

Execute may make localized implementation decisions that are:

- consistent with the approved plan;
- consistent with existing architecture;
- reversible;
- inside established scope;
- not product decisions;
- not material architecture changes.

Execute must not silently change or infer:

- unresolved product decisions;
- requirements;
- acceptance criteria;
- critical invariants;
- API contracts;
- persistence semantics;
- migration strategy;
- security boundaries;
- task dependencies;
- product behavior;
- major architecture decisions.

If execution requires such a change:

STOP.

Return to Plan or Discover as appropriate.

---

# Absolute Pre-Write Barrier

This is the most important Execute rule.

Before ANY write-authorized implementation action, the referenced plan must be explicitly:

READY FOR EXECUTION

This barrier applies before:

- invoking a worker with write authority;
- editing production code;
- editing tests;
- creating migrations;
- changing configuration;
- adding dependencies;
- generating implementation files;
- formatting implementation files;
- applying patches;
- making any repository modification for the task.

Read-only inspection is allowed before this barrier.

Writing is not.

---

# Non-Ready Plans Are Non-Executable

If the referenced Plan status is:

- NEEDS DISCOVERY;
- NEEDS USER INPUT;
- NEEDS TECHNICAL DECISION;
- BLOCKED;

Execute MUST NOT write.

Execute MUST NOT invoke an implementation worker with write authority.

Execute MUST NOT reinterpret the user's request to execute as resolving the Plan's blockers.

Return the corresponding status.

---

# Execution Language Does Not Resolve Decisions

Generic execution language does NOT authorize unresolved Plan decisions.

The following phrases do not mean that Plan recommendations are accepted:

- "implement the plan";
- "execute it";
- "go ahead";
- "proceed";
- "do it";
- "start";
- "continue";
- "make the changes";
- "ship it";
- similar generic execution instructions.

If the referenced plan is not READY FOR EXECUTION, these phrases do not override its gate.

Never reason:

"The user told me to execute, therefore they must be accepting the recommendations."

That inference is forbidden.

---

# Explicit Decision Authorization

A user may explicitly resolve blocking decisions.

Examples:

"Use option A for Decision 1."

"Keep physical noon taps as LUNCH_OUT."

"Go with the recommendations for Decisions 1 through 3."

These statements may resolve the identified decisions.

However, Execute should not silently convert the old non-ready Plan into an executable contract.

The preferred flow is:

USER DECISION
→ PLAN updates/resolves decisions
→ READY FOR EXECUTION
→ EXECUTE

If the user explicitly supplies all blocking decisions while invoking Execute, Execute may recognize those decisions as new planning input, but must establish an updated READY FOR EXECUTION contract before writing.

Do not begin implementation while the referenced contract still says NEEDS USER INPUT.

---

# Decision Completeness

When the user resolves Plan blockers directly, verify that every execution-blocking decision is resolved.

Do not assume omitted decisions.

Example:

Plan has Decisions 1, 2, and 3.

User says:

"Use a primary_reason string."

This resolves Decision 1 only.

Decisions 2 and 3 remain unresolved.

Execution remains blocked.

---

# No Recommendation Auto-Acceptance

Recommendations are not decisions.

A Plan may contain:

Recommendation: Option A.

That does not authorize Option A.

A recommendation becomes authorized only when:

- the user explicitly accepts it;
- an already-approved Plan incorporates it as a resolved decision;
- it is a purely technical localized decision already within orchestrator authority.

Product-significant recommendations require actual resolution.

---

# Write Authority

After the READY FOR EXECUTION barrier is satisfied, Execute may modify repository files.

Write authority is limited to:

- files required by the approved plan;
- tests required by the approved plan;
- localized supporting changes necessary to make the planned implementation coherent.

Do not treat write authority as permission for opportunistic cleanup.

---

# Required Input

The preferred input is an Execution Plan with:

Execution Status:

READY FOR EXECUTION

The plan should establish:

- objective;
- requirements;
- invariants;
- acceptance criteria;
- change surface;
- technical approach;
- resolved product decisions;
- implementation tasks;
- task ownership;
- dependencies;
- TDD classification;
- regression expectations;
- independent verification requirements;
- review requirements;
- rollback/recovery concerns.

---

# Execution Gate

Before modifying anything:

## READY FOR EXECUTION

Continue.

## NEEDS DISCOVERY

Do not write.

Return:

NEEDS DISCOVERY

## NEEDS USER INPUT

Do not write.

Return:

NEEDS USER INPUT

and restate the blocking decisions.

## NEEDS TECHNICAL DECISION

Do not write.

Return:

NEEDS TECHNICAL DECISION

## BLOCKED

Do not write.

Return:

BLOCKED

Do not interpret a provisional or draft plan as executable.

---

# Pre-Write Gate Report

Before the first write-authorized action on non-trivial work, establish internally:

- referenced plan;
- plan status;
- blocking decisions: none;
- repository identified;
- working tree inspected;
- first task identified;
- first writer identified;
- TDD requirement identified.

If any blocking decision remains:

STOP.

Do not launch the worker.

---

# Direct Execution Without Formal Plan

Do not require formal `/plan` output mechanically for genuinely trivial work.

Direct execution may be appropriate when ALL are true:

- scope is obvious;
- affected files are known;
- behavior is unambiguous;
- risk is LOW;
- no material product decision exists;
- no architecture decision exists;
- no persistent-data semantics change;
- no security boundary changes;
- rollback is straightforward.

Examples:

- obvious text correction;
- trivial label change;
- known-file mechanical edit;
- simple configuration correction.

For non-trivial behavioral work, use an approved Execution Plan.

Do not use direct execution as a loophole around the READY barrier.

Critical domain behavior is not eligible for trivial direct execution merely because the diff is small.

---

# Pre-Execution Validation

After readiness is established and before editing:

1. confirm the relevant repository;
2. inspect working-tree state;
3. identify pre-existing user changes;
4. confirm relevant files still exist;
5. confirm critical Plan assumptions remain true;
6. confirm task dependencies;
7. confirm file ownership;
8. confirm TDD requirement;
9. identify the first executable task;
10. when isolation is assigned, confirm the exact worktree path and branch/revision;
11. identify every write-capable tool the writer is expected to use;
12. verify those write paths resolve inside the assigned workspace before the first mutation.

Do not perform a full rediscovery unless evidence has become stale.

A worker's shell `cwd` is not sufficient proof that editor, MCP, patch,
formatter, generator, or Git mutations will target that worktree.

---

# Protect Existing User Work

Treat pre-existing modifications as intentional.

Do not:

- overwrite unrelated user changes;
- revert unrelated modifications;
- reset the working tree;
- discard uncommitted work;
- clean files merely to create a convenient baseline.

If a planned file already contains unexpected user changes:

inspect them.

Determine whether the task can safely coexist.

If not:

STOP the affected task.

Report the conflict.

---

# Execution State

Track each planned implementation task as one of:

- PENDING
- BLOCKED
- IN PROGRESS
- RED ESTABLISHED
- GREEN ESTABLISHED
- REGRESSION PASSED
- COMPLETE
- FAILED

Do not call a task COMPLETE merely because production code was written.

---

# Dependency Enforcement

Do not start a task until required dependencies are satisfied.

If:

Task 2 depends on Task 1

then Task 2 must not begin until the required completion evidence for Task 1 exists.

A dependency may sometimes require only a specific artifact or contract rather than full feature completion.

Follow the approved Plan.

---

# One-Writer Discipline

Each implementation task has one primary writer.

Prefer one writer per:

- file;
- tightly coupled module;
- logical behavior change.

Do not allow multiple implementation agents to edit the same file concurrently.

Do not allow specialists to casually edit files while a worker owns them.

Do not allow the orchestrator to casually become a second implementation writer after delegation.

Specialists advise.

Workers implement.

Test Engineer independently verifies.

Reviewer reviews.

Oracle adjudicates exceptional uncertainty.

The orchestrator coordinates and decides.

---

# Writer Ownership Persists Through Corrections

Once a worker owns a logical change, that ownership normally persists through:

- initial implementation;
- legitimate Test Engineer corrections;
- Reviewer-requested corrections;
- focused regression fixes.

If Reviewer or Test Engineer identifies a required code correction:

return the correction to the owning worker.

Do not have the orchestrator directly edit the worker's files merely because the correction is small.

---

# Exceptions to Writer Ownership

The orchestrator may directly write only when:

- no implementation worker was delegated for that change;
- the work qualifies for direct execution;
- emergency repository repair is required to restore a tool-induced malformed edit;
- the user explicitly requests orchestrator-local editing and doing so does not create conflicting ownership.

For delegated non-trivial work, preserve worker ownership.

---

# Non-Blocking Review Notes

If Reviewer returns:

APPROVE WITH NOTES

determine whether a note requires a code change.

If the note is genuinely non-blocking, such as minor style/readability feedback:

it may remain documented.

Do not modify code merely to eliminate every note.

If the note should be corrected before completion:

send it to the owning worker.

Then run appropriate focused verification.

---

# Safe Parallel Execution

Parallelize only tasks explicitly safe to execute concurrently or tasks proven independent during execution.

Safe parallelism requires:

- no overlapping file ownership;
- no unresolved shared API contract;
- no shared migration dependency;
- no tightly coupled persistent-state changes;
- no ordering dependency;
- no competing architectural decisions.

When uncertain:

sequence the work.

Execution speed does not outrank correctness.

For parallel isolated workers, also require:

- each active worker has a distinct assigned workspace;
- the workspace remains reserved while that worker is running, blocked,
  waiting, or awaiting delivery;
- each worker's write-capable tools are confined to its assigned workspace;
- no worker may switch or repair the orchestrator/main checkout;
- shared build/runtime state is isolated when observed tooling behavior makes
  sharing unsafe.

---

# Delegation Task Packet

Before spawning a worker, construct the smallest sufficient task packet.

Include:

- exact task identifier and goal;
- authoritative plan/execution-contract path or identifier, when one exists;
- only the resolved decisions relevant to that task;
- owned files/scope and forbidden scope when known;
- required internal/domain skill references;
- TDD requirement and expected RED/GREEN evidence;
- worktree/path-confinement and Git boundaries;
- exact completion evidence required.

Do not paste unrelated workstreams, full conversation history, or the entire
project plan when a stable reference is available.

If the worker cannot access the referenced authoritative artifact, provide the
minimum relevant excerpt rather than the whole document.

Context minimization must never remove a material constraint.

# Worker Handoff

When delegating an implementation task, provide:

- task objective;
- requirements;
- acceptance criteria relevant to the task;
- invariants;
- relevant files/subsystem;
- dependencies already satisfied;
- technical constraints;
- TDD classification;
- RED behavior;
- GREEN expectations;
- regression requirements;
- what may be modified;
- what must not be modified;
- assigned worktree path/identity when isolation is used;
- explicit prohibition on mutating the orchestrator/main checkout;
- requirement to stop using any write-capable tool whose effective target is
  outside or uncertain relative to the assigned worktree;
- relevant specialist findings;
- completion evidence required.

Do not send:

"Implement Task 1."

when a complete execution contract exists.

---

# Worker Authority

Workers may make localized decisions such as:

- local variable names;
- small helper extraction;
- exact test organization consistent with repository patterns;
- error wording consistent with existing conventions;
- implementation details that do not alter architecture or contract.

Workers must not independently decide:

- new product behavior;
- unresolved Plan decisions;
- new persistent semantics;
- API contract changes;
- schema strategy changes;
- security policy;
- major dependency additions;
- architectural redesign;
- scope expansion.

Those decisions return to the orchestrator.

The orchestrator also lacks authority to turn an unresolved material product
choice into a decision merely to keep execution moving. If project authority
does not already resolve the choice, route it to the appropriate decision/user
gate.

---

# Worker Stop Rule

A worker must stop and report rather than improvise when it discovers:

- a Plan assumption is false;
- required behavior is ambiguous;
- an unresolved product decision;
- an incompatible API contract;
- unexpected schema semantics;
- a material security issue;
- a material architecture conflict;
- a required out-of-scope change.

The worker should return evidence.

When operating in an assigned worktree, the worker must also stop and report if:

- the worktree disappears or is replaced;
- the session is reset to another checkout;
- a write-capable tool targets the orchestrator/main checkout;
- the effective mutation path is uncertain;
- Git reports a branch/worktree identity inconsistent with the assignment.

Do not "recover" by editing the main checkout, switching its branch, restoring
its files, or recreating isolation independently.

The orchestrator decides the next workflow stage.

---

# Interrupted Worker / Orphaned Work Adoption

A worker that terminates because of context exhaustion, API failure, process
failure, cancellation, or another interruption may leave useful uncommitted
work.

Do not treat that work as automatically owned by the orchestrator.

Before adoption:

1. establish that the previous writer is terminal or explicitly abandoned;
2. prevent further mutation by that writer/workspace;
3. inspect the complete diff and repository state;
4. attribute the candidate to the terminated worker/scope;
5. confirm no other active writer owns overlapping files or behavior;
6. classify the candidate as `RECOVERABLE`, `UNCERTAIN`, or `DISCARD`;
7. explicitly assign exactly one new writer as adopter.

For `RECOVERABLE` work, the adopter must:

- read and understand the complete diff;
- reconcile it with the authoritative task/plan;
- finish incomplete implementation;
- preserve or reconstruct required TDD evidence where meaningful;
- run the required tests/checks;
- satisfy every completion requirement the terminated worker had not yet
  satisfied;
- report the resulting candidate as its adopted work.

Do not commit abandoned work solely because it compiles or tests pass.

Examples of completion requirements that survive adoption include:

- desktop/mobile browser evidence;
- accessibility checks;
- typecheck/lint requirements;
- independent verification;
- reviewer requirements;
- exact-candidate regression testing;
- unresolved product/authority gates.

If the diff cannot be understood or safely attributed, classify it `UNCERTAIN`
and do not adopt it through guesswork.

# Tool-Induced Workspace Leakage Recovery

If delegated writes leak into the orchestrator/main checkout:

1. stop or pause the affected writers;
2. inspect the main checkout's branch, HEAD, and dirty state;
3. attribute each leaked change to a known worker/scope before mutation;
4. confirm the intended change is safely represented in the worker's assigned
   workspace or another explicitly authorized recovery location;
5. revert only the proven worker-owned leakage from main;
6. do not reset, clean, restore, or overwrite unrelated/user-owned changes;
7. treat scratch files, `/tmp` patches, stashes, backup branches, or other
   recovery artifacts as separate mutations requiring their own authority;
8. re-check main branch identity and dirty state;
9. re-check the worker's worktree identity and tool-path confinement before
   allowing it to resume.

If ownership or safe representation is uncertain:

STOP.

Return `BLOCKED` or `PROCESS VIOLATION` rather than risking user work.

A recovery mutation does not retroactively make the original isolation failure
acceptable. Record the process violation in the execution report.

---

# TDD Enforcement

For tasks marked:

TDD: REQUIRED

use:

RED
→ GREEN
→ REFACTOR
→ REGRESSION

Do not reverse this sequence merely because the expected implementation seems obvious.

---

# RED Phase

Before modifying production behavior:

1. identify the planned behavior;
2. add or modify the focused test;
3. run the narrowest relevant test;
4. confirm it fails;
5. confirm the failure represents the missing or incorrect behavior.

Capture enough evidence to establish RED occurred.

---

# Valid RED

A valid RED demonstrates the planned behavioral gap.

Examples:

- expected HALF_DAY but received LATE;
- expected LATE_ENTRY but received entry_after_cutoff;
- expected authorization rejection but received success;
- expected duplicate suppression but received two writes;
- expected rollback but observed partial persistence.

---

# Invalid RED

The following do not establish RED:

- syntax error;
- malformed test;
- unrelated compilation failure;
- broken fixture;
- missing unrelated dependency;
- incorrect test setup;
- environment failure unrelated to behavior;
- existing unrelated test failure.

Fix test infrastructure problems first.

Then establish behavioral RED.

---

# Test Already Passes

If the planned RED test already passes before production changes:

STOP before claiming TDD success.

Investigate.

Possible explanations include:

- behavior already exists;
- Scout/Plan evidence is stale;
- test does not exercise the intended path;
- another implementation already changed behavior;
- requirement maps differently than expected.

Do not modify production code merely to force a RED phase.

Determine whether the Plan remains valid.

---

# RED Evidence

For each TDD-required task record:

**Test:**

Test added or modified.

**Command:**

Focused command executed.

**Expected failure:**

What should fail.

**Observed failure:**

What actually failed.

**RED status:**

VALID / INVALID / INCONCLUSIVE

Do not dump enormous logs unless needed.

Preserve the decisive evidence.

---

# GREEN Phase

After valid RED:

implement the smallest coherent production change that satisfies the planned behavior.

Do not:

- add unrelated features;
- refactor unrelated modules;
- redesign architecture;
- broaden API contracts;
- rewrite working systems.

Run the focused RED test again.

Confirm it passes.

---

# GREEN Evidence

Record:

**Command:**

...

**Result:**

PASS / FAIL

**Behavior established:**

...

If GREEN fails:

diagnose the failure.

Do not immediately broaden the implementation.

---

# REFACTOR Phase

Refactor only after GREEN.

Refactoring is optional.

Use it when:

- the implementation introduced harmful duplication;
- structure is unnecessarily confusing;
- localized cleanup materially improves maintainability;
- the Plan explicitly requires it.

Refactoring must preserve behavior.

Re-run relevant focused tests after refactoring.

Do not combine unrelated cleanup with the feature.

---

# REGRESSION Phase

After GREEN and any justified refactoring, run the planned regression scope.

Start narrow.

Broaden according to risk.

Possible sequence:

focused test
→ affected module tests
→ integration tests
→ broader project tests

Do not run expensive broad suites first when a focused test can catch the immediate defect faster.

---

# Regression Failure

If regression reveals a failure:

classify it.

## Caused by Implementation

Fix within scope through the owning worker.

Re-run:

focused test
→ relevant regression

## Existing Unrelated Failure

Verify that it predates the implementation when possible.

Record it.

Do not silently fix unrelated failures.

## Unclear Cause

Use `debugger` when diagnosis is non-obvious.

Do not guess.

---

# Bug-Fix Execution

For reproducible bugs, prefer:

REPRODUCE
→ RED
→ GREEN
→ REFACTOR
→ REGRESSION

The regression test should reproduce the bug before the fix whenever reasonably possible.

Do not accept:

"I changed the suspicious code and the bug probably went away."

---

# Characterization Before Change

When the Plan requires characterization tests:

1. write tests describing important existing behavior;
2. run them;
3. confirm they pass against current behavior;
4. clearly distinguish behavior being preserved from behavior intentionally changing;
5. then establish RED for the new behavior.

Characterization is not RED unless it expresses the intended changed behavior and fails appropriately.

---

# Boundary Execution

When the Plan specifies a boundary:

test:

- immediately before;
- exactly at;
- immediately after.

Do not implement only the exact requested example when adjacent boundary behavior is part of the invariant.

For time boundaries, respect the system's actual precision.

If the system truncates to minutes, do not pretend second-level behavior is independently represented.

---

# State-Machine Execution

For state-machine behavior, preserve the planned:

- valid states;
- valid transitions;
- forbidden transitions;
- terminal/finalized behavior;
- duplicate handling;
- out-of-order handling;
- retry behavior;
- restart behavior.

If implementation reveals an undocumented transition:

do not invent policy.

Return to Plan or Discover when the decision is product-significant.

---

# Database Execution

For persistent changes:

- use planned transaction boundaries;
- preserve constraints;
- preserve foreign-key semantics;
- preserve idempotency requirements;
- consider concurrent attempts;
- consider rollback behavior;
- follow migration ordering;
- do not silently rewrite existing data.

Never weaken a database constraint merely to make tests pass without confirming that the constraint itself is wrong.

---

# Migration Execution

For migrations:

1. inspect the migration state;
2. confirm compatibility assumptions;
3. implement the planned migration;
4. test against representative existing state when possible;
5. test application compatibility;
6. test failure/rollback behavior where meaningful;
7. do not destroy existing data casually.

Do not claim rollback safety unless it was established.

---

# Historical Data

When behavior changes a persisted:

- status;
- reason;
- label;
- derived value;
- interpretation;

follow the Plan's historical-data policy.

Do not silently:

- backfill;
- recompute;
- rewrite;
- normalize;

historical records unless authorized.

If ordinary existing system behavior may naturally recompute same-day or active records, report that distinction accurately.

Do not describe all old records as immutable if the runtime can legitimately update some of them.

---

# API Execution

When implementing an established API contract:

preserve:

- method;
- route;
- request shape;
- response shape;
- nullability;
- validation;
- errors;
- status codes;
- date/time representation.

Frontend and backend workers must use the same agreed contract.

If one side discovers the contract is insufficient:

STOP the affected integration work.

Return to Plan.

Do not let either worker silently invent additional fields.

---

# Security Execution

Security controls must be enforced at the appropriate trusted boundary.

Do not:

- move authorization solely to the frontend;
- weaken validation to satisfy tests;
- expose secrets in logs;
- introduce insecure fallback behavior;
- bypass authentication for convenience.

If implementation reveals an unclear privilege decision:

STOP.

Return to Plan or request user input as appropriate.

---

# Secret Findings

If an agent reports a possible exposed secret or credential:

do not automatically treat it as verified.

Classify it as:

UNVERIFIED SECURITY FINDING

until independently confirmed through authorized read-only inspection.

Do not print the secret value.

Do not copy the secret into reports.

Do not mix unrelated secret remediation into the current implementation.

If verified and immediately dangerous:

surface it prominently and recommend separate remediation.

If it directly blocks safe execution:

stop.

---

# Concurrency Execution

For concurrency-sensitive work:

do not infer correctness solely because tests passed once.

Follow planned invariants concerning:

- ownership;
- synchronization;
- channels;
- lock scope;
- cancellation;
- shutdown;
- duplicate execution;
- backpressure;
- retries.

Use deterministic tests or repeated/stress verification when justified.

If concurrency correctness remains uncertain:

use `concurrency-specialist`, `debugger`, Reviewer, or Oracle according to established escalation policy.

---

# Hardware Execution

For hardware-related changes:

separate where practical:

- pure parsing/domain behavior;
- device abstraction;
- OS/device integration;
- physical-device verification.

Automate deterministic behavior.

Do not claim physical hardware behavior was verified if no physical or equivalent integration test occurred.

State the limitation.

---

# Frontend Execution

For frontend behavioral changes:

test logic at the narrowest practical level.

Use appropriate:

- unit tests;
- component tests;
- integration tests;
- end-to-end tests.

Purely visual changes may use a TDD exception when automated RED is not meaningful.

Replacement verification must still be explicit.

Do not let frontend code invent backend semantics.

---

# TDD Exceptions

For:

TDD: EXCEPTION

before implementation record:

**Reason RED is impractical:**

...

**Replacement verification:**

...

Then perform the replacement verification.

Do not silently convert REQUIRED into EXCEPTION.

If the planned TDD requirement is impossible in practice:

STOP.

Return to the orchestrator.

The orchestrator decides whether the exception is legitimate or the Plan must change.

---

# TDD Not Applicable

For:

TDD: NOT APPLICABLE

do not create artificial tests solely to satisfy process.

Still perform appropriate verification.

Examples:

- inspect rendered text;
- validate configuration syntax;
- build affected documentation;
- check generated artifact.

---

# Specialist Reconsultation

Do not automatically re-run specialists during execution.

Reconsult a specialist when implementation reveals a domain question the Plan did not resolve.

Examples:

- unexpected SQLite locking behavior;
- newly discovered race;
- security boundary ambiguity;
- USB lifecycle behavior contradicts assumptions.

Ask a specific question.

Do not transfer implementation ownership to the specialist unless explicitly justified.

---

# Debugger Trigger

Use `debugger` when:

- RED behaves unexpectedly;
- GREEN repeatedly fails;
- regression failures are difficult to explain;
- root cause is unclear;
- behavior differs by environment;
- race behavior is suspected;
- database behavior contradicts expectations;
- the same implementation approach has failed more than once.

Debugger diagnoses before another patch attempt.

---

# Two-Attempt Rule

Do not repeat the same failed implementation strategy indefinitely.

After one serious failed attempt:

inspect evidence and correct the approach.

After two serious correction attempts without establishing correctness:

STOP routine worker iteration.

Use:

- debugger;
- relevant specialist;
- Reviewer;
- Oracle if established escalation criteria are met.

Do not create worker-review-fix loops without limit.

---

# Plan Contradiction

During execution, repository evidence may contradict the approved Plan.

Examples:

- planned function no longer exists;
- schema differs materially;
- behavior already exists;
- API contract is incompatible with actual consumers;
- a supposedly isolated change affects another invariant;
- migration assumptions are false.

If the contradiction is material:

STOP the affected task.

Do not silently redesign.

Return:

NEEDS REPLAN

with:

- planned assumption;
- observed evidence;
- affected task;
- consequence;
- recommended next step.

---

# Discovery Contradiction

If execution uncovers a contradiction in product understanding or desired behavior rather than implementation strategy:

return:

NEEDS DISCOVERY

Examples:

- user concept has multiple materially different meanings;
- newly discovered workflow changes the product requirement;
- existing behavior exposes an unresolved policy decision.

Do not resolve product policy in Execute.

---

# User Decision Required

If execution exposes a material user/product choice:

return:

NEEDS USER INPUT

State:

- exact decision;
- why implementation cannot safely choose;
- available options;
- recommendation when evidence supports one.

A recommendation is still not authorization.

---

# Out-of-Scope Findings

Execution may reveal unrelated defects.

Do not automatically fix them.

Record serious findings using:

## Out-of-Scope Finding

**Finding:**

...

**Evidence:**

...

**Confidence:**

VERIFIED / STRONGLY SUPPORTED / UNVERIFIED

**Potential consequence:**

...

**Current execution impact:**

...

**Recommended follow-up:**

...

If the finding does not prevent safe execution:

continue within scope.

If it invalidates the Plan:

stop and replan.

---

# Scope Expansion Test

Before making an unplanned change, ask:

1. Is this required to satisfy an existing task?
2. Is it required to preserve an invariant?
3. Is it a localized supporting change?
4. Does it alter product behavior?
5. Does it alter architecture?
6. Does it alter persistent semantics?
7. Would the user reasonably consider it a separate feature or bug fix?

If 4–7 indicate material expansion:

do not silently include it.

---

# Dependency Addition

Do not add a new dependency merely because it makes implementation easier.

Before adding one:

1. confirm existing dependencies do not already solve the problem;
2. confirm it is necessary;
3. evaluate maintenance/security impact;
4. confirm it fits the Plan.

Material dependency changes may require replanning.

---

# Generated Files

Do not manually edit generated files unless the repository expects it.

Modify the source of generation and regenerate using the established process.

Do not produce unrelated generated churn.

---

# Formatting Discipline

Avoid formatting unrelated files.

If an automatic formatter touches unrelated code:

inspect the diff.

Do not accept repository-wide formatting churn merely to fix one local formatting issue.

Prefer targeted formatting when supported.

Do not destroy pre-existing user changes while cleaning formatting.

---

# Formatting Availability

Do not make contradictory claims such as:

"rustfmt is unavailable"

and later:

"rustfmt produced repository-wide changes"

without reconciling the evidence.

Report what was actually verified.

Examples:

"rustfmt is available, but repository-wide `cargo fmt --check` fails because of pre-existing formatting drift."

or:

"rustfmt could not be executed in the worker environment; formatting was not independently verified there."

Tool/environment differences should be stated explicitly.

---

# Diff Inspection

After each meaningful implementation task:

inspect the diff.

Check for:

- unexpected files;
- accidental deletions;
- unrelated formatting;
- debug code;
- temporary logging;
- secrets;
- generated artifacts;
- unintended contract changes.

Do not wait until the end to discover broad accidental edits.

---

# Secrets

Never:

- commit secrets;
- print secrets unnecessarily;
- place credentials in tests;
- place production tokens in fixtures;
- copy local authentication values into documentation.

Use established secret/configuration mechanisms.

---

# Independent Verification Gate

When the Plan says:

Test Engineer: REQUIRED

worker completion does not complete execution.

After worker implementation and regression:

invoke `test-engineer`.

Provide:

- objective;
- requirements;
- invariants;
- acceptance criteria;
- changed files;
- worker test evidence;
- known risks;
- out-of-scope findings relevant to verification.

The Test Engineer independently challenges the implementation.

---

# Independent Verification Ownership

Test Engineer is not the production implementation owner.

It may add independent verification tests when appropriate if the established harness allows test-writing verification.

However:

- production fixes return to the owning worker;
- test additions must not silently redefine requirements;
- new tests that expose a defect become evidence for correction;
- independent tests should remain clearly attributable to verification.

Do not confuse Test Engineer-created tests with worker RED evidence.

A test written after GREEN cannot retroactively prove worker RED.

---

# Test Engineer Outcomes

Accept:

PASS

FAIL

INCONCLUSIVE

## PASS

Continue to Review when required.

## FAIL

Verify the finding.

If legitimate:

return the defect to the owning worker.

Then repeat relevant:

correction
→ focused test
→ regression
→ focused independent re-verification

## INCONCLUSIVE

Determine what evidence is missing.

Do not treat INCONCLUSIVE as PASS.

Escalate when risk justifies it.

---

# Reviewer Gate

When:

Reviewer: REQUIRED

do not declare execution complete before review.

Provide Reviewer:

- objective;
- requirements;
- invariants;
- approved Execution Plan;
- implementation diff;
- changed files;
- worker TDD evidence;
- regression results;
- Test Engineer findings when applicable;
- relevant specialist findings;
- known out-of-scope findings.

Reviewer should remain independent.

---

# Reviewer Outcomes

Expected:

- APPROVE
- APPROVE WITH NOTES
- REQUEST CHANGES
- ESCALATE

---

# APPROVE

Proceed toward completion.

---

# APPROVE WITH NOTES

Separate notes into:

## Non-Blocking Notes

May remain unresolved.

Record them.

Do not modify code solely to produce a cosmetically perfect report.

## Actionable Pre-Completion Notes

If a note should be corrected before completion:

return it to the owning worker.

Run focused verification afterward.

If the correction is behaviorally material:

re-run the relevant Test Engineer and Reviewer checks.

If purely mechanical:

focused regression/diff inspection may be sufficient.

---

# REQUEST CHANGES

Verify the findings.

For legitimate findings:

return corrections to the owning worker.

For incorrect findings:

reject them with evidence.

After corrections:

run affected tests and required independent verification.

Re-review the corrected area.

---

# ESCALATE

Strong Oracle trigger.

Do not let the worker simply overrule Reviewer on a high-risk dispute.

---

# Oracle Gate

Oracle is exceptional.

Use Oracle when established escalation criteria are met, such as:

- Reviewer returns ESCALATE;
- worker and Reviewer materially disagree on high-risk correctness;
- specialists conflict on high-consequence behavior;
- potential data loss remains unresolved;
- concurrency correctness remains uncertain;
- security architecture remains disputed;
- repeated serious fixes fail;
- irreversible decision lacks sufficient confidence.

Oracle remains read-only by default.

Oracle does not become implementation owner.

---

# Oracle Independence

Provide Oracle:

- objective;
- requirements;
- invariants;
- relevant evidence;
- competing positions;
- relevant code;
- test results.

Do not bias the request.

Avoid:

"The reviewer says this is broken. Confirm it."

Prefer:

"Evaluate whether this implementation preserves invariants X, Y, and Z under conditions A and B."

The orchestrator makes the final decision.

---

# Correction Ownership

Normal correction flow:

worker
→ worker tests
→ Test Engineer
→ Reviewer
→ finding
→ original owning worker
→ correction
→ focused regression
→ focused independent re-verification when required
→ re-review when required

The orchestrator coordinates this flow.

The orchestrator should not become the default patch author.

---

# Fix Loops

Avoid endless correction loops.

If significant uncertainty remains after serious correction attempts:

escalate rather than cycling.

Use the Two-Attempt Rule.

---

# Orchestrator Verification

The orchestrator may independently run read-only verification commands such as:

- focused tests;
- full test suites;
- type checks;
- lint checks;
- `git diff`;
- `git diff --check`;
- status inspection.

This does not violate one-writer discipline because verification commands do not modify source.

Be careful with commands that auto-fix or auto-format.

A verification command must not unexpectedly become a write operation.

---

# Final Post-Correction Verification

If any source or test file changes after:

- Test Engineer PASS;
- Reviewer verdict;
- full regression run;

then determine what verification became stale.

At minimum, after the final modification:

- inspect the final diff;
- run relevant focused tests;
- run required regression scope.

If the modification is behaviorally material:

repeat affected independent verification and review.

Do not claim final evidence that predates the final code.

---

# Evidence Freshness

Evidence applies to the code state that produced it.

If code changes afterward, earlier evidence may become stale.

Examples:

Reviewer APPROVE
→ source changes
→ old approval may no longer cover final code.

Test Engineer PASS
→ behavioral change
→ old PASS may no longer cover final behavior.

Use judgment proportional to the change.

For trivial formatting-only corrections, full independent re-review may be unnecessary.

But focused final checks are still required.

---

# Completion Evidence

An implementation task is COMPLETE only when its required evidence exists.

For TDD-required tasks:

- valid RED established;
- GREEN established;
- required refactor complete or explicitly unnecessary;
- regression passed;
- diff inspected;
- task requirements satisfied.

For TDD exceptions:

- exception was legitimate;
- replacement verification completed;
- diff inspected;
- requirements satisfied.

---

# TDD Evidence Provenance

Distinguish evidence by source.

Example:

Worker reported RED.

Orchestrator independently confirmed GREEN/regression.

Test Engineer independently added additional verification tests.

Reviewer independently ran the full suite.

Do not imply the orchestrator personally observed RED when it only received worker evidence.

Do not imply Test Engineer tests were part of the original RED if they were created after implementation.

---

# Execution Completion Gate

Execution is COMPLETE only when all applicable conditions are true:

- Plan was explicitly READY FOR EXECUTION before writes began;
- all blocking decisions were resolved;
- all planned implementation tasks complete;
- dependencies respected;
- requirements implemented;
- invariants preserved;
- required TDD evidence exists;
- relevant regressions pass;
- Test Engineer PASS obtained when required;
- Reviewer approval obtained when required;
- legitimate required findings addressed;
- final evidence covers the final code state;
- no unresolved blocking contradiction remains;
- known verification limitations are documented.

Code written is not sufficient.

---

# Invalid Execution Start

If writes occurred before the READY FOR EXECUTION barrier was satisfied:

do not pretend the process was compliant.

Report:

PROCESS VIOLATION: EXECUTION STARTED BEFORE READY GATE

Then:

1. stop further unapproved changes;
2. preserve evidence;
3. identify what was changed;
4. obtain the missing decision/Plan authorization;
5. determine whether changes should be retained, reverted, or revalidated;
6. do not label the original execution process compliant.

Passing tests do not retroactively erase the process violation.

---

# Existing Work From a Prior Invalid Execution

If Execute v1.1 encounters repository changes created by an earlier execution that violated the readiness gate:

do not automatically revert them.

Treat them as existing work.

First determine:

- what changed;
- whether the user wants to retain it;
- whether requirements are now resolved;
- whether the implementation matches the eventual approved Plan;
- whether evidence remains valid.

The framework should preserve user work while being honest about provenance.

---

# Execution Status

Choose exactly one final status.

## EXECUTION COMPLETE

Use only when all required implementation, verification, review, and readiness gates have passed.

## PARTIALLY COMPLETE

Use when safe completed work exists but one or more planned tasks remain unfinished without invalidating completed work.

## NEEDS REPLAN

Use when technical implementation assumptions or architecture in the Plan are materially invalid.

## NEEDS DISCOVERY

Use when product understanding or scope assumptions are materially invalid.

## NEEDS USER INPUT

Use when a material product decision blocks safe continuation.

## BLOCKED

Use when an external prerequisite prevents continuation.

## FAILED

Use when execution could not establish correctness and no safe continuation is currently available.

## PROCESS VIOLATION

Use when implementation writes occurred despite a required readiness or authorization gate not being satisfied.

Do not report EXECUTION COMPLETE if required independent verification or review has not occurred.

Do not hide a process violation merely because the resulting code passes tests.

---

# Execution Report

Return an Execution Report using this structure.

## Objective

What was implemented or attempted.

---

## Readiness Gate

**Referenced Plan Status:**

...

**Blocking Decisions Before Write:**

None / list them.

**Write Authorized:**

YES / NO

If NO and writes occurred:

PROCESS VIOLATION.

---

## Plan

Reference the approved Execution Plan.

State any authorized deviations.

If none:

No material Plan deviations.

---

## Tasks

For each task:

### Task N — `<name>`

**Owner:**

...

**Status:**

COMPLETE / FAILED / BLOCKED

**Files changed:**

- ...

**Implementation:**

Concise summary.

### TDD Evidence

**TDD:** REQUIRED / NOT APPLICABLE / EXCEPTION

When REQUIRED:

#### RED

**Test:**

...

**Command:**

...

**Expected failure:**

...

**Observed failure:**

...

**Evidence source:**

worker / orchestrator / other

**Status:**

VALID / INVALID / INCONCLUSIVE

#### GREEN

**Command:**

...

**Result:**

...

**Behavior established:**

...

#### REFACTOR

**Performed:**

...

or:

None required.

#### REGRESSION

**Commands:**

...

**Results:**

...

When EXCEPTION:

**Reason:**

...

**Replacement verification:**

...

**Result:**

...

**Completion evidence:**

...

---

## Independent Verification

**Test Engineer:** REQUIRED / RECOMMENDED / NOT REQUIRED

If performed:

**Result:** PASS / FAIL / INCONCLUSIVE

**Tests/checks added or performed:**

...

**Findings:**

...

**Corrections required:**

...

Clearly distinguish independent verification tests from worker RED tests.

---

## Review

**Reviewer:** REQUIRED / RECOMMENDED / NOT REQUIRED

If performed:

**Verdict:**

APPROVE / APPROVE WITH NOTES / REQUEST CHANGES / ESCALATE

**Blocking findings:**

...

**Non-blocking notes:**

...

**Corrections made:**

...

**Correction owner:**

...

---

## Oracle

**Oracle:** NOT USED

or:

**Oracle:** USED

**Reason:**

...

**Assessment:**

...

**Orchestrator decision:**

...

---

## Final Verification

State checks run against the final code state.

Examples:

- focused tests;
- full backend suite;
- frontend typecheck;
- diff inspection;
- `git diff --check`.

Do not list stale pre-correction evidence as final verification without qualification.

---

## Tests and Checks

List commands actually executed and results.

Do not claim commands were run when they were not.

---

## Out-of-Scope Findings

For each serious finding:

### Finding N — `<name>`

**Confidence:**

VERIFIED / STRONGLY SUPPORTED / UNVERIFIED

**Evidence:**

...

**Potential consequence:**

...

**Current execution impact:**

...

**Recommended follow-up:**

...

If none:

None.

---

## Plan Deviations

List only authorized or unavoidable deviations.

For each:

**Deviation:**

...

**Authorization:**

...

**Reason:**

...

**Impact:**

...

If none:

None.

---

## Remaining Risks

State known residual risks or verification limitations.

If none are known:

No known material residual risks identified.

Do not claim zero risk.

---

## Process Compliance

State:

**Ready-before-write:** YES / NO

**Explicit decisions resolved:** YES / NO

**One-writer discipline preserved:** YES / NO

**TDD sequence preserved:** YES / NO / NOT APPLICABLE

**Independent verification completed when required:** YES / NO / NOT REQUIRED

**Review completed when required:** YES / NO / NOT REQUIRED

If any required item is NO:

do not silently present the process as fully compliant.

---

## Execution Status

Choose exactly one:

- EXECUTION COMPLETE
- PARTIALLY COMPLETE
- NEEDS REPLAN
- NEEDS DISCOVERY
- NEEDS USER INPUT
- BLOCKED
- FAILED
- PROCESS VIOLATION

Explain briefly.

---

# Handoff to Verify

When execution reaches:

EXECUTION COMPLETE

the resulting implementation and evidence become input to the `verify` workflow.

Verify should not assume correctness merely because Execute succeeded.

Verify independently evaluates whether the delivered system satisfies:

- requirements;
- acceptance criteria;
- invariants;
- relevant failure modes;
- integration behavior.

Verify may reuse evidence but must assess the completed change as a whole.

---

# Handoff After Process Violation

If status is:

PROCESS VIOLATION

do not continue automatically to Verify as though normal execution succeeded.

First resolve the governance issue.

Possible outcomes include:

- user explicitly accepts the decisions and existing implementation;
- Plan is updated and the implementation is revalidated against it;
- unauthorized changes are reverted;
- implementation is partially retained with explicit authorization.

Only after a valid execution contract exists should normal workflow resume.

---

# Failure Honesty

Never claim:

- the Plan was ready when it was not;
- unresolved recommendations were user decisions;
- RED occurred when it did not;
- tests passed when they were not run;
- hardware was verified when it was not available;
- concurrency is safe merely because one test passed;
- migration rollback works when it was not established;
- Reviewer approved final code if code materially changed afterward;
- Test Engineer passed final behavior if behavior changed afterward;
- a security finding is verified when it is only agent-reported;
- a bug is fixed without evidence.

Unknown is better than fabricated certainty.

---

# Execute Self-Check

Before the first write, ask:

1. Is the Plan explicitly READY FOR EXECUTION?
2. Are all blocking decisions actually resolved?
3. Am I inferring user acceptance from generic execution language?
4. Is the correct writer assigned?
5. Is TDD classification known?

If answer 1 or 2 is no:

STOP.

If answer 3 is yes:

STOP.

Before completion, ask:

1. Did RED genuinely precede GREEN where required?
2. Does final regression evidence cover the final code?
3. Did required Test Engineer verification occur?
4. Did required Reviewer review occur?
5. Were corrections returned to the owning worker?
6. Did any code change after verification/review?
7. Are serious out-of-scope findings accurately classified?
8. Did any process violation occur?

Do not report EXECUTION COMPLETE until required gates are satisfied.

---

# Execution Completion Rule

Execute succeeds when an explicitly approved Plan has been implemented with evidence while preserving scope, decisions, ownership, and invariants.

The goal is not:

"produce code."

The goal is:

"produce the approved behavior, prove the important parts, preserve decision authority, expose uncertainty, and stop rather than improvise when the contract becomes invalid."

For behavioral work:

RED
→ GREEN
→ REFACTOR
→ REGRESSION

For significant work:

implementation evidence
→ independent verification
→ review

For unresolved decisions:

STOP
→ resolve through Plan
→ READY FOR EXECUTION

For serious uncertainty:

STOP
→ investigate
→ replan or escalate

Correctness outranks momentum.

Authorization outranks assumption.
