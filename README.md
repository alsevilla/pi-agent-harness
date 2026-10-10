# Pi agent harness

#ai #coding #ai-agents #pi #developer-tools #agent-orchestration

An independent, unofficial harness profile for [Pi](https://github.com/earendil-works/pi), the minimal extensible coding agent by Mario Zechner. It is not an official Pi project and is not endorsed by its authors.

The profile lives in [agent/](agent/README.md) and provides:

- 23 named agent roles with explicit models, thinking levels and delegation boundaries (`agent/agents/`, `agent/roles.json`). The npm package ships 18 generic defaults.
- Engineering, frontend, backend and RFID-attendance skills, loaded selectively.
- A subagent extension ([details](agent/extensions/subagent/README.md)): DAG launches of up to 8 nodes (at most 4 running at once); a process-local workspace admission queue; background jobs with steering, pause, resume and cancel, plus a live inspector; compact handoff reports; and a provider cooldown shared across the whole Pi host session (not only subagent children) for Anthropic and OpenAI Codex HTTP calls.
- `/subagent roles`, which edits one role's primary model, fallbacks and thinking level through native dialogs.
- Optional read-only Serena, Graphify and QMD integrations for code workers ([setup](#code-navigation-setup-optional)). Core orchestration works without them only in the installed npm package. In the live profile, the 23 configured roles list required integrations, and a missing integration blocks those role launches.

## Why this harness

The following engineering rules are model-followed policy; only the explicitly described runtime controls are enforced by code. Workers are not an OS sandbox.

- **One orchestrator, cheapest sufficient route.** Policy: main classifies each task T0–T4 and takes the smallest route that fits: a direct edit for mechanical work, one worker with focused checks for known localized behavior, a debugger before any unknown-cause fix, and independent verification or review only when the risk warrants it.
- **Selective guidance.** Routers and modules load only the sections a task needs, so the orchestrator context stays focused.
- **Named role ownership.** Each role has an explicit model, thinking level and boundary. One writer owns each candidate checkout. Background and DAG launches are bounded (up to 8 nodes, at most 4 running) and share workspace admission within one Pi process.
- **Evidence before claims.** Meaningful behavior gets a focused RED check before the production change and GREEN after it. Policy: a failed required gate blocks delivery.
- **Human control, fail closed.** Material missing decisions go to you through `ask_user`; cancellation, timeout or missing UI never counts as approval. Policy asks that nothing publishes, commits, pushes, reloads or deletes without explicit approval; no OS sandbox enforces this.
- **Bounded handoffs, lossless recovery.** Workers return compact reports, and the full retained child report stays available through `subagent_control` `result`. No measured token savings are claimed.
- **Native Pi controls.** `ask_user`; the `/subagent roles` editor, which saves only a user override; and `/subagent create`, an operator-only preview that writes project-local agents only after you choose CREATE.

Status: targeted offline checks only, on Node 24.20.0 with Pi 1.1.0. Node 22 and live TTY or new interactive `/subagent create` runs were not available here, so no blanket verification is claimed. The npm package `@alsevilla/pi-engineering-harness` is **UNPUBLISHED** until explicit approval.

### Practices we draw on

These practices are reflected in this profile. The projects below are not bundled, and this does not imply their endorsement, command compatibility or parity.

| Project | Practice reflected here |
| --- | --- |
| GSD | Scope definition and checkpoints before implementation |
| Superpowers | Systematic debugging, TDD and verification before completion |
| Compound Engineering | Plan, work and review phases, with an optional learn step |
| gstack | Risk-based specialists, QA and release gating |
| ECC (Everything Claude Code) | Specialized roles, modular guidance and reusable tooling; full ECC coverage has not been audited |

## Status and limits

- Installation docs ([agent/README.md](agent/README.md)) still reference Pi 1.0.4. Targeted local checks ran on Node 24.20.0 with Pi 1.1.0 (subagent package defaults, roles editor and agent-creation collision guard). Public `pi-ai/compat` imports were verified on Pi 1.1.0 only; no minimum historical Pi version is claimed. Node 22 is unverified and interactive TTY behaviour was not probed. These are not a blanket compatibility claim.
- Roles use Anthropic (Claude) and OpenAI Codex (GPT) models. You need your own sign-in or API key; no credentials are included.
- Role discovery covers the profile's user roles in `agent/agents/`. Project roles in `.pi/agents/` use their own frontmatter.
- Changes to subagent extension files take effect only after a Pi reload or restart at a safe point, once active workers finish.
- `/subagent create` is an operator-only native command in interactive sessions. It previews the files and writes a project-local agent only after you choose CREATE. A created agent is not active until used with `agentScope` `project` or `both`; creation is not trust, reload or launch.
- Admission, DAG state and background capacity are per Pi process. They do not coordinate separate processes or machines. The cooldown does not cover Codex WebSocket transport.
- Workers are not an OS sandbox. Role permissions and `readOnly` declarations are policy, not isolation.
- Policy versus runtime: the routing, evidence, authority and reporting rules (T0–T4, TDD, handoff format, approval) are instructions the model is asked to follow, not runtime guarantees. The runtime enforces only: the provider guard, package discovery fail-closed, `ask_user` no-UI, cancel and timeout (never treated as approval), the DAG bounds (8 nodes, at most 4 running), and the `/subagent create` CREATE gate.
- Models and providers depend on your account and catalog.
- The repository starts from a fresh source snapshot without the previous repository's history. The older root-level GSD/skills/extensions stack is retired; do not reinstall it alongside the current profile.

## Install

Follow [agent/README.md](agent/README.md). It covers backing up your existing `~/.pi/agent`, installing the listed npm packages and creating local configuration from examples. It is not a full installer.

To update a clean local checkout (fast-forward only, on `master`):

```bash
git -C ~/.pi pull --ff-only
```

## Code navigation setup (optional)

In the installed npm package, core orchestration works without any of the three integrations below: routing, named roles, DAG and background subagents, handoffs, `/subagent roles`, `ask_user` and agent creation. In the live profile, the 23 configured roles list these integrations as required, and a missing listed integration blocks that role's launch (see Current behavior below).

The full code-navigation experience needs three separately installed components. Each needs its own CLI, extension or index, and configuration. This package and profile bundle or auto-install none of them.

- **Serena** (symbol and reference navigation): `pi install npm:@bacnh85/pi-serena`, plus its own Python/backend requirements. Bridge health and project activation are not verified by configuration checks.
- **Graphify** (architecture graph references): `pi install npm:graphify-pi` and an existing Graphify Python interpreter. Reads an existing `graphify-out/graph.json`; no graph is built here, and you maintain it (`/refresh graph` updates an existing one).
- **QMD** (BM25 search over indexed local notes): install the QMD CLI, copy `agent/extensions/qmd/config.example.json` to `config.json`, set the Node and CLI paths and the existing index name, and create your own collections. No index is shipped or rebuilt by retrieval.

The code workers also load Ponytail (`npm:@dietrichgebert/ponytail`). Setup steps are in the [agent install section](agent/README.md#install), with details in the [refresh](agent/extensions/refresh/README.md), [QMD](agent/extensions/qmd/README.md) and [engineering environment](agent/extensions/engineering-environment/README.md) READMEs.

Current behavior: code roles are listed in `agent/extensions/subagent/integrations.json`. If one listed integration is missing, that role's launch fails with a `Code integration missing` error that names the packages to install. The launcher does not yet run such a role without the missing integration. No configuration overrides this fail-closed behaviour. Packaged installs list no code roles and need none of these components.

## Privacy and local files

Authentication (`auth.json`), sessions, installed packages, caches, search indexes, generated graphs and machine-local settings are ignored by Git. Commit configuration examples only. Do not put credentials, tokens or machine-specific paths in shared files.

## Contributing

Create a feature branch and open a pull request against `master`. Do not push directly to `master`. Community expectations are in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Licenses and notices

- Original work in this repository: [MIT](LICENSE), Copyright (c) 2026 Pi agent harness contributors.
- Pi (earendil-works/pi, MIT, Copyright (c) 2025 Mario Zechner) and bundled third-party files keep their own notices. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Runtime dependencies are installed separately and are not bundled here.
