// Test doubles for the pi runtime surface touched by subagent/index.ts and agents.ts.
// Loaded only through the resolve hook in tests/fallback-runtime.node.ts; never shipped at runtime.
import { EventEmitter } from "node:events";
import * as os from "node:os";
import * as path from "node:path";

// Scripted child process over the RPC transport: the task arrives as a stdin "prompt" line; the plan is chosen from that prompt, which is then acknowledged and played.
// globalThis.__piSubagentFakeSpawn(args, task) returns { events, exitCode, hang, afterSpawn }.
export function spawn(_command, args) {
	const child = new EventEmitter();
	child.stdout = new EventEmitter();
	child.stderr = new EventEmitter();
	child.exitCode = null;
	child.signalCode = null;
	let closed = false;
	const close = (code) => {
		if (closed) return;
		closed = true;
		child.exitCode = code;
		child.emit("close", code);
	};
	child.kill = () => {
		child.signalCode = "SIGTERM";
		queueMicrotask(() => close(null));
	};
	const stdin = new EventEmitter();
	stdin.writable = true;
	stdin.end = () => {};
	stdin.write = (chunk, callback) => {
		for (const line of String(chunk).split("\n")) {
			if (!line.trim()) continue;
			const message = JSON.parse(line);
			if (message.type !== "prompt") continue;
			const plan = globalThis.__piSubagentFakeSpawn(args, message.message);
			queueMicrotask(() => {
				child.stdout.emit("data", JSON.stringify({ type: "response", id: message.id, success: true, data: { disposition: "started" } }) + "\n");
				for (const event of plan.events ?? []) child.stdout.emit("data", JSON.stringify(event) + "\n");
				if (plan.stderr) child.stderr.emit("data", plan.stderr);
				plan.afterSpawn?.();
				if (!plan.hang) close(plan.exitCode ?? 0);
			});
		}
		callback?.(null);
		return true;
	};
	child.stdin = stdin;
	queueMicrotask(() => child.emit("spawn"));
	return child;
}

// @earendil-works/pi-coding-agent surface used by agents.ts and index.ts.
export const CONFIG_DIR_NAME = ".pi";
export function getAgentDir() {
	return process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), ".pi", "agent");
}
export function withFileMutationQueue(_file, fn) {
	return fn();
}
// Simplified YAML: flat `key: value` lines with optional matching quotes. Fixtures use nothing more.
export function parseFrontmatter(content) {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
	if (!match) return { frontmatter: {}, body: content };
	const frontmatter = {};
	for (const line of match[1].split(/\r?\n/)) {
		const colon = line.indexOf(":");
		if (colon <= 0) continue;
		frontmatter[line.slice(0, colon).trim()] = line.slice(colon + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
	}
	return { frontmatter, body: content.slice(match[0].length) };
}

// Unrelated extension imports, reached only from index.ts.
export class BackgroundWorkers {}
export class RpcWorker {}
export class WorkerMonitor {}
export function configureCodeIntegrations() {
	return false;
}
export const CODE_NAVIGATION_GUIDANCE = "";
export function graphReferenceGuidance() {
	return "";
}
export function cargoEnvDefaults() {
	return {};
}
export function StringEnum() {
	return {};
}
export const Type = new Proxy({}, { get: () => () => ({}) });
