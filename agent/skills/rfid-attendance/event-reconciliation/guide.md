# Event reconciliation guide

## Identity
A retry should carry the same logical event identity. Do not generate a fresh ID for every transport attempt if the backend must recognize replay. Card/student identity is not necessarily event identity: separate repeated delivery from a genuinely repeated physical tap using project evidence and policy. Do not propose a schema as a requirement; identify the needed identity guarantees and let the implementation owner map them to existing contracts.

Useful concepts may include reader_id, event_id, reader sequence, card/student reference, occurred_at and received_at. The exact schema belongs to the project; these fields are not automatically required.

## Ambiguous acknowledgement
Design for the case where the backend commits but the reader times out before receiving acknowledgement. A retry must not create a second business effect or duplicate SMS merely because the network response was lost. State what an acknowledgement confirms (durable receipt, accepted-for-processing, or completed effect); do not conflate these. If no project contract establishes it, return that exact decision to main. Do not require a specific transport, database, or acknowledgement format.

## Ordering
Do not assume network arrival order equals physical occurrence order. Define how conflicts are handled when two readers scan the same student or when an offline reader replays older events after newer server events.

## Restart and replay
Reader restart, server restart and process cancellation must not silently lose accepted work. Define what is durable before acknowledgement and how partially processed events resume or become observable failures. Separate event-domain replay semantics from SQLite transaction/migration design (sqlite-specialist), Tokio task/queue ownership (concurrency-specialist), and device/protocol behavior (hardware-integration); route those distinct unresolved questions rather than prescribing infrastructure.
