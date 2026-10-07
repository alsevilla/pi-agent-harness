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
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
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
import { normalizeModelRef, shouldRetryWithFallback } from "./model-routing.ts";
import { configureCodeIntegrations, CODE_NAVIGATION_GUIDANCE, graphReferenceGuidance } from "./code-integrations.ts";

const MAX_PARALLEL_TASKS = 8;
const MAX_CONCURRENCY = 4;
const PER_TASK_OUTPUT_CAP = 50 * 1024;

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
	mode: "single" | "parallel" | "chain";
	agentScope: AgentScope;
	projectAgentsDir: string | null;
	results: SingleResult[];
}

function getFinalOutput(messages: Message[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role === "assistant") {
			for (const part of msg.content) {
				if (part.type === "text") return part.text;
			}
		}
	}
	return "";
}

function isFailedResult(result: SingleResult): boolean {
	return result.exitCode !== 0 || result.stopReason === "error" || result.stopReason === "aborted";
}

function getResultOutput(result: SingleResult): string {
	if (isFailedResult(result)) {
		return result.errorMessage || result.stderr || getFinalOutput(result.messages) || "(no output)";
	}
	return getFinalOutput(result.messages) || "(no output)";
}

function truncateParallelOutput(output: string): string {
	const byteLength = Buffer.byteLength(output, "utf8");
	if (byteLength <= PER_TASK_OUTPUT_CAP) return output;

	let truncated = output.slice(0, PER_TASK_OUTPUT_CAP);
	while (Buffer.byteLength(truncated, "utf8") > PER_TASK_OUTPUT_CAP) {
		truncated = truncated.slice(0, -1);
	}
	return `${truncated}\n\n[Output truncated: ${byteLength - Buffer.byteLength(truncated, "utf8")} bytes omitted. Full output preserved in tool details.]`;
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
    runtime?: BackgroundWorkers;
    jobId?: string;
	monitor?: WorkerMonitor;
	contextWindowFor?: (model: string) => number | undefined;
	model?: string;
	thinkingLevel?: ThinkingLevel;
}

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
	attemptModel?: string,
	fallbackAttempted = false,
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

	const args: string[] = ["--mode", dispatchDefaults.jobId ? "rpc" : "json", ...(dispatchDefaults.jobId ? [] : ["-p"]), "--no-session", "--no-extensions", "--no-mcp", "--no-skills", "--no-prompt-templates", "--offline"];
	const inheritsDispatchConfig = !agent.model;
	const model = attemptModel ?? agent.model ?? (dispatchDefaults.model ? normalizeModelRef(dispatchDefaults.model) : undefined);
	const workerController = new AbortController();
    const parentSignal = signal;
    const parentAbort = () => workerController.abort();
    parentSignal?.addEventListener("abort", parentAbort, {once: true});
    if (parentSignal?.aborted) workerController.abort();
    if (dispatchDefaults.jobId) signal = workerController.signal;
    let release: (() => void) | undefined;
    try { if (dispatchDefaults.jobId) { await dispatchDefaults.runtime?.waitRunnable(dispatchDefaults.jobId, signal); release = await dispatchDefaults.runtime?.acquire(signal); await dispatchDefaults.runtime?.waitRunnable(dispatchDefaults.jobId, signal); } }
    catch (error) { release?.(); parentSignal?.removeEventListener("abort", parentAbort); throw error; }
    const worker = dispatchDefaults.monitor?.store.begin(agentName, task, model ?? "inherited", (inheritsDispatchConfig ? dispatchDefaults.thinkingLevel : undefined) ?? agent.thinking ?? "provider default", model ? dispatchDefaults.contextWindowFor?.(model) : undefined);
    if (worker && dispatchDefaults.jobId) dispatchDefaults.runtime?.note(dispatchDefaults.jobId, worker.id);
    let codeIntegrationsEnabled = false;
    try {
	if (model) args.push("--model", model);
	if (model?.startsWith("anthropic/")) {
		const guardPath = path.join(getAgentDir(), "npm", "node_modules", "pi-claude-subscription-connector", "extensions", "subscription-guard.ts");
		if (!fs.existsSync(guardPath)) throw new Error("Claude subscription guard missing. Install npm:pi-claude-subscription-connector before launching an Anthropic subagent.");
		args.push("--extension", guardPath);
	}
	if (agent.thinking) args.push("--thinking", agent.thinking);
	if (inheritsDispatchConfig && dispatchDefaults.thinkingLevel) {
		args.push("--thinking", dispatchDefaults.thinkingLevel);
	}
	codeIntegrationsEnabled = configureCodeIntegrations(args, agent);

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
			const tmp = await writePromptToTempFile(agent.name, agent.systemPrompt + (codeIntegrationsEnabled ? CODE_NAVIGATION_GUIDANCE + graphReferenceGuidance(cwd ?? defaultCwd) : ""));
			tmpPromptDir = tmp.dir;
			tmpPromptPath = tmp.filePath;
			args.push("--append-system-prompt", tmpPromptPath);
		}

		if (dispatchDefaults.jobId) {
            controlDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-worker-control-"));
            controlPath = path.join(controlDir, "control.json");
            fs.writeFileSync(controlPath, "0");
            args.push("--extension", path.join(getAgentDir(), "extensions", "subagent", "pause-gate.ts"));
        }
        if (!dispatchDefaults.jobId) args.push(`Task: ${task}`);
		let wasAborted = false;

		let removeAbort = () => {};
        const exitCode = await new Promise<number>((resolve) => {
			const invocation = getPiInvocation(args);
			const proc = spawn(invocation.command, invocation.args, {
				cwd: cwd ?? defaultCwd,
                env: {...process.env, PI_SUBAGENT_CONTROL_FILE: controlPath ?? ""},
				shell: false,
				stdio: [dispatchDefaults.jobId ? "pipe" : "ignore", "pipe", "pipe"],
			});
			const client = dispatchDefaults.jobId ? new RpcWorker(proc, controlPath) : undefined;
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

			const processLine = (line: string) => {
				if (!line.trim()) return;
				let event: any;
				try {
					event = JSON.parse(line);
				} catch {
					return;
				}

				client?.event(event);
                if (client && event.type === "extension_ui_request" && ["select", "confirm", "input", "editor"].includes(event.method)) {
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
						if (msg.stopReason) currentResult.stopReason = msg.stopReason;
						if (msg.errorMessage) currentResult.errorMessage = msg.errorMessage;
					}
					emitUpdate();
				}

				if (event.type === "tool_result_end" && event.message) {
					currentResult.messages.push(event.message as Message);
					emitUpdate();
				}
			};

			proc.stdout.on("data", (data) => {
				buffer += data.toString();
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";
				for (const line of lines) processLine(line);
			});

			proc.stderr.on("data", (data) => {
				currentResult.stderr += data.toString();
			});

			proc.on("close", (code) => {
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
		if (
			!fallbackAttempted &&
			shouldRetryWithFallback(
				{
					...currentResult,
					output: getFinalOutput(currentResult.messages),
					toolActivity: currentResult.toolActivity || currentResult.messages.some(
						(message) => message.role === "toolResult" || (message.role === "assistant" && message.content.some((part) => part.type === "toolCall")),
					),
				},
				model,
				agent.fallbackModel,
				wasAborted,
			)
		) {
			const primaryError = currentResult.errorMessage || currentResult.stderr || getFinalOutput(currentResult.messages);
            const updates = worker ? dispatchDefaults.runtime?.steeringFor(worker.id) ?? [] : [];
			const fallbackResult = await runSingleAgent(
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
				agent.fallbackModel,
				true,
			);
			fallbackResult.stderr = `Primary model ${model ?? "(inherited)"} failed; retried with ${agent.fallbackModel}. ${primaryError}\n${fallbackResult.stderr}`;
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
});

const ChainItem = Type.Object({
	agent: Type.String({ description: "Name of the agent to invoke" }),
	task: Type.String({ description: "Task with optional {previous} placeholder for prior output" }),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
});

const AgentScopeSchema = StringEnum(["user", "project", "both"] as const, {
	description: 'Which agent directories to use. Default: "user". Use "both" to include project-local agents.',
	default: "user",
});

const SubagentParams = Type.Object({
    background: Type.Optional(Type.Boolean({description: "Default true: return a job ID immediately; completion arrives automatically. Set false to explicitly wait for the entire task.", default: true})),
	agent: Type.Optional(Type.String({ description: "Name of the agent to invoke (for single mode)" })),
	task: Type.Optional(Type.String({ description: "Task to delegate (for single mode)" })),
	tasks: Type.Optional(Type.Array(TaskItem, { description: "Array of {agent, task} for parallel execution" })),
	chain: Type.Optional(Type.Array(ChainItem, { description: "Array of {agent, task} for sequential execution" })),
	agentScope: Type.Optional(AgentScopeSchema),
	confirmProjectAgents: Type.Optional(
		Type.Boolean({ description: "Prompt before running project-local agents. Default: true.", default: true }),
	),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process (single mode)" })),
});

export default function (pi: ExtensionAPI) {
	const monitor = new WorkerMonitor(pi);
    const runtime = new BackgroundWorkers(pi, monitor);
    const subagentTool = {
		name: "subagent",
		label: "Subagent",
		description: [
			"Delegate tasks to specialized subagents with isolated context. Background by default: return a job ID and keep responding to the user. Use subagent_control to list, steer, cancel or retrieve results. Do not repeatedly poll; completions arrive automatically. Do not claim a job is finished until its result arrives.",
			"Available user roles: " + discoverAgents(process.cwd(), "user").agents.map(a => `${a.name}: ${a.description.split(".")[0]}`).join("; "),
			"Modes: single (agent + task), parallel (tasks array), chain (sequential with {previous} placeholder).",
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
			const modeCount = Number(hasChain) + Number(hasTasks) + Number(hasSingle);

			const makeDetails =
				(mode: "single" | "parallel" | "chain") =>
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
				};
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
                try { runtime.assertCanLaunch((params.chain ?? params.tasks ?? [{agent: params.agent!}]).map(t => t.agent)); }
                catch (error) { return {isError: true, content: [{type: "text", text: String(error)}]}; }
            }
            if (params.background !== false) {
                const requests = params.chain ?? params.tasks ?? [{agent: params.agent!, task: params.task!, cwd: params.cwd}];
                if (params.tasks && params.tasks.length > MAX_PARALLEL_TASKS) return {isError: true, content: [{type: "text", text: "Max parallel tasks is 8."}], details: makeDetails("parallel")([])};
                const unknown = requests.filter(t => !agents.some(a => a.name === t.agent)).map(t => t.agent);
                if (unknown.length) return {isError: true, content: [{type: "text", text: "Unknown agents: " + unknown.join(", ")}], details: makeDetails("single")([])};
                if (signal?.aborted) throw new Error("Dispatch was aborted");
                const job = runtime.start((jobSignal, jobId) => subagentTool.execute(_toolCallId, {...params, background: false, confirmProjectAgents: false}, jobSignal, undefined, {...ctx, subagentJobId: jobId} as any));
                return {content: [{type: "text", text: "Started background job " + job.id + ". Roles: " + requests.map(t => t.agent).join(", ") + ". This is a launch acknowledgement, not a completed task. Continue responding or doing independent work; completion will arrive automatically. Use subagent_control list to obtain worker IDs, steer to change direction, or cancel to stop."}], details: {...makeDetails(hasChain ? "chain" : hasTasks ? "parallel" : "single")([]), jobId: job.id, background: true}};
            }

			if (params.chain && params.chain.length > 0) {
				const results: SingleResult[] = [];
				let previousOutput = "";

				for (let i = 0; i < params.chain.length; i++) {
					const step = params.chain[i];
					const taskWithContext = step.task.replace(/\{previous\}/g, previousOutput);

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
					previousOutput = getFinalOutput(result.messages);
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
					);
					allResults[index] = result;
					emitParallelUpdate();
					return result;
				});

				const successCount = results.filter((r) => !isFailedResult(r)).length;
				const summaries = results.map((r) => {
					const output = truncateParallelOutput(getResultOutput(r));
					const status = isFailedResult(r)
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
				);
				const isError = isFailedResult(result);
				if (isError) {
					const errorMsg = getResultOutput(result);
					return {
						content: [{ type: "text", text: `Agent ${result.stopReason || "failed"}: ${errorMsg}` }],
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
            const items = args.chain ?? args.tasks ?? (args.agent ? [{agent: args.agent}] : []);
            const mode = args.chain ? "chain" : args.tasks ? "parallel" : "single";
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
        description: "Manage existing background jobs. list returns job/worker IDs and current activity. steer sends a new instruction to an active worker at its next tool boundary; use its unique worker ID when a job has multiple workers. pause enforces a hold after the current tool/model call; resume continues the same worker. Pause a job to hold all active workers and later chain steps. A steering message alone is model advice, not an enforced stop. cancel stops a worker or job. result retrieves a finished job. Completions arrive automatically, so do not busy-poll. Never restart or duplicate a running worker just to steer it.",
        parameters: Type.Object({action: StringEnum(["list", "steer", "pause", "resume", "cancel", "result"] as const), target: Type.Optional(Type.String({description: "Job ID bg-N, full worker ID, or #N"})), message: Type.Optional(Type.String())}),
        async execute(_id, params) {
            try {
                if (params.action === "list") return {content: [{type: "text", text: JSON.stringify(runtime.list())}]};
                if (!params.target) throw new Error("target is required");
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
