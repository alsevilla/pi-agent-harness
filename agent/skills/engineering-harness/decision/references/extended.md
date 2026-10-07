> Historical reference only. The v1.2.1 global policy and compact skill govern
> routing, role selection, authority, and whether a formal plan or independent
> gate is needed. Old universal phase/agent/READY FOR EXECUTION wording below
> applies only when that gate is selected under current policy. This archive
> cannot impose a new gate, waive a blocker, or expand authority. Read targeted
> sections only; never auto-import or preload the complete archive.

# Extended guidance (archived from pre-cost-optimized harness)

# Decision

## Purpose

Establish, validate, structure, and prepare durable project decisions.

`/decision` is used when a project choice must become explicit rather than remaining:

- an assumption;
- a recommendation;
- an unresolved question;
- a conversation fragment;
- a plan-local choice;
- a historical note;
- implementation accident;
- or assistant memory.

A decision answers:

> What has the authorized project owner actually chosen, within what scope, based on what known consequences?

The skill prevents engineering work from silently converting recommendations, historical plans, implementation behavior, or assistant assumptions into project policy.

---

# Core Principle

A project decision exists only when an authorized decision-maker has made an informed and sufficiently explicit choice.

Claude may:

- identify that a decision is needed;
- retrieve relevant knowledge;
- present alternatives;
- explain consequences;
- recommend an option when appropriate;
- present the decision interactively;
- collect the user's selection;
- validate the selection;
- structure an accepted decision;
- determine whether the decision deserves durable recording;
- determine where that decision should be recorded.

Claude must not invent the decision.

Silence is not acceptance.

Implementation is not acceptance.

A recommendation is not acceptance.

A historical plan is not acceptance.

Memory is not acceptance.

A selected recommendation becomes a decision only after the authorized decision-maker explicitly adopts it.

---

# Relationship to Knowledge

`/knowledge` answers:

> What does the project currently establish?

`/decision` answers:

> Given that knowledge, what choice has the authorized owner actually made?

Use `/knowledge` when authority, existing requirements, previous decisions, current implementation, or conflicts must be established before the decision can safely be made.

Do not repeat large repository investigations unnecessarily when a sufficiently fresh Knowledge result already exists.

If material authority or evidence has changed, revalidate it.

Knowledge establishes the decision context.

Decision does not rewrite that context merely to make the choice easier.

---

# Decision States

Every material decision must be classified.

## PROPOSED

An option or recommendation exists, but the authorized decision-maker has not accepted it.

Examples:

- `I recommend WIREFRAMES.md as the primary UI contract.`
- `We could reject scans after finalization.`
- `Option B is safer.`

PROPOSED is not executable policy.

---

## NEEDS DECISION

A material choice exists and current evidence does not establish an accepted answer.

The choice must be presented to the authorized decision-maker.

---

## ACCEPTED

The authorized decision-maker explicitly selected an option with enough context to understand what is being chosen.

Examples:

- `Use option B.`
- `Yes, use your recommendation.`
- selecting a clearly presented option through an interactive user-question tool;
- `WIREFRAMES.md governs UI layout; DASHBOARD FINAL remains behavioral fallback where WIREFRAMES is silent.`

Acceptance is scoped to the decision actually presented.

Do not broaden it.

---

## ACCEPTED WITH CONDITIONS

The owner accepted the decision subject to explicit conditions.

Example:

`Use WIREFRAMES for layout, but keep DASHBOARD FINAL's exception and override behavior.`

The conditions are part of the decision.

Do not discard them when creating the durable record.

---

## REJECTED

The owner explicitly rejected an option or previous proposal.

Rejected proposals are not automatically durable decisions unless preserving the rejection materially helps future engineering.

---

## SUPERSEDED

A later valid decision explicitly replaces an earlier accepted decision.

Supersession must identify what is replaced.

Do not infer supersession merely because a newer conversation, plan, document, or implementation differs.

---

## HISTORICAL

A previous choice accurately describes past project state but is not current policy.

Use only when current evidence establishes that relationship.

---

## UNKNOWN

Evidence is insufficient to establish whether a decision was made.

UNKNOWN is preferable to invented acceptance.

---

# Decision Authority

Before treating a choice as ACCEPTED, determine who is authorized to make it.

For ordinary owner-driven projects, the user's explicit decision normally has decision authority.

For team or governed projects, authority may instead belong to:

- project owner;
- product owner;
- technical owner;
- security owner;
- database owner;
- designated approver;
- architecture group;
- another role established by project policy.

Do not assume every participant can settle every domain.

If authority is unclear and materially affects the decision, report:

`DECISION AUTHORITY: UNKNOWN`

and do not promote the choice to ACCEPTED.

---

# Informed Decision Barrier

A decision must be sufficiently informed before it can safely supersede existing project policy or resolve a material conflict.

Before asking for or accepting a decision, surface material information such as:

- existing authoritative requirement;
- conflicting authoritative sources;
- current implementation divergence;
- affected invariants;
- significant migration consequences;
- security consequences;
- data-loss consequences;
- compatibility consequences;
- relevant irreversible effects;
- known alternatives;
- important scope boundaries.

Do not bury a material conflict and then treat the user's answer as informed supersession.

The amount of information should match the risk.

Do not overwhelm the user with implementation detail that does not affect the choice.

---

# Materiality Rule

Not every implementation choice requires an owner decision.

Engineering may make ordinary reversible implementation choices when requirements already establish the desired behavior.

Examples may include:

- local variable names;
- private helper structure;
- equivalent refactoring choices;
- test organization;
- internal code layout;
- reversible implementation mechanics.

Owner decisions are required when the choice materially changes:

- product semantics;
- business rules;
- user-visible behavior;
- security policy;
- data model meaning;
- lifecycle semantics;
- compatibility;
- public API behavior;
- authority precedence;
- irreversible migration behavior;
- operational policy;
- significant scope.

Do not create decision bureaucracy for ordinary engineering judgment.

---

# Decision Retrieval

Before creating a new decision, determine whether the question has already been settled.

Search, as appropriate:

1. current explicit user decisions available in context;
2. project authority rules;
3. accepted decision records;
4. authoritative specifications;
5. relevant plans or reviews for historical context;
6. Claude memory only as contextual evidence.

Use `/knowledge` when this requires meaningful reconciliation.

Do not create duplicate decisions merely because the existing decision is difficult to find.

If a valid accepted decision already exists:

`DECISION STATE: ACCEPTED`

Do not ask the user to decide it again unless:

- the user wants to reconsider it;
- new evidence materially changes the choice;
- a conflict makes the existing decision uncertain;
- or its scope does not cover the current question.

---

# Memory Barrier

Claude memory may indicate:

- a decision was previously discussed;
- a choice was previously pending;
- a user may have selected an option;
- a relevant conflict existed.

Memory cannot by itself establish that a current durable project decision exists.

If memory claims:

`User chose B`

revalidate against available authoritative conversation or project evidence when the decision materially affects current work.

If it cannot be revalidated:

`MEMORY CLAIM: previous decision reported`

`CURRENT DECISION STATUS: UNKNOWN`

Do not silently convert memory into ACCEPTED project policy.

---

# Recommendation vs Decision

Keep these separate.

## Recommendation

Claude or another engineering source believes an option is preferable.

## Decision

An authorized owner selected the option.

Example:

`RECOMMENDATION: Use WIREFRAMES as the primary layout contract.`

is different from:

`DECISION: WIREFRAMES is the primary layout contract.`

Never remove the distinction merely because the recommendation is strong.

Use explicit labels when ambiguity is possible.

---

# Recommendation Quality

A recommendation should be based on material engineering or product evidence.

Good recommendation factors may include:

- clearer alignment with established product intent;
- better preservation of authoritative invariants;
- explicitly intended scope;
- fewer contradictions;
- better compatibility;
- safer migration characteristics;
- lower operational risk;
- stronger consistency with already accepted decisions;
- completeness for the relevant domain;
- reversibility where appropriate.

The following may provide context but must not independently determine the recommendation:

- newer file date;
- `FINAL` in a filename;
- implementation happens to match it;
- more references in historical plans;
- Claude memory preference;
- Graphify ranking;
- majority count of documents.

Do not recommend an option merely because it is newer.

Do not recommend an option merely because the interaction interface benefits from having a recommendation.

If evidence does not justify a preferred choice:

`RECOMMENDATION: NONE`

Present the options neutrally.

---

# Generic Authorization Barrier

Generic execution language does not resolve an explicit decision.

Examples that do not settle unspecified choices:

- `go ahead`;
- `fix it`;
- `continue`;
- `implement`;
- `proceed`;
- `make it work`.

If four product decisions remain open, `go ahead` does not answer four questions.

However, explicit adoption may be sufficient:

`Use all four of your recommended answers.`

is an explicit decision if:

- the four recommendations were clearly stated;
- their material consequences were surfaced;
- the options were sufficiently unambiguous;
- no material dependency was hidden.

---

# Scope Lock

An accepted decision applies only to the scope actually decided.

Example:

`WIREFRAMES governs dashboard layout.`

does not automatically mean:

`WIREFRAMES governs attendance calculation.`

Likewise:

`Reject scans after finalization.`

does not automatically decide:

- whether an audit event is stored;
- whether SMS is emitted;
- how remote replay behaves;
- whether administrators can override;
- whether legacy writes occur.

Separate independently material choices.

Do not smuggle additional policy into a narrow decision.

---

# Consequence Completeness

Before recording an accepted material decision, identify known consequences that another engineer would need in order to apply it correctly.

Capture only consequences established by evidence or necessarily implied by the decision.

Distinguish:

`KNOWN CONSEQUENCE`

from:

`POSSIBLE CONSEQUENCE`

Do not manufacture downstream effects.

For high-risk decisions, unresolved consequences may require further:

- Knowledge;
- Discover;
- Plan;
- Debug;
- specialist analysis;
- or user clarification.

---

# Independent Decision Separation

A decision question may contain multiple independent choices.

Separate them when selecting one does not necessarily determine the others.

Example:

`D1 — What happens to a late scan after FINALIZED?`

and:

`D2 — Should that scan trigger SMS?`

may require separate decisions.

Do not compress multiple independent product semantics into one broad option such as:

`A — handle finalized scans correctly.`

The decision must be specific enough for Plan to inherit without guessing.

---

# Decision Dependencies

Some decisions depend on others.

When D2 is only meaningful after D1:

1. make the dependency explicit;
2. do not pretend they are independent;
3. order the questions when necessary.

Example:

`D2 applies only if D1 chooses audit-only event storage.`

Do not ask irrelevant downstream questions when an upstream choice makes them impossible.

---

# Decision Conflict Handling

## Decision ↔ Specification

If a new accepted user decision conflicts with an existing authoritative specification:

1. expose the conflict;
2. determine whether the user has authority;
3. ensure the user was informed of the conflict;
4. establish the intended scope of supersession;
5. record what is superseded.

Do not leave two apparently current contradictory rules without an explicit relationship.

---

## Decision ↔ Decision

If two accepted decisions conflict:

1. determine whether one explicitly supersedes the other;
2. inspect scope;
3. inspect decision authority;
4. inspect chronology only as supporting evidence.

Newer does not automatically win.

If precedence cannot be established, report a decision conflict.

---

## Decision ↔ Code

Current code may disagree with an accepted decision.

That is an implementation divergence.

Do not change the decision to match accidental code behavior.

Route implementation work through normal lifecycle gates.

---

## Decision ↔ Test

A test may encode behavior that conflicts with an accepted decision.

That may require a test change through normal TDD and Execute workflow.

The test does not silently override the decision.

---

## Decision ↔ Memory

Accepted repository or current user evidence wins.

Memory should be corrected or cleaned later through the Learn or memory workflow when appropriate.

---

# Supersession

Supersession must be explicit enough for future engineers to understand:

- what old decision or rule existed;
- what new decision replaces it;
- whether replacement is full or partial;
- what remains valid;
- why the change was made when rationale matters.

Example:

`DEC-014 partially supersedes DASHBOARD FINAL §3 for navigation structure. DASHBOARD FINAL remains applicable for override behavior where WIREFRAMES is silent.`

Do not simply mark an entire document obsolete when only one section changed.

---

# Decision Durability

Not every accepted choice deserves a durable decision record.

Persist a decision when forgetting it would likely cause:

- repeated debate;
- contradictory implementation;
- requirement ambiguity;
- authority confusion;
- unsafe behavior;
- migration risk;
- cross-component inconsistency;
- repeated rediscovery.

Good durable decisions include:

- specification precedence;
- business-rule semantics;
- state-machine policy;
- security policy;
- schema meaning;
- API compatibility policy;
- deployment architecture choices;
- intentionally unsupported behavior;
- deliberate exceptions to normal engineering policy.

Poor durable decisions include:

- temporary branch choices;
- current worker assignment;
- one-off cleanup;
- temporary debugging technique;
- current TODO;
- trivial naming;
- short-lived implementation status.

---

# Decision Destination

Determine where a durable decision belongs.

Preferred order:

1. existing authoritative specification, when the decision directly changes that specification and the project expects specifications to contain current truth;
2. existing project decision log, when the decision is cross-cutting, explanatory, or establishes precedence;
3. domain-specific durable documentation;
4. a project decision register if no suitable durable location exists.

Do not automatically create `DECISIONS.md`.

Do not automatically create `.engineering/`.

Inspect existing project structure first.

Avoid duplicating the full decision across multiple sources.

Prefer:

`one durable decision`

plus:

`references from affected authoritative sources`

when appropriate.

---

# Decision Record Shape

When a durable decision record is appropriate, structure it with enough information to prevent ambiguity.

Recommended fields:

## ID

Stable identifier if the project uses decision IDs.

Example:

`DEC-001`

Do not invent an ID system if the project already has one.

---

## Title

Concise description of the decision.

---

## Status

One of:

- ACCEPTED
- ACCEPTED WITH CONDITIONS
- SUPERSEDED

Do not persist NEEDS DECISION as if it were settled policy unless the project intentionally maintains an open-decisions register.

---

## Date

Date the decision was accepted.

---

## Scope

Exactly what the decision governs.

---

## Decision

The accepted policy in direct language.

---

## Authority

Who made or approved the decision.

Do not invent names or roles.

---

## Context

Only the context necessary to understand why the decision exists.

---

## Alternatives

Include material alternatives when useful.

Do not recreate the entire planning conversation.

---

## Consequences

Known consequences that future engineers need.

---

## Supersedes

Specific previous decision, specification section, or policy replaced.

Use:

`None`

when appropriate.

---

## Superseded By

Use only when updating a previous decision record after a later accepted decision.

---

## References

Relevant authoritative specifications, plans, issues, code areas, or review evidence.

References provide traceability.

They do not themselves establish decision authority.

---

# User Decision Interaction

When a decision requires explicit user input and an interactive user-question capability such as `ask-user` is available, prefer that capability over asking the decision only in free-form prose.

`/decision` owns:

- determining that a decision is required;
- establishing decision authority;
- defining the decision boundary;
- constructing valid options;
- separating independent decisions;
- identifying dependencies;
- explaining material consequences;
- selecting a recommendation when justified;
- determining what constitutes valid acceptance;
- validating the returned selection.

The interactive user-question capability owns:

- presenting the options;
- visually identifying a recommended option when supported;
- collecting the user's selection;
- allowing custom input when supported.

The interaction capability is an interface.

It is not a source of authority.

It must not perform the decision reasoning.

---

# Interactive Decision Flow

The preferred unresolved-decision flow is:

```text id="06w9h7"
ESTABLISH NEEDS DECISION
        ↓
DEFINE DECISION BOUNDARY
        ↓
CONSTRUCT OPTIONS
        ↓
SURFACE MATERIAL CONSEQUENCES
        ↓
RECOMMEND OPTION IF JUSTIFIED
        ↓
ASK USER INTERACTIVELY
        ↓
USER SELECTS
        ↓
VALIDATE SELECTION
        ↓
ACCEPTED / ACCEPTED WITH CONDITIONS
        ↓
DETERMINE DURABILITY
        ↓
DETERMINE PERSISTENCE READINESS
        ↓
HAND OFF TO PLAN WHEN APPROPRIATE
```

Do not skip from recommendation directly to ACCEPTED.

---

# Recommended Option in Interactive Questions

When evidence supports a preferred option, identify it before invoking the user-question capability.

Mark the preferred option clearly.

Example:

```text id="r77n7v"
Which source should govern overlapping dashboard layout rules?

A — WIREFRAMES governs layout/navigation. (Recommended)
    DASHBOARD FINAL remains applicable where WIREFRAMES is silent.

B — DASHBOARD FINAL governs layout/navigation.
    WIREFRAMES becomes design guidance for those areas.

C — Define section-by-section precedence.

Other — Provide another policy.
```

The recommendation must remain visibly distinct from acceptance.

`RECOMMENDED ≠ ACCEPTED`

The decision becomes ACCEPTED only after the authorized decision-maker selects or explicitly adopts the option.

---

# No Artificial Recommendation

Do not recommend an option merely because the interaction interface expects one.

If evidence does not justify a preferred choice:

- present the options neutrally;
- do not invent a recommendation;
- allow the user to choose.

Use:

`No recommendation — evidence does not clearly favor one option.`

when helpful.

---

# Custom / Other Responses

When the decision is not safely exhaustive, allow custom input when the interaction capability supports it.

The user may:

- choose an offered option;
- modify an option;
- combine compatible options;
- reject all options;
- provide another policy.

A custom answer is not automatically ACCEPTED merely because it was entered.

Validate:

- scope;
- decision authority;
- conflicts;
- consequences;
- dependencies;
- supersession.

If material ambiguity remains:

`DECISION STATE: NEEDS CLARIFICATION`

Do not guess what the custom response means.

---

# Multiple Interactive Decisions

When several independent decisions are required, the interaction may present them together when:

- the interface supports it;
- each choice remains understandable;
- their scopes are distinct;
- dependencies are explicit.

Example:

```text id="4wjj5e"
D1 — Layout/navigation authority

A — WIREFRAMES (Recommended)
B — DASHBOARD FINAL
C — Section-by-section
Other


D2 — Behavioral/API authority

A — DASHBOARD FINAL (Recommended)
B — WIREFRAMES with DASHBOARD fallback
C — Another rule
Other
```

Each decision retains its own state.

Do not interpret an answer to D1 as acceptance of D2.

---

# Dependent Interactive Decisions

If D2 depends materially on D1, prefer sequential interaction when possible.

Example:

```text id="rc51bu"
D1:
Reject finalized scan
or
record audit-only?

        ↓

If audit-only:

D2:
Should audit-only scan trigger SMS?
```

Do not ask users to decide irrelevant branches.

---

# Interaction Failure

If the interactive user-question capability is unavailable, unsuitable, or fails:

fall back to a clear prose decision request.

Example:

```text id="2cvaz8"
Decision required:

D1:
A — ...
B — ...
C — ...

Recommendation: B

Reply with D1 B, or provide another policy.
```

Lack of an interaction capability must never cause `/decision` to guess.

---

# Interaction Is Not Persistence

Selecting an option establishes the decision when the acceptance requirements are satisfied.

It does not automatically authorize repository or memory modification.

These are separate:

```text id="ub9w9c"
USER SELECTS OPTION
        ↓
DECISION ACCEPTED
        ↓
DURABILITY EVALUATED
        ↓
PERSISTENCE READY?
        ↓
WRITE AUTHORIZED?
```

A user may accept a decision while explicitly prohibiting file modification.

Respect both instructions.

---

# Persistence Authorization

Conversation acceptance and repository-write authorization are related but distinct.

Example:

`Use WIREFRAMES as the UI contract.`

may establish the project decision.

It does not necessarily authorize immediate modification of repository files if the user requested analysis only.

If the user says:

`Use WIREFRAMES as the UI contract and record the decision.`

the persistence intent is explicit.

If the user selected an option through `ask-user` while the original request said:

`Do not modify anything`

the decision may become ACCEPTED, but persistence remains blocked.

---

# Write Barrier

`/decision` must not mutate repository files or memory merely because a decision question was discussed or accepted.

Before persistence, all of the following must be true:

1. the decision state is ACCEPTED or ACCEPTED WITH CONDITIONS;
2. decision authority is established;
3. material conflicts were surfaced;
4. scope is clear;
5. known supersession is clear;
6. the destination is appropriate;
7. persistence is actually useful;
8. the user has authorized persistence when the action would modify project files or memory;
9. normal file ownership and workflow rules permit the write.

If any condition fails:

`DECISION NOT READY TO PERSIST`

Do not write.

---

# Selection Validation

After the user selects an option, validate the response before declaring ACCEPTED.

Check:

1. Does the answer correspond to a defined option?
2. If custom, is its meaning clear?
3. Does it answer the complete decision?
4. Does it add conditions?
5. Does it alter scope?
6. Does it affect another independent decision?
7. Does it create a new conflict?
8. Does it change supersession?
9. Was the user sufficiently informed of material consequences?

If the answer is clear:

`DECISION STATE: ACCEPTED`

or:

`DECISION STATE: ACCEPTED WITH CONDITIONS`

If not:

`DECISION STATE: NEEDS CLARIFICATION`

Ask only the minimum clarification necessary.

---

# Selection Summary

After acceptance, restate the decision concisely.

Example:

```text id="zcplto"
Decision State: ACCEPTED

D1:
WIREFRAMES governs admin UI layout, navigation, and dashboard composition.

D2:
DASHBOARD FINAL governs behavioral, API, error-handling, and security
requirements where not superseded by D1.

Scope:
Admin dashboard UI only.

Supersession:
Partial.

Persistence:
DURABLE — READY TO PERSIST.

Repository write:
NOT AUTHORIZED.
```

This summary becomes the decision contract that subsequent lifecycle phases may inherit.

---

# TDD Relationship

Decision capture itself is not behavioral implementation and does not require RED → GREEN.

But a decision that changes software behavior must flow into normal planning and TDD execution.

Example:

```text id="r3em6g"
DECISION
    ↓
PLAN
    ↓
RED
    ↓
GREEN
    ↓
REFACTOR
    ↓
VERIFY
```

Do not modify behavioral tests directly from `/decision` merely to make them reflect a newly accepted policy.

That belongs to Execute under the normal workflow.

---

# Relationship to PLAN

A valid accepted decision may unblock Plan.

Plan must inherit:

- decision scope;
- conditions;
- supersession;
- relevant invariants;
- unresolved adjacent questions.

Plan may not silently broaden the decision.

If `/decision` returns NEEDS DECISION, Plan remains blocked on that choice.

If only part of a decision bundle is accepted, Plan may proceed only where the accepted decisions are sufficient.

---

# Relationship to EXECUTE

Execute may rely on ACCEPTED decisions when:

- their scope covers the implementation;
- no relevant authority conflict remains;
- Plan is READY FOR EXECUTION;
- normal execution gates pass.

A decision does not bypass Plan.

A decision does not itself authorize code changes unless the lifecycle otherwise allows them.

---

# Relationship to REVIEW

Review checks whether implementation respects accepted decisions.

Review may identify:

- decision drift;
- incomplete supersession;
- implementation that exceeds decision scope;
- stale documentation still presenting superseded policy as current.

Review does not rewrite the decision.

---

# Relationship to LEARN

Learn must not independently create project decisions.

If Learn discovers:

`The user previously decided X`

but no durable evidence establishes it, Learn should not persist X as accepted policy.

Route uncertain decision claims through `/knowledge` and `/decision`.

Accepted durable decisions belong in project truth, not only Claude memory.

---

# Relationship to SHIP

Ship must not ship a change whose required product decision remains:

- NEEDS DECISION;
- NEEDS CLARIFICATION;
- UNKNOWN.

An accepted decision still requires normal implementation, verification, and review evidence.

---

# Read-Only Decision Analysis

When the user asks to:

- identify a decision;
- determine whether something is settled;
- compare choices;
- prepare a decision;
- review decision history;

continue read-only investigation without repeated permission.

You may:

- read repository files;
- inspect decision records;
- inspect specifications;
- inspect code or tests when relevant;
- inspect history;
- inspect Claude memory as contextual evidence;
- use `/knowledge`;
- use Scout read-only;
- use Graphify or Serena as retrieval tools.

Do not modify files until persistence is authorized and the Write Barrier passes.

---

# Risk

Classify material decision risk when useful.

## LOW

Reversible, local, little behavioral consequence.

## MEDIUM

Meaningful component behavior or maintainability impact.

## HIGH

Business rules, persistence semantics, authentication, authorization, state machines, concurrency, deployment policy, public API compatibility, important user-visible behavior.

## CRITICAL

Decisions with severe potential consequences involving security boundaries, irreversible data loss, destructive migrations, safety-critical behavior, or equivalent project-specific risk.

Small diffs do not imply low-risk decisions.

---

# High-Risk Decision Rule

For HIGH or CRITICAL decisions:

- ensure authoritative requirements were actually inspected;
- surface material conflicts;
- preserve unresolved consequences;
- consider relevant specialist input;
- do not compress multiple independent choices into one yes/no question;
- ensure supersession is explicit;
- require strong evidence before declaring the decision settled;
- ensure recommendations are based on substantive consequences rather than convenience.

Oracle remains exceptional and follows the global routing policy.

---

# Output Format

Scale output to the decision.

For material decisions use:

## Decision Result

### Question

What decision is being evaluated?

### Existing Authority

What does the project already establish?

### Decision State

Use:

- PROPOSED
- NEEDS DECISION
- NEEDS CLARIFICATION
- ACCEPTED
- ACCEPTED WITH CONDITIONS
- REJECTED
- SUPERSEDED
- HISTORICAL
- UNKNOWN

### Decision Authority

Who is authorized to settle it?

Use UNKNOWN when necessary.

### Options

Only when a decision remains open.

State materially distinct options without artificial proliferation.

### Recommendation

Optional.

Clearly label it as:

`RECOMMENDATION`

Never phrase a recommendation as if already accepted.

Use:

`NONE`

when evidence does not justify one.

### Material Consequences

State known consequences.

Separate uncertain consequences.

### Scope

What exactly would the decision govern?

### Supersession

What existing rule or decision would be replaced?

Use:

- `None`
- `Partial`
- `Full`
- `Unknown`

as appropriate.

### Persistence

Use one:

`NOT DURABLE`

`DURABLE — NOT READY TO PERSIST`

`DURABLE — READY TO PERSIST`

`ALREADY DURABLY RECORDED`

### Repository Write

When relevant use:

`AUTHORIZED`

or:

`NOT AUTHORIZED`

Do not confuse this with decision acceptance.

### Lifecycle Implication

Examples:

- `PLAN remains blocked on this decision.`
- `PLAN may now inherit this decision.`
- `Implementation diverges from the accepted decision and requires normal PLAN → EXECUTE.`
- `No lifecycle impact; this was a local reversible implementation choice.`

---

# Asking the User

When a user decision is required:

1. define the decision precisely;
2. present the materially distinct options;
3. explain only the consequences necessary for an informed choice;
4. mark a recommendation when justified;
5. use interactive `ask-user` when available;
6. allow custom input when appropriate;
7. validate the returned selection;
8. summarize the accepted decision.

Prefer:

```text id="ycvwld"
D1 — Which source governs conflicting dashboard layout rules?

A — WIREFRAMES governs layout. (Recommended)
    DASHBOARD FINAL remains fallback where WIREFRAMES is silent.

B — DASHBOARD FINAL governs layout.
    WIREFRAMES becomes design guidance.

C — Section-by-section precedence.

Other — Define another relationship.
```

Avoid:

`What do you want to do?`

when the actual alternatives are already known.

Do not overwhelm the user with implementation detail irrelevant to the choice.

---

# Decision Bundles

Multiple decisions may be presented together only when they are sufficiently independent and clearly enumerated.

Example:

```text id="zuw8xb"
D1 — Late finalized scan:
A — Reject
B — Audit-only

D2 — SMS:
A — Suppress
B — Send

D3 — Remote replay:
A — Reject
B — Audit-only
```

The user may answer:

`D1 B, D2 A, D3 B`

or:

`Use all your recommendations.`

Do not bundle choices when accepting one logically requires a particular answer to another without explaining that dependency.

---

# No Retroactive Fabrication

Do not rewrite history.

If a user makes a decision today, record today's decision.

Do not claim:

`This was always the project policy`

unless evidence establishes that.

If the decision formalizes previously inconsistent practice, say so.

Example:

`This decision establishes explicit precedence that was previously undefined.`

That is valuable project knowledge.

---

# Stale Documentation After Decision

An accepted decision may cause existing documentation to become stale.

Identify affected sources.

Do not automatically rewrite them from `/decision` unless:

- persistence is authorized;
- the destination strategy calls for it;
- scope is clear;
- file ownership rules permit it.

Otherwise report:

`FOLLOW-UP DOCUMENTATION REQUIRED`

and route through the normal workflow.

---

# Stop Conditions

Stop rather than fabricate a decision when:

- decision authority is unknown;
- material alternatives are not understood;
- a relevant authority conflict has not been surfaced;
- the user's response is ambiguous;
- acceptance scope is unclear;
- supersession scope is unclear;
- a HIGH or CRITICAL consequence remains materially unknown;
- memory is the only evidence that a decision was accepted;
- persistence destination is unclear;
- repository modification was not authorized;
- a custom response requires clarification.

Use:

`NEEDS DECISION`

`NEEDS CLARIFICATION`

or:

`UNKNOWN`

instead.

---

# Anti-Patterns

Never:

- invent owner decisions;
- convert recommendations into accepted decisions;
- convert implementation into policy;
- convert tests into product authority;
- let memory establish current acceptance;
- interpret generic `go ahead` as answers to explicit unresolved choices;
- broaden a narrow decision;
- hide material consequences;
- silently supersede specifications;
- assume newer automatically wins;
- recommend an option merely because it is newer;
- recommend an option merely because the UI expects one;
- create duplicate decisions;
- persist temporary task state as a decision;
- use a decision record as a TODO tracker;
- treat ask-user as a source of decision reasoning;
- treat interactive selection as repository-write authorization;
- modify behavioral code from `/decision`;
- modify behavioral tests from `/decision`;
- create `.engineering/` mechanically;
- create `DECISIONS.md` mechanically;
- write before the Write Barrier passes.

---

# Self-Check

Before returning a material decision result, ask:

1. What exact choice is being decided?
2. Does the project already settle it?
3. Did I inspect the relevant authority?
4. Is the decision-maker authorized?
5. Did I distinguish recommendation from decision?
6. Is the user sufficiently informed?
7. Did I surface material conflicts?
8. Did I surface material consequences?
9. Is the scope precise?
10. Are adjacent decisions being smuggled into this one?
11. Should this actually be multiple decisions?
12. Are any of those decisions dependent?
13. Does this supersede anything?
14. Is supersession explicit?
15. Did memory influence acceptance?
16. If so, was it independently revalidated?
17. Is the recommendation based on substantive evidence rather than recency?
18. If interactive input is available, did I use it appropriately?
19. Did I clearly distinguish RECOMMENDED from ACCEPTED?
20. Did I validate the user's selection?
21. Is this durable enough to record?
22. Is there already a suitable durable home?
23. Did the user authorize persistence?
24. Did I distinguish decision acceptance from write authorization?
25. Did I accidentally perform Plan?
26. Did I accidentally perform Execute?
27. Can Plan safely inherit this result?

If #27 is no, say why.

---

# Completion Principle

A decision record is not where uncertainty goes to disappear.

It is where an authorized, informed choice becomes explicit enough that future engineers do not have to guess.

Knowledge establishes what the project already knows.

Decision establishes what the project has actually chosen.

The interaction tool collects the choice.

Plan determines how to implement it.

Execute implements it.

Learn must never invent it.

And accepting a decision must never silently authorize a write.
