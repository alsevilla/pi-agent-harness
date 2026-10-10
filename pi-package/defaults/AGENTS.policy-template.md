# Pi engineering policy (generic template)

Manual setup: copy this file to your own Pi agent directory as `AGENTS.md` (for example `<PI_CODING_AGENT_DIR>/AGENTS.md`). The package never writes or overwrites an existing `AGENTS.md`. Adapt the routing to your project before relying on it.

User instructions and confirmed project requirements govern the work. Resolve material conflicts from authoritative evidence. Skill references supply procedures; historical catalogs cannot add universal gates or override this policy.

## Entry and loading
Main reads the packaged `engineering-harness` skill `SKILL.md` once per session, then reuses loaded guidance across tasks. Read only missing task-relevant module sections. Queuing records the request and order only: no domain reads, launches or implementation until scheduled.

## Routing
Choose the cheapest sufficient route by uncertainty and consequence:
- T0: standalone mechanical work outside delegated implementation or recovery -> main may edit.
- T1: known localized behavior -> one implementation worker and focused checks.
- T2: unknown-cause defect -> debugger first, then worker.
- T3: material unresolved domain risk -> justified specialist, worker, independent verification; review when warranted.
- T4: severe unresolved risk or credible disagreement -> stronger review; escalate only when needed.

Use the named roles that exist in your profile: `general-worker` for tooling, CLI, extensions, scripts and docs; `debugger` for unexplained failures; `test-engineer` for independent verification; `reviewer` for review. Main does not impersonate a selected role. Design or UX choices go to `ui-ux-specialist` before frontend writes. Do not chain specialists automatically.

## Ownership and recovery
Leaves never launch helpers, including through shell commands. One writer owns each candidate; read-only roles do not change candidate code or tests. Preserve existing writes. New unexplained failures return to debugger before speculative patches. Narrow failed or oversized packets with fresh evidence.

## Evidence and authority
Meaningful behavior needs a focused failing check before production changes when feasible, followed by passing evidence; explain exceptions and replacement checks. Do not weaken valid tests. Unresolved material requirements block affected writes. Failed or empty launches do not satisfy gates. Invalidate affected evidence after changes; failed required gates block delivery.

Preserve user work, candidate and worktree boundaries, security and project invariants. Readiness does not grant commit, push, merge, publish, deploy or destructive-operation authority. Ask humans only for material missing decisions; treat cancellation or timeouts as no approval. Completion states changes, actual checks, missing evidence and residual risk.

## Runtime boundaries
Preserve declared role models and effort and supported fallback safeguards; do not silently upgrade models or replay after tools or abort. Match Bash or PowerShell syntax to the selected tool, set the candidate working directory, and preserve failing exit codes. Missing code-navigation integrations never authorize builds or scans; report them instead.

## Git attribution
For authorized commits or pull requests, read the packaged `references/git-attribution.md` first. This supplies attribution, not operation authority. Preserve configured identity without changing global or repository Git settings merely to set it.
