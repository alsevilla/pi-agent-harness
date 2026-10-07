# Subscription guard correction

`subscription-guard.ts` is the locally corrected guard from `pi-claude-subscription-connector` 1.0.1 (MIT). It remaps native inline tool additions/removals and drops unknown or duplicate removals, including stale `qmd_adaptive_search` references. It does not restore the removed adaptive-search tool or rewrite saved sessions.

After installing the connector, back up its existing `extensions/subscription-guard.ts` and replace that file with this copy under `~/.pi/agent/npm/node_modules/pi-claude-subscription-connector/`. Restart Pi. The main connector and isolated Claude workers then load the same corrected guard; do not register this copy as an additional extension.

Package updates may overwrite this local correction. Compare with the new upstream version before reapplying; this copy was validated with Pi 1.0.4 and connector 1.0.1. The connector's other files and dependencies are installed normally and are not vendored here.
