# @alsevilla/pi-engineering-harness

Pi package with an explicit subagent extension, generic role defaults and the `engineering-harness` and `agent-creation` skills.

## Install

```bash
pi install npm:@alsevilla/pi-engineering-harness
```

Install by package name or from a local package directory. A tarball path as an npm spec is not supported.

Renaming the package (its `package.json` `name`) turns off both the packaged default roles and the collision protection; the renamed bundle is accepted but inert. This is an identity check, not an OS sandbox, and there is no host patch.

In package mode a missing `package.json` beside `defaults/`, an unreadable manifest, or a damaged `defaults/` fails closed with an error before any provider call. Damaged means: an unreadable or non-list `roles.json`, an invalid or duplicate role entry, or role names that do not exactly match the parsed `defaults/agents` definitions (including an empty or garbled definition). A user `roles.json` entry is an object with a non-empty `name` and only the keys `name`, `provider`, `model`, `fallbackModel`, `thinking` and `tools` (`tools` is a string or a list of strings); duplicate names are rejected. Valid partial overrides keep every other default field. The live profile (no manifest and no `defaults/`) is unchanged.

Not detected: an edited role body, deletion of both `package.json` and `defaults/` (that layout is the live profile), and deletion of `defaults/baseline.json`. The package has no hash or integrity check; this is a known gap, not a runtime guarantee.

> **Do not run the live copy and this package together.** If the same subagent extension also lives under `<PI_CODING_AGENT_DIR>/extensions/subagent`, Pi reports conflicts for the `subagent` and `subagent_control` tools and registers the provider cooldown twice. Choose one: remove or disable the live copy before installing the package.

Tested on Pi 1.1.0 with Node 24.20.0 (targeted local checks only; Node 22 is unverified and interactive TTY behaviour was not probed). Public `pi-ai/compat` imports were verified on Pi 1.1.0 only; no minimum earlier Pi version is claimed. Requires Pi with the host packages `@earendil-works/pi-agent-core`, `pi-ai`, `pi-coding-agent`, `pi-tui` and `typebox` (declared as peers, not bundled). `agent-creation` needs Python 3. Anthropic roles require `npm:pi-claude-subscription-connector`; launches fail closed without it.

## What is included

- `extensions/subagent`: subagent extension with every code-navigation integration disabled (`integrations.json` lists no roles).
- `defaults/agents` and `defaults/roles.json`: 18 generic roles pinned to the baseline commit recorded in `defaults/baseline.json`. Their bodies are byte-identical to that baseline.
- `skills/engineering-harness` and `skills/agent-creation`.
- `defaults/AGENTS.policy-template.md`: optional policy you copy yourself.
- `extensions/ask-user`: the `ask_user` tool (`index.ts` and `core.ts`, MIT, no dependencies). Subagent leaves never receive it.

> **Do not run two `ask_user` copies.** If your live profile also loads `extensions/ask-user`, Pi records a tool-name conflict and keeps the first copy loaded. Manually disable one copy, or opt the package copy out with `"!extensions/ask-user/index.ts"` in your package filter.

Not included: backend, frontend, RFID, graphify and browser catalogs, the excluded domain roles, and any personal settings, credentials or sessions.

Code navigation is optional. Serena (`npm:@bacnh85/pi-serena`), Graphify (`npm:graphify-pi`) and QMD are separate installs with their own configuration, and this package installs none of them. `extensions/subagent/integrations.json` lists no roles, so the packaged roles need none of these and nothing is launched through them. The live profile's 23 roles do list integrations; a launch with a missing integration fails closed, and no configuration overrides that. Setup steps are in the profile repository's README under "Code navigation setup (optional)".

## Overrides

Default roles are discovered at the lowest tier. A file named `<PI_CODING_AGENT_DIR>/agents/<name>.md` or an entry in `<PI_CODING_AGENT_DIR>/roles.json` with the same name overrides that default. Set `PI_CODING_AGENT_DIR` to isolate the profile.

`/subagent roles` lists these defaults with their effective settings. Saving writes only a `roles.json` override entry; the packaged definition is never copied or changed.

The explicit `extensions/subagent` entry registers Anthropic and OpenAI Codex providers that replace their `streamSimple` handler with a cooldown guard around the original stream, for the entire Pi host session (not only subagent children). The guard observes HTTP calls only: the Codex WebSocket transport is not covered.

Policy versus runtime: the routing, evidence, authority and reporting rules are instructions the model is asked to follow, not runtime guarantees. Runtime-enforced items are the provider guard, package discovery fail-closed, `ask_user` no-UI, cancel and timeout (never approval), the DAG bounds (8 nodes, at most 4 running) and the `/subagent create` CREATE gate. A runtime "Package resources" note marks unbundled skills as unavailable; the model is asked to obey it, which is not a runtime guarantee.

## Build

The publish tree is generated from the repository by `node scripts/build-pi-package.mjs`. Do not edit generated paths by hand.
