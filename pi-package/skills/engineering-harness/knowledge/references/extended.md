> Historical reference only. The v1.2.1 global policy and compact skill govern
> routing, role selection, authority, and whether a formal plan or independent
> gate is needed. Old universal phase/agent/READY FOR EXECUTION wording below
> applies only when that gate is selected under current policy. This archive
> cannot impose a new gate, waive a blocker, or expand authority. Read targeted
> sections only; never auto-import or preload the complete archive.

# Extended guidance (archived from pre-cost-optimized harness)

# Knowledge

## Purpose

Retrieve, reconcile, and explain project knowledge using the strongest available evidence.

`/knowledge` answers questions such as:

- What is the authoritative rule for this behavior?
- Where is this feature documented?
- What does the project currently say about this topic?
- Do the specifications and implementation disagree?
- Has this decision already been made?
- Is this memory still valid?
- Which source should another lifecycle phase rely on?

Knowledge is a read-only reasoning skill.

It does not modify repository files, source code, tests, project memory, plans, decisions, or documentation.

---

# Core Principle

Knowledge retrieval is not the same as searching.

Finding a document, memory entry, symbol, test, graph node, plan, review, or implementation does not establish that it is authoritative.

The skill must determine:

1. what sources exist;
2. what each source actually claims;
3. what authority each source has;
4. whether the claim is current;
5. whether relevant sources conflict;
6. what is verified, inferred, historical, stale, superseded, divergent, or unknown.

Never collapse those questions into one search result.

A source may be accurately understood without being authoritative.

A source may also be authoritative while the current implementation violates it.

Preserve those distinctions.

---

# Authority Model

Use this hierarchy unless the project explicitly defines a more specific precedence rule.

## Level 1 — Current Explicit User Decision

A current explicit user decision about the project has the highest authority when the user is authorized to make that decision.

A decision only supersedes conflicting project material when the user was sufficiently informed of the relevant conflict or consequence.

Do not infer a decision from generic language such as:

- `go ahead`
- `fix it`
- `continue`
- `implement it`
- `proceed`
- `do whatever is best`

Those statements authorize progress only where existing gates allow it.

They do not silently settle unresolved product semantics.

Explicit acceptance may settle a decision when the referenced choices are clear.

Example:

`Use your recommended answers for all four decisions.`

may constitute an explicit decision if those four recommendations and their consequences were clearly presented.

---

## Level 2 — Explicit Project Authority Rules

Use repository declarations that explicitly establish which sources govern a domain.

Examples:

- a knowledge index declaring the attendance specification authoritative;
- a project policy declaring one document supersedes another;
- an accepted decision record establishing a new rule;
- an explicit specification-precedence section;
- a repository policy defining which source governs a particular subsystem.

An authority declaration must itself be evaluated for legitimacy and scope.

A document cannot automatically make itself globally authoritative merely by claiming to be authoritative.

Determine whether the project establishes that declaration as legitimate.

---

## Level 3 — Authoritative Domain Specifications

Specifications explicitly established as governing the relevant domain.

Examples may include:

- attendance rules;
- dashboard behavior;
- API contracts;
- hardware contracts;
- deployment requirements;
- security policy;
- persistence requirements;
- operational procedures.

Authority is domain-specific.

A UI specification does not automatically govern persistence semantics.

A deployment document does not automatically govern attendance policy.

An API specification does not automatically override a business-rule specification outside its contract scope.

---

## Level 4 — Accepted Durable Decisions

Accepted project decisions that refine, clarify, or intentionally supersede previous behavior.

A decision must be clearly settled.

Proposals, TODOs, review comments, unresolved plan questions, recommendations, and assistant suggestions are not accepted decisions.

When an accepted decision supersedes an older authoritative rule, preserve the relationship rather than pretending the old rule never existed.

---

## Level 5 — Current Implementation and Tests

Code and tests are authoritative evidence of what the system currently does.

They are not automatically authoritative evidence of what the system should do.

If implementation conflicts with an authoritative requirement, report a divergence.

Do not silently redefine the requirement to match the code.

Tests may establish:

- current behavior;
- regression expectations;
- executable contracts;
- previously intended behavior.

But a test can itself encode stale or incorrect semantics.

Passing tests do not prove that their expected behavior is the correct product requirement.

---

## Level 6 — Historical Plans, Reviews, and Superseded Documents

These sources provide context and rationale.

They may explain:

- why a design exists;
- what alternatives were considered;
- previous requirements;
- previous review findings;
- implementation history;
- previously proposed behavior.

They do not override current authoritative sources unless explicitly promoted to accepted project authority.

Treat documents explicitly marked superseded as historical evidence.

Do not infer `SUPERSEDED` merely because another document is newer.

---

## Level 7 — Claude Project Memory

Claude project memory is contextual evidence.

It may provide:

- navigation hints;
- repository quirks;
- useful testing seams;
- expensive-to-rediscover technical lessons;
- previous observations worth re-checking;
- candidate files worth inspecting;
- previous conflicts worth revalidating.

Memory must not by itself establish:

- current task state;
- whether an issue remains unresolved;
- current requirements;
- current user decisions;
- current repository state;
- current implementation behavior;
- current test results;
- active work;
- current dirty files;
- pending fixes;
- current branch state;
- current lifecycle state.

Revalidate those claims against current authoritative evidence.

If memory conflicts with current authoritative project evidence, current authoritative evidence wins.

---

## Level 8 — Retrieval and Navigation Tools

Graphify, Serena, search indexes, symbol databases, code graphs, and similar tools are retrieval capabilities.

They help locate evidence.

They are not independent sources of project authority.

Graphify can help answer:

> Where are the related things?

Serena and code-navigation tools can help answer:

> What does the current code appear to do?

Authoritative project sources answer:

> What should the system do?

Always inspect the underlying source before treating a retrieval result as project knowledge.

---

# Authority Bootstrap Barrier

A lower-authority source cannot establish the authority of a higher-authority source.

In particular:

- Claude memory cannot make a repository document authoritative.
- Graphify cannot make a repository document authoritative.
- Serena cannot make a specification authoritative.
- implementation agreement cannot make a specification authoritative.
- passing tests cannot make a specification authoritative.
- a historical plan cannot promote another document unless that plan itself has established authority to do so.
- repeated references to a document may support an authority inference but do not independently prove authority.
- a document calling itself `FINAL` does not prove that it governs the project.

Lower-authority evidence may:

- identify candidate authority;
- provide corroboration;
- reveal how the repository has historically treated a source;
- point to authority declarations that should be inspected.

It may not bootstrap authority by itself.

---

# Claim Confidence vs Authority Confidence

Always distinguish:

## Claim Confidence

How confidently do we know what the source actually says?

from:

## Authority Confidence

How confidently do we know that the source governs the project for this question?

These are independent.

Example:

`CLAIM: VERIFIED / HIGH`

`ATTENDANCE LOGIC FINAL explicitly states that finalized records do not automatically recalculate.`

does not necessarily imply:

`AUTHORITY: VERIFIED / HIGH`

If no project-wide precedence rule establishes that document's authority, the correct result may instead be:

`AUTHORITY: INFERRED / MEDIUM`

The repository consistently treats the document as normative, but formal precedence has not been established.

Do not upgrade authority confidence merely because claim confidence is high.

Likewise, an authoritative source can contain a claim whose meaning is ambiguous.

Keep both dimensions separate.

---

# Authority Must Be Proven

Do not infer authority solely because a source:

- is newer;
- contains `FINAL` in its filename;
- matches the implementation;
- has passing tests;
- appears in memory;
- appears frequently in search;
- is referenced by Graphify;
- was modified recently;
- is detailed;
- looks professionally written;
- is referenced by many other documents;
- agrees with the majority of repository sources.

These are evidence that may help identify authority.

They do not independently prove authority.

If materially conflicting sources exist and precedence cannot be established, report the conflict.

Do not silently choose.

---

# Absence Is Not Resolution Evidence

Failure to find a current repository decision does not prove that an older memory entry remains unresolved.

When memory says a decision was unresolved:

1. search current authoritative project sources;
2. search accepted decision records if they exist;
3. inspect relevant current workflow evidence when available;
4. inspect current implementation or tests only when they can legitimately help establish the question;
5. determine whether current evidence confirms, contradicts, or fails to resolve the memory claim.

If no current settlement is found, report:

`MEMORY: previously unresolved`

`CURRENT STATUS: UNKNOWN`

Do not report:

`still unresolved`

unless current evidence establishes that status.

Likewise:

- absence of contradictory evidence does not establish authority;
- absence of an implementation does not prove a requirement was rejected;
- absence of a decision record does not prove no decision was ever made;
- absence of a test does not prove behavior is unsupported;
- absence of memory does not prove something was never discussed.

Treat absence as absence.

Do not convert it into positive evidence without justification.

---

# Knowledge Retrieval Procedure

Use the minimum investigation necessary to answer confidently.

## Step 1 — Define the Knowledge Question

Restate internally what must be established.

Examples:

- authoritative requirement;
- current behavior;
- historical rationale;
- accepted decision;
- known divergence;
- location of documentation;
- implementation surface;
- whether memory remains valid;
- whether another lifecycle phase may safely inherit a claim.

Do not search the entire repository when the question is narrow.

---

## Step 2 — Identify Candidate Sources

Prefer repository evidence.

Look for:

- explicit authority declarations;
- project knowledge/index files;
- domain specifications;
- accepted decisions;
- relevant code;
- relevant tests;
- historical plans or reviews when rationale matters.

Use Claude memory as contextual evidence, not as the starting authority when repository evidence is available.

Use Scout when repository-wide mapping, uncertain blast radius, cross-component relationships, or non-trivial discovery materially benefits from delegation.

Do not invoke Scout mechanically for obvious narrow lookups.

---

## Step 3 — Inspect the Actual Source

Do not rely only on:

- filenames;
- search snippets;
- Graphify summaries;
- Serena summaries;
- memory summaries;
- another agent's paraphrase;
- plan summaries;
- review summaries.

Read enough of the underlying source to understand the relevant claim and its context.

When a material conclusion depends on an agent report, inspect the underlying evidence yourself when practical.

---

## Step 4 — Establish Authority

For every materially relevant source, determine:

- what domain it covers;
- whether it declares authority;
- whether another legitimate source establishes its authority;
- whether it is accepted, proposed, historical, or superseded;
- whether a higher-authority source conflicts with it;
- whether its authority is VERIFIED, INFERRED, or UNKNOWN.

Do not let memory bootstrap authority.

Do not let implementation agreement bootstrap authority.

When authority remains uncertain, label it uncertain.

---

## Step 5 — Check Current Reality When Necessary

If the question concerns what the system currently does, inspect current code and relevant tests.

If memory claims a current fact, revalidate it.

If a specification describes intended behavior and current code differs, preserve both facts:

`REQUIREMENT`

and

`CURRENT IMPLEMENTATION`

Do not merge them.

If tests disagree with code or specifications, preserve that disagreement too.

---

## Step 6 — Detect Conflicts and Divergence

Classify disagreement where useful.

### SPEC ↔ SPEC

Two requirements sources disagree.

Determine precedence if legitimate project authority establishes it.

Otherwise report an authority conflict.

Do not choose based only on recency, filename, or implementation alignment.

---

### SPEC ↔ CODE

Implementation differs from an authoritative requirement.

Report a specification/implementation divergence.

Do not rewrite the requirement mentally to match the code.

---

### SPEC ↔ TEST

A test encodes behavior inconsistent with authoritative requirements.

Report the divergence rather than assuming the test wins.

---

### CODE ↔ TEST

Test expectations disagree with current implementation.

Determine whether evidence establishes:

- regression;
- stale test;
- incomplete implementation;
- or unresolved uncertainty.

Do not guess.

---

### MEMORY ↔ CURRENT EVIDENCE

Memory is stale, incomplete, or inaccurate.

Current authoritative evidence wins.

State explicitly when memory was corrected by current evidence.

---

### PLAN/REVIEW ↔ CURRENT AUTHORITY

Historical work describes a different state or recommendation.

Treat it as historical unless explicitly accepted.

---

### AUTHORITY ↔ AUTHORITY

Two legitimately authoritative sources conflict.

If project precedence does not resolve the conflict, stop and surface it.

Do not silently reconcile materially incompatible rules.

---

# Knowledge States

Use precise labels.

## VERIFIED

Directly supported by current inspected evidence.

Example:

`VERIFIED — ATTENDANCE LOGIC FINAL §8 states finalized records do not automatically recalculate.`

VERIFIED describes evidence for the claim.

It does not automatically mean the source's authority is VERIFIED.

---

## INFERRED

Strongly suggested by evidence but not explicitly established.

Example:

`INFERRED — this document appears intended to govern attendance behavior, but no explicit project-wide precedence declaration was found.`

Do not present inference as fact.

---

## HISTORICAL

Accurately describes previous project state but is not current authority.

---

## SUPERSEDED

Explicit evidence establishes that another source replaced it.

Do not use `SUPERSEDED` merely because another file is newer.

---

## DIVERGENCE

Current implementation or tests disagree with an established authoritative requirement.

---

## CONFLICT

Two potentially authoritative sources materially disagree and precedence is unresolved.

---

## STALE

A contextual source, especially memory or historical documentation, contains a claim disproven by current evidence.

---

## UNVERIFIED

A source makes a claim that has not been independently established where independent verification matters.

---

## UNKNOWN

Available evidence cannot establish the answer.

Unknown is a legitimate result.

Do not manufacture certainty.

---

# Active Work Barrier

Knowledge must distinguish durable project knowledge from active workflow state.

The following are not durable knowledge merely because they appear in a plan, review, memory file, or conversation:

- current TODOs;
- current dirty files;
- temporary worktrees;
- current branch status;
- pending product decisions;
- an unfinished implementation attempt;
- `still unresolved`;
- `currently fixing`;
- temporary test artifacts;
- cleanup chores;
- current worker ownership;
- current lifecycle phase;
- temporary verification state.

These claims must be re-established from current workflow or repository evidence when they matter.

Do not promote them into authoritative project truth.

---

# Known Issues

A confirmed unresolved defect may be durable project knowledge.

But distinguish:

`CONFIRMED DEFECT`

from:

`CURRENT WORK TO FIX DEFECT`

The following may be durable:

- observed defect;
- violated invariant;
- reproduction evidence;
- confirmed root cause;
- affected subsystem;
- durable safety constraint.

The following are active work:

- current worker;
- current branch;
- current Plan state;
- temporary files;
- implementation attempt;
- current TODO;
- cleanup task;
- current uncommitted diff.

Do not mix the two.

---

# Decisions

When looking for a decision, distinguish:

## Proposed

Someone recommended or suggested it.

---

## Pending

Current authoritative project evidence explicitly establishes that the decision is unresolved.

A historical memory entry alone cannot establish that it is still pending.

---

## Previously Pending

Historical evidence or memory establishes that the decision was unresolved at an earlier time, but current status has not been established.

---

## Accepted

The authorized owner explicitly settled it or an authoritative decision record establishes it.

---

## Superseded

A later valid decision explicitly replaced it.

Do not convert recommendations into accepted decisions.

Do not convert `previously pending` into `pending` without current evidence.

---

# Read-Only Continuation

Once the user has authorized a knowledge investigation, continue relevant non-mutating reconnaissance without repeatedly asking permission.

You may:

- read relevant files;
- search repository text;
- inspect code;
- inspect tests;
- inspect git history when relevant;
- inspect project memory;
- use Graphify;
- use Serena;
- use Scout read-only.

Do not stop merely because the first search found nothing.

Do not ask permission merely to read another relevant project file.

Do not install tools or dependencies merely to continue a normal knowledge lookup unless separately justified and authorized.

Knowledge never writes.

---

# Relationship to Lifecycle Skills

## DISCOVER

DISCOVER answers:

> What do we need to understand before planning this work?

`/knowledge` may support Discover by resolving existing project knowledge and authority.

Knowledge does not replace Discover.

---

## PLAN

PLAN answers:

> Given established requirements and evidence, how should this work be implemented?

`/knowledge` may establish requirements and accepted decisions that Plan must inherit.

Knowledge does not create the implementation contract.

If Knowledge finds an authority conflict or unresolved product decision, Plan must not silently resolve it.

---

## DEBUG

DEBUG establishes why an observed failure occurs.

`/knowledge` can establish:

- expected behavior;
- existing decisions;
- authoritative requirements;
- known historical context.

Knowledge does not establish root cause without debugging evidence.

A previously recorded root cause may be historical evidence, but current reliance on it should follow the normal evidence-freshness rules.

---

## VERIFY

VERIFY establishes whether the implementation satisfies required behavior.

`/knowledge` may locate and establish the requirement.

It does not replace execution evidence.

---

## REVIEW

REVIEW may use `/knowledge` to determine whether a change contradicts authoritative project rules.

Knowledge may expose:

- authority conflicts;
- stale assumptions;
- specification/code divergence;
- superseded requirements.

---

## LEARN

LEARN decides whether newly acquired information deserves durable persistence and where it belongs.

Knowledge retrieves and reconciles.

Learn persists selectively.

Do not let `/knowledge` mutate memory.

---

## DECISION

A future `/decision` skill records explicitly accepted durable project decisions.

Knowledge may find and explain decisions.

It does not create them.

---

# Phase-Boundary Restraint

Knowledge may identify implications for another lifecycle phase.

It must not silently perform that phase.

Knowledge may say:

- `PLAN may safely inherit this requirement.`
- `PLAN cannot proceed until this authority conflict is resolved.`
- `DEBUG should establish whether this observed failure has the suspected cause.`
- `REVIEW should check this implementation against the established invariant.`

Knowledge must not:

- design the implementation;
- choose unresolved product semantics;
- create a correction contract;
- assign workers;
- modify tests;
- advance to Execute;
- create documentation;
- persist decisions.

Retrieval and reconciliation come first.

---

# Graphify Rules

Use Graphify when relationships, dependencies, blast radius, or repository-wide navigation materially improve retrieval.

Graphify output is an index.

When Graphify identifies a relevant document or symbol:

1. locate the underlying source;
2. inspect the underlying source;
3. reason from the underlying source;
4. treat Graphify only as navigation evidence.

A stale graph must never override current source.

Do not mechanically rebuild Graphify for every knowledge request.

Graphify does not establish requirements.

---

# Serena Rules

Use Serena or equivalent symbol navigation when current code structure matters.

Serena may help identify:

- definitions;
- references;
- callers;
- implementations;
- related symbols.

Inspect the underlying code before making material behavioral claims.

Serena describes current code structure.

It does not define product policy.

A Serena result agreeing with a specification does not establish the specification's authority.

---

# Scout Rules

Scout is useful when:

- knowledge is spread across the repository;
- affected areas are unclear;
- several specifications may apply;
- repository-wide mapping is needed;
- cross-component relationships matter.

Scout remains read-only.

Do not invoke Scout mechanically for:

- obvious single-file lookups;
- trivial documentation questions;
- already-known narrow locations;
- simple mechanical searches the orchestrator can perform directly.

The orchestrator must distinguish when material:

`VERIFIED BY ORCHESTRATOR`

from:

`REPORTED BY SCOUT`

Material claims from Scout should be independently inspected when they determine:

- authority;
- lifecycle gates;
- product semantics;
- security conclusions;
- persistence rules;
- high-risk decisions.

---

# Memory Check Procedure

When Claude memory materially contributes:

1. identify exactly what the memory claims;
2. classify whether the claim is durable or time-sensitive;
3. determine whether it concerns:
   - requirements;
   - decisions;
   - implementation;
   - test state;
   - task state;
   - repository state;
   - navigation;
   - engineering technique;
4. revalidate current claims when required;
5. classify the memory result.

Use:

`CONFIRMED`

Current evidence independently supports the memory claim.

`CONTRADICTED`

Current evidence disproves it.

`CONTEXTUAL ONLY`

Memory helped locate evidence but did not establish the answer.

`PREVIOUSLY TRUE`

Evidence establishes that it described an earlier project state.

`CURRENT STATUS UNKNOWN`

Memory describes a time-sensitive state that current evidence cannot establish.

Do not say memory is `confirmed` merely because another memory entry agrees with it.

---

# Output Format

Scale the response to the question.

For a narrow lookup, a concise answer is sufficient.

For a material knowledge investigation, use:

## Knowledge Result

### Question

What was being established?

### Answer

State the best-supported answer directly.

### Requirement / Claim

State what the relevant source actually says.

Include:

`Claim state: VERIFIED / INFERRED / UNKNOWN`

`Claim confidence: HIGH / MEDIUM / LOW`

when useful.

### Authority

Identify why the source governs—or may govern—the question.

Include:

`Authority state: VERIFIED / INFERRED / UNKNOWN`

`Authority confidence: HIGH / MEDIUM / LOW`

when authority is material.

Do not merge claim confidence and authority confidence.

### Current Implementation

Include when the question concerns actual behavior.

State only what current inspected evidence establishes.

### Evidence

Separate where useful:

- VERIFIED
- INFERRED
- HISTORICAL
- UNVERIFIED
- UNKNOWN

### Conflicts / Divergences

List only material disagreements.

If none:

`No material conflict found.`

### Memory Check

Only include when memory materially contributed.

State whether it was:

- CONFIRMED;
- CONTRADICTED;
- CONTEXTUAL ONLY;
- PREVIOUSLY TRUE;
- CURRENT STATUS UNKNOWN.

### Confidence

Use:

- HIGH
- MEDIUM
- LOW

Overall confidence reflects evidence quality and authority clarity, not model confidence.

If claim confidence and authority confidence materially differ, report them separately instead of hiding the distinction inside one overall rating.

### Lifecycle Implication

Only when relevant.

Examples:

- `Safe for PLAN to inherit this requirement.`
- `Authority conflict must be resolved before PLAN.`
- `Current implementation diverges from the established requirement.`
- `This is historical context only and should not control EXECUTE.`
- `Memory establishes that this was previously unresolved, but current decision status is UNKNOWN.`

Do not automatically advance the lifecycle merely because Knowledge completed.

---

# Stop Conditions

Stop and report rather than invent an answer when:

- materially conflicting authoritative sources have no established precedence;
- required evidence is unavailable;
- a current user decision is necessary;
- the question depends on active task state that cannot be revalidated;
- memory is the only source for a material current claim;
- determining the answer would require modifying the project;
- scope has expanded beyond the knowledge question;
- authority cannot be established and the distinction materially affects the next engineering action.

Unknown is an acceptable result.

---

# Anti-Patterns

Never:

- treat search ranking as authority;
- treat `FINAL` in a filename as proof;
- treat newer as automatically authoritative;
- treat current code as automatically correct;
- treat tests as automatically authoritative;
- treat memory as current project state;
- let memory bootstrap repository authority;
- let Graphify or Serena establish policy;
- let implementation agreement establish specification authority;
- silently reconcile conflicting requirements;
- convert recommendations into decisions;
- convert historical unresolved state into current unresolved state;
- infer positive evidence from absence without justification;
- perform Plan while pretending to retrieve knowledge;
- modify files;
- modify memory;
- create documentation;
- install dependencies just to avoid reading existing sources;
- ask permission for every harmless repository read after investigation was authorized.

---

# Self-Check

Before returning a material Knowledge result, ask:

1. What exact question did I answer?
2. Did I inspect the underlying sources?
3. What does each material source actually claim?
4. What source actually has authority?
5. How was that authority established?
6. Did I let memory bootstrap authority?
7. Did I mistake recency or filename for authority?
8. Did I distinguish claim confidence from authority confidence?
9. Did memory influence the answer?
10. If so, did I revalidate current claims?
11. Did I distinguish requirement from implementation?
12. Did I distinguish accepted decisions from recommendations?
13. Did I distinguish currently pending from previously pending?
14. Did I expose material conflicts?
15. Did I preserve unknowns?
16. Did I infer anything merely because contrary evidence was absent?
17. Did I accidentally perform Plan?
18. Did I modify anything?
19. Can the next lifecycle phase safely inherit this result?

If #19 is no, state why.

---

# Completion Principle

The purpose of `/knowledge` is not to produce more documentation.

Its purpose is to make existing project truth reliably retrievable.

Search finds information.

Knowledge determines:

- what the information actually says;
- what authority it has;
- whether it is current;
- whether other evidence conflicts with it;
- whether memory can still be trusted;
- and whether the engineering lifecycle can safely rely on it.

When certainty is unavailable, preserve uncertainty.

Reliable unknowns are more valuable than invented truth.
