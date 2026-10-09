# Harness upgrade checklist

Use only when applying a harness upgrade to this profile. It adds no universal gate and does not change routing, models, tools or delegation. Independent review only when the upgrade's risk warrants it; not a default chain.

Mark each item PASS, FAIL, NOT RUN or N/A (with reason). PASS needs the named command or evidence path. Untouched items are N/A.

## Record (per upgrade)
- Candidate: absolute path, branch, HEAD SHA; dirty paths preserved (list).
- Versions: Pi, packages and Node as actually observed.
- Scratch/evidence: absolute paths used.
- Risk level and whether independent review was warranted, with reason.
- Before/after: changed files, size deltas, and the behavior each change affects.

## 1. Selective skill loading
- Entry read once per session; references load only when their SKILL.md trigger matches.
- Each reference names its read trigger; no preload list added.

## 2. Handoffs and token efficiency
- Child final report keeps STATUS, CHECKS, RISKS and EVIDENCE; FAIL, NOT RUN and blockers are never trimmed.
- Background completion notices stay at most 4,000 characters; an `INCOMPLETE HANDOFF` notice is not PASS evidence.
- Retained-job `subagent_control` `result` (last 64 finished) is lossless; compare with the child report.
- Chain `{previous}` passes full final text, not an excerpt.
- Foreground single, chain and parallel output keeps every text block of the final assistant message (`getFinalOutput` → `extractFinalText`) and a failed child's distinct ERROR/STDERR diagnostics; the former 50KB foreground parallel cap is removed (user-approved). Automatic background completion stays bounded (4,000-character rule above). Evidence is fake-runtime/unit only; no live provider proof.
- Token savings: record only actual measured orchestrator/child/cached tokens; otherwise NOT RUN. Never claim a saving without measurement.

## 3. Modularity, reuse, dependencies
- Each rule has one owner; no duplicated procedure across AGENTS.md and references.
- New files are reachable from a discoverable relative link; every link target exists.
- No new dependency, package or Python requirement without separate authorization.

## 4. Agent routing
- Role names, models, thinking levels and tool lists unchanged unless the upgrade targets them; diff roles.json and frontmatter for drift.
- Only main launches delegated work; leaves never launch helpers.
- Implementation workers keep no `write` or Serena mutation tools unless explicitly authorized.

## 5. Control reliability
- Error, abort, cancellation, pause and decision delivery each have a focused test or NOT RUN reason.
- A cancelled, blank or timed-out decision answer is never approval.
- Terminal results remain retained and recoverable after pause or cancel.

## 6. Provider/account/model cooldown and fallback: NOT IMPLEMENTED, NOT RUN
- Queued user request; not shipped by this upgrade. Do not mark PASS.
- Required behavior when implemented: main and all subagents skip a blocked provider until a trusted reset deadline; parse relative and absolute timezone deadlines; use an eligible fallback; send one probe after expiry; apply a bounded cooldown when no reset is given.

## 7. Trust, security and write ownership
- Diffs contain no secrets, auth files, sessions or local config; run `git diff --check` and a credential-pattern search.
- Child output is not redacted; the 4,000-character cap is a size control, not a secret control.
- One writer per candidate; read-only roles modify no candidate files.
- Writes resolve inside the assigned candidate/worktree path.

## 8. Compatibility and regressions
- Compare observed versions with those the changed code assumes.
- Run focused regression checks for each changed behavior; record exact commands and results.
- Live provider, TUI, native-terminal and billing checks: NOT RUN unless actually performed.

## 9. Authorization, activation and rollback
- Passing checks do not authorize activation, reload, commit, push, PR or publication; each needs its own recorded authorization.
- Rollback: record the pre-upgrade HEAD SHA and backup path of preserved work; state whether rollback was verified or NOT RUN.

## Verdict
- A FAIL in an item the upgrade touches blocks that upgrade's delivery. Report every item with its evidence path or reason.
