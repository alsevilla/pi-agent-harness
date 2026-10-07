# Worker recovery

Load for failed edits, new failures or oversized packets. Main owns launches; worker ownership remains in force.

## Recovery preserves worker ownership
Once implementation is assigned to a worker, its remaining edits, compiler fixes,
review fixes, and recovery stay worker-owned until an explicit handoff ends that
assignment. A worker ending or returning a handoff does not make its follow-up repairs standalone T0. Do not downgrade this scope to T0 because the fixes are small, known,
mechanical, urgent, or because a worker's edits failed. In particular, missing
match arms, dependency/type/API repairs, and changes needed to compile a delegated
feature go back to the appropriate implementation worker. Main-session inspection,
compiler/test runs, packet preparation, and synthesis remain allowed.

For a failed edit, inspect the actual current files and failed command/result. If
that worker is active, steer it with exact paths, diagnostics, intended change,
and acceptance check. If it has ended, dispatch one focused recovery task to the
same named role with the current candidate/worktree, existing modifications, and
failed-edit evidence; never assume it has the previous worker's context. Require
fresh reads before replacements and successful edit results before claiming a fix.
Do not repeat the same failed approach without new evidence. An incomplete worker
result means authorized work remains; it is not an automatic retry limit or user
approval gate. Narrow the next task to the exact unfinished behavior/file, supply
current evidence and a deterministic acceptance check, and continue with the same
named worker role. For example, fixing only one of two fixtures leaves the second
fixture to implement, even if today's tests pass; a documented midnight edge case
needs a bounded deterministic correction/check, not renewed user authorization.

If another correction fails with an unexplained cause, dispatch debugger to
reassess before another implementation attempt. Use a justified specialist or
review route only when its normal trigger applies. Reassessing/splitting the task
within existing authority does not require a new user approval. Report BLOCKED
only for a concrete missing requirement/authority, unavailable required capability,
or an evidenced impasse that cannot be resolved by the available authorized routes;
state what external input/change is needed. Attempt count alone is not a blocker.
Worker failure does not authorize orchestrator implementation, automatic model
upgrades, or restarting paused/canceled work.

Only an explicit user reassignment to the main session changes implementation
ownership. Generic "continue" or "fix it" preserves the existing assignment;
do not propose taking over worker-owned fixes as a default continuation.


## New failures and oversized assignments
A newly observed panic, failing test, or unexplained runtime error in delegated
work returns to DEBUG immediately. A debugger run for a different failure is not
evidence for the new one. After collecting the failing test name, command, output,
and candidate path, the next substantive action is an actual `subagent` call to
`debugger`; do not trace the test/production code, form a cause, or fix it in the
main session. Delegate the smallest reproduction, full panic/error output (not
only grep/tail summaries), affected paths, accepted behavior, and read-only scope.
A failing suite output still counts as failure when a shell pipeline exits zero.

A worker refusing an oversized assignment is a routing/packet problem, not a
handoff authorizing main-session implementation, diagnosis, or independent VERIFY.
Split it by one behavior or failing target, with one bounded acceptance check;
do not relaunch the unchanged oversized packet. Test implementation belongs to
the appropriate rust-worker/frontend-worker. Selected independent suite/baseline
verification belongs to test-engineer, identified by exact candidate and contract.
Main-session spot checks remain allowed, but do not substitute for these roles.

After debugger evidence, route a material unresolved persistence/schema/migration
choice to sqlite-specialist (or the actual domain specialist needed). Do not
summon a specialist solely because a test name mentions a database. Then send the
accepted correction to the implementation worker and any selected independent
verification to test-engineer. Preserve prior writes and candidate identity.

## Observable escalation triggers
Correct an incomplete task packet or missing evidence before changing models.
Do not retry an unchanged failed/blocked launch. Authentication, cooldown/429, and
tool-permission failures are availability blockers, not proof a model is too weak.
Report them; wait for recovery or use an explicitly supported, authorized profile.

Escalate coordination from Luna to Sol when authoritative evidence conflicts,
high-consequence decisions remain unresolved, or one clarified follow-up still
returns incomplete/contradictory reasoning. Preserve the evidence and name the
unresolved question. Do not use a reviewer to take over worker writes or skip the
debugger role. A disputed diagnosis may receive read-only review of its evidence.

After a fix fails with an unexplained cause, return to DEBUG immediately. After
two distinct evidence-backed correction attempts fail, stop repeating the route:
reassess diagnosis and use stronger review if material risk or disagreement remains.
This means change/reassess the route within existing authority, not automatically stop
work or request another approval. Incomplete partial edits are remaining scope, not
two failed evidence-backed corrections. Honor explicit user pause/stop requests;
questions about a blocker do not themselves revoke implementation authority.
Oracle remains restricted to the exceptional triggers above; no automatic Opus run.

Keep the role and model explicit. Use agent frontmatter or a supported profile;
never assume arbitrary per-call model IDs are supported or silently fall back to
Sonnet. Record route, actual model when reported, retries, tests, and blockers in
the normal concise handoff. Model names and prompt size do not prove billing savings.
