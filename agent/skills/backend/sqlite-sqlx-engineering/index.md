# sqlite-sqlx-engineering

sqlite-specialist analyzes persistence; rust-worker implements accepted decisions. WAL does not create multiple SQLite writers. Inspect actual connection/pool settings and schema; do not assume defaults. Preserve durability, migrations, retention, recovery and idempotency policy. Read the matching guide.md section before changing transactions, WAL/busy handling, constraints/migrations, query plans, pool sizing or burst-write semantics. More connections are not inherently faster.

## Read only what applies
Reuse loaded guidance. Search guide.md headings, then read the relevant section; do not load all references or data. Resolve relative reference/script paths from this module folder. This is reference guidance, not an agent launch or extra lifecycle gate.
