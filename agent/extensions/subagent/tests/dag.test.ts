import assert from "node:assert/strict";
import test from "node:test";
import {
	DAG_NODE_LIMIT,
	DagValidationError,
	appendParentReports,
	runDag,
	type DagNodeRow,
	type DagNodeSpec,
	type DagParentReport,
	type DagRunOptions,
} from "../dag.ts";

type Result = { text: string; ok: boolean; errorMessage?: string; stderr?: string };
const AGENTS = new Set(["scout", "worker"]);
const ok = (text: string): Result => ({ text, ok: true });
const failed = (text: string): Result => ({ text, ok: false, errorMessage: `${text} failed`, stderr: "diag" });
const flush = () => new Promise<void>((resolve) => setImmediate(resolve)); // drains microtasks; no timing assumption
const spec = (id: string, dependsOn?: string[]) => ({ id, agent: "worker", task: `task ${id}`, ...(dependsOn ? { dependsOn } : {}) });
const byId = (rows: DagNodeRow<Result>[]) => Object.fromEntries(rows.map((row) => [row.nodeId, row])) as Record<string, DagNodeRow<Result>>;

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => { resolve = done; });
	return { promise, resolve };
}

// Records each launch and tracks simultaneous runner calls; behave may throw or return a promise.
function recorder(behave: (id: string, parents: DagParentReport[], signal: AbortSignal) => Result | Promise<Result>) {
	const launches: string[] = [];
	let inFlight = 0;
	let maxInFlight = 0;
	const run = async (node: DagNodeSpec, parents: DagParentReport[], signal: AbortSignal) => {
		launches.push(node.id);
		inFlight++;
		maxInFlight = Math.max(maxInFlight, inFlight);
		try {
			return await behave(node.id, parents, signal);
		} finally {
			inFlight--;
		}
	};
	return { run, launches, get maxInFlight() { return maxInFlight; } };
}

function options(run: DagRunOptions<Result>["run"], extra: Partial<DagRunOptions<Result>> = {}): DagRunOptions<Result> {
	return { agents: AGENTS, concurrency: 4, accept: (result) => result.ok, report: (result) => result.text, run, ...extra };
}

const INVALID_GRAPHS: [string, unknown][] = [
	["non-array input", { id: "a" }],
	["empty graph", []],
	["oversize graph", Array.from({ length: DAG_NODE_LIMIT + 1 }, (_, i) => spec(`n${i}`))],
	["non-object node", ["a"]],
	["empty id", [spec("")]],
	["leading-digit id", [spec("1a")]],
	["space in id", [spec("a b")]],
	["non-string id", [{ ...spec("a"), id: 7 }]],
	["duplicate id", [spec("a"), spec("a")]],
	["unknown agent", [{ ...spec("a"), agent: "ghost" }]],
	["blank agent", [{ ...spec("a"), agent: "  " }]],
	["blank task", [{ ...spec("a"), task: "   " }]],
	["non-string task", [{ ...spec("a"), task: 3 }]],
	["blank cwd", [{ ...spec("a"), cwd: " " }]],
	["non-boolean readOnly", [{ ...spec("a"), readOnly: "yes" }]],
	["missing dependency", [spec("a", ["zz"])]],
	["self dependency", [spec("a", ["a"])]],
	["duplicate parent", [spec("a"), spec("b", ["a", "a"])]],
	["non-array dependsOn", [{ ...spec("a"), dependsOn: "a" }]],
	["explicit null dependsOn", [{ ...spec("a"), dependsOn: null }]],
	["unknown node key (typo of dependsOn)", [{ ...spec("a"), dependson: [] }]],
	["unknown node key", [{ ...spec("a"), extra: true }]],
	["two-node cycle", [spec("a", ["b"]), spec("b", ["a"])]],
	["three-node cycle", [spec("a", ["c"]), spec("b", ["a"]), spec("c", ["b"])]],
];

for (const [name, input] of INVALID_GRAPHS) {
	test(`rejects ${name} before any runner call`, async () => {
		const run = recorder((id) => ok(id));
		await assert.rejects(runDag(input, options(run.run)), DagValidationError);
		assert.deepEqual(run.launches, []);
	});
}

test("rejects invalid concurrency before any runner call", async () => {
	for (const concurrency of [0, 1.5, Number.NaN]) {
		const run = recorder((id) => ok(id));
		await assert.rejects(runDag([spec("a")], options(run.run, { concurrency })), DagValidationError);
		assert.deepEqual(run.launches, []);
	}
});

test("accepts the eight-node boundary and launches every independent root once", async () => {
	const nodes = Array.from({ length: DAG_NODE_LIMIT }, (_, i) => spec(`n${i}`));
	const run = recorder((id) => ok(id));
	const rows = await runDag(nodes, options(run.run, { concurrency: DAG_NODE_LIMIT }));
	assert.equal(run.maxInFlight, DAG_NODE_LIMIT);
	assert.deepEqual(run.launches.slice().sort(), nodes.map((node) => node.id).sort());
	assert.deepEqual(rows.map((row) => row.status), nodes.map(() => "accepted"));
});

test("diamond waits for both parents and launches the join exactly once in declared order", async () => {
	const b = deferred<Result>();
	const c = deferred<Result>();
	let joinParents: DagParentReport[] = [];
	const run = recorder((id, parents) => {
		if (id === "d") joinParents = parents;
		if (id === "b") return b.promise;
		if (id === "c") return c.promise;
		return ok(id);
	});
	const done = runDag([spec("a"), spec("b", ["a"]), spec("c", ["a"]), spec("d", ["b", "c"])], options(run.run));
	await flush();
	assert.deepEqual(run.launches, ["a", "b", "c"]);
	b.resolve(ok("B-report"));
	await flush();
	assert.deepEqual(run.launches, ["a", "b", "c"]);
	c.resolve(ok("C-report"));
	const rows = await done;
	assert.deepEqual(run.launches, ["a", "b", "c", "d"]);
	assert.deepEqual(joinParents, [
		{ nodeId: "b", agent: "worker", report: "B-report" },
		{ nodeId: "c", agent: "worker", report: "C-report" },
	]);
	assert.deepEqual(rows.map((row) => [row.nodeId, row.status]), [["a", "accepted"], ["b", "accepted"], ["c", "accepted"], ["d", "accepted"]]);
});

test("independent roots overlap before either finishes", async () => {
	const x = deferred<Result>();
	const y = deferred<Result>();
	const run = recorder((id) => (id === "x" ? x.promise : y.promise));
	const done = runDag([spec("x"), spec("y")], options(run.run));
	await flush();
	assert.deepEqual(run.launches, ["x", "y"]);
	assert.equal(run.maxInFlight, 2);
	x.resolve(ok("x"));
	y.resolve(ok("y"));
	assert.equal((await done).length, 2);
});

test("ready roots never exceed the supplied concurrency bound", async () => {
	const gates = new Map(["a", "b", "c"].map((id) => [id, deferred<Result>()]));
	const run = recorder((id) => gates.get(id)!.promise);
	const done = runDag([spec("a"), spec("b"), spec("c")], options(run.run, { concurrency: 2 }));
	await flush();
	assert.deepEqual(run.launches, ["a", "b"]);
	gates.get("a")!.resolve(ok("a"));
	await flush();
	assert.deepEqual(run.launches, ["a", "b", "c"]);
	gates.get("b")!.resolve(ok("b"));
	gates.get("c")!.resolve(ok("c"));
	await done;
	assert.equal(run.maxInFlight, 2);
});

test("failed parent blocks transitive descendants while the independent branch continues", async () => {
	const run = recorder((id) => (id === "a" ? failed("a") : ok(id)));
	const rows = byId(await runDag([spec("a"), spec("b", ["a"]), spec("c", ["b"]), spec("x")], options(run.run)));
	assert.deepEqual(run.launches, ["a", "x"]);
	assert.equal(rows.a.status, "failed");
	assert.equal(rows.a.result?.errorMessage, "a failed"); // non-accepted result kept intact
	assert.equal(rows.a.result?.stderr, "diag");
	assert.deepEqual(rows.b, { nodeId: "b", status: "blocked", blockedBy: ["a"] });
	assert.deepEqual(rows.c, { nodeId: "c", status: "blocked", blockedBy: ["b"] });
	assert.equal(rows.x.status, "accepted");
});

test("synchronous and asynchronous runner throws become error rows and block descendants", async () => {
	const syncErr = new Error("sync boom");
	const asyncErr = new Error("async boom");
	const launches: string[] = [];
	const run = (node: DagNodeSpec) => {
		launches.push(node.id);
		if (node.id === "s") throw syncErr;
		if (node.id === "t") return Promise.reject(asyncErr);
		return ok(node.id);
	};
	const rows = byId(await runDag([spec("s"), spec("t"), spec("s2", ["s"]), spec("t2", ["t"]), spec("z")], options(run)));
	assert.deepEqual(rows.s, { nodeId: "s", status: "error", cause: syncErr });
	assert.deepEqual(rows.t, { nodeId: "t", status: "error", cause: asyncErr });
	assert.deepEqual(rows.s2, { nodeId: "s2", status: "blocked", blockedBy: ["s"] });
	assert.deepEqual(rows.t2, { nodeId: "t2", status: "blocked", blockedBy: ["t"] });
	assert.equal(rows.z.status, "accepted");
	assert.deepEqual(launches, ["s", "t", "z"]);
});

test("acceptance predicate throw is an error row that keeps the runner result and blocks descendants", async () => {
	const acceptErr = new Error("accept boom");
	const run = recorder((id) => ok(id === "a" ? "bad" : id));
	const rows = byId(await runDag([spec("a"), spec("b", ["a"]), spec("x")], options(run.run, {
		accept: (result: Result) => { if (result.text === "bad") throw acceptErr; return result.ok; },
	})));
	assert.equal(rows.a.status, "error");
	assert.equal(rows.a.cause, acceptErr);
	assert.deepEqual(rows.a.result, ok("bad"));
	assert.deepEqual(rows.b, { nodeId: "b", status: "blocked", blockedBy: ["a"] });
	assert.deepEqual(run.launches, ["a", "x"]);
});

test("report extraction failure is an error row and the child never launches", async () => {
	const reportErr = new Error("report boom");
	const run = recorder((id) => ok(id));
	const rows = byId(await runDag([spec("a"), spec("b", ["a"])], options(run.run, {
		report: (result: Result) => { if (result.text === "a") throw reportErr; return result.text; },
	})));
	assert.equal(rows.a.status, "accepted");
	assert.deepEqual(rows.b, { nodeId: "b", status: "error", cause: reportErr });
	assert.deepEqual(run.launches, ["a"]);
});

test("abort signals started children, aborts pending nodes, and waits for the started runner to settle", async () => {
	const controller = new AbortController();
	const gate = deferred<void>();
	let observedAbort = false;
	let finished = false;
	const run = recorder(async (id, _parents, signal) => {
		if (id !== "a") return ok(id);
		signal.addEventListener("abort", () => { observedAbort = true; }, { once: true });
		await gate.promise; // ignores abort until released
		return failed("a");
	});
	const done = runDag([spec("a"), spec("c"), spec("d", ["a"])], options(run.run, { concurrency: 1, signal: controller.signal }))
		.then((rows) => { finished = true; return rows; });
	await flush();
	assert.deepEqual(run.launches, ["a"]);
	controller.abort();
	await flush();
	assert.equal(observedAbort, true);
	assert.equal(finished, false, "runDag must not resolve while a started child is alive");
	gate.resolve();
	const rows = byId(await done);
	assert.deepEqual(run.launches, ["a"]);
	assert.deepEqual([rows.a.status, rows.c.status, rows.d.status], ["aborted", "aborted", "aborted"]);
});

test("an already-aborted signal launches nothing and marks every node aborted", async () => {
	const controller = new AbortController();
	controller.abort();
	const run = recorder((id) => ok(id));
	const rows = await runDag([spec("a"), spec("b", ["a"])], options(run.run, { signal: controller.signal }));
	assert.deepEqual(run.launches, []);
	assert.deepEqual(rows.map((row) => row.status), ["aborted", "aborted"]);
});

test("an observer failure is contained and every node still settles once", async () => {
	const seen: string[] = [];
	const run = recorder((id) => ok(id));
	const rows = await runDag([spec("a"), spec("b", ["a"])], options(run.run, {
		onSettle: (row) => { seen.push(row.nodeId); throw new Error("observer boom"); },
	}));
	assert.deepEqual(rows.map((row) => row.status), ["accepted", "accepted"]);
	assert.deepEqual(seen.sort(), ["a", "b"]);
	assert.deepEqual(run.launches, ["a", "b"]);
});

test("direct parent reports stay lossless and literal in declared dependency order", async () => {
	const literal = `cost $5 $& $$ $' $\` {previous} \\u0041 é\n${"x".repeat(200_000)}`;
	let joinParents: DagParentReport[] = [];
	const run = recorder((id, parents) => {
		if (id === "join") joinParents = parents;
		return ok(id === "a" ? literal : id === "b" ? "B:$&" : id);
	});
	const rows = byId(await runDag([spec("a"), spec("b"), spec("join", ["b", "a"])], options(run.run)));
	assert.deepEqual(joinParents, [
		{ nodeId: "b", agent: "worker", report: "B:$&" },
		{ nodeId: "a", agent: "worker", report: literal },
	]);
	assert.equal(rows.join.status, "accepted");
	const bound = appendParentReports("Join $& {previous} $$", joinParents);
	assert.ok(bound.startsWith("Join $& {previous} $$"));
	assert.ok(bound.includes('--- Report from parent node "b" (agent: worker) ---\nB:$&'));
	assert.ok(bound.endsWith(`--- Report from parent node "a" (agent: worker) ---\n${literal}`));
});

test("appendParentReports leaves a task without parents byte-identical", () => {
	assert.equal(appendParentReports("task $& {previous}", []), "task $& {previous}");
});
