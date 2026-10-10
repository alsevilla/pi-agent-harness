# Run manifest (main-owned, complex runs only)

Read only when a complex multi-stage run needs a durable record. Optional: simple, localized or single-stage tasks do not need one. This adds no universal gate, no runtime persistence and no automatic generation.

## Role and boundaries
- Main owns and writes the manifest. Leaves never write it.
- Location: `_evidence/<task>/MANIFEST.md` in the assigned evidence root (absolute path from the task packet). Do not place it in the candidate source tree unless explicitly authorized.
- It is a durable record, not a running-job archive, scheduler, database, lock or Git permission. Writing it grants no commit, push, merge, publish or deploy authority.
- Exclude secrets, credentials, tokens, personal data (student or parent data), raw provider payloads and full logs. Reference evidence paths instead.

## Required content
1. Goal: the user's acceptance criteria in one or two sentences.
2. Candidate: absolute path, branch, full HEAD SHA and a fingerprint recorded at write time (for example a hash of `git status --short` plus the diff stat).
3. Authority boundaries: what is authorized, what is not, and the message reference or decision record that grants each item.
4. Accepted plan: plan path or `none (localized change)`, with acceptance date and version.
5. Current phase: DISCOVER, PLAN, EXECUTE, DEBUG, VERIFY, REVIEW, INTEGRATE, SHIP or LEARN, plus any hold (PAUSED or BLOCKED, with reason).
6. Stages: one row per job with stage id, job or task, actual named role, status, check result and evidence path.
7. Open items: every FAILED, BLOCKED, PAUSED or UNKNOWN stage, and every pending decision with owner and the decision needed.
8. Next authorized action: one action, its owner and the authority it relies on.
9. Change log: dated entries; any write marks affected checks STALE.

## Status vocabulary
- `PLANNED`: not launched.
- `LAUNCHED`: launch receipt only. A receipt is not completion.
- `PASS` / `FAIL` / `BLOCKED` / `ESCALATE`: from an actual recovered result with its check evidence.
- `PAUSED`: held by the user or main; do not resume without an explicit release.
- `UNKNOWN`: no actual result was recovered. Investigate; never treat as PASS.
- `NOT RUN`: intentionally not executed, with the reason. Distinct from UNKNOWN.

## Rules
- Aggregate readiness cannot be PASS while any affected stage is FAIL, BLOCKED, UNKNOWN or PAUSED. An unrelated passing stage does not clear a failed one.
- A failed affected stage returns to PASS only after it is actually repaired and re-verified, with new evidence paths.
- Any new write invalidates the affected checks: mark them STALE and rerun them before PASS.
- Job IDs from earlier sessions are historical references only. Never resume a job by its old ID after a reload.

## Resuming after a reload
1. Inspect the actual candidate: branch, HEAD and fingerprint against the manifest.
2. Inspect the evidence files named in the stage rows.
3. Inspect live process owners, if any. Do not assume a running job still exists.
4. Preserve every hold (user stop, pause, queued item) unchanged. Do not clear holds to continue.
5. Record what was verified and update the change log before the next action.

## Template

````markdown
# Run manifest: <task-slug>

## Goal
<one or two sentences; user acceptance criteria>

## Candidate
- Path: <absolute candidate path>
- Branch: <branch>
- HEAD: <full SHA at record time>
- Fingerprint: <method and value>
- Recorded: <YYYY-MM-DD HH:MM>

## Authority boundaries
- Authorized: <scope>
- Not authorized: <explicit list>
- Reference: <message ref or decision record path>

## Accepted plan
- Plan: <path or none (localized change)>
- Accepted: <date>, version <id>

## Current phase
- Phase: <phase>
- Hold: <none | PAUSED: reason | BLOCKED: reason>

## Stages
| Stage | Job / task | Role | Status | Check result | Evidence path |
|---|---|---|---|---|---|
| S1 | <task> | <actual role> | <status> | <command and result, or NOT RUN: reason> | <absolute path or none> |

## Open items
- <stage, status, owner, what is needed>
- Pending decisions: <question, owner, blocked scope>

## Next authorized action
- Action: <one action>
- Owner: <main or named role>
- Authority: <reference>

## Change log
- <YYYY-MM-DD HH:MM> <change; affected checks marked STALE>
````

## Filled example (synthetic task)
Task: add a header check to a fictional `sample-exporter` CLI. Paths and IDs are invented.

````markdown
# Run manifest: sample-exporter-header-check

## Goal
Reject CSV exports whose header row is missing the `record_id` column. Acceptance: unit test passes and an independent verifier confirms.

## Candidate
- Path: C:/synthetic/worktrees/sample-app
- Branch: feat/sample-exporter-header
- HEAD: 0123456789abcdef0123456789abcdef01234567
- Fingerprint: sha256 of git status plus diff stat = 9f2c...e1 (synthetic)
- Recorded: 2026-01-10 09:00

## Authority boundaries
- Authorized: edits inside the candidate; focused tests.
- Not authorized: commit, push, merge, publish.
- Reference: user message ref m00012 (synthetic).

## Accepted plan
- Plan: none (localized change)

## Current phase
- Phase: VERIFY
- Hold: none

## Stages
| Stage | Job / task | Role | Status | Check result | Evidence path |
|---|---|---|---|---|---|
| S1 | header check in exporter | general-worker | PASS | unit test: 1 passed (synthetic) | C:/synthetic/worktrees/_evidence/sample/S1.txt |
| S2 | independent verify | test-engineer | FAIL | edge case: header with BOM is rejected (synthetic) | C:/synthetic/worktrees/_evidence/sample/S2.txt |
| S3 | repair BOM handling | general-worker | PASS | unit test: 2 passed (synthetic) | C:/synthetic/worktrees/_evidence/sample/S3.txt |
| S4 | re-verify after repair | test-engineer | LAUNCHED | receipt only; no result yet | none |

## Open items
- S4 LAUNCHED: no result recovered. Aggregate is not PASS until its real result is read.
- S1 PASS does not clear S2 FAIL; S2 is cleared only by S4 evidence.

## Next authorized action
- Action: read the actual S4 result from its evidence path.
- Owner: main
- Authority: task authorization for focused verification.

## Change log
- 2026-01-10 09:40 S3 repair changed the candidate; S1 and S2 checks marked STALE.
````

The example shows the aggregate rule: S1 passed, S2 failed, and the run is not PASS until S3 is repaired and S4 yields a real result.
