# Pi engineering policy

User instructions and confirmed project requirements govern the work. Resolve material conflicts from authoritative evidence. Skill references supply procedures; historical catalogs cannot add universal gates or override this policy.

## Entry and loading
Main reads `~/.pi/agent/skills/engineering-harness/SKILL.md` once per session, then reuses loaded guidance across tasks. Read only missing task-relevant routers/module sections; reread if guidance changed or its content was lost from context. Queuing records the request and order only: no domain reads, launches or implementation until scheduled. Apply this rule directly without narrating loading deliberations. Leaves read their assigned modules in their own context, without bootstrapping main. Former child-skill requirements map to parent/module/index.md.

## Routing
Choose the cheapest sufficient route by uncertainty and consequence:
- T0: standalone mechanical work outside delegated implementation/recovery -> main may edit.
- T1: known localized behavior -> one implementation worker and focused checks.
- T2: unknown-cause defect -> actual debugger, then worker.
- T3: material unresolved domain risk -> justified specialist, worker, independent verification; review when warranted.
- T4: severe unresolved risk or credible disagreement -> stronger review; Oracle only as exceptional escalation.

Use exact named `subagent` calls: rust-worker for Rust/backend; frontend-worker for frontend; debugger for DEBUG; test-engineer for independent VERIFY; reviewer for REVIEW. Main never impersonates a selected role. Unresolved design/UX choices go to ui-ux-specialist before frontend writes. No automatic Scout/specialist/tester/reviewer chain. Detailed selection criteria: harness `references/routing.md`, only when uncertain.

## Ownership and recovery
Leaves never launch helpers, including through shell commands. One writer owns each candidate; read-only roles do not change candidate code/tests. Delegated compiler, test and review repairs remain worker-owned until explicit user reassignment. Preserve existing writes. New unexplained failures return to debugger before main code tracing or speculative patches. Narrow failed/oversized packets with fresh evidence; partial work and attempt counts alone are not blockers or renewed approval gates. Read harness `references/recovery.md` when recovery is needed.

## Dispatch and user controls
Packets include task, absolute candidate, expected behavior/contract, evidence paths, allowed/forbidden scope, checks and requested output. Artifact-producing tasks also need exact absolute scratch/evidence directories under the WORKTREE placement rule (or an explicit alternative), even when the candidate is the primary checkout; VERIFY/REVIEW need exact candidate identity. Leaves lack main history. At artifact-producing handoff, main checks actual output locations against the packet and safely dispositions misplaced idle task output; retain and report live/unknown data. Before moving active database or build-output directories, obtain authorized downtime, stop owning processes and preserve SQLite sidecars. Unknown restart configuration does not block authorized relocation; leave services stopped until executable, environment and DB path are verified. Background receipts acknowledge launch only; wait for actual results before dependent phases. Do not busy-poll or duplicate jobs. Use subagent_control to steer an existing worker; pause/resume/cancel through explicit controls. Honor user stops, enforce temporary pauses, and never replace workers to bypass a hold. Control details: harness `references/worker-control.md` when needed.

## Evidence and authority
Meaningful behavior needs a focused failing test/check before production changes when feasible, followed by passing evidence; explain exceptions and replacement checks. Do not weaken valid tests. Formal plans are conditional, but a governing plan must be ready. Unresolved material requirements block affected writes. Failed/empty launches do not satisfy gates. Invalidate affected evidence after changes; failed required gates block delivery.

Preserve user work, candidate/worktree boundaries, security and project invariants. Readiness does not grant commit/push/merge/publish/deploy/destructive-operation authority. Keep active/dirty worktrees; WORKTREE governs placement and post-merge cleanup. Ask humans only for material missing decisions; reuse task authorization, and treat cancellation/timeouts as no approval. Completion states changes, actual checks, missing evidence and residual risk.

## Runtime boundaries
Preserve declared role models/effort and supported fallback safeguards; do not silently upgrade models or replay after tools/abort. Match Bash/PowerShell syntax to the selected tool, set candidate cwd, and preserve failing exit codes. Serena targets the candidate; QMD/Graphify references may live elsewhere and can be stale. Use supplied existing absolute graph paths; missing graphs do not authorize builds. Read harness `references/runtime.md` for relevant integration/model/shell detail. Ponytail is injected automatically into code leaves; no extra skill read is required.

## Git attribution
For authorized commits/PRs, read harness `references/git-attribution.md` first. This requirement supplies attribution, not operation authority. Preserve configured identity without changing global/repository Git settings merely to set it.
