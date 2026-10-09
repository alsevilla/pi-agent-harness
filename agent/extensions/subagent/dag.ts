// Pure DAG scheduler: validates the graph, then runs ready nodes through an injected runner.
// Imports nothing: agent registry, runner, acceptance and report extraction come from the adapter.
// Parent reports are built by concatenation, never String.replace, so $-patterns and {previous} stay literal.

export const DAG_NODE_LIMIT = 8;
const NODE_ID = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/;
// Unknown keys are refused so a misspelled field (e.g. dependson) cannot silently drop an edge.
const NODE_KEYS = new Set(["id", "agent", "task", "cwd", "readOnly", "dependsOn"]);

export interface DagAgentRegistry {
	has(name: string): boolean;
}
export interface DagNodeSpec {
	readonly id: string;
	readonly agent: string;
	readonly task: string;
	readonly cwd?: string;
	readonly readOnly?: boolean; // trusted main-supplied declaration, passed through and never inferred
	readonly dependsOn: readonly string[];
}
export interface DagParentReport {
	nodeId: string;
	agent: string;
	report: string;
}
export type DagStatus = "accepted" | "failed" | "error" | "blocked" | "aborted";
export interface DagNodeRow<R> {
	nodeId: string;
	status: DagStatus;
	result?: R; // the runner's result, kept whole for every non-blocked outcome
	blockedBy?: string[]; // direct parents that were not accepted
	cause?: unknown; // exact thrown value for error rows
}
export interface DagRunOptions<R> {
	agents: DagAgentRegistry;
	concurrency: number; // caller-supplied bound; the adapter passes its existing MAX_CONCURRENCY
	accept: (result: R) => boolean; // acceptance predicate: a launch receipt or exit code alone is not acceptance
	report: (result: R) => string; // lossless text of an accepted result
	run: (node: DagNodeSpec, parents: DagParentReport[], signal: AbortSignal) => R | Promise<R>;
	signal?: AbortSignal;
	onSettle?: (row: DagNodeRow<R>) => void;
}

export class DagValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DagValidationError";
	}
}

function fail(message: string): never {
	throw new DagValidationError(message);
}

// Synchronous and launch-free: every rule is checked before the scheduler calls any runner.
export function validateDag(input: unknown, agents: DagAgentRegistry): DagNodeSpec[] {
	if (!Array.isArray(input)) fail("dag nodes must be an array");
	if (input.length === 0) fail("dag must contain at least one node");
	if (input.length > DAG_NODE_LIMIT) fail(`dag has ${input.length} nodes; the limit is ${DAG_NODE_LIMIT}`);
	const seen = new Set<string>();
	const nodes: DagNodeSpec[] = input.map((raw, index) => {
		if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail(`dag node ${index} must be an object`);
		const n = raw as Record<string, unknown>;
		for (const key of Object.keys(n)) if (!NODE_KEYS.has(key)) fail(`dag node ${index} has unknown key "${key}"`);
		if (typeof n.id !== "string" || !NODE_ID.test(n.id)) fail(`dag node ${index} has an invalid id`);
		const id = n.id;
		if (seen.has(id)) fail(`duplicate dag node id "${id}"`);
		seen.add(id);
		if (typeof n.agent !== "string" || n.agent.trim() === "") fail(`dag node "${id}" needs an agent`);
		if (!agents.has(n.agent)) fail(`dag node "${id}" uses unknown agent "${n.agent}"`);
		if (typeof n.task !== "string" || n.task.trim() === "") fail(`dag node "${id}" needs a non-empty task`);
		if (n.cwd !== undefined && (typeof n.cwd !== "string" || n.cwd.trim() === "")) fail(`dag node "${id}" has an invalid cwd`);
		if (n.readOnly !== undefined && typeof n.readOnly !== "boolean") fail(`dag node "${id}" has an invalid readOnly flag`);
		const deps = n.dependsOn === undefined ? [] : n.dependsOn;
		if (!Array.isArray(deps) || deps.some((dep) => typeof dep !== "string")) fail(`dag node "${id}" dependsOn must be an array of node ids`);
		return {
			id,
			agent: n.agent,
			task: n.task,
			...(n.cwd !== undefined ? { cwd: n.cwd as string } : {}),
			...(n.readOnly !== undefined ? { readOnly: n.readOnly as boolean } : {}),
			dependsOn: [...(deps as string[])],
		};
	});
	const ids = new Set(nodes.map((node) => node.id));
	for (const node of nodes) {
		const parents = new Set<string>();
		for (const dep of node.dependsOn) {
			if (dep === node.id) fail(`dag node "${node.id}" cannot depend on itself`);
			if (!ids.has(dep)) fail(`dag node "${node.id}" depends on missing node "${dep}"`);
			if (parents.has(dep)) fail(`dag node "${node.id}" lists parent "${dep}" more than once`);
			parents.add(dep);
		}
	}
	// Kahn's algorithm: nodes left unprocessed sit on a cycle.
	const pending = new Map(nodes.map((node) => [node.id, node.dependsOn.length]));
	const ready = nodes.filter((node) => node.dependsOn.length === 0).map((node) => node.id);
	let processed = 0;
	while (ready.length > 0) {
		const id = ready.shift()!;
		processed++;
		for (const node of nodes) {
			if (!node.dependsOn.includes(id)) continue;
			const left = pending.get(node.id)! - 1;
			pending.set(node.id, left);
			if (left === 0) ready.push(node.id);
		}
	}
	if (processed !== nodes.length) fail("dag contains a dependency cycle");
	return nodes;
}

// Runs ready roots and dependents within the supplied bound; each node launches at most once.
// Rejects before any runner call when the graph or options are invalid. Rows follow input order.
export async function runDag<R>(input: unknown, options: DagRunOptions<R>): Promise<DagNodeRow<R>[]> {
	const nodes = validateDag(input, options.agents);
	const limit = options.concurrency;
	if (!Number.isInteger(limit) || limit < 1) fail("dag concurrency must be a positive integer");
	const byId = new Map(nodes.map((node) => [node.id, node]));
	const rows = new Map<string, DagNodeRow<R>>();
	const started = new Set<string>();
	const controllers = new Map<string, AbortController>();
	const inflight = new Set<Promise<void>>();
	let aborted = false;

	const settle = (row: DagNodeRow<R>): void => {
		rows.set(row.nodeId, row);
		try {
			options.onSettle?.(row);
		} catch {
			// an observer failure must not strand the scheduler
		}
	};
	// A non-accepted parent blocks every transitive descendant that has not settled.
	const propagate = (): void => {
		for (let changed = true; changed; ) {
			changed = false;
			for (const node of nodes) {
				if (rows.has(node.id)) continue;
				const blockedBy = node.dependsOn.filter((dep) => rows.has(dep) && rows.get(dep)!.status !== "accepted");
				if (blockedBy.length === 0) continue;
				settle({ nodeId: node.id, status: "blocked", blockedBy });
				changed = true;
			}
		}
	};
	const finishResult = (id: string, result: R): void => {
		let accepted: boolean;
		try {
			accepted = options.accept(result);
		} catch (cause) {
			settle({ nodeId: id, status: "error", result, cause });
			return;
		}
		settle(accepted ? { nodeId: id, status: "accepted", result } : { nodeId: id, status: aborted ? "aborted" : "failed", result });
	};
	const launch = (node: DagNodeSpec): void => {
		started.add(node.id);
		let parents: DagParentReport[];
		try {
			parents = node.dependsOn.map((dep) => ({ nodeId: dep, agent: byId.get(dep)!.agent, report: options.report(rows.get(dep)!.result as R) }));
		} catch (cause) {
			settle({ nodeId: node.id, status: "error", cause });
			propagate();
			return;
		}
		const controller = new AbortController();
		controllers.set(node.id, controller);
		const task: Promise<void> = (async () => {
			let result: R;
			try {
				result = await options.run(node, parents, controller.signal);
			} catch (cause) {
				settle({ nodeId: node.id, status: aborted ? "aborted" : "error", cause });
				return;
			}
			finishResult(node.id, result);
		})().then(() => {
			controllers.delete(node.id);
			inflight.delete(task);
			propagate();
		});
		inflight.add(task);
	};
	const launchReady = (): void => {
		for (const node of nodes) {
			if (aborted || inflight.size >= limit) return;
			if (started.has(node.id) || rows.has(node.id)) continue;
			if (node.dependsOn.every((dep) => rows.get(dep)?.status === "accepted")) launch(node);
		}
	};
	// Signal abort: no new launches, started children receive abort, pending nodes become aborted.
	const onAbort = (): void => {
		if (aborted) return;
		aborted = true;
		for (const controller of controllers.values()) controller.abort();
		for (const node of nodes) {
			if (!rows.has(node.id) && !started.has(node.id)) settle({ nodeId: node.id, status: "aborted" });
		}
	};

	if (options.signal?.aborted) onAbort();
	options.signal?.addEventListener("abort", onAbort, { once: true });
	try {
		for (;;) {
			launchReady();
			if (inflight.size === 0) break;
			await Promise.race(inflight); // waits for the next settle; started runners always settle before return
		}
	} finally {
		options.signal?.removeEventListener("abort", onAbort);
	}
	return nodes.map((node) => rows.get(node.id) ?? { nodeId: node.id, status: "aborted" });
}

// Appends each direct parent's report under its node ID and agent; concatenation keeps every character literal.
export function appendParentReports(task: string, parents: readonly DagParentReport[]): string {
	let text = task;
	for (const parent of parents) {
		text += `\n\n--- Report from parent node "${parent.nodeId}" (agent: ${parent.agent}) ---\n${parent.report}`;
	}
	return text;
}
