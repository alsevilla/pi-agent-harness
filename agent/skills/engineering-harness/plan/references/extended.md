> Historical reference only. The v1.2.1 global policy and compact skill govern
> routing, role selection, authority, and whether a formal plan or independent
> gate is needed. Old universal phase/agent/READY FOR EXECUTION wording below
> applies only when that gate is selected under current policy. This archive
> cannot impose a new gate, waive a blocker, or expand authority. Read targeted
> sections only; never auto-import or preload the complete archive.

# Extended guidance (archived from pre-cost-optimized harness)

# Plan

Convert a sufficiently understood engineering problem into an executable implementation contract.

Planning answers:

- What technical approach should be used?
- What existing architecture and patterns should be preserved?
- What exactly needs to change?
- In what order should it change?
- Which tasks can safely run in parallel?
- Which worker owns each task?
- Which specialists are actually needed?
- What tests must fail before implementation?
- How will each task be verified?
- What independent verification is required?
- What review level is required?
- What migration, rollback, deployment, or operational concerns exist?
- Is the work sufficiently specified to begin execution?

Planning is not implementation.

Do not modify production code during planning.

---

# Core Principle

A good plan should reduce implementation-time decision making without pretending every low-level coding detail can be known in advance.

The execution worker should not need to rediscover:

- the objective;
- major requirements;
- critical invariants;
- architecture decisions;
- important repository relationships;
- task dependencies;
- TDD expectations;
- acceptance criteria;
- known risks.

The worker may still make localized implementation decisions consistent with the plan and existing architecture.

---

# Relationship to Discovery

The preferred input to planning is a Discovery Brief produced by the `discover` workflow.

The normal lifecycle is:

DISCOVER
→ PLAN
→ EXECUTE
→ VERIFY
→ REVIEW
→ SHIP
→ LEARN

Planning should normally begin when discovery status is:

READY FOR PLANNING

If discovery produced:

- NEEDS USER INPUT;
- NEEDS MORE INVESTIGATION;
- BLOCKED;

do not silently plan around the unresolved issue.

Return the task to the appropriate stage.

---

# Direct Planning Without Discovery

Do not require `/discover` mechanically.

Planning may proceed directly when:

- the task is already sufficiently specified;
- the relevant repository surface is known;
- requirements are concrete;
- important invariants are known;
- there are no material hidden product decisions;
- the orchestrator has sufficient verified context.

If those conditions are not met, use discovery first.

The purpose of the workflow is reducing uncertainty, not forcing ceremony.

---

# Planning Authority

The orchestrator owns the final plan.

Scout findings are evidence.

Specialist recommendations are evidence.

Repository behavior is evidence.

Tests are evidence.

User requirements are authoritative within applicable engineering and safety constraints.

No specialist automatically owns the architecture merely because its domain is involved.

When recommendations conflict, the orchestrator must resolve the conflict using evidence or escalate appropriately.

---

# Evidence Language

Planning must distinguish between:

- verified existing behavior;
- desired behavior;
- inferred behavior;
- assumptions;
- unresolved behavior.

Avoid describing existing behavior as "correct" merely because it currently exists.

Prefer language such as:

"Existing behavior matches the requested outcome."

or:

"Repository behavior currently differs from the requested behavior."

Correctness is determined against requirements and invariants, not merely against the current implementation.

---

# Planning Workflow

## Step 1 — Validate Planning Input

Before producing an implementation plan, establish:

- objective;
- current verified behavior;
- desired behavior;
- scope;
- non-goals;
- requirements;
- invariants;
- acceptance criteria;
- known risks;
- unresolved questions.

If a Discovery Brief exists, consume it rather than recreating it.

Do not silently change its confirmed requirements.

Do not silently expand scope.

---

## Step 2 — Validate the Discovery Gate

If the Discovery Brief says:

READY FOR PLANNING

continue.

If it says:

NEEDS USER INPUT

stop planning around the unresolved decision and return:

NEEDS USER INPUT

If it says:

NEEDS MORE INVESTIGATION

perform or request the necessary investigation and return to discovery.

If it says:

BLOCKED

do not manufacture a workaround unless the user explicitly changes the requirements or removes the blocker.

---

## Step 3 — Check Freshness of Evidence

Determine whether repository evidence used during discovery remains trustworthy.

Consider:

- whether files changed;
- whether schema changed;
- whether dependencies changed;
- whether another agent modified relevant code;
- whether the branch or working tree changed;
- whether runtime evidence may now be stale.

Do not repeat full discovery unnecessarily.

Re-verify only assumptions whose staleness could materially affect the plan.

---

## Step 4 — Determine Whether Scout Is Needed

Reuse existing Scout reconnaissance when it is sufficiently recent and relevant.

Use `scout` only when planning still lacks important repository knowledge such as:

- exact change surface;
- callers/callees;
- affected tests;
- cross-module dependencies;
- configuration relationships;
- persistence interactions;
- hardware interactions;
- deployment relationships.

Do not invoke Scout merely because planning has begun.

Scout remains read-only.

---

## Step 5 — Establish the Technical Approach

Determine the smallest coherent technical approach that satisfies the requirements and preserves the identified invariants.

Prefer:

- existing architecture;
- existing abstractions;
- existing dependencies;
- existing error patterns;
- existing test organization;
- existing API conventions;
- existing persistence patterns.

Avoid introducing a second architectural style without strong justification.

Avoid speculative infrastructure.

Avoid designing for hypothetical future requirements outside scope.

---

# Architecture Decision Discipline

For meaningful design choices, identify:

## Decision

What technical approach will be used.

## Reason

Why this approach fits the requirements and repository.

## Alternatives Considered

Only meaningful alternatives.

Do not create fake alternatives merely to make the plan look rigorous.

## Rejected Because

Concrete reason an alternative is worse for this task.

Architecture decisions should be proportional to the importance of the choice.

Routine implementation details do not need architecture-decision records.

---

# Risk Classification

## Risk Is Based on Consequence

Risk must be classified primarily by:

- consequence of being wrong;
- sensitivity of affected invariants;
- reversibility;
- persistent-data impact;
- security impact;
- concurrency complexity;
- operational impact;
- blast radius;
- ability to detect failure;
- ability to recover safely.

Do not classify risk primarily from:

- number of changed lines;
- number of files;
- apparent implementation simplicity;
- estimated coding time.

A three-line change to a critical state machine may be higher risk than a large isolated UI refactor.

---

## LOW Risk

Typical characteristics:

- trivial text or styling;
- obvious mechanical change;
- no important behavioral semantics;
- highly reversible;
- narrow blast radius.

Examples:

- wording change;
- static label;
- simple non-behavioral formatting;
- known mechanical rename.

---

## MEDIUM Risk

Typical characteristics:

- ordinary application behavior;
- contained feature;
- limited persistent impact;
- straightforward API or UI behavior;
- failure is detectable and reversible.

Examples:

- ordinary isolated endpoint;
- standard form behavior;
- small non-critical feature;
- localized bug with strong regression coverage.

---

## HIGH Risk

Use HIGH when failure could materially violate important system behavior or invariants.

Strong HIGH-risk triggers include:

- business-critical rules;
- attendance rules;
- financial calculations;
- authorization;
- persistent state semantics;
- state machines;
- database migrations;
- data-integrity-sensitive behavior;
- concurrency;
- queues and retries affecting durable state;
- hardware event processing affecting authoritative records;
- destructive administrative operations;
- production recovery behavior;
- significant authentication behavior.

Critical domain behavior remains HIGH risk even when the code change is small.

---

## CRITICAL Risk

Use CRITICAL when credible failure could cause severe or difficult-to-recover consequences and important correctness remains uncertain.

Examples:

- credible data-loss risk;
- irreversible migration uncertainty;
- unresolved authorization/security architecture;
- disputed concurrency correctness affecting durable state;
- destructive operation with uncertain recovery;
- repeated failures in critical state-machine logic;
- conflicting expert recommendations on a high-consequence decision.

CRITICAL does not automatically mean Oracle must be called immediately.

Follow established escalation rules.

---

# Domain Criticality

Some domains require stronger treatment because incorrect behavior has disproportionate consequences.

Examples include:

- attendance status and attendance finalization;
- financial calculations;
- authorization and permissions;
- identity;
- persistent state machines;
- destructive administrative operations;
- migrations;
- concurrency affecting durable state;
- safety-relevant hardware processing.

For these domains:

- do not reduce risk because the diff is small;
- strongly prefer explicit invariants;
- require meaningful boundary and regression testing;
- require independent verification when appropriate;
- require Reviewer for behavioral changes unless there is a concrete reason not to.

---

# Specialist Consultation

## Step 6 — Determine Specialist Needs

Consult specialists only when their expertise materially affects the plan.

Typical routing:

### SQLite / Persistence

Use `sqlite-specialist` for:

- schema semantics;
- migrations;
- transaction boundaries;
- WAL/locking;
- uniqueness;
- constraints;
- persistent idempotency;
- backup/recovery implications;
- query/index behavior.

### Concurrency

Use `concurrency-specialist` for:

- Tokio tasks;
- shared state;
- races;
- channels;
- backpressure;
- cancellation;
- shutdown;
- concurrent writes;
- duplicate processing.

### Security

Use `security-specialist` for:

- authentication;
- authorization;
- privilege boundaries;
- sensitive administrative actions;
- untrusted input;
- secrets;
- security-sensitive API design.

### API

Use `api-specialist` for:

- new contracts;
- changed request/response shapes;
- validation semantics;
- errors/status codes;
- compatibility;
- backend/frontend coordination.

### Specialist-first domain decisions

Before assigning a worker, identify whether implementation would require the
worker to invent an unresolved material domain policy.

Route first to:
- `sqlite-specialist` for persistence semantics;
- `concurrency-specialist` for concurrency/backpressure/shutdown semantics;
- `security-specialist` for trust/auth/secrets/security-sensitive behavior;
- `api-specialist` for public contract changes;
- `architecture-specialist` for material structural decisions;
- `hardware-integration` for device lifecycle/protocol/recovery decisions;
- `devops-specialist` for deployment/operations policy;
- `observability-specialist` for telemetry/audit/health requirements;
- `performance-specialist` for evidence-driven performance strategy.

After the specialist handoff is accepted, route implementation to the
appropriate worker. Skip the specialist when the contract/policy is already
defined and the remaining work is implementation-only.

### UI / UX

Use `ui-ux-specialist` **before `frontend-worker` for any frontend scope that
contains a design or UX decision**, including:

- new pages/screens/components whose design is not already fully specified;
- workflows and navigation;
- dashboards;
- forms and error/recovery UX;
- layout, composition, styling, and visual hierarchy;
- responsive behavior;
- interaction states and motion;
- accessibility-sensitive interaction;
- UX copy/state messaging;
- UI improvement/redesign/polish requests.

Only implementation-only work against an approved design, or localized defects
with no design judgment, may skip this specialist.

### Architecture

Use `architecture-specialist` for:

- major subsystem changes;
- new processing architecture;
- ownership/boundary changes;
- significant restructuring;
- major cross-cutting decisions.

### Hardware

Use `hardware-integration` for:

- USB;
- RFID;
- serial/HID;
- device lifecycle;
- disconnect/reconnect;
- framing;
- duplicate physical reads;
- device permissions and recovery.

### DevOps

Use `devops-specialist` for:

- Raspberry Pi/Linux deployment;
- Windows NUC/Windows deployment;
- systemd;
- Windows Services;
- service accounts;
- startup/restart;
- upgrades;
- rollback;
- backup/restore;
- operational filesystem concerns.

### Performance

Use `performance-specialist` when performance materially affects correctness or requirements, including:

- burst traffic;
- hot paths;
- contention;
- blocking;
- query behavior;
- queue pressure;
- throughput/latency requirements.

Do not invoke it for speculative micro-optimization.

### Observability

Use `observability-specialist` when the plan materially depends on:

- logs;
- metrics;
- health checks;
- auditability;
- queue visibility;
- device health;
- database health;
- operational diagnostics.

---

# Specialist Question Rule

Do not send specialists vague requests such as:

"Review this plan."

Give each specialist a specific technical question.

Examples:

"Determine the safest SQLite transaction and uniqueness strategy that guarantees one promotion batch per source/target school year across process restarts."

"Determine whether the proposed RFID reconnect loop can race with shutdown or create duplicate reader tasks."

"Determine whether this endpoint preserves the existing authorization boundary."

Specialist output should resolve a planning question.

---

# Parallel Specialist Analysis

Independent specialists may analyze in parallel when their concerns genuinely differ.

Example:

sqlite-specialist
+
concurrency-specialist

may independently analyze durable once-only execution.

The orchestrator must integrate their findings before implementation.

Do not allow parallel analysis to become parallel conflicting implementation.

---

# Specialist Conflict

When specialists disagree:

1. identify the exact disputed assumption;
2. inspect repository/runtime evidence;
3. determine whether one position can be disproven;
4. compare recommendations against requirements and invariants;
5. use Reviewer when independent review can resolve the issue;
6. use Oracle only when important high-consequence uncertainty remains.

Do not choose based on confidence or verbosity.

---

# TDD Planning

## Step 7 — Determine TDD Requirement

For every implementation task, explicitly classify:

TDD: REQUIRED

or:

TDD: NOT APPLICABLE

or:

TDD: EXCEPTION

Do not leave the TDD expectation implicit.

---

## TDD REQUIRED

Use for behavioral code changes where a meaningful automated failing test can reasonably be written first.

This is strongly expected for:

- business rules;
- attendance logic;
- state machines;
- persistence rules;
- API behavior;
- authorization;
- bug fixes;
- concurrency-sensitive behavior;
- retry/idempotency behavior;
- migrations where behavior can be tested;
- regression-prone logic.

Plan:

RED
→ GREEN
→ REFACTOR
→ REGRESSION

---

## TDD NOT APPLICABLE

Use when the task does not change executable behavior.

Examples may include:

- documentation;
- explanatory comments;
- text-only changes;
- some generated artifacts.

Do not invent meaningless tests.

---

## TDD EXCEPTION

Use when behavior changes but a meaningful automated failing test cannot reasonably be written first.

Possible cases include:

- unsimulatable hardware behavior;
- environment-specific deployment behavior;
- some purely visual behavior;
- external infrastructure unavailable to the test environment.

For every exception state:

### Reason

Why meaningful RED is impractical.

### Replacement Verification

How correctness will instead be established.

"The change is small" is not sufficient justification.

---

# RED Planning

For every TDD-required task, specify what behavior must be demonstrated failing before production behavior changes.

RED should describe:

- test location or likely test area;
- behavior under test;
- important inputs;
- expected outcome;
- relevant boundaries.

Do not require the planner to write the full test implementation.

The plan defines the behavioral contract.

---

# Valid RED Evidence

Execution must later confirm the test fails for the expected behavioral reason.

The following do not count as valid RED evidence:

- syntax errors;
- malformed test setup;
- missing imports unrelated to the behavior;
- broken fixtures;
- unrelated compiler errors;
- unavailable infrastructure unrelated to the behavior;
- failure caused by an existing unrelated defect.

If the intended test already passes before implementation, investigate why.

Do not pretend RED occurred.

---

# GREEN Planning

Specify the intended production behavior to change.

Do not prescribe every line of implementation unless necessary for correctness.

Prefer constraints such as:

- reuse existing service X;
- preserve transaction boundary Y;
- do not introduce another queue;
- preserve API compatibility;
- use the existing domain function;
- keep authorization server-side.

GREEN should target the smallest coherent change that satisfies RED.

---

# REFACTOR Planning

Do not schedule refactoring automatically.

Include refactoring only when:

- implementation would otherwise create harmful duplication;
- existing structure blocks the required change;
- a localized cleanup materially improves correctness or maintainability.

Refactoring must preserve GREEN behavior.

Avoid unrelated cleanup.

---

# REGRESSION Planning

For each behavioral task, identify the appropriate regression scope.

Possible levels:

1. focused test;
2. affected module tests;
3. integration tests;
4. frontend/backend contract tests;
5. broader project suite;
6. platform-specific verification.

Regression depth should match risk.

---

# Characterization Tests

When changing important legacy behavior that lacks adequate tests, consider characterization tests first.

Characterization tests establish verified existing behavior before changing it.

Use them when:

- existing behavior must partly remain;
- implementation is poorly documented;
- behavior is relied upon elsewhere;
- refactoring precedes behavioral change;
- a regression could be difficult to detect.

Do not preserve known incorrect behavior merely because characterization captured it.

Clearly distinguish:

- existing behavior being preserved;
- behavior intentionally being changed.

---

# Boundary Tests

When behavior depends on thresholds, plan tests for:

- immediately before;
- exactly at;
- immediately after.

Especially for:

- dates;
- times;
- limits;
- retries;
- expiration;
- pagination;
- numeric thresholds;
- state transitions.

---

# State-Machine Test Planning

For stateful workflows, plan verification of relevant:

- valid transitions;
- forbidden transitions;
- duplicate events;
- out-of-order events;
- retries;
- partial failures;
- restart/recovery behavior;
- finalized/terminal states.

Do not treat state-machine changes as ordinary CRUD.

---

# Persistence Test Planning

For persistent behavior, consider tests for relevant:

- transaction atomicity;
- constraints;
- uniqueness;
- rollback;
- duplicate requests;
- retries;
- concurrent attempts;
- migration compatibility;
- existing data;
- restart behavior.

---

# Security Test Planning

For security-sensitive behavior, consider:

- unauthenticated access;
- unauthorized access;
- privilege escalation;
- malformed input;
- validation boundaries;
- destructive operations;
- auditability.

Do not rely solely on frontend restrictions.

---

# Hardware Test Planning

For hardware behavior, consider available levels of verification:

- pure parser/unit tests;
- simulated input;
- recorded input;
- integration test;
- device-in-the-loop test;
- manual hardware verification.

Prefer deterministic automated tests where practical.

Do not fake hardware coverage that the environment cannot provide.

---

# Task Decomposition

## Step 8 — Break the Work into Executable Tasks

Each task should be:

- coherent;
- independently understandable;
- assigned to one implementation owner;
- ordered by dependency;
- small enough to verify;
- large enough to represent meaningful work.

Avoid both extremes.

Too large:

"Implement the entire feature."

Too small:

"Add one import."

Tasks should correspond to meaningful engineering units.

---

# Implementation Tasks vs Verification

The execution task list is primarily for implementation ownership.

Do not treat `test-engineer` as the implementation owner merely because independent tests are needed.

The normal separation is:

WORKER
→ RED
→ GREEN
→ REFACTOR
→ worker regression

then:

TEST ENGINEER
→ independent adversarial verification

then, when required:

REVIEWER
→ independent code/design review

Worker TDD and Test Engineer verification serve different purposes.

Do not collapse them into one phase.

---

# Task Ownership

Assign one primary implementation owner per implementation task.

Typical owners:

- `rust-worker`
- `frontend-worker`

Specialists normally advise rather than implement.

`test-engineer` independently verifies rather than replacing worker-owned TDD.

`reviewer` reviews.

`oracle` adjudicates exceptional unresolved uncertainty.

The orchestrator integrates the work.

---

# File Ownership

For each task, identify likely files or subsystems when reasonably known.

Prefer one writer per file or tightly coupled logical change.

Do not schedule two workers to modify the same file simultaneously.

When tasks share tightly coupled files, sequence them.

---

# Dependencies

Each task must state its dependencies.

Examples:

Depends on: none

Depends on: Task 1

Depends on: Tasks 1 and 2

Use dependencies to determine execution order.

Do not parallelize merely because multiple workers exist.

---

# Parallel Execution

Explicitly mark tasks that may safely execute in parallel.

Parallel work is appropriate when:

- file ownership does not conflict;
- API contracts are already established;
- one task does not depend on another's implementation;
- shared persistent state is not being redesigned independently.

If uncertain, sequence the tasks.

Correctness is more important than maximizing concurrency.

---

# API Contract Planning

For backend/frontend work, establish the contract before independent implementation.

Plan relevant:

- route;
- method;
- request fields;
- response fields;
- nullability;
- validation;
- error behavior;
- status codes;
- date/time representation;
- compatibility.

Do not let backend and frontend workers independently invent contracts.

---

# Migration Planning

For schema or persistent-data changes, specify:

- migration intent;
- compatibility requirements;
- existing-data handling;
- transaction expectations;
- rollback implications;
- backup requirements when relevant;
- application/schema ordering;
- deployment constraints.

Do not treat a migration as merely another file edit.

---

# Operational Planning

When runtime/deployment behavior changes, consider:

- startup;
- shutdown;
- restart;
- crash recovery;
- process supervision;
- service configuration;
- filesystem paths;
- permissions;
- hardware access;
- backup;
- restore;
- logging;
- health checks;
- rollback.

Only include concerns relevant to the task.

---

# Observability Planning

For important background, hardware, queue, retry, migration, or administrative behavior, determine how operators will know:

- it started;
- it succeeded;
- it failed;
- it is stuck;
- it retried;
- it partially completed;
- it needs human intervention.

Do not add noisy telemetry without operational value.

---

# Independent Verification

## Step 9 — Determine Independent Verification

Worker-owned TDD is implementation evidence.

It is not automatically sufficient independent verification.

Use `test-engineer` when appropriate, especially for:

- business rules;
- attendance logic;
- state machines;
- persistence;
- concurrency;
- retries;
- queues;
- authentication/authorization;
- migrations;
- bug fixes;
- regression-prone behavior;
- HIGH or CRITICAL risk changes.

For HIGH or CRITICAL behavioral domain logic, independent verification should normally be REQUIRED.

Define what the Test Engineer should challenge.

Examples:

- missing boundaries;
- invalid inputs;
- duplicate operations;
- invalid transitions;
- concurrent execution;
- restart behavior;
- authorization bypass;
- partial failure;
- interaction with existing invariants;
- acceptance criteria the worker may have interpreted too narrowly.

Do not merely tell Test Engineer:

"Run the tests."

---

# Independent Verification Must Remain Independent

The Test Engineer should receive:

- objective;
- requirements;
- invariants;
- acceptance criteria;
- relevant implementation;
- relevant existing tests;
- known risk areas.

It may inspect worker-written tests.

However, it should independently reason about missing cases rather than assuming those tests define complete correctness.

Test Engineer output should establish:

- what was independently tested;
- what passed;
- what failed;
- what remains unverified;
- PASS / FAIL / INCONCLUSIVE.

---

# Review Planning

## Step 10 — Determine Reviewer Requirement

Classify review as:

REQUIRED

RECOMMENDED

NOT REQUIRED

Reviewer is normally REQUIRED for:

- HIGH or CRITICAL risk behavioral changes;
- critical business rules;
- attendance rule changes;
- database semantics;
- migrations;
- concurrency;
- authentication/authorization;
- security-sensitive behavior;
- persistent state machines;
- retry/queue systems affecting durable state;
- destructive operations;
- major API changes;
- hardware event processing affecting authoritative records;
- production deployment changes with meaningful recovery risk;
- data-integrity-sensitive behavior.

Do not downgrade Reviewer merely because the implementation appears small.

Reviewer may be RECOMMENDED for meaningful but contained MEDIUM-risk changes where independent review adds value.

Reviewer may be NOT REQUIRED for genuinely trivial or low-risk work.

---

# Oracle Planning

Oracle should normally NOT be scheduled as an ordinary execution step.

Plan should state:

Oracle: NOT PLANNED

unless an established escalation condition already exists.

Oracle becomes appropriate when:

- Reviewer returns ESCALATE;
- worker and Reviewer materially disagree;
- specialists conflict on a high-risk issue;
- potential data loss remains unresolved;
- concurrency correctness remains uncertain;
- security architecture remains disputed;
- an irreversible decision lacks sufficient confidence;
- repeated serious fixes fail.

Do not invoke Oracle merely because a task is large or HIGH risk.

---

# Out-of-Scope Findings

Planning may uncover serious existing defects or architectural concerns unrelated to the requested change.

Do not silently fix them.

Do not silently expand the current plan.

Do not bury serious findings inside generic notes.

Classify meaningful findings explicitly.

Use:

## Out-of-Scope Finding

**Finding:**

Verified or strongly supported existing behavior.

**Evidence:**

Relevant repository/runtime evidence.

**Potential consequence:**

Why it matters.

**Current plan impact:**

State whether the current plan preserves, avoids, or interacts with the behavior.

**Recommended follow-up:**

Usually:

- separate `/discover`;
- targeted investigation;
- bug report;
- specialist analysis.

A serious out-of-scope finding does not automatically block the requested task.

Block only if the finding prevents safe execution of the requested change.

---

# Scope Preservation

When an out-of-scope defect is found:

1. determine whether the requested task can safely proceed without fixing it;
2. preserve current scope when possible;
3. record the finding;
4. recommend follow-up;
5. do not opportunistically repair it.

If the requested change would worsen, depend on, or make the defect unsafe to leave untouched, re-evaluate the plan status.

---

# Rollback and Recovery

## Step 11 — Determine Failure Recovery

For meaningful persistent, deployment, or destructive changes, state:

- what happens if implementation fails;
- what happens if deployment fails;
- whether rollback is possible;
- whether rollback is safe after new data is written;
- whether backup is needed;
- whether forward-fix is safer than rollback;
- what partial state could remain.

Do not invent rollback guarantees that the system does not provide.

For ordinary low-risk code changes, a dedicated rollback plan may be unnecessary.

---

# Historical Data Semantics

When changing persisted labels, statuses, reasons, derived fields, or interpretation rules, explicitly consider whether existing rows are:

- left unchanged;
- recomputed;
- migrated;
- backfilled;
- interpreted differently at read time.

If old and new records may legitimately differ, state that explicitly.

If consistency requires backfill or migration, treat that as a separate persistent-data decision.

Do not silently rewrite historical data.

---

# Execution Checkpoints

For complex plans, identify checkpoints where the orchestrator should verify evidence before continuing.

Examples:

Migration
→ verify schema/tests
→ persistence implementation
→ verify
→ API
→ verify contract
→ frontend

Do not create unnecessary checkpoints for trivial work.

---

# Plan Contradiction Rule

If planning discovers evidence that materially contradicts discovery:

STOP.

Do not silently repair the Discovery Brief inside the plan.

Return:

NEEDS DISCOVERY

and state:

- what evidence changed;
- which requirement or assumption is affected;
- why the existing discovery is no longer reliable.

---

# Request vs Repository Difference

A difference between the user's wording and repository terminology does not automatically require rediscovery.

Determine whether the difference is:

### Semantic but resolvable

Example:

The requested concept already exists under another repository name and the mapping is unambiguous.

Planning may proceed while documenting the mapping.

### Product-significant

Example:

The requested concept could mean a new persisted reason, a flag, a display label, or a different state transition.

Return:

NEEDS USER INPUT

when the choice changes externally visible behavior, persistence semantics, reporting, compatibility, or product policy.

Do not let the planner invent the meaning.

---

# New Product Decision Rule

If planning exposes a material product or policy decision that cannot be inferred safely:

STOP.

Return:

NEEDS USER INPUT

Do not let a specialist, worker, or planner invent the policy.

---

# Technical Decision Rule

If implementation cannot be planned because a significant technical choice remains unresolved:

Return:

NEEDS TECHNICAL DECISION

State:

- the exact decision;
- viable alternatives;
- relevant evidence;
- specialist positions if any;
- risk of each choice;
- what would resolve the uncertainty.

Use Reviewer or Oracle according to established escalation rules when appropriate.

---

# Blocker Rule

If an external dependency or prerequisite prevents a meaningful execution plan:

Return:

BLOCKED

State:

- the blocker;
- why execution cannot safely proceed;
- what must become available.

---

# Planning Gate

Choose exactly one final planning status.

## READY FOR EXECUTION

Use when:

- requirements are sufficiently established;
- technical approach is coherent;
- critical specialist questions are resolved;
- task order is known;
- ownership is known;
- TDD expectations are defined;
- verification is defined;
- review requirement is defined;
- important rollback/deployment concerns are understood;
- no blocking decision remains.

## NEEDS DISCOVERY

Use when new evidence invalidates or materially weakens discovery.

## NEEDS USER INPUT

Use when a material product/policy decision remains.

## NEEDS TECHNICAL DECISION

Use when an unresolved technical decision prevents a reliable implementation plan.

## BLOCKED

Use when an external prerequisite prevents execution planning.

Do not label a plan READY FOR EXECUTION merely because it contains many details.

The question is:

"Could the assigned workers execute this plan without making major hidden product or architecture decisions?"

If no, the plan is not ready.

---

# Partial Planning When Not Ready

When status is not READY FOR EXECUTION, planning may still provide a clearly labeled provisional or draft plan when useful.

The draft must not be treated as executable.

Use language such as:

"Draft plan if Decision A is chosen."

Do not assign a READY status until the blocking decision is actually resolved.

This allows useful progress without disguising uncertainty.

---

# Output

Return an Execution Plan using the following structure.

## Objective

Concise statement of the outcome.

---

## Planning Inputs

Summarize:

- discovery status or equivalent verified context;
- requirements;
- invariants;
- acceptance criteria;
- risk classification.

Do not repeat the entire Discovery Brief unnecessarily.

---

## Verified Current Behavior

Summarize repository behavior that materially affects the plan.

Clearly distinguish:

- verified behavior;
- inferred behavior;
- unresolved behavior.

---

## Verified Change Surface

Relevant:

- modules;
- files;
- tests;
- schema;
- APIs;
- configuration;
- devices;
- deployment surfaces.

Clearly distinguish verified locations from likely locations.

---

## Technical Approach

Describe the selected approach.

Include important architecture decisions and reasons.

---

## Specialist Findings

For every specialist actually consulted:

### `<specialist-name>`

**Question:**

...

**Finding:**

...

**Impact on plan:**

...

Do not list specialists that were merely considered but not used.

If none were required:

No specialist consultation required.

---

## Execution Strategy

Explain:

- task ordering;
- dependencies;
- safe parallelism;
- integration points.

---

## Tasks

For each implementation task use:

### Task N — `<name>`

**Owner:** `<worker>`

**Risk:** LOW / MEDIUM / HIGH / CRITICAL

**Depends on:** none / Task N / Tasks N, N

**May run in parallel with:** none / Task N

**Likely files / subsystem:**

- ...

**Objective:**

What this task accomplishes.

**Requirements:**

- ...

**Constraints / invariants:**

- ...

**TDD:** REQUIRED / NOT APPLICABLE / EXCEPTION

If REQUIRED:

**RED:**

- behavior that must fail first;
- important boundary cases;
- expected behavioral reason for failure.

**GREEN:**

- smallest coherent production behavior required.

**REFACTOR:**

- only planned refactoring;

or:

- None planned.

**REGRESSION:**

- focused tests;
- affected suites;
- broader verification where justified.

If EXCEPTION:

**TDD exception reason:**

...

**Replacement verification:**

...

**Completion evidence:**

What evidence must exist before this implementation task is considered complete.

---

# Worker TDD Evidence

For TDD-required implementation tasks, execution should later report:

- test added or modified;
- RED command;
- expected RED failure;
- GREEN command;
- GREEN result;
- regression command(s);
- regression result(s).

Do not require enormous raw test logs.

Require enough evidence to establish that the sequence actually occurred.

---

## API Contract

Include only when relevant.

Define the agreed backend/frontend contract.

If no API changes:

No API contract changes.

---

## Data / Migration Plan

Include only when persistent data or schema is affected.

Address historical data semantics when relevant.

If none:

No data migration required.

---

## Operational / Deployment Plan

Include only when runtime or deployment behavior changes.

If none:

No deployment behavior changes.

---

## Observability

State any required:

- logs;
- metrics;
- health signals;
- audit events;
- diagnostics.

If none are needed:

No additional observability required.

---

## Independent Verification

State:

**Test Engineer:** REQUIRED / RECOMMENDED / NOT REQUIRED

If REQUIRED or RECOMMENDED, specify the independent verification mission.

Do not duplicate the worker's RED/GREEN instructions.

Instead identify what should be challenged independently.

Example:

- independently verify 11:59 / 12:00 / 12:01 boundaries;
- test configured boundary changes;
- verify override preservation;
- verify terminal/finalized behavior;
- inspect for missing regression cases.

---

## Review

State:

**Reviewer:** REQUIRED / RECOMMENDED / NOT REQUIRED

Explain why based on consequence and domain risk, not diff size.

---

## Oracle

Normally:

**Oracle:** NOT PLANNED

If already justified:

**Oracle:** REQUIRED

Explain the established escalation reason.

---

## Out-of-Scope Findings

List serious existing findings discovered during planning that will not be changed by this plan.

For each:

### Finding N — `<name>`

**Evidence:**

...

**Potential consequence:**

...

**Current plan impact:**

...

**Recommended follow-up:**

...

If none:

None.

---

## Rollback / Recovery

State meaningful rollback, backup, recovery, or forward-fix considerations.

If genuinely unnecessary:

No special rollback procedure beyond normal source-control rollback.

Do not use that statement for migrations or persistent-data changes unless it is actually true.

---

## Risks Remaining

List risks execution and verification must watch.

Do not repeat already-resolved risks.

---

## Open Non-Blocking Questions

Questions that execution may safely resolve locally or that can be deferred.

If none:

None.

---

## Blocking Decisions

List every unresolved decision preventing execution.

For each:

### Decision N

**Question:**

...

**Why it blocks:**

...

**Options:**

...

**Recommendation:**

...

Do not hide blocking decisions inside generic notes.

If none:

None.

---

## Execution Status

Choose exactly one:

- READY FOR EXECUTION
- NEEDS DISCOVERY
- NEEDS USER INPUT
- NEEDS TECHNICAL DECISION
- BLOCKED

Briefly explain the status.

---

# Handoff to Execute

When status is READY FOR EXECUTION, this Execution Plan becomes the implementation contract for the `execute` workflow.

Execute should preserve:

- scope;
- requirements;
- invariants;
- task dependencies;
- worker ownership;
- TDD obligations;
- API contracts;
- migration constraints;
- verification requirements;
- review requirements;
- known out-of-scope boundaries.

Execute may make localized implementation decisions consistent with the plan.

Execute must not silently change major requirements or architecture.

If execution discovers contradictory evidence:

STOP the affected task.

Return the issue to planning or discovery as appropriate.

---

# Handoff to Independent Verification

Worker completion does not automatically mean feature completion.

When Test Engineer is REQUIRED:

EXECUTE
→ worker TDD/regression evidence
→ TEST ENGINEER independent verification

Test Engineer should challenge the implementation against:

- requirements;
- invariants;
- acceptance criteria;
- boundaries;
- failure modes;
- relevant domain risks.

A worker PASS does not override a Test Engineer FAIL.

Resolve the evidence.

---

# Handoff to Review

When Reviewer is REQUIRED:

implementation
→ worker tests
→ independent verification when required
→ REVIEWER

Reviewer should receive:

- objective;
- requirements;
- invariants;
- Execution Plan;
- changed files;
- relevant tests;
- test results;
- independent verification findings;
- known out-of-scope findings.

Reviewer should review the resulting system behavior and implementation rather than merely checking whether the worker followed instructions mechanically.

---

# Planning Completion Rule

Planning succeeds when implementation has become an execution problem rather than a requirements or architecture guessing problem.

A plan is not good merely because it is long.

A plan is good when:

- workers know what they own;
- dependencies are explicit;
- architecture decisions are resolved;
- critical invariants are visible;
- risk reflects consequence rather than diff size;
- RED behavior is defined before GREEN implementation;
- worker TDD and independent verification remain distinct;
- verification is concrete;
- review depth matches domain risk;
- rollback/recovery concerns are understood;
- serious out-of-scope findings are surfaced without causing scope creep;
- unresolved uncertainty is honestly surfaced.

Prefer a short executable plan over a long speculative one.

# Plan Persistence Boundary

Session plans may remain under `~/.pi/agent/plans/` during planning. For
non-trivial multi-agent or multi-session repository execution, prefer an
authorized repository-owned plan artifact when the project has an established
location. Persisting it is a repository mutation and requires authority.

Workers reference the authoritative plan plus their narrow task packet rather
than receiving the whole plan.

A scope with unresolved material product/policy decisions is not `READY FOR
EXECUTION`; independent unaffected scopes may proceed only when explicitly
separable.


# Execution Readiness and Open Decisions

A plan is not `READY FOR EXECUTION` while a material product, business-rule,
persistence, security, compatibility, or externally observable behavior
decision remains unresolved for the scope being declared ready.

Independent scopes unaffected by an unresolved decision may be marked
separately executable when their independence is explicit.

Do not use a default merely to manufacture readiness unless that default is
already authoritative project policy or the decision authority explicitly
approved it.
