// Test doubles for the pi runtime surface touched by subagent/index.ts and agents.ts.
// Loaded only through the resolve hook in tests/fallback-runtime.node.ts; never shipped at runtime.
import { EventEmitter } from "node:events";
import * as os from "node:os";
import * as path from "node:path";

// Scripted child process: globalThis.__piSubagentFakeSpawn(args) returns { events, exitCode, hang, afterSpawn }.
export function spawn(_command, args) {
	const plan = globalThis.__piSubagentFakeSpawn(args);
	const child = new EventEmitter();
	child.stdout = new EventEmitter();
	child.stderr = new EventEmitter();
	child.stdin = null;
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
	queueMicrotask(() => {
		child.emit("spawn");
		for (const event of plan.events ?? []) child.stdout.emit("data", JSON.stringify(event) + "\n");
		plan.afterSpawn?.();
		if (!plan.hang) close(plan.exitCode ?? 0);
	});
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
