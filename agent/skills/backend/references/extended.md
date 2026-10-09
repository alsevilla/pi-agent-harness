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
# Backend Capability Router

<IMPORTANT>

This is the **mandatory backend-domain front door** under the engineering
harness. It is not a second lifecycle.

When backend concerns are material, invoke `Skill(backend)` before selecting a
backend capability or routing `backend-worker` / backend specialists. Do not jump
directly from the main session to `rust-axum-engineering`,
`sqlite-sqlx-engineering`, `load-resilience-testing`, or a backend specialist.


## Router Means Dispatch, Not Orchestrator Substitution

In the main conversation, this router selects backend capabilities and agents;
it does not authorize the orchestrator to perform specialist analysis or
non-trivial backend implementation itself.

- unresolved SQLite/SQLx semantics -> dispatch `sqlite-specialist`;
- unresolved concurrency semantics -> dispatch `concurrency-specialist`;
- unresolved API/security/architecture/ops/observability/performance policy ->
  dispatch the justified specialist;
- authorized implementation-only backend work -> dispatch `backend-worker`.

After specialist handoff acceptance, route implementation to `backend-worker`.
If a required agent cannot launch, return BLOCKED for that role instead of
substituting orchestrator reasoning or edits.

This router decides:
- whether a specialist-first domain decision gate is required;
- which backend role owns analysis or implementation;
- which narrow registered backend capabilities are justified;
- which capabilities or specialists would be redundant.

After selection, invoke the narrow registered capability with `Skill(<name>)`
unless it is already preloaded into the dispatched leaf agent.

The engineering harness remains authoritative for Discover, Plan, Execute,
Verify, Review, Integrate, Ship, and Learn.

</IMPORTANT>

## Role Routing

The main implementation writer for backend source (any language) is `backend-worker`.

Read-only/domain specialists may participate when justified:

- `sqlite-specialist` — SQLite/SQLx persistence, migrations, constraints,
  locking, WAL, indexes, query plans;
- `concurrency-specialist` — Tokio tasks, channels, locks, cancellation,
  backpressure, shutdown;
- `api-specialist` — consumer/provider contract, validation, compatibility;
- `performance-specialist` — measured throughput/latency/contention;
- `observability-specialist` — runtime signals and diagnostics;
- `security-specialist` — auth/security-sensitive backend behavior;
- `reviewer` / `test-engineer` — independent post-implementation challenge.

Do not create a second writer merely because several concerns are present.

## Capability Catalog

| Skill | Primary use | Primary owner | Use when | Location |
|---|---|---|---|---|
| `rust-axum-engineering` | Rust + Axum + Tokio + Tower implementation | `backend-worker` | Handlers, services, errors, typed state/extractors, middleware, async tasks, cancellation, shutdown, bounded concurrency, backend tests | `~/.pi/agent/skills/backend/rust-axum-engineering/index.md` |
| `sqlite-sqlx-engineering` | SQLite + SQLx persistence engineering | `sqlite-specialist` for analysis, `backend-worker` for authorized implementation | Schema, migrations, SQLx pool/options, transactions, WAL, busy handling, constraints, indexes, query plans, idempotency, burst writes | `~/.pi/agent/skills/backend/sqlite-sqlx-engineering/index.md` |
| `load-resilience-testing` | Burst/load/resilience evidence | `test-engineer` / `performance-specialist` with domain specialists as needed | Arrival-rate workloads, overload/backpressure, DB contention, dependency failure, shutdown-under-load, restart/recovery, soak when justified | `~/.pi/agent/skills/backend/load-resilience-testing/index.md` |

## Routing Priority

### Rust / Axum / Tokio implementation

Use:

`rust-axum-engineering`

Add `sqlite-sqlx-engineering` only when persistence semantics are material.

Add `concurrency-specialist` when correctness depends on task/channel/lock/
cancellation behavior that is not routine.

### SQLite / SQLx behavior

Use:

`sqlite-sqlx-engineering`

`sqlite-specialist` owns analysis and invariants. `backend-worker` remains the
normal source-code writer.

### API contract changes

Use `api-specialist`.

When frontend and backend evolve independently, keep one authoritative boundary
shape where practical. Make field names, nullability, enums, errors,
timestamps, compatibility, and serialization behavior explicit.

Do not let storage models silently become public API contracts.

### Performance-sensitive backend work

Use `performance-specialist` for evidence and measurement.

Do not treat:
- more DB connections;
- more Tokio tasks;
- larger queues;
- more retries;
- more indexes

as automatic performance improvements.

### Load / resilience / burst verification

Use:

`load-resilience-testing`

Use it when the unresolved question is not "how should this be implemented?"
but "does the exact candidate remain correct and bounded under pressure or
failure?"

Typical triggers:
- RFID/attendance burst windows;
- queue saturation;
- overload/rejection behavior;
- SQLite contention;
- external SMS failure;
- graceful shutdown while work is in flight;
- restart/recovery;
- capacity claims.

This does not authorize production load or implementation changes.

### Observability


Use `observability-specialist` when the task needs runtime evidence such as:
- API latency/error rate;
- queue depth/age;
- worker throughput/retries;
- SQLite busy/lock frequency;
- DB acquisition latency;
- graceful-shutdown completion;
- external-service failure rate.

## Evidence and Authority

Use this priority when backend guidance conflicts:

1. explicit approved product behavior;
2. authoritative project invariants/contracts;
3. database schema/migrations and existing compatibility commitments;
4. repository architecture and tests;
5. official framework/database behavior;
6. generic backend heuristics.

Framework or database tuning does not grant authority to change product
durability, persistence semantics, compatibility, or externally observable
behavior.

## Procedure

1. Confirm `engineering-harness` has established the governing lifecycle state.
2. Apply the specialist-first decision gate in this router.
3. Select the narrowest relevant registered backend capability.
4. Invoke it with `Skill(<capability>)`, unless the assigned leaf agent already receives it through `skills:` preload.
5. Route a read-only specialist first only when unresolved material domain policy or correctness risk justifies it.
6. Keep `backend-worker` as the normal backend source writer.
7. Use additional backend capabilities only for genuinely distinct concerns.
8. Return control to the governing engineering lifecycle for independent Verify/Review and later phases.

### Subagent mode

If this router is invoked inside a leaf agent, it may only help that agent select
a capability within its already-assigned role. It does **not** authorize the
leaf to spawn agents, change lifecycle phase, replace another role, or become an
orchestrator. If another role is required, return a handoff request to the main
conversation.

If a required registered capability is missing, report the installation problem
rather than approximating its procedure from memory.


## Specialist-first decision gate

Backend skills explain **how** to implement. They do not grant a worker
authority to invent unresolved domain policy.

Before backend mutation, route unresolved material decisions to the matching
read-only specialist:
- SQLite/SQLx semantics -> `sqlite-specialist`
- Tokio concurrency/backpressure/shutdown -> `concurrency-specialist`
- API contract -> `api-specialist`
- security boundary -> `security-specialist`
- architecture -> `architecture-specialist`
- device integration -> `hardware-integration`
- deployment/operations -> `devops-specialist`
- observability contract -> `observability-specialist`
- evidence-driven performance strategy -> `performance-specialist`

Then return the accepted handoff to `backend-worker` for implementation.

Do not invoke a specialist for routine code when the relevant contract is
already settled.
