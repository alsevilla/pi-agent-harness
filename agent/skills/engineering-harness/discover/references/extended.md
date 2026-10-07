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
# Discover


## Main-Session Scout Dispatch Boundary

`discover` is the discovery procedure, not a substitute for repository
reconnaissance by `scout`.

When the change surface, current behavior, dependencies, or relevant repository
locations are not already sufficiently known, the main conversation must
dispatch `scout` and use its read-only handoff as discovery evidence.

The orchestrator may still own user/product clarification, authority resolution,
and synthesis of the Discovery Brief. It must not silently impersonate Scout
when Scout is required.

If Scout cannot be launched, mark the repository-reconnaissance portion of
Discovery BLOCKED/UNKNOWN rather than claiming it was performed.

Turn an idea, request, problem, or uncertain change into a sufficiently understood engineering problem before implementation planning begins.

Discovery answers:

- What is the user actually trying to accomplish?
- What behavior exists now?
- What behavior should change?
- What constraints already exist?
- What parts of the system are affected?
- What requirements remain ambiguous?
- What risks or invariants matter?
- What evidence does the repository provide?
- Is the problem sufficiently understood to plan?

Discovery is not implementation.

Do not modify production code during discovery.

---

# Core Principles

## Understand Before Designing

Do not design a solution before understanding the problem.

Separate:

1. user intent;
2. verified current behavior;
3. desired behavior;
4. assumptions;
5. unresolved questions;
6. implementation ideas.

Implementation ideas may be recorded, but they must not silently become requirements.

## Evidence Over Assumption

Prefer evidence from:

- source code;
- tests;
- configuration;
- schema;
- migrations;
- documentation;
- logs;
- reproducible runtime behavior.

Clearly distinguish verified facts from inference.

## Repository Before User Questions

Prefer investigating the repository before asking questions that the code can answer.

Ask the user about product decisions, policy, intent, or constraints that cannot reasonably be derived from repository evidence.

## Minimum Necessary Investigation

Discovery should be thorough enough to support planning, but not exhaustive for its own sake.

Do not inspect unrelated systems.

Do not invoke agents merely because they exist.

---

# When to Use

Use discovery for:

- new features;
- non-trivial behavior changes;
- unclear bugs;
- cross-layer work;
- database-backed changes;
- state-machine changes;
- hardware/device behavior;
- architectural changes;
- unfamiliar areas of the repository;
- requests with meaningful ambiguity;
- changes whose blast radius is unknown.

Do not invoke discovery mechanically.

Skip it for:

- trivial text changes;
- obvious one-line fixes;
- mechanical changes in known files;
- straightforward compiler errors with an obvious cause;
- tasks whose requirements and change surface are already sufficiently established.

---

# Discovery Workflow

## Step 1 — Understand the Request

Restate the requested outcome in concrete terms.

Identify:

- desired user-visible behavior;
- affected users or systems;
- success conditions;
- explicit constraints;
- stated non-goals.

Do not silently invent missing product requirements.

Do not prematurely convert implementation ideas into requirements.

---

## Step 2 — Determine Ambiguity

Identify questions whose answers could materially change:

- architecture;
- data model;
- API contract;
- security;
- user workflow;
- state transitions;
- hardware behavior;
- deployment;
- compatibility;
- implementation scope.

Ask the user only questions that materially affect the solution.

Prefer investigating the repository before asking questions the code can answer.

Do not interrogate the user about implementation details that can be discovered directly.

---

## Step 3 — Repository Reconnaissance

For non-trivial repository work, use the `scout` agent when the relevant change surface is not already known.

Scout should investigate:

- relevant files and symbols;
- current execution/data flow;
- existing patterns;
- tests;
- configuration;
- persistence;
- external interfaces;
- likely change surface;
- important invariants;
- risks.

Scout remains read-only.

Do not use Scout for trivial tasks merely because it exists.

When Scout has already produced sufficiently recent and relevant reconnaissance, reuse that evidence rather than repeating the same investigation.

If repository state may have materially changed, verify critical findings again.

---

## Step 4 — Use Existing Repository Knowledge

If a trustworthy existing repository map or knowledge graph is available, use it when it materially improves discovery.

When `graphify-out/` exists and the question concerns:

- architecture;
- relationships;
- callers;
- dependencies;
- data flow;
- cross-module relationships;
- blast radius;

the Graphify skill may be useful.

Do not rebuild or query Graphify mechanically for every task.

Repository source code remains authoritative when generated knowledge conflicts with current code.

---

## Step 5 — Establish Current Behavior

Separate findings into:

### Verified

Directly supported by:

- code;
- tests;
- configuration;
- schema;
- documentation;
- logs;
- reproducible behavior.

### Inferred

Strongly suggested by available evidence but not directly established.

### Unknown

Not yet established.

Never present inferred behavior as verified fact.

When evidence conflicts, report the conflict rather than choosing whichever interpretation is convenient.

---

## Step 6 — Define Desired Behavior

Express desired behavior in observable terms.

Prefer requirements such as:

- Given X, when Y occurs, Z must happen.
- If X is invalid, the system must reject it with Y.
- Existing behavior A must remain unchanged.
- Operation B must remain idempotent.
- State C must never transition directly to D.

Avoid implementation-specific requirements unless implementation itself is constrained.

Do not silently choose product policy.

---

## Step 7 — Define Scope

Identify what the requested change includes.

Also identify meaningful non-goals when they are known.

Prevent adjacent improvements from silently expanding the task.

Examples of accidental scope expansion include:

- unrelated refactoring;
- redesigning neighboring APIs;
- replacing working infrastructure;
- changing unrelated UI;
- introducing a new framework unnecessarily;
- solving future requirements that were not requested.

Discovery may identify adjacent problems without adding them to scope.

---

## Step 8 — Identify Invariants

Record properties that must remain true.

Examples include:

- data integrity;
- authorization boundaries;
- transaction atomicity;
- ordering guarantees;
- state-machine rules;
- backward-compatible API behavior;
- device event semantics;
- platform parity;
- retry behavior;
- idempotency;
- auditability;
- historical-data correctness.

Critical invariants should later become verification targets.

---

## Step 9 — Identify Risk

Classify the proposed change.

### LOW

Localized, reversible, and little behavioral risk.

Examples:

- small presentation changes;
- localized non-critical behavior;
- mechanical modifications.

### MEDIUM

Multiple components or meaningful behavioral impact.

Examples:

- new API behavior;
- moderate cross-layer work;
- changes affecting several modules.

### HIGH

Includes one or more of:

- concurrency;
- authentication;
- authorization;
- migrations;
- important state machines;
- hardware lifecycle;
- production deployment;
- significant persistent-data changes;
- unattended bulk operations;
- difficult rollback.

### CRITICAL

Credible risk of:

- data loss;
- data corruption;
- security compromise;
- irreversible migration damage;
- widespread production failure;
- violation of a critical business invariant.

Risk classification controls later workflow depth.

Do not exaggerate risk merely to invoke more agents.

Explain the concrete reason for HIGH or CRITICAL classifications.

---

## Step 10 — Specialist Recommendations

Discovery may recommend specialists but should not automatically invoke every relevant specialist.

Recommend only expertise justified by discovered evidence.

Typical routing:

- SQLite/data persistence → `sqlite-specialist`
- async/shared-state behavior → `concurrency-specialist`
- security boundary → `security-specialist`
- API contract → `api-specialist`
- substantial UI workflow → `ui-ux-specialist`
- USB/RFID/device lifecycle → `hardware-integration`
- deployment/platform behavior → `devops-specialist`
- hot path/throughput → `performance-specialist`
- cross-system structure → `architecture-specialist`
- telemetry/health/auditability → `observability-specialist`

The later planning or execution workflow decides which recommendations actually require invocation.

Do not invoke Oracle merely because risk is HIGH.

Oracle remains an exceptional escalation mechanism for unresolved high-consequence uncertainty or disagreement.

---

## Step 11 — Define Acceptance Criteria

Produce testable acceptance criteria before planning.

Acceptance criteria describe observable outcomes rather than vague implementation intentions.

Bad:

"Improve RFID handling."

Better:

"If an RFID reader disconnects and reconnects, the service resumes accepting reads without requiring an application restart."

Acceptance criteria should include relevant:

- happy paths;
- failure behavior;
- boundaries;
- duplicate behavior;
- retry behavior;
- concurrency behavior;
- persistence behavior;
- authorization behavior;
- state transitions;
- restart behavior;
- platform behavior.

Only include categories relevant to the task.

Do not manufacture unnecessary requirements merely to make the list longer.

---

## Step 12 — Identify Open Questions

Record unresolved questions that materially affect the requested change.

Do not include questions whose answers are already available from repository evidence.

Do not fill the section with minor implementation details that can safely be decided during planning.

Each question should represent meaningful uncertainty.

---

# Blocking Decisions

When unresolved questions remain, classify whether they prevent reliable planning.

## Blocking

Questions whose answers materially change:

- architecture;
- data model;
- workflow;
- safety properties;
- product policy;
- critical state transitions;
- compatibility;
- irreversible behavior;
- implementation strategy.

Planning must not proceed until blocking decisions are resolved.

Explain briefly why each decision blocks planning.

Do not arbitrarily select only a subset of open questions as blocking.

## Non-Blocking

Questions that can safely be deferred because:

- either answer fits the same architecture;
- the plan can accommodate both possibilities;
- the decision is localized;
- the implementation can preserve flexibility;
- the issue does not affect correctness or safety.

Non-blocking questions may be carried into planning.

---

# Discovery Gate

Discovery is complete only when there is enough information to create an implementation plan without relying on major hidden assumptions.

Choose exactly one outcome.

## READY FOR PLANNING

Use when:

- requirements are sufficiently understood;
- important current behavior is verified;
- critical invariants are known;
- acceptance criteria are defined;
- no unresolved blocking product decisions remain.

Non-blocking questions may still exist.

## NEEDS USER INPUT

Use when a material product, policy, requirement, or behavioral decision cannot be determined from available evidence.

Clearly identify the blocking decisions.

Do not guess the user's policy.

## NEEDS MORE INVESTIGATION

Use when repository, runtime, test, log, hardware, or other technical evidence is insufficient.

State what evidence is missing and what investigation should happen next.

## BLOCKED

Use when an external dependency or missing prerequisite prevents meaningful planning.

State the blocker and what must become available before discovery can continue.

Do not proceed to implementation merely because some information was found.

---

# Agent Usage

Discovery owns the investigation workflow.

Use agents deliberately.

## Scout

Use `scout` when repository reconnaissance is necessary.

Scout answers:

"What exists, where is it, how is it connected, and what might this change affect?"

Scout does not make final product decisions.

## Specialists

Specialists may be recommended during discovery.

Invoke a specialist during discovery only when specialist analysis is necessary to determine whether the problem itself is understood.

Otherwise defer specialist consultation to planning.

## Debugger

For a bug where the failure itself is not understood, discovery may recommend or use `debugger` to establish reproducible evidence.

Do not turn every feature discovery into debugging.

## Reviewer

Reviewer is normally not required during discovery.

## Oracle

Oracle is not a normal discovery participant.

Use Oracle only when discovery exposes unresolved high-consequence disagreement or uncertainty that meets the established Oracle escalation criteria.

---

# Modification Rules

Discovery is primarily read-only.

Do not:

- implement the feature;
- modify production code;
- perform migrations;
- refactor unrelated code;
- change APIs;
- alter schemas;
- change deployment configuration;
- make destructive repository changes.

Read-only inspection commands are allowed.

Temporary investigative actions must not alter production state.

If runtime reproduction would modify important data or state, obtain appropriate approval or use a safe test environment.

---

# Output

Return a Discovery Brief using the following structure.

## Objective

What outcome is being requested.

## Current Behavior

Verified existing behavior.

Clearly label important inference, conflicting evidence, or uncertainty.

## Desired Behavior

What should change.

Do not silently decide unresolved product policy.

## Scope

What is included.

## Non-Goals

What is intentionally excluded when known.

If non-goals are proposed rather than confirmed, label them as proposed.

## Relevant System Areas

Important:

- modules;
- files;
- components;
- interfaces;
- data;
- devices;
- configuration;
- deployment surfaces.

Include only areas relevant to the requested change.

## Requirements

Concrete requirements discovered or confirmed.

Separate confirmed requirements from proposed requirements when necessary.

## Invariants

Properties that must remain true.

## Acceptance Criteria

Observable conditions for success.

## Risks

State:

- LOW;
- MEDIUM;
- HIGH;
- CRITICAL.

Explain the concrete reasons.

## Specialist Recommendations

Only specialists justified by discovered evidence.

Explain what question each recommended specialist should answer.

## Open Questions

All unresolved material questions.

Separate them when useful into:

### Product / Policy

### Technical

### Operational

Do not add categories that contain nothing.

## Blocking Decisions

List questions that must be resolved before reliable planning.

For each blocking decision, briefly explain why it blocks planning.

If none, write:

None.

## Non-Blocking Questions

List unresolved questions that may safely be carried into planning.

If none, write:

None.

## Discovery Status

Choose exactly one:

- READY FOR PLANNING
- NEEDS USER INPUT
- NEEDS MORE INVESTIGATION
- BLOCKED

Briefly explain why that status applies.

---

# Handoff to Planning

When status is READY FOR PLANNING, the Discovery Brief becomes an input to the planning workflow.

Planning should inherit:

- objective;
- verified current behavior;
- scope;
- requirements;
- invariants;
- acceptance criteria;
- risk classification;
- specialist recommendations;
- non-blocking questions.

Planning must not silently change those items.

If planning discovers evidence that materially contradicts the Discovery Brief, stop and return the issue to discovery rather than building a plan on invalid assumptions.

When status is NEEDS USER INPUT, NEEDS MORE INVESTIGATION, or BLOCKED, do not treat discovery as ready for implementation planning.

---

# Completion Rule

Discovery succeeds when uncertainty has been reduced enough to make the next engineering decision safely.

Discovery does not succeed merely because:

- many files were inspected;
- Scout produced a report;
- a plausible implementation was imagined;
- the problem sounds understandable.

The final question is:

"Can a planner now produce a reliable implementation plan without making important hidden assumptions?"

If yes, use READY FOR PLANNING.

If no, identify exactly what prevents it.
