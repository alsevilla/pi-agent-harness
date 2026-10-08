# Modular Pi agent profile

This directory is a shareable snapshot of the current `~/.pi/agent` profile for Pi 1.0.4. It uses direct Claude subscription and ChatGPT/Codex sign-in. CLIProxyAPI is not required.

This repository starts from a fresh source snapshot. The retired root-level stack is not in its history; use the active agent/ profile.

## Included

- 23 named agent roles with explicit models, thinking levels and delegation boundaries, including four read-only RFID attendance-domain specialists and a scoped release engineer.
- Four modular skill routers: engineering-harness, frontend, backend and RFID attendance. Each loads only the relevant module guidance.
  Main loads the harness once per session, reuses available guidance across tasks and reads only missing relevant sections. Queue-only requests record work for later without starting domain reads or workers; changed or lost guidance is reread when needed.
- Background subagents with steering, enforced pause/resume/cancel, a compact active-worker panel and a bordered live inspector. Completed workers remain inspectable in history.
- Read-only Serena navigation in code workers, precise `edit` for implementation workers, existing Graphify artifact references across worktrees, and bounded QMD BM25 retrieval from an explicitly named shared index.
- Git identity environment extension, prompt shortcuts and the Claude subscription guard correction for obsolete inline tool references.

## Install

Back up your current `~/.pi/agent` first. Copy this directory's `AGENTS.md`, `roles.json`, `agents/`, `extensions/`, `prompts/` and `skills/` into that profile. Preserve existing authentication and unrelated local configuration. Remove conflicting old skill/extension copies deliberately rather than merging two stacks blindly.

For a fresh profile, copy `settings.example.json` to `settings.json`. For an existing profile, merge the example's package and extension settings into your current settings. Install the listed packages through Pi. The code workers expect these packages under `~/.pi/agent/npm/node_modules`:

```text
pi install npm:pi-claude-subscription-connector
pi install npm:pi-mcp-adapter
pi install npm:@bacnh85/pi-serena
pi install npm:graphify-pi
pi install npm:@dietrichgebert/ponytail
```

Copy each extension's `config.example.json` to `config.json`. Set your own Git identity in engineering-environment. In qmd, set the absolute Node executable and installed QMD CLI paths for your machine, plus the existing shared index name (default `index`). The example Windows paths must be changed on other machines. Install QMD separately and configure collections before using its retrieval tools; this profile does not ship a search database or rebuild indexes during retrieval.

Apply the optional connector correction as described in [patches/claude-subscription-connector](patches/claude-subscription-connector/README.md). Restart Pi, sign in with `/login anthropic` using the connector's offered OAuth flow and `/login openai-codex`. Model availability depends on your provider/catalog; inspect agent frontmatter and `roles.json` before using the profile. Configured availability fallbacks require a separate GitHub Copilot sign-in.

Run Pi from your project. `/subagent` opens worker history/live activity; its command controls and the orchestrator's `subagent_control` tool support steering and pause/resume. See [subagent documentation](extensions/subagent/README.md) for details. The inspector's outside-click compatibility path depends on Pi 1.0.4 TUI internals and should be rechecked after a Pi upgrade.

## Privacy and verification

Authentication, sessions, installed npm packages, caches, search indexes, generated graphs, binaries and local configuration are excluded. This source snapshot does not include an automatic installer or launcher.

Before publication, the profile's dispatch, worker controls and inspector were checked with local mock/native-TUI tests; QMD retrieval and Serena candidate navigation were checked against local backends. Those checks do not establish subscription billing, token savings, live model reliability or compatibility with later Pi versions. Existing graphs and indexed notes remain reference material; candidate source reads, edits and tests target the assigned checkout.

Pi example-derived code is covered by `PI-LICENSE`. The connector correction retains its MIT license. Skill-specific licenses remain with their modules.

## Interactive user questions
The main profile loads its own [ask-user extension](extensions/ask-user/README.md). The `ask_user` tool uses Pi's native selection and text-input dialogs for choices, typed answers and sequential batches. No `pi-ask-user` npm package, custom overlay or extra decision-gating skill is required. Restart/reload Pi after updating. Background leaves return missing decisions to the orchestrator rather than opening prompts.

Questions remain for material missing requirements/preferences/authority. Reuse existing authorization. Cancellation, timeout, blank answers and unavailable UI are unanswered states, never approval. The extension preserves the essential question/options/context/batch fields; old package-specific rendering and toggle settings are not used.

## Canonical browser and graph skills
The profile registers one browser skill at skills/browser/SKILL.md. The skills filter excludes the duplicate inherited ~/.agents browser guide from this Pi profile without changing that shared file. graphify-pi remains an always-loaded native extension, with its package skill disabled; both main and code workers load skills/graphify/SKILL.md. Ordinary graph queries use the bounded, standard-library read_graph.py helper and write no query stamps, vocabulary sidecars or feedback records. Build/update procedures require an actual authorized artifact-write assignment. Unused upstream Graphify pipeline references and its obsolete version marker were removed; read-only query and explicit build procedures remain.

## Selective instruction loading
AGENTS.md retains routing, authority, recovery ownership, pause controls, evidence and runtime boundaries. Detailed role-selection criteria, recovery, worker controls, integration behavior and Git attribution live under skills/engineering-harness/references/ and load only when relevant. The harness entry selects a phase; it does not preload those references. Scout, DevOps and UI/UX retain short role contracts with optional topic references. Role models and named routing are preserved; implementation worker tool lists now omit `write` and Serena mutations.

Workers report RED and GREEN commands/results for meaningful behavior, or an explained exception with replacement evidence. Review checks that evidence without duplicating worker implementation. These are prompt requirements; the runtime does not enforce test-first order. Independent verification stays conditional.

Only six profile skills are registered: engineering-harness, frontend, backend, RFID attendance, browser and graphify. Frontend/backend modules remain references, with SolidJS guards around cross-framework examples. The inherited duplicate browser and graphify-pi package skill remain disabled; native extensions remain enabled. Human questions use the local native-dialog extension, with no external ask-user package or extra skill. Do not delete useful framework-independent design modules merely because some examples use another framework.

Compatibility was checked against the installed Pi 1.0.4 resource loader, all 23 role definitions, registry/frontmatter agreement, referenced module paths and explicit worker integrations. Smaller instruction text does not prove a measured reduction in billed tokens.

See [VALIDATION.md](VALIDATION.md) for the October 7, 2026 regression pass, including live Serena/QMD checks and the distinction between mock-worker verification and provider reliability.

## Manual data refresh

The main session provides `/refresh graph`, `/refresh qmd` and `/refresh serena` as direct extension commands. They run maintenance without an orchestrator model request and do not add another skill or agent. See [refresh documentation](extensions/refresh/README.md) for targets, configuration and verification.

- Graph: update existing code artifacts for the current repository or an explicit absolute target. A primary/global graph is never chosen automatically as a write destination.
- QMD: refresh existing collections in the configured shared index without embeddings, git pulls or configured update hooks.
- Serena: hand the request to the installed native restart command; its status/errors remain visible in Pi. Existing background workers have separate Serena bridges.

These commands refresh data or runtime state, not npm/Python packages. Use them after a meaningful batch of changes rather than after every edit.

## Betterwright artifacts and Windows launchers

Screenshots continue to save under `~/.betterwright/artifacts/<session-id-hash>/`. A local test screenshot was created and inspected on October 7, 2026. For an isolated one-shot task, use `run ... --no-daemon --close`; for multi-step browsing, keep the named session and close it when finished.

The local Windows launcher correction hides background daemon/worker consoles and routes the existing shims through installed source. See [the patch instructions](patches/betterwright-windows/README.md). Package updates can overwrite local corrections. Direct calls to a separately compiled Betterwright executable can bypass the source-launcher patch.

## Worktree placement and disposition

New task checkouts use `<primary-parent>/worktrees/<repo>/<task>` unless the user/project explicitly chooses another location. Task scratch copies, fixtures and logs go in `_scratch/<task>` under that repo folder; durable evidence/backups go in `_evidence/<task>`. For artifact-producing assignments, main supplies exact absolute scratch/evidence directories in the task packet, and code leaves return missing paths instead of choosing sibling folders. Main performs disposition after confirmed merge/delivery: remove idle, integrated, clean task-owned checkouts and report why others remain. Dirty, unmerged, paused/active and user-owned environments are retained; no watcher deletes them automatically. Moving live SQLite or build-output directories requires authorized downtime, stopped owners and intact sidecars. Unknown restart configuration does not block authorized relocation; leave services stopped until executable, environment and DB path are verified. See [worktree procedure](skills/engineering-harness/worktree/index.md).

Implementation workers use precise `edit` with read-only Serena navigation; bulk `write` and Serena mutation tools are excluded. Restart Pi and cancel/relaunch old workers after updating this configuration.