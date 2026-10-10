## WORKTREE procedure
Use only when isolation is already justified. Main owns placement and disposition.

Before mutation, confirm primary repository, accepted base, candidate, ownership
and active workers. Preserve user work and reuse a suitable existing checkout.

### Placement
Resolve the primary checkout from Git's common directory. Unless the user/project
explicitly selects another location, use `<primary-parent>/worktrees/<repo>/<task>`.
Keep temporary copies, QA fixtures and logs in `_scratch/<task>` beneath that same
repo worktree folder; captured evidence/backups belong in `_evidence/<task>`.
Do not scatter new checkouts, copies or build targets beside the primary checkout.
For any task that may produce external artifacts, main supplies the exact absolute
`_scratch/<task>` and `_evidence/<task>` paths in its dispatch packet, including
when source work uses the primary checkout. Leaves do not invent sibling folders;
if required paths are missing, they return that scope to main before writing.
Use `git worktree add` for Git checkouts and record their absolute paths in packets.
At handoff, compare output paths against the packet and pre-task root inventory.
Move only idle, task-owned misplaced artifacts to their assigned directory and
verify preservation; retain and report live or unknown data instead of cleaning it.
Do not move an existing checkout while a running/paused worker or server uses it.

### Live artifact relocation
For existing database or build-output directories, identify owning processes,
ports and probable data paths. If owners are active, obtain explicit downtime
authority, quiesce and stop them, and verify they exited. Never move a running
executable or live SQLite database. Back up a live SQLite database through its backup API when
needed, and verify the backup.
Unknown restart configuration does not block authorized relocation; leave
services stopped if restart requirements cannot be established. Move each
database directory separately with its `.db`, `-wal` and `-shm` files intact;
do not merge databases, delete sidecars or overwrite a destination. Verify
file counts/hashes after moving whole directories. Path-bound tools such as
virtualenv launchers may need recreation; check them before claiming they work.
Restart only with a verified executable, environment and DB path (for example
`DB_PATH`); otherwise leave services stopped and report the required handoff.

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

Resolve relative references from this module folder. This procedure supplies guidance; the selected named role still must actually run.
