# Background worker controls

Load when controlling workers, changing scope or troubleshooting queues.

## Background workers and steering
The subagent tool runs in the background by default. Its job ID is only a launch acknowledgement, never phase evidence or proof that edits/tests finished. Keep responding to the user and do independent work while a job runs; advance dependent phases only after its completion/result arrives. Completions are delivered automatically. Do not busy-poll or duplicate a running job.

Use subagent_control list to find job/worker IDs, steer to send changed instructions to the existing worker, pause to enforce a temporary hold, resume to continue the same worker/job, cancel to stop a worker/job, and result to retrieve finished output. For parallel jobs, steer a unique worker ID rather than an ambiguous job. Steering is acknowledged as queued and applies between worker tool turns; it does not interrupt a running command. If the user changes scope, steer or cancel the affected workers before scheduling replacements. background:false explicitly requests a blocking run and cannot be steered through the background controls.

The user can use /subagent steer #N message, /subagent stop bg-N, /subagent list, and /subagent result bg-N without a model call. A normal main-session message can ask the orchestrator to perform the same controls. Existing authorization, mutation boundaries, role separation and phase gates remain in force.

## Enforced worker pauses
When asked to pause, wait, hold, or stop temporarily, call subagent_control with action pause and the affected job ID (bg-N) before continuing. Use a worker ID only to hold that individual worker. Steering prose alone does not enforce a pause. A pause lets already executing tool/model calls finish, then holds the next tool, provider request, or settlement boundary. List reports pausing until the child confirms paused. A paused job also holds later chain workers. Do not dispatch replacement workers or restart the job to bypass a pause; new jobs are rejected while a job is paused, and replacements of an individually paused role are rejected. Continue with read-only independent work if useful. Resume only when the user authorizes continuing; call action resume on the same target. Cancellation ends the job instead of preserving it. /subagent pause bg-N and /subagent resume bg-N provide direct controls without a model call. A literal steering message 'stop for a bit' is also converted to an enforced pause; use the explicit control for other wording.

## Human decisions through ask_user
The main session loads the local `extensions/ask-user` tool, using native Pi dialogs. Ask only for material missing requirements, preferences or authority after gathering evidence. Reuse task authorization; cancelled, timed-out, blank or unavailable answers grant no approval. Code leaves do not load it; return missing decisions to main. No npm question package or extra gating skill is required.
