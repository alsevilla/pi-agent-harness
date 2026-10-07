# Pi agent stack

The active modular profile is in [agent/](agent/README.md). It contains 18 named agent roles, selectively loaded engineering/frontend/backend skills, background worker controls and a live inspector, with Serena, Graphify and QMD integrations.

Follow [agent/README.md](agent/README.md) to install the profile and configure direct Claude subscription and ChatGPT/Codex sign-in. CLIProxyAPI is not required.

This repository mirrors `~/.pi`: Git runs at `~/.pi`, while Pi loads its profile from `~/.pi/agent`. Authentication, sessions, installed packages, caches and machine-local settings remain ignored. Configuration examples are committed; customize their local copies.

The older root-level GSD/skills/extensions stack was retired. Its files remain recoverable from Git history before this cleanup; do not reinstall them alongside the current modular profile.

Use feature branches and pull requests against `master`. To update a clean local checkout:

```bash
git -C ~/.pi pull --ff-only
```

The profile keeps a compact always-loaded policy and moves detailed procedures into selectively read skill references. Worker TDD evidence, compatible named roles and installation details are documented in [agent/README.md](agent/README.md).
