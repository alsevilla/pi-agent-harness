## LEARN procedure
This procedure belongs to the `release-engineer` role when LEARN is selected by main.

Run only when durable knowledge is worth preserving.

Capture only stable, reusable truth:
- accepted architectural/project/release decision;
- confirmed domain or operational invariant;
- recurring debugging/testing/production lesson;
- durable navigation/recovery/operational knowledge.

Do not summarize the session or store temporary state. Reconcile existing authoritative knowledge when needed, and use the narrowest authoritative destination.

Writing durable knowledge requires explicit destination/mutation authority. `release-engineer` may make precise edits only to the authorized knowledge/release-owned artifact; it must not use LEARN to change product implementation or tests.

Load `references/extended.md` only for complex knowledge reconciliation.

Resolve relative references from this module folder. This procedure supplies guidance; the selected `release-engineer` role still must actually run.
