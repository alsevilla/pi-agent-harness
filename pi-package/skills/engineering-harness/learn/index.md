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

## Optional retrospective triggers
Main may consider a LEARN review when a durable lesson may exist, for example:
- the same correction was requested at least twice;
- the same worker or failure repeats;
- the user bypasses main to do the task manually (manual bypass or workaround).
A trigger only prompts main to review whether a stable, confirmed lesson exists. It is not automatic logging, session dumping, helper invocation or a universal gate, and it is not run after every task. Record only a durable root cause or confirmed lesson with explicit destination authority. Only the `release-engineer` LEARN role, under existing policy, writes; general workers do not run LEARN automatically. User choices and task requirements take precedence.

Load `references/extended.md` only for complex knowledge reconciliation.

Resolve relative references from this module folder. This procedure supplies guidance; the selected `release-engineer` role still must actually run.
