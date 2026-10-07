## WORKTREE procedure
Use only when isolation is already justified. Main owns placement and disposition.

Before mutation, confirm primary repository, accepted base, candidate, ownership
and active workers. Preserve user work and reuse a suitable existing checkout.

### Placement
Resolve the primary checkout from Git's common directory. Unless the user/project
explicitly selects another location, use `<primary-parent>/worktrees/<repo>/<task>`.
For RFID this is `C:/Users/MSI/RFID/worktrees/RFIDAttendance-Rust/<task>`.
Keep temporary copies, QA fixtures and logs in `_scratch/<task>` beneath that same
repo worktree folder; captured evidence/backups belong in `_evidence/<task>`.
Do not scatter new checkouts, copies or build targets beside the primary checkout.
Use `git worktree add` for Git checkouts and record their absolute paths in packets.
Do not move an existing checkout while a running/paused worker or server uses it.

### Completion and cleanup
As part of an authorized merge/delivery, main checks disposition of every task-owned
temporary checkout. Normal safe cleanup does not require another user request:
- confirm the intended PR is merged (including squash/rebase), or prove candidate
  commits integrated into the intended target; committed-only is not merged;
- collect terminal worker results; no running/paused owner or server may need it;
- inspect tracked, untracked and ignored state; preserve unique evidence outside it;
- retain dirty/unmerged candidates, unique data and unknown/user-owned checkouts;
- for an idle, integrated, clean task-owned checkout, run `git worktree remove`
  with its exact absolute path; verify the folder and registration are gone.

Never force-remove a dirty implementation candidate, reset/clean it, or delete its
branch as routine cleanup. Report each checkout as REMOVED or RETAINED with a
concrete reason. Prune only missing registrations after checking a dry run.
This is a workflow step, not a watcher; abandoning a task also requires disposition.
Load `references/extended.md` only for recovery or multi-worktree complexity.
