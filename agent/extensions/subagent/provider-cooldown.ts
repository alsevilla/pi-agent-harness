// Shared provider cooldown: error classifier + file store. Pure module: no Pi core imports.
// Main and child routers import this same module; the store directory and clock are injected.
import { randomBytes } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export const QUOTA_DEFAULT_MS = 300_000; // quota without a trusted reset
export const TRANSIENT_MS = 60_000; // rate, transient and model cooldown default
export const MAX_TRUSTED_RESET_MINUTES = 11_520; // 8 days; longer or invalid resets become manual, never clamped
export const MAX_TRUSTED_RESET_MS = MAX_TRUSTED_RESET_MINUTES * 60_000;
export const LEASE_TTL_MS = 120_000;
export const LEASE_RENEW_MS = 30_000; // renews well inside the TTL so only a dead owner expires
export const MAX_STATE_ENTRIES = 500; // more visible entries fail closed (overflow)
export const MAX_ENTRY_BYTES = 2_048;
const MAX_ENUMERATIONS = 16;

const PROVIDER_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/; // file-name safe: no separators, no dot prefix
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,199}$/;
const QUOTA_RE = /usage limit|quota/i;
const AUTH_RE = /\b40[13]\b|unauthori[sz]ed|forbidden|authentication failed|invalid api key/i;
const MODEL_RE = /\bmodel_not_found\b|\bmodel\b.*\b(?:not found|does not exist|not available|not supported|unknown|unsupported)\b/i;
const RATE_RE = /\b429\b|rate[\s_-]?limit|too many requests/i;
const TRANSIENT_RE = /\b(?:408|500|502|503|504)\b|no response|unavailable|overloaded|temporarily/i;
const ERROR_KINDS = new Set(["auth", "model", "rate", "transient", "quota"]);
const SOURCES = new Set(["text", "structured", "default", "manual", "indefinite"]);
const TRUSTED_KINDS = new Set<string>(["auth", "quota", "rate", "model"]); // the only kinds that may write global state

export type ErrorKind = "auth" | "model" | "rate" | "transient" | "quota";
export type TrustedKind = "auth" | "quota" | "rate" | "model"; // provider-client-observed kinds only
export type CooldownSource = "text" | "structured" | "default" | "manual" | "indefinite";
export type UnavailableReason = "malformed" | "unreadable" | "overflow" | "write-failed";
export type ProviderScope = { provider: string; model?: string };
export type Classification = { kind: "none" | ErrorKind; relativeMinutes?: number };
// Structured reset metadata from the caller (never parsed from prose).
export type TrustedReset = { retryAfterMs?: unknown; retryAfter?: unknown; resetsAtEpochSeconds?: unknown };
export type RecordedCooldown = { kind: ErrorKind; source: CooldownSource; untilMs?: number };
export type Admission =
	| { state: "open" }
	| { state: "cooling"; kind: ErrorKind; untilMs: number; source: CooldownSource }
	| { state: "probe-due"; kind?: ErrorKind }
	| { state: "probe-busy"; untilMs: number }
	| { state: "blocked"; reason: "auth" | "manual" }
	| { state: "unavailable"; reason: UnavailableReason };
export type ProbeOutcome =
	| { outcome: "success" }
	| { outcome: "abort" }
	| { outcome: "error"; kind: TrustedKind; trustedReset?: TrustedReset };
export interface ProbeLease {
	readonly scope: ProviderScope;
	readonly startedAt: number;
	renew(): Promise<boolean>;
	finish(outcome: ProbeOutcome): Promise<RecordedCooldown | undefined>;
}
export interface TrustedErrorInput {
	scope: ProviderScope;
	kind: TrustedKind;
	trustedReset?: TrustedReset;
	observedAt?: number;
}
export interface CooldownStoreOptions {
	dir: string;
	now?: () => number;
	hooks?: { afterLeaseAcquired?: () => Promise<void>; beforeLeaseMetadata?: (step: "renew" | "finish") => Promise<void> };
}
export interface CooldownStore {
	check(scope: ProviderScope): Promise<Admission>;
	recordTrustedError(input: TrustedErrorInput): Promise<RecordedCooldown | undefined>;
	recordSuccess(scope: ProviderScope, startedAt: number): Promise<void>;
	refreshAuth(provider: string): Promise<void>;
	tryProbe(scope: ProviderScope): Promise<ProbeLease | undefined>;
}

// Thrown only with a reason, never with raw error text, tokens, account ids or credentials.
export class CooldownStoreError extends Error {
	reason: UnavailableReason;
	constructor(reason: UnavailableReason) {
		super(`provider cooldown state ${reason}`);
		this.name = "CooldownStoreError";
		this.reason = reason;
	}
}

export function classifyProviderError(message: string | undefined): Classification {
	const text = message ?? "";
	if (QUOTA_RE.test(text)) {
		const minutes = /try again in ~?\s*(\d+)\s*min/i.exec(text);
		return minutes ? { kind: "quota", relativeMinutes: Number(minutes[1]) } : { kind: "quota" };
	}
	if (AUTH_RE.test(text)) return { kind: "auth" };
	if (MODEL_RE.test(text)) return { kind: "model" };
	if (RATE_RE.test(text)) return { kind: "rate" };
	if (TRANSIENT_RE.test(text)) return { kind: "transient" };
	return { kind: "none" };
}

function wholeNumber(value: unknown): number | undefined {
	if (typeof value === "number") return Number.isSafeInteger(value) ? value : undefined;
	return typeof value === "string" && /^\d{1,15}$/.test(value) ? Number(value) : undefined;
}

// A structured deadline must be finite, strictly future and inside the 8-day window; anything else is "invalid".
function deadline(untilMs: number, observedAt: number): number | "invalid" {
	const delta = untilMs - observedAt;
	return Number.isFinite(untilMs) && delta > 0 && delta <= MAX_TRUSTED_RESET_MS ? untilMs : "invalid";
}

function structuredUntil(reset: TrustedReset, observedAt: number): number | "invalid" | undefined {
	if (reset.retryAfterMs !== undefined) {
		const ms = wholeNumber(reset.retryAfterMs);
		return ms === undefined ? "invalid" : deadline(observedAt + ms, observedAt);
	}
	if (reset.retryAfter !== undefined) {
		const seconds = wholeNumber(reset.retryAfter);
		if (seconds !== undefined) return deadline(observedAt + seconds * 1000, observedAt);
		const date = typeof reset.retryAfter === "string" ? Date.parse(reset.retryAfter) : Number.NaN; // structured HTTP-date only
		return deadline(date, observedAt);
	}
	if (reset.resetsAtEpochSeconds !== undefined) {
		const epoch = wholeNumber(reset.resetsAtEpochSeconds);
		return epoch === undefined ? "invalid" : deadline(epoch * 1000, observedAt);
	}
	return undefined;
}

function resolveReset(kind: ErrorKind, reset: TrustedReset | undefined, observedAt: number): { source: CooldownSource; untilMs?: number } {
	const structured = reset ? structuredUntil(reset, observedAt) : undefined;
	if (structured === "invalid") return { source: "manual" };
	if (structured !== undefined) return { source: "structured", untilMs: structured };
	return { source: "default", untilMs: observedAt + (kind === "quota" ? QUOTA_DEFAULT_MS : TRANSIENT_MS) };
}

type CooldownRecord = {
	v: 1;
	kind: ErrorKind;
	source: CooldownSource;
	provider: string;
	model?: string;
	observedAt: number;
	untilMs?: number;
};
type ClearRecord = { v: 1; kind: "clear"; provider: string; model?: string; at: number; ack?: string[] };
type Named<T> = T & { name: string };
type RefreshRecord = { v: 1; kind: "refresh"; provider: string; at: number };
// Generation-fenced leases: a claim is immutable; renew/finish append their own immutable metadata and never touch a claim.
type LeaseRecord = { v: 1; kind: "lease"; gen: number; nonce: string; startedAt: number; expiresAt: number };
type RenewRecord = { v: 1; kind: "renew"; gen: number; nonce: string; expiresAt: number };
type FinishRecord = { v: 1; kind: "finish"; gen: number; nonce: string };
type Stored<T> = { name: string; provider: string; value: T };
type Fence = { gen: number; nonce: string; expiresAt: number; finished: boolean };
type Snapshot = {
	cooldowns: Named<CooldownRecord>[];
	clears: Named<ClearRecord>[];
	refreshes: Named<RefreshRecord>[];
	claims: Stored<LeaseRecord>[];
	renews: Stored<RenewRecord>[];
	finishes: Stored<FinishRecord>[];
};
type Entry =
	| { type: "cooldown"; value: CooldownRecord }
	| { type: "clear"; value: ClearRecord }
	| { type: "refresh"; value: RefreshRecord }
	| { type: "claim"; name: string; provider: string; value: LeaseRecord }
	| { type: "renew"; name: string; provider: string; value: RenewRecord }
	| { type: "finish"; name: string; provider: string; value: FinishRecord };
type Evaluation =
	| { state: "open" }
	| { state: "cooling"; kind: ErrorKind; untilMs: number; source: CooldownSource }
	| { state: "blocked"; reason: "auth" | "manual" }
	| { state: "due"; kind?: ErrorKind };

function asObject(raw: unknown): Record<string, unknown> | undefined {
	return typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined;
}
const isId = (value: unknown): value is string => typeof value === "string" && PROVIDER_ID.test(value);
const isModelField = (value: unknown) => value === undefined || (typeof value === "string" && MODEL_ID.test(value));
const isInt = (value: unknown): value is number => Number.isSafeInteger(value);
const isSticky = (record: CooldownRecord) => record.kind === "auth" || record.source === "manual";
// A success clears a non-sticky record only when it started strictly after the record was observed (stale successes cannot clear newer failures).
const coveredBy = (record: CooldownRecord, clear: ClearRecord) =>
	!isSticky(record) && record.provider === clear.provider && record.observedAt < clear.at && (record.model === undefined || clear.model === record.model);

const isNonce = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{32}$/.test(value);

function parseLeaseBody(raw: unknown): LeaseRecord | undefined {
	const r = asObject(raw);
	return r && r.v === 1 && r.kind === "lease" && isInt(r.gen) && r.gen >= 1 && isNonce(r.nonce) && isInt(r.startedAt) && isInt(r.expiresAt)
		? (r as unknown as LeaseRecord)
		: undefined;
}

function parseEntry(name: string, raw: unknown): Entry | undefined {
	const r = asObject(raw);
	if (!r || r.v !== 1) return undefined;
	if (/^r-[0-9a-f]{16}\.json$/.test(name)) {
		const { kind, source, provider, model, observedAt, untilMs } = r;
		if (typeof kind !== "string" || !ERROR_KINDS.has(kind) || typeof source !== "string" || !SOURCES.has(source)) return undefined;
		if (!isId(provider) || !isModelField(model) || !isInt(observedAt)) return undefined;
		if (kind === "auth" ? source !== "indefinite" : source === "indefinite") return undefined;
		if (kind === "model" ? model === undefined : model !== undefined) return undefined;
		const sticky = kind === "auth" || source === "manual";
		if (sticky ? untilMs !== undefined : !isInt(untilMs)) return undefined;
		return { type: "cooldown", value: r as unknown as CooldownRecord };
	}
	if (/^c-[0-9a-f]{16}\.json$/.test(name)) {
		const ack = r.ack === undefined || (Array.isArray(r.ack) && r.ack.length <= 8 && r.ack.every((n) => typeof n === "string" && /^f-[0-9a-f]{16}\.json$/.test(n)));
		return r.kind === "clear" && isId(r.provider) && isModelField(r.model) && isInt(r.at) && ack ? { type: "clear", value: r as unknown as ClearRecord } : undefined;
	}
	if (/^f-[0-9a-f]{16}\.json$/.test(name)) {
		return r.kind === "refresh" && isId(r.provider) && isInt(r.at) ? { type: "refresh", value: r as unknown as RefreshRecord } : undefined;
	}
	const claim = CLAIM_RE.exec(name);
	if (claim) {
		const value = parseLeaseBody(raw);
		return value && isId(claim[1]) && value.gen === Number(claim[2]) ? { type: "claim", name, provider: claim[1], value } : undefined;
	}
	const meta = META_RE.exec(name);
	if (meta && isId(meta[2]) && isInt(r.gen) && r.gen === Number(meta[3]) && r.gen >= 1 && isNonce(r.nonce)) {
		const base = { v: 1 as const, gen: r.gen, nonce: r.nonce };
		if (meta[1] === "r" && r.kind === "renew" && isInt(r.expiresAt)) return { type: "renew", name, provider: meta[2], value: { ...base, kind: "renew", expiresAt: r.expiresAt } };
		if (meta[1] === "f" && r.kind === "finish") return { type: "finish", name, provider: meta[2], value: { ...base, kind: "finish" } };
	}
	return undefined;
}

const CLAIM_RE = /^lease-(.+)-(\d{1,15})\.json$/;
const META_RE = /^l([rf])-(.+)-(\d{1,15})-([0-9a-f]{16})\.json$/;
const isStateName = (name: string) => /^(?:[rcf]-[0-9a-f]{16}|lease-.+|l[rf]-.+)\.json$/.test(name);

function errorCode(error: unknown): unknown {
	return typeof error === "object" && error !== null && "code" in error ? (error as { code?: unknown }).code : undefined;
}

function assertScope(scope: ProviderScope): void {
	if (!isId(scope.provider) || !(scope.model === undefined || (typeof scope.model === "string" && MODEL_ID.test(scope.model)))) {
		throw new TypeError("invalid provider scope");
	}
}

// Latest-generation fence per provider: the highest claim wins forever; renewals and finish count only for that exact generation and nonce.
function fenceOf(snap: Snapshot, provider: string): Fence | undefined {
	const top = snap.claims
		.filter((claim) => claim.provider === provider)
		.reduce<Stored<LeaseRecord> | undefined>((best, claim) => (best === undefined || claim.value.gen > best.value.gen ? claim : best), undefined);
	if (!top) return undefined;
	const { gen, nonce } = top.value;
	const own = (entry: Stored<{ gen: number; nonce: string }>) => entry.provider === provider && entry.value.gen === gen && entry.value.nonce === nonce;
	const renewed = snap.renews.filter(own).map((entry) => entry.value.expiresAt);
	return { gen, nonce, expiresAt: Math.max(top.value.expiresAt, ...renewed), finished: snap.finishes.some(own) };
}

// True only for the latest unfinished generation that this exact claim created.
const owns = (fence: Fence | undefined, body: { gen: number; nonce: string }) =>
	fence !== undefined && !fence.finished && fence.gen === body.gen && fence.nonce === body.nonce;

// Pure admission decision over one snapshot. Sticky (auth/manual) blocks until refreshAuth; cleared records stop applying.
function evaluate(snap: Snapshot, scope: ProviderScope, at: number): Evaluation {
	const applies = (record: CooldownRecord) => record.provider === scope.provider && (record.model === undefined || record.model === scope.model);
	const voided = (record: CooldownRecord) => snap.refreshes.some((f) => f.provider === record.provider && record.observedAt < f.at);
	const cleared = (record: CooldownRecord) => snap.clears.some((clear) => coveredBy(record, clear));
	const sticky = snap.cooldowns.filter((record) => applies(record) && isSticky(record) && !voided(record));
	if (sticky.length > 0) return { state: "blocked", reason: sticky.some((record) => record.kind === "auth") ? "auth" : "manual" };
	const live = snap.cooldowns.filter((record) => applies(record) && !isSticky(record) && !cleared(record));
	const latest = (records: CooldownRecord[]) => records.reduce<CooldownRecord | undefined>((best, record) => (best === undefined || (record.untilMs ?? 0) > (best.untilMs ?? 0) ? record : best), undefined);
	const cooling = latest(live.filter((record) => (record.untilMs ?? 0) > at));
	if (cooling) return { state: "cooling", kind: cooling.kind, untilMs: cooling.untilMs ?? 0, source: cooling.source };
	const due = latest(live);
	const refreshPending = snap.refreshes.some((f) => f.provider === scope.provider && !snap.clears.some((clear) => clear.provider === scope.provider && (clear.at > f.at || clear.ack?.includes(f.name))));
	if (due) return { state: "due", kind: due.kind };
	return refreshPending ? { state: "due" } : { state: "open" };
}

export function createCooldownStore(options: CooldownStoreOptions): CooldownStore {
	const { dir, hooks } = options;
	const now = options.now ?? (() => Date.now());
	let writeFailed = false;
	const failWrite = (): CooldownStoreError => {
		writeFailed = true; // sticky: once a write fails, admission fails closed for this store
		return new CooldownStoreError("write-failed");
	};
	const id = () => randomBytes(8).toString("hex");

	async function ensureDir(): Promise<void> {
		await fs.mkdir(dir, { recursive: true }).catch(() => {
			throw failWrite();
		});
	}

	// Exclusive create ("wx"): EEXIST means the name is taken. Records are written in place with no rename or link, so Windows
	// handle holders cannot block the publish. A reader that sees a partial record rejects it as malformed (fail closed).
	async function publishExclusive(target: string, value: unknown): Promise<boolean> {
		await ensureDir();
		const handle = await fs.open(target, "wx").catch((error: unknown) => {
			if (errorCode(error) === "EEXIST") return undefined;
			throw failWrite();
		});
		if (!handle) return false;
		try {
			await handle.writeFile(JSON.stringify(value));
			await handle.close();
			return true;
		} catch {
			await handle.close().catch(() => undefined);
			await fs.rm(target, { force: true }).catch(() => undefined); // never leave our own partial record behind
			throw failWrite();
		}
	}

	async function writeNew(name: string, value: CooldownRecord | ClearRecord | RefreshRecord): Promise<void> {
		if (!(await publishExclusive(path.join(dir, name), value))) throw failWrite();
	}

	async function readJson(file: string): Promise<unknown> {
		let raw: Buffer;
		try {
			const info = await fs.stat(file);
			if (!info.isFile()) throw new CooldownStoreError("unreadable"); // Bun reads a directory as empty, so check the type first
			raw = await fs.readFile(file);
		} catch (error) {
			if (error instanceof CooldownStoreError) throw error;
			const code = errorCode(error);
			if (code === "ENOENT" || code === "EPERM" || code === "EBUSY" || code === "EACCES") return undefined; // raced removal or delete-pending handle: caller re-enumerates, bounded
			throw new CooldownStoreError("unreadable");
		}
		if (raw.length > MAX_ENTRY_BYTES) throw new CooldownStoreError("malformed");
		try {
			return JSON.parse(raw.toString("utf8"));
		} catch {
			throw new CooldownStoreError("malformed");
		}
	}

	// Walks up from a missing path to its first existing entry, which must be a directory; a dangling link or any other error is uncertain.
	async function ancestorsAreDirectories(target: string): Promise<boolean> {
		for (let at = target; ; at = path.dirname(at)) {
			try {
				return (await fs.stat(at)).isDirectory();
			} catch (error) {
				if (errorCode(error) !== "ENOENT" || (await fs.lstat(at).then((info) => info.isSymbolicLink(), () => false))) return false; // dangling link only: a racing re-create is not one
			}
			if (path.dirname(at) === at) return true; // missing up to the root
		}
	}

	async function readSnapshot(): Promise<Snapshot> {
		for (let attempt = 1; ; attempt++) {
			if (attempt > 1) await new Promise((resolve) => setImmediate(resolve)); // yield so the racing remover finishes; no timed sleep
			let names: string[];
			try {
				names = await fs.readdir(dir);
			} catch (error) {
				// ENOENT is an empty store only when every existing ancestor is a directory: Windows reports ENOENT (POSIX: ENOTDIR) through a regular file.
				if (errorCode(error) !== "ENOENT" || !(await ancestorsAreDirectories(dir))) throw new CooldownStoreError("unreadable");
				names = [];
			}
			const visible = names.filter((name) => !name.startsWith(".")); // this store never writes dot-prefixed names
			if (visible.length > MAX_STATE_ENTRIES) throw new CooldownStoreError("overflow");
			const snapshot: Snapshot = { cooldowns: [], clears: [], refreshes: [], claims: [], renews: [], finishes: [] };
			let raced = false;
			for (const name of visible) {
				if (!isStateName(name)) throw new CooldownStoreError("malformed");
				const raw = await readJson(path.join(dir, name));
				if (raw === undefined) {
					raced = true; // removed after listing (own renewal trim or pruning): re-enumerate once
					break;
				}
				const entry = parseEntry(name, raw);
				if (!entry) throw new CooldownStoreError("malformed");
				if (entry.type === "cooldown") snapshot.cooldowns.push({ ...entry.value, name });
				else if (entry.type === "clear") snapshot.clears.push({ ...entry.value, name });
				else if (entry.type === "refresh") snapshot.refreshes.push({ ...entry.value, name });
				else if (entry.type === "claim") snapshot.claims.push(entry);
				else if (entry.type === "renew") snapshot.renews.push(entry);
				else snapshot.finishes.push(entry);
			}
			if (!raced) return snapshot;
			if (attempt >= MAX_ENUMERATIONS) throw new CooldownStoreError("unreadable"); // each retry means another writer made progress
		}
	}

	async function scan(): Promise<{ ok: true; snapshot: Snapshot } | { ok: false; reason: UnavailableReason }> {
		try {
			return { ok: true, snapshot: await readSnapshot() };
		} catch (error) {
			if (error instanceof CooldownStoreError) return { ok: false, reason: error.reason };
			throw error;
		}
	}

	const metaName = (kind: "r" | "f", provider: string, gen: number) => `l${kind}-${provider}-${gen}-${id()}.json`;

	async function removeAll(names: string[]): Promise<void> {
		for (const name of names) await fs.rm(path.join(dir, name), { force: true }).catch(() => undefined);
	}

	// Lower generations are inert once a higher claim exists: remove their claim and metadata, at most 50 per write.
	async function pruneLowerGenerations(snap: Snapshot, provider: string, gen: number): Promise<void> {
		const stale = [...snap.claims, ...snap.renews, ...snap.finishes].filter((entry) => entry.provider === provider && entry.value.gen < gen);
		await removeAll(stale.slice(0, 50).map((entry) => entry.name));
	}

	// Strictly dominated entries only: each has a surviving dominator that covers everything it covers, so deleting never changes admission.
	function obsoleteNames(snap: Snapshot): string[] {
		const out: string[] = [];
		const until = (r: CooldownRecord) => r.untilMs ?? 0;
		for (const c of snap.clears) {
			const newer = snap.clears.find((n) => n.provider === c.provider && n.model === c.model && n.at > c.at);
			if (!newer) continue;
			const needed = (c.ack ?? []).some((name) => snap.refreshes.some((f) => f.name === name && !(newer.at > f.at) && !newer.ack?.includes(name)));
			if (!needed) out.push(c.name);
		}
		for (const r of snap.cooldowns) {
			const resolved = isSticky(r)
				? snap.refreshes.some((f) => f.provider === r.provider && r.observedAt < f.at)
				: snap.clears.some((c) => coveredBy(r, c));
			const dominated = snap.cooldowns.some(
				(n) => n !== r && n.provider === r.provider && n.model === r.model && n.kind === r.kind && isSticky(n) === isSticky(r) &&
					r.observedAt <= n.observedAt && until(r) <= until(n) && (r.observedAt < n.observedAt || until(r) < until(n) || r.name < n.name),
			);
			if (resolved || dominated) out.push(r.name);
		}
		for (const f of snap.refreshes) if (snap.refreshes.some((n) => n.provider === f.provider && n.at > f.at)) out.push(f.name);
		return out;
	}

	async function pruneObsolete(): Promise<void> {
		const result = await scan();
		if (result.ok) await removeAll(obsoleteNames(result.snapshot).slice(0, 50)); // best effort; a failed prune never fails the write
	}

	// Append-only finish marker for one generation: it never touches the claim and is inert unless it names the latest owner.
	async function markFinished(provider: string, body: { gen: number; nonce: string }): Promise<void> {
		const record: FinishRecord = { v: 1, kind: "finish", gen: body.gen, nonce: body.nonce };
		await publishExclusive(path.join(dir, metaName("f", provider, body.gen)), record).catch(() => undefined);
	}

	async function recordSuccess(scope: ProviderScope, startedAt: number, acks: string[] = []): Promise<void> {
		assertScope(scope);
		if (!isInt(startedAt)) throw new TypeError("startedAt must be an integer timestamp");
		const clear: ClearRecord = { v: 1, kind: "clear", provider: scope.provider, ...(scope.model !== undefined ? { model: scope.model } : {}), at: startedAt };
		if (acks.length > 0) clear.ack = acks;
		// A clear is written only when it resolves something: an unresolved non-sticky cooldown it covers, or a refresh it acknowledges.
		const seen = await scan();
		// shortcut: a success on an uncertain (malformed, unreadable, overflow) store is dropped, so the next due check re-probes; upgrade only with a readable snapshot.
		if (!seen.ok) return;
		const snap = seen.snapshot;
		const unresolved = snap.cooldowns.some((r) => !isSticky(r) && coveredBy(r, clear) && !snap.clears.some((c) => coveredBy(r, c)));
		const pending = (f: Named<RefreshRecord>) =>
			f.provider === clear.provider && !snap.clears.some((c) => c.provider === f.provider && (c.at > f.at || c.ack?.includes(f.name))) && (f.at < clear.at || acks.includes(f.name));
		if (!unresolved && !snap.refreshes.some(pending)) return;
		await writeNew(`c-${id()}.json`, clear);
		await pruneObsolete();
	}

	// Admission: one fresh scan must show no live, unfinished generation. Then claim the next generation exclusively; a loser
	// never tries a later generation in the same admission, and only the latest generation may own the scope.
	async function acquire(provider: string): Promise<LeaseRecord | undefined> {
		const before = await scan();
		if (!before.ok) return undefined;
		const top = fenceOf(before.snapshot, provider);
		if (top && !top.finished && top.expiresAt > now()) return undefined; // live owner
		// Expiry takeover is at-least-once by design: an owner paused past its TTL may still probe, so probes may overlap. Accepted.
		const start = now();
		const body: LeaseRecord = { v: 1, kind: "lease", gen: (top?.gen ?? 0) + 1, nonce: randomBytes(16).toString("hex"), startedAt: start, expiresAt: start + LEASE_TTL_MS };
		if (!(await publishExclusive(path.join(dir, `lease-${provider}-${body.gen}.json`), body))) return undefined;
		// Re-read the latest generation after claiming: a takeover during the claim makes ours inert.
		const after = await scan();
		if (!after.ok || !owns(fenceOf(after.snapshot, provider), body)) {
			await markFinished(provider, body);
			return undefined;
		}
		await pruneLowerGenerations(after.snapshot, provider, body.gen);
		return body;
	}

	function makeLease(scope: ProviderScope, body: LeaseRecord, acks: string[]): ProbeLease {
		const { provider } = scope;
		let finished = false;
		const renewals: string[] = [];
		let queue: Promise<unknown> = Promise.resolve();
		// Renew and finish of one lease run strictly in order: a finish never races a renewal in flight.
		const serial = <T>(task: () => Promise<T>): Promise<T> => {
			const run = queue.then(task);
			queue = run.then(() => undefined, () => undefined);
			return run;
		};
		const renewOnce = async (): Promise<boolean> => {
			if (finished) return false;
			const before = await scan();
			if (!before.ok || !owns(fenceOf(before.snapshot, provider), body)) return false; // taken over: never reclaim
			await hooks?.beforeLeaseMetadata?.("renew");
			const name = metaName("r", provider, body.gen);
			const renewal = { v: 1, kind: "renew", gen: body.gen, nonce: body.nonce, expiresAt: now() + LEASE_TTL_MS };
			if (!(await publishExclusive(path.join(dir, name), renewal))) return false;
			renewals.push(name);
			const after = await scan();
			if (!after.ok || !owns(fenceOf(after.snapshot, provider), body)) return false; // a takeover landed around our publish
			await removeAll(renewals.splice(0, renewals.length - 1)); // keep only the newest own renewal
			return true;
		};
		const renew = (): Promise<boolean> => serial(() => renewOnce().catch(() => false)); // write failure keeps the lease until its TTL
		const timer = setInterval(() => void renew(), LEASE_RENEW_MS);
		timer.unref?.();
		return {
			scope: { ...scope },
			startedAt: body.startedAt,
			renew,
			async finish(outcome: ProbeOutcome): Promise<RecordedCooldown | undefined> {
				return serial(async () => {
					if (finished) return undefined;
					finished = true;
					clearInterval(timer);
					let recorded: RecordedCooldown | undefined;
					// Writes happen before the finish marker: a failed write keeps the lease until its TTL.
					if (outcome.outcome === "success") await recordSuccess(scope, body.startedAt, acks);
					else if (outcome.outcome === "error") {
						recorded = await recordTrustedError({ scope, kind: outcome.kind, trustedReset: outcome.trustedReset, observedAt: now() });
					}
					await hooks?.beforeLeaseMetadata?.("finish");
					await markFinished(provider, body);
					await removeAll(renewals.splice(0));
					return recorded;
				});
			},
		};
	}

	async function recordTrustedError(input: TrustedErrorInput): Promise<RecordedCooldown | undefined> {
		assertScope(input.scope);
		const { kind } = input;
		// Closed set: a missing, unknown or text-only kind writes nothing; a model kind without a model ID never widens to the account.
		if (!TRUSTED_KINDS.has(kind) || (kind === "model" && input.scope.model === undefined)) return undefined;
		const observedAt = input.observedAt ?? now();
		if (!isInt(observedAt)) throw new TypeError("observedAt must be an integer timestamp");
		const outcome = kind === "auth" ? { source: "indefinite" as const } : resolveReset(kind, input.trustedReset, observedAt);
		const value: CooldownRecord = {
			v: 1,
			kind,
			source: outcome.source,
			provider: input.scope.provider,
			...(kind === "model" ? { model: input.scope.model } : {}),
			observedAt,
			...(outcome.untilMs !== undefined ? { untilMs: outcome.untilMs } : {}),
		};
		await writeNew(`r-${id()}.json`, value);
		await pruneObsolete();
		return { kind, source: outcome.source, ...(outcome.untilMs !== undefined ? { untilMs: outcome.untilMs } : {}) };
	}

	return {
		async check(scope: ProviderScope): Promise<Admission> {
			assertScope(scope);
			if (writeFailed) return { state: "unavailable", reason: "write-failed" };
			const result = await scan();
			if (!result.ok) return { state: "unavailable", reason: result.reason };
			const at = now();
			const evaluation = evaluate(result.snapshot, scope, at);
			if (evaluation.state === "cooling") return { state: "cooling", kind: evaluation.kind, untilMs: evaluation.untilMs, source: evaluation.source };
			if (evaluation.state === "blocked") return { state: "blocked", reason: evaluation.reason };
			if (evaluation.state === "open") return { state: "open" };
			const fence = fenceOf(result.snapshot, scope.provider);
			if (fence && !fence.finished && fence.expiresAt > at) return { state: "probe-busy", untilMs: fence.expiresAt };
			return evaluation.kind === undefined ? { state: "probe-due" } : { state: "probe-due", kind: evaluation.kind };
		},
		recordTrustedError,
		recordSuccess,
		async refreshAuth(provider: string): Promise<void> {
			assertScope({ provider });
			const refresh: RefreshRecord = { v: 1, kind: "refresh", provider, at: now() };
			await writeNew(`f-${id()}.json`, refresh);
			await pruneObsolete();
		},
		async tryProbe(scope: ProviderScope): Promise<ProbeLease | undefined> {
			assertScope(scope);
			if (writeFailed) return undefined;
			const first = await scan();
			if (!first.ok || evaluate(first.snapshot, scope, now()).state !== "due") return undefined;
			const body = await acquire(scope.provider);
			if (!body) return undefined;
			// Recheck after winning: a failure recorded while we held the claim must make us back off.
			let proceed: boolean;
			let acks: string[] = [];
			try {
				await hooks?.afterLeaseAcquired?.();
				const again = await scan();
				if (again.ok) acks = again.snapshot.refreshes.filter((f) => f.provider === scope.provider).map((f) => f.name).slice(0, 8);
				proceed = again.ok && owns(fenceOf(again.snapshot, scope.provider), body) && evaluate(again.snapshot, scope, now()).state === "due";
			} catch (error) {
				await markFinished(scope.provider, body);
				throw error;
			}
			if (!proceed) {
				await markFinished(scope.provider, body);
				return undefined;
			}
			return makeLease(scope, body, acks);
		},
	};
}
