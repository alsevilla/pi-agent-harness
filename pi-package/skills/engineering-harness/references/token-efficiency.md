# Token-efficient handoff and routing reference

Read only when investigating token consumption, oversized results, repetitive routing or chain prompt growth. This reference adds no mandatory role or lifecycle gate.

## Orchestrator
- Keep task goal, acceptance criteria, exact candidate and authority boundaries.
- Choose a narrow role once; reuse the decision until new evidence changes risk.
- Do not re-read full code, worker logs or the skill catalog after a successful handoff.
- Skip `scout` when exact source scope is already known; avoid routine `oracle` or reviewer calls.
- Let implementation workers run focused relevant checks; reserve independent roles for critical risks per existing policy. Never skip justified independent checks.
- Keep PLAN, DECISION, INTEGRATE sequencing with main.

## Child final report
Child system prompts for roles with a prompt body get the final-handoff format from the packaged `extensions/subagent/compact-handoff.ts`. Normally 150-250 tokens (not a strict ceiling):

```text
STATUS: PASS | FAIL | BLOCKED | ESCALATE
SUMMARY: <what actually changed or was learned>
FILES: <changed paths; none for read-only roles>
CHECKS: <actual command and result; NOT RUN if applicable>
RISKS: <remaining critical warnings or none>
NEXT: <done / one justified next action>
EVIDENCE: <existing exact output path(s) or none>
```

This is prompt guidance, not proof of obedience. Failed or NOT RUN checks, blockers, security/data risks and pending decisions stay in the report even when it exceeds the budget. PASS requires the assigned scope and its required checks to pass; exit code 0 alone is not PASS. Write long logs and diffs only to assigned evidence paths.

## Runtime result handling (current implementation)
- Foreground runs: not capped by this change. The visible text keeps the existing extraction (`getFinalOutput` in `index.ts`: the first text block of the latest text-bearing assistant message).
- Background automatic completion: the follow-up message is at most 4,000 characters. Longer output begins with `INCOMPLETE HANDOFF: job <id> output exceeds 4000 chars ...` and the exact recovery call `subagent_control action "result" target "<id>"`, then up to 8 priority lines (STATUS, RISKS, WARNINGS, BLOCKERS, ERROR(S), CHECKS, NEXT, and failure keywords), an excerpt, and `[TRUNCATED: do not infer PASS from this excerpt.]`. Never infer PASS from the excerpt.
- Explicit `subagent_control` `result` for a retained job: lossless and unbounded. Each child gets a heading `### <agent> — completed` or `### <agent> — FAILED/STOPPED` (with `ERROR:` from `errorMessage` or `stderr`), then all text blocks of its latest text-bearing assistant message. Children are separated by `---`. A job without retained child details returns its stored result unchanged.
- Chain `{previous}`: the complete final text of the previous step (all text blocks joined), not an excerpt. Existing error and abort flags stay authoritative.
- Retention: the runtime keeps at most 64 finished background jobs for recovery. This is not a durable archive; older results are not recoverable and evidence belongs in `_evidence`.
- Child output is not redacted. The 4,000-character bound is a size control, not a secret or PII control.

## Measurement
Measure orchestrator input/output tokens separately from child tokens and provider cached tokens. Compare equal-complexity tasks and review quality, not only request counts. Reduced orchestrator input can increase total cost when unnecessary agents are spawned. No measured token or cost saving is established by this change; use actual observations.
