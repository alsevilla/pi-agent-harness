// Node-only integration for the provider cooldown entry. The entry's bare @earendil-works imports are mapped to the installed
// public dist files (the same packages the production loader aliases); every store and fetch is scratch-only and offline.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { registerHooks } from "node:module";
import * as path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { createCooldownStore, type CooldownStore } from "../provider-cooldown.ts";

const PKG = "C:/Users/MSI/.pi/agent/install/releases/1.1.0/node_modules/@earendil-works";
const SCRATCH = "C:/Users/MSI/worktrees/pi-agent-harness/_scratch/provider-cooldown-phase-b-repair";
const urls = {
	"@earendil-works/pi-coding-agent": pathToFileURL(`${PKG}/pi-coding-agent/dist/index.js`).href,
	"@earendil-works/pi-ai": pathToFileURL(`${PKG}/pi-ai/dist/index.js`).href,
	"@earendil-works/pi-ai/compat": pathToFileURL(`${PKG}/pi-ai/dist/compat.js`).href,
} as Record<string, string>;
registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier in urls) return { url: urls[specifier], shortCircuit: true };
		return nextResolve(specifier, context);
	},
});

const entry = await import("../provider-cooldown-entry.ts");
const { createAssistantMessageEventStream } = await import(urls["@earendil-works/pi-ai"]);

const T0 = Date.now();
const MODEL_FIELDS = { input: ["text"], reasoning: false, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 200_000, maxTokens: 4_096 };
const ANTHROPIC = { ...MODEL_FIELDS, id: "claude-test-model", name: "claude-test-model", api: "anthropic-messages", provider: "anthropic", baseUrl: "https://api.anthropic.com" } as any;
const CODEX = { ...MODEL_FIELDS, id: "gpt-6.1-sol", name: "gpt-6.1-sol", api: "openai-codex-responses", provider: "openai-codex", baseUrl: "https://chatgpt.com/backend-api" } as any;
const SCOPE = { provider: "anthropic", model: ANTHROPIC.id };
const CTX = { messages: [{ role: "user", content: "hi", timestamp: T0 }] } as any;
const OFFLINE = { apiKey: "sk-offline-test-key" }; // synthetic; never a real credential

const scratchRoot = path.join(SCRATCH, "stores");
fs.mkdirSync(scratchRoot, { recursive: true });
function freshStore(): { dir: string; store: CooldownStore } {
	const dir = fs.mkdtempSync(path.join(scratchRoot, "integ-"));
	return { dir, store: createCooldownStore({ dir }) };
}
const files = (dir: string): number => fs.readdirSync(dir).filter((name) => /^r-/.test(name)).length;

// Fake pi: captures what the entry registers; the production loader performs the same registration with its own ExtensionAPI.
function fakePi() {
	const providers: Record<string, any> = {};
	const commands: Record<string, any> = {};
	return { providers, commands, registerProvider: (name: string, config: any) => (providers[name] = config), registerCommand: (name: string, options: any) => (commands[name] = options) };
}

function countingFetch(factory: () => Response) {
	const state = { calls: 0 };
	return { state, fetchFn: (async () => (state.calls++, factory())) as unknown as typeof fetch };
}
const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
async function drain(stream: AsyncIterable<any>): Promise<any[]> {
	const events: any[] = [];
	for await (const event of stream) events.push(event);
	return events;
}

test("registration: anthropic and openai-codex keep their ids and apis, overriding only streamSimple", () => {
	const pi = fakePi();
	entry.registerProviderCooldown(pi as any, freshStore().store);
	assert.deepEqual(Object.keys(pi.providers).sort(), ["anthropic", "openai-codex"]);
	assert.equal(pi.providers.anthropic.api, "anthropic-messages");
	assert.equal(pi.providers["openai-codex"].api, "openai-codex-responses");
	for (const config of Object.values(pi.providers) as any[]) {
		assert.deepEqual(Object.keys(config).sort(), ["api", "streamSimple"], "no models, baseUrl, headers or apiKey may be overridden");
	}
});

test("default store lives under the agent dir run-state folder", () => {
	assert.equal(path.basename(path.dirname(entry.cooldownStoreDir())), "run-state");
	assert.equal(path.basename(entry.cooldownStoreDir()), "provider-cooldown");
});

test("main request during cooling sends no physical request and returns a stable typed error", async () => {
	const { store, dir } = freshStore();
	await store.recordTrustedError({ scope: SCOPE, kind: "rate", trustedReset: { retryAfterMs: 60_000 }, observedAt: T0 });
	const pi = fakePi();
	entry.registerProviderCooldown(pi as any, store);
	const mock = countingFetch(() => jsonResponse(200, { ok: true }));
	const events = await drain(pi.providers.anthropic.streamSimple(ANTHROPIC, CTX, { ...OFFLINE, fetch: mock.fetchFn }));
	assert.equal(mock.state.calls, 0);
	assert.equal(events.at(-1).type, "error");
	assert.equal(events.at(-1).error.errorMessage, "provider cooldown cooling");
	assert.equal(files(dir), 1, "no record is added by a refused request");
});

test("open request: one physical request, trusted 429 retry-after-ms becomes cooling, body stays with the SDK", async () => {
	const { store } = freshStore();
	const pi = fakePi();
	entry.registerProviderCooldown(pi as any, store);
	const body = { type: "error", error: { type: "rate_limit_error", message: "slow down" } };
	const mock = countingFetch(() => jsonResponse(429, body, { "retry-after-ms": "1500" }));
	const events = await drain(pi.providers.anthropic.streamSimple(ANTHROPIC, CTX, { ...OFFLINE, fetch: mock.fetchFn }));
	assert.equal(mock.state.calls, 1, "the SDK retry after a trusted observation never leaves");
	assert.equal(events.at(-1).type, "error");
	const admission = await store.check(SCOPE);
	assert.equal(admission.state, "cooling");
	assert.equal(admission.kind, "rate");
});

test("launch state: only declared supported providers in cooldown are blocked; replayable kinds are quota, rate and transient", async () => {
	const { store } = freshStore();
	assert.deepEqual(await entry.providerLaunchState("anthropic/claude-test-model", store), { state: "launch" });
	assert.deepEqual(await entry.providerLaunchState("github-copilot/gpt-6-luna", store), { state: "launch" }, "unsupported providers are never claimed");
	await store.recordTrustedError({ scope: SCOPE, kind: "rate", trustedReset: { retryAfterMs: 60_000 }, observedAt: Date.now() });
	assert.deepEqual(await entry.providerLaunchState("anthropic/claude-test-model", store), { state: "cooling", replayable: true });
	await store.recordTrustedError({ scope: { provider: "openai-codex", model: "gpt-6-luna" }, kind: "model", observedAt: Date.now() });
	assert.deepEqual(await entry.providerLaunchState("openai-codex/gpt-6-luna", store), { state: "cooling", replayable: false }, "model cooldowns are never replayed");
	await store.recordTrustedError({ scope: { provider: "openai-codex", model: "gpt-6.1-sol" }, kind: "auth", observedAt: Date.now() });
	assert.deepEqual(await entry.providerLaunchState("openai-codex/gpt-6.1-sol", store), { state: "blocked", replayable: false });
});

test("auth block is sticky until an explicit refresh; malformed commands write nothing", async () => {
	const { store, dir } = freshStore();
	await store.recordTrustedError({ scope: SCOPE, kind: "auth", observedAt: Date.now() });
	const before = files(dir);
	for (const bad of ["refresh", "refresh unknown-provider", "refresh anthropic extra", "status anthropic", "nonsense"]) {
		const result = await entry.runProviderCooldownCommand(bad, store);
		assert.equal(result.type, "error", bad);
	}
	assert.equal(files(dir), before, "malformed commands never write");
	assert.equal((await store.check(SCOPE)).state, "blocked");
	const status = await entry.runProviderCooldownCommand("", store);
	assert.equal(status.type, "info");
	assert.match(status.message, /anthropic: blocked reason=auth needsrefresh=yes/);
	assert.doesNotMatch(status.message, /sk-|Bearer|error|body/i, "status never shows bodies, errors or auth values");
	const refreshed = await entry.runProviderCooldownCommand("refresh anthropic", store);
	assert.equal(refreshed.type, "info");
	assert.notEqual((await store.check(SCOPE)).state, "blocked", "explicit refresh is the only unlock");
});

test("R1: a regular file at the run-state path fails the parent launch state and the child guard closed, with zero wire calls", async () => {
	const base = fs.mkdtempSync(path.join(scratchRoot, "file-ancestor-"));
	fs.writeFileSync(path.join(base, "run-state"), "not a directory");
	const store = createCooldownStore({ dir: path.join(base, "run-state", "provider-cooldown") });
	assert.deepEqual(await entry.providerLaunchState("anthropic/claude-test-model", store), { state: "unavailable", replayable: false });
	const pi = fakePi();
	entry.registerProviderCooldown(pi as any, store);
	const mock = countingFetch(() => jsonResponse(200, { ok: true }));
	const events = await drain(pi.providers.anthropic.streamSimple(ANTHROPIC, CTX, { ...OFFLINE, fetch: mock.fetchFn }));
	assert.equal(mock.state.calls, 0, "an unreadable store never reaches the provider");
	assert.equal(events.at(-1).error.errorMessage, "provider cooldown unavailable");
});

test("R2: the parent replays only the guard's own cooling marker, and only while its own store says replayable", async () => {
	const clock = { at: Date.now() };
	const store = createCooldownStore({ dir: fs.mkdtempSync(path.join(scratchRoot, "refusal-")), now: () => clock.at });
	const model = "anthropic/claude-test-model";
	assert.equal(await entry.guardRefusalReplayable(model, "provider cooldown cooling", store), false, "no current record, no replay");
	await store.recordTrustedError({ scope: SCOPE, kind: "rate", trustedReset: { retryAfterMs: 60_000 }, observedAt: clock.at });
	assert.equal(await entry.guardRefusalReplayable(model, "provider cooldown cooling", store), true);
	for (const text of ["429 Too Many Requests", "rate_limit_error: slow down", "provider cooldown unavailable", "provider cooldown blocked", "provider cooldown cooling extra", undefined]) {
		assert.equal(await entry.guardRefusalReplayable(model, text, store), false, String(text));
	}
	await store.recordTrustedError({ scope: { provider: "openai-codex", model: "gpt-6-luna" }, kind: "model", observedAt: clock.at });
	assert.equal(await entry.guardRefusalReplayable("openai-codex/gpt-6-luna", "provider cooldown cooling", store), false, "model cooldowns are never replayed");
});

test("R3: a leased probe is probe-busy and replayable at the parent; the parent check is per declared model", async () => {
	const clock = { at: Date.now() };
	const store = createCooldownStore({ dir: fs.mkdtempSync(path.join(scratchRoot, "probe-busy-")), now: () => clock.at });
	await store.recordTrustedError({ scope: SCOPE, kind: "rate", trustedReset: { retryAfterMs: 60_000 }, observedAt: clock.at });
	clock.at += 61_000;
	const lease = await store.tryProbe(SCOPE);
	assert.ok(lease);
	assert.deepEqual(await entry.providerLaunchState("anthropic/claude-test-model", store), { state: "probe-busy", replayable: true });
	assert.equal(await entry.guardRefusalReplayable("anthropic/claude-test-model", "provider cooldown probe-busy", store), true);
	await lease.finish({ outcome: "abort" });
});

test("production loader: the child entry loads with --extension semantics and registers both providers, overriding only streamSimple", async () => {
	const sdk = await import(urls["@earendil-works/pi-coding-agent"]);
	const loaded = await sdk.discoverAndLoadExtensions([path.resolve(import.meta.dirname, "../provider-cooldown-entry.ts")], SCRATCH, path.join(SCRATCH, "agent-state"));
	assert.deepEqual(loaded.errors, []);
	const registrations = loaded.runtime.pendingProviderRegistrations;
	assert.deepEqual(registrations.map((item: any) => item.name).sort(), ["anthropic", "openai-codex"]);
	for (const item of registrations) {
		assert.deepEqual(Object.keys(item.config).sort(), ["api", "streamSimple"]);
		assert.equal(typeof item.config.streamSimple, "function");
	}
});

test("parent pre-spawn sees the same store as the child guard: a cooldown recorded by one is refused by the other", async () => {
	const { store, dir } = freshStore();
	const pi = fakePi();
	entry.registerProviderCooldown(pi as any, store);
	await store.recordTrustedError({ scope: SCOPE, kind: "quota", trustedReset: { retryAfter: 120 }, observedAt: Date.now() });
	const parentView = createCooldownStore({ dir });
	assert.deepEqual(await entry.providerLaunchState("anthropic/claude-test-model", parentView), { state: "cooling", replayable: true });
	const mock = countingFetch(() => jsonResponse(200, { ok: true }));
	await drain(pi.providers.anthropic.streamSimple(ANTHROPIC, CTX, { ...OFFLINE, fetch: mock.fetchFn }));
	assert.equal(mock.state.calls, 0);
});
