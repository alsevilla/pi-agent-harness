# Pi agent harness

The active modular profile is in [agent/](agent/README.md). It contains 22 named agent roles, selectively loaded engineering/frontend/backend/RFID-attendance skills, background worker controls and a live inspector, with Serena, Graphify and QMD integrations.

Follow [agent/README.md](agent/README.md) to install the profile and configure direct Claude subscription and ChatGPT/Codex sign-in. CLIProxyAPI is not required.

This repository mirrors `~/.pi`: Git runs at `~/.pi`, while Pi loads its profile from `~/.pi/agent`. Authentication, sessions, installed packages, caches and machine-local settings remain ignored. Configuration examples are committed; customize their local copies.

This repository starts from a fresh source snapshot, without the previous repository's history. The older root-level GSD/skills/extensions stack is retired and is not available in this repository; do not reinstall it alongside the current modular profile.

Use feature branches and pull requests against `master`. To update a clean local checkout:

```bash
git -C ~/.pi pull --ff-only
```

The profile keeps a compact always-loaded policy and moves detailed procedures into selectively read skill references. Worker TDD evidence, compatible named roles and installation details are documented in [agent/README.md](agent/README.md).
