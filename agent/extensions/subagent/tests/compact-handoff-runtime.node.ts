// Runtime regressions for compact handoffs (Node-only: registerHooks + native TS; named *.node.ts so Bun skips it).
// background.ts runs real (bounded completion, lossless explicit result). index.ts runs with the pi/fixture doubles;
// its background runtime and monitor are inline stubs, so nothing touches a live provider.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { registerHooks } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import test, { after, before, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import { BackgroundWorkers } from "../background.ts";

const indexUrl = new URL("../index.ts", import.meta.url).href;
const doublesUrl = new URL("./fixtures/runtime-doubles.mjs", import.meta.url).href;
const stubMonitorUrl = "data:text/javascript," + encodeURIComponent("export class WorkerMonitor { constructor() { this.store = { begin() { return undefined; }, started() {}, event() {}, finish() {}, records: new Map(), changed() {} }; } }");
// Launch-state stub for the provider cooldown entry: its pi-ai/compat import is not resolvable from this node test, and cooldown behavior is not under test here.
const entryStubUrl = "data:text/javascript," + encodeURIComponent("export default function providerCooldownEntry() {}\nexport function registerProviderCooldown() {}\nexport async function runProviderCooldownCommand() { return { message: '', type: 'info' }; }\nexport async function providerLaunchState() { return { state: 'launch' }; }\nexport async function guardRefusalReplayable() { return false; }");
const indexDependencies = new Set(["node:child_process", "@earendil-works/pi-ai", "typebox", "./code-integrations.ts", "./build-env.ts"]);

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === "@earendil-works/pi-coding-agent") return { url: doublesUrl, shortCircuit: true };
		if (context.parentURL === indexUrl) {
			if (specifier === "./provider-cooldown-entry.ts") return { url: entryStubUrl, shortCircuit: true };
			if (specifier === "./monitor.ts") return { url: stubMonitorUrl, shortCircuit: true };
			if (indexDependencies.has(specifier)) return { url: doublesUrl, shortCircuit: true };
		}
		return nextResolve(specifier, context);
	},
	load(url, context, nextLoad) {
		if (url === indexUrl) {
			const source = fs.readFileSync(fileURLToPath(url), "utf8");
			return { format: "module-typescript", source: `${source}\nexport { runSingleAgent };`, shortCircuit: true };
		}
		return nextLoad(url, context);
	},
});

type Event = Record<string, unknown>;
type Plan = { events?: Event[]; exitCode?: number; stderr?: string };

let spawnLog: { args: string[]; appendPrompt?: string; task: string }[] = [];
let spawnPlan: (task: string, args: string[]) => Plan = () => ({ events: [], exitCode: 0 });
// Records every child launch when its stdin prompt arrives (RPC); reads the appended system prompt while its temp file still exists.
(globalThis as { __piSubagentFakeSpawn?: (args: string[], task: string) => Plan }).__piSubagentFakeSpawn = (args, task) => {
	const flag = args.indexOf("--append-system-prompt");
	spawnLog.push({ args, appendPrompt: flag >= 0 ? fs.readFileSync(args[flag + 1], "utf8") : undefined, task });
	return spawnPlan(task, args);
};

const MODEL = "openai-codex/gpt-6.1-sol";
const usage = { input: 2, output: 3, totalTokens: 5, cacheRead: 0, cacheWrite: 0, cost: { total: 0.25 } };
function reply(blocks: string[]): Event {
	return { type: "message_end", message: { role: "assistant", content: blocks.map((text) => ({ type: "text", text })), stopReason: "stop", usage } };
}
function replyWith(stopReason: string, blocks: string[]): Event {
	return { type: "message_end", message: { role: "assistant", content: blocks.map((text) => ({ type: "text", text })), stopReason, usage } };
}

let tool: { description: string; execute: (...args: unknown[]) => Promise<any> } | undefined;
const sentIntegration: any[] = []; // background completions sent through pi.sendMessage
const capturedTools = new Map<string, any>(); // every registered tool, e.g. subagent_control
let indexModule: { default: (pi: unknown) => void };
const created: string[] = [];
const originalAgentDir = process.env.PI_CODING_AGENT_DIR;

before(async () => {
	indexModule = await import(indexUrl);
});

// Only registerTool is needed; every other pi registration is a no-op. Registration captures the role list, so it runs after roles exist.
function registerTool() {
	const pi = new Proxy({}, { get: (_target, prop) => (prop === "registerTool" ? (def: typeof tool & { name: string }) => { capturedTools.set(def.name, def); if (def.name === "subagent") tool = def; } : prop === "sendMessage" ? (message: unknown) => { sentIntegration.push(message); return Promise.resolve(); } : () => undefined) });
	indexModule.default(pi);
}

beforeEach(() => {
	spawnLog = [];
	spawnPlan = () => ({ events: [], exitCode: 0 });
});

after(() => {
	if (originalAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
	else process.env.PI_CODING_AGENT_DIR = originalAgentDir;
	for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
});

// Registers the user roles, then points getAgentDir at them. The tool description is captured at registration, so this runs first.
function setupRoles(roles: Record<string, string>, extraFrontmatter = "") {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "subagent-compact-"));
	created.push(root);
	const userDir = path.join(root, "user");
	fs.mkdirSync(path.join(userDir, "agents"), { recursive: true });
	for (const [name, body] of Object.entries(roles)) {
		fs.writeFileSync(path.join(userDir, "agents", `${name}.md`), `---\nname: ${name}\ndescription: test role ${name}\nmodel: ${MODEL}\n${extraFrontmatter}---\n${body}\n`);
	}
	process.env.PI_CODING_AGENT_DIR = userDir;
	registerTool();
	return root;
}

function context(cwd: string) {
	return { cwd, model: undefined, thinkingLevel: undefined, hasUI: false, isProjectTrusted: () => true, modelRegistry: undefined };
}

test("tool description keeps every user role name discoverable without the 22-role description prose", async () => {
	setupRoles({ "chain-one": "You are chain-one.", "chain-two": "You are chain-two." });
	const description = tool?.description ?? "";
	assert.match(description, /Available user roles: /);
	assert.match(description, /chain-one/);
	assert.match(description, /chain-two/);
	assert.doesNotMatch(description, /test role chain-one/);
});

test("child system prompt carries the compact handoff guidance after the role prompt", async () => {
	const root = setupRoles({ "guided": "You are guided." });
	spawnPlan = () => ({ events: [reply(["STATUS: PASS"])], exitCode: 0 });
	await tool!.execute("call-guide", { agent: "guided", task: "check", background: false }, undefined, undefined, context(root));
	const prompt = spawnLog.find((entry) => entry.appendPrompt)?.appendPrompt ?? "";
	assert.match(prompt, /^You are guided\./);
	assert.match(prompt, /## Final handoff to main/);
	assert.match(prompt, /^STATUS: PASS \| FAIL \| BLOCKED \| ESCALATE$/m);
});

test("foreground single output stays full and unbounded", async () => {
	const root = setupRoles({ "long-report": "You are long-report." });
	const report = "detail line that repeats\n".repeat(400) + "CHECKS: npm test PASS";
	assert.ok(report.length > 4000);
	spawnPlan = () => ({ events: [reply([report])], exitCode: 0 });
	const result = await tool!.execute("call-long", { agent: "long-report", task: "report", background: false }, undefined, undefined, context(root));
	assert.equal(result.content[0].text, report);
	assert.doesNotMatch(result.content[0].text, /INCOMPLETE/);
});

test("chain step receives every text block of the previous step, not only the first", async () => {
	const root = setupRoles({ "step-one": "You are step-one.", "step-two": "You are step-two." });
	spawnPlan = (task) => (task.includes("produce")
		? { events: [reply(["ALPHA-FACT: 42 failing tests", "BETA-FACT: migration blocked on tenant 7"])], exitCode: 0 }
		: { events: [reply(["done"])], exitCode: 0 });
	await tool!.execute("call-chain", { chain: [{ agent: "step-one", task: "produce evidence" }, { agent: "step-two", task: "use: {previous}" }], background: false }, undefined, undefined, context(root));
	const second = spawnLog.map((entry) => entry.task).find((task) => task.includes("use:"));
	assert.ok(second, "second step launched");
	assert.match(second!, /ALPHA-FACT: 42 failing tests/);
	assert.match(second!, /BETA-FACT: migration blocked on tenant 7/);
});

test("chain: every {previous} occurrence receives the literal prior report, with replacement-pattern text and a >50KB tail intact", async () => {
	const root = setupRoles({ "step-one": "You are step-one.", "step-two": "You are step-two." });
	const tail = "detail line for the uncapped foreground chain\n".repeat(1200);
	const report = "tokens: cost $& and $$ and $' and $` end\nunicode: café — 漢字 😀 ✓\n" + tail + "CHECKS: npm test PASS";
	assert.ok(report.length > 50_000);
	const stepTwoTask = "first {previous} | $& marker | second {previous} end";
	spawnPlan = (task) => (task.includes("produce") ? { events: [reply([report])], exitCode: 0 } : { events: [reply(["done"])], exitCode: 0 });
	const result = await tool!.execute("call-chain-literal", { chain: [{ agent: "step-one", task: "produce evidence" }, { agent: "step-two", task: stepTwoTask }], background: false }, undefined, undefined, context(root));
	assert.notEqual(result.isError, true);
	const expected = "Task: " + `first ${report} | $& marker | second ${report} end`;
	const second = spawnLog.map((entry) => entry.task).find((task) => task.includes("marker"));
	assert.equal(second?.length, expected.length, "step-2 task length");
	assert.ok(second === expected, "step-2 task must equal the literal substitution byte-for-byte");
});

test("foreground single: exit 0 with stopReason length is INCOMPLETE, not success, and keeps the full text", async () => {
	const root = setupRoles({ "cut-off": "You are cut-off." });
	const partial = "partial detail line\n".repeat(50) + "CHECKS: pending";
	spawnPlan = () => ({ events: [replyWith("length", [partial])], exitCode: 0 });
	const result = await tool!.execute("call-length", { agent: "cut-off", task: "report", background: false }, undefined, undefined, context(root));
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /^Agent INCOMPLETE \(length\): /);
	assert.ok(result.content[0].text.endsWith(partial));
});

test("parser: a later assistant without a stop reason clears an earlier completed stop and is INCOMPLETE", async () => {
	const root = setupRoles({ "stale": "You are stale." });
	const tail = { type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "unfinished second response" }], usage } };
	spawnPlan = () => ({ events: [reply(["completed earlier response"]), tail], exitCode: 0 });
	const result = await tool!.execute("call-stale", { agent: "stale", task: "report", background: false }, undefined, undefined, context(root));
	assert.equal(result.isError, true);
	assert.equal(result.content[0].text, "Agent INCOMPLETE (no terminal stopReason): unfinished second response");
});

test("parser: an earlier terminal errorMessage is cleared when the latest assistant has none (not a stale failure)", async () => {
	const root = setupRoles({ "stale-diagnostic": "You are stale-diagnostic." });
	const tail = { type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "unfinished second response" }], usage } };
	spawnPlan = () => ({ events: [{ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "first attempt" }], stopReason: "length", errorMessage: "stale diagnostic", usage } }, tail], exitCode: 0 });
	const result = await tool!.execute("call-stale-diagnostic", { agent: "stale-diagnostic", task: "report", background: false }, undefined, undefined, context(root));
	assert.equal(result.details.results[0].errorMessage, undefined);
	assert.equal(result.content[0].text, "Agent INCOMPLETE (no terminal stopReason): unfinished second response");
});

test("parser: an earlier toolUse message does not block a later terminal stop from completing", async () => {
	const root = setupRoles({ "tool-then-stop": "You are tool-then-stop." });
	spawnPlan = () => ({ events: [replyWith("toolUse", ["calling a tool"]), reply(["final answer"])], exitCode: 0 });
	const result = await tool!.execute("call-tool-then-stop", { agent: "tool-then-stop", task: "report", background: false }, undefined, undefined, context(root));
	assert.notEqual(result.isError, true);
	assert.equal(result.content[0].text, "final answer");
});

test("parser: a tool-call-only toolUse tail is INCOMPLETE and keeps every text block of the latest text-bearing report", async () => {
	const root = setupRoles({ "tool-tail": "You are tool-tail." });
	const toolOnly = { type: "message_end", message: { role: "assistant", content: [{ type: "toolCall", id: "call-1", name: "bash", arguments: {} }], stopReason: "toolUse", usage } };
	spawnPlan = () => ({ events: [reply(["completed earlier response"]), replyWith("toolUse", ["partial A", "partial B"]), toolOnly], exitCode: 0 });
	const result = await tool!.execute("call-tool-tail", { agent: "tool-tail", task: "report", background: false }, undefined, undefined, context(root));
	assert.equal(result.isError, true);
	assert.equal(result.content[0].text, "Agent INCOMPLETE (toolUse): partial A\npartial B");
});

test("foreground single: INCOMPLETE keeps the partial text together with the terminal errorMessage", async () => {
	const root = setupRoles({ "diagnostic": "You are diagnostic." });
	spawnPlan = () => ({ events: [{ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "partial report" }], stopReason: "length", errorMessage: "terminal diagnostic", usage } }], exitCode: 0 });
	const result = await tool!.execute("call-diagnostic", { agent: "diagnostic", task: "report", background: false }, undefined, undefined, context(root));
	assert.equal(result.isError, true);
	assert.equal(result.content[0].text, "Agent INCOMPLETE (length): partial report\n\nERROR: terminal diagnostic");
});

test("foreground single: INCOMPLETE without text still reports the terminal errorMessage", async () => {
	const root = setupRoles({ "silent-diagnostic": "You are silent-diagnostic." });
	spawnPlan = () => ({ events: [{ type: "message_end", message: { role: "assistant", content: [], stopReason: "length", errorMessage: "terminal diagnostic", usage } }], exitCode: 0 });
	const result = await tool!.execute("call-silent-diagnostic", { agent: "silent-diagnostic", task: "report", background: false }, undefined, undefined, context(root));
	assert.equal(result.isError, true);
	assert.equal(result.content[0].text, "Agent INCOMPLETE (length): ERROR: terminal diagnostic");
});

test("parser: an empty or whitespace text block in the latest toolUse message keeps the earlier partial report", async () => {
	const root = setupRoles({ "blank-tail": "You are blank-tail." });
	for (const blank of ["", " \n "]) {
		const blankTail = { type: "message_end", message: { role: "assistant", content: [{ type: "text", text: blank }, { type: "toolCall", id: "call-blank", name: "bash", arguments: {} }], stopReason: "toolUse", usage } };
		spawnPlan = () => ({ events: [replyWith("toolUse", ["PARTIAL-REPORT"]), blankTail], exitCode: 0 });
		const result = await tool!.execute("call-blank-tail", { agent: "blank-tail", task: "report", background: false }, undefined, undefined, context(root));
		assert.equal(result.isError, true);
		assert.equal(result.content[0].text, "Agent INCOMPLETE (toolUse): PARTIAL-REPORT");
	}
});

test("foreground single: INCOMPLETE keeps a terminal errorMessage that earlier prose only mentions", async () => {
	const root = setupRoles({ "prose-mention": "You are prose-mention." });
	spawnPlan = () => ({ events: [{ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "Recovered from earlier Connection closed; remaining checks pending." }], stopReason: "length", errorMessage: "Connection closed", usage } }], exitCode: 0 });
	const result = await tool!.execute("call-prose-mention", { agent: "prose-mention", task: "report", background: false }, undefined, undefined, context(root));
	assert.equal(result.isError, true);
	assert.equal(result.content[0].text, "Agent INCOMPLETE (length): Recovered from earlier Connection closed; remaining checks pending.\n\nERROR: Connection closed");
});

test("foreground single: exit 0 with no terminal assistant stopReason is INCOMPLETE, never green", async () => {
	const root = setupRoles({ "silent": "You are silent." });
	const result = await tool!.execute("call-silent", { agent: "silent", task: "report", background: false }, undefined, undefined, context(root));
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /^Agent INCOMPLETE \(no terminal stopReason\): /);
});

test("parallel: an exit 0 length child fails the batch as INCOMPLETE and keeps its full text", async () => {
	const root = setupRoles({ "cut-off": "You are cut-off.", "steady": "You are steady." });
	spawnPlan = (task) => (task.includes("cut")
		? { events: [replyWith("length", ["partial CHECKS: pending"])], exitCode: 0 }
		: { events: [reply(["STATUS: PASS"])], exitCode: 0 });
	const result = await tool!.execute("call-parallel-length", { tasks: [{ agent: "cut-off", task: "cut" }, { agent: "steady", task: "steady" }], background: false }, undefined, undefined, context(root));
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /Parallel: 1\/2 succeeded/);
	assert.match(result.content[0].text, /### \[cut-off\] INCOMPLETE \(length\)\n\npartial CHECKS: pending/);
});

test("chain: an exit 0 length step stops the chain before step 2 is launched", async () => {
	const root = setupRoles({ "step-one": "You are step-one.", "step-two": "You are step-two." });
	spawnPlan = () => ({ events: [replyWith("length", ["half a report"])], exitCode: 0 });
	const result = await tool!.execute("call-chain-length", { chain: [{ agent: "step-one", task: "produce" }, { agent: "step-two", task: "use: {previous}" }], background: false }, undefined, undefined, context(root));
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /^Chain stopped at step 1 \(step-one\): half a report/);
	assert.equal(spawnLog.length, 1);
});

// Real background.ts (bounded automatic completion; explicit lossless result).
function fakePi() {
	const sent: { content: string }[] = [];
	return { sent, on() {}, sendMessage(message: { content: string }) { sent.push(message); return Promise.resolve(); } };
}
const monitor = { store: { records: new Map(), changed() {} } };
async function waitFor(predicate: () => boolean) {
	for (let i = 0; i < 1000 && !predicate(); i++) await new Promise((resolve) => setTimeout(resolve, 2));
	assert.ok(predicate(), "condition reached");
}

test("automatic background completion is bounded with an explicit INCOMPLETE recovery command", async () => {
	const pi = fakePi();
	const runtime = new BackgroundWorkers(pi as never, monitor as never);
	const big = "detail\n".repeat(2000) + "RISKS: FAILED migration on tenant 7\n";
	const job = runtime.start(async () => ({ content: [{ type: "text", text: big }], details: { results: [{ agent: "backend-worker", exitCode: 0, messages: [{ role: "assistant", content: [{ type: "text", text: big }] }] }] } }));
	await waitFor(() => pi.sent.length === 1);
	const content = pi.sent[0].content;
	assert.ok(content.length <= 4000, `length ${content.length}`);
	assert.match(content, /INCOMPLETE HANDOFF/);
	assert.ok(content.includes(`subagent_control action "result" target "${job.id}"`));
	assert.ok(content.includes("RISKS: FAILED migration on tenant 7"));
});

test("explicit result returns every text block of the retained child report, losslessly", async () => {
	const pi = fakePi();
	const runtime = new BackgroundWorkers(pi as never, monitor as never);
	const partOne = "part one: " + "x".repeat(5000);
	const partTwo = "part two: CHECKS npm test PASS";
	const job = runtime.start(async () => ({
		content: [{ type: "text", text: partOne }],
		details: { results: [{ agent: "backend-worker", exitCode: 0, stopReason: "stop", messages: [{ role: "assistant", content: [{ type: "text", text: partOne }, { type: "text", text: partTwo }] }] }] },
	}));
	await waitFor(() => pi.sent.length === 1);
	const result = runtime.result(job.id);
	assert.equal(result.isError, undefined);
	assert.equal(result.content[0].text, `### backend-worker \u2014 completed\n${partOne}\n${partTwo}`);
	assert.equal(result.details.results.length, 1);
});

test("explicit result reports a failed child as FAILED/STOPPED with its error and keeps isError", async () => {
	const pi = fakePi();
	const runtime = new BackgroundWorkers(pi as never, monitor as never);
	const job = runtime.start(async () => ({
		isError: true,
		content: [{ type: "text", text: "Agent error: 503" }],
		details: { results: [{ agent: "debugger", exitCode: 1, stopReason: "error", errorMessage: "503 provider unavailable", messages: [] }] },
	}));
	await waitFor(() => pi.sent.length === 1);
	const result = runtime.result(job.id);
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /### debugger \u2014 FAILED\/STOPPED\nERROR: 503 provider unavailable/);
});

test("launch errors and running jobs keep their existing explicit result shape", async () => {
	const pi = fakePi();
	const runtime = new BackgroundWorkers(pi as never, monitor as never);
	const failed = runtime.start(async () => { throw new Error("boom"); });
	await waitFor(() => pi.sent.length === 1);
	const launch = runtime.result(failed.id);
	assert.equal(launch.isError, true);
	assert.match(launch.content[0].text, /boom/);

	const running = runtime.start(() => new Promise(() => undefined));
	assert.match(runtime.result(running.id).content[0].text, /is still running/);
});

test("background tool -> real BackgroundWorkers job fails on INCOMPLETE; explicit result keeps partial text and diagnostics", async () => {
	const root = setupRoles({ "rpc-cut": "You are rpc-cut." });
	const partial = "first text\n".repeat(600);
	sentIntegration.length = 0;
	spawnPlan = () => ({ events: [{ type: "response", id: "control-1", success: true, data: { disposition: "started" } }, { type: "message_end", message: { role: "assistant", content: [{ type: "text", text: partial }, { type: "text", text: "last block" }], stopReason: "length", errorMessage: "terminal diagnostic", usage } }, { type: "agent_settled", aborted: false }], exitCode: 0 });
	const launch = await tool!.execute("bg-diagnostic", { agent: "rpc-cut", task: "offline", background: true }, undefined, undefined, context(root));
	await waitFor(() => sentIntegration.length === 1);
	assert.equal(sentIntegration[0].details.state, "failed");
	assert.ok(sentIntegration[0].content.length <= 4000);
	assert.match(sentIntegration[0].content, /INCOMPLETE HANDOFF/);
	const recovered = await capturedTools.get("subagent_control").execute("bg-diagnostic-result", { action: "result", target: launch.details.jobId }, undefined, undefined, context(root));
	assert.equal(recovered.isError, true);
	assert.equal(recovered.content[0].text, `### rpc-cut \u2014 INCOMPLETE (length)\n${partial}\nlast block\n\nERROR: terminal diagnostic`);
});

test("background INCOMPLETE child: job settles failed and the explicit result names INCOMPLETE with the full text", async () => {
	const pi = fakePi();
	const runtime = new BackgroundWorkers(pi as never, monitor as never);
	const cut = "cut report: " + "x".repeat(3000);
	const job = runtime.start(async () => ({
		isError: true,
		content: [{ type: "text", text: `Agent INCOMPLETE (length): ${cut}` }],
		details: { results: [{ agent: "backend-worker", exitCode: 0, stopReason: "length", messages: [{ role: "assistant", content: [{ type: "text", text: cut }] }] }] },
	}));
	await waitFor(() => pi.sent.length === 1);
	assert.equal(runtime.list().find((entry) => entry.jobId === job.id)?.state, "failed");
	const result = runtime.result(job.id);
	assert.equal(result.isError, true);
	assert.equal(result.content[0].text, `### backend-worker \u2014 INCOMPLETE (length)\n${cut}`);
});

// Failed-child diagnostics: errorMessage, distinct stderr and partial text reach the model-visible output (foreground and explicit result).
const FALLBACK = "openai-codex/gpt-6-luna";
function failedReply(text = "partial report FINAL-TEXT"): Event {
	return { type: "message_end", message: { role: "assistant", content: [{ type: "text", text }], stopReason: "error", errorMessage: "503 unavailable", usage } };
}
function rateLimited(): Event {
	return { type: "message_end", message: { role: "assistant", content: [], stopReason: "error", errorMessage: "429 rate limit", usage } };
}

test("foreground single: a failed child keeps its errorMessage, distinct stderr and partial text", async () => {
	const root = setupRoles({ "fg-fail": "You are fg-fail." });
	spawnPlan = () => ({ events: [failedReply()], exitCode: 1, stderr: "stderr-detail-XYZ" });
	const result = await tool!.execute("call-fg-fail", { agent: "fg-fail", task: "report", background: false }, undefined, undefined, context(root));
	assert.equal(result.isError, true);
	assert.equal(result.content[0].text, "Agent error: 503 unavailable\n\nSTDERR: stderr-detail-XYZ\n\npartial report FINAL-TEXT");
});

test("chain: a failed step keeps its stderr and partial text in the Chain stopped message", async () => {
	const root = setupRoles({ "c1": "You are c1.", "c2": "You are c2." });
	spawnPlan = () => ({ events: [failedReply()], exitCode: 1, stderr: "stderr-detail-XYZ" });
	const result = await tool!.execute("call-chain-fail", { chain: [{ agent: "c1", task: "produce" }, { agent: "c2", task: "use: {previous}" }], background: false }, undefined, undefined, context(root));
	assert.equal(result.isError, true);
	assert.equal(result.content[0].text, "Chain stopped at step 1 (c1): 503 unavailable\n\nSTDERR: stderr-detail-XYZ\n\npartial report FINAL-TEXT");
	assert.equal(spawnLog.length, 1);
});

test("parallel: a failed task keeps its stderr and partial text under its heading", async () => {
	const root = setupRoles({ "p1": "You are p1." });
	spawnPlan = () => ({ events: [failedReply()], exitCode: 1, stderr: "stderr-detail-XYZ" });
	const result = await tool!.execute("call-parallel-fail", { tasks: [{ agent: "p1", task: "t" }], background: false }, undefined, undefined, context(root));
	assert.equal(result.content[0].text, "Parallel: 0/1 succeeded\n\n### [p1] failed (error)\n\n503 unavailable\n\nSTDERR: stderr-detail-XYZ\n\npartial report FINAL-TEXT");
});

test("foreground parallel: a failed task over 60KB keeps its full tail and distinct diagnostics", async () => {
	const root = setupRoles({ "big-fail": "You are big-fail." });
	const body = "L".repeat(60 * 1024) + " TAIL-MARKER";
	spawnPlan = () => ({ events: [failedReply(body)], exitCode: 1, stderr: "stderr-detail-XYZ" });
	const result = await tool!.execute("call-big-fail", { tasks: [{ agent: "big-fail", task: "t" }], background: false }, undefined, undefined, context(root));
	const output = result.content[0].text;
	assert.ok(output.startsWith("Parallel: 0/1 succeeded\n\n### [big-fail] failed (error)\n\n503 unavailable\n\nSTDERR: stderr-detail-XYZ\n\n"), "heading and diagnostics kept");
	assert.ok(output.endsWith(body), "tail kept");
	assert.doesNotMatch(output, /Output truncated/);
});

test("foreground parallel: a successful task over 50KB is returned in full, not truncated", async () => {
	const root = setupRoles({ "big-ok": "You are big-ok." });
	const body = "L".repeat(60 * 1024) + " TAIL-MARKER";
	spawnPlan = () => ({ events: [reply([body])], exitCode: 0 });
	const result = await tool!.execute("call-big-ok", { tasks: [{ agent: "big-ok", task: "t" }], background: false }, undefined, undefined, context(root));
	assert.equal(result.content[0].text, `Parallel: 1/1 succeeded\n\n### [big-ok] completed\n\n${body}`);
});

test("foreground single: when the fallback also fails, both attempts' errors and stderr reach the model-visible failure", async () => {
	const root = setupRoles({ "fb": "You are fb." }, `fallbackModel: "${FALLBACK}"\n`);
	spawnPlan = (_task, args) => (args.includes(FALLBACK)
		? { events: [rateLimited()], exitCode: 1, stderr: "fallback-stderr-BBB" }
		: { events: [rateLimited()], exitCode: 1, stderr: "primary-stderr-AAA" });
	const result = await tool!.execute("call-fb", { agent: "fb", task: "report", background: false }, undefined, undefined, context(root));
	assert.deepEqual(spawnLog.map((entry) => entry.args[entry.args.indexOf("--model") + 1]), [MODEL, FALLBACK]);
	assert.equal(result.isError, true);
	assert.equal(result.content[0].text, `Agent error: 429 rate limit\n\nSTDERR: Model ${MODEL} failed; retried with ${FALLBACK}. 429 rate limit\n\nSTDERR: primary-stderr-AAA\nfallback-stderr-BBB`);
});

test("background failed child: explicit result keeps errorMessage, distinct stderr and partial text", async () => {
	const root = setupRoles({ "rpc-fail": "You are rpc-fail." });
	sentIntegration.length = 0;
	spawnPlan = () => ({ events: [{ type: "response", id: "control-1", success: true, data: { disposition: "started" } }, failedReply(), { type: "agent_settled", aborted: false }], exitCode: 1, stderr: "stderr-detail-XYZ" });
	const launch = await tool!.execute("bg-fail", { agent: "rpc-fail", task: "offline", background: true }, undefined, undefined, context(root));
	await waitFor(() => sentIntegration.length === 1);
	const recovered = await capturedTools.get("subagent_control").execute("bg-fail-result", { action: "result", target: launch.details.jobId }, undefined, undefined, context(root));
	assert.equal(recovered.isError, true);
	assert.equal(recovered.content[0].text, "### rpc-fail \u2014 FAILED/STOPPED\nERROR: 503 unavailable\nSTDERR: stderr-detail-XYZ\npartial report FINAL-TEXT");
});
