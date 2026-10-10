// D3a workspace-admission runtime regression (Node-only: registerHooks + native TS; named *.node.ts so Bun skips it).
// Real index.ts runSingleAgent and real background.ts BackgroundWorkers run every launch path; only the pi package, typebox/pi-ai,
// the provider-cooldown entry, the monitor and child_process are doubled. The child double is offline and test-controlled:
// nothing spawns a real Pi process or reaches a provider.
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import { registerHooks } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import test, { after, afterEach, before, beforeEach } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { AgentConfig } from "../agents.ts";
import { BackgroundWorkers } from "../background.ts";

const indexUrl = new URL("../index.ts", import.meta.url).href;
const doublesUrl = new URL("./fixtures/runtime-doubles.mjs", import.meta.url).href;
const dataUrl = (source: string) => "data:text/javascript," + encodeURIComponent(source);
// Offline RPC/JSON child: records every spawn; RPC prompts are acknowledged; exit and kill are driven by the test.
const childUrl = dataUrl(`import { EventEmitter } from "node:events";
export function spawn(_command, args, options) {
	const child = new EventEmitter();
	child.args = args; child.cwd = options.cwd; child.signals = []; child.exited = false; child.received = [];
	child.model = args.includes("--model") ? args[args.indexOf("--model") + 1] : "inherited";
	child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
	child.exitCode = null; child.signalCode = null;
	child.emitLine = (event) => child.stdout.emit("data", JSON.stringify(event) + "\\n");
	child.exit = (code) => { if (child.exited) return; child.exited = true; child.exitCode = code; child.emit("close", code); };
	child.kill = (signal = "SIGTERM") => { child.signals.push(signal); child.signalCode = signal; };
	child.stdin = options.stdio[0] === "pipe" ? { writable: true, on() {}, end() {}, write(chunk, callback) {
		const message = JSON.parse(String(chunk)); child.received.push(message);
		if (message.type === "prompt") child.emitLine({ type: "response", id: message.id, success: true });
		callback?.(null); return true;
	} } : null;
	queueMicrotask(() => child.emit("spawn"));
	globalThis.__piDagChildren.push(child);
	return child;
}`);
const stubMonitorUrl = dataUrl("export class WorkerMonitor { constructor() { this.store = { seq: 0, begin() { return { id: \"w\" + (++this.seq) }; }, started() {}, event() {}, finish() {}, records: new Map(), changed() {} }; } }");
// Launch-state stub for the provider cooldown entry: every declared model launches; this suite does not test cooldown.
const entryStubUrl = dataUrl("export default function providerCooldownEntry() {}\nexport function registerProviderCooldown() {}\nexport async function runProviderCooldownCommand() { return { message: '', type: 'info' }; }\nexport async function providerLaunchState() { return { state: 'launch' }; }\nexport async function guardRefusalReplayable() { return false; }");
const indexDependencies = new Set(["@earendil-works/pi-ai", "./code-integrations.ts", "./build-env.ts"]);
// Real installed SDK pieces for the tool-boundary check: index.ts builds its real TypeBox schema; validateToolArguments comes from the installed pi-ai.
const INSTALL_MODULES = "C:/Users/MSI/.pi/agent/install/releases/1.1.0/node_modules";
const typeboxUrl = pathToFileURL(`${INSTALL_MODULES}/typebox/build/index.mjs`).href;
const piAiUrl = pathToFileURL(`${INSTALL_MODULES}/@earendil-works/pi-ai/dist/index.js`).href;

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === "@earendil-works/pi-coding-agent") return { url: doublesUrl, shortCircuit: true };
		if (context.parentURL === indexUrl && specifier === "typebox") return { url: typeboxUrl, shortCircuit: true };
		if (context.parentURL === indexUrl) {
			if (specifier === "node:child_process") return { url: childUrl, shortCircuit: true };
			if (specifier === "./provider-cooldown-entry.ts") return { url: entryStubUrl, shortCircuit: true };
			if (specifier === "./monitor.ts") return { url: stubMonitorUrl, shortCircuit: true };
			if (indexDependencies.has(specifier)) return { url: doublesUrl, shortCircuit: true };
		}
		return nextResolve(specifier, context);
	},
	load(url, context, nextLoad) {
		if (url === indexUrl) {
			// index.ts keeps runSingleAgent private; expose it to this test only.
			const source = fs.readFileSync(fileURLToPath(url), "utf8");
			return { format: "module-typescript", source: `${source}\nexport { runSingleAgent };`, shortCircuit: true };
		}
		return nextLoad(url, context);
	},
});

interface Child {
	args: string[];
	cwd: string;
	model: string;
	signals: string[];
	exited: boolean;
	received: Array<{ type: string; id?: string; message?: string }>;
	emitLine(event: Record<string, unknown>): void;
	exit(code: number | null): void;
}
(globalThis as { __piDagChildren?: Child[] }).__piDagChildren = [];
const children = (): Child[] => (globalThis as { __piDagChildren: Child[] }).__piDagChildren;

const PRIMARY = "openai-codex/gpt-6.1-sol";
const LUNA = "openai-codex/gpt-6-luna";
const role = (name: string, extra: Partial<AgentConfig> = {}): AgentConfig => ({ name, description: name, systemPrompt: "", source: "user", filePath: "", ...extra });
const AGENTS: AgentConfig[] = [role("writer"), role("reader"), role("chain-fallback", { model: PRIMARY, fallbackModel: [LUNA] })];
const WAITING = "Waiting for workspace";

// Each test is bounded: a launch that never settles must fail the test instead of hanging the runner.
const check = (name: string, fn: () => Promise<void>) => test(name, { timeout: 8000 }, fn);

let runSingleAgent: any;
let subagentExtension: any;
const created: string[] = [];
const aliases: Array<{ dir: string; link: string }> = [];
const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), "dag-admission-user-"));

before(async () => {
	const mod = await import(indexUrl);
	runSingleAgent = mod.runSingleAgent;
	subagentExtension = mod.default;
	process.env.PI_CODING_AGENT_DIR = userDir;
	fs.mkdirSync(path.join(userDir, "agents"), { recursive: true });
	for (const name of ["writer", "reader"]) fs.writeFileSync(path.join(userDir, "agents", `${name}.md`), `---\nname: ${name}\ndescription: ${name}\n---\n`);
});

after(() => {
	if (originalAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
	else process.env.PI_CODING_AGENT_DIR = originalAgentDir;
	for (const alias of aliases) removeAlias(alias);
	for (const dir of [...created, userDir]) fs.rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
	children().length = 0;
});

// Release every live child so no claim outlives its test.
afterEach(async () => {
	for (const child of children()) if (!child.exited) child.exit(0);
	await settle(10);
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = (ms = 30) => sleep(ms);
async function waitFor(predicate: () => boolean, message: string) {
	for (let i = 0; i < 500 && !predicate(); i++) await sleep(4);
	assert.ok(predicate(), message);
}
// Exits every live child until the given launches settle; a claim releases only after its child's actual exit.
async function drain(launches: Array<Promise<unknown>>) {
	let settled = false;
	const all = Promise.allSettled(launches).then(() => (settled = true));
	for (let i = 0; i < 500 && !settled; i++) {
		for (const child of children()) if (!child.exited) child.exit(0);
		await sleep(5);
	}
	await all;
}

function makeRepo(label: string): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), `dag-admission-${label}-`));
	created.push(root);
	fs.mkdirSync(path.join(root, ".git")); // a .git directory marks the checkout root
	fs.mkdirSync(path.join(root, "sub"));
	return root;
}
// The junction lives outside the repo; cleanup removes only the link, never its target.
function makeAlias(target: string): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dag-admission-alias-"));
	const link = path.join(dir, "link");
	fs.symlinkSync(target, link, "junction");
	aliases.push({ dir, link });
	return link;
}
function removeAlias({ dir, link }: { dir: string; link: string }) {
	try { fs.rmdirSync(link); } catch { /* already gone */ }
	if (fs.existsSync(link)) return; // link still present: leave the directory untouched
	fs.rmSync(dir, { recursive: true, force: true });
}

function fakePi() {
	const tools = new Map<string, { execute: (...args: unknown[]) => Promise<any> }>();
	const sent: Array<{ content: string }> = [];
	return { tools, sent, on() {}, registerCommand() {}, registerTool(tool: { name: string }) { tools.set(tool.name, tool as never); }, sendMessage(message: { content: string }) { sent.push(message); return Promise.resolve(); } };
}
const makeRuntime = () => new BackgroundWorkers(fakePi() as never, { store: { records: new Map(), changed() {} } } as never);
const makeDetails = (results: unknown[]) => ({ results });

// Foreground launch through the shared runSingleAgent boundary (legacy single/parallel/chain path).
function foreground(cwd: string, name: string, options: { task?: string; access?: "read" | "write"; signal?: AbortSignal; onUpdate?: (partial: any) => void; runtime?: BackgroundWorkers } = {}): Promise<any> {
	return runSingleAgent(cwd, { runtime: options.runtime }, AGENTS, name, options.task ?? name, undefined, undefined, options.signal, options.onUpdate, makeDetails, options.access);
}
// Background job launch: the same boundary, with the job's id and abort signal.
function background(runtime: BackgroundWorkers, cwd: string, name: string, task: string, access?: "read" | "write") {
	return runtime.start((signal, jobId) => runSingleAgent(cwd, { runtime, jobId }, AGENTS, name, task, undefined, undefined, signal, undefined, makeDetails, access));
}

check("writers on one checkout are exclusive: the second foreground writer waits for the first child to exit", async () => {
	const repo = makeRepo("writer-exclusion");
	const launches = [foreground(repo, "writer", { task: "first" }), foreground(repo, "writer", { task: "second" })];
	await waitFor(() => children().length === 1, "first child spawns");
	await settle();
	assert.equal(children().length, 1, "second writer must not spawn while the first owns the checkout");
	children()[0].exit(0);
	await waitFor(() => children().length === 2, "second writer spawns after the first child exits");
	await drain(launches);
});

check("subdirectory and junction aliases share one writer queue; a separate worktree stays independent", async () => {
	const repo = makeRepo("alias");
	const worktree = makeRepo("worktree");
	const launches = [
		foreground(repo, "writer", { task: "root" }),
		foreground(path.join(repo, "sub"), "writer", { task: "sub" }),
		foreground(makeAlias(repo), "writer", { task: "junction" }),
		foreground(worktree, "writer", { task: "worktree" }),
	];
	await waitFor(() => children().length === 2, "root and separate worktree spawn");
	await settle();
	assert.deepEqual(children().map((c) => c.cwd), [repo, worktree]);
	children()[0].exit(0);
	await waitFor(() => children().length === 3, "subdirectory writer runs after the root writer");
	assert.equal(children()[2].cwd, path.join(repo, "sub"));
	children()[2].exit(0);
	await waitFor(() => children().length === 4, "junction writer runs after the subdirectory writer");
	await drain(launches);
});

check("read-only declarations overlap on one checkout; a queued writer waits and a later reader cannot jump it", async () => {
	const repo = makeRepo("readers");
	const launches = [foreground(repo, "reader", { access: "read", task: "r1" }), foreground(repo, "reader", { access: "read", task: "r2" })];
	await waitFor(() => children().length === 2, "read-only launches overlap");
	launches.push(foreground(repo, "writer", { task: "w" }));
	launches.push(foreground(repo, "reader", { access: "read", task: "r3" }));
	await settle();
	assert.equal(children().length, 2, "writer waits for active readers; later reader queues behind it");
	children()[0].exit(0);
	await settle();
	assert.equal(children().length, 2, "writer still waits for the second reader");
	children()[1].exit(0);
	await waitFor(() => children().length === 3, "queued writer runs next");
	assert.equal(children()[2].cwd, repo);
	children()[2].exit(0);
	await waitFor(() => children().length === 4, "the later reader runs after the writer");
	await drain(launches);
});

check("separate checkouts run in parallel; the shared cap counts only running children, not queued claims", async () => {
	const runtime = makeRuntime();
	const holder = makeRepo("cap-holder");
	const launches = [foreground(holder, "writer", { runtime, task: "A" }), foreground(holder, "writer", { runtime, task: "B" })];
	for (const label of ["cap-2", "cap-3", "cap-4"]) launches.push(foreground(makeRepo(label), "writer", { runtime }));
	launches.push(foreground(makeRepo("cap-5"), "writer", { runtime }));
	await waitFor(() => children().length === 4, "four distinct checkouts fill the shared cap");
	await settle();
	assert.equal(children().length, 4, "the fifth launch waits for capacity; queued B on the held checkout holds no slot");
	assert.equal(children()[0].cwd, holder);
	children()[0].exit(0);
	await waitFor(() => children().length === 5, "capacity freed by the holder admits the next launch");
	await drain(launches);
});

check("queued workspace abort spawns nothing; the next claim proceeds without the aborted launch", async () => {
	const repo = makeRepo("queued-abort");
	const controller = new AbortController();
	const holder = foreground(repo, "writer", { task: "A" }); // registers first: holds the claim
	const aborted = foreground(repo, "writer", { task: "B", signal: controller.signal }); // queued behind the holder
	const launches = [holder, aborted, foreground(repo, "writer", { task: "C" })];
	await waitFor(() => children().length === 1, "holder spawns");
	controller.abort();
	await assert.rejects(aborted, /Subagent was aborted/);
	children()[0].exit(0);
	await waitFor(() => children().length === 2, "the claim passes to C, not to the aborted B");
	assert.equal(children()[1].cwd, repo);
	await drain(launches);
	assert.equal(children().length, 2, "the aborted launch never spawned");
});

check("queued background job cancel removes its claim with zero spawns", async () => {
	const runtime = makeRuntime();
	const repo = makeRepo("queued-bg-cancel");
	const holder = foreground(repo, "writer", { runtime, task: "A" });
	await waitFor(() => children().length === 1, "holder spawns");
	const job = background(runtime, repo, "writer", "queued job");
	const next = foreground(repo, "writer", { runtime, task: "C" });
	await settle();
	runtime.cancel(job.id);
	await waitFor(() => runtime.jobs.get(job.id)?.state === "aborted", "queued job settles as aborted");
	children()[0].exit(0);
	await waitFor(() => children().length === 2, "the next claim proceeds after the cancelled job");
	await drain([holder, next]);
	assert.equal(children().length, 2, "the cancelled background job never spawned");
});

check("paused job keeps its workspace claim before spawn; resume starts exactly one child", async () => {
	const runtime = makeRuntime();
	const repo = makeRepo("pause");
	const job = background(runtime, repo, "writer", "paused job");
	runtime.pause(job.id);
	const queued = foreground(repo, "writer", { runtime, task: "queued" });
	await sleep(150);
	assert.equal(children().length, 0, "a paused job must not spawn");
	runtime.pause(job.id, false);
	await waitFor(() => children().length === 1, "resume starts the one child");
	await sleep(150);
	assert.equal(children().length, 1, "the queued writer keeps waiting behind the resumed child");
	children()[0].exit(0);
	await waitFor(() => children().length === 2, "the queued writer runs after the job's child exits");
	await drain([queued]);
	await waitFor(() => runtime.jobs.get(job.id)?.state !== "running", "the paused job settles");
	assert.equal(children().length, 2);
});

check("a job paused after its capacity grant releases the slot; an unrelated queued job takes it and the paused job waits", async () => {
	const runtime = makeRuntime();
	const pausedRepo = makeRepo("cap-paused");
	const unrelatedRepo = makeRepo("cap-unrelated");
	try {
		for (let i = 0; i < 4; i++) background(runtime, makeRepo("cap-holder-" + i), "writer", "h" + i);
		await waitFor(() => children().length === 4, "four holders occupy the shared cap");
		const paused = background(runtime, pausedRepo, "writer", "queued then paused");
		await settle();
		runtime.pause(paused.id);
		background(runtime, unrelatedRepo, "writer", "unrelated");
		await settle();
		children()[0].exit(0); // the freed slot is granted to the paused job first; it must hand it on
		await waitFor(() => children().length === 5, "the unrelated job takes the released capacity");
		assert.equal(children()[4].cwd, unrelatedRepo);
		await sleep(100);
		assert.equal(children().length, 5, "the paused job stays unspawned");
		runtime.pause(paused.id, false);
		children()[1].exit(0); // resume still needs a free slot: the paused job queues behind the held capacity
		await waitFor(() => children().some((child) => child.cwd === pausedRepo), "resume launches the paused job");
		assert.equal(children().filter((child) => child.cwd === pausedRepo).length, 1, "exactly one child for the paused job");
	} finally {
		// Release every paused loop and live child so no timer keeps the runner alive.
		for (const job of runtime.jobs.values()) if (job.paused) runtime.pause(job.id, false);
		for (let i = 0; i < 300 && [...runtime.jobs.values()].some((job) => job.state === "running"); i++) {
			for (const child of children()) if (!child.exited) child.exit(0);
			await sleep(10);
		}
	}
});

check("cancelling a running job waits for the child's actual exit before the claim is released", async () => {
	const runtime = makeRuntime();
	const repo = makeRepo("run-abort");
	const job = background(runtime, repo, "writer", "running job");
	await waitFor(() => children().length === 1, "job child spawns");
	const queued = foreground(repo, "writer", { task: "next" });
	runtime.cancel(job.id);
	await waitFor(() => children()[0].signals.includes("SIGTERM"), "cancel terminates the running child");
	await settle();
	assert.equal(children().length, 1, "the next writer waits until the aborted child actually exits");
	children()[0].exit(null);
	await waitFor(() => children().length === 2, "the next writer runs after the aborted child exits");
	await drain([queued]);
});

check("declared fallback attempts keep the workspace claim until the last attempt settles", async () => {
	const repo = makeRepo("fallback");
	const launches = [foreground(repo, "chain-fallback", { task: "primary" })];
	await waitFor(() => children().length === 1, "primary spawns");
	launches.push(foreground(repo, "writer", { task: "after" }));
	children()[0].emitLine({ type: "message_end", message: { role: "assistant", content: [], stopReason: "error", errorMessage: "503 provider unavailable", usage: { input: 1, output: 1, totalTokens: 2, cacheRead: 0, cacheWrite: 0, cost: { total: 0 } } } });
	children()[0].exit(1);
	await waitFor(() => children().length === 2, "fallback spawns while the primary's claim is still held");
	assert.equal(children()[1].model, LUNA);
	await settle();
	assert.equal(children().length, 2, "the queued writer must not run between primary and fallback");
	children()[1].exit(0);
	await waitFor(() => children().length === 3, "queued writer runs after the last fallback attempt settles");
	await drain(launches);
});

check("queued claims expose the literal waiting state to foreground updates and background control metadata", async () => {
	const runtime = makeRuntime();
	const repo = makeRepo("waiting");
	const launches = [foreground(repo, "writer", { runtime, task: "holder" })];
	await waitFor(() => children().length === 1, "holder spawns");
	const updates: string[] = [];
	launches.push(foreground(repo, "writer", { runtime, task: "queued", onUpdate: (partial) => updates.push(partial.content?.[0]?.text) }));
	const job = background(runtime, repo, "writer", "queued job");
	await settle();
	assert.ok(updates.includes(WAITING), `foreground update shows ${WAITING}: ${updates.join(" | ")}`);
	assert.equal(runtime.list().find((j: { jobId: string }) => j.jobId === job.id)?.waiting, WAITING);
	children()[0].exit(0);
	await waitFor(() => children().length === 2, "foreground queued writer runs");
	assert.equal(runtime.list().find((j: { jobId: string }) => j.jobId === job.id)?.waiting, WAITING, "job still waits behind the granted writer");
	children()[1].exit(0);
	await waitFor(() => children().length === 3, "queued job runs");
	assert.equal(runtime.list().find((j: { jobId: string }) => j.jobId === job.id)?.waiting, undefined, "waiting clears once granted");
	await drain(launches);
});

check("unresolvable checkout is a non-launch failure: no spawn and a failed result", async () => {
	const repo = makeRepo("missing");
	const result = await foreground(path.join(repo, "does-not-exist"), "writer");
	assert.equal(result.exitCode, 1);
	assert.match(result.stderr, /workspace cwd is not an existing directory/);
	assert.equal(children().length, 0);
});

check("parallel entries: default writers serialize; per-entry readOnly readers overlap", async () => {
	const pi = fakePi();
	subagentExtension(pi);
	const tool = pi.tools.get("subagent")!;
	const readRepo = makeRepo("parallel-readers");
	const writeRepo = makeRepo("parallel-writers");
	const readCtx = { cwd: readRepo, hasUI: false, isProjectTrusted: () => true, model: undefined, thinkingLevel: undefined };
	const readers = tool.execute("id", { background: false, tasks: [{ agent: "reader", task: "a", readOnly: true }, { agent: "reader", task: "b", readOnly: true }] }, undefined, undefined, readCtx);
	await waitFor(() => children().length === 2, "per-entry read-only tasks overlap");
	const writers = tool.execute("id", { background: false, tasks: [{ agent: "writer", task: "a" }, { agent: "writer", task: "b" }] }, undefined, undefined, { ...readCtx, cwd: writeRepo });
	await waitFor(() => children().length === 3, "first default writer spawns");
	await settle();
	assert.equal(children().length, 3, "second default writer waits on the same checkout");
	await drain([readers, writers]);
});

check("single and chain declarations carry readOnly: a read-only chain step overlaps a read-only single and blocks a writer", async () => {
	const pi = fakePi();
	subagentExtension(pi);
	const tool = pi.tools.get("subagent")!;
	const repo = makeRepo("chain-single");
	const ctx = { cwd: repo, hasUI: false, isProjectTrusted: () => true, model: undefined, thinkingLevel: undefined };
	const chain = tool.execute("id", { background: false, chain: [{ agent: "reader", task: "step", readOnly: true }] }, undefined, undefined, ctx);
	await waitFor(() => children().length === 1, "chain step spawns");
	const single = tool.execute("id", { background: false, agent: "reader", task: "single", readOnly: true }, undefined, undefined, ctx);
	await waitFor(() => children().length === 2, "read-only single overlaps the chain step");
	const writer = tool.execute("id", { background: false, agent: "writer", task: "w" }, undefined, undefined, ctx);
	await settle();
	assert.equal(children().length, 2, "a writer waits behind the read-only holders");
	await drain([chain, single, writer]);
});

// D3b DAG mode: the real subagent tool (dag branch) drives the real runtime; each child is finished by the test.
const dagCtx = (cwd: string) => ({ cwd, hasUI: false, isProjectTrusted: () => true, model: undefined, thinkingLevel: undefined });
const usage = { input: 1, output: 1, totalTokens: 2, cacheRead: 0, cacheWrite: 0, cost: { total: 0 } };
const node = (id: string, agent: string, task: string, extra: Record<string, unknown> = {}) => ({ id, agent, task, ...extra });
// Launch-time task text is the child's stdin "Task: " prompt (RPC); a parent report is appended to it.
const promptOf = (child: Child) => child.received.find((message) => message.type === "prompt")?.message ?? "";
const taskOf = (child: Child, prefix: string) => (promptOf(child).startsWith("Task: " + prefix) ? promptOf(child) : "");
function finish(child: Child, text: string, stopReason = "stop", code = 0) {
	child.emitLine({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text }], stopReason, usage } });
	child.exit(code);
}
async function listedWaiting(control: { execute: (...args: unknown[]) => Promise<any> }, jobId: string) {
	const jobs = JSON.parse((await control.execute("list", { action: "list" }, undefined, undefined, dagCtx(""))).content[0].text);
	return jobs.find((job: { jobId: string }) => job.jobId === jobId)?.waiting;
}

check("dag diamond: fan-in waits for every accepted parent; repeated agents keep distinct node and worker identities", async () => {
	const pi = fakePi();
	subagentExtension(pi);
	const tool = pi.tools.get("subagent")!;
	const repo = makeRepo("dag-diamond");
	const launch = tool.execute("dag-diamond", { background: false, dag: [node("a", "writer", "root"), node("b", "reader", "left", { dependsOn: ["a"], readOnly: true }), node("c", "reader", "right", { dependsOn: ["a"], readOnly: true }), node("d", "writer", "join", { dependsOn: ["b", "c"] })] }, undefined, undefined, dagCtx(repo));
	await waitFor(() => children().length === 1, "root spawns alone");
	await settle();
	assert.equal(children().length, 1, "dependents wait for the root");
	finish(children()[0], "A-REPORT");
	await waitFor(() => children().length === 3, "left and right spawn after the root is accepted");
	await waitFor(() => promptOf(children()[1]) !== "", "left prompt arrives");
	assert.ok(taskOf(children()[1], "left").includes("A-REPORT"), "left receives the root report");
	finish(children()[1], "LEFT-REPORT");
	await settle();
	assert.equal(children().length, 3, "the join does not start after only one parent");
	finish(children()[2], "RIGHT-REPORT");
	await waitFor(() => children().length === 4, "join spawns after both parents");
	await waitFor(() => promptOf(children()[3]) !== "", "join prompt arrives");
	assert.ok(taskOf(children()[3], "join").includes("LEFT-REPORT") && taskOf(children()[3], "join").includes("RIGHT-REPORT"), "join receives both reports");
	finish(children()[3], "JOIN-REPORT");
	const result = await launch;
	assert.notEqual(result.isError, true);
	assert.equal(result.details.mode, "dag");
	assert.deepEqual(result.details.results.map((r: any) => r.nodeId), ["a", "b", "c", "d"]);
	assert.deepEqual(result.details.results.map((r: any) => r.dag.status), ["accepted", "accepted", "accepted", "accepted"]);
	assert.deepEqual(result.details.results.map((r: any) => r.nodeId), ["a", "b", "c", "d"]);
	assert.equal(new Set(children()).size, 4, "each node is its own child process, even when agents repeat");
});

check("foreground RPC: a large task travels as one stdin prompt with exact bytes, never as argv", async () => {
	const repo = makeRepo("fg-rpc");
	const task = "Head \u2028 $& $$ ${previous} `tick` \u00e9\u2713 " + "A".repeat(200000) + "\n   trailing whitespace \t  ";
	const launch = foreground(repo, "writer", { task });
	await waitFor(() => children().length === 1, "foreground child spawns");
	const child = children()[0];
	await waitFor(() => child.received.some((message: { type: string }) => message.type === "prompt"), "the prompt reaches stdin");
	const prompt = child.received.find((message: { type: string }) => message.type === "prompt");
	assert.equal(prompt.message, "Task: " + task, "the stdin prompt keeps the task bytes exactly");
	assert.ok(child.args.join(" ").length < 8000 && !child.args.some((arg: string) => arg.includes("AAAA")), "no task text in argv");
	finish(child, "done");
	const result = await launch;
	assert.equal(result.exitCode, 0);
});

// Real pipes emit Buffer chunks; a boundary after the second byte of a 4-byte emoji is the split a per-chunk toString() corrupts.
const pipes = (child: Child) => child as unknown as { stdout: EventEmitter; stderr: EventEmitter };
function emitSplitInEmoji(stream: EventEmitter, bytes: Buffer, every = 1) {
	const emoji = Buffer.from("😀");
	let from = 0;
	let seen = 0;
	for (let at = bytes.indexOf(emoji); at !== -1; at = bytes.indexOf(emoji, at + emoji.length)) {
		if (seen++ % every !== 0) continue;
		stream.emit("data", bytes.subarray(from, at + 2));
		from = at + 2;
	}
	stream.emit("data", bytes.subarray(from));
}
const messageBytes = (text: string) => Buffer.from(JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text }], stopReason: "stop", usage } }) + "\n");
const finalText = (result: any): string => result.messages[result.messages.length - 1].content[0].text;

check("foreground RPC: Buffer chunks split inside a 4-byte emoji keep the final text and stderr byte-exact", async () => {
	const launch = foreground(makeRepo("fg-utf8"), "writer", { task: "utf8" });
	await waitFor(() => children().length === 1, "foreground child spawns");
	const child = children()[0];
	await waitFor(() => child.received.some((message) => message.type === "prompt"), "the prompt reaches stdin");
	emitSplitInEmoji(pipes(child).stderr, Buffer.from("warn 😀 ✓ 😀\n"));
	emitSplitInEmoji(pipes(child).stdout, messageBytes("report 😀 ✓ é 😀 done"));
	child.exit(0);
	const result = await launch;
	assert.deepEqual({ final: finalText(result), stderr: result.stderr }, { final: "report 😀 ✓ é 😀 done", stderr: "warn 😀 ✓ 😀\n" }, "final text and stderr keep every emoji");
});

check("foreground RPC: a 200000-character multibyte final text survives chunks split inside its emoji", async () => {
	const text = "€é✓😀".repeat(40_000);
	const launch = foreground(makeRepo("fg-utf8-large"), "writer", { task: "large" });
	await waitFor(() => children().length === 1, "foreground child spawns");
	const child = children()[0];
	await waitFor(() => child.received.some((message) => message.type === "prompt"), "the prompt reaches stdin");
	emitSplitInEmoji(pipes(child).stdout, messageBytes(text), 500);
	child.exit(0);
	const final = finalText(await launch);
	assert.equal(text.length, 200_000);
	assert.ok(final === text, `final text differs: ${final.length} chars, ${final.split("\uFFFD").length - 1} U+FFFD`);
});

check("dag parent report split inside an emoji reaches the child task byte-exact", async () => {
	const pi = fakePi();
	subagentExtension(pi);
	const tool = pi.tools.get("subagent")!;
	const report = "A-REPORT 😀 ✓ é 😀 end";
	const launch = tool.execute("dag-utf8", { background: false, dag: [node("a", "writer", "root"), node("b", "writer", "use", { dependsOn: ["a"] })] }, undefined, undefined, dagCtx(makeRepo("dag-utf8")));
	await waitFor(() => children().length === 1, "root spawns");
	await waitFor(() => promptOf(children()[0]) !== "", "root prompt arrives");
	emitSplitInEmoji(pipes(children()[0]).stdout, messageBytes(report));
	children()[0].exit(0);
	await waitFor(() => children().length === 2, "dependent spawns");
	await waitFor(() => promptOf(children()[1]) !== "", "dependent prompt arrives");
	assert.equal(promptOf(children()[1]), `Task: use\n\n--- Report from parent node "a" (agent: writer) ---\n${report}`, "the child prompt keeps the parent report byte-exact");
	finish(children()[1], "done");
	assert.notEqual((await launch).isError, true);
});

check("close flushes decoder state before the trailing line parses; a truncated stderr tail keeps native U+FFFD", async () => {
	const launch = foreground(makeRepo("fg-utf8-tail"), "writer", { task: "tail" });
	await waitFor(() => children().length === 1, "foreground child spawns");
	const child = children()[0];
	await waitFor(() => child.received.some((message) => message.type === "prompt"), "the prompt reaches stdin");
	// The last JSON line has no newline: it is parsed only from the close-time trailing buffer.
	emitSplitInEmoji(pipes(child).stdout, messageBytes("tail 😀 ok").subarray(0, -1));
	pipes(child).stderr.emit("data", Buffer.from("warn é"));
	pipes(child).stderr.emit("data", Buffer.from("😀").subarray(0, 3));
	child.exit(0);
	const result = await launch;
	assert.equal(finalText(result), "tail 😀 ok", "the trailing line keeps its emoji");
	assert.equal(result.stderr, "warn é\uFFFD", "the truncated stderr tail is flushed with native replacement, not dropped");
});

check("dag started marker: a node cancelled while queued for its checkout never spawns and reports started false", async () => {
	const pi = fakePi();
	subagentExtension(pi);
	const tool = pi.tools.get("subagent")!;
	const repo = makeRepo("dag-started");
	const controller = new AbortController();
	const launch = tool.execute("dag-started", { background: false, dag: [node("holder", "writer", "hold"), node("queued", "writer", "wait")] }, controller.signal, undefined, dagCtx(repo));
	await waitFor(() => children().length === 1, "holder spawns and the second writer queues on the checkout");
	await settle();
	controller.abort();
	await drain([launch]);
	const result = await launch;
	assert.equal(children().length, 1, "queued node never spawned");
	assert.deepEqual(result.details.results.map((r: any) => [r.nodeId, r.dag.started]), [["holder", true], ["queued", false]]);
});

check("dag failure: a failed node blocks only its descendants; an independent branch still completes; the graph is isError", async () => {
	const pi = fakePi();
	subagentExtension(pi);
	const tool = pi.tools.get("subagent")!;
	const repoA = makeRepo("dag-fail-a");
	const repoB = makeRepo("dag-fail-b");
	const launch = tool.execute("dag-fail", { background: false, dag: [node("bad", "writer", "bad", { cwd: repoA }), node("good", "writer", "good", { cwd: repoB }), node("after-bad", "writer", "after", { cwd: repoA, dependsOn: ["bad"] }), node("after-good", "writer", "after2", { cwd: repoB, dependsOn: ["good"] })] }, undefined, undefined, dagCtx(repoA));
	await waitFor(() => children().length === 2, "independent roots spawn in parallel");
	finish(children()[0], "boom", "error", 1);
	await settle();
	finish(children()[1], "good report");
	await waitFor(() => children().length === 3, "the independent dependent runs; the blocked one never spawns");
	assert.equal(children()[2].cwd, repoB);
	finish(children()[2], "after report");
	const result = await launch;
	assert.equal(result.isError, true);
	assert.deepEqual(result.details.results.map((r: any) => r.dag.status), ["failed", "accepted", "blocked", "accepted"]);
	assert.deepEqual(result.details.results[2].dag.blockedBy, ["bad"]);
	assert.equal(children().length, 3, "blocked node never spawned");
});

check("dag acceptance: exit 0 with stopReason length is not accepted and blocks its dependents", async () => {
	const pi = fakePi();
	subagentExtension(pi);
	const tool = pi.tools.get("subagent")!;
	const launch = tool.execute("dag-length", { background: false, dag: [node("cut", "writer", "cut"), node("next", "writer", "next", { dependsOn: ["cut"] })] }, undefined, undefined, dagCtx(makeRepo("dag-length")));
	await waitFor(() => children().length === 1, "root spawns");
	finish(children()[0], "partial", "length", 0);
	const result = await launch;
	assert.equal(result.isError, true);
	assert.deepEqual(result.details.results.map((r: any) => r.dag.status), ["failed", "blocked"]);
	assert.equal(children().length, 1, "dependent never launches from an INCOMPLETE parent");
});

check("dag parent reports reach the child literally: dollar and brace patterns, a 50KB report and stderr keep every byte", async () => {
	const pi = fakePi();
	subagentExtension(pi);
	const tool = pi.tools.get("subagent")!;
	const big = "R".repeat(50_000) + " $& $$ $' {previous}";
	const launch = tool.execute("dag-literal", { background: false, dag: [node("a", "writer", "root"), node("b", "writer", "use", { dependsOn: ["a"] })] }, undefined, undefined, dagCtx(makeRepo("dag-literal")));
	await waitFor(() => children().length === 1, "root spawns");
	(children()[0] as unknown as { stderr: EventEmitter }).stderr.emit("data", Buffer.from("warn-XYZ\n"));
	children()[0].emitLine({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: big }, { type: "text", text: "tail $& {previous}" }], stopReason: "stop", usage } });
	children()[0].exit(0);
	await waitFor(() => children().length === 2, "dependent spawns");
	await waitFor(() => promptOf(children()[1]) !== "", "dependent prompt arrives");
	const task = taskOf(children()[1], "use");
	assert.ok(task.includes(big + "\ntail $& {previous}"), "every character of the parent text is forwarded literally");
	assert.ok(task.includes("STDERR: warn-XYZ"), "the parent's stderr is forwarded");
	finish(children()[1], "done");
	assert.notEqual((await launch).isError, true);
});

check("dag mode validation: every invalid graph, ambiguous mode or missing mode is isError with zero spawns and no job", async () => {
	const pi = fakePi();
	subagentExtension(pi);
	const tool = pi.tools.get("subagent")!;
	const ctx = dagCtx(makeRepo("dag-validation"));
	const nine = Array.from({ length: 9 }, (_, i) => node("n" + i, "writer", "t"));
	const invalid: Array<[string, Record<string, unknown>]> = [
		["empty graph", { dag: [] }],
		["over the 8-node limit", { dag: nine }],
		["cycle", { dag: [node("a", "writer", "t", { dependsOn: ["b"] }), node("b", "writer", "t", { dependsOn: ["a"] })] }],
		["self dependency", { dag: [node("a", "writer", "t", { dependsOn: ["a"] })] }],
		["missing parent", { dag: [node("a", "writer", "t", { dependsOn: ["zz"] })] }],
		["duplicate parent", { dag: [node("a", "writer", "t"), node("b", "writer", "t", { dependsOn: ["a", "a"] })] }],
		["duplicate id", { dag: [node("a", "writer", "t"), node("a", "reader", "t")] }],
		["bad id", { dag: [node("1a", "writer", "t")] }],
		["unknown agent", { dag: [node("a", "nobody", "t")] }],
		["non-boolean readOnly", { dag: [node("a", "writer", "t", { readOnly: "yes" })] }],
		["dag with single", { dag: [node("a", "writer", "t")], agent: "writer", task: "t" }],
		["dag with tasks", { dag: [node("a", "writer", "t")], tasks: [{ agent: "writer", task: "t" }] }],
		["dag with chain", { dag: [node("a", "writer", "t")], chain: [{ agent: "writer", task: "t" }] }],
		["missing mode", {}],
	];
	for (const background of [false, true]) {
		for (const [label, params] of invalid) {
			const result = await tool.execute("bad", { ...params, background }, undefined, undefined, ctx);
			assert.equal(result.isError, true, `${label} (background ${background})`);
			assert.equal(result.details?.jobId, undefined, `${label} starts no job`);
		}
	}
	assert.equal(children().length, 0, "no child is spawned by any invalid graph");
	assert.equal(pi.sent.length, 0);
});

check("dag tool boundary: installed SDK validation refuses malformed nodes with zero spawns; explicit nulls reach runtime and are refused", async () => {
	const pi = fakePi();
	subagentExtension(pi);
	const tool = pi.tools.get("subagent")!;
	const ctx = dagCtx(makeRepo("dag-sdk-boundary"));
	const sdk = await import(piAiUrl);
	const call = (args: Record<string, unknown>) => ({ type: "toolCall" as const, id: "sdk", name: "subagent", arguments: args });
	const refused: Array<[string, Record<string, unknown>]> = [
		["unknown node key", { dag: [node("a", "writer", "t", { dependson: [] })], background: false }],
		["bad id", { dag: [node("1a", "writer", "t")], background: false }],
		["nine nodes", { dag: Array.from({ length: 9 }, (_, i) => node("n" + i, "writer", "t")), background: false }],
		["empty graph", { dag: [], background: false }],
	];
	for (const [label, args] of refused) assert.throws(() => sdk.validateToolArguments(tool, call(args)), /Validation failed/, label);
	const nulls: Array<[string, Record<string, unknown>]> = [
		["null dependsOn", node("a", "writer", "t", { dependsOn: null })],
		["null cwd", node("a", "writer", "t", { cwd: null })],
		["null readOnly", node("a", "writer", "t", { readOnly: null })],
	];
	for (const [label, dagNode] of nulls) {
		const validated = sdk.validateToolArguments(tool, call({ dag: [dagNode], background: false }));
		const result = await tool.execute("sdk-null", validated, undefined, undefined, ctx);
		assert.equal(result.isError, true, label);
	}
	assert.doesNotThrow(() => sdk.validateToolArguments(tool, call({ dag: [node("a", "writer", "t")], background: false })), "omitted optionals pass");
	// The installed SDK accepts an unknown root key; the runtime must refuse it before any launch.
	const rootValidated = sdk.validateToolArguments(tool, call({ dag: [node("a", "writer", "t")], bogus: 1, background: false }));
	assert.equal((await tool.execute("sdk-root", rootValidated, undefined, undefined, ctx)).isError, true, "unknown root key refused after SDK validation");
	assert.equal(children().length, 0, "no child is spawned by any malformed or null graph");
	assert.equal(pi.sent.length, 0);
});

check("dag mode refuses unknown top-level keys with zero spawns; the schema's own root keys stay accepted; legacy single mode is unchanged", async () => {
	const pi = fakePi();
	subagentExtension(pi);
	const tool = pi.tools.get("subagent")!;
	const ctx = dagCtx(makeRepo("dag-root-keys"));
	const dag = [node("a", "writer", "t")];
	for (const extra of [{ bogus: 1 }, { agnet: "writer" }]) {
		// Refusal is immediate; the race turns a launch that would otherwise run into a failed assertion rather than a hang.
		const bg = await Promise.race([tool.execute("root-bg", { dag, background: true, ...extra }, undefined, undefined, ctx), sleep(500).then(() => undefined)]);
		assert.ok(bg, `${JSON.stringify(extra)} (background) is refused without waiting for a launch`);
		assert.equal(bg.isError, true, `${JSON.stringify(extra)} (background)`);
		assert.match(bg.content[0].text, /unknown top-level key/);
		assert.equal(bg.details?.jobId, undefined, "no job is started");
		const fg = await Promise.race([tool.execute("root-fg", { dag, background: false, ...extra }, undefined, undefined, ctx), sleep(500).then(() => undefined)]);
		assert.ok(fg, `${JSON.stringify(extra)} (foreground) is refused without waiting for a launch`);
		assert.equal(fg.isError, true, `${JSON.stringify(extra)} (foreground)`);
		assert.match(fg.content[0].text, /unknown top-level key/);
	}
	assert.equal(children().length, 0, "an unknown root key spawns nothing");
	assert.equal(pi.sent.length, 0);

	const known = tool.execute("root-known", { dag, background: false, agentScope: "user", confirmProjectAgents: false, readOnly: false }, undefined, undefined, ctx);
	await waitFor(() => children().length === 1, "known root keys are accepted: the node spawns");
	finish(children()[0], "done");
	assert.notEqual((await known).isError, true, "known root keys do not refuse the graph");

	const legacy = tool.execute("legacy-single", { agent: "writer", task: "t", bogus: 1, background: false }, undefined, undefined, ctx);
	await waitFor(() => children().length === 2, "legacy single mode still accepts unknown root keys");
	finish(children()[1], "done");
	assert.notEqual((await legacy).isError, true, "legacy single mode is unchanged");
});

check("background dag: completion is bounded to 4000 chars and subagent_control result recovers every node's full output", async () => {
	const pi = fakePi();
	subagentExtension(pi);
	const tool = pi.tools.get("subagent")!;
	const control = pi.tools.get("subagent_control")!;
	const ctx = dagCtx(makeRepo("dag-bg-bounded"));
	const started = await tool.execute("dag-bg", { background: true, dag: [node("a", "writer", "root"), node("b", "reader", "use", { dependsOn: ["a"], readOnly: true })] }, undefined, undefined, ctx);
	const jobId = started.details.jobId;
	await waitFor(() => children().length === 1, "root spawns");
	finish(children()[0], "A".repeat(3000) + "\nSTATUS: PASS");
	await waitFor(() => children().length === 2, "dependent spawns");
	finish(children()[1], "B".repeat(3000) + "\nSTATUS: PASS");
	await waitFor(() => pi.sent.length === 1, "completion delivered");
	assert.ok(pi.sent[0].content.length <= 4000, "automatic completion is bounded");
	assert.match(pi.sent[0].content, /INCOMPLETE HANDOFF/);
	const recovered = await control.execute("recover", { action: "result", target: jobId }, undefined, undefined, ctx);
	const text = recovered.content[0].text;
	assert.ok(text.includes("A".repeat(3000)) && text.includes("B".repeat(3000)), "every node's full output is recovered");
	assert.ok(text.includes('node "a"') && text.includes('node "b"'), "each node is headed by its node id");
});

check("parallel background entries: the job keeps waiting while any queued claim on the checkout remains", async () => {
	const pi = fakePi();
	subagentExtension(pi);
	const tool = pi.tools.get("subagent")!;
	const control = pi.tools.get("subagent_control")!;
	const ctx = dagCtx(makeRepo("parallel-waiting"));
	const started = await tool.execute("parallel-waiting", { background: true, tasks: [{ agent: "writer", task: "a" }, { agent: "writer", task: "b" }, { agent: "writer", task: "c" }] }, undefined, undefined, ctx);
	const jobId = started.details.jobId;
	await waitFor(() => children().length === 1, "first writer spawns");
	let waiting: unknown;
	for (let i = 0; i < 200 && waiting !== WAITING; i++) {
		await settle(5);
		waiting = await listedWaiting(control, jobId);
	}
	assert.equal(waiting, WAITING, "the two queued writers show waiting");
	finish(children()[0], "a report");
	await waitFor(() => children().length === 2, "the second writer takes the released checkout");
	await settle();
	assert.equal(await listedWaiting(control, jobId), WAITING, "the third writer still waits, so the job still shows waiting");
	finish(children()[1], "b report");
	await waitFor(() => children().length === 3, "the third writer finally spawns");
	finish(children()[2], "c report");
	await settle(50);
});

check("dag background list: each worker reports the DAG node that launched it, distinct from worker IDs", async () => {
	const pi = fakePi();
	subagentExtension(pi);
	const tool = pi.tools.get("subagent")!;
	const control = pi.tools.get("subagent_control")!;
	const ctx = dagCtx(makeRepo("dag-list-node"));
	const started = await tool.execute("dag-list-node", { background: true, dag: [node("alpha", "writer", "one", { readOnly: true }), node("beta", "writer", "two", { readOnly: true })] }, undefined, undefined, ctx);
	const jobId = started.details.jobId;
	await waitFor(() => children().length === 2, "both readers spawn");
	const job = JSON.parse((await control.execute("list", { action: "list" }, undefined, undefined, ctx)).content[0].text).find((entry: { jobId: string }) => entry.jobId === jobId);
	const workers = job.workers.map((worker: { id: string; node?: string }) => ({ id: worker.id, node: worker.node }));
	assert.deepEqual(workers.map((worker: { node?: string }) => worker.node).sort(), ["alpha", "beta"]);
	assert.equal(new Set(workers.map((worker: { id: string }) => worker.id)).size, 2, "worker IDs stay distinct");
	assert.ok(workers.every((worker: { id: string; node?: string }) => worker.id !== worker.node), "node IDs are not worker IDs");
	finish(children()[0], "alpha report");
	finish(children()[1], "beta report");
	await settle(50);
});

check("dag cancel: in-flight children are killed and drained before the job settles; queued nodes never launch and show waiting", async () => {
	const pi = fakePi();
	subagentExtension(pi);
	const tool = pi.tools.get("subagent")!;
	const control = pi.tools.get("subagent_control")!;
	const ctx = dagCtx(makeRepo("dag-cancel"));
	const started = await tool.execute("dag-cancel", { background: true, dag: [node("a", "writer", "first"), node("b", "writer", "second")] }, undefined, undefined, ctx);
	const jobId = started.details.jobId;
	await waitFor(() => children().length === 1, "first writer spawns");
	let waiting: unknown;
	for (let i = 0; i < 200 && waiting !== WAITING; i++) {
		await settle(5);
		waiting = await listedWaiting(control, jobId);
	}
	assert.equal(waiting, WAITING, "queued node shows waiting");
	await control.execute("cancel", { action: "cancel", target: jobId }, undefined, undefined, ctx);
	await settle();
	assert.ok(children()[0].signals.length > 0, "in-flight child receives a kill signal");
	assert.equal(pi.sent.length, 0, "the job does not settle while its child is alive");
	children()[0].exit(1);
	await waitFor(() => pi.sent.length === 1, "job settles after the child exits");
	assert.equal(children().length, 1, "queued node never spawned");
	assert.match(pi.sent[0].content, /aborted/);
});

check("dag pause: a dependent launch waits for resume", async () => {
	const pi = fakePi();
	subagentExtension(pi);
	const tool = pi.tools.get("subagent")!;
	const control = pi.tools.get("subagent_control")!;
	const ctx = dagCtx(makeRepo("dag-pause"));
	const started = await tool.execute("dag-pause", { background: true, dag: [node("a", "writer", "root"), node("b", "reader", "use", { dependsOn: ["a"], readOnly: true })] }, undefined, undefined, ctx);
	const jobId = started.details.jobId;
	await waitFor(() => children().length === 1, "root spawns");
	await control.execute("pause", { action: "pause", target: jobId }, undefined, undefined, ctx);
	finish(children()[0], "A-OUT");
	await settle(60);
	assert.equal(children().length, 1, "the held job does not launch the dependent");
	await control.execute("resume", { action: "resume", target: jobId }, undefined, undefined, ctx);
	await waitFor(() => children().length === 2, "dependent launches after resume");
	finish(children()[1], "B-OUT");
	await waitFor(() => pi.sent.length === 1, "job completes");
});

check("dag background node holds the checkout across jobs: a legacy foreground writer waits for the graph child to exit", async () => {
	const pi = fakePi();
	subagentExtension(pi);
	const tool = pi.tools.get("subagent")!;
	const ctx = dagCtx(makeRepo("dag-cross"));
	await tool.execute("dag-cross-bg", { background: true, dag: [node("a", "writer", "graph")] }, undefined, undefined, ctx);
	await waitFor(() => children().length === 1, "graph node spawns");
	const legacy = tool.execute("legacy", { background: false, agent: "writer", task: "legacy" }, undefined, undefined, ctx);
	await settle();
	assert.equal(children().length, 1, "the legacy writer waits behind the graph node's claim");
	finish(children()[0], "graph done");
	await waitFor(() => children().length === 2, "legacy writer runs after the graph node exits");
	finish(children()[1], "legacy done");
	assert.notEqual((await legacy).isError, true);
});

check("dag concurrency is the shared cap: five independent nodes run at most four at a time", async () => {
	const pi = fakePi();
	subagentExtension(pi);
	const tool = pi.tools.get("subagent")!;
	const launch = tool.execute("dag-cap", { background: false, dag: Array.from({ length: 5 }, (_, i) => node("n" + i, "writer", "t" + i, { cwd: makeRepo("dag-cap-" + i) })) }, undefined, undefined, dagCtx(makeRepo("dag-cap-root")));
	await waitFor(() => children().length === 4, "four nodes fill the cap");
	await settle();
	assert.equal(children().length, 4, "the fifth node waits for capacity");
	finish(children()[0], "ok");
	await waitFor(() => children().length === 5, "fifth node starts when capacity frees");
	for (const child of children().slice(1)) finish(child, "ok");
	assert.notEqual((await launch).isError, true);
});
