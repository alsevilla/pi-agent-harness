---
name: rfid-attendance
description: Route unresolved RFID school-attendance business, event-reconciliation, messaging-reliability, and privacy/data-governance semantics to the narrow named specialist without granting implementation authority.
---

# RFID attendance domain

Use this registered skill only when RFID school-attendance business/event/notification/privacy semantics are material. It supplies domain guidance, not implementation authority and not a mandatory pipeline.

## Read only the relevant module index
| Need | Module | Named role |
|---|---|---|
| Attendance state machine, schedules, late/half-day/absent, optional lunch, finalization | `attendance-domain/index.md` | `attendance-domain-specialist` |
| Offline readers, replay, retries, idempotency, ordering, clock skew, acknowledgement | `event-reconciliation/index.md` | `event-reconciliation-specialist` |
| SMS job lifecycle, provider failure, retry, delivery callbacks, duplicate suppression | `messaging-reliability/index.md` | `messaging-specialist` |
| Student/parent PII, retention, exports, logs, backups, minimization | `privacy-compliance/index.md` | `privacy-compliance-specialist` |

Main selects the named role only for a material unresolved decision. Leaves read their assigned module directly and never launch other roles.

Do not let domain modules silently override confirmed school policy, security requirements, database invariants, or user authority. Cross-cutting unresolved SQLite, Tokio, security, API, hardware or deployment questions return to main for the corresponding specialist.
