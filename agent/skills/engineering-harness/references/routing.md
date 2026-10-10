# Conditional routing and evidence

Read only when the next role or gate is uncertain. User requirements and the compact AGENTS policy govern authority; this reference adds no universal pipeline.

## Discovery
Use `scout` only when the relevant location, dependency surface, or existing behavior is not already sufficiently known. Scout reads the assigned `discover` module.

Skip Scout when the user, error, compiler, test, or previous evidence already identifies the relevant files/components.
Scout answers **where / what is affected**, not **why it fails**.

## Debugging
A request to fix an existing malfunction is a bug-fix incident.
If root cause is not established by evidence: `debugger -> worker`.
Add Scout first only when location/blast radius is unknown. Add a specialist only when debugging exposes a material unresolved domain decision. Add independent verification/review only when risk warrants it.
Debugger may be skipped when evidence already establishes the cause and the remaining work is implementation-only.
If a speculative fix fails or produces an unexplained regression, use debugger before another speculative patch.

## Specialists
Specialists are conditional. Do not summon a specialist merely because code touches that domain. Use one only when there is a material unresolved decision or risk that the worker should not decide alone.

Typical ownership:
- SQLite/SQLx/data integrity -> `sqlite-specialist`
- Tokio/races/backpressure/shutdown -> `concurrency-specialist`
- auth/secrets/trust/privilege -> `security-specialist`
- public/typed API contract -> `api-specialist`
- subsystem boundaries/major tradeoffs -> `architecture-specialist`
- measured performance/overload -> `performance-specialist`
- RFID/device I/O -> `hardware-integration`
- attendance state machine/schedules/late/half-day/absent/finalization -> `attendance-domain-specialist`
- offline event replay/idempotency/order/clock/acknowledgement -> `event-reconciliation-specialist`
- SMS/provider/retry/delivery semantics -> `messaging-specialist`
- student/parent data minimization/retention/export/privacy -> `privacy-compliance-specialist`
- deployment/service/backups -> `devops-specialist`
- logs/metrics/health/audit -> `observability-specialist`
- UX/design judgment -> `ui-ux-specialist`

One specialist is preferred. Multiple specialists require distinct unresolved questions.

Select an RFID domain specialist only when a material business/event/provider/privacy decision is unresolved; skip them when the task is implementation against a confirmed contract or the uncertainty belongs to another discipline. Specialists are read-only advisors, not an automatic phase or implementation gate. Their self-contained packet should name the exact unresolved question, candidate/evidence paths, known constraints, relevant scope, forbidden assumptions and requested decision/evidence. The handoff should separate confirmed facts, options/tradeoffs, boundary examples, acceptance evidence and explicit open questions; return unresolved school, privacy, consent, recipient, provider or retention policy to main rather than inventing it.

Keep adjacent ownership distinct: RFID/device protocol and physical reader I/O -> `hardware-integration`; SQLite/SQLx schema, transactions and migrations -> `sqlite-specialist`; Tokio task/queue/race/shutdown behavior -> `concurrency-specialist`; auth, secrets and access control -> `security-specialist`; API/provider contract -> `api-specialist`; deployment, service and backup operations -> `devops-specialist`. A domain specialist may describe implications but does not decide those implementation/operational contracts.

## Frontend
If the task requires a real design/UX decision, use `ui-ux-specialist` before `frontend-worker`.
Skip the design specialist when the design is already approved or the change is a localized implementation/presentation fix with no design judgment.

## Verification
Workers must run focused tests/checks appropriate to their implementation.
Use independent `test-engineer` only when one or more is true:
- business-critical/state-machine/data-integrity behavior changed;
- regression risk is material;
- implementation spans multiple modules/layers;
- concurrency/retry/queue behavior changed;
- migration/persistence semantics changed;
- user explicitly requests independent verification;
- worker evidence is incomplete or suspect.

A normal localized T1 change does not require a separate test agent if the worker provides credible focused test evidence.

## Review
Reviewer is **not automatic**.
Use `reviewer` for materially risky changes such as security/auth, concurrency, migrations, state machines, destructive behavior, data integrity, cross-module refactors, public API compatibility, disputed findings, or high-impact business logic.
Skip reviewer for routine localized changes that already have credible implementation and test evidence.

## Oracle
Use `oracle` only when:
- credible high-impact disagreement remains after normal review;
- data-loss/security/correctness risk is severe and unresolved;
- two reasonable fix attempts failed and root cause remains disputed.
Never use Oracle as routine second opinion.

## Release / SHIP / LEARN
Use `release-engineer` when the task actually enters SHIP or LEARN.

SHIP remains conditional: ordinary coding completion is not a release. `release-engineer` reads `engineering-harness/ship/index.md`, validates exact candidate/version, fresh evidence, migrations/config/artifacts, destination and explicit authority, and performs only authorized release operations.

LEARN is also conditional: `release-engineer` reads `engineering-harness/learn/index.md` only when stable reusable knowledge is worth preserving. Do not create session summaries as durable knowledge.

`devops-specialist` owns unresolved deployment/service/backup design. `release-engineer` owns release readiness/execution against the resolved operational contract. Distinct questions may justify both; neither may launch the other.

## Task shape
Shape is orthogonal to the T0-T4 uncertainty/risk tier: it chooses how independent or dependent work is sequenced, not whether a role, specialist, tester or gate is needed. Shape never overrides user authorization, leaf/no-helper rules or lossless chain facts.
- Enumerable independent batch (items, order and ownership known in advance; no back-and-forth): may run in parallel only within existing runtime limits (parallel <=8 tasks with <=4 concurrent; DAG <=8 nodes with <=4 running) and workspace admission, with disjoint ownership. A high-risk item keeps its tier; parallelism does not downgrade T3/T4 review or verification.
- Ordered pipeline (stages known in advance, each needing the parent's actual result): use chain or DAG dependencies. Never parallelize dependent facts.
- Feedback loop (the next step depends on the result): keep it bounded and main-owned: root cause -> focused check -> fresh worker packet. Unknown-cause failures go to `debugger` first. No automatic self-looping helpers, new modes or unbounded retries.

## Planning
Do not create a formal multi-step plan for trivial/localized work. Use `plan` when dependencies, sequencing, rollout, migration, or cross-layer coordination make an explicit execution contract materially useful.

PLAN is main-owned. `architecture-specialist` may supply architecture constraints/options before planning, but does not own worker sequencing, specialist gates, verification routing, or authorization. Use `decision` through main when an architectural choice itself requires explicit authorization.

## Lifecycle
Lifecycle: `DISCOVER -> PLAN -> EXECUTE -> VERIFY -> REVIEW -> INTEGRATE -> SHIP -> LEARN`
This is a state model, not a mandatory list of model calls. Skip phases that are not needed. A small task may legitimately be `EXECUTE -> local verification -> done`. DEBUG is inserted when cause is unknown. INTEGRATE/SHIP/LEARN run only when the task actually requires them.

When SHIP or LEARN is selected, the named owner is `release-engineer`.

## Critical correctness invariants
Preserve existing project invariants and user requirements.

For persistence/state machines/concurrency:
- prefer explicit constraints and idempotency;
- keep transactions short;
- do not perform external work inside DB transactions;
- avoid blocking work on async executors;
- avoid locks across `.await` unless deliberately justified;
- bound queues and define overload behavior;
- define task ownership/cancellation/shutdown;
- test state transitions and boundary conditions;
- treat migrations/destructive operations as high risk.

For security:
- validate at trust boundaries;
- do not expose secrets;
- preserve authorization and least privilege;
- escalate uncertain security-sensitive behavior to `security-specialist`.

## Agent failure
A failed/empty agent launch is not evidence. `0 tool uses` may still be valid only if the role received sufficient supplied evidence and returned substantive analysis; otherwise treat it as BLOCKED/UNKNOWN.
Do not repeatedly relaunch expensive agents with unchanged prompts. Fix the blocker or change the route.

## Context discipline
Keep task packets concise. Prefer file paths + relevant snippets/evidence over full files.
Default output targets:
- Scout/specialist/debugger: concise handoff, normally <= 700 words.
- Worker: concise completion + changed files + tests.
- Tester/reviewer/release-engineer: findings/evidence only, normally <= 700 words.
Longer output is justified only when the evidence itself requires it.
Do not load extended reference documents unless the compact skill says the task needs them.

## Packet discipline
Send task, absolute candidate, requirements/expected behavior, relevant evidence locations, authorized/forbidden scope and output/checks. VERIFY/REVIEW also need exact candidate identity and accepted contract. SHIP needs exact candidate/version, destination and operation authority. Leaves do not inherit main history. Role frontmatter is injected; assigned modules are read explicitly, not assumed preloaded. Missing essentials yield a specific missing-input handoff. Reuse loaded guidance and refresh only evidence affected by candidate changes.
