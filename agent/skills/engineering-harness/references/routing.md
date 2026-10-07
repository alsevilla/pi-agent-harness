# Conditional routing and evidence

Read only when the next role or gate is uncertain. User requirements and the compact AGENTS policy govern authority; this reference adds no universal pipeline.

## Discovery
Use `scout` only when the relevant location, dependency surface, or existing behavior is
not already sufficiently known.

Skip Scout when the user, error, compiler, test, or previous evidence already identifies
the relevant files/components.

Scout answers **where / what is affected**, not **why it fails**.

## Debugging
A request to fix an existing malfunction is a bug-fix incident.

If root cause is not established by evidence:
`debugger -> worker`

Add Scout first only when location/blast radius is unknown.
Add a specialist only when debugging exposes a material unresolved domain decision.
Add independent verification/review only when risk warrants it.

Debugger may be skipped when evidence already establishes the cause and the remaining
work is implementation-only.

If a speculative fix fails or produces an unexplained regression, use debugger before
another speculative patch.

## Specialists
Specialists are conditional.

Do not summon a specialist merely because code touches that domain. Use one only when
there is a material unresolved decision or risk that the worker should not decide alone.

Typical ownership:
- SQLite/SQLx/data integrity -> `sqlite-specialist`
- Tokio/races/backpressure/shutdown -> `concurrency-specialist`
- auth/secrets/trust/privilege -> `security-specialist`
- public/typed API contract -> `api-specialist`
- subsystem boundaries/major tradeoffs -> `architecture-specialist`
- measured performance/overload -> `performance-specialist`
- RFID/device I/O -> `hardware-integration`
- deployment/service/backups -> `devops-specialist`
- logs/metrics/health/audit -> `observability-specialist`
- UX/design judgment -> `ui-ux-specialist`

One specialist is preferred. Multiple specialists require distinct unresolved questions.

## Frontend
If the task requires a real design/UX decision, use `ui-ux-specialist` before
`frontend-worker`.

Skip the design specialist when the design is already approved or the change is a
localized implementation/presentation fix with no design judgment.

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

A normal localized T1 change does not require a separate test agent if the worker provides
credible focused test evidence.

## Review
Reviewer is **not automatic**.

Use `reviewer` for materially risky changes such as:
security/auth, concurrency, migrations, state machines, destructive behavior, data
integrity, cross-module refactors, public API compatibility, disputed findings, or
high-impact business logic.

Skip reviewer for routine localized changes that already have credible implementation
and test evidence.

## Oracle
Use `oracle` only when:
- credible high-impact disagreement remains after normal review;
- data-loss/security/correctness risk is severe and unresolved;
- two reasonable fix attempts failed and root cause remains disputed.

Never use Oracle as routine second opinion.

## Planning
Do not create a formal multi-step plan for trivial/localized work.

Use `plan` when dependencies, sequencing, rollout, migration, or cross-layer coordination
make an explicit execution contract materially useful.

## Lifecycle
Lifecycle:
`DISCOVER -> PLAN -> EXECUTE -> VERIFY -> REVIEW -> INTEGRATE -> SHIP -> LEARN`

This is a state model, not a mandatory list of model calls.

Skip phases that are not needed. A small task may legitimately be:
`EXECUTE -> local verification -> done`.

DEBUG is inserted when cause is unknown.
INTEGRATE/SHIP/LEARN run only when the task actually requires them.

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
A failed/empty agent launch is not evidence.
`0 tool uses` may still be valid only if the role received sufficient supplied evidence and
returned substantive analysis; otherwise treat it as BLOCKED/UNKNOWN.

Do not repeatedly relaunch expensive agents with unchanged prompts. Fix the blocker or
change the route.

## Context discipline
Keep task packets concise. Prefer file paths + relevant snippets/evidence over full files.

Default output targets:
- Scout/specialist/debugger: concise handoff, normally <= 700 words.
- Worker: concise completion + changed files + tests.
- Tester/reviewer: findings/evidence only, normally <= 700 words.

Longer output is justified only when the evidence itself requires it.

Do not load extended reference documents unless the compact skill says the task needs them.

## Packet discipline
Send task, absolute candidate, requirements/expected behavior, relevant evidence locations, authorized/forbidden scope and output/checks. VERIFY/REVIEW also need exact candidate identity and accepted contract. Leaves do not inherit main history. Role frontmatter is injected; assigned modules are read explicitly, not assumed preloaded. Missing essentials yield a specific missing-input handoff. Reuse loaded guidance and refresh only evidence affected by candidate changes.
