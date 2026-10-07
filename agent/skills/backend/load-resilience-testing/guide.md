# Load & Resilience Testing

This skill owns one question:

> How do we prove the system remains correct, bounded, observable, and
> recoverable under realistic burst traffic, overload, contention, shutdown,
> and dependency failure?

It is a **verification/performance workflow**, not a new worker role.

## Authority and Safety

Do not run disruptive load or fault injection against production, shared
staging, external paid services, or other user-visible environments without
explicit runtime/external-effect authority.

Prefer:
- disposable/local environments;
- isolated test databases;
- fake/local SMS gateways;
- bounded scenarios;
- explicit cleanup.

A successful throughput result does not authorize a production capacity claim.

## Evidence Types

Keep these distinct:

1. **Load evidence**
   - throughput;
   - latency distribution;
   - saturation point;
   - recovery after traffic changes.

2. **Concurrency evidence**
   - task/channel/lock correctness;
   - duplicate/lost work;
   - ordering;
   - boundedness.

3. **Resilience evidence**
   - dependency failure;
   - timeout/retry behavior;
   - shutdown;
   - restart/recovery;
   - degraded operation.

A system can pass one and fail another.

## Correctness Before Throughput

A run is not successful merely because it achieves a high request rate.

Track relevant correctness signals such as:
- requests/events accepted;
- events persisted;
- duplicate records;
- lost events;
- rejected/overloaded requests;
- queue depth;
- oldest queue age;
- retries;
- permanent failures;
- SQLite busy/locked events;
- DB pool acquisition latency;
- transaction latency;
- shutdown drain completion;
- restart recovery;
- external side-effect behavior.

For attendance/event systems, accepted work must not silently disappear.

## Workload Model

Choose a model that matches the real producer.

For RFID/card-reader bursts, an **open arrival-rate model** is usually the more
useful system-capacity test because taps continue arriving even when the server
slows.

Avoid accidental coordinated omission where the load generator reduces traffic
simply because responses became slower.

Document:
- target rate;
- burst duration;
- ramp/spike shape;
- concurrency/VU limits;
- dataset/cardinality;
- request mix;
- reader/source distribution;
- think time, if any;
- expected vs overload scenario.

## Scenario Ladder

Run the smallest scenario that answers the question.

### 1. Correctness baseline

Before load:
- focused functional tests pass;
- schema/migrations are correct;
- metrics/logging needed for the scenario are available;
- test data is representative enough;
- duplicate/idempotency expectations are explicit.

### 2. Smoke

Small traffic verifies:
- test harness;
- endpoint shape;
- metrics;
- database setup;
- correctness counters.

### 3. Expected burst

Model the supported real workload, including realistic clustering rather than
only average requests/second.

### 4. Spike

Drive a short rate above expected burst to observe:
- queue growth;
- admission/rejection;
- latency tails;
- DB contention;
- recovery time.

### 5. Sustained overload

Only when justified.

Verify:
- overload is bounded;
- queues do not grow without limit;
- memory/task counts remain controlled;
- failure/rejection behavior is explicit;
- system recovers after load drops.

### 6. Database contention

Exercise realistic concurrent readers/writers and write bursts.

Observe:
- busy/lock behavior;
- pool acquisition;
- transaction duration;
- WAL/checkpoint-related behavior where measurable;
- retries;
- correctness.

### 7. Dependency failure

For network dependencies such as an SMS gateway, inject controlled:
- latency;
- timeout;
- disconnect;
- intermittent failure;
- rate limitation when supported.

Verify:
- retries are bounded;
- idempotency is preserved;
- failures become observable;
- queues do not grow forever.

### 8. Shutdown under load

While work is in flight:
1. trigger shutdown;
2. stop/limit admission according to policy;
3. signal owned tasks;
4. drain or safely persist accepted work according to contract;
5. wait for owned tasks;
6. terminate;
7. restart;
8. verify state.

Do not test graceful shutdown only while idle.

### 9. Restart / recovery

Verify:
- no duplicated accepted work;
- no silently lost committed work;
- pending/retry state resumes according to policy;
- database integrity remains valid.

### 10. Soak

Use only when the risk justifies it.

Look for:
- memory/resource growth;
- handle/task leaks;
- WAL growth/checkpoint behavior;
- retry accumulation;
- queue creep;
- latency degradation over time.

## Tool Guidance

Choose tools based on the evidence question.

### k6

Preferred for repeatable HTTP/system workload scenarios, especially arrival-rate
tests and threshold-based pass/fail criteria.

Useful for:
- expected burst;
- spike;
- sustained overload;
- scenario composition;
- latency/error thresholds.

Treat dropped load-generator iterations as evidence that either:
- the generator lacks capacity; or
- target latency caused insufficient available workers/VUs.

Investigate before attributing them solely to the application.

### oha

Useful for lightweight, fast endpoint probing and simple HTTP load from local or
CI environments.

Prefer it for quick smoke/stress checks, not complex multi-step business flows.

### Criterion / microbenchmarks

Use for pure Rust hot-path microbenchmarks.

Do not use a microbenchmark as proof of end-to-end Axum/SQLx/SQLite capacity.

### Loom / Shuttle

Use only for concurrency invariants that justify controlled schedule
exploration.

- Loom: small critical concurrency primitives/invariants.
- Shuttle: larger randomized concurrency scenarios.

Do not force all async code into these tools.

### Toxiproxy or equivalent

Use for external network dependency fault injection when explicitly authorized.

Do not use it for local SQLite file locking.

### Internal failpoints

Test-only failpoints may be useful for hard-to-trigger internal failures.

Adding failpoints is source mutation and must be separately authorized.

## Tower / Backpressure

When Tower middleware controls concurrency or buffering, verify the **actual
layer order**.

Buffering and concurrency limits are not interchangeable:
- a buffer outside a concurrency limit allows queued requests beyond active
  concurrency;
- a concurrency limit outside the buffer constrains the broader stack first.

If load shedding is used, verify:
- overload rejection behavior;
- returned status/error mapping;
- reader/client retry expectations;
- recovery after capacity returns.

Do not solve overload by creating an arbitrarily large queue.

## SQLite / SQLx Under Load

Remember:
- WAL improves read/write concurrency but SQLite still serializes writers;
- busy timeout is waiting policy, not a correctness guarantee;
- retries must be bounded and safe;
- pool size is not a throughput knob by itself.

Measure:
- pool acquire latency;
- transaction latency;
- busy/locked frequency;
- queue delay before DB work;
- write duration;
- retry count;
- important query latency.

Use a disposable real SQLite file for contention evidence rather than mocks.

## Pass / Fail Contract

Define thresholds before the run when possible.

A useful result may include:
- throughput;
- p50/p95/p99 or other agreed latency percentiles;
- error/rejection rate;
- queue max/age;
- DB busy rate;
- pool acquire latency;
- duplicates/lost work;
- retry/permanent failure counts;
- shutdown drain duration;
- time to recover after a spike.

Possible verdicts:

- **PASS** — required correctness and performance/resilience criteria satisfied.
- **FAIL** — a required criterion or invariant failed.
- **INCONCLUSIVE** — environment/tool capacity/observability did not support a
  trustworthy conclusion.

Do not convert INCONCLUSIVE into PASS.

## Agent Routing

This skill may be used by:
- `test-engineer` — independent scenario execution/verdict;
- `performance-specialist` — workload modeling and bottleneck measurement;
- `concurrency-specialist` — backpressure/task/channel/cancellation analysis;
- `sqlite-specialist` — contention/WAL/pool/transaction analysis;
- `observability-specialist` — required runtime signals;
- `reviewer` — challenge unsupported capacity/resilience claims.

`rust-worker` implements separately authorized fixes. This skill itself does not
grant source mutation.

## Output Contract

Report:
1. environment and safety boundary;
2. exact candidate/version;
3. workload model and scenario;
4. tool/configuration;
5. correctness invariants;
6. performance/resilience thresholds;
7. measured results;
8. bottleneck/failure classification;
9. missing evidence/tool limitations;
10. PASS/FAIL/INCONCLUSIVE;
11. recommended next action without silently authorizing a fix.
