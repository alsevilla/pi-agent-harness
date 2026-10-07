> Historical reference only. The v1.2.1 global policy and compact skill govern
> routing, role selection, authority, and whether a formal plan or independent
> gate is needed. Old universal phase/agent/READY FOR EXECUTION wording below
> applies only when that gate is selected under current policy. This archive
> cannot impose a new gate, waive a blocker, or expand authority. Read targeted
> sections only; never auto-import or preload the complete archive.

# Extended guidance (archived from pre-cost-optimized harness)

# Debug

## Named-agent execution contract

This skill runs through its named custom agent when invoked from the main
conversation. Its frontmatter uses `context: fork` and `background: false`:
the main conversation must wait for the role's returned evidence before advancing.
If launched directly through Agent, use the preloaded procedure without invoking
this skill again. Never spawn a helper or perform another lifecycle role.

### Task packet

Invocation arguments: $ARGUMENTS

For a forked invocation, use the supplied arguments as the task packet. When this
procedure is preloaded into a directly dispatched agent, use the Agent delegation
prompt instead; a literal unexpanded arguments placeholder is not a task.
You do not have access to the main conversation history. Require an identified
repository/candidate, the symptom or approved contract, scope, authority, mutation
boundary, relevant evidence, and requested outcome. Read provided authoritative
paths as needed. If essential context is absent, return BLOCKED/UNKNOWN with the
missing input rather than inventing requirements or searching unrelated projects.

Remain read-only toward the active candidate. Use isolated disposable artifacts
only where the procedure explicitly permits them. Return the named role, scope,
candidate identity where applicable, evidence actually examined, commands/tests
actually run and outcomes, confidence, disposition, blockers, and recommended
next handoff. Do not claim implementation, downstream verification, or approval
that you did not perform. The main session owns subsequent routing and writes.

Systematically determine why observed behavior differs from expected behavior.

Debug is a diagnostic workflow.

Its primary question is:

> What is actually causing this failure?

Not:

> What change might make the symptom disappear?

Normal defect path:

OBSERVED FAILURE
→ DEBUG
→ REPRODUCE
→ LOCALIZE
→ HYPOTHESIZE
→ FALSIFY
→ ROOT CAUSE
→ CORRECTION CONTRACT
→ PLAN or EXECUTE
→ VERIFY

Debug does not replace Plan or Execute.

---

# Core Principle

Do not patch before understanding.

A symptom disappearing after a code change does not prove that the change addressed the root cause.

Prefer:

evidence
→ hypothesis
→ experiment
→ conclusion

over:

guess
→ edit
→ rerun
→ hope

---

# Debug vs Discover

Discover asks:

> What is true about this feature/problem space before planning work?

Debug asks:

> Why is this observed behavior occurring?

Use Discover when requirements, product behavior, or intended design are unclear.

Use Debug when there is a concrete failure, regression, anomaly, or reproducible unexpected behavior to explain.

If debugging reveals that expected behavior itself is undefined:

stop.

Return to Discover or Plan.

---

# Debug vs Plan

Debug establishes:

- causal mechanism;
- trigger;
- first divergence;
- contributing factors;
- correction constraints.

Plan owns unresolved decisions about:

- product behavior;
- persistence semantics;
- API behavior;
- compatibility;
- audit behavior;
- retry/replay semantics;
- migrations;
- security policy;
- architectural tradeoffs.

A confirmed root cause does not give Debug authority to make these decisions.

---

# Debug vs Execute

Debug:

- reproduces;
- investigates;
- traces;
- isolates;
- compares;
- measures;
- forms hypotheses;
- falsifies hypotheses;
- establishes root cause;
- defines correction constraints.

Execute:

- changes production behavior;
- performs TDD implementation;
- owns correction;
- runs implementation-time gates.

Debug diagnoses.

Execute fixes.

---

# Debug vs Verify

Verify asks:

> Does the delivered result satisfy the approved contract?

Debug asks:

> Why did this particular behavior fail?

Verify may discover a defect.

Debug explains it.

Possible flow:

VERIFY FAIL
→ DEBUG
→ PLAN if decisions remain
→ EXECUTE
→ VERIFY

If Verify already established the root cause strongly enough that correction is fully determined, Debug may be unnecessary.

---

# Read-Only Production Barrier

Debug is read-only toward production behavior by default.

Do not modify active production source merely to test a theory.

Do not:

- patch business logic;
- change API behavior;
- change database semantics;
- change migrations;
- alter production configuration;
- weaken validation;
- change dependencies;
- modify active repository tests to force a result.

Diagnosis must not silently become implementation.

---

# Active Repository Read-Only Discipline

The active repository should remain unchanged by Debug unless the user explicitly authorizes a separate implementation workflow.

This includes:

- production source;
- tests;
- migrations;
- manifests;
- lockfiles;
- configuration;
- generated files;
- scripts.

If diagnostic code is needed:

prefer disposable isolation.

---

# Diagnostic Experiments

Debug may perform disposable diagnostic experiments.

Allowed examples:

- temporary scripts;
- temporary harnesses;
- isolated worktrees;
- isolated test files;
- temporary databases;
- temporary configuration copies;
- temporary logging/instrumentation outside the active repository;
- read-only DB queries;
- tracing;
- repeated test runs;
- isolated benchmarks;
- controlled fault injection.

These artifacts exist to establish evidence.

They are not automatically product artifacts.

---

# Active Repository Snapshot

At Debug start, capture enough state to know what is being diagnosed.

Prefer:

- current branch/base;
- git status;
- changed files;
- relevant diff;
- repository fingerprint when useful;
- runtime/environment information relevant to the failure.

This prevents confusing:

existing changes

with:

debug-created changes.

---

# Repository Immutability Check

At Debug completion, verify that the active repository still matches the intended starting state.

If it changed unexpectedly:

determine:

- what changed;
- who changed it;
- whether evidence became stale;
- whether the change was diagnostic or external.

Do not silently absorb Debug-created source/test changes.

---

# Preserve Existing Work

The repository may already be dirty.

Do not:

- reset;
- checkout over user work;
- stash without authorization;
- clean untracked files casually;
- revert existing changes.

Treat existing modifications as evidence and context.

If isolation is needed:

use a temporary worktree or temporary copy.

---

# Entry Classification

Classify the debug request.

## REPRODUCIBLE DEFECT

Known steps reliably produce the failure.

## INTERMITTENT / FLAKY

Failure occurs nondeterministically.

## REGRESSION

Behavior previously worked and now fails.

## ENVIRONMENTAL

Failure appears tied to machine, OS, dependency, configuration, cache, external service, or runtime environment.

## PERFORMANCE

Behavior is functionally correct but violates latency/throughput/resource expectations.

## CONCURRENCY

Failure depends on timing, ordering, simultaneous work, cancellation, shutdown, or races.

## HARDWARE / INTEGRATION

Failure involves devices, drivers, OS integration, external services, or physical behavior.

## UNKNOWN

Not enough evidence yet.

The classification may change as evidence develops.

---

# Expected vs Actual

Before investigation, establish:

## Expected

What should happen?

Source the expectation from:

- approved Plan;
- explicit user decision;
- authoritative project specification;
- documented requirement;
- existing invariant;
- established test;
- API contract.

## Actual

What happened?

Use:

- failure output;
- logs;
- assertion;
- DB state;
- runtime response;
- observed behavior.

Do not debug against an invented expectation.

---

# Expectation Authority

Use the established authority order.

Normally:

user decisions
> approved Plan
> authoritative project specification
> confirmed project requirements
> repository behavior/tests
> agent assumptions

A failing test does not automatically define correct product behavior.

Current implementation does not automatically redefine the requirement.

---

# Requirement Ambiguity

If expected behavior is ambiguous:

do not choose a product rule while debugging.

Report:

REQUIREMENT AMBIGUITY

Then route to:

DISCOVER

or:

PLAN

Debug cannot establish root cause relative to an undefined target.

---

# Reproduce First

Before explaining a defect, attempt to reproduce it when practical.

Record:

- exact command/action;
- environment;
- input;
- relevant configuration;
- observed result;
- frequency.

Possible outcomes:

## REPRODUCED

The failure occurred under controlled observation.

## NOT REPRODUCED

The reported failure did not occur.

## INTERMITTENT

Failure occurred inconsistently.

## BLOCKED

Environment or dependency prevents reproduction.

Do not claim root cause merely from reading code when reproducible runtime evidence is reasonably available.

---

# Minimal Reproduction

Reduce the failure to the smallest useful reproducer.

Remove irrelevant:

- UI layers;
- network hops;
- unrelated records;
- unrelated configuration;
- unrelated concurrency;
- unrelated services.

But do not reduce away the condition causing the defect.

The goal is:

small enough to reason about,
real enough to preserve the failure.

---

# Preserve Original Failure

Do not replace the original failure with a different easier failure and pretend they are equivalent.

For example:

original:
real scan reopens finalized attendance

reduced:
pure engine function returns OPEN

These may be related, but the reduced case must still preserve the mechanism under investigation.

State exactly what the reproducer proves.

---

# Baseline Comparison

For regressions, establish a baseline when practical.

Compare:

- current code vs known-good commit;
- changed configuration vs previous configuration;
- failing input vs nearby passing input;
- affected platform vs unaffected platform.

Use isolated environments.

Do not modify the active worktree to recreate baseline behavior.

---

# Alternate-State Isolation

When testing another commit/branch/state:

use:

- temporary worktree;
- isolated build artifacts;
- isolated DB;
- isolated generated files.

Do not contaminate current-state evidence.

---

# Cargo Isolation

For Rust alternate-state debugging:

use a unique `CARGO_TARGET_DIR`.

Conceptually:

CARGO_TARGET_DIR=<unique-temp-target> cargo test ...

Do not share build artifacts between baseline and current-state worktrees when stale artifacts could distort results.

Do not casually run broad `cargo clean` against the user's primary build environment.

---

# Build Cache Safety

Prefer:

- isolated target directories;
- targeted temporary builds;
- fresh temporary databases;
- fresh processes.

Avoid destructive cleanup of primary caches merely to test a hypothesis.

If destructive cleanup is genuinely required:

state what will be removed and why before doing it.

---

# Observation Before Hypothesis

Collect the smallest set of facts needed before forming theories.

Examples:

- exact failing assertion;
- relevant state before operation;
- relevant state after operation;
- function/path executed;
- SQL row before/after;
- HTTP status/body;
- timestamps;
- event ordering;
- configuration values.

Do not collect everything indiscriminately.

Collect evidence that separates plausible causes.

---

# Verified / Inferred / Unknown

Keep these distinct.

## VERIFIED

Direct evidence establishes the fact.

## INFERRED

Evidence strongly suggests it but does not directly establish it.

## UNKNOWN

Not established.

Never present an inference as verified root cause.

---

# Hypothesis Ledger

Maintain a small hypothesis set.

For each:

## Hypothesis

What could cause the symptom?

## Supporting Evidence

What makes it plausible?

## Contradicting Evidence

What argues against it?

## Discriminating Test

What result would distinguish it from alternatives?

## Status

OPEN / SUPPORTED / FALSIFIED / ROOT CAUSE

Avoid maintaining ten vague theories.

Prefer 2–4 plausible hypotheses.

---

# Falsification First

Prefer experiments capable of proving a hypothesis wrong.

Bad:

> Run the same failing test and see if it fails again.

Better:

> If stale Cargo artifacts cause the failure, an isolated target directory should eliminate it without source changes.

A hypothesis that explains everything after the fact but predicts nothing is weak.

---

# One Variable at a Time

When practical, change one diagnostic variable at a time.

Examples:

- same source, fresh DB;
- same source, isolated target;
- same input, different boundary;
- same event, override absent/present;
- same test, serialized execution.

Do not simultaneously change:

source + DB + configuration + environment

and then claim to know which fixed the symptom.

---

# No Shotgun Debugging

Do not make multiple speculative production changes such as:

- add retry;
- increase timeout;
- reorder calls;
- add sleep;
- clear cache;
- change transaction;
- alter validation;

and then infer root cause because the symptom disappears.

That is implementation by guess.

---

# Counterfactual Experiments

A counterfactual experiment may strengthen causal evidence.

Example:

> If lifecycle fields are preserved in an isolated copy, does the row still reopen?

Counterfactual experiments:

- must remain disposable;
- must not modify the active repository;
- do not become the production fix;
- should change the smallest relevant variable.

A successful counterfactual strengthens a diagnosis.

It does not authorize implementation.

---

# Instrumentation

Instrumentation is useful when existing evidence is insufficient.

Prefer:

- temporary external tracing;
- existing logging controls;
- temporary isolated harnesses;
- debugger/breakpoint facilities;
- read-only state inspection.

If source instrumentation is genuinely necessary:

use an isolated worktree/copy.

Do not silently edit the active production repository.

---

# Logs

Logs are evidence, not truth.

Check:

- timestamp;
- timezone;
- process;
- request/event identity;
- log level;
- ordering;
- buffering;
- missing context.

Do not assume log order always equals execution order under concurrency.

---

# Database Debugging

For persistence failures inspect, as relevant:

- transaction boundaries;
- connection behavior;
- constraints;
- triggers;
- affected rows;
- row state before/after;
- query ordering;
- retry behavior;
- idempotency;
- finalization/state fields;
- timestamps.

Prefer temporary DB copies or test DBs.

Do not experiment destructively against production data.

---

# SQLite Debugging

When SQLite is involved, consider:

- WAL behavior;
- busy timeout;
- transaction mode;
- connection-specific PRAGMAs;
- foreign_keys state;
- lock contention;
- checkpoint behavior;
- uniqueness;
- concurrent writers.

Use `sqlite-specialist` when the issue requires deeper SQLite reasoning.

---

# State-Machine Debugging

For state transitions reconstruct:

1. initial state;
2. input/event;
3. guard/condition;
4. selected transition;
5. persisted state;
6. subsequent recalculation;
7. terminal/finalization rules.

Identify the first point where actual state diverges from expected state.

That point is usually more valuable than the final incorrect output.

---

# First Divergence Principle

Find the earliest observable point where:

expected state != actual state.

Do not focus only on the final symptom.

Example:

dashboard wrong

may originate from:

event classification
→ attendance calculation
→ persistence
→ API mapping
→ frontend display.

If persistence is already wrong, the dashboard is not the root cause.

---

# Boundary Debugging

For time/threshold defects inspect:

- immediately before;
- exactly at;
- immediately after;
- precision/truncation;
- timezone;
- configured vs hard-coded boundary;
- inclusive vs exclusive comparisons.

Do not assume:

`>=`

and:

`>`

are interchangeable.

---

# Clock-Dependent Failures

Separate:

- event timestamp source;
- application clock;
- database clock;
- OS clock;
- timezone conversion;
- truncation;
- configured schedule.

If there is no injectable clock:

record the testability limitation.

Do not introduce a clock seam during Debug merely to improve architecture.

That belongs to planned implementation work.

---

# Flaky Test Debugging

For intermittent tests determine whether flakiness comes from:

- real product race;
- wall clock;
- test ordering;
- shared DB;
- shared files;
- shared ports;
- global state;
- build artifacts;
- random data;
- asynchronous cleanup;
- external dependency.

Run repeated tests only when repetition helps discriminate causes.

"Passed 20 times" does not prove absence of a race.

---

# Test Defect vs Product Defect

A failing test can be wrong.

Before declaring production defect, compare the test to:

- approved contract;
- current architecture;
- fixture validity;
- environment assumptions.

Possible conclusions:

PRODUCT DEFECT

TEST DEFECT

ENVIRONMENT DEFECT

REQUIREMENT AMBIGUITY

Do not weaken a correct test to make production pass.

Do not modify correct production code to satisfy an invented test expectation.

---

# Concurrency Debugging

For concurrency failures reconstruct:

- actors/tasks;
- shared state;
- operation ordering;
- locks;
- transactions;
- cancellation;
- retries;
- shutdown.

Prefer deterministic synchronization experiments over arbitrary sleeps.

Use `concurrency-specialist` when necessary.

---

# Finalization / Concurrent Writer Rule

When diagnosis involves lifecycle transitions such as:

OPEN → FINALIZED

and another writer may update the same row:

do not assume a read-then-write guard is sufficient.

Consider whether:

1. writer A reads OPEN;
2. writer B finalizes;
3. writer A later writes stale OPEN state.

If that interleaving can violate the invariant:

the eventual correction may require atomic database enforcement, transactional guards, conditional updates, or another concurrency-safe design.

Debug identifies this constraint.

Plan chooses the design.

---

# Performance Debugging

For performance problems:

measure before explaining.

Establish:

- workload;
- baseline;
- latency distribution;
- throughput;
- CPU;
- memory;
- DB time;
- I/O;
- queue depth;
- contention.

Do not optimize based on intuition alone.

Use `performance-specialist` when warranted.

---

# Hardware / Integration Debugging

Separate layers:

physical device
→ OS/driver
→ input adapter
→ parser
→ domain event
→ persistence
→ downstream behavior

Find the first failing layer.

Do not blame hardware because the final application state is wrong.

Use `hardware-integration` when necessary.

---

# Frontend Debugging

Separate:

UI state
→ client logic
→ request
→ API response
→ backend behavior

Inspect the actual response before assuming rendering is wrong.

Use `frontend-worker` only during Execute.

Use relevant read-only specialist reasoning during Debug if needed.

---

# Security Debugging

Security defects require careful scope.

Do not expose secrets while diagnosing.

Do not disable controls as a debugging shortcut.

Use `security-specialist` when relevant.

If diagnosis reveals exploitable behavior:

report impact precisely without unnecessarily exposing sensitive details.

---

# Environment Classification

When behavior changes without source changes, investigate environment.

Possible causes:

- stale build artifacts;
- toolchain version;
- dependency state;
- environment variables;
- working directory;
- OS differences;
- timezone;
- permissions;
- port conflicts;
- cache;
- external service.

Do not label a failure "environmental" merely because it is inconvenient.

Establish evidence.

---

# Cache Hypothesis

If cache/build contamination is suspected:

prefer a fresh isolated cache/target.

Do not immediately delete the primary cache.

A strong experiment is:

same source
+ isolated cache
→ different result

without source changes.

---

# Two-Attempt Rule

Do not endlessly try variations.

For a particular diagnostic hypothesis:

normally allow at most two meaningful experiments before reassessing.

If repeated experiments do not discriminate causes:

change the hypothesis or escalate.

This prevents thrashing.

---

# Debugger Agent

Use `debugger` when:

- reproduction is non-trivial;
- multiple layers are involved;
- failure persists after obvious checks;
- root cause is uncertain;
- intermittent behavior needs systematic isolation.

Give it:

- expected behavior;
- actual behavior;
- reproduction;
- known evidence;
- relevant changed files;
- current hypotheses;
- explicit read-only constraint;
- requirement to use disposable isolation for experiments.

Do not ask:

> Fix this.

Ask:

> Determine root cause.

---

# Debugger Agent Independence

The debugger agent's report is evidence.

Do not blindly accept it.

The orchestrator should independently verify material claims when practical, especially:

- root-cause location;
- repository integrity;
- destructive side effects;
- important writer enumeration;
- critical persistence behavior.

Do not duplicate every experiment merely for ceremony.

---

# Specialist Escalation

Use specialists when evidence points into their domain.

Examples:

sqlite-specialist
→ locking, transactions, WAL, constraints

concurrency-specialist
→ races, ordering, cancellation

security-specialist
→ auth/authz/input boundaries

performance-specialist
→ throughput/latency/resource bottlenecks

hardware-integration
→ USB/device/OS integration

api-specialist
→ protocol/contract behavior

Do not invoke specialists mechanically.

---

# Specialist Timing

Debug may identify that specialist input is required for the correction design without invoking that specialist immediately.

Example:

Root cause is confirmed.

Correction must atomically preserve FINALIZED against concurrent scans.

That may justify:

sqlite-specialist
+ concurrency-specialist

during Plan.

Do not turn Debug into architecture design merely because specialists exist.

---

# Reviewer During Debug

Reviewer is normally unnecessary during diagnosis.

Use Reviewer when:

- root-cause conclusion has broad architectural consequences;
- diagnosis contradicts previous review;
- proposed correction crosses important boundaries;
- high-risk reasoning needs independent challenge.

Reviewer remains read-only.

---

# Oracle During Debug

Oracle is exceptional.

Use when:

- multiple plausible root causes survive serious falsification;
- specialists disagree materially;
- high-risk data integrity remains unresolved;
- security/concurrency reasoning remains disputed;
- evidence conflicts and experiments cannot settle it.

Do not invoke Oracle because debugging is merely difficult.

---

# Root Cause Standard

A root cause should explain:

1. why the failure occurs;
2. why the observed evidence looks the way it does;
3. why nearby passing cases pass;
4. what condition triggers the failure;
5. what correction class would remove the cause.

A statement such as:

> There is probably a race.

is not root cause.

Better:

> Two scan handlers read the OPEN daily row before either transaction persists dismissal; both then calculate from stale state, and the second write overwrites the first because the update has no state/version guard.

That is falsifiable and actionable.

---

# Root Cause Confidence

Use:

## CONFIRMED

Direct evidence establishes the causal mechanism.

## STRONGLY SUPPORTED

Evidence strongly supports the mechanism, but one causal link remains indirect.

## POSSIBLE

Plausible but insufficiently demonstrated.

Do not call POSSIBLE a root cause.

If only POSSIBLE causes remain:

Debug status is INCONCLUSIVE.

---

# Contributing Factors

Separate root cause from contributing factors.

Example:

Root cause:
shared Cargo target reused incompatible baseline artifacts.

Contributing factor:
temporary worktree assumed build isolation.

Trigger:
baseline RED reconstruction.

Symptom:
current dashboard test unexpectedly executed stale behavior.

This distinction improves corrective action.

---

# Fix Validation Is Not Root-Cause Proof

A proposed fix making the test green supports the diagnosis.

It does not automatically prove it.

Root cause should already have evidence independent of the production fix whenever practical.

---

# Correction Contract

After root cause is established, define what downstream work must correct.

The correction contract should state:

## Root Cause

...

## Required Behavioral Correction

...

## Must Preserve

...

## Relevant Boundaries

...

## Regression Reproduction

...

## TDD Expectation

...

## Scope

...

## Out of Scope

...

## Risk

...

## Open Decisions

...

Do not prescribe a large implementation unless architecture requires it.

Give downstream workflows the constraints, not unnecessary code instructions.

---

# Root Cause vs Correction Readiness

A confirmed root cause does not automatically authorize Execute.

After establishing root cause, classify correction readiness.

---

# READY FOR EXECUTION

Use only when all are true:

- expected behavior is authoritative;
- correction semantics are fully determined;
- no material product decision remains;
- no material persistence-policy decision remains;
- no unresolved API/compatibility decision remains;
- audit/retry/replay semantics are sufficiently defined;
- scope is clear;
- required invariants are known;
- implementation can proceed without the worker choosing product policy.

Route:

DEBUG
→ EXECUTE

---

# READY FOR PLANNING

Use when correction requires unresolved decisions about:

- product behavior;
- event acceptance/rejection;
- persistence semantics;
- API semantics;
- compatibility;
- audit behavior;
- legacy side effects;
- SMS/notification behavior;
- retry behavior;
- replay/idempotency behavior;
- migration/backfill behavior;
- security policy;
- concurrency strategy;
- architectural tradeoffs.

Route:

DEBUG
→ PLAN

Do not let Debug choose these decisions merely to make implementation possible.

---

# Correction Readiness Principle

Technical certainty and product certainty are different.

It is possible to have:

ROOT CAUSE CONFIRMED

while also having:

CORRECTION READINESS: READY FOR PLANNING

This is not contradictory.

It means:

> We know why it is broken, but we have not yet decided exactly what correct behavior should be in every affected path.

---

# Product Decision Restraint

When correction choices exist, Debug may:

- enumerate options;
- explain consequences;
- identify what the specification implies;
- identify which choice is unresolved.

Debug must not silently choose.

Example:

A late scan reaches a FINALIZED record.

Possible policies:

- reject scan;
- accept event for audit but do not recalculate;
- accept and mark anomaly;
- another approved behavior.

If authoritative requirements do not resolve this:

route to Plan.

---

# Architectural Decision Restraint

Debug may establish a correction constraint such as:

> The guard must be atomic with the database write.

That does not mean Debug should choose:

- transaction structure;
- conditional UPDATE;
- version column;
- trigger;
- locking strategy.

Those are Plan/design decisions unless already established.

---

# Bug-Fix TDD Handoff

For behavioral bugs, Execute should normally use:

REPRODUCE
→ RED
→ GREEN
→ REFACTOR
→ REGRESSION

Debug's reproduction is diagnostic evidence.

Execute should turn the confirmed reproduction into an appropriate permanent regression test when practical.

Do not call Debug's disposable reproducer permanent TDD evidence automatically.

---

# Existing Test Already Reproduces Bug

If a correct existing test already fails:

Execute may use it as RED.

Debug should identify:

- test;
- command;
- expected failure;
- why it represents the approved contract.

No need to invent a duplicate test.

---

# Diagnostic Test Candidate

If Debug creates a useful disposable test that should become permanent:

report:

PERMANENT REGRESSION TEST CANDIDATE

Include:

- behavior protected;
- reproduction;
- proposed location;
- determinism concerns;
- recommended owner.

Do not leave it in the active repository.

Execute owns permanent test adoption.

---

# Non-Code Root Causes

Sometimes no production code fix is appropriate.

Possible root causes:

- invalid configuration;
- deployment mismatch;
- stale build artifact;
- corrupted test fixture;
- external service outage;
- incorrect operational procedure.

In these cases correction may belong to:

- deployment;
- configuration;
- test harness;
- documentation;
- environment cleanup.

Still route corrective action through the appropriate workflow rather than silently changing things during Debug.

---

# Out-of-Scope Findings

Debug may discover unrelated defects.

Record them separately.

Do not expand the current diagnosis unless they:

- cause the observed failure;
- prevent diagnosis;
- create immediate critical risk.

Otherwise recommend a separate:

DISCOVER

DEBUG

or follow-up task.

---

# Disposable Artifact Ownership

Debug owns the temporary artifacts it creates.

Examples:

- temporary worktrees;
- temporary target directories;
- temporary DBs;
- temporary scripts;
- temporary logs;
- temporary generated output.

Track enough information to distinguish them from:

- user work;
- pre-existing worktrees;
- pre-existing stashes;
- unrelated temp files.

Never clean up something merely because it looks temporary.

---

# Disposable Artifact Cleanup

Before finishing Debug:

attempt safe cleanup of disposable artifacts created by this Debug run.

Examples:

- remove temporary worktree;
- prune its registration if appropriate;
- remove temporary target directory;
- remove temporary DB;
- remove disposable harness files.

Cleanup must not risk user work.

---

# Cleanup Safety

Do not use broad destructive commands such as:

- git clean -fd;
- reset --hard;
- broad temp-directory deletion;
- deleting unknown worktrees;
- deleting stashes;
- deleting shared build caches.

Prefer exact paths for artifacts created by this run.

---

# Cleanup Failure

If automatic cleanup is blocked or unsafe:

do not force it.

Report:

## Artifact

Exact known artifact/path.

## Created By

This Debug run / pre-existing / uncertain.

## Size

If relevant and safely known.

## Why Cleanup Failed

...

## Impact

Does it affect:

- repository state;
- evidence;
- disk only;
- Git metadata only?

## Safe Cleanup

Provide the smallest exact cleanup action when appropriate.

Ask for authorization if needed.

Cleanup failure does not invalidate diagnostic evidence unless the leftover artifact contaminated the evidence.

---

# Cleanup Evidence

Do not claim cleanup succeeded merely because the command was issued.

When practical, verify:

- worktree registration removed;
- directory removed;
- active repository unchanged.

---

# Pre-Existing Artifacts

Never remove:

- pre-existing stashes;
- pre-existing worktrees;
- user temp directories;
- unrelated build artifacts;

without explicit authorization.

Report them only when relevant.

---

# Stop Conditions

Stop Debug and route appropriately when:

## Requirement unclear

→ DISCOVER / PLAN

## Root cause confirmed and correction complete

→ EXECUTE

## Root cause confirmed but correction decisions remain

→ PLAN

## Root cause remains unresolved after reasonable investigation

→ INCONCLUSIVE / specialist / Oracle if justified

## Environment prevents investigation

→ BLOCKED

## Failure cannot be reproduced and no useful discriminating evidence exists

→ NOT REPRODUCED / INCONCLUSIVE

Do not keep experimenting indefinitely.

---

# Debug Statuses

Choose exactly one final Debug status:

## ROOT CAUSE CONFIRMED

Causal mechanism established.

## ROOT CAUSE STRONGLY SUPPORTED

High-confidence diagnosis, one causal link remains indirect.

## INCONCLUSIVE

Evidence insufficient to establish cause.

## NOT REPRODUCED

Failure could not be reproduced and evidence is insufficient.

## REQUIREMENT AMBIGUITY

Expected behavior is not sufficiently defined.

## BLOCKED

Required environment/dependency/access unavailable.

Do not use:

FIXED

unless a separately authorized Execute phase actually occurred.

Debug itself does not mean fixed.

---

# Correction Readiness Status

When Debug status is:

ROOT CAUSE CONFIRMED

or:

ROOT CAUSE STRONGLY SUPPORTED

also report exactly one:

## READY FOR EXECUTION

Correction semantics are sufficiently determined.

## READY FOR PLANNING

Material product/architecture/persistence/API/etc. decisions remain.

## NOT READY

Diagnosis is not sufficient to authorize downstream correction work.

This status is separate from root-cause confidence.

---

# Debug Report

Return:

## Symptom

What was reported or observed.

---

## Debug Entry

**Classification:**

REPRODUCIBLE DEFECT / INTERMITTENT / REGRESSION / ENVIRONMENTAL / PERFORMANCE / CONCURRENCY / HARDWARE-INTEGRATION / UNKNOWN

**Source of expectation:**

...

**Known process context:**

...

---

## Repository State

**Base:**

...

**Existing modifications:**

...

**Initial fingerprint:**

...

**Final fingerprint:**

...

**Debug-created active repository changes:**

NONE / explain

---

## Expected

...

---

## Actual

...

---

## Reproduction

**Command / steps:**

...

**Environment:**

...

**Frequency:**

...

**Result:**

REPRODUCED / INTERMITTENT / NOT REPRODUCED / BLOCKED

---

## First Divergence

The earliest established point where actual behavior differs from expected behavior.

---

## Evidence

### Verified

- ...

### Inferred

- ...

### Unknown

- ...

---

## Hypotheses

### Hypothesis 1 — `<name>`

**Supporting evidence:**

...

**Contradicting evidence:**

...

**Discriminating experiment:**

...

**Result:**

SUPPORTED / FALSIFIED / OPEN

Repeat only as necessary.

---

## Root Cause

**Confidence:**

CONFIRMED / STRONGLY SUPPORTED / POSSIBLE

**Mechanism:**

...

**Trigger:**

...

**Why it explains the symptom:**

...

**Why nearby cases pass:**

...

---

## Contributing Factors

- ...

---

## Out-of-Scope Findings

- ...

---

## Correction Contract

### Required behavior

...

### Must preserve

...

### Relevant boundaries

...

### Regression reproduction

...

### TDD expectation

REQUIRED / EXCEPTION WITH REASON

### Suggested owner

...

### Risk

LOW / MEDIUM / HIGH / CRITICAL

### Scope

...

### Out of scope

...

### Open decisions

- ...

---

## Correction Readiness

Choose exactly one:

READY FOR EXECUTION

READY FOR PLANNING

NOT READY

**Reason:**

...

---

## Permanent Regression Test Candidates

- ...

or:

None.

---

## Disposable Artifacts

For each artifact created by Debug:

**Artifact:**

...

**Cleanup status:**

REMOVED / RETAINED / CLEANUP BLOCKED

**Evidence impact:**

...

If none:

None.

---

## Environment / Tooling Incidents

- ...

---

## Remaining Uncertainty

- ...

---

## Debug Status

Choose exactly one:

ROOT CAUSE CONFIRMED

ROOT CAUSE STRONGLY SUPPORTED

INCONCLUSIVE

NOT REPRODUCED

REQUIREMENT AMBIGUITY

BLOCKED

---

## Next Workflow

Use both:

Debug Status

and:

Correction Readiness.

Examples:

ROOT CAUSE CONFIRMED
+ READY FOR EXECUTION
→ EXECUTE

ROOT CAUSE CONFIRMED
+ READY FOR PLANNING
→ PLAN

ROOT CAUSE STRONGLY SUPPORTED
+ READY FOR PLANNING
→ PLAN

ROOT CAUSE STRONGLY SUPPORTED
+ NOT READY
→ further investigation / specialist

INCONCLUSIVE
→ further evidence / specialist / Oracle if justified

REQUIREMENT AMBIGUITY
→ DISCOVER / PLAN

BLOCKED
→ resolve dependency/environment

Do not route to Execute merely because root cause is confirmed.

---

# Debug Self-Check

Before declaring root cause ask:

1. Did I establish expected behavior from an authoritative source?
2. Did I reproduce the actual failure when practical?
3. Did I preserve the original failure mechanism?
4. Did I find the first divergence rather than only the final symptom?
5. Did I separate VERIFIED, INFERRED, and UNKNOWN?
6. Did I consider multiple plausible hypotheses where appropriate?
7. Did I actually falsify alternatives?
8. Does the proposed root cause predict the observed evidence?
9. Does it explain nearby passing cases?
10. Did I confuse correlation with causation?
11. Did I modify production code while diagnosing?
12. Did I modify active repository tests?
13. Did I preserve existing user work?
14. Did I isolate alternate states/build artifacts?
15. Did I avoid destructive cache cleanup?
16. Did I distinguish product, test, and environment defects?
17. Did I accidentally invent a requirement?
18. Did I distinguish root cause from contributing factors?
19. Did I distinguish technical certainty from correction readiness?
20. Are unresolved product decisions routed to Plan?
21. Did I avoid choosing architecture that belongs to Plan?
22. Is TDD expected for the correction?
23. Did I identify useful permanent regression-test candidates without adding them?
24. Did I clean up disposable artifacts I created?
25. If cleanup failed, did I report exact leftovers without touching pre-existing artifacts?
26. Does the active repository still match the intended starting state?
27. Am I calling a POSSIBLE cause CONFIRMED merely because it sounds plausible?

If an important answer is uncertain:

do not claim confirmed root cause.

---

# Completion Principle

Debugging succeeds when uncertainty about causation has been reduced enough to justify the next engineering action.

The goal is not:

> Make the error disappear.

The goal is:

> Explain why the error occurs with evidence strong enough that the next workflow can correct the cause rather than guess.

A complete Debug result establishes two independent things:

1. **Root-cause confidence**
2. **Correction readiness**

These are not the same.

A root cause can be fully confirmed while the correction still requires planning.

Debug must remain:

evidence-first;
hypothesis-driven;
falsifiable;
scope-controlled;
read-only toward production behavior;
careful with disposable artifacts;
honest about uncertainty;
separate from product decision-making.

Diagnose first.

Decide correction semantics where they belong.

Fix second.
