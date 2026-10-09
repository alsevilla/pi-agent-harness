/**
 * Subagent Tool - Delegate tasks to specialized agents
 *
 * Spawns a separate `pi` process for each subagent invocation,
 * giving it an isolated context window.
 *
 * Supports three modes:
 *   - Single: { agent: "name", task: "..." }
 *   - Parallel: { tasks: [{ agent: "name", task: "..." }, ...] }
 *   - Chain: { chain: [{ agent: "name", task: "... {previous} ..." }, ...] }
 *
 * Uses JSON mode to capture structured output from subagents.
 */

import { BackgroundWorkers, RpcWorker } from "./background.ts";
import { WorkerMonitor } from "./monitor.ts";
import { acquireWorkspace, releaseWorkspace, WorkspaceAdmissionError, type WorkspaceAccess, type WorkspaceLease } from "./workspace-admission.ts";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { StringDecoder } from "node:string_decoder";
import type { AgentToolResult, ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Message } from "@earendil-works/pi-ai";
import { StringEnum } from "@earendil-works/pi-ai";
import {
	CONFIG_DIR_NAME,
	type ExtensionAPI,
	getAgentDir,
	withFileMutationQueue,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { type AgentConfig, type AgentScope, discoverAgents } from "./agents.ts";
import { getFallbackSequence, nextFallbackModel } from "./model-routing.ts";
import { configureCodeIntegrations, CODE_NAVIGATION_GUIDANCE, graphReferenceGuidance } from "./code-integrations.ts";
import { COMPACT_HANDOFF_INSTRUCTIONS, extractFinalText, failureDiagnostics, incompleteLabel, isIncompleteStop, retainedEntryBlock, withTerminalDiagnostics } from "./compact-handoff.ts";
import { appendParentReports, runDag, validateDag, type DagNodeSpec, type DagStatus } from "./dag.ts";
import { cargoEnvDefaults } from "./build-env.ts";
import { DECISION_RECORD_PREFIX, DECISION_RELAY_ENV, DECISION_TOOL, DecisionRelay } from "./decision-relay-state.ts";
import { guardRefusalReplayable, providerLaunchState, registerProviderCooldown, runProviderCooldownCommand } from "./provider-cooldown-entry.ts";

const MAX_PARALLEL_TASKS = 8;
const MAX_CONCURRENCY = 4;

interface UsageStats {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	contextTokens: number;
	turns: number;
}

interface SingleResult {
	workerId?: string;
	nodeId?: string; // DAG mode: node identity, stable even when agents repeat
	dag?: { status: DagStatus; blockedBy?: string[]; started: boolean }; // DAG mode: node outcome
    toolActivity?: boolean;
	agent: string;
	agentSource: "user" | "project" | "unknown";
	task: string;
	exitCode: number;
	messages: Message[];
	stderr: string;
	usage: UsageStats;
	model?: string;
	stopReason?: string;
	errorMessage?: string;
	step?: number;
}

interface SubagentDetails {
	mode: "single" | "parallel" | "chain" | "dag";
	agentScope: AgentScope;
	projectAgentsDir: string | null;
	results: SingleResult[];
}

function getFinalOutput(messages: Message[]): string {
	return extractFinalText(messages); // every text block of the last text-bearing assistant, not only the first
}

function isFailedResult(result: SingleResult): boolean {
	return result.exitCode !== 0 || result.stopReason === "error" || result.stopReason === "aborted" || isIncompleteStop(result);
}

function getResultOutput(result: SingleResult): string {
	// INCOMPLETE keeps every text block of the final message plus its terminal diagnostics: the partial report is the evidence.
	if (isIncompleteStop(result)) return withTerminalDiagnostics(extractFinalText(result.messages), result) || "(no output)";
	if (isFailedResult(result)) {
		return [...failureDiagnostics(result).map((d, i) => (i === 0 ? d.value : `${d.label}: ${d.value}`)), getFinalOutput(result.messages)].filter(Boolean).join("\n\n") || "(no output)";
	}
	return getFinalOutput(result.messages) || "(no output)";
}

async function mapWithConcurrencyLimit<TIn, TOut>(
	items: TIn[],
	concurrency: number,
	fn: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
	if (items.length === 0) return [];
	const limit = Math.max(1, Math.min(concurrency, items.length));
	const results: TOut[] = new Array(items.length);
	let nextIndex = 0;
	const workers = new Array(limit).fill(null).map(async () => {
		while (true) {
			const current = nextIndex++;
			if (current >= items.length) return;
			results[current] = await fn(items[current], current);
		}
	});
	await Promise.all(workers);
	return results;
}

async function writePromptToTempFile(agentName: string, prompt: string): Promise<{ dir: string; filePath: string }> {
	const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-subagent-"));
	const safeName = agentName.replace(/[^\w.-]+/g, "_");
	const filePath = path.join(tmpDir, `prompt-${safeName}.md`);
	await withFileMutationQueue(filePath, async () => {
		await fs.promises.writeFile(filePath, prompt, { encoding: "utf-8", mode: 0o600 });
	});
	return { dir: tmpDir, filePath };
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
	if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}

	const execName = path.basename(process.execPath).toLowerCase();
	const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
	if (!isGenericRuntime) {
		return { command: process.execPath, args };
	}

	return { command: "pi", args };
}

type OnUpdateCallback = (partial: AgentToolResult<SubagentDetails>) => void;

interface DispatchDefaults {
	waitKey?: string; // DAG node ID: keys queued-claim accounting per job
    runtime?: BackgroundWorkers;
    jobId?: string;
	onSpawn?: () => void; // called at the physical spawn attempt only; DAG reports started from it
	monitor?: WorkerMonitor;
	contextWindowFor?: (model: string) => number | undefined;
	model?: string;
	thinkingLevel?: ThinkingLevel;
}

const WORKSPACE_WAITING = "Waiting for workspace";

// Admission boundary for every launch path (single, chain, parallel, background, future DAG): the claim is registered before any await and held across declared fallbacks.
async function runSingleAgent(
	defaultCwd: string,
	dispatchDefaults: DispatchDefaults,
	agents: AgentConfig[],
	agentName: string,
	task: string,
	cwd: string | undefined,
	step: number | undefined,
	signal: AbortSignal | undefined,
	onUpdate: OnUpdateCallback | undefined,
	makeDetails: (results: SingleResult[]) => SubagentDetails,
	access: WorkspaceAccess = "write",
): Promise<SingleResult> {
	const agent = agents.find((a) => a.name === agentName);
	if (!agent) return runAgentAttempt(defaultCwd, dispatchDefaults, agents, agentName, task, cwd, step, signal, onUpdate, makeDetails, undefined);
	const { jobId, runtime } = dispatchDefaults;
	// One claim key per workspace request: parallel entries without a node ID must not clear each other's waiting state.
	const claim = dispatchDefaults.waitKey ?? randomUUID();
	const setWaiting = (waiting?: string) => { if (jobId) runtime?.setWaiting(jobId, waiting, claim); };
	const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 };
	let lease: WorkspaceLease;
	try {
		lease = await acquireWorkspace(cwd ?? defaultCwd, {
			access,
			signal,
			onQueued: () => {
				setWaiting(WORKSPACE_WAITING);
				if (!jobId) onUpdate?.({ content: [{ type: "text", text: WORKSPACE_WAITING }], details: makeDetails([{ agent: agentName, agentSource: agent.source, task, exitCode: -1, messages: [], stderr: "", usage, step }]) });
			},
		});
	} catch (error) {
		setWaiting(undefined);
		if (signal?.aborted) throw new Error("Subagent was aborted");
		if (error instanceof WorkspaceAdmissionError) return { agent: agentName, agentSource: agent.source, task, exitCode: 1, messages: [], stderr: error.message, usage, step, stopReason: "error", errorMessage: error.message };
		throw error;
	}
	setWaiting(undefined);
	try {
		return await runAgentAttempt(defaultCwd, dispatchDefaults, agents, agentName, task, cwd, step, signal, onUpdate, makeDetails, lease);
	} finally {
		releaseWorkspace(lease);
	}
}

// One launch attempt under an already-held workspace lease; fallback attempts reuse that lease.
async function runAgentAttempt(
	defaultCwd: string,
	dispatchDefaults: DispatchDefaults,
	agents: AgentConfig[],
	agentName: string,
	task: string,
	cwd: string | undefined,
	step: number | undefined,
	signal: AbortSignal | undefined,
	onUpdate: OnUpdateCallback | undefined,
	makeDetails: (results: SingleResult[]) => SubagentDetails,
	lease: WorkspaceLease | undefined,
	attemptModel?: string,
	fallbackModels?: string[],
): Promise<SingleResult> {
	const agent = agents.find((a) => a.name === agentName);

	if (!agent) {
		const available = agents.map((a) => `"${a.name}"`).join(", ") || "none";
		return {
			agent: agentName,
			agentSource: "unknown",
			task,
			exitCode: 1,
			messages: [],
			stderr: `Unknown agent: "${agentName}". Available agents: ${available}.`,
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
			step,
		};
	}

	const args: string[] = ["--mode", "rpc", "--no-session", "--no-extensions", "--no-mcp", "--no-skills", "--no-prompt-templates", "--offline"];
	const inheritsDispatchConfig = !agent.model;
	const model = attemptModel ?? agent.model ?? dispatchDefaults.model;
	const workerController = new AbortController();
    const parentSignal = signal;
    const parentAbort = () => workerController.abort();
    parentSignal?.addEventListener("abort", parentAbort, {once: true});
    if (parentSignal?.aborted) workerController.abort();
    if (dispatchDefaults.jobId) signal = workerController.signal;
    let release: (() => void) | undefined;
    try {
        const { runtime, jobId } = dispatchDefaults;
        if (runtime) {
            // A job paused after its grant hands the slot back and waits, so unrelated jobs keep the capacity.
            for (;;) {
                if (jobId) await runtime.waitRunnable(jobId, signal);
                release = await runtime.acquire(MAX_CONCURRENCY, signal);
                if (!jobId || !runtime.jobs.get(jobId)?.paused) break;
                release(); release = undefined;
            }
        }
    }
    catch (error) { release?.(); parentSignal?.removeEventListener("abort", parentAbort); throw error; }
    // Declared provider check before any spawn: cooling, blocked, unavailable or probe-busy never launches a child.
    if (model) {
        const launch = await providerLaunchState(model);
        if (signal?.aborted) { release?.(); parentSignal?.removeEventListener("abort", parentAbort); throw new Error("Subagent was aborted"); } // an abort during the check spawns nothing and starts no fallback
        if (launch.state !== "launch") {
            release?.(); parentSignal?.removeEventListener("abort", parentAbort);
            const remaining = fallbackModels ?? getFallbackSequence(model, agent.fallbackModel);
            if (launch.replayable && remaining.length) {
                const fallback = await runAgentAttempt(defaultCwd, dispatchDefaults, agents, agentName, task, cwd, step, signal, onUpdate, makeDetails, lease, remaining[0], remaining.slice(1));
                fallback.stderr = `Model ${model} skipped (provider cooldown ${launch.state}); retried with ${remaining[0]}.\n${fallback.stderr}`;
                return fallback;
            }
            return { agent: agentName, agentSource: agent.source, task, exitCode: 1, messages: [], stderr: `Model ${model} not launched: provider cooldown ${launch.state}.`, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 }, model, step, stopReason: "error", errorMessage: `provider cooldown ${launch.state}` };
        }
    }
    const worker = dispatchDefaults.monitor?.store.begin(agentName, task, model ?? "inherited", (inheritsDispatchConfig ? dispatchDefaults.thinkingLevel : undefined) ?? agent.thinking ?? "provider default", model ? dispatchDefaults.contextWindowFor?.(model) : undefined);
    if (worker && dispatchDefaults.jobId) dispatchDefaults.runtime?.note(dispatchDefaults.jobId, worker.id, dispatchDefaults.waitKey);
    let codeIntegrationsEnabled = false;
    try {
	if (model) args.push("--model", model);
	if (model?.startsWith("anthropic/")) {
		const guardPath = path.join(getAgentDir(), "npm", "node_modules", "pi-claude-subscription-connector", "extensions", "subscription-guard.ts");
		if (!fs.existsSync(guardPath)) throw new Error("Claude subscription guard missing. Install npm:pi-claude-subscription-connector before launching an Anthropic subagent.");
		args.push("--extension", guardPath);
	}
	args.push("--extension", path.join(getAgentDir(), "extensions", "subagent", "provider-cooldown-entry.ts")); // child guard, explicit despite --no-extensions
	if (agent.thinking) args.push("--thinking", agent.thinking);
	if (inheritsDispatchConfig && dispatchDefaults.thinkingLevel) {
		args.push("--thinking", dispatchDefaults.thinkingLevel);
	}
	codeIntegrationsEnabled = configureCodeIntegrations(args, agent, dispatchDefaults.jobId ? [DECISION_TOOL] : []);

    } catch (error) {
        if (worker) dispatchDefaults.monitor?.store.finish(worker.id, "failed", String(error));
        release?.(); parentSignal?.removeEventListener("abort", parentAbort);
        throw error;
    }

	let controlDir: string | undefined;
    let controlPath: string | undefined;
	let tmpPromptDir: string | null = null;
	let tmpPromptPath: string | null = null;


    const currentResult: SingleResult = {
        workerId: worker?.id,
		agent: agentName,
		agentSource: agent.source,
		task,
		exitCode: -1,
		messages: [],
		stderr: "",
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
		model,
		step,
	};

	const emitUpdate = () => {
		if (onUpdate) {
			onUpdate({
				content: [{ type: "text", text: getFinalOutput(currentResult.messages) || "(running...)" }],
				details: makeDetails([currentResult]),
			});
		}
	};

	try {
		if (agent.systemPrompt.trim()) {
			const tmp = await writePromptToTempFile(agent.name, agent.systemPrompt + (codeIntegrationsEnabled ? CODE_NAVIGATION_GUIDANCE + graphReferenceGuidance(cwd ?? defaultCwd) : "") + COMPACT_HANDOFF_INSTRUCTIONS);
			tmpPromptDir = tmp.dir;
			tmpPromptPath = tmp.filePath;
			args.push("--append-system-prompt", tmpPromptPath);
		}

		if (dispatchDefaults.jobId) {
            controlDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-worker-control-"));
            controlPath = path.join(controlDir, "control.json");
            fs.writeFileSync(controlPath, "0");
            args.push("--extension", path.join(getAgentDir(), "extensions", "subagent", "pause-gate.ts"));
            args.push("--extension", path.join(getAgentDir(), "extensions", "subagent", "decision-relay.ts"));
        }
		if (signal?.aborted) throw new Error("Subagent was aborted"); // an abort during the prompt-file write spawns nothing
		let wasAborted = false;

		let removeAbort = () => {};
        const exitCode = await new Promise<number>((resolve) => {
			const invocation = getPiInvocation(args);
			dispatchDefaults.onSpawn?.();
			const proc = spawn(invocation.command, invocation.args, {
				cwd: cwd ?? defaultCwd,
                env: {...process.env, ...cargoEnvDefaults(cwd ?? defaultCwd), PI_SUBAGENT_CONTROL_FILE: controlPath ?? "", [DECISION_RELAY_ENV]: dispatchDefaults.jobId ? "1" : ""},
				shell: false,
				stdio: ["pipe", "pipe", "pipe"],
			});
			const client = new RpcWorker(proc, controlPath);
            proc.on("spawn", () => {
                if (worker) dispatchDefaults.monitor?.store.started(worker.id);
                if (client) {
                    void client.send("prompt", "Task: " + task).catch(error => {
                        if (client.closed && currentResult.messages.length) return;
                        currentResult.stopReason = "error"; currentResult.errorMessage = error.message;
                        proc.stdin?.end();
                    });
                    if (worker && dispatchDefaults.jobId) dispatchDefaults.runtime?.attach(dispatchDefaults.jobId, worker.id, client, workerController);
                }
            });
            let buffer = "";
            // One decoder per stream per spawn: a pipe chunk may end inside a multi-byte codepoint.
            const stdoutDecoder = new StringDecoder("utf8"), stderrDecoder = new StringDecoder("utf8");

			const processLine = (line: string) => {
				if (!line.trim()) return;
				let event: any;
				try {
					event = JSON.parse(line);
				} catch {
					return;
				}

				client?.event(event);
                const relayed = Boolean(client && worker && dispatchDefaults.jobId && event.type === "extension_ui_request");
                if (relayed && event.method === "notify" && typeof event.message === "string" && event.message.startsWith(DECISION_RECORD_PREFIX)) dispatchDefaults.runtime?.announceDecision(dispatchDefaults.jobId!, worker!.id, cwd ?? defaultCwd, event.message);
                // Only the exact dialog of an announced request is held; every other dialog keeps the auto-cancel below.
                const held = relayed && dispatchDefaults.runtime?.holdDecisionDialog(dispatchDefaults.jobId!, worker!.id, event);
                if (client && !held && event.type === "extension_ui_request" && ["select", "confirm", "input", "editor"].includes(event.method)) {
                    // Detached workers cannot leave an unanswered dialog hanging.
                    proc.stdin?.write(JSON.stringify({type: "extension_ui_response", id: event.id, cancelled: true}) + "\n");
                    currentResult.stderr += `Worker dialog canceled: ${event.method} ${event.title ?? ""}\n`;
                }
                if (event.type === "tool_execution_start") currentResult.toolActivity = true;
                if (event.type === "agent_settled" && client) { client.close(); proc.stdin?.end(); if (worker) dispatchDefaults.runtime?.detach(worker.id); }
                if (worker) dispatchDefaults.monitor?.store.event(worker.id, event);
                if (event.type === "message_end" && event.message) {
					const msg = event.message as Message;
					currentResult.messages.push(msg);

					if (msg.role === "assistant") {
						currentResult.usage.turns++;
						const usage = msg.usage;
						if (usage) {
							currentResult.usage.input += usage.input || 0;
							currentResult.usage.output += usage.output || 0;
							currentResult.usage.cacheRead += usage.cacheRead || 0;
							currentResult.usage.cacheWrite += usage.cacheWrite || 0;
							currentResult.usage.cost += usage.cost?.total || 0;
							currentResult.usage.contextTokens = usage.totalTokens || 0;
						}
						if (!currentResult.model && msg.model) currentResult.model = msg.model;
						currentResult.stopReason = msg.stopReason; // the latest assistant decides; a missing reason must clear an earlier stop
						currentResult.errorMessage = msg.errorMessage; // latest assistant decides, like stopReason
					}
					emitUpdate();
				}

				if (event.type === "tool_result_end" && event.message) {
					currentResult.messages.push(event.message as Message);
					emitUpdate();
				}
			};

			proc.stdout.on("data", (data) => {
				buffer += stdoutDecoder.write(data);
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";
				for (const line of lines) processLine(line);
			});

			proc.stderr.on("data", (data) => {
				currentResult.stderr += stderrDecoder.write(data);
			});

			proc.on("close", (code) => {
				buffer += stdoutDecoder.end(); currentResult.stderr += stderrDecoder.end(); // flush a truncated trailing sequence before the trailing parse
				if (buffer.trim()) processLine(buffer);
				client?.close(); if (worker) dispatchDefaults.runtime?.detach(worker.id);
                resolve(code ?? 1);
			});

			proc.on("error", (error) => {
                currentResult.stderr += error.message;
                client?.close(error.message); if (worker) dispatchDefaults.runtime?.detach(worker.id);
				resolve(1);
			});

			if (signal) {
				const killProc = () => {
					wasAborted = true;
					proc.kill("SIGTERM");
					const forceKill = setTimeout(() => {
						if (proc.exitCode === null && proc.signalCode === null) proc.kill("SIGKILL");
					}, 5000);
                    forceKill.unref(); proc.once("close", () => clearTimeout(forceKill));
				};
				if (signal.aborted) killProc();
				else { signal.addEventListener("abort", killProc, { once: true }); removeAbort = () => signal?.removeEventListener("abort", killProc); }
			}
		});

		removeAbort(); release?.(); release = undefined;
        currentResult.exitCode = exitCode;
        if (worker) dispatchDefaults.monitor?.store.finish(worker.id, wasAborted ? "aborted" : isFailedResult(currentResult) ? "failed" : "completed", wasAborted ? "Subagent was aborted" : isFailedResult(currentResult) ? getResultOutput(currentResult) : undefined);
        if (wasAborted && dispatchDefaults.jobId) { currentResult.stopReason = "aborted"; currentResult.errorMessage = "Subagent was stopped"; return currentResult; }
		if (wasAborted) throw new Error("Subagent was aborted");
		const remainingFallbacks = fallbackModels ?? getFallbackSequence(model, agent.fallbackModel);
		const retryResult = {
			...currentResult,
			output: getFinalOutput(currentResult.messages),
			toolActivity: currentResult.toolActivity || currentResult.messages.some(
				(message) => message.role === "toolResult" || (message.role === "assistant" && message.content.some((part) => part.type === "toolCall")),
			),
		};
		// A child guard refusal replays only when this parent's own store still says replayable (no health is read from text).
		const guardRefused = !wasAborted && !retryResult.toolActivity && retryResult.stopReason === "error" && model !== undefined && await guardRefusalReplayable(model, retryResult.errorMessage);
		const nextModel = guardRefused ? remainingFallbacks[0] : nextFallbackModel(retryResult, remainingFallbacks, wasAborted);
		if (nextModel) {
			const primaryError = getResultOutput(currentResult);
            const updates = worker ? dispatchDefaults.runtime?.steeringFor(worker.id) ?? [] : [];
			const fallbackResult = await runAgentAttempt(
				defaultCwd,
				dispatchDefaults,
				agents,
				agentName,
				updates.length ? task + "\n\nAcknowledged updates from the orchestrator (latest instructions apply):\n" + updates.join("\n") : task,
				cwd,
				step,
				signal,
				onUpdate,
				makeDetails,
				lease,
				nextModel,
				remainingFallbacks.slice(1),
			);
			fallbackResult.stderr = `Model ${model ?? "(inherited)"} failed; retried with ${nextModel}. ${primaryError}\n${fallbackResult.stderr}`;
			for (const key of ["input", "output", "cacheRead", "cacheWrite", "cost", "turns"] as const) {
				fallbackResult.usage[key] += currentResult.usage[key];
			}
			return fallbackResult;
		}
		return currentResult;
    } catch (error) {
        if (worker) dispatchDefaults.monitor?.store.finish(worker.id, signal?.aborted ? "aborted" : "failed", String(error));
        throw error;
    } finally {
        release?.(); parentSignal?.removeEventListener("abort", parentAbort);
        if (controlDir) { for (const file of ["control.json", "control.json.next"]) try { fs.unlinkSync(path.join(controlDir, file)); } catch {} try { fs.rmdirSync(controlDir); } catch {} }
        if (tmpPromptPath)
			try {
				fs.unlinkSync(tmpPromptPath);
			} catch {
				/* ignore */
			}
		if (tmpPromptDir)
			try {
				fs.rmdirSync(tmpPromptDir);
			} catch {
				/* ignore */
			}
	}
}

const TaskItem = Type.Object({
	agent: Type.String({ description: "Name of the agent to invoke" }),
	task: Type.String({ description: "Task to delegate to the agent" }),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
	readOnly: Type.Optional(Type.Boolean({ description: "Trusted declaration: this task only reads its checkout (default write). Not an OS sandbox." })),
});

const ChainItem = Type.Object({
	agent: Type.String({ description: "Name of the agent to invoke" }),
	task: Type.String({ description: "Task with optional {previous} placeholder for prior output" }),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
	readOnly: Type.Optional(Type.Boolean({ description: "Trusted declaration: this step only reads its checkout (default write). Not an OS sandbox." })),
});

const AgentScopeSchema = StringEnum(["user", "project", "both"] as const, {
	description: 'Which agent directories to use. Default: "user". Use "both" to include project-local agents.',
	default: "user",
});

const DagNode = Type.Object({
	id: Type.String({ pattern: "^[A-Za-z][A-Za-z0-9_-]{0,31}$", description: "Unique node ID: a letter first, then letters, digits, _ or -; max 32" }),
	agent: Type.String({ description: "Name of the agent to invoke" }),
	task: Type.String({ description: "Task for this node; direct parent reports are appended after it" }),
	// Null is listed so the SDK keeps it for runtime refusal (its optional-null normalization would otherwise drop it); runtime treats null as invalid.
	cwd: Type.Optional(Type.Union([Type.String({ description: "Working directory for this node" }), Type.Null()])),
	dependsOn: Type.Optional(Type.Union([Type.Array(Type.String(), { description: "IDs of direct parent nodes" }), Type.Null()])),
	readOnly: Type.Optional(Type.Union([Type.Boolean({ description: "Trusted declaration: this node only reads its checkout (default write). Not an OS sandbox." }), Type.Null()])),
}, { additionalProperties: false });

const SubagentParams = Type.Object({
    background: Type.Optional(Type.Boolean({description: "Default true: return a job ID immediately; completion arrives automatically. Set false to explicitly wait for the entire task.", default: true})),
	agent: Type.Optional(Type.String({ description: "Name of the agent to invoke (for single mode)" })),
	task: Type.Optional(Type.String({ description: "Task to delegate (for single mode)" })),
	tasks: Type.Optional(Type.Array(TaskItem, { description: "Array of {agent, task} for parallel execution" })),
	chain: Type.Optional(Type.Array(ChainItem, { description: "Array of {agent, task} for sequential execution" })),
	agentScope: Type.Optional(AgentScopeSchema),
	dag: Type.Optional(Type.Array(DagNode, { minItems: 1, maxItems: 8, description: "DAG mode: up to 8 nodes with dependsOn edges; each node runs as its own agent" })),
	readOnly: Type.Optional(Type.Boolean({ description: "Trusted declaration for single mode: the task only reads its checkout (default write). Not an OS sandbox." })),
	confirmProjectAgents: Type.Optional(
		Type.Boolean({ description: "Prompt before running project-local agents. Default: true.", default: true }),
	),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process (single mode)" })),
});

// Root keys come from the schema itself: dag mode refuses any other top-level key before launch.
const SUBAGENT_ROOT_KEYS = new Set(Object.keys(SubagentParams.properties ?? {})); // no schema properties: empty set, dag mode fails closed

export default function (pi: ExtensionAPI) {
	registerProviderCooldown(pi);
	pi.registerCommand("provider-cooldown", {
		description: "Show provider cooldown state, or refresh one provider's auth after re-authenticating",
		handler: async (args, ctx) => {
			const result = await runProviderCooldownCommand(args);
			ctx.ui.notify(result.message, result.type);
		},
	});
	const monitor = new WorkerMonitor(pi);
    const decisions = new DecisionRelay();
    const runtime = new BackgroundWorkers(pi, monitor, decisions);
    const subagentTool = {
		name: "subagent",
		label: "Subagent",
		description: [
			"Delegate tasks to specialized subagents with isolated context. Background by default: return a job ID and keep responding to the user. Use subagent_control to list, steer, cancel or retrieve results. Do not repeatedly poll; completions arrive automatically. Do not claim a job is finished until its result arrives.",
			"Available user roles: " + discoverAgents(process.cwd(), "user").agents.map(a => a.name).join(", "),
			"Modes: single (agent + task), parallel (tasks array), chain (sequential with {previous} placeholder), dag (up to 8 nodes with dependsOn; a node runs after its parents are accepted).",
			`Default agent scope is "user" (from ${path.join(getAgentDir(), "agents")}).`,
			`To enable project-local agents in ${CONFIG_DIR_NAME}/agents, set agentScope: "both" (or "project").`,
		].join(" "),
		parameters: SubagentParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const agentScope: AgentScope = params.agentScope ?? "user";
			const dispatchDefaults: DispatchDefaults = {
				model: ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined,
				thinkingLevel: ctx.thinkingLevel,
                monitor, runtime, jobId: (ctx as any).subagentJobId,
                contextWindowFor: ref => {
                    const slash = ref.indexOf("/");
                    return slash < 0 ? undefined : ctx.modelRegistry?.find(ref.slice(0, slash), ref.slice(slash + 1))?.contextWindow;
                },
			};
			const discovery = discoverAgents(ctx.cwd, agentScope);
			const agents = discovery.agents;
			const confirmProjectAgents = params.confirmProjectAgents ?? true;

			const hasChain = (params.chain?.length ?? 0) > 0;
			const hasTasks = (params.tasks?.length ?? 0) > 0;
			const hasSingle = Boolean(params.agent && params.task);
			const hasDag = params.dag !== undefined; // an empty dag array is still a present, ambiguous mode
			const modeCount = Number(hasChain) + Number(hasTasks) + Number(hasSingle) + Number(hasDag);
			const mode = hasDag ? "dag" : hasChain ? "chain" : hasTasks ? "parallel" : "single";

			const makeDetails =
				(mode: "single" | "parallel" | "chain" | "dag") =>
				(results: SingleResult[]): SubagentDetails => ({
					mode,
					agentScope,
					projectAgentsDir: discovery.projectAgentsDir,
					results,
				});

			if (modeCount !== 1) {
				const available = agents.map((a) => `${a.name} (${a.source})`).join(", ") || "none";
				return {
					content: [
						{
							type: "text",
							text: `Invalid parameters. Provide exactly one mode.\nAvailable agents: ${available}`,
						},
					],
					details: makeDetails("single")([]),
					isError: true,
				};
			}

			// Validated before any project prompt, runtime start or launch: an invalid graph spawns nothing.
			let dagNodes: DagNodeSpec[] | undefined;
			if (hasDag) {
				const unknownRoot = Object.keys(params).find((key) => !SUBAGENT_ROOT_KEYS.has(key));
				if (unknownRoot !== undefined) return { content: [{ type: "text", text: `Invalid parameters: unknown top-level key "${unknownRoot}" in dag mode.` }], details: makeDetails("dag")([]), isError: true };
				try {
					dagNodes = validateDag(params.dag, { has: (name) => agents.some((a) => a.name === name) });
				} catch (error) {
					return { content: [{ type: "text", text: `Invalid DAG: ${error instanceof Error ? error.message : String(error)}` }], details: makeDetails("dag")([]), isError: true };
				}
			}

			if (
				(agentScope === "project" || agentScope === "both") &&
				confirmProjectAgents &&
				ctx.hasUI &&
				!ctx.isProjectTrusted()
			) {
				const requestedAgentNames = new Set<string>();
				if (params.chain) for (const step of params.chain) requestedAgentNames.add(step.agent);
				if (params.tasks) for (const t of params.tasks) requestedAgentNames.add(t.agent);
				if (params.dag) for (const node of params.dag) requestedAgentNames.add(node.agent);
				if (params.agent) requestedAgentNames.add(params.agent);

				const projectAgentsRequested = Array.from(requestedAgentNames)
					.map((name) => agents.find((a) => a.name === name))
					.filter((a): a is AgentConfig => a?.source === "project");

				if (projectAgentsRequested.length > 0) {
					const names = projectAgentsRequested.map((a) => a.name).join(", ");
					const dir = discovery.projectAgentsDir ?? "(unknown)";
					const ok = await ctx.ui.confirm(
						"Run project-local agents?",
						`Agents: ${names}\nSource: ${dir}\n\nProject agents are repo-controlled. Only continue for trusted repositories.`,
					);
					if (!ok)
						return {
							content: [{ type: "text", text: "Canceled: project-local agents not approved." }],
							details: makeDetails(hasChain ? "chain" : hasTasks ? "parallel" : "single")([]),
						};
				}
			}

            if (!(ctx as any).subagentJobId) {
                try { runtime.assertCanLaunch((params.dag ?? params.chain ?? params.tasks ?? [{agent: params.agent!}]).map(t => t.agent)); }
                catch (error) { return {isError: true, content: [{type: "text", text: String(error)}]}; }
            }
            if (params.background !== false) {
                const requests = params.dag ?? params.chain ?? params.tasks ?? [{agent: params.agent!, task: params.task!, cwd: params.cwd}];
                if (params.tasks && params.tasks.length > MAX_PARALLEL_TASKS) return {isError: true, content: [{type: "text", text: "Max parallel tasks is 8."}], details: makeDetails("parallel")([])};
                const unknown = requests.filter(t => !agents.some(a => a.name === t.agent)).map(t => t.agent);
                if (unknown.length) return {isError: true, content: [{type: "text", text: "Unknown agents: " + unknown.join(", ")}], details: makeDetails("single")([])};
                if (signal?.aborted) throw new Error("Dispatch was aborted");
                const job = runtime.start((jobSignal, jobId) => subagentTool.execute(_toolCallId, {...params, background: false, confirmProjectAgents: false}, jobSignal, undefined, {...ctx, subagentJobId: jobId} as any));
                return {content: [{type: "text", text: "Started background job " + job.id + ". Roles: " + requests.map(t => t.agent).join(", ") + ". This is a launch acknowledgement, not a completed task. Continue responding or doing independent work; completion will arrive automatically. Use subagent_control list to obtain worker IDs, steer to change direction, or cancel to stop."}], details: {...makeDetails(mode)([]), jobId: job.id, background: true}};
            }

			if (dagNodes) {
				const launched = new Set<string>();
				const rows = await runDag(dagNodes, {
					agents: { has: (name) => agents.some((a) => a.name === name) },
					concurrency: MAX_CONCURRENCY,
					signal,
					accept: (result: SingleResult) => !isFailedResult(result),
					report: (result: SingleResult) => withTerminalDiagnostics(extractFinalText(result.messages), result),
					run: (node, parents, nodeSignal) => {
						return runSingleAgent(ctx.cwd, { ...dispatchDefaults, waitKey: node.id, onSpawn: () => launched.add(node.id) }, agents, node.agent, appendParentReports(node.task, parents), node.cwd, undefined, nodeSignal, undefined, makeDetails("dag"), node.readOnly ? "read" : "write");
					},
				});
				const rowById = new Map(rows.map((row) => [row.nodeId, row]));
				const results: SingleResult[] = dagNodes.map((node) => {
					const row = rowById.get(node.id)!;
					const cause = row.cause === undefined ? undefined : row.cause instanceof Error ? row.cause.message : String(row.cause);
					const base: SingleResult = row.result ?? { agent: node.agent, agentSource: "unknown", task: node.task, exitCode: 1, messages: [], stderr: "", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 }, stopReason: cause === undefined ? undefined : "error", errorMessage: cause };
					return { ...base, nodeId: node.id, dag: { status: row.status, blockedBy: row.blockedBy, started: launched.has(node.id) } };
				});
				const accepted = results.filter((r) => r.dag?.status === "accepted").length;
				return {
					content: [{ type: "text", text: `DAG: ${accepted}/${results.length} nodes accepted\n\n${results.map(retainedEntryBlock).join("\n\n---\n\n")}` }],
					details: makeDetails("dag")(results),
					isError: accepted < results.length,
				};
			}

			if (params.chain && params.chain.length > 0) {
				const results: SingleResult[] = [];
				let previousOutput = "";

				for (let i = 0; i < params.chain.length; i++) {
					const step = params.chain[i];
					const taskWithContext = step.task.replace(/\{previous\}/g, () => previousOutput); // function replacer: `$&`, `$'` etc. in prior output stay literal

					// Create update callback that includes all previous results
					const chainUpdate: OnUpdateCallback | undefined = onUpdate
						? (partial) => {
								// Combine completed results with current streaming result
								const currentResult = partial.details?.results[0];
								if (currentResult) {
									const allResults = [...results, currentResult];
									onUpdate({
										content: partial.content,
										details: makeDetails("chain")(allResults),
									});
								}
							}
						: undefined;

					const result = await runSingleAgent(
						ctx.cwd,
						dispatchDefaults,
						agents,
						step.agent,
						taskWithContext,
						step.cwd,
						i + 1,
						signal,
						chainUpdate,
						makeDetails("chain"),
						step.readOnly ? "read" : "write",
					);
					results.push(result);

					const isError = isFailedResult(result);
					if (isError) {
						const errorMsg = getResultOutput(result);
						return {
							content: [{ type: "text", text: `Chain stopped at step ${i + 1} (${step.agent}): ${errorMsg}` }],
							details: makeDetails("chain")(results),
							isError: true,
						};
					}
					previousOutput = extractFinalText(result.messages);
				}
				return {
					content: [{ type: "text", text: getFinalOutput(results[results.length - 1].messages) || "(no output)" }],
					details: makeDetails("chain")(results),
				};
			}

			if (params.tasks && params.tasks.length > 0) {
				if (params.tasks.length > MAX_PARALLEL_TASKS)
					return {
						content: [
							{
								type: "text",
								text: `Too many parallel tasks (${params.tasks.length}). Max is ${MAX_PARALLEL_TASKS}.`,
							},
						],
						details: makeDetails("parallel")([]),
					};

				// Track all results for streaming updates
				const allResults: SingleResult[] = new Array(params.tasks.length);

				// Initialize placeholder results
				for (let i = 0; i < params.tasks.length; i++) {
					allResults[i] = {
						agent: params.tasks[i].agent,
						agentSource: "unknown",
						task: params.tasks[i].task,
						exitCode: -1, // -1 = still running
						messages: [],
						stderr: "",
						usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
					};
				}

				const emitParallelUpdate = () => {
					if (onUpdate) {
						const running = allResults.filter((r) => r.exitCode === -1).length;
						const done = allResults.filter((r) => r.exitCode !== -1).length;
						onUpdate({
							content: [
								{ type: "text", text: `Parallel: ${done}/${allResults.length} done, ${running} running...` },
							],
							details: makeDetails("parallel")([...allResults]),
						});
					}
				};

				const results = await mapWithConcurrencyLimit(params.tasks, MAX_CONCURRENCY, async (t, index) => {
					const result = await runSingleAgent(
						ctx.cwd,
						dispatchDefaults,
						agents,
						t.agent,
						t.task,
						t.cwd,
						undefined,
						signal,
						// Per-task update callback
						(partial) => {
							if (partial.details?.results[0]) {
								allResults[index] = partial.details.results[0];
								emitParallelUpdate();
							}
						},
						makeDetails("parallel"),
						t.readOnly ? "read" : "write",
					);
					allResults[index] = result;
					emitParallelUpdate();
					return result;
				});

				const successCount = results.filter((r) => !isFailedResult(r)).length;
				const summaries = results.map((r) => {
					const output = getResultOutput(r);
					const status = isIncompleteStop(r) ? incompleteLabel(r.stopReason) : isFailedResult(r)
						? `failed${r.stopReason && r.stopReason !== "end" ? ` (${r.stopReason})` : ""}`
						: "completed";
					return `### [${r.agent}] ${status}\n\n${output}`;
				});
				return {
					content: [
						{
							type: "text",
							text: `Parallel: ${successCount}/${results.length} succeeded\n\n${summaries.join("\n\n---\n\n")}`,
						},
					],
					details: makeDetails("parallel")(results),
                    isError: successCount < results.length,
				};
			}

			if (params.agent && params.task) {
				const result = await runSingleAgent(
					ctx.cwd,
					dispatchDefaults,
					agents,
					params.agent,
					params.task,
					params.cwd,
					undefined,
					signal,
					onUpdate,
					makeDetails("single"),
					params.readOnly ? "read" : "write",
				);
				const isError = isFailedResult(result);
				if (isError) {
					const errorMsg = getResultOutput(result);
					return {
						content: [{ type: "text", text: `Agent ${isIncompleteStop(result) ? incompleteLabel(result.stopReason) : result.stopReason || "failed"}: ${errorMsg}` }],
						details: makeDetails("single")([result]),
						isError: true,
					};
				}
				return {
					content: [{ type: "text", text: getFinalOutput(result.messages) || "(no output)" }],
					details: makeDetails("single")([result]),
				};
			}

			const available = agents.map((a) => `${a.name} (${a.source})`).join(", ") || "none";
			return {
				content: [{ type: "text", text: `Invalid parameters. Available agents: ${available}` }],
				details: makeDetails("single")([]),
			};
		},

        renderShell: "self",
        renderCall(args, theme) {
            if (args.background !== false) return {invalidate() {}, render: () => []};
            const items = args.dag ?? args.chain ?? args.tasks ?? (args.agent ? [{agent: args.agent}] : []);
            const mode = args.dag ? "dag" : args.chain ? "chain" : args.tasks ? "parallel" : "single";
            const names = items.map(item => item.agent).join(", ").replace(/[\r\n\x1b]/g, " ").slice(0, 160);
            return monitor.compact(theme.fg("toolTitle", `subagent · ${mode} · ${names}`));
        },
        renderResult(result, {isPartial, expanded}, theme) {
            if ((result.details as any)?.background) return expanded
                ? monitor.compact(theme.fg("muted", "Launched background job " + (result.details as any).jobId))
                : {invalidate() {}, render: () => []};
            const results = result.details?.results ?? [];
            const failed = results.filter(r => r.exitCode !== -1 && isFailedResult(r)).length;
            const done = results.filter(r => r.exitCode === 0 && !isFailedResult(r)).length;
            const status = isPartial ? `Working · ${done} done · ${failed} failed` : result.isError || failed ? `Finished with errors · ${failed} failed` : `Finished · ${done} done`;
            const names = results.map(r => r.agent).join(", ").replace(/[\r\n\x1b]/g, " ").slice(0, 120);
            const hint = results.length ? "Click to inspect · /subagent" : (result.content.find(c => c.type === "text")?.text ?? "No workers launched").replace(/\s+/g, " ").slice(0, 180);
            return monitor.compact(theme.fg(failed || result.isError ? "error" : "muted", `${status} · ${names}`) + "\n" + hint, results[0]?.workerId);
        },
    };
    pi.registerTool(subagentTool);
    pi.registerTool({
        name: "subagent_control", label: "Subagent control",
        description: "Manage existing background jobs. list returns job/worker IDs and current activity. steer sends a new instruction to an active worker at its next tool boundary; use its unique worker ID when a job has multiple workers. pause enforces a hold after the current tool/model call; resume continues the same worker. Pause a job to hold all active workers and later chain steps. A steering message alone is model advice, not an enforced stop. cancel stops a worker or job. result retrieves a finished job. Completions arrive automatically, so do not busy-poll. Never restart or duplicate a running worker just to steer it. decisions lists worker decision requests; answer or decline a requestId only with its traceable basis or reason. Answers never resume a paused job; steer never answers a decision.",
        parameters: Type.Object({action: StringEnum(["list", "steer", "pause", "resume", "cancel", "result", "decisions", "answer", "decline"] as const), target: Type.Optional(Type.String({description: "Job ID bg-N, full worker ID, #N, or decision requestId dec-…"})), message: Type.Optional(Type.String()), answer: Type.Optional(Type.String({description: "Freeform answer text (action answer)"})), basis: Type.Optional(StringEnum(["user_answer", "existing_authorization"] as const)), reference: Type.Optional(Type.String({description: "Traceable source of the answer or authorization"})), reason: Type.Optional(Type.String({description: "Why the request is declined (action decline)"}))}),
        async execute(_id, params) {
            try {
                if (params.action === "list") return {content: [{type: "text", text: JSON.stringify(runtime.list())}]};
                if (params.action === "decisions") return {content: [{type: "text", text: JSON.stringify(decisions.list())}]};
                if (!params.target) throw new Error("target is required");
                if (params.action === "answer" || params.action === "decline") return {content: [{type: "text", text: await runtime.answerDecision(params.target, params.action === "answer" ? {kind: "answer", answer: params.answer, basis: params.basis, reference: params.reference} : {kind: "decline", reason: params.reason})}]};
                if (params.action === "result") return runtime.result(params.target);
                if (params.action === "steer" && !params.message?.trim()) throw new Error("A nonempty steering message is required");
                const text = params.action === "steer" ? await runtime.steer(params.target, params.message!) : params.action === "pause" || params.action === "resume" ? runtime.pause(params.target, params.action === "pause") : runtime.cancel(params.target);
                return {content: [{type: "text", text}]};
            } catch (error) { return {isError: true, content: [{type: "text", text: String(error)}]}; }
        },
    });
    monitor.control = async (args, ctx) => {
        const match = args.trim().match(/^(steer|pause|resume|stop|cancel|list|result)(?:\s+(\S+))?(?:\s+([\s\S]+))?$/);
        if (!match) { ctx.ui.notify("Use /subagent steer #N message, pause bg-N, resume bg-N, stop bg-N, list, result bg-N, or /subagent to inspect", "warning"); return; }
        // Command operations use the same runtime without a model request.
        try {
            const [, action, target, message] = match;
            if (action === "list") ctx.ui.notify(JSON.stringify(runtime.list()), "info");
            else if (!target) throw new Error("A worker or job ID is required");
            else if (action === "steer") { if (!message?.trim()) throw new Error("A message is required"); ctx.ui.notify(await runtime.steer(target, message), "info"); }
            else if (action === "result") ctx.ui.notify(JSON.stringify(runtime.result(target)).slice(0, 800), "info");
            else if (action === "pause" || action === "resume") ctx.ui.notify(runtime.pause(target, action === "pause"), "info");
            else ctx.ui.notify(runtime.cancel(target), "info");
        } catch (error) { ctx.ui.notify(String(error), "error"); }
    };
}
