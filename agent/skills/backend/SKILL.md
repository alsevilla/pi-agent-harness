---
name: backend
description: Select task-relevant Rust/Axum, SQLite/SQLx or load/resilience modules. Known contracts go to backend-worker; material unresolved domain decisions go to justified specialists.
---

# Backend
Known backend contract (Rust/Axum or another stack) -> backend-worker. Unknown-cause defects follow harness DEBUG.
Touching a domain alone does not require a specialist. For material unresolved decisions:
SQLite -> sqlite-specialist; concurrency -> concurrency-specialist; security -> security-specialist;
API -> api-specialist; subsystem boundaries -> architecture-specialist; measured capacity
-> performance-specialist; device I/O -> hardware-integration; deployment -> devops-specialist;
runtime signals -> observability-specialist. Prefer one relevant specialist and one writer.

## Read only the relevant module index
- Rust/Axum/Tokio/Tower: `rust-axum-engineering/index.md`.
- SQLite/SQLx persistence semantics: `sqlite-sqlx-engineering/index.md`.
- Selected bounded load/failure evidence: `load-resilience-testing/index.md`.

Modules are reference procedures. Relative resources belong to their module folder.
Read only matching guide sections when directed; reuse loaded guidance. No default full
catalog, pool tuning, extra specialist or production-load authority. For other stacks use
the project's actual writer. Main owns named launches and explicit global packets; leaf
agents return handoff needs. Apply independent gates under current global policy only.
