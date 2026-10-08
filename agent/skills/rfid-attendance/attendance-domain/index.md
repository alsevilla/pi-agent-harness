# attendance-domain

Use for unresolved school-attendance business semantics. The named role is `attendance-domain-specialist`; `rust-worker` remains the backend writer.

## Required analysis
Establish the smallest explicit state/rule contract needed for the task:
- attendance event vocabulary (for example ENTRY, LUNCH_OUT, LUNCH_IN, DISMISSAL);
- valid, invalid and duplicate transitions;
- school-day schedule source and timezone/day boundary;
- optional lunch behavior;
- grace periods and LATE classification;
- HALF_DAY policy and boundary cases;
- ABSENT/finalization timing and prerequisites;
- early dismissal / approved exceptions if supported;
- manual correction semantics and whether derived status is recomputed;
- interaction with notifications and audit history;
- restart/replay behavior at the domain level.

Do not infer policy from storage enums alone. If the school rule is missing, return the exact unresolved decision instead of inventing it.

## Output
Return:
1. confirmed rules/invariants;
2. allowed and forbidden transitions;
3. boundary examples;
4. persistence/notification consequences;
5. focused acceptance tests;
6. unresolved policy questions.

Read `guide.md` only when the task needs deeper transition/finalization examples.
