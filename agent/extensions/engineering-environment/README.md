# Claude settings mapped to Pi

| Claude setting | Pi equivalent in this profile |
|---|---|
| PreToolUse: Serena remind | Installed @bacnh85/pi-serena injects Serena-first guidance before agent work. Its optional strict checks run on tool_call. Strict mode was not enabled. |
| PreToolUse: Serena auto-approve | No Claude permission classifier to approve in Pi. The Claude hook is not called. Other installed Pi permission extensions, if any, keep their own behavior. |
| SessionStart: Serena activate | config.json sets SERENA_EAGER_STARTUP=1. The installed Serena extension warms its bridge with the current project on session_start. |
| SessionEnd: Serena cleanup | Installed Serena extension closes its worker on session_shutdown. |
| Four GIT_AUTHOR/GIT_COMMITTER variables | Local index.ts sets them before tools run. Child processes inherit them. No global Git config changes. |
| CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1 | This Claude-specific variable is not copied. The custom subprocess subagent runner disables extension discovery in children and only loads the Claude subscription guard for Anthropic children; it does not load its own subagent extension. Other agent extensions have their own nesting rules. |
| attribution.commit | Global AGENTS.md instructs authorized commits to include the two requested coauthor trailers once. This is guidance, not automatic commit-message enforcement. |
| attribution.pr | Global AGENTS.md adds the requested coauthor links and identifies Pi as the generating client. This is guidance, not a PR publication hook. |

Use ordinary pi with normal extension discovery. After changing these files, restart Pi or use /reload. The Serena extension manages activation/cleanup; Claude serena-hooks commands are not duplicated.

Serena tools are available where its extension is loaded (main and any compatible in-process agents). Code subprocess leaves explicitly load Serena and Graphify through subagent/code-integrations.ts and receive role-specific tool allowlists; the environment variables alone do not add tools. Serena bridge health and project activation still depend on its installed Python/backend requirements and were not verified by configuration checks.

No credentials or Claude subscription tokens are in these files. Existing model settings, installed packages, MCP choices and Claude settings are preserved.


## Folder layout

This extension is self-contained in extensions/engineering-environment/: index.ts is the Pi entrypoint, config.json contains environment values, and README.md documents the mapping. Attribution rules remain in the global AGENTS.md so Pi and its isolated children discover them. Edit config.json, then restart Pi or run /reload.
