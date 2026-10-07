# Rust + Axum Engineering

This skill supplies **implementation guidance** to the authorized backend
writer. It is not a new worker, architect, or lifecycle owner.

## Authority

Normally:
- `rust-worker` owns source mutation;
- `concurrency-specialist` analyzes difficult concurrency risk;
- `api-specialist` owns contract reasoning;
- `reviewer` and `test-engineer` remain independent.

Do not turn framework guidance into product policy.

## Rust correctness

Prefer:
- explicit domain/error types;
- `Result` propagation rather than panic paths for expected runtime failure;
- narrow ownership and lifetimes;
- borrowing over unnecessary cloning when it keeps code understandable;
- small pure functions for domain rules;
- explicit conversion at boundaries;
- types that make invalid states harder to represent.

Challenge:
- `unwrap`/`expect` on request/data paths;
- hidden global mutable state;
- broad `Arc<Mutex<_>>` without a clear invariant;
- cloning as a default escape hatch;
- swallowing errors;
- `unsafe` without a proven need and documented invariant.

## Axum boundaries

### State

Use typed `State` for application-global state such as configuration, pools, or
shared services when that matches repository architecture.

Request-derived values belong in request extensions/extractors rather than
being mixed into global app state.

Do not put every service behind one giant mutable state object merely because
Axum supports shared state.

### Extractors and validation

Keep extractor order and body consumption correct.

Parse/validate at the boundary, then pass domain-friendly values inward.

Do not let handlers become giant service/domain functions.

### Responses and errors

Prefer stable error mapping and explicit status/response semantics.

Custom application errors may implement/convert into `IntoResponse` when that
matches project style.

Do not expose internal database/runtime error strings as public API details.

### Middleware

Axum uses Tower/Tower-HTTP middleware.

Choose middleware scope intentionally:
- whole router;
- route layer;
- individual method/handler.

Do not hide core business behavior inside middleware just because it is
technically possible.

## Tokio / async correctness

### Do not block the async runtime

Identify:
- synchronous filesystem/device calls;
- CPU-heavy work;
- blocking third-party APIs;
- long critical sections.

Use an appropriate blocking boundary such as `spawn_blocking` only when the
work is truly blocking and cancellation/ownership semantics are understood.

### Locks

Do not hold synchronous or async locks across `.await` unless the invariant
actually requires it and the risk is explicitly reviewed.

Keep lock scope narrow.

### Tasks

For every spawned task establish:
- who owns it;
- how failure is observed;
- how cancellation happens;
- how shutdown waits for it;
- what state is left if it exits early.

Do not fire-and-forget important persistence or notification work.

### Channels and backpressure

For burst-sensitive work prefer bounded capacity unless unbounded growth is an
explicit, justified design.

For each queue/channel state:
- producer behavior when full;
- consumer concurrency;
- ordering guarantees;
- duplicate/idempotency behavior;
- retry ownership;
- permanent failure behavior.

A queue moves pressure; it does not remove pressure.

### Cancellation and graceful shutdown

A service with background tasks should define:
1. what triggers shutdown;
2. how tasks receive cancellation;
3. what in-flight work may finish;
4. what must be persisted before exit;
5. how the process waits for owned tasks;
6. timeout/escalation behavior if shutdown stalls.

Use cancellation signaling appropriate to the project; Tokio's
`CancellationToken` is one standard option.

Cancellation must not silently lose committed/accepted work.

## API/service layering

Keep request extraction/serialization separate from reusable domain/service
logic when practical.

Do not let:
- SQL rows;
- SQLx structs;
- internal enums;
- device-specific shapes

silently become public API contracts.

## Backend tests

Use TDD under the governing execution contract.

Depending on risk, tests may include:
- pure unit tests for domain rules;
- Axum handler/router integration tests;
- async Tokio tests;
- database integration tests;
- serialization/contract tests;
- concurrency/duplicate/retry tests;
- shutdown/cancellation tests.

For bug fixes:
`REPRODUCE -> RED -> GREEN -> REGRESSION`.

Do not chase a coverage percentage by adding low-value assertions.

## Candidate checks

Use project-supported commands. Common Rust checks include:
- `cargo fmt --check`;
- `cargo check`;
- `cargo clippy -- -D warnings` when the project accepts that strictness;
- focused `cargo test`;
- broader regression tests according to risk.

Do not run write-mode formatting during read-only Verify/Review unless the
governing authority explicitly permits mutation.

## Performance

Measure before tuning.

Distinguish:
- runtime blocking;
- lock contention;
- task explosion;
- queue saturation;
- serialization cost;
- database acquisition/query time;
- API/network latency.

Do not copy React/Node/backend folklore into Rust without evidence.

## Completion

Return:
- exact behavior implemented/reviewed;
- async/concurrency assumptions;
- error/API implications;
- tests/checks run;
- unresolved database/concurrency/contract risks.
