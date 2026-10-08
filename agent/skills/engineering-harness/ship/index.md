## SHIP procedure
This procedure belongs to the `release-engineer` role when SHIP is selected by main.

Use only when the user/task requires delivery, release, merge/push/tag/package/publish/deploy readiness or another explicit shipping operation.

Require a task packet with:
- exact candidate and version;
- destination/release target;
- required fresh-enough verification/review evidence;
- migrations/config/artifacts that must be accounted for;
- rollback/recovery prerequisites;
- exact operation authority.

Confirm:
- candidate/version identity;
- required tests/review are fresh enough;
- migrations/config/artifacts are accounted for;
- release target/platform is correct;
- rollback/recovery is viable for the approved scope;
- destination and authority are explicit.

Before an authorized commit or PR, read `../references/git-attribution.md`. Readiness supplies no operation authority.

After confirmed merge/delivery, return the delivery result and candidate/worktree state to main. **Main owns worktree disposition/cleanup** under `../worktree/index.md`; the release engineer does not delete task checkouts merely because SHIP completed.

Do not repair product source in SHIP. Return implementation defects to main for the appropriate writer. Do not run SHIP for ordinary coding completion.
Load `references/extended.md` for release-critical workflows.

Resolve relative references from this module folder. This procedure supplies guidance; the selected `release-engineer` role still must actually run.
