// Provider-boundary cooldown guard for supported built-in providers (streamSimple override). Every provider request is
// admitted against the shared store first; the native fetch boundary of public pi-ai delegates is observed (never consumed)
// and only trusted kinds (auth/quota/rate/model) are recorded. Scope label 'provider-client-observed' is NOT upstream-verified:
// a Bili MITM may sit in front of the provider. Never logs secrets, account ids, fingerprints or raw bodies.
import type { Api, AssistantMessage, AssistantMessageEvent, AssistantMessageEventStream, FetchFunction, Model, SimpleStreamOptions, StreamFunction } from "@earendil-works/pi-ai";
import type { Admission, CooldownStore, ProbeLease, ProbeOutcome, ProviderScope, TrustedKind, TrustedReset } from "./provider-cooldown.ts";

export const MAX_OBSERVED_BODY_BYTES = 2_048;
export const OBSERVE_SETTLE_MS = 5_000; // bounded wait for body reads still pending when an attempt ends; timeout => no classification
export const PROBE_IDLE_TIMEOUT_MS = 120_000; // recovery probes only: no provider activity for this long aborts the probe; normal requests have no idle limit
const OBSERVED_STATUS = new Set([401, 403, 404, 429]);
const AUTH_TYPES = ["authentication_error", "permission_error"];
const QUOTA_CODES = ["usage_limit_reached", "insufficient_quota"];
const RATE_CODES = ["rate_limit_exceeded", "rate_limit_error"];
const IMF_FIXDATE = /^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/; // structured HTTP-date only

export type ProviderStreamFn = (model: Model<Api>, context: Parameters<StreamFunction>[1], options?: SimpleStreamOptions) => AssistantMessageEventStream;
export type Observation = { kind: TrustedKind; trustedReset?: TrustedReset; observedAt: number };
export interface ProviderGuardDeps {
	provider: string;
	store: CooldownStore;
	delegate: ProviderStreamFn;
	createStream: () => AssistantMessageEventStream;
	now?: () => number;
	probeIdleTimeoutMs?: number; // test seam; production uses PROBE_IDLE_TIMEOUT_MS
}
// ended cancels every body reader still open when the attempt leaves; onActivity counts provider bytes (recovery probes only).
type Attempt = { pending: Set<Promise<void>>; physical: number; observed?: Observation; early?: Promise<void>; closed: boolean; ended: AbortController; onActivity?: () => void };
type BodyWatch = { capture?: boolean; onBytes?: () => void; signal?: AbortSignal };

const asObject = (value: unknown): Record<string, unknown> | undefined =>
	typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

// Structured error object of a parsed JSON body; prose and non-JSON bodies have none.
const errorOf = (body: unknown): Record<string, unknown> | undefined => asObject(asObject(body)?.error);

function hasToken(body: unknown, tokens: readonly string[]): boolean {
	const error = errorOf(body);
	return error !== undefined && [error.code, error.type].some((value) => typeof value === "string" && tokens.includes(value));
}

// Exact decimal digits only: fractions, signs and prose are never trusted.
function wholeDigits(value: string | null): number | undefined {
	return value !== null && /^\d{1,15}$/.test(value) ? Number(value) : undefined;
}

// First valid structured reset in precedence order (retry-after-ms, retry-after, resets_at); invalid values are omitted.
function resetOf(kind: TrustedKind, headers: Headers, body: unknown, observedAt: number): TrustedReset | undefined {
	const ms = wholeDigits(headers.get("retry-after-ms"));
	if (ms !== undefined && ms > 0) return { retryAfterMs: ms };
	const seconds = wholeDigits(headers.get("retry-after"));
	if (seconds !== undefined && seconds > 0) return { retryAfter: seconds };
	const date = headers.get("retry-after");
	if (date !== null && IMF_FIXDATE.test(date) && Date.parse(date) > observedAt) return { retryAfter: date };
	const resetsAt = errorOf(body)?.resets_at;
	if (kind === "quota" && Number.isSafeInteger(resetsAt) && (resetsAt as number) * 1000 > observedAt) return { resetsAtEpochSeconds: resetsAt };
	return undefined;
}

// Pure: maps one physical response to a trusted kind. Prose, 5xx, 400 and unstructured bodies never classify.
export function classifyObservation(status: number, headers: Headers, body: unknown, observedAt: number): Observation | undefined {
	if (status === 401) return { kind: "auth", observedAt };
	if (status === 403) return hasToken(body, AUTH_TYPES) ? { kind: "auth", observedAt } : undefined;
	if (status === 404) {
		return hasToken(body, ["model_not_found"]) ? { kind: "model", trustedReset: resetOf("model", headers, body, observedAt), observedAt } : undefined;
	}
	if (status !== 429 || errorOf(body) === undefined) return undefined; // a non-JSON 429 (friendly rewrites, prose) is never structured
	const kind = hasToken(body, QUOTA_CODES) ? "quota" : hasToken(body, RATE_CODES) ? "rate" : undefined;
	if (kind === undefined) return undefined;
	return { kind, trustedReset: resetOf(kind, headers, body, observedAt), observedAt };
}

// Parses at most MAX_OBSERVED_BODY_BYTES from a clone; oversized, malformed or erroring bodies yield undefined and cancel is not awaited.
// With onBytes, a body past the cap keeps counting bytes as activity but keeps no text; capture=false keeps no text at all.
export async function readBoundedJson(response: Response, watch: BodyWatch = {}): Promise<unknown> {
	const { capture = true, onBytes, signal } = watch;
	const reader = response.body?.getReader();
	if (!reader) return undefined;
	const cancel = (): void => void reader.cancel().catch(() => undefined); // an abort ends the read without awaiting the body
	signal?.addEventListener("abort", cancel, { once: true });
	if (signal?.aborted) cancel();
	const decoder = new TextDecoder();
	let text = "";
	let total = 0;
	let oversized = false;
	try {
		for (;;) {
			const result = await reader.read();
			if (result.done || signal?.aborted) break;
			if (result.value.byteLength > 0) onBytes?.(); // empty chunks are not provider activity
			total += result.value.byteLength;
			if (total > MAX_OBSERVED_BODY_BYTES) {
				if (!onBytes) {
					cancel();
					return undefined;
				}
				oversized = true;
			}
			if (capture && !oversized) text += decoder.decode(result.value, { stream: true });
		}
		if (!capture || oversized || signal?.aborted) return undefined;
		return JSON.parse(text + decoder.decode());
	} catch {
		return undefined;
	}
}

// Reads only a clone: the original Response that the SDK consumes is returned untouched. A refused clone skips observation only.
// Activity-only readers (recovery probes) are cancelled with the attempt and never awaited or counted as pending.
function observe(attempt: Attempt, response: Response, now: () => number): void {
	const observedAt = now();
	const status = response.status;
	const observed = OBSERVED_STATUS.has(status);
	if (!observed && !attempt.onActivity) return;
	const capture = observed && status !== 401; // 401 is classified from its status alone, never from its body
	let read: Promise<unknown> = Promise.resolve(undefined);
	if (capture || attempt.onActivity) {
		try {
			read = readBoundedJson(response.clone(), { capture, onBytes: attempt.onActivity, signal: attempt.ended.signal });
		} catch {
			return; // a consumed or locked body refuses the clone: the SDK still receives the original
		}
	}
	if (!observed || status === 401) {
		// A 401 is classified from its status at once; an activity-only reader never gates settle or waits for the body.
		if (status === 401 && !attempt.closed && attempt.observed === undefined) attempt.observed = { kind: "auth", observedAt };
		void read.catch(() => undefined);
		return;
	}
	const task: Promise<void> = read
		.then((body) => {
			const found = classifyObservation(status, response.headers, body, observedAt);
			if (found && !attempt.closed && attempt.observed === undefined) attempt.observed = found;
		}, () => undefined)
		.finally(() => attempt.pending.delete(task));
	attempt.pending.add(task);
}

// Waits for pending observations within the bound; a stop (parent cancel, idle limit, end) ends the wait at once.
async function settle(attempt: Attempt, stopped: Promise<unknown>): Promise<void> {
	if (attempt.pending.size === 0) return;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const finished = await Promise.race([
		Promise.allSettled([...attempt.pending]).then(() => true),
		new Promise<boolean>((resolve) => {
			timer = setTimeout(() => resolve(false), OBSERVE_SETTLE_MS);
		}),
		stopped.then(() => false),
	]);
	clearTimeout(timer);
	if (!finished) attempt.closed = true; // a late read after the bound or a stop is never classified
}

export function guardStreamSimple(deps: ProviderGuardDeps): ProviderStreamFn {
	const now = deps.now ?? (() => Date.now());

	// Stable, text-free error events: the only classification the parent sees is the message below.
	const failure = (model: Model<Api> | undefined, errorMessage: string, reason: "error" | "aborted" = "error"): AssistantMessageEvent => {
		const error: AssistantMessage = {
			role: "assistant",
			content: [],
			api: model?.api ?? "unknown",
			provider: model?.provider ?? deps.provider,
			model: model?.id ?? "unknown",
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
			stopReason: reason,
			errorMessage,
			timestamp: now(),
		};
		return { type: "error", reason, error };
	};

	async function run(out: AssistantMessageEventStream, model: Model<Api>, context: Parameters<StreamFunction>[1], options?: SimpleStreamOptions): Promise<void> {
		if (!model || model.provider !== deps.provider || typeof model.id !== "string") {
			out.push(failure(model, "provider cooldown invalid-model"));
			return;
		}
		if (options?.signal?.aborted) {
			out.push(failure(model, "Request was aborted", "aborted"));
			return;
		}
		const scope: ProviderScope = { provider: deps.provider, model: model.id };

		// Admission before every provider request: only open, or a won probe lease, may reach the delegate.
		let admission: Admission;
		try {
			admission = await deps.store.check(scope);
		} catch {
			out.push(failure(model, "provider cooldown unavailable"));
			return;
		}
		// A caller that left during admission takes no lease and reaches no delegate.
		if (options?.signal?.aborted) {
			out.push(failure(model, "Request was aborted", "aborted"));
			return;
		}
		let lease: ProbeLease | undefined;
		if (admission.state === "probe-due") {
			try {
				lease = await deps.store.tryProbe(scope);
			} catch {
				out.push(failure(model, "provider cooldown unavailable"));
				return;
			}
			if (options?.signal?.aborted) {
				await lease?.finish({ outcome: "abort" }).catch(() => undefined); // released without a penalty or health write
				out.push(failure(model, "Request was aborted", "aborted"));
				return;
			}
			if (!lease) {
				out.push(failure(model, "provider cooldown probe-busy"));
				return;
			}
		} else if (admission.state !== "open") {
			out.push(failure(model, `provider cooldown ${admission.state}`));
			return;
		}

		const attempt: Attempt = { pending: new Set(), physical: 0, closed: false, ended: new AbortController() };
		let released = false;
		const release = async (outcome: ProbeOutcome): Promise<void> => {
			if (!lease || released) return;
			released = true;
			await lease.finish(outcome).catch(() => undefined); // a failed write keeps the lease until its TTL
		};
		// A recovery probe alone gets a child signal linked to the parent plus an inactivity limit; normal requests keep their options.
		const child = lease ? new AbortController() : undefined;
		let idleFired = false;
		let idle: ReturnType<typeof setTimeout> | undefined;
		let finished = false; // once the attempt ends, late bytes or events never re-arm the limit
		const armIdle = (): void => {
			if (!child || finished || child.signal.aborted) return;
			clearTimeout(idle);
			idle = setTimeout(() => {
				idleFired = true;
				child.abort();
			}, deps.probeIdleTimeoutMs ?? PROBE_IDLE_TIMEOUT_MS);
		};
		const disarm = (): void => {
			finished = true;
			clearTimeout(idle);
		};
		// An explicit parent cancel or a probe idle limit ends the public stream at once, even when the delegate ignores abort.
		let stop: () => void = () => undefined;
		const stopped = new Promise<"stopped">((resolve) => (stop = () => resolve("stopped")));
		const parentAbort = (): void => {
			child?.abort();
			stop();
		};
		child?.signal.addEventListener("abort", stop, { once: true });
		options?.signal?.addEventListener("abort", parentAbort, { once: true });
		if (options?.signal?.aborted) parentAbort();
		armIdle(); // the limit starts at lease acquisition; a normal request has no child, so it is never armed
		if (child) attempt.onActivity = armIdle; // recovery probes only: provider bytes reset the limit
		try {
			// Every physical request, the first included, re-checks the store; only open or our own won probe may leave.
			const guardedFetch: FetchFunction = async (input, init) => {
				await settle(attempt, stopped);
				if (attempt.observed) throw new Error("provider cooldown: physical retry blocked after trusted observation");
				if (child?.signal.aborted || options?.signal?.aborted) throw new Error("provider cooldown: request aborted");
				const { state } = await deps.store.check(scope);
				if (!(state === "open" || (lease !== undefined && state === "probe-busy"))) {
					throw new Error(attempt.physical > 0 ? "provider cooldown: physical retry blocked" : "provider cooldown: physical request blocked");
				}
				attempt.physical += 1;
				const response = await (options?.fetch ?? globalThis.fetch)(input, init);
				observe(attempt, response, now);
				if (response.status === 401 && attempt.observed && attempt.early === undefined) {
					const { kind, trustedReset, observedAt } = attempt.observed;
					// A 401 is trusted from its status: recorded at observation, never after the SDK's own error-body read settles.
					attempt.early = deps.store.recordTrustedError({ scope, kind, trustedReset, observedAt }).then(() => undefined, () => undefined);
				}
				armIdle(); // a received response is actual provider traffic
				return response;
			};

			let terminal: AssistantMessageEvent | undefined;
			let thrown = false;
			let iterator: AsyncIterator<AssistantMessageEvent> | undefined;
			try {
				iterator = deps.delegate(model, context, { ...options, fetch: guardedFetch, ...(child ? { signal: child.signal } : {}) })[Symbol.asyncIterator]();
				for (;;) {
					const step = await Promise.race([iterator.next(), stopped]);
					if (step === "stopped" || step.done) break;
					const event = step.value;
					if (event.type === "done" || event.type === "error") {
						terminal = event; // held until the store has settled, so the consumer never sees an error before its record
						break;
					}
					if (event.type.endsWith("_delta")) armIdle(); // text, thinking and tool deltas are provider activity; start events are local
					out.push(event);
				}
			} catch {
				thrown = true;
			}
			disarm();
			void Promise.resolve().then(() => iterator?.return?.()).catch(() => undefined); // initiated, never awaited: a stopped delegate may never settle
			await settle(attempt, stopped);
			attempt.closed = true;
			attempt.ended.abort(); // every body reader still open is cancelled here
			// Cancellation is terminal: a delegate that ends, throws or errors after abort reports as aborted, never as an ordinary error.
			const cancelled = idleFired || child?.signal.aborted === true || options?.signal?.aborted === true;
			if (cancelled && (terminal === undefined || (terminal.type === "error" && terminal.reason !== "aborted"))) {
				terminal = failure(model, idleFired ? "provider probe idle timeout" : "Request was aborted", "aborted");
			}
			if (!terminal) terminal = failure(model, thrown ? "provider request failed" : "provider stream ended without terminal event");

			const aborted = cancelled || (terminal.type === "error" && terminal.reason === "aborted");
			const observed = attempt.observed;
			await attempt.early; // a 401 recorded at observation is already stored before the consumer sees the error
			if (observed && !aborted && terminal.type === "error" && attempt.early === undefined) {
				// Recorded with the observation time; a leased probe then releases as abort so the store's own clock never rewrites the deadline.
				await deps.store
					.recordTrustedError({ scope, kind: observed.kind, trustedReset: observed.trustedReset, observedAt: observed.observedAt })
					.catch(() => undefined);
			}
			await release(terminal.type === "done" && !cancelled ? { outcome: "success" } : { outcome: "abort" });
			out.push(terminal);
		} finally {
			disarm();
			attempt.ended.abort(); // any path that leaves early still cancels its body readers
			options?.signal?.removeEventListener("abort", parentAbort);
			await release({ outcome: "abort" }); // no penalty and no health write on any path that did not settle
		}
	}

	return (model, context, options) => {
		const out = deps.createStream();
		void run(out, model, context, options).catch(() => out.push(failure(model, "provider cooldown guard failed")));
		return out;
	};
}
