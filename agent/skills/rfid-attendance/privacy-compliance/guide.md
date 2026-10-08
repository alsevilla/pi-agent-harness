# Privacy and data-governance guide

Prefer collecting and retaining only data necessary for the accepted school workflow. Avoid logging full phone numbers, RFID values or sensitive attendance details when stable internal identifiers or redacted values are enough for diagnosis.

Exports and backups are copies of sensitive data too. Retention/deletion policy should account for them explicitly rather than deleting only the live row.

Audit data can itself be sensitive. Preserve accountability without turning logs into a second unrestricted attendance database.

When a requested feature creates a new disclosure path (CSV export, parent message, dashboard, webhook, support bundle), identify who receives what data and why before implementation. Do not assume an applicable law, school policy, consent basis, guardian authority, retention period, deletion exception or breach-reporting deadline. If absent or conflicting, return the exact policy decision to main and identify affected data flows; do not assert legal compliance.

Distinguish privacy analysis from security-specialist ownership of access control, authentication, secrets and threat mitigation; SQLite-specialist ownership of persistence constraints/migrations; and DevOps ownership of backup/deployment operations. Account for copies in logs, exports, backups and provider payloads without prescribing a storage schema or compliance program.
