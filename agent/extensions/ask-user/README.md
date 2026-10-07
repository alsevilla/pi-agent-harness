# Native ask_user

Local Pi extension using only supported `ctx.ui.select` and `ctx.ui.input` dialogs. No custom overlay, raw key handler, prompt injection, extra skill or external dependency. Tool execution is sequential; one active request is allowed per extension instance.

Use `question` or `questions` (1–4 sequential entries). Choices accept strings or `{title, description}`. `context` is displayed with the question. Other/freeform defaults on; omit choices for a text question. `allowMultiple` uses a repeated native selector with `[x]` toggles and explicit **Done**. Empty selections and blank required answers cancel. `allowComment` requests optional text; blank skips the comment, Escape cancels. `timeout` is an optional whole-request deadline in milliseconds, passed with an abort signal to each native dialog.

Result details contain `answers`, `response`, `cancelled` and, when cancelled, `reason`. Completed batch answers are retained when a later question cancels, but the whole request remains cancelled. Cancellation, timeout, abort, headless mode, invalid arguments, UI failures and overlap are never user approval. Rendering knobs and custom shortcut keys from the former npm extension are intentionally unsupported.

Main profile must remove/disable the old npm registration before enabling this extension; tool names must not collide. Headless workers should hand human decisions to main. No actual dialogs are opened by tests.

Run `node --test extensions/ask-user/tests/core.test.ts` on a Node runtime with native TypeScript support. Tests cover choice/freeform, explicit multi-select, comments, invalid/blank input, no UI, batch partial answers, whole-request timeout, abort, concurrency and recovery. Model adherence and terminal-specific rendering remain runtime limitations.
