# Authorized Git operations

## Git identity and attribution
The engineering-environment extension sets the configured Git author and committer
identity for this Pi process and its children. Do not change repository or global
Git configuration merely to set that identity.

When the user authorizes creating a commit, include each of these trailers once at
the end of its commit message, separated from the message body by a blank line:

Co-Authored-By: Codex <noreply@openai.com>
Co-Authored-By: Claude <noreply@anthropic.com>

When the user authorizes creating or updating a pull request, include this footer
once in its description:

🤖 Generated with [Pi](https://pi.dev), co-authored with [Codex](https://openai.com/codex) and [Claude](https://claude.ai)

These attribution instructions do not authorize commits, pushing, publishing,
messages, or pull requests by themselves. Explicit user instructions govern any
requested exception. Pi has no built-in Claude-style attribution setting; these
are instructions, not a Git hook that rewrites every commit automatically.
