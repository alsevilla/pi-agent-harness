# Attendance domain guide

## Transition discipline
Model raw tap/event history separately from derived attendance classification where practical. A duplicate tap may be a transport duplicate, a physical reader bounce, or a legitimate later action; do not collapse those categories without evidence.

For each state transition define:
- required prior state;
- allowed time window or schedule dependency;
- duplicate behavior;
- out-of-order behavior;
- whether an operator may correct it;
- audit requirements;
- whether the transition creates a notification intent.

## Optional lunch
When lunch tracking is disabled, the state machine must not require LUNCH_OUT/LUNCH_IN to reach dismissal/finalization. When enabled, define what happens when one lunch event is missing or arrives late; do not silently synthesize events unless policy explicitly allows it.

## Late / half-day / absent
Keep the classification rule explicit and test schedule boundaries. Do not derive HALF_DAY or ABSENT from a single missing tap unless the accepted policy says so. Finalization should have a clearly defined trigger so late/offline events can be reconciled predictably.

## Corrections
Manual corrections should preserve who changed what and when. Decide whether corrections change only derived status, append compensating events, or mutate a canonical record; the policy must be explicit before implementation.

Do not infer school calendars, timezone/day boundary, grace periods, exceptions, notification recipients/timing, or approval authority from code names or sample data. Return each missing rule to main with a boundary example and identify which tests depend on it. Keep this business contract distinct from SQLite schema/transaction/migration design (`sqlite-specialist`), reader protocol and device I/O (`hardware-integration`), and parallel task/queue behavior (`concurrency-specialist`). Do not prescribe a storage schema or UI workflow.
