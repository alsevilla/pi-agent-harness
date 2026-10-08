# event-reconciliation

Use for unresolved event correctness across readers, retries, offline operation or crashes. The named role is `event-reconciliation-specialist`.

## Required analysis
Establish:
- stable event identity and reader identity;
- retry/replay identity preservation;
- idempotency boundary and durable dedupe rule;
- physical duplicate/bounce policy versus transport duplicate policy;
- ordering guarantees versus assumptions across multiple readers;
- `occurred_at`, `received_at`, and processing timestamps;
- acceptable clock skew and source-of-time policy;
- offline queue and replay behavior;
- acknowledgement point relative to durable persistence;
- server/reader crash windows;
- late-event handling after attendance finalization;
- notification side-effect idempotency.

Avoid unsupported exactly-once claims. Prefer at-least-once transport with durable identity and idempotent business effects.

Return concrete invariants, failure windows, required persistence/concurrency decisions, and deterministic tests/simulations. Read `guide.md` for deeper scenarios.
