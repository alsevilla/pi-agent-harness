# SQLite + SQLx Engineering

This skill supplies persistence guidance beneath the engineering lifecycle.

`sqlite-specialist` normally owns read-only database analysis.
`rust-worker` remains the normal implementation writer.

## First principle

SQLite can handle substantial application workloads, but concurrency semantics
must be designed around SQLite's actual model rather than pretending it is a
client/server database.

WAL improves reader/writer concurrency, but it does **not** create multiple
simultaneous SQLite writers.

## Authority

Do not change any of these merely for performance momentum:
- durability policy;
- migration compatibility;
- retention;
- backup/recovery behavior;
- externally observable write semantics;
- duplicate/idempotency policy.

Those are project/product decisions when material.

## Connection configuration

Inspect the repository's actual `SqliteConnectOptions` / pool setup before
recommending changes.

Relevant controls include:
- file/open mode;
- `journal_mode`;
- `synchronous`;
- foreign-key enforcement;
- `busy_timeout`;
- pool `max_connections`;
- acquire timeout;
- statement cache and other project-specific options.

Do not assume defaults are the intended production policy.

### Pool sizing

More connections are not automatically faster for SQLite.

Choose pool size from:
- read concurrency;
- write contention;
- transaction duration;
- worker model;
- latency requirements;
- actual measurement.

Track pool-acquisition latency when contention is suspected.

## WAL and checkpoint behavior

WAL commonly improves concurrent reads while a writer is active.

Remember:
- write transactions still serialize;
- WAL grows until checkpoint work occurs;
- automatic checkpointing can make occasional commits slower;
- checkpoint strategy affects latency and operational behavior.

Do not disable automatic checkpointing or change checkpoint strategy without an
operational reason and a replacement monitoring/recovery plan.

### Synchronous mode

Treat `FULL` vs `NORMAL` as a durability/performance decision, not a generic
optimization.

In WAL mode, `NORMAL` can be a reasonable performance/safety balance for some
applications, but power-loss durability differs from `FULL`.

Do not change this setting unless the durability tradeoff is authorized.

## Busy/lock handling

A busy timeout can allow a connection to wait for locks instead of failing
immediately.

It is not a substitute for:
- short transactions;
- bounded write concurrency;
- correct retry policy;
- avoiding long reader/writer transactions;
- measuring lock frequency.

Retries must be bounded and safe for the operation.

## Transactions

Make transaction boundaries explicit.

SQLite transactions may be `DEFERRED`, `IMMEDIATE`, or `EXCLUSIVE`.

Use the mode that matches the invariant.

`BEGIN IMMEDIATE` acquires write intent at transaction start and can fail/wait
there if another writer exists. That can be useful when a flow knows it will
write and wants lock acquisition to occur before doing dependent work.

Do not use `IMMEDIATE` everywhere by habit.

Keep write transactions as short as correctness allows.

Never hold a database transaction open across slow external network/SMS/device
operations unless the design explicitly requires it.

## Data integrity

Prefer database-enforced invariants when appropriate:
- `NOT NULL`;
- `UNIQUE`;
- foreign keys;
- `CHECK`;
- appropriate primary keys.

For duplicate-sensitive workflows, prefer a schema-level uniqueness/idempotency
invariant where the domain supports one rather than relying only on a
pre-insert application query.

Do not use constraints that incorrectly reject legitimate historical records.

## Migrations

Before a migration:
1. inspect current schema and migration history;
2. inspect dependent queries/types;
3. classify existing-data compatibility;
4. define failure/rollback/recovery behavior;
5. consider indexes and write cost;
6. verify backup/recovery expectations;
7. test representative existing data.

Do not rewrite or delete migration history casually.

If a migration transforms data, verify the transformed candidate data rather
than only checking that migration SQL completed.

## SQLx guidance

Use repository conventions for:
- compile-time query macros;
- `query_as!` / typed mapping;
- migration tooling;
- offline metadata;
- test database setup.

Compile-time SQL checking is valuable only when the project's build/CI setup
supports the required database/schema metadata.

Do not introduce a live-build dependency unexpectedly.

## Query/index work

Use actual query shapes.

Check:
- predicates;
- joins;
- sort order;
- cardinality/selectivity;
- write frequency;
- covering opportunities where useful;
- duplicate/unused indexes.

Use `EXPLAIN QUERY PLAN` or equivalent evidence for non-trivial tuning.

Indexes accelerate some reads but increase storage and write cost.

## Burst-write design

For bursty RFID/event ingestion:
- bound application concurrency;
- avoid spawning one unbounded write task per tap;
- keep accepted-work semantics explicit;
- use idempotency/uniqueness for duplicate protection;
- batch writes only when transactional semantics permit it;
- separate external SMS work from critical DB transaction duration;
- measure queue age, DB busy frequency, transaction latency, and pool acquire
  latency.

A queue must have a full-queue policy and shutdown behavior.

## Verification

Depending on risk, verify:
- clean database creation;
- migration from representative older schema/data;
- foreign-key/unique/check enforcement;
- rollback on failure;
- duplicate/idempotency behavior;
- concurrent readers/writers;
- busy/timeout behavior;
- query plans for important paths;
- restart/recovery behavior;
- burst workload when performance is material.

## Completion

Return:
- persistence invariants;
- transaction/locking assumptions;
- durability choices that were preserved or require authorization;
- migration/data compatibility;
- measurements/tests run;
- remaining risks.
