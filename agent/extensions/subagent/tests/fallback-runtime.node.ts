// Discovery -> runtime regression for ordered fallback chains.
// Node-only (registerHooks, native TS): named *.node.ts so Bun auto-discovery skips it; tests/fallback-runtime.test.ts launches it under node --test.
// Real agents.ts discovery feeds real index.ts runSingleAgent; only the pi package, child_process and unrelated extension imports are doubled.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { registerHooks } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import test, { after, before, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import type { AgentConfig } from "../agents.ts";

const agentsUrl = new URL("../agents.ts", import.meta.url).href;
const indexUrl = new URL("../index.ts", import.meta.url).href;
const doublesUrl = new URL("./fixtures/runtime-doubles.mjs", import.meta.url).href;
const indexDependencies = new Set([
	"node:child_process",
	"@earendil-works/pi-ai",
	"typebox",
	"./monitor.ts",
	"./code-integrations.ts",
	"./build-env.ts",
]);

// Launch-state stub for the provider cooldown entry: its pi-ai/compat import is not resolvable from this node test.
const entryStubUrl = `data:text/javascript,${encodeURIComponent(
	"export default function providerCooldownEntry() {}\nexport function registerProviderCooldown() {}\nexport async function runProviderCooldownCommand() { return { message: '', type: 'info' }; }\nexport async function providerLaunchState(model) { return globalThis.__piProviderLaunch(model); }\nexport async function guardRefusalReplayable(model, errorMessage) { return globalThis.__piGuardRefusal(model, errorMessage); }",
)}`;

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === "@earendil-works/pi-coding-agent") return { url: doublesUrl, shortCircuit: true };
		if (context.parentURL === indexUrl && specifier === "./provider-cooldown-entry.ts") return { url: entryStubUrl, shortCircuit: true };
		if (context.parentURL === indexUrl && indexDependencies.has(specifier)) return { url: doublesUrl, shortCircuit: true };
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

type Event = Record<string, unknown>;
interface SpawnPlan {
	events?: Event[];
	exitCode?: number;
	hang?: boolean;
	afterSpawn?: () => void;
}
interface Usage {
	input: number;
	output: number;
	totalTokens: number;
	cacheRead: number;
	cacheWrite: number;
	cost: { total: number };
}
interface RunResult {
	exitCode: number;
	model?: string;
	stderr: string;
	agentSource: string;
	usage: Record<string, number>;
}

let discoverAgents: typeof import("../agents.ts").discoverAgents;
let runSingleAgent: (...args: unknown[]) => Promise<RunResult>;
let attempts: string[] = [];
let spawnPlan: (model: string) => SpawnPlan = () => success();
// Launch state per declared model; the default launches everything (provider cooldown entry stub).
let launchPlan: (model: string) => { state: string; replayable?: boolean } = () => ({ state: "launch" });
(globalThis as { __piProviderLaunch?: (model: string) => unknown }).__piProviderLaunch = (model) => launchPlan(model);
// The parent's own store verdict on a child's guard refusal (provider-cooldown-entry guardRefusalReplayable stub).
let guardPlan: (model: string, message?: string) => boolean = () => false;
(globalThis as { __piGuardRefusal?: (model: string, message?: string) => boolean }).__piGuardRefusal = (model, message) => guardPlan(model, message);

// Records every child launch in order; the model is the value following --model.
(globalThis as { __piSubagentFakeSpawn?: (args: string[]) => SpawnPlan }).__piSubagentFakeSpawn = (args) => {
	const model = args[args.indexOf("--model") + 1];
	attempts.push(model);
	return spawnPlan(model);
};

const PRIMARY = "openai-codex/gpt-6.1-sol";
const LUNA = "openai-codex/gpt-6-luna";
const COPILOT_LUNA = "github-copilot/gpt-6-luna";
const COPILOT_SOL = "github-copilot/gpt-6-sol";

function usage(input: number, output: number, totalTokens: number, cost: number, cacheRead = 0, cacheWrite = 0): Usage {
	return { input, output, totalTokens, cacheRead, cacheWrite, cost: { total: cost } };
}
function assistant(stopReason: string, text: string, errorMessage?: string, tokens: Usage = usage(2, 3, 5, 0.25)): Event {
	return { type: "message_end", message: { role: "assistant", content: text ? [{ type: "text", text }] : [], stopReason, errorMessage, usage: tokens } };
}
function success(tokens?: Usage): SpawnPlan {
	return { events: [assistant("stop", "done", undefined, tokens)], exitCode: 0 };
}
function unavailable(message = "503 provider unavailable", tokens?: Usage): SpawnPlan {
	return { events: [assistant("error", "", message, tokens)], exitCode: 1 };
}

const created: string[] = [];
const originalAgentDir = process.env.PI_CODING_AGENT_DIR;

before(async () => {
	({ discoverAgents } = await import(agentsUrl));
	({ runSingleAgent } = await import(indexUrl));
});

beforeEach(() => {
	attempts = [];
	spawnPlan = () => success();
	launchPlan = () => ({ state: "launch" });
	guardPlan = () => false;
});

after(() => {
	if (originalAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
	else process.env.PI_CODING_AGENT_DIR = originalAgentDir;
	for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
});

function setupRoots() {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "subagent-fallback-"));
	created.push(root);
	const userDir = path.join(root, "user");
	const project = path.join(root, "project");
	const nested = path.join(project, "nested");
	fs.mkdirSync(path.join(userDir, "agents"), { recursive: true });
	fs.mkdirSync(nested, { recursive: true });
	process.env.PI_CODING_AGENT_DIR = userDir;
	return { userDir, userAgents: path.join(userDir, "agents"), project, nested };
}

// Frontmatter values are written verbatim: quote values containing "||" or empty strings.
function writeRole(dir: string, name: string, fields: Record<string, string>) {
	fs.mkdirSync(dir, { recursive: true });
	const lines = Object.entries({ name, description: "test role", ...fields }).map(([key, value]) => `${key}: ${value}`);
	fs.writeFileSync(path.join(dir, `${name}.md`), `---\n${lines.join("\n")}\n---\n`);
}

function discover(cwd: string, scope: "user" | "project" | "both" = "user"): AgentConfig[] {
	return discoverAgents(cwd, scope).agents;
}

function run(cwd: string, agents: AgentConfig[], name: string, signal?: AbortSignal): Promise<RunResult> {
	return runSingleAgent(cwd, {}, agents, name, "task", undefined, undefined, signal, undefined, (results: unknown[]) => ({ results }));
}

test("successful primary runs once for absent, empty and populated fallback sources", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "plain", { model: PRIMARY });
	writeRole(fx.userAgents, "empty", { model: PRIMARY, fallbackModel: '""' });
	writeRole(fx.userAgents, "chain", { model: PRIMARY, fallbackModel: `"${LUNA} || ${COPILOT_LUNA}"` });
	const agents = discover(fx.nested);
	for (const name of ["plain", "empty", "chain"]) {
		attempts = [];
		const result = await run(fx.nested, agents, name);
		assert.equal(result.exitCode, 0, name);
		assert.deepEqual(attempts, [PRIMARY], name);
	}
});

test("primary is matched literally and duplicate chain entries are skipped", async () => {
	const fx = setupRoots();
	const PRIMARY_55 = "github-copilot/claude-sonnet-5.5";
	const SONNET_5 = "github-copilot/claude-sonnet-5";
	writeRole(fx.userAgents, "dedupe", {
		model: PRIMARY_55,
		fallbackModel: `"${PRIMARY_55} || ${SONNET_5} || ${LUNA} || ${LUNA} || ${COPILOT_LUNA}"`,
	});
	spawnPlan = (model) => ([PRIMARY_55, SONNET_5, LUNA].includes(model) ? unavailable() : success());
	const result = await run(fx.nested, discover(fx.nested), "dedupe");
	assert.deepEqual(attempts, [PRIMARY_55, SONNET_5, LUNA, COPILOT_LUNA]);
	assert.equal(result.exitCode, 0);
	assert.equal(result.model, COPILOT_LUNA);
});

test("ordered availability failures advance one fallback at a time and stop at exhaustion", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "ordered", { model: PRIMARY, fallbackModel: `"${LUNA} || ${COPILOT_LUNA} || ${COPILOT_SOL}"` });
	spawnPlan = () => unavailable("429 rate limit");
	const result = await run(fx.nested, discover(fx.nested), "ordered");
	assert.deepEqual(attempts, [PRIMARY, LUNA, COPILOT_LUNA, COPILOT_SOL]);
	assert.equal(result.exitCode, 1);
	assert.equal(result.model, COPILOT_SOL);
	assert.equal(result.stderr.split("retried with").length - 1, 3);
});

test("a later fallback can succeed after earlier availability failures", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "later", { model: PRIMARY, fallbackModel: `"${LUNA} || ${COPILOT_LUNA} || ${COPILOT_SOL}"` });
	spawnPlan = (model) => (model === COPILOT_LUNA ? success() : unavailable());
	const result = await run(fx.nested, discover(fx.nested), "later");
	assert.deepEqual(attempts, [PRIMARY, LUNA, COPILOT_LUNA]);
	assert.equal(result.exitCode, 0);
	assert.equal(result.model, COPILOT_LUNA);
});

test("task failures, tool activity and aborted stop reasons never reach the fallback chain", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "guarded", { model: PRIMARY, fallbackModel: `"${LUNA} || ${COPILOT_LUNA}"` });
	const agents = discover(fx.nested);

	spawnPlan = () => ({ events: [assistant("error", "", "test failed")], exitCode: 1 });
	await run(fx.nested, agents, "guarded");
	assert.deepEqual(attempts, [PRIMARY]);

	attempts = [];
	spawnPlan = () => ({ events: [{ type: "tool_execution_start" }, assistant("error", "", "503 unavailable")], exitCode: 1 });
	await run(fx.nested, agents, "guarded");
	assert.deepEqual(attempts, [PRIMARY]);

	attempts = [];
	spawnPlan = () => ({ events: [assistant("aborted", "", "503 unavailable")], exitCode: 1 });
	await run(fx.nested, agents, "guarded");
	assert.deepEqual(attempts, [PRIMARY]);
});

test("an INCOMPLETE stop with provider-looking text never reaches the fallback chain", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "cut-short", { model: PRIMARY, fallbackModel: `"${LUNA} || ${COPILOT_LUNA}"` });
	const agents = discover(fx.nested);
	spawnPlan = () => ({ events: [assistant("length", "partial", "429 Too Many Requests")], exitCode: 1 });
	await run(fx.nested, agents, "cut-short");
	assert.deepEqual(attempts, [PRIMARY]);
	attempts = [];
	spawnPlan = () => ({ events: [assistant("length", "partial", "429 Too Many Requests")], exitCode: 0 });
	await run(fx.nested, agents, "cut-short");
	assert.deepEqual(attempts, [PRIMARY]);
});

test("tool activity during a fallback stops the chain at that fallback", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "midchain", { model: PRIMARY, fallbackModel: `"${LUNA} || ${COPILOT_LUNA}"` });
	spawnPlan = (model) =>
		model === LUNA ? { events: [{ type: "tool_execution_start" }, assistant("error", "", "503 unavailable")], exitCode: 1 } : unavailable();
	const result = await run(fx.nested, discover(fx.nested), "midchain");
	assert.deepEqual(attempts, [PRIMARY, LUNA]);
	assert.equal(result.exitCode, 1);
});

test("an external abort during the primary rejects without launching fallbacks", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "abortable", { model: PRIMARY, fallbackModel: `"${LUNA} || ${COPILOT_LUNA}"` });
	const controller = new AbortController();
	spawnPlan = () => ({ events: [], hang: true, afterSpawn: () => controller.abort() });
	await assert.rejects(run(fx.nested, discover(fx.nested), "abortable", controller.signal), /Subagent was aborted/);
	assert.deepEqual(attempts, [PRIMARY]);
});

test("an external abort during a fallback rejects and launches no further fallback", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "abortMid", { model: PRIMARY, fallbackModel: `"${LUNA} || ${COPILOT_LUNA}"` });
	const controller = new AbortController();
	spawnPlan = (model) => (model === LUNA ? { events: [], hang: true, afterSpawn: () => controller.abort() } : unavailable());
	await assert.rejects(run(fx.nested, discover(fx.nested), "abortMid", controller.signal), /Subagent was aborted/);
	assert.deepEqual(attempts, [PRIMARY, LUNA]);
});

test("an anthropic fallback without the subscription guard fails loudly instead of launching", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "guardMissing", { model: PRIMARY, fallbackModel: `"anthropic/claude-haiku-5-5"` });
	spawnPlan = () => unavailable();
	await assert.rejects(run(fx.nested, discover(fx.nested), "guardMissing"), /subscription guard missing/);
	assert.deepEqual(attempts, [PRIMARY]);
});

test("usage sums every attempt while contextTokens reports only the final attempt", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "usage", { model: PRIMARY, fallbackModel: `"${LUNA} || ${COPILOT_LUNA}"` });
	spawnPlan = (model) => {
		if (model === PRIMARY) return unavailable("503 unavailable", usage(2, 3, 5, 0.25, 1));
		if (model === LUNA) return unavailable("503 unavailable", usage(4, 6, 9, 0.5, 0, 2));
		return success(usage(8, 12, 20, 0.125));
	};
	const result = await run(fx.nested, discover(fx.nested), "usage");
	assert.equal(result.exitCode, 0);
	assert.equal(result.model, COPILOT_LUNA);
	assert.deepEqual(result.usage, { input: 14, output: 21, cacheRead: 1, cacheWrite: 2, cost: 0.875, contextTokens: 20, turns: 3 });
});

test("discovery precedence: roles.json overrides user frontmatter, project agents win under both, and project frontmatter stays ordered", async () => {
	const fx = setupRoots();
	fs.writeFileSync(
		path.join(fx.userDir, "roles.json"),
		JSON.stringify([
			{ name: "shared", fallbackModel: ` ${LUNA} || ${COPILOT_LUNA} || ${LUNA} ` },
			{ name: "registry-empty", fallbackModel: " || " },
		]),
	);
	writeRole(fx.userAgents, "shared", { model: PRIMARY, fallbackModel: `"${COPILOT_SOL}"` });
	writeRole(fx.userAgents, "registry-empty", { model: PRIMARY, fallbackModel: `"${COPILOT_SOL}"` });
	writeRole(fx.userAgents, "legacy", { model: PRIMARY, fallbackModel: `"${COPILOT_LUNA}"` });
	writeRole(path.join(fx.project, ".pi", "agents"), "shared", { model: PRIMARY, fallbackModel: `"${COPILOT_LUNA} || ${COPILOT_SOL}"` });
	writeRole(path.join(fx.project, ".pi", "agents"), "projonly", { model: PRIMARY, fallbackModel: `"${COPILOT_SOL} || ${LUNA}"` });
	spawnPlan = () => unavailable();

	const chainOf = async (scope: "user" | "project" | "both", name: string) => {
		attempts = [];
		const result = await run(fx.nested, discover(fx.nested, scope), name);
		return { chain: attempts, source: result.agentSource };
	};

	assert.deepEqual(await chainOf("user", "shared"), { chain: [PRIMARY, LUNA, COPILOT_LUNA], source: "user" });
	assert.deepEqual(await chainOf("user", "registry-empty"), { chain: [PRIMARY], source: "user" });
	assert.deepEqual(await chainOf("user", "legacy"), { chain: [PRIMARY, COPILOT_LUNA], source: "user" });
	assert.deepEqual(await chainOf("both", "shared"), { chain: [PRIMARY, COPILOT_LUNA, COPILOT_SOL], source: "project" });
	assert.deepEqual(await chainOf("project", "projonly"), { chain: [PRIMARY, COPILOT_SOL, LUNA], source: "project" });
});

test("literal claude-sonnet-5-5 survives discovery and the CLI --model argument unchanged", async () => {
	const fx = setupRoots();
	const guardDir = path.join(fx.userDir, "npm", "node_modules", "pi-claude-subscription-connector", "extensions");
	fs.mkdirSync(guardDir, { recursive: true });
	fs.writeFileSync(path.join(guardDir, "subscription-guard.ts"), "export {};\n");
	const ANTHROPIC_55 = "anthropic/claude-sonnet-5-5";
	writeRole(fx.userAgents, "literal55", { model: ANTHROPIC_55, fallbackModel: `"github-copilot/claude-sonnet-5.5"` });
	const agents = discover(fx.nested);
	assert.equal(agents.find((a) => a.name === "literal55")?.model, ANTHROPIC_55);
	assert.deepEqual(agents.find((a) => a.name === "literal55")?.fallbackModel, ["github-copilot/claude-sonnet-5.5"]);
	spawnPlan = (model) => (model === ANTHROPIC_55 ? unavailable() : success());
	const result = await run(fx.nested, agents, "literal55");
	assert.deepEqual(attempts, [ANTHROPIC_55, "github-copilot/claude-sonnet-5.5"]);
	assert.equal(result.model, "github-copilot/claude-sonnet-5.5");
	assert.equal(result.exitCode, 0);
});

test("roles.json is canonical for user fields, overriding drifted frontmatter while keeping description and body", () => {
	const fx = setupRoots();
	fs.writeFileSync(
		path.join(fx.userDir, "roles.json"),
		JSON.stringify([{ name: "drifted", provider: "openai-codex", model: "gpt-6.1-sol", fallbackModel: "github-copilot/gpt-6-sol", thinking: "medium", tools: "read, grep" }]),
	);
	fs.writeFileSync(
		path.join(fx.userAgents, "drifted.md"),
		"---\nname: drifted\ndescription: Canonical description kept\nmodel: anthropic/claude-haiku-5-5\nfallbackModel: openai-codex/gpt-6-luna\nthinking: high\ntools: read, bash\n---\nBody stays.\n",
	);
	const agent = discover(fx.nested).find((a) => a.name === "drifted");
	assert.ok(agent);
	assert.equal(agent.model, "openai-codex/gpt-6.1-sol");
	assert.deepEqual(agent.fallbackModel, ["github-copilot/gpt-6-sol"]);
	assert.equal(agent.thinking, "medium");
	assert.deepEqual(agent.tools, ["read", "grep"]);
	assert.equal(agent.description, "Canonical description kept");
	assert.equal(agent.systemPrompt.trim(), "Body stays.");
});

test("project frontmatter stays authoritative and is not overridden by roles.json", () => {
	const fx = setupRoots();
	fs.writeFileSync(
		path.join(fx.userDir, "roles.json"),
		JSON.stringify([{ name: "projdrift", provider: "openai-codex", model: "gpt-6.1-sol", fallbackModel: "github-copilot/gpt-6-sol", thinking: "medium", tools: "read" }]),
	);
	writeRole(path.join(fx.project, ".pi", "agents"), "projdrift", { model: "anthropic/claude-sonnet-5-5", fallbackModel: '"github-copilot/claude-sonnet-5.5"', thinking: "high", tools: "read, bash" });
	const agent = discover(fx.nested, "project").find((a) => a.name === "projdrift");
	assert.ok(agent);
	assert.equal(agent.model, "anthropic/claude-sonnet-5-5");
	assert.deepEqual(agent.fallbackModel, ["github-copilot/claude-sonnet-5.5"]);
	assert.equal(agent.thinking, "high");
	assert.deepEqual(agent.tools, ["read", "bash"]);
});

// ---- Provider cooldown pre-spawn check: a declared provider in cooldown never launches a child --------------------------

test("provider cooldown: a replayable cooling primary launches no child and moves to the declared fallback", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "cool", { model: PRIMARY, fallbackModel: `"${LUNA}"` });
	launchPlan = (model) => (model === PRIMARY ? { state: "cooling", replayable: true } : { state: "launch" });
	const result = await run(fx.nested, discover(fx.nested), "cool");
	assert.deepEqual(attempts, [LUNA]);
	assert.equal(result.exitCode, 0);
	assert.match(result.stderr, /Model openai-codex\/gpt-6\.1-sol skipped \(provider cooldown cooling\); retried with openai-codex\/gpt-6-luna/);
});

test("provider cooldown: a non-replayable cooldown (auth block) never spawns and never falls back", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "blocked", { model: PRIMARY, fallbackModel: `"${LUNA}"` });
	launchPlan = (model) => (model === PRIMARY ? { state: "blocked", replayable: false } : { state: "launch" });
	const result = await run(fx.nested, discover(fx.nested), "blocked");
	assert.deepEqual(attempts, []);
	assert.equal(result.exitCode, 1);
	assert.match(result.stderr, /not launched: provider cooldown blocked/);
});

test("provider cooldown: the chain skips each replayable cooling fallback and stops at the declared list", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "chain-cool", { model: PRIMARY, fallbackModel: `"${LUNA} || ${COPILOT_LUNA}"` });
	launchPlan = (model) => (model === PRIMARY || model === LUNA ? { state: "cooling", replayable: true } : { state: "launch" });
	const result = await run(fx.nested, discover(fx.nested), "chain-cool");
	assert.deepEqual(attempts, [COPILOT_LUNA]);
	assert.equal(result.exitCode, 0);
});

test("provider cooldown: when every declared model is cooling nothing spawns and the run fails", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "all-cool", { model: PRIMARY, fallbackModel: `"${LUNA} || ${COPILOT_LUNA}"` });
	launchPlan = () => ({ state: "cooling", replayable: true });
	const result = await run(fx.nested, discover(fx.nested), "all-cool");
	assert.deepEqual(attempts, []);
	assert.equal(result.exitCode, 1);
	assert.match(result.stderr, /Model github-copilot\/gpt-6-luna not launched: provider cooldown cooling/);
});

test("provider cooldown: a cooling primary whose fallback is non-replayable stops without spawning the fallback", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "unreplayable", { model: PRIMARY, fallbackModel: `"${LUNA}"` });
	launchPlan = (model) => (model === PRIMARY ? { state: "cooling", replayable: true } : { state: "cooling", replayable: false });
	const result = await run(fx.nested, discover(fx.nested), "unreplayable");
	assert.deepEqual(attempts, []);
	assert.equal(result.exitCode, 1);
});

// ---- R2/R3/R5 parent proofs: guard refusals replay only through the parent store; probe-busy is reversible admission ----

const GUARD_COOLING = "provider cooldown cooling";

test("R2: a guard refusal the parent store still calls replayable advances to the declared fallback, once", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "refused", { model: PRIMARY, fallbackModel: `"${LUNA} || ${COPILOT_LUNA}"` });
	guardPlan = (model, message) => model === PRIMARY && message === GUARD_COOLING;
	spawnPlan = (model) => (model === PRIMARY ? { events: [assistant("error", "", GUARD_COOLING)], exitCode: 1 } : success());
	const result = await run(fx.nested, discover(fx.nested), "refused");
	assert.deepEqual(attempts, [PRIMARY, LUNA]);
	assert.equal(result.exitCode, 0);
	assert.equal(result.model, LUNA);
});

test("R2: the guard marker alone is not enough: a refusal the parent store does not confirm stops the chain", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "unconfirmed", { model: PRIMARY, fallbackModel: `"${LUNA}"` });
	guardPlan = () => false;
	spawnPlan = () => ({ events: [assistant("error", "", GUARD_COOLING)], exitCode: 1 });
	const result = await run(fx.nested, discover(fx.nested), "unconfirmed");
	assert.deepEqual(attempts, [PRIMARY]);
	assert.equal(result.exitCode, 1);
});

test("R2: a confirmed guard refusal after tool activity, an abort or a length stop never replays", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "refusal-guarded", { model: PRIMARY, fallbackModel: `"${LUNA}"` });
	const agents = discover(fx.nested);
	guardPlan = () => true;
	spawnPlan = () => ({ events: [{ type: "tool_execution_start" }, assistant("error", "", GUARD_COOLING)], exitCode: 1 });
	await run(fx.nested, agents, "refusal-guarded");
	assert.deepEqual(attempts, [PRIMARY]);
	attempts = [];
	spawnPlan = () => ({ events: [assistant("aborted", "", GUARD_COOLING)], exitCode: 1 });
	await run(fx.nested, agents, "refusal-guarded");
	assert.deepEqual(attempts, [PRIMARY]);
	attempts = [];
	spawnPlan = () => ({ events: [assistant("length", "partial", GUARD_COOLING)], exitCode: 1 });
	await run(fx.nested, agents, "refusal-guarded");
	assert.deepEqual(attempts, [PRIMARY]);
});

test("R3: a probe-busy primary moves to the declared fallbacks in order and is never spawned", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "busy", { model: PRIMARY, fallbackModel: `"${LUNA} || ${COPILOT_LUNA}"` });
	launchPlan = (model) => (model === PRIMARY || model === LUNA ? { state: "probe-busy", replayable: true } : { state: "launch" });
	const result = await run(fx.nested, discover(fx.nested), "busy");
	assert.deepEqual(attempts, [COPILOT_LUNA]);
	assert.equal(result.exitCode, 0);
	assert.match(result.stderr, /Model openai-codex\/gpt-6\.1-sol skipped \(provider cooldown probe-busy\)/);
});

test("R3: an unavailable store blocks the whole declared chain, fail-closed", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "unavailable", { model: PRIMARY, fallbackModel: `"${LUNA}"` });
	launchPlan = () => ({ state: "unavailable", replayable: false });
	const result = await run(fx.nested, discover(fx.nested), "unavailable");
	assert.deepEqual(attempts, []);
	assert.equal(result.exitCode, 1);
	assert.match(result.stderr, /not launched: provider cooldown unavailable/);
});

test("R5: an abort that lands during the provider launch check spawns nothing and launches no fallback", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "precheck-abort", { model: PRIMARY, fallbackModel: `"${LUNA}"` });
	const controller = new AbortController();
	launchPlan = (model) => {
		if (model === PRIMARY) controller.abort();
		return { state: "launch" };
	};
	await assert.rejects(run(fx.nested, discover(fx.nested), "precheck-abort", controller.signal), /Subagent was aborted/);
	assert.deepEqual(attempts, []);
});

test("R5: an abort during the check of a replayable cooling primary does not start the fallback recursion", async () => {
	const fx = setupRoots();
	writeRole(fx.userAgents, "cooling-abort", { model: PRIMARY, fallbackModel: `"${LUNA}"` });
	const controller = new AbortController();
	launchPlan = (model) => {
		if (model === PRIMARY) controller.abort();
		return model === PRIMARY ? { state: "cooling", replayable: true } : { state: "launch" };
	};
	await assert.rejects(run(fx.nested, discover(fx.nested), "cooling-abort", controller.signal), /Subagent was aborted/);
	assert.deepEqual(attempts, []);
});
