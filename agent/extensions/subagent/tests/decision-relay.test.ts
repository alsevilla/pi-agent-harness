// Worker decision relay regression. Bun discovers this file and launches its body under Node, where
// registerHooks + native TypeScript transform load the REAL index.ts/background.ts/decision-relay.ts.
// Only the pi package (existing runtime-doubles.mjs), child_process spawn and monitor UI are doubled.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const isBun = typeof (process.versions as Record<string, string>).bun === "string";

if (isBun) {
	const { test } = await import("bun:test");
	test("decision relay suite passes under Node native TypeScript transform", () => {
		const run = spawnSync("node", ["--experimental-transform-types", "--test", thisFile], { encoding: "utf8", timeout: 180_000, windowsHide: true });
		assert.equal(run.status, 0, run.stdout + run.stderr);
	}, 200_000);
} else {
	await runNodeSuite();
}

async function runNodeSuite() {
	const { default: test, before, after, beforeEach, afterEach } = await import("node:test");
	const { registerHooks } = await import("node:module");
	const { EventEmitter } = await import("node:events");
	const doublesUrl = new URL("./fixtures/runtime-doubles.mjs", import.meta.url).href;
	const dataModule = (source: string) => "data:text/javascript," + encodeURIComponent(source);
	const childUrl = dataModule("export function spawn(command, args, options) { return globalThis.__piDecisionSpawn(command, args, options); }");
	const monitorUrl = dataModule("export class WorkerMonitor { constructor() { this.store = globalThis.__piDecisionStore; this.control = undefined; } }");
	const indexUrl = new URL("../index.ts", import.meta.url).href;
	const entryUrl = new URL("../provider-cooldown-entry.ts", import.meta.url).href;
	// Offline stub for the cooldown entry's pi-ai/compat delegate factories and stream constructor; never called in these tests.
	const cooldownStubUrl = dataModule("export const anthropicMessagesApi = () => ({ streamSimple: () => { throw new Error(\"offline stub\"); } }); export const openAICodexResponsesApi = anthropicMessagesApi; export function createAssistantMessageEventStream() { throw new Error(\"offline stub\"); }");
	registerHooks({
		resolve(specifier: string, context: { parentURL?: string }, nextResolve: (s: string, c: object) => { url: string }) {
			if (specifier === "@earendil-works/pi-ai/compat" || (specifier === "@earendil-works/pi-ai" && context.parentURL === entryUrl)) return { url: cooldownStubUrl, shortCircuit: true };
			if (specifier === "@earendil-works/pi-coding-agent" || specifier === "@earendil-works/pi-ai" || specifier === "typebox") return { url: doublesUrl, shortCircuit: true };
			if (specifier === "node:child_process") return { url: childUrl, shortCircuit: true };
			if (specifier === "./monitor.ts" && context.parentURL === indexUrl) return { url: monitorUrl, shortCircuit: true };
			return nextResolve(specifier, context);
		},
	} as never);
	const { default: subagentExtension } = await import(indexUrl);
	const relay: any = await import("../decision-relay-state.ts");
	const childExtension: any = (await import("../decision-relay.ts")).default;
	const { configureCodeIntegrations } = await import("../code-integrations.ts");

	const RECORD = "pi-worker-decision-request ";
	const DIALOG = "pi-decision ";
	const TOOL = "request_decision";
	const ENV = "PI_SUBAGENT_DECISION_RELAY";
	const REQ = "dec-aaaaaaaa1111";
	const REQ2 = "dec-bbbbbbbb2222";
	let root = "";
	let candidate = "";
	let originalAgentDir: string | undefined;
	let children: any[] = [];
	let pis: any[] = [];

	class Store {
		records = new Map<string, any>();
		n = 0;
		begin(name: string, task: string, model: string, thinking: string) {
			const id = "w:" + ++this.n;
			const r = { id, name, task, model, thinking, state: "running", activity: "", events: [] as string[], endedAt: undefined as number | undefined };
			this.records.set(id, r);
			return r;
		}
		started() {}
		event() {}
		finish(id: string, state: string) { const r = this.records.get(id); if (r) { r.state = state; r.endedAt = Date.now(); } }
		changed() {}
		list() { return [...this.records.values()]; }
		summary() { return ""; }
	}

	function makeChild(args: string[], options: any) {
		const child: any = new EventEmitter();
		child.stdout = new EventEmitter();
		child.stderr = new EventEmitter();
		child.exitCode = null;
		child.signalCode = null;
		child.stdin = new EventEmitter();
		child.stdin.writable = true;
		// Only background jobs load the relay extension; foreground runs are RPC-piped too, so stdio no longer marks them.
		const rec: any = {
			args, env: options.env, foreground: !args.some((arg) => arg.endsWith("decision-relay.ts")), lines: [] as any[], closed: false, stdin: child.stdin, fault: undefined as string | undefined, hold: false, held: [] as Array<() => void>, release() { for (const run of rec.held.splice(0)) run(); },
			emit(event: object) { child.stdout.emit("data", JSON.stringify(event) + "\n"); },
			exit(code: number | null = 0) { if (rec.closed) return; rec.closed = true; child.exitCode = code; child.emit("close", code); },
		};
		// Mock Node stdin: callbacks run asynchronously; a fault is a sync throw or an async EPIPE callback plus the stream 'error' event.
		child.stdin.write = (text: string, callback?: (e?: Error | null) => void) => {
			const messages = String(text).split("\n").filter(line => line.trim()).map(line => JSON.parse(line));
			const isResponse = messages.some(message => message.type === "extension_ui_response");
			if (isResponse && rec.fault === "throw") { rec.fault = undefined; throw new Error("write threw synchronously"); }
			const error = isResponse && rec.fault === "epipe" ? Object.assign(new Error("write EPIPE"), { code: "EPIPE" }) : undefined;
			if (error) rec.fault = undefined;
			for (const message of error ? [] : messages) {
				rec.lines.push(message);
				if (message.id && message.type && message.type !== "extension_ui_response") queueMicrotask(() => rec.emit({ type: "response", id: message.id, success: true, data: {} }));
			}
			const complete = () => setImmediate(() => { callback?.(error); if (error) child.stdin.emit("error", error); });
			if (rec.hold && isResponse) rec.held.push(complete); else complete();
			return true;
		};
		child.stdin.end = () => { child.stdin.writable = false; };
		child.kill = (signal = "SIGTERM") => { child.signalCode = signal; queueMicrotask(() => rec.exit(null)); return true; };
		children.push(rec);
		queueMicrotask(() => { child.emit("spawn"); if (rec.foreground) setTimeout(() => rec.exit(0), 5); });
		return child;
	}

	function fakePi() {
		const handlers = new Map<string, Array<(...a: any[]) => unknown>>();
		const tools = new Map<string, any>();
		const messages: Array<{ msg: any; opts: any }> = [];
		const pi = {
			tools, messages,
			on(name: string, fn: (...a: any[]) => unknown) { handlers.set(name, [...(handlers.get(name) ?? []), fn]); },
			registerTool(def: any) { tools.set(def.name, def); },
			registerProvider() {}, // Phase B: the default export registers the cooldown providers; no-op for this relay suite
			registerCommand() {},
			sendMessage(msg: any, opts: any) { messages.push({ msg, opts }); return Promise.resolve(); },
			emit(name: string) { for (const fn of handlers.get(name) ?? []) fn(); },
		};
		pis.push(pi);
		return pi;
	}

	async function waitFor(check: () => boolean, label: string, ms = 3000) {
		const end = Date.now() + ms;
		while (!check()) {
			if (Date.now() > end) throw new Error("timed out: " + label);
			await new Promise(resolve => setTimeout(resolve, 5));
		}
	}

	function tool(pi: any, name: string) { return pi.tools.get(name); }
	async function startJob(pi: any, task = "Decide the migration target", readOnly = false) {
		const before = children.length;
		const result = await tool(pi, "subagent").execute("call", { agent: "test-worker", task, readOnly }, undefined, undefined, { cwd: candidate, hasUI: false });
		assert.ok(result.details?.jobId, JSON.stringify(result));
		await waitFor(() => children.length > before, "spawn");
		return result.details.jobId as string;
	}
	async function control(pi: any, params: object) {
		const result = await tool(pi, "subagent_control").execute("ctl", params, undefined, undefined, {});
		return result;
	}
	function record(requestId: string, overrides: object = {}) {
		return { type: "worker_decision_request", requestId, question: "Use staging DB or fixture DB?", options: ["Staging", "Fixture"], context: "Migration step 3", blockedScope: "Writes to schema/ migration files", ...overrides };
	}
	function notifyEnvelope(payload: unknown, id = "n-" + Math.random().toString(36).slice(2)) {
		const message = typeof payload === "string" ? payload : RECORD + JSON.stringify(payload);
		return { type: "extension_ui_request", id, method: "notify", message, notifyType: "info" };
	}
	function dialog(id: string, requestId: string, method = "input", title = DIALOG + requestId) {
		return { type: "extension_ui_request", id, method, title, placeholder: "Main decides" };
	}
	function answersFor(rec: any, dialogId: string) {
		return rec.lines.filter((l: any) => l.type === "extension_ui_response" && l.id === dialogId);
	}
	function decisionMessages(pi: any, state?: string) {
		return pi.messages.filter((m: any) => m.msg.customType === "subagent-decision" && (state === undefined || m.msg.details?.state === state));
	}
	async function openRequest(pi: any, requestId = REQ, dialogId = "dlg-1") {
		const jobId = await startJob(pi, "Decide the migration target", true); // fake decision children never write the candidate
		await waitFor(() => children.length > 0, "spawn");
		const child = children[children.length - 1];
		child.emit(notifyEnvelope(record(requestId)));
		child.emit(dialog(dialogId, requestId));
		await waitFor(() => decisionMessages(pi, "open").length > 0, "main notified open");
		return { jobId, child, workerId: "w:" + children.length };
	}
	async function decisionList(pi: any) {
		const result = await control(pi, { action: "decisions" });
		return JSON.parse(result.content[0].text);
	}

	function mockRoot() {
		root = fs.mkdtempSync(path.join(os.tmpdir(), "decision-relay-"));
		candidate = path.join(root, "candidate");
		fs.mkdirSync(path.join(root, "agent", "agents"), { recursive: true });
		fs.mkdirSync(candidate, { recursive: true });
		fs.writeFileSync(path.join(root, "agent", "agents", "test-worker.md"), "---\nname: test-worker\ndescription: Decision relay regression role\ntools: read, grep, find, ls, edit\n---\nTest worker prompt.\n");
	}

	before(() => {
		originalAgentDir = process.env.PI_CODING_AGENT_DIR;
		mockRoot();
		process.env.PI_CODING_AGENT_DIR = path.join(root, "agent");
		(globalThis as any).__piDecisionSpawn = (command: string, args: string[], options: any) => makeChild(args, options);
	});

	beforeEach(() => {
		children = [];
		pis = [];
		(globalThis as any).__piDecisionStore = new Store();
	});

	afterEach(() => {
		for (const pi of pis) pi.emit("session_shutdown");
		for (const child of children) child.exit(0);
	});

	after(() => {
		if (originalAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = originalAgentDir;
		fs.rmSync(root, { recursive: true, force: true });
	});

	// ---- Pure state: schema, limits, transitions (RED until decision-relay-state.ts exists)
	test("S1 strict bounded request schema rejects unknown keys, blank or oversized fields and bad ids", () => {
		assert.equal(relay.parseDecisionRequest(record(REQ)).ok, true);
		for (const bad of [
			record(REQ, { extra: true }),
			record(REQ, { question: "   " }),
			record(REQ, { question: "q".repeat(1001) }),
			record(REQ, { options: ["a", "b", "c", "d", "e", "f", "g"] }),
			record(REQ, { options: [""] }),
			record(REQ, { blockedScope: "" }),
			record("bad id!"),
			record(REQ, { type: "other" }),
			null,
		]) assert.equal(relay.parseDecisionRequest(bad).ok, false, JSON.stringify(bad));
	});

	test("S1b freeform request without options is valid (native ask_user-style text question)", () => {
		const parsed = relay.parseDecisionRequest({ type: "worker_decision_request", requestId: REQ, question: "Which batch size?", blockedScope: "Migration writes" });
		assert.equal(parsed.ok, true);
		assert.deepEqual(parsed.request.options ?? [], []);
	});

	test("S2 registry: duplicate ids, second open request per worker and session cap of four are rejected", () => {
		const state = new relay.DecisionRelay();
		const ann = (jobId: string, workerId: string, requestId: string) => state.announce({ jobId, workerId, candidate, raw: record(requestId) });
		assert.equal(ann("bg-1", "w:1", REQ).ok, true);
		assert.equal(ann("bg-2", "w:2", REQ).ok, false, "collision");
		assert.equal(ann("bg-1", "w:1", REQ2).ok, false, "second open for same worker");
		assert.equal(ann("bg-2", "w:2", "dec-cccccccc3333").ok, true);
		assert.equal(ann("bg-3", "w:3", "dec-dddddddd4444").ok, true);
		assert.equal(ann("bg-4", "w:4", "dec-eeeeeeee5555").ok, true);
		assert.equal(ann("bg-5", "w:5", "dec-ffffffff6666").ok, false, "fifth open request");
	});

	test("S3 dialog hold requires exact title, input method, announced request and same worker/job", () => {
		const state = new relay.DecisionRelay();
		state.announce({ jobId: "bg-1", workerId: "w:1", candidate, raw: record(REQ) });
		const hold = (overrides: object) => state.holdDialog({ jobId: "bg-1", workerId: "w:1", method: "input", title: DIALOG + REQ, dialogId: "d1", ...overrides });
		assert.equal(hold({ method: "select" }), undefined, "select method not held");
		assert.equal(hold({ title: DIALOG + REQ + "x" }), undefined, "prefix-extended title not held");
		assert.equal(hold({ title: "pi-decision-" + REQ }), undefined, "non-exact title not held");
		assert.equal(hold({ workerId: "w:9" }), undefined, "other worker not held");
		assert.equal(hold({ jobId: "bg-9" }), undefined, "other job not held");
		assert.equal(hold({}).state, "open");
		assert.equal(hold({ dialogId: "d2" }), undefined, "second dialog for same request not held");
	});

	test("S4 answers require open state, validated answer text, basis and reference; late answers rejected", () => {
		const state = new relay.DecisionRelay();
		state.announce({ jobId: "bg-1", workerId: "w:1", candidate, raw: record(REQ) });
		const ok = { answer: "Fixture", basis: "user_answer", reference: "ask_user:m00124" };
		assert.equal(state.answer(REQ, ok).ok, false, "not open yet");
		state.holdDialog({ jobId: "bg-1", workerId: "w:1", method: "input", title: DIALOG + REQ, dialogId: "d1" });
		for (const bad of [{ ...ok, answer: "  " }, { ...ok, basis: "guess" }, { ...ok, reference: "" }, { answer: "x", basis: "existing_authorization" }]) assert.equal(state.answer(REQ, bad).ok, false, JSON.stringify(bad));
		const accepted = state.answer(REQ, ok);
		assert.equal(accepted.ok, true);
		assert.equal(JSON.parse(accepted.value).answer, "Fixture");
		assert.equal(state.answer(REQ, ok).ok, false, "second answer is late");
		assert.equal(state.decline(REQ, "no").ok, false, "decline after answer is late");
	});

	test("S5 settlement is exactly once per request and scoped to worker/job; reasons are inspectable", () => {
		const state = new relay.DecisionRelay();
		state.announce({ jobId: "bg-1", workerId: "w:1", candidate, raw: record(REQ) });
		state.holdDialog({ jobId: "bg-1", workerId: "w:1", method: "input", title: DIALOG + REQ, dialogId: "d1" });
		assert.equal(state.settleWorker("w:9", "worker-exited").length, 0, "other worker untouched");
		const settled = state.settleWorker("w:1", "worker-exited");
		assert.equal(settled.length, 1);
		assert.equal(settled[0].dialogId, "d1");
		assert.equal(settled[0].record.state, "settled");
		assert.equal(settled[0].record.reason, "worker-exited");
		assert.equal(state.settleWorker("w:1", "worker-exited").length, 0, "exactly once");
		assert.equal(state.answer(REQ, { answer: "x", basis: "user_answer", reference: "r" }).ok, false, "late answer rejected");
		assert.equal(state.list().find((r: any) => r.requestId === REQ).reason, "worker-exited");
	});

	// ---- Child relay tool (decision-relay.ts)
	test("C1 child tool is unavailable without the parent relay env or with no UI, emitting nothing", async () => {
		const pi = fakePi();
		childExtension(pi);
		const def = pi.tools.get(TOOL);
		const notes: string[] = [];
		const titles: string[] = [];
		const ui = { notify: (m: string) => notes.push(m), input: (t: string) => { titles.push(t); return new Promise(() => {}); } };
		const saved = process.env[ENV];
		delete process.env[ENV];
		try {
			const direct = await def.execute("c", { question: "Q", blockedScope: "S" }, undefined, undefined, { hasUI: true, ui });
			assert.equal(direct.details.status, "unavailable");
			process.env[ENV] = "1";
			const headless = await def.execute("c", { question: "Q", blockedScope: "S" }, undefined, undefined, { hasUI: false, ui });
			assert.equal(headless.details.status, "unavailable");
		} finally { if (saved === undefined) delete process.env[ENV]; else process.env[ENV] = saved; }
		assert.deepEqual(notes, []);
		assert.deepEqual(titles, []);
	});

	test("C2 child emits the request before the exact dialog and returns a freeform answer unchanged", async () => {
		const pi = fakePi();
		childExtension(pi);
		const def = pi.tools.get(TOOL);
		const order: string[] = [];
		let resolveInput!: (v: string | undefined) => void;
		const ui = { notify: (m: string) => order.push("notify:" + m), input: (t: string) => { order.push("input:" + t); return new Promise<string | undefined>(r => { resolveInput = r; }); } };
		process.env[ENV] = "1";
		try {
			const run = def.execute("c", { question: "Which batch size?", options: ["100", "500"], blockedScope: "Migration writes" }, undefined, undefined, { hasUI: true, ui });
			await waitFor(() => order.length === 2, "notify then input");
			assert.ok(order[0].startsWith("notify:" + RECORD));
			const requestId = order[1].slice(("input:" + DIALOG).length);
			const payload = JSON.parse(order[0].slice(("notify:" + RECORD).length));
			assert.equal(payload.type, "worker_decision_request");
			assert.equal(payload.requestId, requestId);
			assert.equal(order[1], "input:" + DIALOG + requestId);
			resolveInput(JSON.stringify({ requestId, decision: "answered", answer: "Something else entirely", basis: "user_answer", reference: "ask_user:m00200" }));
			const result = await run;
			assert.equal(result.details.status, "answered");
			assert.equal(result.details.answer, "Something else entirely");
			assert.equal(result.details.basis, "user_answer");
			assert.equal(result.details.reference, "ask_user:m00200");
			assert.match(result.details.scope, /grants no tool/);
		} finally { delete process.env[ENV]; }
	});

	test("C3 no-options question is valid; cancelled, blank, mismatched or declined answers never approve", async () => {
		const pi = fakePi();
		childExtension(pi);
		const def = pi.tools.get(TOOL);
		process.env[ENV] = "1";
		try {
			for (const value of [undefined, "", "   ", "not json", JSON.stringify({ requestId: "dec-other", decision: "answered", answer: "Yes", basis: "user_answer", reference: "r" }), JSON.stringify({ requestId: "WILL", decision: "answered", answer: "Yes", basis: "existing_authorization" }), JSON.stringify({ requestId: "WILL", decision: "declined", reason: "not needed" })]) {
				let requestId = "";
				let resolveInput!: (v: string | undefined) => void;
				const ui = { notify: () => {}, input: (t: string) => { requestId = t.slice(DIALOG.length); return new Promise<string | undefined>(r => { resolveInput = r; }); } };
				const run = def.execute("c", { question: "Pick?", blockedScope: "Writes" }, undefined, undefined, { hasUI: true, ui });
				await waitFor(() => requestId !== "", "input");
				resolveInput(value?.replace("WILL", requestId));
				const result = await run;
				assert.equal(result.details.status, "cancelled", String(value));
				assert.equal(result.details.answer, undefined);
			}
			let requestId = "";
			let resolveInput!: (v: string | undefined) => void;
			const ui = { notify: () => {}, input: (t: string) => { requestId = t.slice(DIALOG.length); return new Promise<string | undefined>(r => { resolveInput = r; }); } };
			const run = def.execute("c", { question: "Pick?", blockedScope: "Writes" }, undefined, undefined, { hasUI: true, ui });
			await waitFor(() => requestId !== "", "declined input");
			resolveInput(JSON.stringify({ requestId, decision: "declined", reason: "Not needed" }));
			const declined = await run;
			assert.equal(declined.details.status, "cancelled");
			assert.equal(declined.details.reason, "Not needed");
		} finally { delete process.env[ENV]; }
	});

	// ---- Grants and roles (code-integrations.ts), real module
	test("G1 background grant adds only request_decision to the edit-role allowlist; default call unchanged", () => {
		const base: string[] = [];
		const agent = { name: "test-worker", description: "d", source: "user", filePath: "x", tools: ["read", "grep", "find", "ls", "edit"] };
		assert.equal(configureCodeIntegrations(base, agent), false);
		assert.equal(base[base.indexOf("--tools") + 1], "read,grep,find,ls,edit");
		const granted: string[] = [];
		configureCodeIntegrations(granted, agent, [TOOL]);
		assert.equal(granted[granted.indexOf("--tools") + 1], "read,grep,find,ls,edit," + TOOL);
	});

	// ---- Parent dispatch through the REAL index.ts default export, background.ts and fake child process
	test("P1 exact held dialog: request is announced, main notified once, no automatic cancel", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		const { jobId, child } = await openRequest(pi);
		assert.equal(answersFor(child, "dlg-1").length, 0, "dialog must not be auto-cancelled");
		const note = decisionMessages(pi, "open")[0].msg.content;
		for (const part of [REQ, candidate, "w:1", "Use staging DB or fixture DB?", "Staging", "Fixture", "Migration step 3", "Writes to schema/ migration files"]) assert.ok(note.includes(part), part);
		assert.equal(decisionMessages(pi)[0].msg.details.jobId, jobId);
		assert.equal(decisionMessages(pi)[0].opts.triggerTurn, true);
	});

	test("P2 unmatched dialogs keep the auto-cancel safeguard: other titles, methods and undeclared ids", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		await startJob(pi);
		const child = children[0];
		await waitFor(() => children.length === 1, "spawn");
		child.emit(dialog("s1", REQ, "select"));
		child.emit(dialog("i2", REQ, "input", "Enter a value"));
		child.emit(dialog("i3", REQ2, "input"));
		child.emit(dialog("i4", REQ, "input", DIALOG + REQ + " extra"));
		await waitFor(() => answersFor(child, "i4").length === 1, "auto cancel");
		for (const id of ["s1", "i2", "i3", "i4"]) assert.deepEqual(answersFor(child, id)[0], { type: "extension_ui_response", id, cancelled: true });
		assert.equal(decisionMessages(pi).length, 0);
	});

	test("P3 malformed, colliding and excess announcements are rejected, reported and their dialogs cancelled", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		const first = await openRequest(pi, REQ, "dlg-1");
		const child = first.child;
		child.emit(notifyEnvelope(record(REQ2, { extra: 1 })));
		child.emit(dialog("dlg-m", REQ2));
		child.emit(notifyEnvelope(record(REQ)));
		child.emit(dialog("dlg-c", REQ));
		child.emit(notifyEnvelope(record("dec-cccccccc3333")));
		child.emit(dialog("dlg-s", "dec-cccccccc3333"));
		await waitFor(() => answersFor(child, "dlg-s").length === 1, "second open cancelled");
		assert.deepEqual(answersFor(child, "dlg-m"), [{ type: "extension_ui_response", id: "dlg-m", cancelled: true }]);
		assert.deepEqual(answersFor(child, "dlg-c"), [{ type: "extension_ui_response", id: "dlg-c", cancelled: true }]);
		assert.equal(answersFor(child, "dlg-1").length, 0, "original held dialog untouched");
		assert.ok(decisionMessages(pi, "rejected").length >= 2, "rejections reported to main");
	});

	test("P4 answer routes only to the exact dialog of its request; unknown, blank, unbasic and late answers error", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		const { child } = await openRequest(pi);
		const good = { action: "answer", target: REQ, answer: "Fixture", basis: "user_answer", reference: "ask_user:m00124" };
		assert.equal((await control(pi, { ...good, target: "dec-unknown0000" })).isError, true, "unknown");
		assert.equal((await control(pi, { ...good, answer: "   " })).isError, true, "blank");
		assert.equal((await control(pi, { ...good, basis: "guess" })).isError, true, "basis");
		assert.equal((await control(pi, { ...good, basis: "existing_authorization", reference: undefined })).isError, true, "auth needs reference");
		assert.equal((await control(pi, { ...good, reference: "" })).isError, true, "reference required");
		assert.equal(answersFor(child, "dlg-1").length, 0, "validation errors write nothing");
		const accepted = await control(pi, good);
		assert.equal(accepted.isError, undefined);
		const lines = answersFor(child, "dlg-1");
		assert.equal(lines.length, 1);
		assert.deepEqual(JSON.parse(lines[0].value), { requestId: REQ, decision: "answered", answer: "Fixture", basis: "user_answer", reference: "ask_user:m00124" });
		assert.equal((await control(pi, good)).isError, true, "late duplicate answer");
		assert.equal(answersFor(child, "dlg-1").length, 1, "exactly once");
		const declined = await openRequest(pi, REQ2, "dlg-2");
		await control(pi, { action: "decline", target: REQ2, reason: "Not needed; the task packet already fixes the target" });
		assert.deepEqual(JSON.parse(answersFor(declined.child, "dlg-2")[0].value).decision, "declined");
		assert.equal(answersFor(child, "dlg-2").length, 0, "decline never reaches another worker");
	});

	test("P5 decisions list exposes required fields and open state; pending is not reported as completed", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		const { jobId } = await openRequest(pi);
		const list = await decisionList(pi);
		const entry = list.find((d: any) => d.requestId === REQ);
		assert.ok(entry, JSON.stringify(list));
		for (const key of ["requestId", "jobId", "workerId", "candidate", "state", "question", "options", "blockedScope"]) assert.ok(key in entry, key);
		assert.equal(entry.state, "open");
		assert.equal(entry.jobId, jobId);
		const jobs = JSON.parse((await tool(pi, "subagent_control").execute("l", { action: "list" }, undefined, undefined, {})).content[0].text);
		assert.equal(jobs.find((j: any) => j.jobId === jobId).state, "running");
	});

	test("P6 cancel settles the pending request as cancelled and rejects later answers", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		const { jobId, child } = await openRequest(pi);
		await control(pi, { action: "cancel", target: jobId });
		await waitFor(() => answersFor(child, "dlg-1").length >= 1, "cancel delivered");
		assert.deepEqual(answersFor(child, "dlg-1")[0], { type: "extension_ui_response", id: "dlg-1", cancelled: true });
		assert.equal((await control(pi, { action: "answer", target: REQ, answer: "Fixture", basis: "user_answer", reference: "r" })).isError, true);
		const entry = (await decisionList(pi)).find((d: any) => d.requestId === REQ);
		assert.equal(entry.state, "settled");
		assert.equal(entry.reason, "cancelled");
	});

	test("P7 session reset settles pending requests before aborting, without hanging", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		const { child } = await openRequest(pi);
		pi.emit("session_shutdown");
		assert.deepEqual(answersFor(child, "dlg-1")[0], { type: "extension_ui_response", id: "dlg-1", cancelled: true });
		assert.equal((await decisionList(pi)).length, 0, "reset clears session state");
	});

	test("P8 worker exit settles pending as worker-exited; late answer never reaches another worker", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		const a = await openRequest(pi, REQ, "dlg-1");
		const b = await openRequest(pi, REQ2, "dlg-2");
		a.child.exit(1);
		await waitFor(() => (decisionMessages(pi, "settled")).length >= 1, "settled notice");
		assert.equal(answersFor(b.child, "dlg-1").length, 0, "other worker untouched by exit");
		const late = await control(pi, { action: "answer", target: REQ, answer: "Fixture", basis: "user_answer", reference: "r" });
		assert.equal(late.isError, true);
		assert.equal(answersFor(b.child, "dlg-1").length, 0, "late answer routed nowhere else");
		assert.equal((await decisionList(pi)).find((d: any) => d.requestId === REQ).reason, "worker-exited");
	});

	test("P9 answer while job is paused records the answer but never resumes or unpauses the job", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		const { jobId, child } = await openRequest(pi);
		await control(pi, { action: "pause", target: jobId });
		const accepted = await control(pi, { action: "answer", target: REQ, answer: "Fixture", basis: "user_answer", reference: "ask_user:m00124" });
		assert.equal(accepted.isError, undefined);
		assert.equal(answersFor(child, "dlg-1").length, 1);
		const jobs = JSON.parse((await control(pi, { action: "list" })).content[0].text);
		assert.equal(jobs.find((j: any) => j.jobId === jobId).paused, true, "still paused");
		assert.equal(children[0].lines.filter((l: any) => l.type === "extension_ui_response").length, 1);
	});

	test("P10 an unrelated job keeps running while another worker waits on a decision", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		await openRequest(pi);
		const otherJob = await startJob(pi, "Unrelated task", true);
		await waitFor(() => children.length === 2, "second spawn");
		const other = children[1];
		other.emit({ type: "agent_settled" });
		other.exit(0);
		await waitFor(() => pi.messages.some((m: any) => m.msg.customType === "subagent-completion" && m.msg.details.jobId === otherJob), "unrelated completion");
		assert.equal(answersFor(children[0], "dlg-1").length, 0, "waiting worker untouched");
	});

	test("P11 background spawn grants only request_decision and the child relay; foreground gets neither", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		await startJob(pi, "Decide the migration target", true);
		const bg = children[0];
		const tools = bg.args[bg.args.indexOf("--tools") + 1];
		assert.equal(tools, "read,grep,find,ls,edit," + TOOL);
		assert.ok(bg.args.some((a: string) => a.endsWith("decision-relay.ts")), "relay extension loaded");
		assert.equal(bg.env[ENV], "1");
		await tool(pi, "subagent").execute("fg", { agent: "test-worker", task: "Foreground", background: false, readOnly: true }, undefined, undefined, { cwd: candidate, hasUI: false });
		await waitFor(() => children.length === 2, "foreground spawn");
		const fg = children[1];
		const fgTools = fg.args[fg.args.indexOf("--tools") + 1];
		assert.equal(fgTools.includes(TOOL), false);
		assert.equal(fg.args.some((a: string) => a.endsWith("decision-relay.ts")), false);
		assert.notEqual(fg.env[ENV], "1");
	});

	test("P12 unmatched select/confirm/editor dialogs with the relay title still auto-cancel", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		await startJob(pi);
		const child = children[0];
		child.emit(dialog("c1", REQ, "confirm"));
		child.emit(dialog("e1", REQ, "editor"));
		await waitFor(() => answersFor(child, "e1").length === 1, "cancel");
		assert.equal(answersFor(child, "c1").length, 1);
	});

	// ---- Delivery: an answer is recorded only after the native stdin write callback confirms the stream write.
	function answerCall(pi: any, requestId = REQ) {
		return control(pi, { action: "answer", target: requestId, answer: "Fixture", basis: "user_answer", reference: "ask_user:m00124" });
	}
	function entryOf(list: any[], requestId = REQ) { return list.find((d: any) => d.requestId === requestId); }

	test("D1 synchronous stdin write failure: reported failed, nothing written, never recorded as answered", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		const { child } = await openRequest(pi);
		child.fault = "throw";
		const result = await answerCall(pi);
		assert.equal(result.isError, true, JSON.stringify(result));
		assert.match(result.content[0].text, /not delivered/);
		assert.equal(answersFor(child, "dlg-1").length, 0, "nothing reached the stream");
		const entry = entryOf(await decisionList(pi));
		assert.equal(entry.state, "settled");
		assert.match(entry.reason, /^delivery-failed: write threw synchronously/);
		assert.ok(decisionMessages(pi, "settled").some((m: any) => /delivery-failed/.test(m.msg.details.reason)), "main told the request failed");
		const notice = decisionMessages(pi, "settled").find((m: any) => /delivery-failed/.test(m.msg.details.reason)).msg.content;
		assert.match(notice, /parent registry is closed for this request/);
		assert.match(notice, /whether worker w:1 in job bg-1 received it or still waits on it is unconfirmed\./i);
		assert.doesNotMatch(notice, /no longer waits/);
		assert.equal((await answerCall(pi)).isError, true, "failed request stays terminal; no automatic retry");
		assert.equal(answersFor(child, "dlg-1").length, 0);
	});

	test("D2 async EPIPE callback with the stream error event: reported failed, not answered, no unhandled error", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		const { child } = await openRequest(pi);
		child.fault = "epipe";
		const result = await answerCall(pi);
		assert.equal(result.isError, true, JSON.stringify(result));
		assert.equal(answersFor(child, "dlg-1").length, 0);
		const entry = entryOf(await decisionList(pi));
		assert.equal(entry.state, "settled");
		assert.match(entry.reason, /^delivery-failed: write EPIPE/);
		assert.equal((await answerCall(pi)).isError, true);
	});

	test("D3 closed stdin is reported unavailable and settles the request as not answered", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		const { child } = await openRequest(pi);
		child.stdin.writable = false;
		const result = await answerCall(pi);
		assert.equal(result.isError, true);
		assert.match(result.content[0].text, /unavailable/);
		assert.equal(answersFor(child, "dlg-1").length, 0);
		const entry = entryOf(await decisionList(pi));
		assert.equal(entry.state, "settled");
		assert.match(entry.reason, /^delivery-failed: worker input is closed/);
	});

	test("D4 success is recorded only after the stream write callback: in flight shows delivering, not answered", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		const { child } = await openRequest(pi);
		child.hold = true;
		let resolved = false;
		const pending = answerCall(pi).then(result => { resolved = true; return result; });
		await waitFor(() => answersFor(child, "dlg-1").length === 1, "write issued");
		const inFlight = entryOf(await decisionList(pi));
		assert.equal(inFlight.state, "delivering");
		assert.equal(inFlight.reason, undefined);
		await new Promise(resolve => setTimeout(resolve, 20));
		assert.equal(resolved, false, "no success before the write callback");
		child.release();
		const result = await pending;
		assert.equal(result.isError, undefined, JSON.stringify(result));
		assert.match(result.content[0].text, /stream write confirmed/);
		const done = entryOf(await decisionList(pi));
		assert.equal(done.state, "settled");
		assert.equal(done.reason, "answered");
	});

	test("D5 duplicate answer while the first write is pending is rejected; exactly one response is written", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		const { child } = await openRequest(pi);
		child.hold = true;
		const first = answerCall(pi);
		await waitFor(() => answersFor(child, "dlg-1").length === 1, "first write issued");
		const second = await answerCall(pi);
		assert.equal(second.isError, true);
		assert.match(second.content[0].text, /already being delivered/);
		child.release();
		assert.equal((await first).isError, undefined);
		assert.equal(answersFor(child, "dlg-1").length, 1, "exactly one response written");
	});

	test("D6 cancel during an in-flight write settles once as cancelled; the late callback cannot resurrect answered", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		const { jobId, child } = await openRequest(pi);
		child.hold = true;
		const first = answerCall(pi);
		await waitFor(() => answersFor(child, "dlg-1").length === 1, "write issued");
		assert.equal((await control(pi, { action: "cancel", target: jobId })).isError, undefined);
		child.release();
		const result = await first;
		assert.equal(result.isError, true, JSON.stringify(result));
		assert.match(result.content[0].text, /settled \(cancelled\)/);
		assert.equal(answersFor(child, "dlg-1").length, 1, "cancel adds no second response on the in-flight dialog");
		const entry = entryOf(await decisionList(pi));
		assert.equal(entry.state, "settled");
		assert.equal(entry.reason, "cancelled");
		assert.equal((await answerCall(pi)).isError, true);
	});

	test("D7 session reset during an in-flight write settles once: no second response, no answered record", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		const { child } = await openRequest(pi);
		child.hold = true;
		const first = answerCall(pi);
		await waitFor(() => answersFor(child, "dlg-1").length === 1, "write issued");
		pi.emit("session_shutdown");
		child.release();
		const result = await first;
		assert.equal(result.isError, true, JSON.stringify(result));
		assert.match(result.content[0].text, /settled \(session-reset\)/);
		assert.equal(answersFor(child, "dlg-1").length, 1, "reset adds no second response");
		assert.equal((await decisionList(pi)).length, 0, "reset cleared the request");
	});

	test("D8 worker exit during an in-flight write settles as worker-exited; the late callback is never answered", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		const { child } = await openRequest(pi);
		child.hold = true;
		const first = answerCall(pi);
		await waitFor(() => answersFor(child, "dlg-1").length === 1, "write issued");
		child.exit(1);
		child.release();
		const result = await first;
		assert.equal(result.isError, true, JSON.stringify(result));
		assert.match(result.content[0].text, /settled \(worker-exited\)/);
		assert.equal(entryOf(await decisionList(pi)).reason, "worker-exited");
		assert.equal(answersFor(child, "dlg-1").length, 1, "exit adds no second response");
	});

	test("D9 ordinary UI auto-cancel with a failing stdin: cleanup runs, no unhandled error, the job still ends", async () => {
		const pi = fakePi();
		subagentExtension(pi);
		const jobId = await startJob(pi);
		await waitFor(() => children.length === 1, "spawn");
		const child = children[0];
		child.fault = "epipe";
		child.emit(dialog("s1", REQ, "select"));
		await waitFor(() => child.fault === undefined, "auto-cancel write attempted");
		child.exit(1);
		await waitFor(() => pi.messages.some((m: any) => m.msg.customType === "subagent-completion" && m.msg.details.jobId === jobId), "job completion after exit");
		assert.equal(answersFor(child, "s1").length, 0, "failed auto-cancel was not written");
	});
}
