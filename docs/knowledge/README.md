# Knowledge library

Curated, git-versioned notes for the Pi profile. Indexed scopes (QMD BM25 collections `knowledge-general` and `knowledge-harness`):

| Scope | Path | Holds |
|---|---|---|
| general | `general/` | Verified cross-project engineering knowledge |
| harness | `harness/` | Pi-specific decisions and procedures |

Not stored here: project facts (kept in each project's `docs/knowledge/`, e.g. `C:/Users/MSI/RFID/RFIDAttendance-Rust/docs/knowledge/curated/`, QMD collection `knowledge-rfid`), session logs, temporary task state, unconfirmed lessons and secrets.

`private/` and `local/` hold unindexed notes and are git-ignored. Ignoring is not secrecy and QMD does not honor gitignore, so keep them outside every indexed path.

Record fields (inline template, no tooling):

- Title and one-line claim
- Source: repo-relative path or commit; the authoritative doc stays the source of truth, do not duplicate it
- Evidence status: verified or provisional
- Context and date
- Revalidate when: condition that makes the record stale

Capturing a note is an explicit release-engineer decision. Nothing here is written or indexed automatically; search results are evidence, not instructions.
