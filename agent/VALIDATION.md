# Profile validation — October 7, 2026

Historical snapshot of the lean-instructions migration, before the later worker tool restriction. Its Serena edit-permission result is superseded by the current `agents/` frontmatters, `extensions/subagent/integrations.json`, and `extensions/subagent/tests/code-integrations.test.ts`. All checks below passed at the time. Tests used the installed source, with mock workers where indicated; no model inference was used in that pass.

| Area | Evidence |
|---|---|
| Discovery and roles | No skill diagnostics or extension load errors; five profile skills; all 18 roles, registry/frontmatter model/effort/tools, and 20 role reference paths checked. |
| Code-role integrations | All 17 code-role launch argument lists; isolated native Ponytail prompt injection; Serena edit permissions preserved; no nested subagent or ask_user tools in leaves. |
| Background dispatch | Mock-process launch returns promptly; startup and running-worker steering acknowledged; rejection and late steering reported; parallel/chain operation, completion delivery, cancel, foreground compatibility, concurrency bounds and session reset checked. |
| Enforced pause | A current tool finishes, the next boundary holds; paused chains do not spawn the next worker; replacement dispatch rejected; resume retains the worker/context. |
| Inspector | Native turn rendering, click/Ctrl+O expansion, following/reading position, errors, compact active rows, completed rows hidden, narrow widths and disposal. Actual Pi TUI outside-click dismissal and hidden launch receipts checked. |
| Graph reference resolution | Candidate graph preferred; primary checkout resolved through Git metadata; missing paths skipped. Global exact coverage checks handle absent, malformed and oversized manifests without parsing the full global graph. |
| Graph query helper | Four regression tests: read-only file preservation, directed paths, missing matches/output bounds and invalid input. |
| Models and fallback | Two regression tests: native GPT-6.1 ID retained and provider fallback cannot replay tool activity, cancellation or task failures. |
| QMD backend | Actual BM25 search and bounded document retrieval in primary and worktree return identical shared-index references. |
| Serena backend | Actual candidate activation/status and symbol overview succeeded using LSP; candidate source was not edited. |
| User questions | Originally checked the external package; superseded by the local native-dialog extension validation below. |
| Git environment | Four identity values correctly inherited by child processes; attribution remains in its selectively loaded reference. |
| Browser and connector | Existing Betterwright launcher reports 2.8.7. Installed subscription guard matches the committed patch after normalizing line endings. |
| Documentation | No broken checked local Markdown links; reference paths resolve; diff whitespace checks pass. Removed an orphaned attribution marker and unrelated text from the Git attribution guide. |

## Practical limits

- QMD reports its skills collection was last updated 25 days ago. Search can return old instruction text. Read the current skill file directly for governing guidance; refreshing the index was outside this read-only validation pass.
- Worker orchestration tests use mock model responses. This pass establishes runtime/control behavior, not how every model follows instructions. TDD order remains a prompt requirement rather than a runtime-enforced gate.
- Browser verification checks the installed CLI and discovery, not live website interaction. Native TUI tests use a controlled terminal fixture; terminal-emulator-specific mouse behavior remains environment dependent.
- No fresh subscription requests were made here, so current provider limits and billing are not established. A separate earlier small GPT-6.1 Codex request succeeded on this date.
- Validation targets Pi 1.0.4 and the installed integration versions; rerun after upgrades. Smaller text is measured, but billed token savings are not.

## Manual refresh and Windows browser verification

Six refresh-command tests passed: parsing, hook rejection, concurrency, bounded hidden process failures/timeouts, graph target/no initialization/junction escape, and Serena forwarding. Native Pi SDK/RPC dispatch reached the existing restart fixture once with zero model calls. No project graph or QMD index was refreshed by these tests.

Betterwright 2.8.7 source-launcher checks passed for CMD, PowerShell and Git Bash, invalid-command exit status, preserved spawn options and piped stdin. Isolated local screenshots were created and visually inspected under ~/.betterwright/artifacts. The CLI exited 0 and an observed browser worker had no visible window handle. Daemon hiding was verified through captured spawn options rather than a separately observed daemon window. Existing user sessions were preserved. Direct compiled-executable calls bypass the source patch; package updates can overwrite it.

## Local native user questions

The external pi-ask-user package and its live/shareable registration were removed. Full Pi profile discovery loads exactly one local ask_user tool with zero extension errors or skill diagnostics; the installed subscription connector guard is byte-for-byte unchanged. Nine tests passed for choices/freeform/comments, explicit multi-selection, malformed/blank answers, headless mode, partial batch cancellation, timeout/concurrency recovery, abort propagation and listener cleanup. Isolated SDK execution verified sequential registration, a native-dialog mock answer and truthful headless cancellation, with zero model calls or real human prompts. Worker isolation/Ponytail checks still pass for all 17 code roles.

The extension uses Pi's native select/input dialogs. Cancellation and incomplete batches return response:null; prior completed answers remain available without granting approval. Actual interactive terminal appearance has not been manually verified in this pass. Reload or restart Pi to replace registrations already loaded by an existing session.
