# messaging-reliability

Use for unresolved SMS/notification delivery semantics. The named role is `messaging-specialist`.

## Core invariant
Attendance correctness must not depend on successful SMS delivery. Persist attendance/domain effects first according to the accepted transaction design; represent notification work as a separate durable intent/job when reliability requires it.

## Required analysis
Define:
- notification eligibility and template trigger;
- durable job identity / duplicate suppression;
- provider request idempotency if available;
- retryable versus permanent failures;
- backoff/rate-limit behavior;
- ambiguous provider timeout handling;
- SENT versus DELIVERED semantics;
- delivery callbacks/webhooks and their idempotency;
- dead-letter/operator recovery behavior;
- provider outage/backlog behavior;
- phone normalization/validation responsibility;
- logging/redaction requirements.

Return state transitions and tests for retry, duplicate callback, provider outage, restart and backlog recovery. Read `guide.md` for deeper lifecycle examples.
