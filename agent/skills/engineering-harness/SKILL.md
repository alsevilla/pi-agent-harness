---
name: engineering-harness
description: Main engineering entrypoint. Select the next phase and actual named role; load only relevant module guidance.
---

# Engineering harness
Main owns sequencing and launches. Apply the compact AGENTS policy; leaves perform only their assignment.
Read this entry once per session and reuse it for subsequent tasks. When execution starts, load only missing relevant domain routers/module indexes and referenced sections. Reread changed guidance or content lost from context; a new task alone does not require another read. Each leaf loads its assignment in its own context.

For "queue this", record the request and order, acknowledge briefly, and continue current work. Select modules/roles when that task is scheduled; do not launch or implement it early. Resolve loading directly without explaining internal deliberations.

| Need | Module / role |
|---|---|
| Unknown location/dependencies | `discover/index.md`; Scout only when needed |
| Unknown-cause failure | `debug/index.md`; actual `debugger` before speculative fixes |
| Conflicting evidence / material choice | `knowledge/index.md` / `decision/index.md`; main owns authorization |
| Necessary dependencies/migration/coordination plan | `plan/index.md`; **main owns PLAN** |
| Authorized implementation | `execute/index.md`; `backend-worker` / `frontend-worker` / `general-worker` |
| Selected independent evidence | `verify/index.md` -> `test-engineer`; `review/index.md` -> `reviewer` |
| Requested isolation/integration | `worktree/index.md`, `integrate/index.md`; main owns orchestration |
| Requested delivery/release | `ship/index.md` -> `release-engineer` |
| Useful durable learning | `learn/index.md` -> `release-engineer` |

PLAN is not an architecture-specialist procedure. The architecture specialist supplies structural analysis/constraints; main incorporates them into PLAN and owns sequencing, writer ownership, gates and authorization.

Do not execute the whole lifecycle by default. Parent frontend/backend/RFID routers select domain modules; procedures do not launch roles by themselves. Use actual subagent calls with self-contained candidate/contract packets and await real evidence. Manual prompts are optional instruction shortcuts.

Read `references/routing.md` only for uncertain role/gate selection; `references/recovery.md` for failed edits/new failures/oversized packets; `references/worker-control.md` for steering/pause/cancel; `references/runtime.md` for integration/provider/shell questions; `references/git-attribution.md` before authorized commits/PRs. None is an automatic preload. Historical `extended.md` material cannot override current authority or create new gates.
