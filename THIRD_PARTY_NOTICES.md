# Third-party notices

This file lists third-party material found in this repository, plus runtime dependencies that are not bundled. It is a non-exhaustive notice list, not a legal audit. Each listed item keeps its own license. Nothing here is relicensed under this repository's MIT license (see [LICENSE](LICENSE)).

## Pi (earendil-works/pi): MIT

- Upstream: https://github.com/earendil-works/pi (default branch `main`; package directory `packages/coding-agent`). The `badlogic/pi-mono` URL redirects to this repository.
- npm package `@earendil-works/pi-coding-agent` 1.1.0: author Mario Zechner, license MIT (checked in the installed `package.json`).
- Copyright (c) 2025 Mario Zechner. The upstream `LICENSE` was read through the public GitHub API; the retained copy at `agent/PI-LICENSE` matches its text.
- Scope: Pi-derived example code in this profile is covered by `agent/PI-LICENSE`. Pi itself is installed through npm and is not vendored here. This repository is an independent profile for Pi, not an official Pi project.

## BetterWright Windows patch: MIT

- Path: `agent/patches/betterwright-windows/` (retained `LICENSE`, patch README, example launchers, `spawn-options.patch`).
- Copyright (c) 2026 The BetterWright Project and contributors. Full text: `agent/patches/betterwright-windows/LICENSE`.
- Upstream origin and the extent of any copied code were not audited beyond the retained license.

## Claude subscription connector patch: MIT

- Path: `agent/patches/claude-subscription-connector/`.
- `LICENSE`: MIT. Copyright (c) 2026 Akshay Patel; line 29 retains the Copyright (c) 2026 Ben Vargas notice for the vendored code.
- `subscription-guard.ts` is vendored from `@benvargas/pi-claude-code-use` v2.0.0 (https://github.com/ben-vargas/pi-packages, `packages/pi-claude-code-use`), Copyright (c) 2026 Ben Vargas, MIT.
- The connector package itself is installed separately and is not vendored beyond the correction described in its patch README.

## frontend-design skill: Apache License 2.0

- Path: `agent/skills/frontend/frontend-design/` (`LICENSE.txt`, `guide.md`, `index.md`).
- Full Apache-2.0 text is retained in `LICENSE.txt`. Its content matches `skills/frontend-design/LICENSE.txt` in https://github.com/anthropics/skills (read through the public GitHub API). That repository's top-level license field is empty; the per-skill file governs.
- No NOTICE file was found in this skill folder. Apache-2.0 modification and notice obligations were not otherwise audited.

## design-dashboards skill: MIT (original content)

- Path: `agent/skills/frontend/design-dashboards/NOTICE.md`.
- Original design-dashboards content: MIT, Copyright (c) 2026 Stoyan Stoitsev. Full text is in `NOTICE.md`.
- Named inspirations (Stephen Few, Matt Pocock) are credited there. The notice states that they do not endorse this project.

## ui-ux-pro-max skill: MIT (upstream: nextlevelbuilder/ui-ux-pro-max-skill)

- Path: `agent/skills/frontend/ui-ux-pro-max/`.
- Origin: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill at commit `50d8a7de0900119855614541f15a1a616691eb33` (tree `d3c8643943f33f302b5c2bbbebdefebef4d586e9`, read through the public GitHub API). Its `LICENSE` is MIT, `Copyright (c) 2024 Next Level Builder` (blob `1e71cbf26660f31903807d099fe902c098fc7e4c`).
- 66 of the 74 tracked files are byte-identical to the same path under `.claude/skills/ui-ux-pro-max/` at that commit (git blob match). 6 files are modified copies of upstream paths and keep this notice (paths relative to the skill folder): `data/stacks/threejs.csv`, `scripts/design_system.py`, `scripts/tests/fixtures/relevance-baseline.json`, `scripts/tests/fixtures/relevance-thresholds.json`, `scripts/tests/test_design_system_mode.py`, `scripts/tests/test_native_desktop_stack_freshness.py`.
- `guide.md` and `index.md` have no upstream counterpart; their origin is not established and no license is claimed for them.
- Permission notice (same MIT text as the upstream `LICENSE`):

```text
MIT License

Copyright (c) 2024 Next Level Builder

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Phosphor icon data (inside ui-ux-pro-max): MIT

- Upstream: https://github.com/phosphor-icons/core (`LICENSE`, MIT, `Copyright (c) 2023 Phosphor Icons`, blob `78c9810819776e135d314adc0ff26eda7bec8b38`; MIT text identical to the block above). The `data/phosphor-icons-upstream.json` header names `@phosphor-icons/core` 2.1.1 and `@phosphor-icons/react` 2.1.10 as its source.
- This Phosphor copyright notice is retained for that data. Only the metadata's origin was checked, not how it was generated.

## Google Fonts metadata (inside ui-ux-pro-max): per-family licenses

- `data/google-fonts.csv` and `data/google-font-licenses.json` cite https://github.com/google/fonts. Each font family keeps its own license (for example OFL), recorded per family in the file. Not audited beyond the upstream provenance files; no license is claimed here.

## Other skills (origin not audited)

A bounded keyword search found no license or origin notice in the other profile skills (`agent/skills/`, including `graphify`, `browser`, `rfid-attendance`, `backend`, `engineering-harness`, `frontend`, `solidjs-engineering`, `typescript-advanced-types`, `web-design-guidelines`, `ux-flow-wireframer`, `accessible-ui-patterns`, `design-motion-principles` and `agent-creation`). Their origins were not audited.

## Runtime dependencies (not bundled)

These are installed through npm or Pi and are not vendored in this repository: `pi-claude-subscription-connector`, `pi-mcp-adapter`, `@bacnh85/pi-serena`, `graphify-pi`, `@dietrichgebert/ponytail`, QMD, and Pi's own dependency tree. Each keeps its own license. Their licenses were not audited here.
