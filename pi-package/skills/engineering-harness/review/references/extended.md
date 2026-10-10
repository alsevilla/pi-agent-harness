> Historical reference only. The v1.2.1 global policy and compact skill govern
> routing, role selection, authority, and whether a formal plan or independent
> gate is needed. Old universal phase/agent/READY FOR EXECUTION wording below
> applies only when that gate is selected under current policy. This archive
> cannot impose a new gate, waive a blocker, or expand authority. Read targeted
> sections only; never auto-import or preload the complete archive.

# Extended guidance (archived from pre-cost-optimized harness)

# Review

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

Independently challenge a completed change before delivery.

Review asks:

> What could still be wrong even though implementation and verification appear complete?

Review is not:

- another implementation phase;
- another full test run by default;
- a formatting cleanup pass;
- a generic code-quality checklist;
- a rubber stamp;
- an architecture-design phase.

Normal lifecycle:

DISCOVER
→ PLAN
→ EXECUTE
→ VERIFY
→ REVIEW
→ SHIP
→ LEARN

Conditional failure paths may route through:

DEBUG
PLAN
EXECUTE
VERIFY
REVIEW

before returning to SHIP.

---

# Core Principle

Review the change and the evidence package as if they may contain the same blind spot.

Do not assume:

- implementation is correct because tests pass;
- tests are correct because implementation passes them;
- Verify is correct because it says PASS;
- Plan captured every relevant invariant;
- Discovery found every authoritative source;
- a user decision was necessarily made with complete context;
- a small diff is low risk.

Review should search for:

- missing assumptions;
- hidden coupling;
- authority conflicts;
- incorrect boundaries;
- stale evidence;
- unsafe persistence behavior;
- incomplete error handling;
- scope leakage;
- compatibility breakage;
- security issues;
- concurrency issues;
- test weaknesses;
- delivery hazards.

---

# Review vs Execute

Execute asks:

> Was the approved implementation performed correctly?

Execute owns:

- implementation;
- TDD;
- worker ownership;
- correction loops;
- implementation-time regression.

Review does not redo implementation.

---

# Review vs Verify

Verify asks:

> Does the delivered system satisfy the approved contract?

Review asks:

> Is the contract, evidence, or change package missing something material?

Verify is primarily contract-driven.

Review is primarily adversarial.

A Verify PASS is an input to Review.

It is not the conclusion.

---

# Review vs Discover

Discover establishes the relevant problem space before planning.

Review may discover that:

- an authoritative source was missed;
- an assumption used during Discovery was incomplete;
- later work relied on that incomplete assumption.

Review does not retroactively rewrite Discovery.

It reports the conflict and routes it appropriately.

---

# Review vs Plan

Plan owns:

- authorized behavior;
- scope;
- product decisions;
- implementation strategy;
- architectural choices;
- correction strategy.

Review may identify constraints or problems with a proposed design.

Review should not unnecessarily prescribe the replacement design.

---

# Review vs Debug

Debug asks:

> Why does this known failure occur?

Review asks:

> Is there a failure or risk nobody has adequately considered yet?

If Review discovers a probable defect:

do not diagnose indefinitely inside Review.

Capture enough evidence to classify it.

Then route:

REVIEW
→ DEBUG

when root cause is unclear.

Or:

REVIEW
→ EXECUTE

when correction semantics are already determined and authorized.

Or:

REVIEW
→ PLAN

when correction semantics require decisions.

---

# Read-Only Barrier

Review is read-only toward the active repository.

Review MUST NOT:

- patch production code;
- add/remove/modify tests;
- auto-format files;
- change configuration;
- change migrations;
- modify manifests;
- change dependencies;
- resolve findings by editing;
- weaken assertions;
- clean up implementation code.

Review reports.

Other workflows correct.

---

# Active Repository Read-Only Discipline

The active repository should remain unchanged throughout Review.

This applies to:

- orchestrator;
- Reviewer;
- specialists;
- Oracle;
- verification helpers.

Read-only inspection and commands that create ignored build output may be acceptable.

Do not intentionally modify tracked or untracked project artifacts.

---

# Repository Snapshot

At Review start, capture enough state to identify exactly what is being reviewed.

Prefer:

- branch/base;
- working-tree status;
- changed files;
- diff stat;
- relevant diff;
- fingerprint when useful.

At Review end, attempt to confirm that Review did not modify the active repository.

---

# Repository Immutability Status

Report exactly one:

## NO

Evidence establishes that Review did not modify the active repository.

## YES

Review modified the active repository.

This is a process violation unless explicitly authorized by a higher-priority instruction.

## UNCONFIRMED

The final repository state could not be independently established.

Examples:

- shell/tool failure;
- fingerprint command unavailable;
- environment became inaccessible.

Do not convert:

UNCONFIRMED

into:

NO

merely because no intentional write occurred.

---

# Immutability Provenance

When multiple actors checked repository state, report provenance.

Example:

Reviewer:
final fingerprint matches initial.

Orchestrator:
final fingerprint unavailable because shell failed.

Then report:

Repository modified by Review:
NO per Reviewer.

Orchestrator confirmation:
UNCONFIRMED.

Do not erase uncertainty.

---

# Unexpected Repository Change

If repository state changed during Review:

determine whether the change came from:

- Review;
- user;
- external process;
- previous workflow;
- unknown actor.

Do not automatically revert.

Determine whether the change invalidates evidence.

If relevant state changed:

Review may need to become:

BLOCKED

or restart against the new state.

---

# Preserve Existing Work

Do not:

- reset;
- revert;
- stash;
- clean;
- overwrite;
- remove existing tests;
- delete existing worktrees;

merely to make Review easier.

Existing work is part of the state being reviewed unless explicitly excluded.

---

# Review Inputs

Prefer:

1. explicit user decisions;
2. approved Plan;
3. authoritative project specifications relevant to the change;
4. final implementation diff;
5. Execute report;
6. Verify report;
7. relevant Discovery findings;
8. relevant Debug reports;
9. specialist findings;
10. current repository state.

Do not review only the diff when important contract context exists.

Do not review only the Plan when implementation details matter.

---

# Evidence Package

Treat the engineering evidence itself as reviewable.

Ask:

- Was RED valid?
- Was GREEN on the final code?
- Was regression evidence fresh?
- Was independent verification genuinely independent?
- Were relevant integration paths exercised?
- Were environmental failures misclassified?
- Were tests added after Review?
- Did production change after Verify?
- Did repository state change after evidence collection?
- Were limitations disclosed?
- Did previous workflows overlook authoritative requirements?

Review can find flaws in evidence even when code looks correct.

---

# Entry Classification

Classify the Review.

## NORMAL

Execute and Verify completed normally.

## RECOVERY

Review follows a known process violation, interrupted workflow, or retroactive validation.

## RE-REVIEW

A previous Review produced findings and correction has since occurred.

## PARTIAL

Only part of the intended change is reviewable.

## AD HOC

User explicitly requested independent review outside normal lifecycle.

More than one contextual label may be mentioned if useful, but identify one primary classification.

---

# Risk-Based Review

Use Plan risk and observed implementation risk.

## LOW

Focused diff and evidence review may suffice.

## MEDIUM

Inspect changed behavior, tests, integration implications, and regression evidence.

## HIGH

Expect adversarial review of:

- boundaries;
- persistence;
- state transitions;
- integration paths;
- historical behavior;
- failure behavior;
- evidence quality;
- authoritative requirements.

## CRITICAL

Expect deep challenge of:

- data integrity;
- authorization/security;
- concurrency;
- irreversible behavior;
- migrations;
- critical state machines.

Diff size does not lower domain risk.

---

# Domain Criticality

A small change inside a critical domain remains critical-domain work.

Examples:

- attendance;
- financial state;
- authentication;
- authorization;
- migrations;
- concurrency;
- durable queues;
- lifecycle/finalization logic.

Do not infer LOW risk merely from line count.

---

# Review the Contract

Understand:

- objective;
- acceptance criteria;
- invariants;
- resolved decisions;
- explicit non-goals;
- historical-data expectations;
- compatibility requirements;
- platform expectations.

Then ask:

> Is anything materially required for safe behavior missing from the contract?

Do not silently expand scope.

If the contract itself appears incomplete:

report a CONTRACT GAP.

---

# Contract Gap

A contract gap exists when safe/correct implementation depends on behavior the approved Plan did not resolve.

Examples:

- accepted event vs rejected event semantics;
- audit behavior;
- replay behavior;
- notification behavior;
- migration/backfill semantics;
- compatibility;
- security policy;
- concurrency behavior.

Route material contract gaps to:

PLAN

or:

DISCOVER

if the underlying requirement itself is unclear.

---

# Authority Hierarchy Review

Review should consider the project's authority hierarchy rather than assuming every document has equal authority.

Typical ordering:

explicit current user decision
> approved Plan reflecting that decision
> authoritative project specification
> confirmed project requirements
> repository behavior/tests
> agent assumptions

However, chronology and informed supersession matter.

A later decision may supersede an older specification.

Review must determine whether that supersession was actually informed and intentional.

---

# Authority Conflict

An authority conflict exists when two relevant sources prescribe materially different behavior.

Examples:

- approved Plan vs authoritative specification;
- explicit user decision vs older specification;
- implementation contract vs API documentation.

Do not silently choose one.

---

# Informed Supersession Rule

When a later explicit user decision conflicts with an older specification:

ask:

> Was the user aware of the conflicting specification when making the later decision?

Possible outcomes:

## EXPLICIT SUPERSESSION

The user knowingly chose behavior different from the older source.

The later decision governs.

Record the older source as intentionally superseded.

## APPARENT UNINFORMED SUPERSESSION

The user made a later decision, but evidence shows the decision was based on incomplete or incorrect information about the older source.

Report:

CONTRACT AUTHORITY CONFLICT

Do not automatically invalidate the user's decision.

Do not automatically restore the older specification.

Route back to:

PLAN / USER DECISION

with the conflict clearly explained.

## UNCERTAIN SUPERSESSION

It is unclear whether the later decision intentionally superseded the older source.

Report the uncertainty.

Route to:

PLAN / USER DECISION.

---

# Agent-Caused Authority Conflict

If an earlier agent incorrectly told the user that:

- a rule did not exist;
- no specification covered the behavior;
- only certain options were available;

and the user made a decision based on that representation:

Review must disclose this.

Do not hide behind:

> The user decided.

The decision still has authority, but its informational basis may need reconsideration.

---

# Authority Conflict Restraint

Review may:

- quote/summarize the conflicting rules;
- explain consequences;
- identify compatibility implications;
- identify migration implications;
- ask for a renewed decision.

Review must not:

- silently choose the older spec;
- silently preserve the newer decision;
- rewrite the Plan;
- implement either interpretation.

---

# Diff-First Review

Inspect the actual final diff.

For each consequential production change ask:

- Why is this line necessary?
- What invariant does it affect?
- What other code consumes this value?
- What happens at boundaries?
- What happens on failure?
- What happens on repeated execution?
- What happens with existing data?
- What happens concurrently?
- What happens after restart?
- What assumptions are encoded?

Do not mechanically comment on every line.

Focus on consequential behavior.

---

# Change Surface

Identify both:

## Direct Surface

Files/functions explicitly changed.

## Indirect Surface

Consumers and behaviors affected without direct modification.

Examples:

changing `primary_reason` may affect:

- dashboard mappings;
- reports;
- filters;
- exports;
- SMS;
- API consumers;
- historical analytics.

Search for consumers when justified.

---

# Hidden Consumer Rule

When a changed value is persisted, serialized, returned by API, or used as an enum-like string:

search for downstream consumers.

Do not assume unchanged files are unaffected.

Check as appropriate:

- comparisons;
- filters;
- switch/match branches;
- reports;
- frontend display;
- exports;
- notifications;
- tests;
- external contracts.

---

# Semantic Collision Review

Watch for different concepts with confusingly similar names.

Examples:

`LATE_ENTRY`
vs
`late_entry`
vs
`entry_late`

Determine whether they represent:

- same concept;
- distinct concepts;
- accidental naming collision.

Do not assume casing differences are cosmetic when values cross persistence/API boundaries.

---

# Invariant Review

Identify invariants relevant to the change.

Examples:

- FINALIZED must remain terminal automatically;
- override must remain authoritative;
- duplicate scans must not duplicate effects;
- first accepted event wins;
- historical records must not silently mutate;
- authentication boundaries remain enforced.

Then determine whether:

- code preserves them;
- tests represent them;
- Verify challenged them.

---

# Boundary Review

For threshold/time/state changes inspect:

- before;
- exact boundary;
- after;
- precision;
- truncation;
- timezone;
- configuration;
- default values;
- admitted non-default values.

Look for:

- `<` vs `<=`;
- `>` vs `>=`;
- hard-coded constants;
- hidden minute/second assumptions;
- derived boundaries that only work under default configuration.

---

# Configuration-Space Review

A boundary implementation must be correct for the configuration space the application actually admits.

Do not test only:

default configuration.

Ask:

- What configurations pass validation?
- Do those configurations preserve assumptions used by the implementation?
- Can overlapping/extended windows alter the actual first state transition?
- Is the implementation deriving semantic state from configuration or assuming default relationships?

If an admitted configuration violates an implementation assumption:

that is a real finding even if defaults work.

---

# State-Machine Review

For stateful systems ask:

- What are the legal states?
- Which states are terminal?
- Who may transition them?
- Can generic upserts bypass transition rules?
- Can retries repeat transitions?
- Can concurrent writers violate them?
- Can later events undo terminal states?
- Are overrides separate from calculated state?

Review both transition logic and persistence.

---

# Persistence Review

When persistent state changes, inspect as relevant:

- transaction boundaries;
- uniqueness;
- upsert semantics;
- conditional updates;
- foreign keys;
- lifecycle fields;
- idempotency;
- rollback behavior;
- historical records;
- concurrent writers.

A pure-function test does not prove persistence invariants.

---

# Atomicity Review

If correctness depends on:

read state
→ decide
→ write

ask whether another writer can modify state between read and write.

If yes:

a read-time guard may be insufficient.

Look for:

- conditional writes;
- transaction isolation;
- version/state guards;
- lock behavior;
- idempotency keys.

Use concurrency/sqlite specialists if necessary.

---

# API Review

When API behavior is affected inspect:

- compatibility;
- status codes;
- validation;
- nullability;
- serialization;
- error semantics;
- auth/authz;
- consumer assumptions.

Do not assume unchanged route shape means unchanged contract.

---

# Frontend Review

When frontend behavior is affected inspect:

- actual API semantics;
- loading/error/empty states;
- stale state;
- raw internal values exposed to users;
- accessibility where relevant;
- type assumptions;
- responsive implications.

Do not turn Review into aesthetic preference critique.

---

# Security Review

For security-sensitive surfaces inspect:

- authentication;
- authorization;
- validation;
- privilege boundaries;
- sensitive data;
- secret handling;
- injection surfaces;
- insecure fallbacks;
- logging.

Use `security-specialist` when warranted.

Security findings are not downgraded because tests pass.

---

# Concurrency Review

When multiple actors can affect the same state inspect:

- race windows;
- stale reads;
- lost updates;
- duplicate work;
- lock scope;
- retry behavior;
- cancellation;
- shutdown.

Use `concurrency-specialist` when needed.

---

# SQLite Review

When SQLite persistence is material inspect:

- transaction boundaries;
- WAL assumptions;
- busy handling;
- connection PRAGMAs;
- upsert behavior;
- conditional updates;
- concurrent writers;
- uniqueness.

Use `sqlite-specialist` when needed.

---

# Performance Review

Review performance when:

- hot paths changed;
- burst traffic matters;
- query count changed;
- locking changed;
- loops over large data appeared;
- synchronous I/O entered request paths.

Use `performance-specialist` when warranted.

Do not demand optimization without evidence.

---

# Hardware / Platform Review

When relevant inspect:

- OS assumptions;
- device behavior;
- Windows vs Linux differences;
- Raspberry Pi constraints;
- USB lifecycle;
- service restart behavior.

Do not claim platform safety merely because shared logic tests pass.

---

# Error-Path Review

Ask what happens when:

- input invalid;
- dependency unavailable;
- DB busy;
- write partially fails;
- retry occurs;
- duplicate occurs;
- process restarts;
- external service fails.

Prioritize paths touched by the change.

---

# Historical Data Review

Ask:

- Does existing data change meaning?
- Is backfill needed?
- Is backfill accidentally occurring?
- Can current-day recomputation alter previously stored semantics?
- Are old values still understood by consumers?
- Can old and new semantic values coexist?

Separate:

historical migration

from:

normal recomputation.

---

# Compatibility Review

Check compatibility when changed values cross boundaries.

Examples:

- API strings;
- DB enum-like strings;
- serialized JSON;
- CLI output;
- config keys;
- events;
- exports.

Ask whether old and new consumers coexist safely.

---

# Test Review

Review tests as code.

Ask:

- Does the test prove the requirement?
- Does the fixture bypass the real path?
- Is expected behavior hard-coded correctly?
- Is the assertion meaningful?
- Is the test deterministic?
- Is it time-dependent?
- Does it accidentally accept multiple outcomes?
- Was a previous assertion weakened?
- Is a regression test missing?
- Can the test fail because of environment/time even when product behavior is correct?

Do not equate test count with quality.

---

# Self-Fulfilling Test Rule

Watch for tests that derive expected behavior from actual behavior.

Bad pattern:

1. perform operation;
2. observe what happened;
3. derive expected result from that observation;
4. assert consistency.

Such a test may prove internal consistency while failing to prove the requirement.

---

# Real-Clock Test Review

For wall-clock-dependent tests ask:

- Can the test run safely at midnight?
- Can it run near a minute boundary?
- Can it run in every supported timezone?
- Does it sleep and retry?
- Can all attempts become invalid due solely to time of day?
- Does the test require exact scheduling the test runner cannot guarantee?

A test that can fail the full suite during legitimate execution hours is a delivery-quality problem.

Severity depends on consequence.

---

# Flaky Test Review

Flag tests that depend unsafely on:

- wall-clock windows;
- arbitrary sleeps;
- test order;
- shared ports;
- shared DB state;
- shared caches;
- random values;
- uncontrolled external services.

Repeated passing runs do not automatically make them deterministic.

---

# Test Weakening

Treat these seriously:

- assertion removed;
- assertion broadened without requirement change;
- test skipped;
- failure ignored;
- precise expected value replaced with generic success;
- important boundary removed.

Determine whether weakening is justified by approved behavior.

---

# Observation-Only Tests

A test that:

- performs an operation;
- prints/logs the result;
- asserts only generic success;

may be useful during diagnosis.

It may have little permanent regression value.

Review should distinguish:

diagnostic observation

from:

behavioral regression protection.

---

# Evidence Freshness

Ask whether important evidence applies to the final state.

Check:

- production changes after testing;
- test changes after review;
- configuration changes;
- migration changes;
- repository fingerprint differences.

If relevant code changed:

affected evidence may be stale.

---

# Evidence Independence

Ask whether "independent" evidence truly was independent.

Potential problems:

- Test Engineer was told desired result;
- verifier reused worker assumptions;
- Reviewer relied solely on Verify;
- same test implementation was used as both implementation and independent proof;
- expected result was derived from observed result.

Do not require artificial duplication.

Require meaningful independence.

---

# Contaminated Evidence

Evidence may be weakened by:

- shared build artifacts;
- stale binaries;
- reused DB state;
- environment contamination;
- incorrect test setup.

Do not automatically discard all other evidence.

Classify which evidence is affected.

Preserve unaffected evidence.

---

# Process Violations

Preserve known process violations.

Examples:

- execution before READY;
- orchestrator edited worker-owned file;
- Verify modified repository;
- evidence contaminated by shared build artifacts.

Do not automatically convert process violations into product failures.

But ask:

> Did the violation reduce confidence in the evidence?

If yes:

that is a Review finding or evidence limitation.

---

# Out-of-Scope Findings

Review may find unrelated issues.

Do not hijack the current delivery.

Classify separately unless the issue:

- was introduced by this change;
- was worsened by this change;
- violates a critical invariant necessary for this delivery;
- blocks safe shipping;
- invalidates evidence.

Known pre-existing defects should remain out of scope unless the current change materially interacts with them.

---

# Reviewer Agent

The `reviewer` agent is the primary independent reviewer.

For HIGH/CRITICAL work, normally use it unless equivalent independent review evidence already exists and is fresh.

Give Reviewer:

- approved Plan;
- final diff;
- authoritative project sources relevant to the change;
- Execute evidence;
- Verify report;
- known limitations;
- known process violations;
- explicit instruction to search for missed correctness/safety issues.

Do not tell Reviewer the desired verdict.

---

# Reviewer Blind Independence

When the orchestrator has already found a potential issue:

prefer not to reveal the conclusion to Reviewer before its independent pass.

Good:

> Independently inspect the authoritative specification, diff, consumers, tests, and evidence for anything material that earlier phases missed.

Avoid:

> Check whether LATE_ENTRY conflicts with section 5.

unless the purpose is specifically to validate that known finding.

Independent convergence strengthens confidence.

---

# Reviewer Independence

Good:

> Independently review this change for correctness, hidden consumers, state/persistence issues, test weaknesses, authority conflicts, and anything Execute/Verify may have missed.

Bad:

> Verify that this is safe to ship.

The second wording biases toward approval.

---

# Reviewer Reuse

A previous Reviewer result may be reused only if:

- relevant production code is unchanged;
- relevant tests/evidence are unchanged enough;
- scope is unchanged;
- no later finding undermines it.

If meaningful changes occurred:

re-review affected areas.

---

# Orchestrator Validation

Reviewer findings are evidence.

The orchestrator should validate material findings when practical.

Especially:

- BLOCKING;
- MAJOR;
- authority conflicts;
- data-integrity claims;
- security claims;
- configuration edge cases.

Do not blindly copy Reviewer.

Do not redo every investigation ceremonially.

---

# Specialists

Review may consult read-only specialists.

Use only when risk/evidence justifies them.

Examples:

- `sqlite-specialist`;
- `concurrency-specialist`;
- `security-specialist`;
- `performance-specialist`;
- `api-specialist`;
- `architecture-specialist`;
- `hardware-integration`;
- `ui-ux-specialist`;
- `observability-specialist`.

Specialists advise.

Reviewer remains the primary independent review authority.

---

# Oracle

Oracle is exceptional.

Consider Oracle when:

- Reviewer and specialist materially disagree;
- high-risk correctness remains disputed;
- security/data-integrity risk remains unresolved;
- concurrency reasoning cannot be settled experimentally;
- delivery decision has serious irreversible consequence.

Do not use Oracle for routine approval.

---

# Finding Standard

A useful finding must state:

1. what is wrong or risky;
2. where it occurs;
3. evidence;
4. consequence;
5. why existing tests/verification do not close it;
6. recommended next workflow.

Avoid vague:

> This could be cleaner.

Prefer:

> An admitted configuration can make `late_cutoff + 1` remain inside the on-time entry window, so the actual first HALF_DAY minute receives the old reason instead of the approved first-minute reason. Default configuration tests do not exercise this relationship.

---

# Finding Confidence

Use:

## VERIFIED

Direct evidence establishes the issue.

## STRONGLY SUPPORTED

Evidence strongly supports it but one link remains indirect.

## POSSIBLE

Plausible but insufficiently established.

Do not block shipping on vague POSSIBLE findings without explaining the risk.

---

# Finding Severity

Use:

## BLOCKING

Unsafe to ship this change.

Examples:

- direct contract violation;
- data integrity defect;
- security defect;
- critical regression;
- evidence invalid for critical behavior.

## MAJOR

Important defect/risk normally requiring correction before delivery.

Examples:

- deterministic test can fail under legitimate execution conditions and break the suite;
- material configuration edge case violates approved behavior;
- significant compatibility problem.

## MINOR

Real but limited issue.

## NOTE

Observation, cleanup, future improvement, or non-defect.

Do not inflate formatting/style.

---

# Severity by Consequence

Severity is based on consequence, not apparent code size.

Examples:

A 20-line flaky test that can fail CI nightly may be MAJOR.

A production naming inconsistency with no behavioral effect may be NOTE.

A one-character authorization bug may be BLOCKING.

---

# Review Design Restraint

Review should identify:

- violated invariant;
- required correction outcome;
- constraints the correction must preserve.

Review should normally NOT prescribe:

- exact code expression;
- exact SQL statement;
- exact transaction design;
- exact architecture;
- exact refactor sequence;

unless the approved Plan already established it or the implementation consequence is trivial and non-discretionary.

---

# Correction Outcome vs Implementation

Good finding:

> Required correction: `LATE_ENTRY` must apply to the actual first HALF_DAY entry minute for every admitted configuration. Current derivation fails when the entry window extends beyond the nominal cutoff.

Potential direction:

> Deriving from the actual transition boundary may solve this, but Plan/Execute owns the implementation.

Avoid:

> Change line 104 to `max(cutoff, late_cutoff) + 1`.

unless that exact implementation is already authorized.

---

# Architecture Restraint

Review may say:

> A read-then-write guard is insufficient because another writer can finalize between those operations.

Review should not automatically decide:

> Use BEGIN IMMEDIATE plus UPDATE ... WHERE record_status='OPEN'.

That belongs to Plan unless already established.

---

# Review Outcomes

Choose exactly one:

## APPROVE

No material findings block progression.

## APPROVE WITH NOTES

No blocking/major correction required, but meaningful non-blocking observations exist.

## CHANGES REQUIRED

One or more findings require correction or renewed decision before progression.

## BLOCKED

Review cannot be completed because required evidence/context/environment is unavailable.

Do not use ambiguous outcomes such as:

"mostly approved."

---

# Approval Standard

APPROVE requires:

- contract understood;
- relevant authority sources considered;
- final diff reviewed;
- material indirect consumers considered;
- relevant invariants challenged;
- evidence package assessed;
- no unresolved BLOCKING or MAJOR findings;
- no unresolved material authority conflict;
- repository immutability established sufficiently for the review context.

APPROVE WITH NOTES has the same correctness threshold.

The difference is presence of meaningful non-blocking findings.

---

# Changes Required

Use CHANGES REQUIRED when:

- a blocking defect exists;
- a material major defect exists;
- contract gap prevents safe delivery;
- authority conflict requires renewed user decision;
- evidence for critical behavior is materially inadequate;
- tests are materially misleading or unsafe;
- final code differs from verified/reviewed state in a consequential way.

Do not fix during Review.

---

# Finding Routing

Route based on the finding.

## Known defect, root cause unclear

→ DEBUG

## Known defect, correction fully determined and authorized

→ EXECUTE

## Product/architecture decision required

→ PLAN

## Authority conflict requiring renewed decision

→ PLAN / USER DECISION

## Requirement unclear

→ DISCOVER

## Evidence missing but code not known defective

→ VERIFY

## Delivery/packaging issue

→ SHIP only if it belongs to shipping mechanics;
otherwise appropriate workflow.

---

# Multiple Findings Routing

Different findings may require different workflows.

Example:

Finding 1:
authority conflict
→ PLAN

Finding 2:
known deterministic test defect
→ EXECUTE

Finding 3:
possible race with unclear cause
→ DEBUG

Do not force every finding through the same workflow.

If one finding requires Plan before others can safely proceed:

Plan may become the next overall workflow.

---

# Re-Review

After correction:

review affected areas again.

Do not automatically redo the entire review if:

- correction is narrow;
- unaffected evidence remains fresh.

But broaden re-review when:

- architecture changed;
- persistence changed;
- concurrency changed;
- security changed;
- contract changed;
- correction touched multiple consumers.

---

# Re-Review Freshness

If Plan changes the contract after Review:

previous Review approval is stale for the affected behavior.

If Execute changes only a test:

production-code findings may remain fresh, but test-quality findings require re-review.

Use scope-aware freshness.

---

# No Perfection Loop

Review is not permission to polish indefinitely.

Do not require correction for:

- harmless formatting;
- subjective naming;
- optional refactors;
- stylistic preferences;
- speculative future abstractions;

unless they create material correctness/maintenance risk.

A reviewer should know when to stop.

---

# Review Efficiency

Reuse fresh evidence.

Do not:

- rerun the entire test suite solely because Review exists;
- repeat Verify's exact experiments without reason;
- invoke every specialist;
- reconstruct RED mechanically;
- inspect unrelated files endlessly.

Spend effort where:

risk × uncertainty

is highest.

---

# Review Report

Return:

## Review Objective

What change/evidence package is being reviewed.

---

## Review Entry

**Classification:**

NORMAL / RECOVERY / RE-REVIEW / PARTIAL / AD HOC

**Plan Risk:**

LOW / MEDIUM / HIGH / CRITICAL

**Execute Status:**

...

**Verify Status:**

...

**Known Process Violations:**

...

---

## Repository Snapshot

**Base:**

...

**Changed files:**

...

**Initial fingerprint:**

...

**Final fingerprint:**

...

**Repository modified by Review:**

NO / YES / UNCONFIRMED

**Provenance:**

...

---

## Contract Summary

### Objective

...

### Material Requirements

- ...

### Invariants

- ...

### Explicit Non-Goals

- ...

---

## Authority Review

### Sources Checked

- ...

### Conflicts

None.

or:

#### Conflict 1

**Sources:**

...

**Nature of conflict:**

...

**Supersession status:**

EXPLICIT / APPARENTLY UNINFORMED / UNCERTAIN

**Consequence:**

...

**Required workflow:**

PLAN / USER DECISION / NONE

---

## Change Surface

### Direct

- ...

### Indirect Consumers Checked

- ...

### Persistence / State Impact

...

### API / Frontend Impact

...

---

## Evidence Review

### Execute Evidence

**Strengths:**

...

**Weaknesses:**

...

### Verify Evidence

**Strengths:**

...

**Weaknesses:**

...

### Freshness

...

### Independence

...

### Contaminated / Limited Evidence

...

---

## Adversarial Review

For each material challenge:

### `<question>`

**Evidence inspected:**

...

**Conclusion:**

...

---

## Findings

Order by severity.

### Finding 1 — `<title>`

**Severity:**

BLOCKING / MAJOR / MINOR / NOTE

**Confidence:**

VERIFIED / STRONGLY SUPPORTED / POSSIBLE

**Location:**

...

**Evidence:**

...

**Consequence:**

...

**Why existing verification does/does not cover it:**

...

**Required correction outcome:**

...

**Implementation constraints:**

...

**Possible direction, if useful:**

...

**Recommended workflow:**

DEBUG / EXECUTE / PLAN / DISCOVER / VERIFY / FOLLOW-UP

Repeat as needed.

If none:

None.

---

## Contract Gaps

- ...

or:

None.

---

## Out-of-Scope Findings

- ...

or:

None.

---

## Specialist Input

**Used:**

...

**Material conclusions:**

...

or:

None.

---

## Test Review

**Coverage quality:**

...

**Determinism:**

...

**Weakening detected:**

YES / NO

**Observation-only tests:**

...

**Missing material regression test:**

...

---

## Remaining Risks

- ...

---

## Repository Immutability

**Initial state captured:**

YES / NO

**Final state captured:**

YES / NO

**Fingerprint match:**

YES / NO / UNCONFIRMED

**Repository modified by Review:**

NO / YES / UNCONFIRMED

**Reason for uncertainty, if any:**

...

---

## Review Outcome

Choose exactly one:

APPROVE

APPROVE WITH NOTES

CHANGES REQUIRED

BLOCKED

**Reason:**

...

---

## Next Workflow

If APPROVE:

SHIP

when Verify is current and shipping prerequisites are satisfied.

If APPROVE WITH NOTES:

SHIP may proceed if notes are genuinely non-blocking.

If CHANGES REQUIRED:

route each material finding to:

DEBUG / PLAN / EXECUTE / VERIFY

as appropriate.

If an authority conflict requires user decision:

PLAN / USER DECISION

comes before implementation.

If BLOCKED:

state exactly what is needed.

---

# Review Self-Check

Before approval ask:

1. Did I understand the approved contract?
2. Did I inspect relevant authoritative project sources rather than assuming earlier agents found them?
3. Did I identify authority conflicts?
4. If a later user decision conflicts with an older source, did I determine whether supersession was informed?
5. Did I avoid silently overriding the user's explicit decision?
6. Did I inspect the actual final diff?
7. Did I inspect indirect consumers where changed values cross boundaries?
8. Did I check the admitted configuration space, not only defaults?
9. Did I challenge relevant state/persistence invariants?
10. Did I consider concurrency where multiple writers exist?
11. Did I inspect error/failure paths relevant to the change?
12. Did I assess historical-data behavior?
13. Did I inspect tests rather than only trust their result?
14. Did I look for weakened tests?
15. Did I assess test determinism and wall-clock dependence?
16. Did I distinguish diagnostic observation tests from regression tests?
17. Did I evaluate evidence freshness?
18. Did I evaluate evidence independence?
19. Did I identify contaminated evidence without discarding unrelated valid evidence?
20. Did I preserve known process violations?
21. Did I avoid turning unrelated findings into scope expansion?
22. Did I avoid style/perfection-loop findings?
23. Did I distinguish VERIFIED from POSSIBLE?
24. Did I assign severity by consequence rather than preference?
25. Did I describe the required correction without unnecessarily designing the implementation?
26. Did I route each finding to the correct workflow?
27. Did Review leave the active repository unchanged?
28. If repository immutability could not be established, did I report UNCONFIRMED instead of assuming NO?
29. Would I still reach this verdict if the implementation author were not present to explain intent?
30. Did I reach my own conclusion rather than echo Verify?

If a critical answer is unknown:

do not rubber-stamp approval.

---

# Completion Principle

Review succeeds when it independently challenges:

the delivered change;

the approved contract;

the authority behind that contract;

and:

the evidence used to justify the change.

Its purpose is not to produce more activity.

Its purpose is to catch material mistakes that implementation and verification can share.

A successful Review may discover:

- a code defect;
- a test defect;
- an evidence defect;
- a configuration defect;
- a contract gap;
- an authority conflict;
- or nothing material at all.

Review must remain:

independent;
adversarial;
read-only;
risk-based;
diff-aware;
evidence-aware;
authority-aware;
scope-controlled;
implementation-design restrained;
non-ceremonial;
honest about uncertainty.

If nothing material is wrong:

approve.

If only genuine non-blocking issues remain:

approve with notes.

If material correction or renewed decision is required:

require changes.

If evidence is insufficient to review responsibly:

block.
