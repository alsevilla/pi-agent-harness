## SHIP procedure
Use only when the user/task requires delivery/release/merge/push/package readiness.

Confirm:
- exact candidate/version;
- required tests/review are fresh enough;
- migrations/config/artifacts are accounted for;
- destination/authority is explicit.

Before an authorized commit or PR, read ../references/git-attribution.md. Readiness supplies no operation authority.

After confirmed merge/delivery, apply ../worktree/index.md to task-owned checkouts; remove eligible temporary checkouts and report concrete retention reasons. A paused owner or dirty candidate blocks removal.

Do not run SHIP for ordinary coding completion.
Load `references/extended.md` for release-critical workflows.

Resolve relative references from this module folder. This procedure supplies guidance; the selected named role still must actually run.
