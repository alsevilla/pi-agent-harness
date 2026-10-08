# Pi subagent extension

Run named specialists in isolated Pi subprocesses while keeping the main conversation available. This profile targets Pi 1.0.4 and uses the 22 definitions in `~/.pi/agent/agents/`; these are the installed roles, not the upstream example's planner/worker set. RFID attendance-domain specialists advise on unresolved business semantics, while the release engineer owns only selected SHIP/LEARN work.

## Dispatch and results

The orchestrator calls `subagent` with one of these shapes:

| Mode | Parameters | Behavior |
| --- | --- | --- |
| Single | `{ agent, task }` | One named role |
| Parallel | `{ tasks: [{ agent, task }, ...] }` | Up to eight tasks, four subprocesses at a time |
| Chain | `{ chain: [{ agent, task }, ...] }` | Sequential steps; `{previous}` inserts preceding output |

Supply the absolute candidate `cwd` and a self-contained task packet: requirements, evidence, permitted mutations and acceptance checks. For artifact-producing tasks, include exact absolute `_scratch/<task>` and `_evidence/<task>` paths even when editing the primary checkout; code-role guidance instructs leaves to return missing paths instead of inventing sibling folders. It warns against relocating live SQLite data or running executables before an authorized stop. Unknown restart configuration does not block authorized relocation; it blocks restart until executable, environment and DB path are verified. Children do not inherit the main conversation. User definitions are the default; project agents in `.pi/agents/` require `agentScope: "project"` or `"both"`. Project definitions override matching user names under `both`.

Runs are background jobs by default. A `bg-N` receipt acknowledges dispatch; it does not prove implementation or testing finished. Completion results arrive automatically without polling model calls. `background: false` requests a blocking run and does not support background steering. Successful background receipts are hidden in collapsed main-screen history; expanded history can show the job ID. Errors and foreground results remain visible.

For user roles, `roles.json` is canonical for `provider`+`model`, `fallbackModel`, `thinking` and `tools`; the definition file in `~/.pi/agent/agents/` keeps its description and prompt body and must be kept in sync. Project roles in `.pi/agents/` use their own frontmatter. Either fallback field accepts a single model or an ordered `||`-delimited chain. Each member is trimmed; empty, duplicate, and exact primary-model entries are skipped. The finite chain is attempted in order only for provider-availability failures before any tool activity. Task errors, aborts, and errors after tool activity are never retried. Native GPT IDs, including `gpt-6.1-sol`, are preserved. Model IDs are passed verbatim, so literal `claude-sonnet-5-5` and `claude-sonnet-5.5` are not rewritten to `claude-sonnet-5`; provider availability remains an external requirement.

## Live inspector

The main panel is hidden until workers exist. It shows session totals and active worker rows:

```text
Workers · 1 active · 2 spawned · 1 done · 0 failed/stopped
#2 frontend-worker · gpt-6-luna · low · Finish the UX checkpoint
```

Finished rows disappear from the main panel but remain in bounded inspector history. Open `/subagent`, use Ctrl+Shift+W, or click a worker. The bordered overlay shows role, model, effort, status, task, activity, context and elapsed time. Statuses include Initializing, Ongoing, Pausing, Paused, Completed, Failed and Stopped.

Activity uses native Pi assistant/tool components in chronological order. Latest output appears at the bottom. Scrolling up pauses following; End/Ctrl+End or **Jump to latest message** resumes it. Home/Ctrl+Home goes to oldest retained activity. Page keys and mouse scrolling follow Pi keybindings. The inspector's scrollbar follows the main `fullscreenScrollbar` setting (`auto`, `always` or `hidden`) and is display-only, with no drag or hover. Ctrl+O or clicking a turn controls native expansion. Worker selection and reopening preserve per-worker reading position.

Escape or a primary click outside the overlay closes it without stopping workers. Mouse controls require terminal mouse support. The outside-click adapter depends on Pi 1.0.4's TUI listener internals and must be checked after upgrades. This is a terminal overlay, not an operating-system window.

History retains up to 40 tool calls and 120 transcript entries per worker, and 64 finished attempts per session. Private thinking text is hidden. Context is the latest reported request size, not cumulative spend. Integration counters summarize observed calls/errors and graph-artifact reads; they do not certify correctness or measure Ponytail's injected prompt.

## Steering, pause and cancellation

Use `subagent_control` actions `list`, `steer`, `pause`, `resume`, `cancel`, `result`, `decisions`, `answer` and `decline`. Commands provide the same controls without a model call:

```text
/subagent list
/subagent steer #2 Focus only on the remaining fixture; preserve existing edits.
/subagent pause bg-1
/subagent resume bg-1
/subagent stop #2
/subagent result bg-1
```

Steer a unique worker in parallel jobs. Steering is queued between turns and does not interrupt a running command. Pausing is enforced by the child-only `pause-gate.ts`: current tool/model calls may finish, then the next tool, provider or settlement boundary waits locally. A paused job also holds subsequent chain steps. The parent distinguishes Pausing from confirmed Paused. Resume continues the same process/context; cancel terminates it. New dispatches cannot bypass paused jobs/roles.

Literal steering phrases such as `stop for a bit` are converted to pauses; use explicit pause controls for other wording. Temporary control files are cleaned up when workers exit. Session reset/shutdown cancels owned background jobs.

## Worker decisions

A new background worker may call `request_decision` when a question blocks its next write. The parent does not open a human dialog itself: it queues the request and sends main a `subagent-decision` notice with candidate, worker, request, question, options, context and blocked scope. Main lists requests with `decisions`, then answers with `answer` (freeform text plus `basis` `user_answer` or `existing_authorization` and a traceable `reference`) or `decline` (with `reason`). Main may ask its own native `ask_user` first. Options are recommendations only; a custom answer is never mapped to an option.

The worker receives `answered` only with a recorded answer; `cancelled`, blank, timeout, declined and unavailable results are never approval. Steer cannot answer or unblock a request. Answers may be recorded while a job is paused but never resume it. Cancel, session reset, worker exit and job end settle pending requests exactly once. Limits: one open request per worker and four per session. The tool grants no tool, scope, server, commit or deploy permission. Foreground and direct headless runs get no decision tool.

Activation: saving these files does not change the running parent. The new tool exists only after a parent reload/restart at a safe point once active workers finish; reloading resets owned jobs. Existing jobs keep their toolsets.

## Explicit code-role integrations

Automatic extension/MCP/skill/prompt discovery is disabled in children. `code-integrations.ts` explicitly loads these resources for the 22 roles in `integrations.json`; the `statusline-setup` role was removed and is not part of the registry or integration set:

| Integration | Actual worker behavior |
| --- | --- |
| Ponytail | Loads `@dietrichgebert/ponytail/pi-extension/index.js` once. Its `before_agent_start` hook injects configured guidance on each turn. It is not a tool call, so it will not appear as a Serena/QMD-style activity entry. No duplicate base-skill read is required. |
| Serena | Loads the native extension with exact read-only navigation names. The shared workerTools list is empty: neither implementation worker receives Serena mutation tools. Both keep precise edit and omit write. Calls use the explicit candidate project root. |
| Graphify | Loads the native package extension and the profile-adapted skill. Main sessions and workers use the same skill; its helper queries write no cache files. Dispatch supplies verified absolute reference paths. |
| QMD | Loads `../qmd/index.ts` with read-only `qmd_search`, `qmd_get`, `qmd_status`. BM25 search returns three references by default, at most five; selected reads are bounded. |

Ponytail defaults to `full` unless its package config/environment changes that default. New children do not inherit the main session's transient `/ponytail` mode. Advice cannot override requirements, assigned role authority, candidate boundaries or required checks, and does not require additional audit/review agents.

Earlier integration checks covered all integrated role argument lists and an isolated Ponytail extension hook (one load, prompt injection, no extension errors or nested subagent tool). The current worker tool restriction is checked separately against both implementation role files and the effective dispatch allowlist. These checks do not prove model behavior or filesystem isolation.

## Candidate and reference paths

Dispatch prefers an existing candidate graph, then checks the primary checkout resolved through Git worktree metadata. Use the supplied absolute report/wiki directly; do not list a missing candidate `graphify-out` directory to rediscover a primary-checkout graph. Queries use the listed absolute `--graph` path. Missing artifacts are skipped without automatic copying/building/updating. Graphs may be stale or from another branch; source reads, edits and tests stay in the assigned candidate.

The resolver also discovers `~/.graphify/global-graph.json`, its optional wiki index and a coverage manifest capped at 64 KB. It does not load the global JSON at dispatch. Exact manifest source-path matches permit read-only fallback orientation; unmatched global corpora are separate references for assigned cross-project questions or confirmed coverage. Similar repository names do not establish coverage. Global artifacts remain untouched.

QMD explicitly uses the shared named index (`index` by default), bypassing worktree-local `.qmd` auto-discovery. Keep returned document references intact. Indexed notes are prior evidence; verify current behavior in the candidate. Retrieval does not initialize, clone or rebuild indexes.

## User questions
The main session loads the local `extensions/ask-user` extension, registering `ask_user` through Pi's native dialogs. It is not explicitly loaded into leaf workers: background workers hand missing decisions back to the orchestrator. The external `pi-ask-user` package is removed.

Ask only for material missing decisions, preferences or authority. Cancellation, timeout or blank input does not authorize work. Existing authorization remains valid; no extra gating skill or routine confirmation step is added.

## Files and boundaries

`index.ts` registers dispatch/controls; `background.ts` owns RPC jobs; `monitor.ts` renders live activity; `pause-gate.ts` enforces holds; `decision-relay.ts` (child `request_decision`) and `decision-relay-state.ts` (parent registry) relay worker decisions; `agents.ts` discovers roles; `model-routing.ts` handles model selection; `code-integrations.ts` and `integrations.json` configure integrations. Roles and prompt shortcuts live under `~/.pi/agent/agents/` and `~/.pi/agent/prompts/`, separately from this extension.

Install the full profile using `~/.pi/agent/README.md`; copying upstream example files over this extension would lose its controls/integrations. Children are leaf roles, not an OS filesystem sandbox. Shell access remains powerful; exact role/task authority and project instructions apply. Match Bash/PowerShell syntax to the selected shell tool. Authentication, sessions, dependencies and local configuration stay out of Git.

## Compact role guidance
The parent policy is a short routing/authority contract. It does not preload operational references into every worker. Role bodies remain self-contained for delegation and mutation boundaries; assigned modules and optional Scout/DevOps/UI-UX topic sections load only when needed. Workers explicitly return RED/GREEN or exception evidence. Primary/fallback models and effort are unchanged. Implementation worker tool permissions are narrowed as described below. Review dispositions now match the reviewer: APPROVE, APPROVE WITH NOTES, REQUEST CHANGES, ESCALATE.

## Scoped worker edits

Rust and frontend workers retain precise `edit`; `write` and all six Serena mutation tools are excluded. `integrations.json` controls the automatic grants, so this restriction needs no dispatcher code change. Removing those tools does not make implementation read-only: workers must inspect and edit only their assigned scope, preserving unrelated code/tests. Shell tools can still write; this is a tool-list restriction, not a filesystem sandbox, and custom project agent definitions must preserve it. The focused regression checks actual worker frontmatters against fixed mutation names and retains read-only integration tools.

Restart Pi and cancel/relaunch previously started workers to use the revised configuration. Pausing/resuming an existing worker retains its old tool list.

## Test invocation
`bun test agent/extensions/subagent` runs the fallback runtime regression through `tests/fallback-runtime.test.ts`, which launches `tests/fallback-runtime.node.ts` with the installed `node --test`; Bun 1.4.2 does not provide `node:module` `registerHooks`. The runtime regression's tested baseline is Node 24.20.0 (`registerHooks` and native TypeScript); older Node versions are unverified. Run it directly with `node --test agent/extensions/subagent/tests/fallback-runtime.node.ts`.