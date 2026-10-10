// Provider cooldown guard regressions: observation kinds, admission before every provider request, one probe lease,
// terminal-after-record ordering, physical-retry gating, and offline runs of the installed public pi-ai API delegates.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import test, { after } from "node:test";
import { classifyObservation, guardStreamSimple, MAX_OBSERVED_BODY_BYTES, readBoundedJson } from "../provider-cooldown-guard.ts";
import { type CooldownStore, createCooldownStore } from "../provider-cooldown.ts";

// Test-only absolute path to the installed Pi 1.1.0 public pi-ai dist. Extension-loader resolution is NOT exercised here.
const PI_AI_DIST = process.env.PI_AI_DIST ?? "C:/Users/MSI/.pi/agent/install/releases/1.1.0/node_modules/@earendil-works/pi-ai/dist";
const piAi = (rel: string) => import(pathToFileURL(path.join(PI_AI_DIST, rel)).href);
const { createAssistantMessageEventStream } = await piAi("utils/event-stream.js");

// Fail-closed offline: nothing may reach the global network surface. A fall-through call throws and is counted; the count must stay zero.
const egressAttempts = { count: 0 };
const realFetch = globalThis.fetch;
const realWebSocket = globalThis.WebSocket;
function deniedEgress(name: string) {
	egressAttempts.count += 1;
	throw new Error(`offline test denied ${name}`);
}
globalThis.fetch = (() => deniedEgress("fetch")) as unknown as typeof fetch;
globalThis.WebSocket = function DeniedWebSocket() {
	return deniedEgress("WebSocket");
} as unknown as typeof WebSocket;
after(() => {
	globalThis.fetch = realFetch;
	globalThis.WebSocket = realWebSocket;
	assert.equal(egressAttempts.count, 0, "no test may reach the global network surface");
});

const T0 = 1_800_000_000_000; // whole seconds
const MIN = 60_000;
const URL_MESSAGES = "https://api.anthropic.com/v1/messages";
// Fixtures carry the Model fields the real delegates read before any fetch (input, reasoning, cost, limits).
const MODEL_FIELDS = { input: ["text"], reasoning: false, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 200_000, maxTokens: 4_096 };
const ANTHROPIC = { ...MODEL_FIELDS, id: "claude-test-model", name: "claude-test-model", api: "anthropic-messages", provider: "anthropic", baseUrl: "https://api.anthropic.com" } as any;
const CODEX = { ...MODEL_FIELDS, id: "gpt-6.1-sol", name: "gpt-6.1-sol", api: "openai-codex-responses", provider: "openai-codex", baseUrl: "https://chatgpt.com/backend-api" } as any;
const SCOPE = { provider: "anthropic", model: ANTHROPIC.id };
const CTX = { messages: [{ role: "user", content: "hi", timestamp: T0 }] } as any;
const USAGE = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
const RATE_BODY = { type: "error", error: { type: "rate_limit_error", message: "slow down" } };

function message(model: any, stopReason: string, errorMessage?: string): any {
	return { role: "assistant", content: [], api: model.api, provider: model.provider, model: model.id, usage: USAGE, stopReason, timestamp: T0, ...(errorMessage === undefined ? {} : { errorMessage }) };
}
const errorEvent = (model: any, errorMessage: string, reason = "error") => ({ type: "error", reason, error: message(model, reason, errorMessage) });
const doneEvent = (model: any) => ({ type: "done", reason: "stop", message: message(model, "stop") });

// Scripted delegate: records each call and pushes the events returned by its script into an SDK-shaped event stream.
function scripted(script: (ctx: { model: any; options: any }) => Promise<any[]>) {
	const calls: { model: any; options: any }[] = [];
	const delegate = (model: any, _context: any, options: any) => {
		calls.push({ model, options });
		const out = createAssistantMessageEventStream();
		void script({ model, options }).then(
			(events) => events.forEach((event) => out.push(event)),
			(error) => out.push(errorEvent(model, String(error))),
		);
		return out;
	};
	return { delegate, calls };
}

async function drain(stream: AsyncIterable<any>): Promise<any[]> {
	const events: any[] = [];
	for await (const event of stream) events.push(event);
	return events;
}

function freshDir(): string {
	return fs.mkdtempSync(path.join(process.env.PROVIDER_COOLDOWN_TEST_ROOT ?? os.tmpdir(), "provider-cooldown-guard-"));
}
const cooldownFiles = (dir: string): number => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => /^r-/.test(name)).length : 0);

function fakeStore(overrides: Record<string, unknown>): CooldownStore {
	const unexpected = async () => {
		throw new Error("unexpected store call");
	};
	return { check: unexpected, recordTrustedError: unexpected, recordSuccess: unexpected, refreshAuth: unexpected, tryProbe: unexpected, ...overrides } as any;
}

function guard(store: CooldownStore, delegate: any, provider: string, now: () => number) {
	return guardStreamSimple({ provider, store, delegate, createStream: createAssistantMessageEventStream, now });
}

const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
function countingFetch(factory: () => Response) {
	const state = { calls: 0 };
	const fetchFn = (async () => {
		state.calls++;
		return factory();
	}) as unknown as typeof fetch;
	return { fetchFn, state };
}
const headersOf = (entries: Record<string, string> = {}) => new Headers(entries);

// ---- 1. Observation kinds (pure) -------------------------------------------------------------------------------------

test("401 is an auth observation without reading the body", () => {
	assert.equal(classifyObservation(401, headersOf(), undefined, T0)?.kind, "auth");
});

test("403 is auth only with a typed authentication or permission body", () => {
	assert.equal(classifyObservation(403, headersOf(), { error: { type: "permission_error" } }, T0)?.kind, "auth");
	assert.equal(classifyObservation(403, headersOf(), { error: { type: "authentication_error" } }, T0)?.kind, "auth");
	assert.equal(classifyObservation(403, headersOf(), { error: { type: "forbidden" } }, T0), undefined);
	assert.equal(classifyObservation(403, headersOf(), undefined, T0), undefined);
});

test("429 quota needs a structured Codex code; friendly text or a bare 429 never becomes quota", () => {
	const resetEpoch = T0 / 1000 + 3600;
	const codex = classifyObservation(429, headersOf(), { error: { code: "usage_limit_reached", resets_at: resetEpoch } }, T0);
	assert.equal(codex?.kind, "quota");
	assert.deepEqual(codex?.trustedReset, { resetsAtEpochSeconds: resetEpoch });
	assert.equal(classifyObservation(429, headersOf(), { error: { code: "insufficient_quota" } }, T0)?.kind, "quota");
	// Codex friendly rewrite is plain text in the raw body: no JSON object, so no observation at all.
	assert.equal(classifyObservation(429, headersOf(), undefined, T0), undefined);
});

test("429 rate kinds: Anthropic rate_limit_error and rate_limit_exceeded, with retry-after-ms honoured", () => {
	const anthropic = classifyObservation(429, headersOf({ "retry-after-ms": "1500" }), RATE_BODY, T0);
	assert.equal(anthropic?.kind, "rate");
	assert.deepEqual(anthropic?.trustedReset, { retryAfterMs: 1500 });
	assert.equal(classifyObservation(429, headersOf(), { error: { code: "rate_limit_exceeded" } }, T0)?.kind, "rate");
});

test("404 is model scope only for structured model_not_found", () => {
	assert.equal(classifyObservation(404, headersOf(), { error: { code: "model_not_found" } }, T0)?.kind, "model");
	assert.equal(classifyObservation(404, headersOf(), { error: { type: "not_found_error" } }, T0), undefined);
});

test("400, 5xx, 504, 529 and server_error bodies never classify", () => {
	for (const status of [400, 500, 502, 503, 504, 529]) {
		assert.equal(classifyObservation(status, headersOf(), { error: { type: "server_error", code: "rate_limit_exceeded" } }, T0), undefined, `status ${status}`);
	}
});

test("invalid Retry-After metadata is omitted, never manufactured into a manual block", () => {
	const none = (h: Record<string, string>) => classifyObservation(429, headersOf(h), RATE_BODY, T0)?.trustedReset;
	assert.equal(none({ "retry-after-ms": "1.5" }), undefined);
	assert.equal(none({ "retry-after-ms": "0" }), undefined);
	assert.equal(none({ "retry-after": "soon" }), undefined);
	assert.equal(none({ "retry-after": "Tue, 01 Jan 2019 00:00:00 GMT" }), undefined); // past HTTP-date
	assert.equal(none({ "retry-after": "1.5" }), undefined);
	assert.deepEqual(none({ "retry-after": "120" }), { retryAfter: 120 });
	assert.deepEqual(none({ "retry-after": new Date(T0 + 120_000).toUTCString() }), { retryAfter: new Date(T0 + 120_000).toUTCString() });
});

test("resets_at is quota-only, numeric and in the future; clock prose is never a reset", () => {
	const past = T0 / 1000 - 10;
	assert.equal(classifyObservation(429, headersOf(), { error: { code: "usage_limit_reached", resets_at: past } }, T0)?.trustedReset, undefined);
	assert.equal(classifyObservation(429, headersOf(), { error: { code: "usage_limit_reached", resets_at: "3:40PM" } }, T0)?.trustedReset, undefined);
	assert.equal(classifyObservation(429, headersOf(), { error: { type: "rate_limit_error", resets_at: T0 / 1000 + 600 } }, T0)?.trustedReset, undefined);
});

test("bounded body reader: 2048 bytes parse, bigger, malformed or stream-error bodies do not classify", async () => {
	const prefix = '{"error":{"type":"rate_limit_error","message":"';
	const suffix = '"}}';
	const exact = prefix + "x".repeat(MAX_OBSERVED_BODY_BYTES - prefix.length - suffix.length) + suffix;
	assert.equal(Buffer.byteLength(exact), MAX_OBSERVED_BODY_BYTES);
	assert.deepEqual(await readBoundedJson(new Response(exact)), JSON.parse(exact));
	assert.equal(await readBoundedJson(new Response(exact + " ")), undefined);
	assert.equal(await readBoundedJson(new Response("{bad json")), undefined);
	const broken = new ReadableStream({ start: (controller) => controller.error(new Error("socket reset")) });
	assert.equal(await readBoundedJson(new Response(broken)), undefined);
});

// ---- 2. Admission before every provider request ----------------------------------------------------------------------

test("cooling admission refuses before the delegate, fetch or any record write", async () => {
	const dir = freshDir();
	const clock = { at: T0 };
	const now = () => clock.at;
	const store = createCooldownStore({ dir, now });
	await store.recordTrustedError({ scope: SCOPE, kind: "rate", observedAt: T0 });
	const before = cooldownFiles(dir);
	clock.at = T0 + 1_000;
	const { delegate, calls } = scripted(async () => [doneEvent(ANTHROPIC)]);
	const events = await drain(guard(store, delegate, "anthropic", now)(ANTHROPIC, CTX, {}));
	assert.equal(calls.length, 0);
	assert.equal(events.length, 1);
	assert.equal(events[0].type, "error");
	assert.equal(events[0].error.errorMessage, "provider cooldown cooling");
	assert.equal(cooldownFiles(dir), before);
});

test("blocked (auth) and unavailable admissions refuse with stable messages and no delegate call", async () => {
	for (const [state, extra] of [["blocked", { reason: "auth" }], ["unavailable", { reason: "unreadable" }]] as const) {
		const store = fakeStore({ check: async () => ({ state, ...extra }) });
		const { delegate, calls } = scripted(async () => [doneEvent(ANTHROPIC)]);
		const events = await drain(guard(store, delegate, "anthropic", () => T0)(ANTHROPIC, CTX, {}));
		assert.equal(calls.length, 0, state);
		assert.equal(events[0].error.errorMessage, `provider cooldown ${state}`);
	}
});

test("invalid model, pre-aborted signal and a throwing store all refuse without a delegate call", async () => {
	const { delegate, calls } = scripted(async () => [doneEvent(ANTHROPIC)]);
	const invalid = await drain(guard(fakeStore({}), delegate, "anthropic", () => T0)(undefined as any, CTX, {}));
	assert.equal(invalid[0].type, "error");
	const aborted = new AbortController();
	aborted.abort();
	let checks = 0;
	const preAborted = await drain(guard(fakeStore({ check: async () => ((checks += 1), { state: "open" }) }), delegate, "anthropic", () => T0)(ANTHROPIC, CTX, { signal: aborted.signal }));
	assert.equal(preAborted[0].reason, "aborted");
	assert.equal(checks, 0);
	const thrown = await drain(guard(fakeStore({ check: async () => { throw new Error("store exploded"); } }), delegate, "anthropic", () => T0)(ANTHROPIC, CTX, {}));
	assert.equal(thrown[0].type, "error");
	assert.equal(calls.length, 0);
});

// ---- 3. Open-path observation: record ordering, body integrity, gating, abort, unknown failure ----------------------

test("trusted 429 is recorded before the terminal error reaches the consumer; body stays intact for the SDK", async () => {
	const dir = freshDir();
	const clock = { at: T0 };
	const now = () => clock.at;
	const store = createCooldownStore({ dir, now });
	const bodies: string[] = [];
	const { delegate } = scripted(async ({ options }) => {
		const res = await options.fetch(URL_MESSAGES, { method: "POST" });
		bodies.push(await res.text());
		return [errorEvent(ANTHROPIC, "429 rate limited")];
	});
	const mock = countingFetch(() => jsonResponse(429, RATE_BODY, { "retry-after-ms": "90000" }));
	const states: string[] = [];
	for await (const event of guard(store, delegate, "anthropic", now)(ANTHROPIC, CTX, { fetch: mock.fetchFn })) {
		if (event.type === "error") states.push((await store.check(SCOPE)).state);
	}
	assert.deepEqual(states, ["cooling"]);
	assert.equal(bodies[0], JSON.stringify(RATE_BODY));
	assert.equal(mock.state.calls, 1);
	assert.deepEqual(await store.check(SCOPE), { state: "cooling", kind: "rate", untilMs: T0 + 90_000, source: "structured" });
});

test("SDK retry after a trusted observation is blocked before any physical request", async () => {
	const dir = freshDir();
	const now = () => T0;
	const store = createCooldownStore({ dir, now });
	const { delegate } = scripted(async ({ options }) => {
		await (await options.fetch(URL_MESSAGES, { method: "POST" })).text();
		let retryError = "";
		try {
			await options.fetch(URL_MESSAGES, { method: "POST" });
		} catch (error) {
			retryError = String((error as Error).message);
		}
		return [errorEvent(ANTHROPIC, retryError)];
	});
	const mock = countingFetch(() => jsonResponse(429, RATE_BODY, { "retry-after-ms": "60000" }));
	const events = await drain(guard(store, delegate, "anthropic", now)(ANTHROPIC, CTX, { fetch: mock.fetchFn }));
	assert.equal(mock.state.calls, 1, "only the first physical request may leave");
	assert.match(events.at(-1).error.errorMessage, /physical retry blocked/);
	assert.equal((await store.check(SCOPE)).state, "cooling");
});

test("abort after a trusted 429 records nothing and unknown failures never write health", async () => {
	const dir = freshDir();
	const now = () => T0;
	const store = createCooldownStore({ dir, now });
	const controller = new AbortController();
	const aborting = scripted(async ({ options }) => {
		await (await options.fetch(URL_MESSAGES, { method: "POST" })).text();
		controller.abort();
		return [errorEvent(ANTHROPIC, "Request was aborted", "aborted")];
	});
	await drain(guard(store, aborting.delegate, "anthropic", now)(ANTHROPIC, CTX, { signal: controller.signal, fetch: countingFetch(() => jsonResponse(429, RATE_BODY)).fetchFn }));
	assert.equal(cooldownFiles(dir), 0);
	const unknown = scripted(async ({ options }) => {
		await (await options.fetch(URL_MESSAGES, { method: "POST" })).text();
		return [errorEvent(ANTHROPIC, "upstream returned no response")];
	});
	await drain(guard(store, unknown.delegate, "anthropic", now)(ANTHROPIC, CTX, { fetch: countingFetch(() => jsonResponse(504, { error: { type: "server_error" } })).fetchFn }));
	await drain(guard(store, unknown.delegate, "anthropic", now)(ANTHROPIC, CTX, { fetch: countingFetch(() => new Response("rate limit text", { status: 400 })).fetchFn }));
	assert.equal(cooldownFiles(dir), 0);
	assert.equal((await store.check(SCOPE)).state, "open");
});

test("mocked SDK stream forwards text, tool and final error events in order; success records nothing", async () => {
	const dir = freshDir();
	const now = () => T0;
	const store = createCooldownStore({ dir, now });
	const partial = message(ANTHROPIC, "toolUse");
	const script = [
		{ type: "start", partial },
		{ type: "text_delta", contentIndex: 0, delta: "hello", partial },
		{ type: "toolcall_end", contentIndex: 1, toolCall: { type: "toolCall", id: "t1", name: "read", arguments: {} }, partial },
		errorEvent(ANTHROPIC, "tool failed"),
	];
	const { delegate } = scripted(async () => script);
	const events = await drain(guard(store, delegate, "anthropic", now)(ANTHROPIC, CTX, {}));
	assert.deepEqual(events, script);
	assert.equal(cooldownFiles(dir), 0);
});

test("options are forwarded unchanged except fetch; hook identities survive", async () => {
	const hooks = { onPayload: () => undefined, onResponse: () => undefined, onProviderStreamEvent: () => undefined };
	const signal = new AbortController().signal;
	const input = { headers: { "x-test": "1" }, metadata: { user_id: "u" }, reasoning: "high", signal, ...hooks };
	let seen: any;
	const { delegate, calls } = scripted(async ({ options }) => {
		seen = options;
		return [doneEvent(ANTHROPIC)];
	});
	await drain(guard(createCooldownStore({ dir: freshDir(), now: () => T0 }), delegate, "anthropic", () => T0)(ANTHROPIC, CTX, input));
	assert.equal(calls.length, 1);
	for (const key of ["headers", "metadata", "reasoning", "signal", "onPayload", "onResponse", "onProviderStreamEvent"] as const) {
		assert.equal(seen[key], (input as any)[key], key);
	}
	assert.equal(typeof seen.fetch, "function");
});

// ---- 4. Probe lease: single owner, finally cleanup, outcome mapping -----------------------------------------------

test("expired cooldown: probe success clears the record and releases the lease", async () => {
	const dir = freshDir();
	const clock = { at: T0 };
	const now = () => clock.at;
	const store = createCooldownStore({ dir, now });
	await store.recordTrustedError({ scope: SCOPE, kind: "rate", observedAt: T0 });
	clock.at = T0 + MIN + 1_000;
	assert.equal((await store.check(SCOPE)).state, "probe-due");
	const { delegate, calls } = scripted(async () => [doneEvent(ANTHROPIC)]);
	const events = await drain(guard(store, delegate, "anthropic", now)(ANTHROPIC, CTX, {}));
	assert.equal(calls.length, 1);
	assert.equal(events[0].type, "done");
	assert.equal((await store.check(SCOPE)).state, "open");
});

test("expired cooldown: a trusted probe failure records a fresh cooldown and releases the lease", async () => {
	const dir = freshDir();
	const clock = { at: T0 };
	const now = () => clock.at;
	const store = createCooldownStore({ dir, now });
	await store.recordTrustedError({ scope: SCOPE, kind: "rate", observedAt: T0 });
	clock.at = T0 + MIN + 1_000;
	const probe = scripted(async ({ options }) => {
		await (await options.fetch(URL_MESSAGES, { method: "POST" })).text();
		return [errorEvent(ANTHROPIC, "429 rate limited")];
	});
	await drain(guard(store, probe.delegate, "anthropic", now)(ANTHROPIC, CTX, { fetch: countingFetch(() => jsonResponse(429, RATE_BODY, { "retry-after-ms": "120000" })).fetchFn }));
	assert.deepEqual(await store.check(SCOPE), { state: "cooling", kind: "rate", untilMs: clock.at + 120_000, source: "structured" });
	clock.at += 120_000 + 1;
	assert.equal((await store.check(SCOPE)).state, "probe-due", "lease must not stay held after a failed probe");
});

test("expired cooldown: unknown probe failure and synchronous delegate throw release the lease without health", async () => {
	const dir = freshDir();
	const clock = { at: T0 };
	const now = () => clock.at;
	const store = createCooldownStore({ dir, now });
	await store.recordTrustedError({ scope: SCOPE, kind: "rate", observedAt: T0 });
	clock.at = T0 + MIN + 1_000;
	const before = cooldownFiles(dir);
	const unknown = scripted(async () => [errorEvent(ANTHROPIC, "socket hang up")]);
	await drain(guard(store, unknown.delegate, "anthropic", now)(ANTHROPIC, CTX, {}));
	assert.equal(cooldownFiles(dir), before);
	assert.equal((await store.check(SCOPE)).state, "probe-due");
	const throwing = () => {
		throw new Error("delegate exploded");
	};
	const events = await drain(guard(store, throwing, "anthropic", now)(ANTHROPIC, CTX, {}));
	assert.equal(events[0].type, "error");
	assert.equal((await store.check(SCOPE)).state, "probe-due");
});

test("two stores on one directory after expiry: exactly one probe reaches the delegate", async () => {
	const dir = freshDir();
	const clock = { at: T0 };
	const now = () => clock.at;
	const seed = createCooldownStore({ dir, now });
	await seed.recordTrustedError({ scope: SCOPE, kind: "rate", observedAt: T0 });
	clock.at = T0 + MIN + 1_000;
	let release!: () => void;
	const gate = new Promise<void>((resolve) => (release = resolve));
	const { delegate, calls } = scripted(async () => {
		await gate;
		return [doneEvent(ANTHROPIC)];
	});
	const winner = drain(guard(createCooldownStore({ dir, now }), delegate, "anthropic", now)(ANTHROPIC, CTX, {}));
	await new Promise((resolve) => setTimeout(resolve, 20));
	const loserEvents = await drain(guard(createCooldownStore({ dir, now }), delegate, "anthropic", now)(ANTHROPIC, CTX, {}));
	assert.equal(calls.length, 1, "loser must not call the delegate");
	assert.equal(loserEvents[0].error.errorMessage, "provider cooldown probe-busy");
	release();
	const winnerEvents = await winner;
	assert.equal(winnerEvents[0].type, "done");
});

// ---- 5. Real public API delegates (installed pi-ai 1.1.0 dist, mock fetch, no network) ----------------------------

test("real anthropic-messages streamSimple: one physical request, trusted rate cooldown from retry-after-ms", async () => {
	const { streamSimple } = await piAi("api/anthropic-messages.js");
	const { normalizeContext } = await piAi("utils/transcript.js");
	const dir = freshDir();
	const now = () => T0;
	const store = createCooldownStore({ dir, now });
	const mock = countingFetch(() => jsonResponse(429, RATE_BODY, { "retry-after-ms": "90000" }));
	const events = await drain(guard(store, streamSimple, "anthropic", now)(ANTHROPIC, normalizeContext(CTX), { apiKey: "test-key-not-real", fetch: mock.fetchFn }));
	assert.equal(mock.state.calls, 1);
	assert.equal(events.at(-1).type, "error");
	assert.deepEqual(await store.check(SCOPE), { state: "cooling", kind: "rate", untilMs: T0 + 90_000, source: "structured" });
});

test("real openai-codex-responses streamSimple over HTTP: structured usage_limit_reached becomes quota with resets_at", async () => {
	const { streamSimple } = await piAi("api/openai-codex-responses.js");
	const { normalizeContext } = await piAi("utils/transcript.js");
	const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
	const token = `${b64({ alg: "none" })}.${b64({ "https://api.openai.com/auth": { chatgpt_account_id: "acct_test" } })}.sig`;
	const dir = freshDir();
	const now = () => T0;
	const store = createCooldownStore({ dir, now });
	const resetsAt = T0 / 1000 + 3_600;
	const body = { error: { code: "usage_limit_reached", plan_type: "plus", resets_at: resetsAt } };
	const mock = countingFetch(() => jsonResponse(429, body));
	const events = await drain(guard(store, streamSimple, "openai-codex", now)(CODEX, normalizeContext(CTX), { apiKey: token, transport: "sse", fetch: mock.fetchFn }));
	assert.equal(mock.state.calls, 1);
	assert.equal(events.at(-1).type, "error");
	assert.deepEqual(await store.check({ provider: "openai-codex", model: CODEX.id }), { state: "cooling", kind: "quota", untilMs: resetsAt * 1000, source: "structured" });
});

// ---- 6. Repair regressions: admission before the first physical fetch, cancellation terminal, recovery-probe idle limit ----

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
// Resolves on abort, or after a bound so a test never hangs on a delegate that ignores cancellation.
const abortableFor = (signal: AbortSignal | undefined, ms: number) =>
	new Promise<void>((resolve) => {
		const timer = setTimeout(resolve, ms);
		signal?.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
	});
// Pushes each event after its wait (ms), then ends the stream; a consumer that stops reading never blocks the producer.
function paced(steps: Array<[number, unknown]>) {
	const calls: { model: any; options: any }[] = [];
	const delegate = (model: any, _context: any, options: any) => {
		calls.push({ model, options });
		const out = createAssistantMessageEventStream();
		void (async () => {
			for (const [wait, event] of steps) {
				await sleep(wait);
				out.push(event as any);
			}
			out.end();
		})();
		return out;
	};
	return { delegate, calls };
}
function guardIdle(store: CooldownStore, delegate: any, now: () => number, probeIdleTimeoutMs?: number) {
	return guardStreamSimple({ provider: "anthropic", store, delegate, createStream: createAssistantMessageEventStream, now, probeIdleTimeoutMs });
}
// Store with an expired rate cooldown, so the next admission is a probe lease.
async function expiredProbe() {
	const dir = freshDir();
	const clock = { at: T0 };
	const now = () => clock.at;
	const store = createCooldownStore({ dir, now });
	await store.recordTrustedError({ scope: SCOPE, kind: "rate", observedAt: T0 });
	clock.at = T0 + MIN + 1_000;
	return { dir, now, store };
}

test("R1: first physical fetch is refused when a trusted cooldown lands during delegate preparation", async () => {
	const dir = freshDir();
	const now = () => T0;
	const store = createCooldownStore({ dir, now });
	const mock = countingFetch(() => jsonResponse(200, { ok: true }));
	const { delegate } = scripted(async ({ options }) => {
		await store.recordTrustedError({ scope: SCOPE, kind: "rate", observedAt: T0 });
		let refusal = "";
		try {
			await options.fetch(URL_MESSAGES, { method: "POST" });
		} catch (error) {
			refusal = String((error as Error).message);
		}
		return [errorEvent(ANTHROPIC, refusal)];
	});
	const events = await drain(guard(store, delegate, "anthropic", now)(ANTHROPIC, CTX, { fetch: mock.fetchFn }));
	assert.equal(mock.state.calls, 0, "no physical request may leave while a cooldown is recorded");
	assert.match(events.at(-1).error.errorMessage, /physical request blocked/);
	assert.equal((await store.check(SCOPE)).state, "cooling");
});

test("R2: normal request whose delegate aborts and then throws yields an aborted terminal, never an ordinary error", async () => {
	const dir = freshDir();
	const store = createCooldownStore({ dir, now: () => T0 });
	const controller = new AbortController();
	const delegate = async function* () {
		controller.abort();
		throw new DOMException("The operation was aborted", "AbortError");
	};
	const events = await drain(guard(store, delegate, "anthropic", () => T0)(ANTHROPIC, CTX, { signal: controller.signal }));
	assert.equal(events.length, 1);
	assert.equal(events[0].type, "error");
	assert.equal(events[0].reason, "aborted");
	assert.equal(events[0].error.stopReason, "aborted");
	assert.equal(cooldownFiles(dir), 0);
});

test("R2: recovery probe whose delegate aborts and then throws releases as abort with no health write", async () => {
	const { dir, now, store } = await expiredProbe();
	const before = cooldownFiles(dir);
	const controller = new AbortController();
	const delegate = async function* () {
		controller.abort();
		throw new DOMException("The operation was aborted", "AbortError");
	};
	const events = await drain(guard(store, delegate, "anthropic", now)(ANTHROPIC, CTX, { signal: controller.signal }));
	assert.equal(events[0].reason, "aborted");
	assert.equal(cooldownFiles(dir), before);
	assert.equal((await store.check(SCOPE)).state, "probe-due");
});

test("idle: recovery probe with no provider activity aborts at the limit, records nothing and frees its lease", async () => {
	const { dir, now, store } = await expiredProbe();
	const { delegate, calls } = scripted(async ({ options }) => {
		await abortableFor(options.signal, 1_000);
		return [errorEvent(ANTHROPIC, "aborted by delegate", "aborted")];
	});
	const events = await drain(guardIdle(store, delegate, now, 30)(ANTHROPIC, CTX, {}));
	assert.equal(calls.length, 1);
	assert.equal(events.length, 1);
	assert.equal(events[0].reason, "aborted");
	assert.equal(events[0].error.errorMessage, "provider probe idle timeout");
	assert.equal(calls[0].options.signal.aborted, true);
	const other = createCooldownStore({ dir, now });
	assert.equal((await other.check(SCOPE)).state, "probe-due", "idle abort is never a provider failure");
	const lease = await other.tryProbe(SCOPE);
	assert.ok(lease, "lease must be free for another store");
	await lease.finish({ outcome: "abort" });
});

test("idle: provider deltas reset the idle timer, so a probe that keeps streaming completes", async () => {
	const { now, store } = await expiredProbe();
	const partial = message(ANTHROPIC, "stop");
	const delta = { type: "text_delta", contentIndex: 0, delta: "a", partial };
	const { delegate } = paced([[25, delta], [25, delta], [25, delta], [25, delta], [25, delta], [25, doneEvent(ANTHROPIC)]]);
	const events = await drain(guardIdle(store, delegate, now, 80)(ANTHROPIC, CTX, {}));
	assert.deepEqual(events.map((event) => event.type), ["text_delta", "text_delta", "text_delta", "text_delta", "text_delta", "done"]);
	assert.equal((await store.check(SCOPE)).state, "open");
});

test("idle: synthetic start events do not reset the idle timer", async () => {
	const { dir, now, store } = await expiredProbe();
	const partial = message(ANTHROPIC, "stop");
	const start = { type: "start", partial };
	const { delegate } = paced([[10, start], [10, start], [10, start], [10, start], [10, start], [10, start], [200, doneEvent(ANTHROPIC)]]);
	const before = cooldownFiles(dir);
	const events = await drain(guardIdle(store, delegate, now, 40)(ANTHROPIC, CTX, {}));
	assert.equal(events.at(-1).type, "error");
	assert.equal(events.at(-1).error.errorMessage, "provider probe idle timeout");
	assert.equal(events.filter((event) => event.type === "error").length, 1);
	assert.equal(cooldownFiles(dir), before);
	assert.equal((await createCooldownStore({ dir, now }).check(SCOPE)).state, "probe-due");
});

test("idle: a normal open request has no idle policy and completes after a long quiet gap", async () => {
	const store = createCooldownStore({ dir: freshDir(), now: () => T0 });
	const { delegate } = paced([[100, doneEvent(ANTHROPIC)]]);
	const events = await drain(guardIdle(store, delegate, () => T0, 30)(ANTHROPIC, CTX, {}));
	assert.deepEqual(events.map((event) => event.type), ["done"]);
});

test("parent cancel ends a recovery probe at once, even when the delegate ignores the abort", async () => {
	const { now, store } = await expiredProbe();
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 20);
	const { delegate } = scripted(async ({ options }) => {
		await abortableFor(undefined, 1_000); // ignores options.signal entirely
		return [doneEvent(ANTHROPIC)];
	});
	const started = Date.now();
	const events = await drain(guard(store, delegate, "anthropic", now)(ANTHROPIC, CTX, { signal: controller.signal }));
	clearTimeout(timer);
	assert.ok(Date.now() - started < 900, "the stream must not wait for the ignoring delegate");
	assert.equal(events.length, 1);
	assert.equal(events[0].reason, "aborted");
	assert.equal((await store.check(SCOPE)).state, "probe-due");
});

test("idle: a late success after the idle abort is ignored, with no extra event and no health write", async () => {
	const { now, store } = await expiredProbe();
	const { delegate } = scripted(async () => {
		await sleep(60);
		return [doneEvent(ANTHROPIC)];
	});
	const events = await drain(guardIdle(store, delegate, now, 20)(ANTHROPIC, CTX, {}));
	await sleep(100);
	assert.equal(events.length, 1);
	assert.equal(events[0].reason, "aborted");
	assert.equal((await store.check(SCOPE)).state, "probe-due");
});

// ---- 7. Cancellation, observation clones and raw-byte activity (repair regressions) -------------------------------------

const bytes = (text: string) => new TextEncoder().encode(text);
// Emits one part per gap (ms) and closes after the last; pull-driven, so the body is only read when a consumer asks.
function chunkStream(parts: Uint8Array[], gap: number): ReadableStream<Uint8Array> {
	let next = 0;
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			if (next >= parts.length) return controller.close();
			await sleep(gap);
			controller.enqueue(parts[next++]);
		},
	});
}
const sseBody = (count: number, gap: number) => chunkStream(Array.from({ length: count }, () => bytes(": ping\n\n")), gap);

test("A14: a normal request whose delegate ignores abort ends at the explicit parent cancel; no ordinary timeout applies", async () => {
	const dir = freshDir();
	const store = createCooldownStore({ dir, now: () => T0 });
	const controller = new AbortController();
	const { delegate } = scripted(async () => {
		await abortableFor(undefined, 1_000); // ignores options.signal entirely
		return [doneEvent(ANTHROPIC)];
	});
	const timer = setTimeout(() => controller.abort(), 20);
	const started = Date.now();
	const events = await drain(guard(store, delegate, "anthropic", () => T0)(ANTHROPIC, CTX, { signal: controller.signal }));
	clearTimeout(timer);
	assert.ok(Date.now() - started < 900, "explicit cancel must end the public stream without waiting for the delegate");
	assert.equal(events.length, 1);
	assert.equal(events[0].type, "error");
	assert.equal(events[0].reason, "aborted");
	assert.equal(events[0].error.errorMessage, "Request was aborted");
	assert.equal(cooldownFiles(dir), 0);
});

test("MED1: a recovery probe whose 429 body stalls is ended at once by parent cancel and its lease is released", async () => {
	const { dir, now, store } = await expiredProbe();
	const before = cooldownFiles(dir);
	const stalled = new ReadableStream<Uint8Array>({ start: (controller) => controller.enqueue(bytes('{"error":{"type":"rate_limit_error",')) });
	const fetchFn = (async () => new Response(stalled, { status: 429, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
	const { delegate } = scripted(async ({ options }) => {
		await options.fetch(URL_MESSAGES, { method: "POST" });
		await abortableFor(undefined, 1_000); // ignores options.signal entirely
		return [errorEvent(ANTHROPIC, "ignored abort")];
	});
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 100);
	const started = Date.now();
	const events = await drain(guard(store, delegate, "anthropic", now)(ANTHROPIC, CTX, { signal: controller.signal, fetch: fetchFn }));
	clearTimeout(timer);
	assert.ok(Date.now() - started < 900, "a pending observation must not hold a cancelled stream for the settle bound");
	assert.equal(events.length, 1);
	assert.equal(events[0].reason, "aborted");
	assert.equal(events[0].error.errorMessage, "Request was aborted");
	assert.equal(cooldownFiles(dir), before);
	assert.equal((await store.check(SCOPE)).state, "probe-due");
	const lease = await createCooldownStore({ dir, now }).tryProbe(SCOPE);
	assert.ok(lease, "the lease must be free after the cancel");
	await lease.finish({ outcome: "abort" });
});

test("LOW1: an observation clone that throws never reaches the SDK; the original response reaches it untouched", async () => {
	const dir = freshDir();
	const store = createCooldownStore({ dir, now: () => T0 });
	const original = jsonResponse(429, RATE_BODY, { "retry-after-ms": "90000" });
	(original as any).clone = () => {
		throw new TypeError("clone refused");
	};
	let seen: unknown;
	let text = "";
	const { delegate } = scripted(async ({ options }) => {
		const res = await options.fetch(URL_MESSAGES, { method: "POST" });
		seen = res;
		text = await res.text();
		return [errorEvent(ANTHROPIC, "429 rate limited")];
	});
	const events = await drain(guard(store, delegate, "anthropic", () => T0)(ANTHROPIC, CTX, { fetch: (async () => original) as unknown as typeof fetch }));
	assert.equal(seen, original);
	assert.equal(text, JSON.stringify(RATE_BODY));
	assert.equal(events.at(-1).error.errorMessage, "429 rate limited");
	assert.equal(cooldownFiles(dir), 0);
});

test("LOW1: a probe whose activity clone throws still completes with the original response", async () => {
	const { now, store } = await expiredProbe();
	const original = new Response(chunkStream([bytes(": ping\n\n"), bytes(": ping\n\n")], 5), { status: 200 });
	(original as any).clone = () => {
		throw new TypeError("clone refused");
	};
	let text = "";
	const { delegate } = scripted(async ({ options }) => {
		const res = await options.fetch(URL_MESSAGES, { method: "POST" });
		text = await res.text();
		return [doneEvent(ANTHROPIC)];
	});
	const events = await drain(guard(store, delegate, "anthropic", now)(ANTHROPIC, CTX, { fetch: (async () => original) as unknown as typeof fetch }));
	assert.equal(text, ": ping\n\n: ping\n\n");
	assert.deepEqual(events.map((event) => event.type), ["done"]);
	assert.equal((await store.check(SCOPE)).state, "open");
});

test("R3: raw SSE ping bytes are provider activity; a probe streaming pings without SDK deltas is not idle-aborted", async () => {
	const { now, store } = await expiredProbe();
	let text = "";
	const { delegate } = scripted(async ({ options }) => {
		const res = await options.fetch(URL_MESSAGES, { method: "POST" });
		text = await res.text(); // SDK-like consumption while pings arrive: no delta events
		return [doneEvent(ANTHROPIC)];
	});
	const fetchFn = (async () => new Response(sseBody(15, 20), { status: 200, headers: { "content-type": "text/event-stream" } })) as unknown as typeof fetch;
	const events = await drain(guardIdle(store, delegate, now, 60)(ANTHROPIC, CTX, { fetch: fetchFn }));
	assert.deepEqual(events.map((event) => event.type), ["done"]);
	assert.equal(text, ": ping\n\n".repeat(15));
	assert.equal((await store.check(SCOPE)).state, "open");
});

test("R3: empty body chunks are not provider activity; a probe whose stream carries only empty chunks is idle-aborted", async () => {
	const { dir, now, store } = await expiredProbe();
	const before = cooldownFiles(dir);
	const { delegate } = scripted(async ({ options }) => {
		const res = await options.fetch(URL_MESSAGES, { method: "POST" });
		void res.text().catch(() => undefined);
		await abortableFor(options.signal, 1_000);
		return [errorEvent(ANTHROPIC, "aborted by delegate", "aborted")];
	});
	const emptyChunks = chunkStream(Array.from({ length: 40 }, () => new Uint8Array(0)), 10);
	const fetchFn = (async () => new Response(emptyChunks, { status: 200 })) as unknown as typeof fetch;
	const events = await drain(guardIdle(store, delegate, now, 60)(ANTHROPIC, CTX, { fetch: fetchFn }));
	assert.equal(events.length, 1);
	assert.equal(events[0].reason, "aborted");
	assert.equal(events[0].error.errorMessage, "provider probe idle timeout");
	assert.equal(cooldownFiles(dir), before);
	assert.equal((await store.check(SCOPE)).state, "probe-due");
});

test("R3: an oversized probe 429 keeps counting bytes as activity but never classifies or keeps its text", async () => {
	const { dir, now, store } = await expiredProbe();
	const before = cooldownFiles(dir);
	const oversized = bytes(`{"error":{"type":"rate_limit_error","message":"${"x".repeat(2_500)}"}}`);
	const parts: Uint8Array[] = [];
	for (let at = 0; at < oversized.length; at += 600) parts.push(oversized.slice(at, at + 600));
	let text = "";
	const { delegate } = scripted(async ({ options }) => {
		const res = await options.fetch(URL_MESSAGES, { method: "POST" });
		text = await res.text();
		return [errorEvent(ANTHROPIC, "429 rate limited")];
	});
	const fetchFn = (async () => new Response(chunkStream(parts, 40), { status: 429, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
	const events = await drain(guardIdle(store, delegate, now, 60)(ANTHROPIC, CTX, { fetch: fetchFn }));
	assert.equal(text.length, oversized.length);
	assert.equal(events.at(-1).error.errorMessage, "429 rate limited");
	assert.equal(cooldownFiles(dir), before);
	assert.equal((await store.check(SCOPE)).state, "probe-due");
});

test("reader cleanup: after a parent cancel no observation or activity reader keeps pulling the response body", async () => {
	const { now, store } = await expiredProbe();
	let pulls = 0;
	const trickle = new ReadableStream<Uint8Array>({
		async pull(controller) {
			pulls += 1;
			await sleep(10);
			controller.enqueue(bytes(" "));
		},
	});
	const fetchFn = (async () => new Response(trickle, { status: 429, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
	const { delegate } = scripted(async ({ options }) => {
		await options.fetch(URL_MESSAGES, { method: "POST" }); // the SDK never reads the original body here
		await abortableFor(undefined, 1_000);
		return [errorEvent(ANTHROPIC, "ignored abort")];
	});
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 100);
	const events = await drain(guard(store, delegate, "anthropic", now)(ANTHROPIC, CTX, { signal: controller.signal, fetch: fetchFn }));
	clearTimeout(timer);
	assert.equal(events[0].reason, "aborted");
	const atEnd = pulls;
	await sleep(120);
	assert.ok(pulls - atEnd <= 1, `body pulls continued after settle: ${atEnd} -> ${pulls}`);
	assert.equal((await store.check(SCOPE)).state, "probe-due");
});

// ---- 5. Phase B corrections (review LOW-A, LOW-B) ----------------------------------------------------------------------

test("LOW-A: a 401 in a recovery probe is classified from its status at once, even when its body never ends", async () => {
	const { now, store } = await expiredProbe();
	const hung = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes("{}")); } });
	const fetchFn = (async () => new Response(hung, { status: 401, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
	const { delegate } = scripted(async ({ options }) => {
		await options.fetch(URL_MESSAGES, { method: "POST" });
		return [errorEvent(ANTHROPIC, "401 unauthorized")];
	});
	const started = Date.now();
	await drain(guardIdle(store, delegate, now, 60_000)(ANTHROPIC, CTX, { fetch: fetchFn }));
	assert.ok(Date.now() - started < 2_000, "a 401 must not wait for the body settle bound");
	assert.equal((await store.check(SCOPE)).state, "blocked");
});

test("LOW-B: a caller abort during admission skips the delegate entirely", async () => {
	const controller = new AbortController();
	const calls = { delegate: 0 };
	const store = fakeStore({ check: async () => (controller.abort(), { state: "open" }) });
	const delegate = () => (calls.delegate += 1, createAssistantMessageEventStream());
	const events = await drain(guard(store, delegate, "anthropic", () => T0)(ANTHROPIC, CTX, { signal: controller.signal }));
	assert.equal(calls.delegate, 0);
	assert.equal(events.length, 1);
	assert.equal(events[0].reason, "aborted");
});

test("LOW-B: a caller abort during probe admission takes no lease and calls no delegate", async () => {
	const controller = new AbortController();
	const calls = { delegate: 0, tryProbe: 0 };
	const store = fakeStore({
		check: async () => (controller.abort(), { state: "probe-due" }),
		tryProbe: async () => (calls.tryProbe += 1, undefined),
	});
	const delegate = () => (calls.delegate += 1, createAssistantMessageEventStream());
	const events = await drain(guard(store, delegate, "anthropic", () => T0)(ANTHROPIC, CTX, { signal: controller.signal }));
	assert.equal(calls.tryProbe, 0);
	assert.equal(calls.delegate, 0);
	assert.equal(events[0].reason, "aborted");
});

test("LOW-B: a caller abort right after a probe lease is won releases it as abort and calls no delegate", async () => {
	const controller = new AbortController();
	const calls = { delegate: 0, finish: [] as string[] };
	const lease = { scope: SCOPE, startedAt: T0, renew: async () => true, finish: async (outcome: { outcome: string }) => (calls.finish.push(outcome.outcome), undefined) };
	const store = fakeStore({
		check: async () => ({ state: "probe-due" }),
		tryProbe: async () => (controller.abort(), lease),
	});
	const delegate = () => (calls.delegate += 1, createAssistantMessageEventStream());
	const events = await drain(guard(store, delegate, "anthropic", () => T0)(ANTHROPIC, CTX, { signal: controller.signal }));
	assert.equal(calls.delegate, 0);
	assert.deepEqual(calls.finish, ["abort"]);
	assert.equal(events[0].reason, "aborted");
});

// ---- 6. R4: a trusted 401 is recorded at status observation, not only after the SDK's own error-body read settles ------------

test("R4: a trusted 401 is recorded at status observation while the SDK error body is still pending", async () => {
	const store = createCooldownStore({ dir: freshDir(), now: () => T0 });
	const hung = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes("{")); } });
	const fetchFn = (async () => new Response(hung, { status: 401, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
	const controller = new AbortController();
	const { delegate } = scripted(async ({ options }) => {
		await options.fetch(URL_MESSAGES, { method: "POST" });
		await new Promise<never>(() => undefined); // the SDK waits on its own error-body read
		return [];
	});
	const run = drain(guard(store, delegate, "anthropic", () => T0)(ANTHROPIC, CTX, { fetch: fetchFn, signal: controller.signal }));
	await sleep(100);
	assert.equal((await store.check(SCOPE)).state, "blocked", "the auth block is durable before the body settles");
	controller.abort();
	await run;
	assert.equal((await store.check(SCOPE)).state, "blocked", "an abort after the observed 401 keeps it");
});

test("R4: a 401 is recorded once, at observation, and never again at the terminal", async () => {
	const recorded: string[] = [];
	const store = fakeStore({ check: async () => ({ state: "open" }), recordTrustedError: async (input: { kind: string }) => (recorded.push(input.kind), undefined) });
	const mock = countingFetch(() => new Response("{}", { status: 401, headers: { "content-type": "application/json" } }));
	const { delegate } = scripted(async ({ options }) => {
		await options.fetch(URL_MESSAGES, { method: "POST" });
		return [errorEvent(ANTHROPIC, "401 unauthorized")];
	});
	await drain(guard(store, delegate, "anthropic", () => T0)(ANTHROPIC, CTX, { fetch: mock.fetchFn }));
	assert.equal(mock.state.calls, 1);
	assert.deepEqual(recorded, ["auth"]);
});

test("R4: a 401 whose attempt is canceled before any response is observed writes no record", async () => {
	const controller = new AbortController();
	const recorded: string[] = [];
	const store = fakeStore({ check: async () => ({ state: "open" }), recordTrustedError: async (input: { kind: string }) => (recorded.push(input.kind), undefined) });
	const mock = countingFetch(() => new Response("{}", { status: 401, headers: { "content-type": "application/json" } }));
	const { delegate } = scripted(async ({ options }) => {
		controller.abort();
		await options.fetch(URL_MESSAGES, { method: "POST" }); // refused: the attempt is already cancelled
		return [];
	});
	const events = await drain(guard(store, delegate, "anthropic", () => T0)(ANTHROPIC, CTX, { fetch: mock.fetchFn, signal: controller.signal }));
	assert.equal(mock.state.calls, 0);
	assert.deepEqual(recorded, []);
	assert.equal(events.at(-1).reason, "aborted");
});
