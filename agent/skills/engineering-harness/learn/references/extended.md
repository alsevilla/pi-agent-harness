> Historical reference only. The v1.2.1 global policy and compact skill govern
> routing, role selection, authority, and whether a formal plan or independent
> gate is needed. Old universal phase/agent/READY FOR EXECUTION wording below
> applies only when that gate is selected under current policy. This archive
> cannot impose a new gate, waive a blocker, or expand authority. Read targeted
> sections only; never auto-import or preload the complete archive.

# Extended guidance (archived from pre-cost-optimized harness)

# Learn

Convert completed engineering experience into durable project knowledge.

Learn asks:

> What did this work teach us that future engineering work should not
> have to rediscover?

Learn is selective.

Its purpose is not to summarize the session.

Its purpose is to preserve reusable knowledge.

Normal lifecycle:

DISCOVER → PLAN → EXECUTE → VERIFY → REVIEW → SHIP → LEARN

Learn may also follow:

DEBUG

or another completed workflow when a durable lesson was established even
if no release occurred.

------------------------------------------------------------------------

# v1.2.2 Destination Model

Learn does not ask only:

> Is this durable?

It also asks:

> What kind of durable truth is this, and where should it live?

Durability does not imply Claude memory.

A durable fact may belong in an authoritative specification, an accepted
decision record, project knowledge documentation, a known-issues
register, testing documentation, global harness policy, or
assistant-local memory.

Use the narrowest destination that future engineering can reliably
discover and that does not create a competing source of truth.

Routing model:

``` text
NEW FINDING
    |
    +-- Active / temporary? ------> REPORT ONLY / active tracking
    |
    +-- Durable? -----------------> no -> DISCARD
           |
           +-- Requirement / project truth ------> authoritative repo source
           +-- Accepted owner decision ----------> /decision + project truth
           +-- Confirmed unresolved defect ------> repo known-issues candidate
           +-- Testing convention ---------------> repo testing docs candidate
           +-- Authority/navigation map ---------> repo knowledge/index candidate
           +-- Global harness rule --------------> skill / CLAUDE.md candidate
           +-- Assistant-local retrieval hint, tool quirk, or expensive-to-rediscover local context
                                                  -> Claude project memory candidate
```

Do not route by convenience.

Route by ownership of truth.

------------------------------------------------------------------------

# Core Principle

Preserve knowledge, not history.

Bad project memory:

> We ran cargo test, then the debugger found a problem, then the
> reviewer looked at three files.

Useful project memory:

> Alternate Rust worktrees used for isolated baseline/RED verification
> require unique `CARGO_TARGET_DIR` values when shared build artifacts
> could contaminate the evidence boundary.

The first is chronology.

The second changes future engineering behavior.

------------------------------------------------------------------------

# Learn Is Not a Session Summary

Do not record:

-   every command;
-   every agent invocation;
-   every failed hypothesis;
-   every intermediate status;
-   every temporary file;
-   conversational history;
-   routine implementation details;
-   obvious facts visible directly from code.

Learn should reduce future rediscovery.

Not increase reading burden.

------------------------------------------------------------------------

# Learn Is Not a Task Tracker

Learn MUST NOT persist temporary work state merely to preserve
cross-session continuity.

Do not use durable engineering memory for:

-   current TODOs;
-   pending corrections;
-   pending cleanup;
-   temporary artifacts;
-   current working-tree state;
-   pending user decisions;
-   unresolved release findings;
-   "do this next" lists;
-   current branch status;
-   current test counts;
-   temporary worktree locations;
-   temporary build directories;
-   items marked "delete when resolved."

These belong in:

-   the project's existing planning system;
-   issue tracker;
-   active plan;
-   explicitly designated active-work file;
-   release tracker;
-   temporary session context.

The absence of a tracker does not make temporary state durable
knowledge.

------------------------------------------------------------------------

# Active Work Barrier

Before persisting any unresolved or incomplete item, ask:

> Is this a durable engineering constraint, or merely unfinished work?

If it is unfinished work:

DO NOT persist it as durable knowledge.

Report it under:

Unresolved Items

in the Learn report instead.

Examples of temporary active work:

Bad:

> Fix the flaky scan test, delete the debugger worktree, rerun Verify,
> then Review.

Bad:

> User still needs to choose option A or B for LATE_ENTRY.

Bad:

> Remove the 1.7 GB temporary Cargo target.

These are task state.

Do not put them in durable memory.

------------------------------------------------------------------------

# Durable Unresolved Constraint

An unresolved item may be persisted only when the unresolved state
itself is a durable engineering constraint that future work must not
accidentally assume away.

Example:

> Finalized-scan correction semantics are intentionally unresolved. Do
> not implement reject, audit-only, SMS, replay, or legacy-write
> behavior until an approved Plan resolves those semantics.

This is useful because future engineering must avoid inventing policy.

It does not prescribe which policy wins.

Use this form sparingly.

------------------------------------------------------------------------

# Durable vs Temporary Unresolved Knowledge

Ask:

## Temporary

Will this disappear after the current task is completed?

If yes:

do not persist.

## Durable Constraint

Could future unrelated work accidentally make an unsafe assumption if it
does not know this remains unresolved?

If yes:

a narrowly worded unresolved constraint may be durable.

Never persist the current correction checklist around it.

------------------------------------------------------------------------

# Learn Is Not Documentation Cleanup

Learn does not automatically:

-   rewrite README;
-   update all docs;
-   reorganize documentation;
-   create architecture diagrams;
-   clean comments;
-   write tutorials.

If project documentation itself must change:

route through the appropriate Plan/Execute workflow unless the approved
task already includes it.

Learn owns durable engineering memory.

------------------------------------------------------------------------

# Learn Is Not Plan

Learn records established knowledge.

It does not decide unresolved future behavior.

Do not convert:

> We haven't decided how remote replay should work.

into:

> Remote replay should reject finalized events.

That is a decision for Plan.

Learn may preserve the narrower durable constraint:

> Remote replay semantics for finalized attendance remain intentionally
> unresolved and must not be assumed by implementation work.

But only when future work materially needs that warning.

------------------------------------------------------------------------

# Learn Is Not Debug

Debug establishes why something failed.

Learn extracts the reusable lesson.

Example:

Debug:

> Shared Cargo target artifacts contaminated the alternate-worktree
> baseline.

Learn:

> Rust worktree isolation requires a unique `CARGO_TARGET_DIR`; do not
> use the primary target directory or broad `cargo clean` as a
> substitute.

------------------------------------------------------------------------

# Learn Is Not Review

Review finds missed risks and defects.

Learn asks:

> Which review discovery represents a durable rule or recurring pitfall?

Not every Review finding deserves permanent memory.

------------------------------------------------------------------------

# Learn Is Not Ship

Ship establishes delivery state and release provenance.

Learn may preserve recurring release knowledge such as:

-   platform-specific packaging requirement;
-   migration recovery constraint;
-   service deployment invariant.

Do not preserve one-off artifact hashes or release timestamps as durable
engineering knowledge unless the project explicitly requires a release
ledger.

------------------------------------------------------------------------

# Entry Conditions

Learn may run when there is sufficient established evidence from:

-   completed Execute;
-   Verify;
-   Review;
-   Ship;
-   Debug;
-   explicit user decision;
-   resolved incident;
-   established architectural work.

Learn does not require SHIPPED status.

A failed workflow can still teach something durable.

Example:

Review CHANGES REQUIRED may expose a recurring specification-authority
problem worth preserving.

------------------------------------------------------------------------

# Evidence Retrieval Barrier

Before rejecting a candidate from completed prior work as not
established, distinguish the evidence state.

Use exactly one:

## ESTABLISHED

Sufficient current or recovered evidence supports the claim.

## CONTRADICTED

Current authoritative or stronger evidence materially conflicts with the
claim.

## UNVERIFIED

The claim has been inspected, but available evidence is insufficient to
establish or contradict it.

## EVIDENCE NOT RETRIEVED

The candidate refers to a prior expensive discovery, incident, Debug
result, Verify result, Review result, demonstrated process failure, or
other historical evidence that has not yet been recovered.

Absence from current repository documentation or Claude memory is not
evidence that a lesson was never established.

Do not reason:

> I cannot find it in current docs or memory, therefore it was not
> established.

Instead:

1.  identify what kind of evidence originally could have established the
    claim;
2.  inspect the appropriate available completed-work evidence when
    reasonably accessible;
3.  use `/knowledge` when authority/current-truth reconciliation is
    needed;
4.  distinguish failure to retrieve evidence from evidence that
    contradicts the claim;
5.  if sufficient evidence still cannot be recovered, classify the
    candidate `EVIDENCE NOT RETRIEVED`;
6.  do not persist the candidate as established truth until the evidence
    threshold is met.

Historical evidence retrieval does not authorize promotion by
recollection alone.

A prior summary, Claude memory entry, user prompt, or candidate wording
may tell Learn where to look. It does not itself prove the claim unless
it has the required authority/evidence for that type of knowledge.

For expensive-to-rediscover lessons, make a reasonable retrieval attempt
before using `DISCARD`.

If the relevant evidence is unavailable, use:

`NEEDS EVIDENCE`

rather than inventing certainty.

Never convert:

> I could not recover the evidence.

into:

> The claim is false.

or:

> The lesson never existed.

This barrier is especially important for prior Debug root causes, Verify
isolation failures, Review-discovered recurring risks, production
incidents, hardware/environment discoveries, demonstrated process
failures, historical decisions, and expensive testing lessons.

Evidence retrieval must remain proportional. Do not reread the entire
project history for a trivial candidate.

## Historical Evidence Provenance

When a candidate depends on a prior incident, Debug result, Verify result,
Review finding, process failure, or other historical event, distinguish:

-   evidence of the underlying event;
-   a contemporaneous report produced from that event;
-   a later summary or recollection of the event;
-   text that merely repeats the candidate claim.

Reasonably accessible historical sources may include:

-   completed workflow reports;
-   retained session transcripts;
-   subagent or delegation logs;
-   Git history and committed artifacts;
-   issue/review records;
-   repository documentation created from the completed work;
-   other retained evidence produced by the original workflow.

A historical source is useful only for what it actually proves.

Treat these as circular when they merely repeat the claim being evaluated:

-   the current user prompt;
-   the current runtime-test prompt;
-   skill examples or skill text;
-   candidate wording;
-   a delegation prompt that was itself seeded with the claim;
-   a transcript passage that only quotes one of those sources.

Circular repetition is not independent recovery.

A later assistant summary or secondhand statement may be a retrieval lead or
corroboration, but it does not by itself establish the underlying event when
the durable lesson depends on details the summary does not prove.

Example:

> "A shared Cargo-target contamination incident happened."

A later summary saying that contamination once occurred may justify searching
for the original Verify/Debug evidence. It does not establish that the event
occurred during baseline/RED reconstruction, that shared artifacts were the
cause, or that a unique `CARGO_TARGET_DIR` was the demonstrated correction
unless those details are independently supported.

If only circular or secondhand evidence is recovered:

`EVIDENCE STATE: EVIDENCE NOT RETRIEVED`

unless other sufficient evidence independently establishes the claim.

Do not upgrade a claim from `EVIDENCE NOT RETRIEVED` to `ESTABLISHED` merely
because multiple later prompts, summaries, or skill examples repeat it.

------------------------------------------------------------------------

# Evidence Threshold

Do not persist a lesson merely because an agent suggested it.

Durable knowledge should normally be supported by one or more of:

-   explicit user decision;
-   authoritative project specification;
-   confirmed root cause;
-   verified behavior;
-   reviewed architecture;
-   repeated project evidence;
-   demonstrated process failure;
-   target-environment evidence.

If evidence is weak:

do not promote it to durable project memory.

------------------------------------------------------------------------

# Compound Claim Decomposition

Before assigning one evidence state, destination, or action to a candidate,
check whether the wording contains multiple independently testable claims.

Split a compound candidate when its parts can differ in:

-   evidence state;
-   authority;
-   durability;
-   scope;
-   destination;
-   or action.

Do not let one supported clause promote an unsupported clause.

Do not let one contradicted generalization cause a narrower unresolved claim
to be discarded as false.

Example compound statement:

> During an earlier isolated baseline/RED reconstruction, shared Cargo build
> artifacts contaminated the evidence, therefore isolated evidence worktrees
> require a unique `CARGO_TARGET_DIR`, and all worktrees should always use
> unique Cargo targets.

Evaluate separately:

1.  **Historical incident:** Did the contamination event occur with the stated
    circumstances and cause?
2.  **Narrow lesson:** Does recovered evidence establish a unique target as
    the required isolation rule for evidence-sensitive worktrees when shared
    artifacts could contaminate the evidence boundary?
3.  **Broad generalization:** Must all ordinary development worktrees always
    use unique targets?

Possible result:

-   historical incident -> `EVIDENCE NOT RETRIEVED`;
-   narrow lesson -> `NEEDS EVIDENCE` until the establishing evidence is
    recovered;
-   broad generalization -> `CONTRADICTED` when current repository convention
    explicitly uses a shared target for ordinary worktrees.

The evidence state of one subclaim must not leak into another.

After decomposition, route each material subclaim independently. Merge them
back into one durable entry only if they ultimately share compatible evidence,
authority, destination, and wording.

------------------------------------------------------------------------

# Knowledge Candidates

Extract candidates from questions such as:

-   What assumption turned out to be false?
-   What rule was expensive to rediscover?
-   What invariant must future changes preserve?
-   What architectural decision should not be reopened casually?
-   What environment behavior caused misleading evidence?
-   What testing pattern failed?
-   What configuration relationship is non-obvious?
-   What operational constraint matters repeatedly?
-   What review finding reveals a recurring risk?
-   What user decision should future agents know?
-   What process failure should never recur?

Do not automatically treat unfinished work as a candidate.

------------------------------------------------------------------------

# Durable Knowledge Test

Before recording a candidate ask:

## 1. Will this likely matter again?

If no:

discard.

## 2. Is it difficult or costly to rediscover?

If no:

prefer source code/spec rather than memory.

## 3. Is it stable enough to persist?

If likely temporary:

discard or keep in active task tracking.

## 4. Is it supported by evidence?

If speculative:

discard or label unresolved elsewhere.

## 5. Does it change future behavior?

If future agents would act the same without it:

probably discard.

## 6. Is it knowledge rather than current task state?

If it describes what remains to be done:

do not persist it as durable knowledge.

------------------------------------------------------------------------

# Knowledge Categories

Classify each accepted lesson as exactly one primary category.

## DECISION

An intentional engineering/product choice that future work should
preserve unless explicitly reconsidered.

Examples:

-   lunch tracking is optional per school;
-   first accepted event of each attendance type wins.

## INVARIANT

A property that must remain true across implementations.

Examples:

-   admin override must remain authoritative over automatic
    recalculation;
-   FINALIZED records must not automatically reconcile late events.

## PATTERN

A reusable preferred implementation/testing/operational approach.

Examples:

-   use independent Test Engineer after worker TDD;
-   use unique build directories for alternate worktrees.

## PITFALL

A known failure mode or misleading approach.

Examples:

-   wall-clock exact-minute tests can become suite-flaky;
-   shared Cargo targets can contaminate baseline reconstruction.

## ENVIRONMENT

A durable fact about build/runtime/deployment environment.

Examples:

-   production uses Raspberry Pi/Linux and Windows NUC targets;
-   RFID readers are local USB devices rather than network readers.

## PROCESS

A durable workflow/governance lesson.

Examples:

-   confirmed root cause does not imply correction semantics are ready;
-   Review must consult authoritative specs rather than relying solely
    on Plan summaries.

------------------------------------------------------------------------

# No STATUS Category

Do not create a knowledge category for:

STATUS TODO CURRENT WORK OPEN WORK FOLLOW-UP

Those belong outside durable engineering memory.

If a proposed entry naturally wants one of those categories:

reject it or route it to active tracking.

------------------------------------------------------------------------

# Decision vs Invariant

Use DECISION when the behavior exists because it was intentionally
chosen.

Use INVARIANT when future implementations must preserve the property
regardless of internal design.

A user decision may produce both, but avoid duplicating the same
statement.

Prefer the form most useful to future engineering.

------------------------------------------------------------------------

# Pattern vs Process

PATTERN usually describes:

how technical work should be performed.

PROCESS usually describes:

how the engineering workflow governs decisions and evidence.

Example:

PATTERN: Use a unique Cargo target directory for isolated worktrees.

PROCESS: A worker's TDD evidence does not replace independent Test
Engineer verification.

------------------------------------------------------------------------

# Pitfall Quality

A PITFALL should include enough causal information to prevent
recurrence.

Weak:

> Cargo caching caused problems.

Strong:

> Reusing the same Cargo target directory across current and baseline
> worktrees can execute contaminated/stale build artifacts and
> invalidate RED reconstruction. Use a unique `CARGO_TARGET_DIR` per
> isolated worktree.

------------------------------------------------------------------------

# Source of Truth Principle

Do not duplicate authoritative information unnecessarily.

If a stable rule already exists clearly in an authoritative project
specification:

prefer referencing that source rather than copying the entire rule into
engineering memory.

Learn should preserve:

-   decisions;
-   cross-cutting invariants;
-   non-obvious consequences;
-   discovered pitfalls;
-   workflow knowledge;

not create competing specifications.

------------------------------------------------------------------------

# Authority Safety

Before recording a DECISION or INVARIANT:

check whether it conflicts with:

-   current user decision;
-   approved Plan;
-   authoritative specification;
-   newer reviewed decision.

If conflict exists:

do not silently choose.

Record only established authority.

If authority remains unresolved:

do not promote either interpretation to durable truth.

------------------------------------------------------------------------

# Authority Conflict Memory

When an authority conflict itself matters durably:

record only the conflict boundary, not either disputed rule as truth.

Good:

> The meaning of `LATE_ENTRY` is currently subject to an unresolved
> authority conflict between the attendance specification and a later
> implementation decision. Future work must resolve the conflict through
> Plan before treating either interpretation as canonical.

Bad:

> `LATE_ENTRY` means only the first half-day minute.

Bad:

> `LATE_ENTRY` means every entry after the half-day cutoff.

------------------------------------------------------------------------

# Superseded Knowledge

When a new decision intentionally replaces an old one:

do not leave both as equally current.

Mark the old knowledge:

SUPERSEDED

or update it according to the storage format.

Preserve enough history to understand why if useful.

Do not force future agents to guess which rule is active.

------------------------------------------------------------------------

# Unresolved Knowledge

Do not record unresolved choices as established facts.

Use:

UNRESOLVED

only when preserving the existence of the unresolved constraint
materially prevents future accidental assumptions.

Example:

> UNRESOLVED: Whether accepted scans against FINALIZED attendance should
> be rejected or retained only as audit events. Do not implement until
> Plan resolves event/audit/SMS/replay semantics.

Use sparingly.

Do not attach the current task checklist to the entry.

------------------------------------------------------------------------

# Knowledge Scope

Classify scope.

## PROJECT

Specific to the current repository/system.

Example:

> RFID readers are local USB devices attached directly to the host.

## GLOBAL PROCESS

Applies to the user's engineering harness across projects.

Example:

> Verify must not modify active repository tests.

## DOMAIN

Applies broadly to a recurring technical domain.

Example:

> SQLite lifecycle guards that depend on read-then-write state require
> atomicity analysis.

Default to PROJECT unless clearly broader.

------------------------------------------------------------------------

# Storage Principle

Store knowledge at the narrowest correct scope.

Do not put RFID attendance rules into global engineering memory.

Do not bury global workflow invariants inside one project.

------------------------------------------------------------------------

# Destination Classification

After a candidate passes the Durable Knowledge Test, classify its
destination before writing.

Use exactly one primary destination class. References may point
elsewhere, but do not duplicate the full truth across stores.

## AUTHORITATIVE PROJECT TRUTH

Use when the candidate is a requirement, invariant, architecture
boundary, operating rule, or other project fact that future humans and
agents must treat as project truth.

Preferred destination is the existing authoritative repository
documentation for that domain.

Examples:

-   attendance engine business rules;
-   supported deployment topology;
-   schema meaning;
-   API contract;
-   security policy;
-   lifecycle invariant.

Do not hide project truth only in Claude memory.

If the authoritative source must be changed but Learn is not authorized
to edit it:

`DESTINATION: AUTHORITATIVE PROJECT TRUTH — WRITE NOT AUTHORIZED`

Report the candidate and route the documentation change through the
appropriate workflow.

## ACCEPTED DECISION

Use when the candidate exists because an authorized owner intentionally
selected among materially different alternatives.

Accepted decisions must satisfy `/decision` semantics.

Learn may consume an already ACCEPTED decision.

Learn must not create acceptance.

If acceptance is uncertain:

`DESTINATION: DECISION`

`ACTION: NEEDS DECISION`

Do not write it as policy or memory.

When accepted, prefer the project's durable decision/specification
surface rather than Claude memory.

## CONFIRMED KNOWN ISSUE

Use when a defect or dangerous divergence is confirmed and unresolved,
and future work materially benefits from knowing it exists.

This is different from active task state.

Durable issue knowledge may include:

-   observed invariant violation;
-   reproducible symptom;
-   confirmed root cause;
-   affected subsystem;
-   safety constraint around the defect.

Do not include:

-   current assignee;
-   current branch;
-   current fix attempt;
-   temporary worktree;
-   current Plan state;
-   cleanup checklist;
-   "fix next" instructions.

Preferred destination is an existing issue tracker or repository
known-issues surface when one exists.

Claude memory is not the primary home for confirmed project defects that
other engineers need to see.

## TESTING CONVENTION

Use for stable, non-obvious test seams, isolation requirements, fixture
conventions, or verification techniques that repeatedly affect
correctness.

Examples:

-   deterministic clock seam required for exact boundary tests;
-   isolated Rust worktrees require unique `CARGO_TARGET_DIR`;
-   hardware-dependent verification requires a particular supported
    seam.

Prefer existing testing/contributor documentation when the convention is
useful to the project team.

Use assistant-local memory only when the fact is genuinely tool-local
and not project engineering policy.

## KNOWLEDGE / AUTHORITY NAVIGATION

Use for durable maps that tell future work where truth lives without
duplicating the truth itself.

Examples:

-   which spec governs attendance-engine rules;
-   which document governs API behavior;
-   where schema truth is maintained;
-   which docs are historical only.

Preferred destination is a thin repository knowledge/index document when
the project lacks a clear map.

Do not turn the index into another specification.

## ASSISTANT-LOCAL CONTEXT

Use Claude project memory only for durable context whose main value is
helping the assistant navigate or operate efficiently and which does not
need to be authoritative project truth.

Good candidates:

-   non-obvious repository navigation hint;
-   tool-specific quirk;
-   expensive-to-rediscover local workflow seam not suitable for team
    docs;
-   stable local environment behavior that improves future assistant
    operation.

Bad candidates:

-   product requirements;
-   accepted product decisions;
-   confirmed project defects that teammates need to know;
-   pending decisions;
-   active work;
-   dirty working-tree state;
-   temporary paths;
-   current test counts;
-   current lifecycle status.

Assistant-local memory is contextual evidence.

It is not project authority.

## GLOBAL HARNESS KNOWLEDGE

Use when the lesson changes the user's engineering harness across
repositories.

Preferred destination is the relevant global skill, agent definition, or
`~/.pi/agent/CLAUDE.md`, subject to frozen-skill discipline and explicit
modification authorization.

Do not bury global harness rules in one project's memory.

------------------------------------------------------------------------

# Destination Precedence

When a candidate could fit more than one store, prefer the store that
owns the truth.

Use this order as a routing heuristic, not an authority hierarchy:

1.  authoritative domain specification or contract;
2.  accepted project decision surface;
3.  project issue / known-issues surface;
4.  project testing / contributor documentation;
5.  project knowledge / authority index;
6.  global harness source when globally scoped;
7.  Claude project memory for assistant-local context.

Do not use Claude memory merely because it is easiest to write.

Do not duplicate a requirement into memory just to make retrieval
convenient.

Prefer a navigation pointer to the authoritative source.

------------------------------------------------------------------------

# Knowledge and Decision Integration

Use `/knowledge` when a candidate's current authority, conflict state,
implementation divergence, or memory validity is not already
established.

Use `/decision` when a candidate depends on an owner choice that is not
already ACCEPTED.

Learn must respect these boundaries:

``` text
/knowledge -> establishes what is known
/decision  -> establishes what is chosen
/learn     -> routes established durable knowledge
```

Learn must not recreate `/knowledge` authority reasoning from stale
summaries when material authority is uncertain.

Learn must not recreate `/decision` by treating recommendations,
historical plans, or memory as acceptance.

------------------------------------------------------------------------

# Accepted Decision Barrier

Before routing a candidate as an accepted decision, verify that its
state is actually:

-   ACCEPTED; or
-   ACCEPTED WITH CONDITIONS.

The following are not accepted decisions:

-   PROPOSED;
-   NEEDS DECISION;
-   NEEDS CLARIFICATION;
-   UNKNOWN;
-   a recommendation;
-   a historical plan choice without current authority;
-   implementation behavior;
-   a memory claim that the user once chose something.

If acceptance is not established:

`ACTION: NEEDS DECISION`

Do not persist the proposed policy.

------------------------------------------------------------------------

# Pending Decision Barrier

A pending product decision is normally active decision state, not
durable memory.

Do not write:

> User still needs to choose A or B.

Do not write:

> Current decision is pending.

Do not use Claude memory as a cross-session pending-decision tracker.

If future work needs protection from unsafe assumptions, preserve only a
stable constraint already established by authoritative evidence.

Example:

Good:

> FINALIZED attendance records must not automatically recalculate.
> Handling of post-finalization scans requires an accepted policy before
> implementation may add new behavior.

Bad:

> D1/D2/D3 are still pending and the user needs to answer them next
> session.

The first preserves an invariant and decision boundary.

The second stores active decision state.

------------------------------------------------------------------------

# Persistence Authorization Barrier

Durability and destination readiness do not automatically authorize a
write.

Separate:

``` text
DURABLE?
   |
DESTINATION?
   |
READY TO PERSIST?
   |
WRITE AUTHORIZED?
```

A user may authorize Learn to persist durable knowledge generally. That
authorization covers only surfaces that Learn is allowed to own under
the current workflow and user request.

It does not silently authorize:

-   rewriting authoritative product specifications;
-   changing accepted project policy;
-   editing production code;
-   editing tests;
-   modifying frozen skills;
-   creating a new documentation hierarchy;
-   writing external memory when the user prohibited memory changes.

When the correct destination is outside Learn's authorized write
surface:

`DURABLE — CORRECT DESTINATION IDENTIFIED — WRITE NOT AUTHORIZED`

Report the route instead of writing to a weaker store.

Never fall back to Claude memory merely because the correct repository
destination requires a separate authorized workflow.

------------------------------------------------------------------------

# Project Engineering Memory

When durable project memory is useful, prefer an existing established
documentation system.

If none exists, a possible structure is:

`.engineering/   PROJECT.md   ARCHITECTURE.md   DECISIONS.md   INVARIANTS.md   LEARNINGS.md`

Do not create every file automatically.

Do not create `.engineering/` merely because this skill mentions it.

------------------------------------------------------------------------

# Existing Documentation First

Before introducing a new memory structure inspect for:

-   `AGENTS.md`;
-   `CLAUDE.md`;
-   `docs/`;
-   `docs/plans/`;
-   ADR directories;
-   architecture docs;
-   decision logs;
-   contributor guides;
-   project-specific memory files;
-   existing planning directories.

Prefer integration over competition.

------------------------------------------------------------------------

# PROJECT.md

Use for stable project-level context that future engineering work
repeatedly needs.

Examples:

-   purpose;
-   primary stack;
-   supported deployment targets;
-   major external dependencies;
-   high-level operating constraints.

Do not turn it into README duplication.

------------------------------------------------------------------------

# ARCHITECTURE.md

Use for stable architectural structure and boundaries.

Examples:

-   backend/frontend separation;
-   local USB reader architecture;
-   queue/worker boundaries;
-   persistence ownership;
-   deployment topology.

Do not record every module/function.

Source remains authoritative for implementation detail.

------------------------------------------------------------------------

# DECISIONS.md

Use for durable intentional decisions.

A decision entry should normally include:

## Decision

...

## Status

ACTIVE / SUPERSEDED

## Context

Why the decision exists.

## Consequence

What future work must respect.

## Evidence / Authority

User decision / Plan / spec / review.

Avoid enormous ADR ceremony unless project complexity justifies it.

------------------------------------------------------------------------

# INVARIANTS.md

Use for cross-cutting rules future implementation must preserve.

Example:

> Automatic recalculation must not overwrite an explicit admin override.

Keep invariants concise and testable when possible.

------------------------------------------------------------------------

# LEARNINGS.md

Use for:

-   pitfalls;
-   patterns;
-   environment lessons;
-   process lessons specific to the project.

Do not use it as:

-   chronological diary;
-   TODO list;
-   release tracker;
-   unresolved-work checklist.

Organize by topic or category when it grows.

------------------------------------------------------------------------

# Persistent Tool Memory

A tool or agent may provide persistent per-project memory outside the
repository.

Treat it as another durable knowledge store.

The same rules still apply.

Do not use persistent memory as a hidden task tracker merely because it
is convenient.

Before writing:

-   inspect existing entries;
-   deduplicate;
-   classify durability;
-   reject temporary work state.

External memory is not exempt from the Active Work Barrier.

------------------------------------------------------------------------

# Global Harness Knowledge

Global workflow lessons should not automatically be written into every
project.

Prefer the appropriate global location such as:

-   `~/.pi/agent/CLAUDE.md`;
-   skill definitions;
-   agent definitions;
-   dedicated global engineering knowledge if intentionally introduced
    later.

If a lesson changes workflow behavior:

the relevant Skill or constitution is usually a better source of truth
than project `LEARNINGS.md`.

------------------------------------------------------------------------

# Skill Feedback

When Learn discovers a workflow lesson already encoded into a frozen
skill:

do not duplicate it merely to say it happened.

Example:

Debug v1.1 already states:

> confirmed root cause != correction ready.

No need to add that repeatedly to every project's memory.

------------------------------------------------------------------------

# Skill Improvement Candidate

If a completed workflow exposes a new harness weakness:

report:

SKILL IMPROVEMENT CANDIDATE

Include:

-   affected skill;
-   observed failure;
-   durable lesson;
-   proposed principle.

Do not modify a frozen skill automatically.

Skill evolution is deliberate.

------------------------------------------------------------------------

# Frozen Skill Discipline

A frozen skill is not reopened merely because Learn found one
improvement opportunity.

Collect improvement candidates.

Revisit frozen skills deliberately during:

-   harness retrospective;
-   version bump;
-   repeated failure;
-   high-severity workflow defect.

This prevents constant framework churn.

------------------------------------------------------------------------

# Agent Improvement Candidate

If an agent repeatedly fails because its role definition is
insufficient:

report:

AGENT IMPROVEMENT CANDIDATE

Do not edit agent definitions automatically.

One poor result is not automatically a role-design problem.

------------------------------------------------------------------------

# Deduplication

Before writing durable knowledge:

inspect existing relevant memory.

Ask:

-   Is this already recorded?
-   Is the new lesson materially different?
-   Does it refine existing knowledge?
-   Does it contradict existing knowledge?
-   Is one source more authoritative?

Do not append duplicates.

------------------------------------------------------------------------

# Merge Instead of Duplicate

If existing knowledge says:

> Use isolated worktrees for baseline testing.

and new evidence establishes:

> Shared Cargo targets can still contaminate isolated worktrees.

Prefer refining it to:

> Use isolated worktrees with unique `CARGO_TARGET_DIR` values for
> baseline testing.

Do not create two overlapping entries.

------------------------------------------------------------------------

# Contradiction Detection

If a candidate contradicts existing durable knowledge:

STOP before writing both.

Classify:

## NEWER DECISION SUPERSEDES OLD

Update status.

## EXISTING KNOWLEDGE STILL AUTHORITATIVE

Discard candidate.

## AUTHORITY UNCLEAR

Do not write candidate as fact.

Route to Plan/user decision if material.

------------------------------------------------------------------------

# Evidence Citation

Durable entries should include enough provenance to establish why they
are trusted.

Do not require verbose citations for obvious local facts.

For consequential decisions/invariants, record compact authority such
as:

-   User decision, YYYY-MM-DD
-   Approved Plan `<name/date>`
-   Debug root cause `<issue>`
-   Review finding `<identifier>`
-   Authoritative spec `<path/section>`

Avoid embedding entire transcripts.

------------------------------------------------------------------------

# Date Discipline

Dates can help decisions and supersession.

Do not turn every learning into a timestamped diary.

Use dates where chronology matters.

Never use a dated filename merely to turn temporary status into durable
knowledge.

------------------------------------------------------------------------

# Stable Wording

Write knowledge in a form useful months later.

Avoid:

-   "today";
-   "this change";
-   "the current bug";
-   "what we just did";
-   "next session";
-   "still need to";
-   "after this";
-   agent names unless role matters.

Prefer:

> Alternate Rust worktrees used for evidence isolation require unique
> Cargo target directories.

------------------------------------------------------------------------

# Temporary-Language Smell

Treat phrases like these as warning signs:

-   "still needs";
-   "next step";
-   "pending cleanup";
-   "after the user decides";
-   "rerun";
-   "delete later";
-   "currently modified";
-   "before shipping";
-   "follow up";
-   "remaining task."

They often indicate active work rather than durable knowledge.

Do not automatically reject the underlying lesson.

Rewrite only if there is a genuine durable fact beneath it.

------------------------------------------------------------------------

# Code-Level Facts

Do not persist facts that are trivial to discover from code unless they
represent an architectural boundary.

Weak memory:

> `attendance.rs` has a function called `do_scan`.

Better architectural memory:

> Local reader scans enter attendance through the shared scan
> transaction path; lifecycle enforcement must therefore occur at or
> below that persistence boundary.

------------------------------------------------------------------------

# File/Line Fragility

Avoid durable memory that depends entirely on current line numbers.

Files move.

Functions move.

Prefer semantic references.

Use exact paths when they identify stable specifications or
architectural components.

------------------------------------------------------------------------

# Implementation Detail Filter

Do not record:

-   local variable names;
-   temporary helper names;
-   exact line numbers;
-   incidental query structure;
-   one-off test fixture values;

unless the detail itself caused a durable pitfall.

------------------------------------------------------------------------

# Security and Secrets

Never persist:

-   tokens;
-   API keys;
-   passwords;
-   private keys;
-   secret environment values;
-   credential material.

Environment knowledge may say:

> CLIProxyAPI auth is supplied through an environment variable.

It must not store the value.

------------------------------------------------------------------------

# Sensitive Operational Information

Avoid unnecessary storage of:

-   personal data;
-   production credentials;
-   private customer data;
-   raw student information;
-   private endpoints.

Record the engineering constraint, not sensitive contents.

------------------------------------------------------------------------

# Completed vs Active Work

Learn must distinguish:

## ESTABLISHED

Safe to persist.

## DURABLY UNRESOLVED

May be persisted narrowly when future work must not assume an answer.

## ACTIVE / TEMPORARY

Must not be persisted as durable engineering memory.

Active work belongs to planning/tracking.

------------------------------------------------------------------------

# Failure Lessons

Failed approaches are worth preserving only when the reason is reusable.

Bad:

> Attempt 2 failed.

Good:

> Broad `cargo clean` is not an appropriate isolation strategy for
> alternate worktree verification because it affects the primary build
> environment; use unique target directories instead.

------------------------------------------------------------------------

# Positive Patterns

Learn should preserve successful patterns too.

Examples:

-   deterministic pure rule engine boundaries;
-   independent Reviewer checking authoritative sources;
-   disposable counterfactual experiments during Debug.

Do not make project memory exclusively a list of failures.

------------------------------------------------------------------------

# Cost-of-Rediscovery Test

Prefer recording knowledge when rediscovery would require:

-   lengthy debugging;
-   production incident;
-   reading many files;
-   reconstructing historical decisions;
-   special hardware;
-   platform access;
-   user clarification.

If rediscovery is one obvious grep:

memory may be unnecessary.

------------------------------------------------------------------------

# Write Barrier

Learn may modify designated engineering-memory files when the user
invoked Learn to persist knowledge.

It should not modify:

-   production code;
-   product tests;
-   migrations;
-   dependencies;
-   application configuration;
-   deployment scripts;
-   authoritative specifications unless explicitly authorized.

If a discovered lesson requires production correction:

report it and route appropriately.

------------------------------------------------------------------------

# Memory-Only Writer

During Learn:

Learn owns writes only to approved memory/documentation surfaces.

Do not let Learn become a backdoor worker.

If a discovered lesson requires production correction:

report it and route appropriately.

------------------------------------------------------------------------

# Existing Dirty Repository

Do not disturb unrelated work.

Before writing memory:

inspect repository state.

After writing:

identify exactly which memory files changed.

Do not format or touch unrelated files.

------------------------------------------------------------------------

# New `.engineering/` Directory

Do not create `.engineering/` mechanically on every repository.

Create it only when:

-   durable project knowledge exists;
-   no better existing knowledge location exists;
-   the repository would benefit from persistent engineering context.

If the project already has an established architecture/decision
documentation system:

prefer integrating with it.

------------------------------------------------------------------------

# Competing Source-of-Truth Rule

Do not create a second documentation hierarchy that appears equally
authoritative.

If `docs/` already contains business-rule specifications:

do not recreate those rules under `.engineering/`.

Engineering memory may point to the authoritative location and preserve
non-obvious lessons around it.

------------------------------------------------------------------------

# Source-of-Truth Mapping

If authoritative specifications already live under `docs/`:

memory may record:

> Attendance business rules are authoritative in `<spec path>`. Planning
> and Review for attendance-rule changes must consult the affected
> sections rather than infer vocabulary solely from code.

This is a navigation/process lesson.

It does not duplicate the business rules themselves.

------------------------------------------------------------------------

# Review-Discovered Authority Lesson

When Review discovers that earlier phases missed an authoritative
source:

consider preserving:

-   where authoritative requirements live;
-   that affected planning must consult them;
-   any naming/semantic collision that repeatedly risks confusion.

Do not automatically preserve the disputed behavior itself until
authority is resolved.

------------------------------------------------------------------------

# Validation Before Write

For each proposed durable entry verify:

-   category;
-   scope;
-   evidence;
-   evidence state: ESTABLISHED / CONTRADICTED / UNVERIFIED / EVIDENCE
    NOT RETRIEVED;
-   authority;
-   durability;
-   non-duplication;
-   destination;
-   whether it violates the Active Work Barrier;
-   whether the candidate contains multiple claims that require separate
    evidence states or actions;
-   whether historical evidence is primary/contemporaneous, corroborating,
    secondhand, or circular.

If any is unclear:

do not write yet.

------------------------------------------------------------------------

# Candidate Table

Before writing, internally or visibly construct:

  ---------------------------------------------------------------------------------------------------------------------------------
  Candidate        Category             Scope     Evidence        Evidence      Durable?      Active      Existing?   Action
                                                                  State                       Work?
  ---------------- -------------------- --------- --------------- ------------- ------------- ----------- ----------- -------------
  unique Cargo     PITFALL              GLOBAL    prior runtime   ESTABLISHED   yes if        no          maybe       MERGE/WRITE
  target for                            PROCESS   contamination   if recovered; established                           or NEEDS
  isolated                                                        otherwise                                           EVIDENCE
  baseline/RED                                                    EVIDENCE NOT
  worktrees                                                       RETRIEVED

  temp debugger    ---                  ---       current run     ESTABLISHED   no            yes         ---         DISCARD
  worktree

  unresolved       PROCESS/constraint   PROJECT   confirmed       ESTABLISHED   maybe         partially   maybe       REPORT ONLY
  finalized-scan                                  Debug +         as unresolved                                       or NEEDS
  semantics                                       unresolved      only                                                DECISION
                                                  decision state
  ---------------------------------------------------------------------------------------------------------------------------------

This prevents memory dumping.

------------------------------------------------------------------------

# Candidate Actions

Use:

## WRITE

New durable knowledge.

## MERGE

Refine existing knowledge.

## SUPERSEDE

Replace older knowledge with newer established authority.

## DISCARD

Not worth persistence.

## REPORT ONLY

Useful current information, but violates the Active Work Barrier.

## NEEDS EVIDENCE

The candidate may be durable, but the evidence required to establish or
contradict it has not been recovered or is insufficient.

Do not persist it as established truth.

Do not treat `NEEDS EVIDENCE` as `NEEDS DECISION`.

A decision is unnecessary when the problem is evidentiary rather than
normative.

## NEEDS DECISION

Cannot safely establish durable truth because an authorized choice,
policy resolution, or authority decision is required.

------------------------------------------------------------------------

# User Decision Gate

Ask the user before persisting when:

-   candidate changes established project policy;
-   authority conflict exists;
-   a new architecture decision would be created;
-   wording could materially constrain future work;
-   storage destination is ambiguous and consequential.

Do not ask for routine permission for every already-established lesson
if `/learn` explicitly authorizes persistence to the appropriate
Learn-owned surface.

If the correct destination is an authoritative specification, accepted
decision surface, frozen skill, or another surface outside the current
write authorization, report the route instead of substituting Claude
memory.

------------------------------------------------------------------------

# No Silent Policy Creation

Learn cannot turn an observation into policy.

Observation:

> Reviewer found authoritative docs were missed.

Valid lesson:

> Planning for attendance-rule semantics should consult the relevant
> authoritative attendance specification before declaring vocabulary
> undefined.

Invalid automatic policy:

> Every Plan must read every file in `docs/`.

The second requires workflow-design judgment.

------------------------------------------------------------------------

# Graphify

Graphify may help identify:

-   architectural relationships;
-   consumers;
-   knowledge already represented in code relationships.

Do not mechanically rebuild/query Graphify during Learn.

Source and approved durable memory remain authoritative.

Graphify is a navigation aid.

------------------------------------------------------------------------

# Specialist Use

Learn normally does not need specialists.

Use one only when determining whether a candidate is technically durable
requires domain expertise.

Example:

a SQLite behavior may be version-specific rather than a durable
architectural fact.

Do not summon agents merely to approve memory wording.

------------------------------------------------------------------------

# Reviewer Use

Reviewer is not required for routine Learn.

Consider Reviewer when:

-   a high-impact architectural decision is being recorded;
-   multiple authoritative sources appear inconsistent;
-   a durable invariant could materially constrain future
    implementation.

Often the prior Review evidence is sufficient.

------------------------------------------------------------------------

# Oracle Use

Oracle is almost never required for Learn.

Use only when a high-consequence durable rule remains disputed after
normal evidence.

------------------------------------------------------------------------

# Learn From Current Work

When invoked after a workflow, inspect relevant evidence from:

-   Discover;
-   Plan;
-   Execute;
-   Verify;
-   Debug;
-   Review;
-   Ship.

Do not assume the latest report alone contains every durable lesson.

But do not reread the entire history without reason.

------------------------------------------------------------------------

# Candidate Rejection

It is valid for Learn to conclude:

NO DURABLE KNOWLEDGE TO ADD

Do not create memory merely because the skill was invoked.

Zero writes can be the correct result.

------------------------------------------------------------------------

# Minimality

Prefer:

3 high-value lessons

over:

30 low-value notes.

Every durable entry creates future reading cost.

Project memory should earn that cost.

------------------------------------------------------------------------

# Learn Statuses

Choose exactly one:

## LEARNED

Durable knowledge was added or existing knowledge was materially
refined.

## NO NEW DURABLE KNOWLEDGE

Candidates were evaluated but nothing justified persistence.

## NEEDS EVIDENCE

At least one material candidate may be durable, but the evidence needed
to establish or contradict it has not been recovered or is insufficient.

This is an evidence problem, not a product-policy decision.

Learn may still record unrelated established knowledge when authorized.

## NEEDS USER DECISION

A candidate cannot be safely recorded because authority/policy is
unresolved.

This does not require Learn to stop recording unrelated established
knowledge.

# Mixed Blocker Precision

If `NEEDS EVIDENCE` and `NEEDS USER DECISION` occur in the same run, do
not collapse one into the other.

Report both blocker classes explicitly.

For the single aggregate Learn Status, use the state that best explains
why the requested persistence cannot complete, and include:

**Additional blocker states:**

NEEDS EVIDENCE / NEEDS USER DECISION / NONE

Do not describe an evidence gap as a user-decision problem.

------------------------------------------------------------------------

## BLOCKED

Required source/evidence/storage access is unavailable.

------------------------------------------------------------------------

# Learn Report

Return:

## Learn Objective

What completed work is being mined for durable knowledge.

------------------------------------------------------------------------

## Sources Considered

-   ...

------------------------------------------------------------------------

## Existing Knowledge System

**Existing project documentation:**

...

**Existing decision/architecture memory:**

...

**Persistent external memory:**

...

**Chosen destination:**

...

**Reason:**

...

------------------------------------------------------------------------

## Candidates Evaluated

### Candidate 1 --- `<name>`

**Category:**

DECISION / INVARIANT / PATTERN / PITFALL / ENVIRONMENT / PROCESS

**Scope:**

PROJECT / GLOBAL PROCESS / DOMAIN

**Evidence:**

...

**Evidence state:**

ESTABLISHED / CONTRADICTED / UNVERIFIED / EVIDENCE NOT RETRIEVED

**Durability:**

HIGH / MEDIUM / LOW

**Rediscovery cost:**

HIGH / MEDIUM / LOW

**Active-work classification:**

NO / TEMPORARY / DURABLY UNRESOLVED

**Existing overlap:**

...

**Action:**

WRITE / MERGE / SUPERSEDE / DISCARD / REPORT ONLY / NEEDS EVIDENCE /
NEEDS DECISION

**Reason:**

...

Repeat as necessary.

------------------------------------------------------------------------

## Destination Routing

For each accepted durable candidate report:

**Primary destination class:**

AUTHORITATIVE PROJECT TRUTH / ACCEPTED DECISION / CONFIRMED KNOWN ISSUE
/ TESTING CONVENTION / KNOWLEDGE-AUTHORITY NAVIGATION / ASSISTANT-LOCAL
CONTEXT / GLOBAL HARNESS KNOWLEDGE

**Concrete destination:**

...

**Why this destination owns the truth:**

...

**Ready to persist:**

YES / NO

**Write authorized:**

YES / NO

**Fallback to Claude memory allowed:**

YES / NO

If NO, do not use memory as a substitute.

------------------------------------------------------------------------

## Knowledge Written

### Entry 1

**Destination:**

...

**Category:**

...

**Knowledge:**

...

**Authority / Evidence:**

...

If none:

None.

------------------------------------------------------------------------

## Knowledge Refined

-   ...

or:

None.

------------------------------------------------------------------------

## Superseded Knowledge

-   ...

or:

None.

------------------------------------------------------------------------

## Rejected Candidates

### `<candidate>`

**Reason not persisted:**

...

Include active-work rejections here when useful.

------------------------------------------------------------------------

## Unresolved Items

These are not automatically durable facts.

### `<item>`

**Classification:**

TEMPORARY ACTIVE WORK / DURABLE UNRESOLVED CONSTRAINT / NEEDS USER
DECISION

**Persisted:**

YES / NO

**Reason:**

...

If none:

None.

------------------------------------------------------------------------

## Skill Improvement Candidates

### `<skill>`

**Observed weakness:**

...

**Evidence:**

...

**Proposed principle:**

...

**Action:**

RECORD FOR RETROSPECTIVE / NONE

Do not modify frozen skills automatically.

------------------------------------------------------------------------

## Agent Improvement Candidates

-   ...

or:

None.

------------------------------------------------------------------------

## Repository Changes

**Before:**

...

**After:**

...

**Files changed by Learn:**

-   ...

**Non-memory project files changed:**

NONE / explain

------------------------------------------------------------------------

## External Memory Changes

**Entries written:**

...

**Entries refined:**

...

**Temporary work state persisted:**

NO

**Project truth stored only in external memory:**

NO

**Pending decision stored as current memory:**

NO

If YES:

this is a process violation unless explicitly authorized.

------------------------------------------------------------------------

## Learn Status

Choose exactly one:

LEARNED

NO NEW DURABLE KNOWLEDGE

NEEDS EVIDENCE

NEEDS USER DECISION

BLOCKED

------------------------------------------------------------------------

**Additional blocker states:**

NEEDS EVIDENCE / NEEDS USER DECISION / NONE

## Next Workflow

Normally:

COMPLETE

If unresolved implementation work remains:

report its existing workflow destination without turning Learn into the
task tracker.

Example:

> Existing unresolved attendance work still belongs to PLAN. Learn does
> not change that routing.

Learn does not automatically restart engineering work.

------------------------------------------------------------------------

# Learn Self-Check

Before writing durable knowledge ask:

1.  Is this actually useful in future work?
2.  Would it be costly to rediscover?
3.  Is it stable enough to persist?
4.  Is it supported by evidence?
5.  Is its authority clear?
6.  Am I recording fact rather than speculation?
7.  Is it already documented authoritatively elsewhere?
8.  Would copying it create competing sources of truth?
9.  Is the chosen category correct?
10. Is the scope narrow enough?
11. Is there existing overlapping knowledge?
12. Should I merge instead of append?
13. Does this supersede something older?
14. Have I marked supersession clearly?
15. Am I accidentally recording an unresolved product choice as truth?
16. Am I turning an observation into policy?
17. Am I recording chronology instead of knowledge?
18. Am I storing an implementation detail trivial to rediscover?
19. Am I storing a temporary path/hash/artifact that will soon be
    useless?
20. Am I storing current TODOs or cleanup tasks?
21. Am I storing current working-tree/release status?
22. Does this entry say "delete when resolved" or otherwise reveal that
    it is temporary?
23. If unresolved, is the unresolved state itself genuinely durable?
24. Could I report this under Unresolved Items instead of persisting it?
25. Am I exposing secrets or sensitive data?
26. Does this belong in a frozen Skill instead of project memory?
27. Does this belong in an authoritative specification instead?
28. Does this belong in active planning rather than durable memory?
29. Did I preserve unrelated repository work?
30. Did Learn modify only approved memory surfaces?
31. Can a future engineer understand the entry without this
    conversation?
32. Will the entry still make sense months later?
33. Does the entry tell future work what changes because of this
    knowledge?
34. Is its maintenance burden justified?
35. Would deleting this entry make future engineering materially worse?
36. If I say a prior lesson is not established, did I actually recover
    the relevant completed-work evidence?
37. Am I confusing absence from current docs/memory with evidence that
    the lesson never existed?
38. Is this candidate CONTRADICTED, UNVERIFIED, or merely EVIDENCE NOT
    RETRIEVED?
39. If evidence is missing, should the action be NEEDS EVIDENCE rather
    than DISCARD or NEEDS DECISION?
40. If decision and evidence blockers both exist, did I report them
    separately?
41. What kind of truth is this candidate?
42. Which destination actually owns that truth?
43. Am I using Claude memory merely because it is convenient to write?
44. Should this be authoritative repository truth instead?
45. Is this an accepted decision, or only proposed/pending/remembered?
46. If it is a decision, has `/decision`-quality acceptance been
    established?
47. Is this a confirmed defect that belongs in project-visible known
    issues rather than assistant memory?
48. Is this a testing convention that belongs in project testing
    documentation?
49. Is this only a navigation pointer to authoritative knowledge?
50. If the correct destination is not write-authorized, did I report the
    route rather than write to a weaker store?
51. Did I keep pending decisions and active lifecycle state out of
    durable memory?
52. Did I avoid making Claude memory a source of project authority?
53. Did I separate persistence readiness from write authorization?
54. If this candidate depends on a historical event, did I distinguish
    evidence of the event from later summaries, recollections, prompts, and
    skill examples?
55. Did I reject circular evidence that merely repeats the candidate claim?
56. If I found only a secondhand assistant summary, did I treat it as a
    retrieval lead/corroboration rather than automatic proof of the underlying
    event?
57. Does this candidate contain multiple independently testable claims?
58. If so, did I split them before assigning evidence state, authority,
    durability, destination, and action?
59. Am I allowing evidence for a narrow claim to justify a broader
    generalization?
60. Am I allowing contradiction of a broad claim to make a narrower
    `EVIDENCE NOT RETRIEVED` claim look false?

If not:

do not persist it.

------------------------------------------------------------------------

# Completion Principle

Learn succeeds when future engineering can avoid paying the same
discovery cost twice.

The goal is not:

> Remember everything.

The goal is:

> Preserve the smallest set of durable knowledge that materially
> improves future work.

Good engineering memory is:

selective; authoritative; deduplicated; stable; actionable; scoped;
low-noise; safe; easy to maintain.

It is not:

a transcript; a TODO list; a release tracker; a cleanup list; a
substitute for planning; a hidden backlog.

A mature project should accumulate understanding.

Not temporary state.

And durable knowledge should live where its authority belongs, not
merely where it is easiest for the assistant to remember it.
