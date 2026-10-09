import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import {
  CooldownStoreError,
  LEASE_RENEW_MS,
  LEASE_TTL_MS,
  MAX_STATE_ENTRIES,
  QUOTA_DEFAULT_MS,
  TRANSIENT_MS,
  classifyProviderError,
  createCooldownStore,
  type ProbeLease,
} from "../provider-cooldown.ts";

const MIN = 60_000;
const T0 = 1_800_000_000_000; // whole seconds, so HTTP-date round trips are exact
const PROVIDER = "openai-codex";
const SCOPE = { provider: PROVIDER, model: "gpt-6.1-sol" };
const CODEX_QUOTA = "You have hit your ChatGPT usage limit (plus plan). Try again in ~53 min.";
type Hooks = { afterLeaseAcquired?: () => Promise<void>; beforeLeaseMetadata?: (step: "renew" | "finish") => Promise<void> };
// Generation-fenced claims are lease-<provider>-<generation>.json; the old single-name lease file no longer exists.
const claimNames = (dir: string): string[] => fs.readdirSync(dir).filter((name) => /^lease-openai-codex-\d+\.json$/.test(name)).sort();

async function withStateDir(run: (dir: string) => Promise<void>): Promise<void> {
  const root = fs.mkdtempSync(path.join(process.env.PROVIDER_COOLDOWN_TEST_ROOT ?? os.tmpdir(), "provider-cooldown-"));
  try {
    await run(path.join(root, "state"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function storeAt(dir: string, clock: { now: number }, hooks?: Hooks) {
  return createCooldownStore({ dir, now: () => clock.now, hooks });
}

test("classifier: Codex friendly quota keeps exact minutes; quota without a deadline has none", () => {
  assert.deepEqual(classifyProviderError(CODEX_QUOTA), { kind: "quota", relativeMinutes: 53 });
  assert.deepEqual(classifyProviderError("You have hit your ChatGPT usage limit (plus plan)."), { kind: "quota" });
  assert.deepEqual(classifyProviderError("Claude usage limit reached. Resets 3:40PM (Europe/Berlin)."), { kind: "quota" });
});

test("classifier: rate, transient, auth, model and empty inputs", () => {
  assert.deepEqual(classifyProviderError("429 Too Many Requests"), { kind: "rate" });
  assert.deepEqual(classifyProviderError("rate_limit_error: slow down"), { kind: "rate" });
  assert.deepEqual(classifyProviderError("upstream returned no response"), { kind: "transient" });
  for (const code of [408, 500, 502, 503, 504]) assert.deepEqual(classifyProviderError(`HTTP ${code} from provider`), { kind: "transient" });
  assert.deepEqual(classifyProviderError("401 unauthorized"), { kind: "auth" });
  assert.deepEqual(classifyProviderError("403 forbidden"), { kind: "auth" });
  assert.deepEqual(classifyProviderError("model gpt-6-luna not found"), { kind: "model" });
  assert.deepEqual(classifyProviderError("test failed"), { kind: "none" });
  assert.deepEqual(classifyProviderError(undefined), { kind: "none" });
  assert.deepEqual(classifyProviderError(""), { kind: "none" });
});

test("constants match the policy defaults", () => {
  assert.deepEqual([QUOTA_DEFAULT_MS, TRANSIENT_MS, LEASE_TTL_MS, LEASE_RENEW_MS, MAX_STATE_ENTRIES], [300_000, 60_000, 120_000, 30_000, 500]);
});

test("typed quota with a trusted reset records the exact deadline, no padding, and reopens only at that instant", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  assert.deepEqual(await store.recordTrustedError({ scope: SCOPE, kind: "quota", trustedReset: { retryAfterMs: 53 * MIN } }), { kind: "quota", source: "structured", untilMs: T0 + 53 * MIN });
  clock.now = T0 + 53 * MIN - 1;
  assert.deepEqual(await store.check(SCOPE), { state: "cooling", kind: "quota", untilMs: T0 + 53 * MIN, source: "structured" });
  clock.now = T0 + 53 * MIN;
  assert.deepEqual(await store.check(SCOPE), { state: "probe-due", kind: "quota" });
}));

test("quota without a trusted reset uses the 5 min default; Codex friendly text minutes are never used", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  assert.deepEqual(
    await store.recordTrustedError({ scope: SCOPE, kind: "quota" }),
    { kind: "quota", source: "default", untilMs: T0 + 5 * MIN },
  );
}));

test("rate cools for 60 s with the default source", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  assert.deepEqual(await store.recordTrustedError({ scope: SCOPE, kind: "rate" }), { kind: "rate", source: "default", untilMs: T0 + MIN });
  assert.equal(await store.recordTrustedError({ scope: SCOPE, kind: "transient" as never }), undefined); // no-response is not a trusted kind
}));

test("auth errors block indefinitely; a successful request never clears them without refresh authority", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  assert.deepEqual(await store.recordTrustedError({ scope: SCOPE, kind: "auth" }), { kind: "auth", source: "indefinite" });
  clock.now = T0 + 3650 * 24 * 60 * MIN;
  assert.deepEqual(await store.check(SCOPE), { state: "blocked", reason: "auth" });
  await store.recordSuccess(SCOPE, clock.now - 1);
  assert.deepEqual(await store.check(SCOPE), { state: "blocked", reason: "auth" });
  assert.equal(await store.tryProbe(SCOPE), undefined);
}));

test("refreshAuth voids only older auth records of its provider and permits exactly one probe", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  await store.recordTrustedError({ scope: SCOPE, kind: "auth" });
  await store.recordTrustedError({ scope: { provider: "anthropic" }, kind: "auth" });
  clock.now = T0 + 1000;
  await store.refreshAuth(PROVIDER);
  assert.deepEqual(await store.check(SCOPE), { state: "probe-due" });
  assert.deepEqual(await store.check({ provider: "anthropic" }), { state: "blocked", reason: "auth" });
  clock.now = T0 + 1001;
  const lease = await store.tryProbe(SCOPE);
  assert.ok(lease);
  assert.deepEqual(await store.check(SCOPE), { state: "probe-busy", untilMs: T0 + 1001 + LEASE_TTL_MS });
  assert.equal(await store.tryProbe(SCOPE), undefined);
  await lease.finish({ outcome: "success" });
  assert.deepEqual(await store.check(SCOPE), { state: "open" });
}));

test("a probe that fails auth after refresh blocks again; the newer record survives", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  await store.recordTrustedError({ scope: SCOPE, kind: "auth" });
  clock.now = T0 + 1000;
  await store.refreshAuth(PROVIDER);
  clock.now = T0 + 1001;
  const lease = await store.tryProbe(SCOPE);
  assert.ok(lease);
  clock.now = T0 + 1002;
  assert.deepEqual(await lease.finish({ outcome: "error", kind: "auth" }), { kind: "auth", source: "indefinite" });
  assert.deepEqual(await store.check(SCOPE), { state: "blocked", reason: "auth" });
}));

test("success clears only records strictly older than its start; equal or stale starts keep the failure", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  await store.recordTrustedError({ scope: SCOPE, kind: "rate" });
  clock.now = T0 + MIN;
  assert.deepEqual(await store.check(SCOPE), { state: "probe-due", kind: "rate" });
  await store.recordSuccess(SCOPE, T0);
  await store.recordSuccess(SCOPE, T0 - 1);
  assert.deepEqual(await store.check(SCOPE), { state: "probe-due", kind: "rate" });
  await store.recordSuccess(SCOPE, T0 + 1);
  assert.deepEqual(await store.check(SCOPE), { state: "open" });
}));

test("a stale success cannot clear a newer failure", () => withStateDir(async (dir) => {
  const clock = { now: T0 + 100 };
  const store = storeAt(dir, clock);
  await store.recordTrustedError({ scope: SCOPE, kind: "rate" });
  clock.now = T0 + 10 * MIN;
  await store.recordSuccess(SCOPE, T0 + 50);
  assert.deepEqual(await store.check(SCOPE), { state: "probe-due", kind: "rate" });
}));

test("model-scope errors affect only that model; a success on another model does not clear them", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  assert.equal(await store.recordTrustedError({ scope: { provider: PROVIDER }, kind: "model" }), undefined);
  assert.deepEqual(
    await store.recordTrustedError({ scope: { provider: PROVIDER, model: "gpt-a" }, kind: "model" }),
    { kind: "model", source: "default", untilMs: T0 + MIN },
  );
  assert.deepEqual(await store.check({ provider: PROVIDER, model: "gpt-b" }), { state: "open" });
  assert.deepEqual(await store.check({ provider: PROVIDER, model: "gpt-a" }), { state: "cooling", kind: "model", untilMs: T0 + MIN, source: "default" });
  clock.now = T0 + MIN;
  await store.recordSuccess({ provider: PROVIDER, model: "gpt-b" }, T0 + 1);
  assert.deepEqual(await store.check({ provider: PROVIDER, model: "gpt-a" }), { state: "probe-due", kind: "model" });
  await store.recordSuccess({ provider: PROVIDER, model: "gpt-a" }, T0 + 1);
  assert.deepEqual(await store.check({ provider: PROVIDER, model: "gpt-a" }), { state: "open" });
}));

test("provider-scope records apply to every model of that account; other providers stay open", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  await store.recordTrustedError({ scope: SCOPE, kind: "quota" });
  assert.equal((await store.check({ provider: PROVIDER, model: "gpt-6-luna" })).state, "cooling");
  assert.deepEqual(await store.check({ provider: "anthropic", model: "claude-x" }), { state: "open" });
}));

test("structured reset metadata is the only deadline source; invalid or over-long metadata is manual until refreshAuth", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  const record = (kind: "quota" | "rate", trustedReset: Record<string, unknown>) => store.recordTrustedError({ scope: SCOPE, kind, trustedReset });
  assert.deepEqual(await record("quota", { retryAfterMs: "30000" }), { kind: "quota", source: "structured", untilMs: T0 + 30_000 });
  assert.deepEqual(await record("quota", { retryAfter: "90" }), { kind: "quota", source: "structured", untilMs: T0 + 90_000 });
  assert.deepEqual(await record("quota", { retryAfter: new Date(T0 + 120_000).toUTCString() }), { kind: "quota", source: "structured", untilMs: T0 + 120_000 });
  assert.deepEqual(await record("quota", { resetsAtEpochSeconds: T0 / 1000 + 200 }), { kind: "quota", source: "structured", untilMs: T0 + 200_000 });
  assert.deepEqual(await record("rate", { retryAfterMs: 691_200_000 }), { kind: "rate", source: "structured", untilMs: T0 + 691_200_000 });
  assert.deepEqual(await record("quota", { retryAfterMs: "691200001" }), { kind: "quota", source: "manual" });
  assert.deepEqual(await record("quota", { retryAfter: "tomorrow-ish" }), { kind: "quota", source: "manual" });
  assert.deepEqual(await record("quota", { retryAfterMs: 11_520 * MIN }), { kind: "quota", source: "structured", untilMs: T0 + 11_520 * MIN });
  assert.deepEqual(await record("quota", { retryAfterMs: 11_521 * MIN }), { kind: "quota", source: "manual" });
  assert.deepEqual(await record("quota", {}), { kind: "quota", source: "default", untilMs: T0 + 5 * MIN }); // no text-derived minutes
}));

test("invalid reset metadata blocks as manual until refreshAuth permits one probe", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  await store.recordTrustedError({ scope: SCOPE, kind: "quota", trustedReset: { retryAfterMs: "-5" } });
  clock.now = T0 + 10 * MIN;
  assert.deepEqual(await store.check(SCOPE), { state: "blocked", reason: "manual" });
  clock.now = T0 + 10 * MIN + 1;
  await store.refreshAuth(PROVIDER);
  assert.deepEqual(await store.check(SCOPE), { state: "probe-due" });
}));

test("concurrent probes in one process: exactly one lease", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  await store.recordTrustedError({ scope: SCOPE, kind: "rate" });
  clock.now = T0 + MIN;
  const leases = await Promise.all(Array.from({ length: 8 }, () => store.tryProbe(SCOPE)));
  assert.equal(leases.filter(Boolean).length, 1);
  await leases.find(Boolean)?.finish({ outcome: "abort" });
}));

test("recheck after winning: a failure recorded while the lease is held makes the winner back off", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const writer = storeAt(dir, clock);
  await writer.recordTrustedError({ scope: SCOPE, kind: "rate" });
  clock.now = T0 + MIN;
  const racer = storeAt(dir, clock, { afterLeaseAcquired: async () => { await writer.recordTrustedError({ scope: SCOPE, kind: "quota", trustedReset: { retryAfterMs: 53 * MIN } }); } });
  assert.equal(await racer.tryProbe(SCOPE), undefined);
  assert.equal(claimNames(dir).length, 1); // the racer's claim is kept as the generation fence
  assert.deepEqual(await writer.check(SCOPE), { state: "cooling", kind: "quota", untilMs: T0 + MIN + 53 * MIN, source: "structured" });
}));

test("expired lease is taken over; a renewed lease is not; the displaced owner cannot release the new owner", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  await store.recordTrustedError({ scope: SCOPE, kind: "rate" });
  clock.now = T0 + MIN;
  const first = await store.tryProbe(SCOPE);
  assert.ok(first);
  clock.now = T0 + MIN + LEASE_RENEW_MS;
  assert.equal(await first.renew(), true);
  const other = storeAt(dir, clock);
  clock.now = T0 + 200_000;
  assert.equal(await other.tryProbe(SCOPE), undefined);
  // Expiry takeover is at-least-once: an owner paused past its TTL may still be probing; both probes can run.
  clock.now = T0 + MIN + LEASE_RENEW_MS + LEASE_TTL_MS;
  const second = await other.tryProbe(SCOPE);
  assert.ok(second);
  assert.equal(await first.renew(), false);
  await first.finish({ outcome: "abort" });
  assert.equal((await other.check(SCOPE)).state, "probe-busy"); // displaced owner's finish did not release the new claim
  assert.equal(await second.renew(), true);
  await second.finish({ outcome: "abort" });
  assert.equal((await other.check(SCOPE)).state, "probe-due");
}));

test("abort releases the lease without a health penalty; a failure after success re-blocks", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  await store.recordTrustedError({ scope: SCOPE, kind: "rate" });
  clock.now = T0 + MIN;
  const aborted = await store.tryProbe(SCOPE);
  assert.ok(aborted);
  assert.equal(await aborted.finish({ outcome: "abort" }), undefined);
  assert.deepEqual(await store.check(SCOPE), { state: "probe-due", kind: "rate" });
  const probe = await store.tryProbe(SCOPE);
  assert.ok(probe);
  await probe.finish({ outcome: "success" });
  assert.deepEqual(await store.check(SCOPE), { state: "open" });
  clock.now = T0 + MIN + 1;
  await store.recordTrustedError({ scope: SCOPE, kind: "rate" });
  assert.deepEqual(await store.check(SCOPE), { state: "cooling", kind: "rate", untilMs: T0 + 2 * MIN + 1, source: "default" });
}));

test("malformed, unknown, oversized, unreadable, overflow and write-failed state fails closed", async () => {
  const clock = { now: T0 };
  await withStateDir(async (dir) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "r-bad.json"), "{not json");
    assert.deepEqual(await storeAt(dir, clock).check(SCOPE), { state: "unavailable", reason: "malformed" });
    assert.equal(await storeAt(dir, clock).tryProbe(SCOPE), undefined);
  });
  await withStateDir(async (dir) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "notes.txt"), "x");
    assert.deepEqual(await storeAt(dir, clock).check(SCOPE), { state: "unavailable", reason: "malformed" });
  });
  await withStateDir(async (dir) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "r-big.json"), "x".repeat(4096));
    assert.deepEqual(await storeAt(dir, clock).check(SCOPE), { state: "unavailable", reason: "malformed" });
  });
  await withStateDir(async (dir) => {
    fs.mkdirSync(path.join(dir, "r-0123456789abcdef.json"), { recursive: true }); // valid record name, so the type check (not name check) rejects it
    assert.deepEqual(await storeAt(dir, clock).check(SCOPE), { state: "unavailable", reason: "unreadable" });
  });
  await withStateDir(async (dir) => {
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i <= MAX_STATE_ENTRIES; i++) fs.writeFileSync(path.join(dir, `junk-${i}`), "");
    assert.deepEqual(await storeAt(dir, clock).check(SCOPE), { state: "unavailable", reason: "overflow" });
  });
  await withStateDir(async (dir) => {
    fs.writeFileSync(dir, "not a directory");
    const store = storeAt(dir, clock);
    await assert.rejects(store.recordTrustedError({ scope: SCOPE, kind: "quota" }), (error: unknown) => error instanceof CooldownStoreError && error.reason === "write-failed");
    assert.deepEqual(await store.check(SCOPE), { state: "unavailable", reason: "write-failed" });
  });
});

// Windows reports ENOENT (POSIX ENOTDIR) for a path through a regular-file ancestor: that is not an empty store.
test("a regular file at an ancestor of the store dir is unreadable, never an empty store", () => withStateDir(async (base) => {
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, "run-state"), "not a directory");
  const store = storeAt(path.join(base, "run-state", "provider-cooldown"), { now: T0 });
  assert.deepEqual(await store.check(SCOPE), { state: "unavailable", reason: "unreadable" });
  assert.equal(await store.tryProbe(SCOPE), undefined);
}));

test("missing ancestor levels stay an empty store; a live junction ancestor is traversed", () => withStateDir(async (base) => {
  fs.mkdirSync(base, { recursive: true });
  assert.deepEqual(await storeAt(path.join(base, "a", "b", "c"), { now: T0 }).check(SCOPE), { state: "open" });
  fs.mkdirSync(path.join(base, "real"));
  fs.symlinkSync(path.join(base, "real"), path.join(base, "junction"), "junction"); // junctions need no privilege on Windows
  assert.deepEqual(await storeAt(path.join(base, "junction", "provider-cooldown"), { now: T0 }).check(SCOPE), { state: "open" });
}));

test("a file ancestor that is later removed reads as open again: the read error is not sticky", () => withStateDir(async (base) => {
  fs.mkdirSync(base, { recursive: true });
  const file = path.join(base, "run-state");
  fs.writeFileSync(file, "not a directory");
  const store = storeAt(path.join(file, "provider-cooldown"), { now: T0 });
  assert.deepEqual(await store.check(SCOPE), { state: "unavailable", reason: "unreadable" });
  fs.rmSync(file);
  assert.deepEqual(await store.check(SCOPE), { state: "open" });
}));

test("a dangling junction ancestor fails closed as unreadable, never open", () => withStateDir(async (base) => {
  fs.mkdirSync(base, { recursive: true });
  fs.symlinkSync(path.join(base, "missing-target"), path.join(base, "dangling"), "junction");
  assert.deepEqual(await storeAt(path.join(base, "dangling", "provider-cooldown"), { now: T0 }).check(SCOPE), { state: "unavailable", reason: "unreadable" });
}));

test("state files hold no raw error text, tokens or account ids", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  await storeAt(dir, clock).recordTrustedError({ scope: SCOPE, kind: "auth" });
  // raw text passed as a kind is rejected before any write, so no secret can reach disk
  assert.equal(await storeAt(dir, clock).recordTrustedError({ scope: SCOPE, kind: "401 unauthorized sk-live-SECRET123 acct_9f8e7d" as never }), undefined);
  const text = fs.readdirSync(dir).map((name) => fs.readFileSync(path.join(dir, name), "utf8")).join("\n");
  for (const secret of ["SECRET123", "acct_9f8e7d", "unauthorized"]) assert.equal(text.includes(secret), false, secret);
}));

test("cleanup prunes only provably dominated records, including another store's; a failure observed after the success start survives", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const mine = storeAt(dir, clock);
  const other = storeAt(dir, clock);
  await other.recordTrustedError({ scope: SCOPE, kind: "rate" }); // observed T0: covered by the success below
  await mine.recordTrustedError({ scope: SCOPE, kind: "rate", observedAt: T0 + 2 }); // observed after the success started
  await mine.recordSuccess(SCOPE, T0 + 1);
  assert.equal(fs.readdirSync(dir).filter((name) => name.startsWith("r-")).length, 1);
  assert.deepEqual(await mine.check(SCOPE), { state: "cooling", kind: "rate", untilMs: T0 + 2 + MIN, source: "default" });
}));

test("a success that covers no failure and acknowledges no refresh writes nothing", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  await storeAt(dir, clock).recordSuccess(SCOPE, T0);
  assert.deepEqual(fs.existsSync(dir) ? fs.readdirSync(dir) : [], []);
  assert.deepEqual(await storeAt(dir, clock).check(SCOPE), { state: "open" });
}));

test("an uncertain snapshot publishes no success clear: a zero-byte or directory state entry keeps the failure visible", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  await storeAt(dir, clock).recordTrustedError({ scope: SCOPE, kind: "rate" }); // cooling until T0 + MIN
  clock.now = T0 + MIN + 1;
  const lease = await storeAt(dir, clock).tryProbe(SCOPE);
  assert.ok(lease);
  const empty = path.join(dir, "r-0123456789abcdef.json");
  fs.writeFileSync(empty, ""); // zero-byte record: malformed
  await lease.finish({ outcome: "success" });
  assert.deepEqual(await storeAt(dir, clock).check(SCOPE), { state: "unavailable", reason: "malformed" });
  fs.rmSync(empty);
  fs.mkdirSync(path.join(dir, "c-0123456789abcdef.json")); // directory: unreadable
  await storeAt(dir, clock).recordSuccess(SCOPE, T0 + MIN + 2);
  fs.rmSync(path.join(dir, "c-0123456789abcdef.json"), { recursive: true });
  assert.deepEqual(fs.readdirSync(dir).filter((name) => name.startsWith("c-")), []);
  assert.deepEqual(await storeAt(dir, clock).check(SCOPE), { state: "probe-due", kind: "rate" }); // failure still applies, not open
}));

test("a success on an uncertain store writes no clears, so 502 successes cannot manufacture a permanent overflow", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "r-bad.json"), "{not json");
  const store = storeAt(dir, clock);
  for (let i = 0; i < MAX_STATE_ENTRIES + 2; i++) await store.recordSuccess(SCOPE, T0 + i);
  assert.deepEqual(fs.readdirSync(dir).filter((name) => name.startsWith("c-")), []);
  fs.rmSync(path.join(dir, "r-bad.json"));
  assert.deepEqual(await storeAt(dir, clock).check(SCOPE), { state: "open" });
}));

test("a refresh and a successful probe in the same millisecond clear that refresh by name", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  await store.refreshAuth(PROVIDER);
  const lease = await store.tryProbe(SCOPE);
  assert.ok(lease);
  await lease.finish({ outcome: "success" });
  assert.deepEqual(await store.check(SCOPE), { state: "open" });
}));

test("a second refresh in the same millisecond, written after the probe's scan, stays pending", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  await store.refreshAuth(PROVIDER);
  const lease = await store.tryProbe(SCOPE);
  assert.ok(lease);
  await storeAt(dir, clock).refreshAuth(PROVIDER);
  await lease.finish({ outcome: "success" });
  assert.deepEqual(await store.check(SCOPE), { state: "probe-due" });
}));

test("repeated failures for one key keep one cooldown record; a shorter later deadline never replaces a longer one", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  await store.recordTrustedError({ scope: SCOPE, kind: "rate", observedAt: T0, trustedReset: { retryAfterMs: 30_000 } });
  await storeAt(dir, clock).recordTrustedError({ scope: SCOPE, kind: "rate", observedAt: T0 + 1, trustedReset: { retryAfterMs: 10_000 } });
  await store.recordTrustedError({ scope: SCOPE, kind: "rate", observedAt: T0 + 2, trustedReset: { retryAfterMs: 60_000 } });
  assert.equal(fs.readdirSync(dir).filter((name) => name.startsWith("r-")).length, 1);
  assert.deepEqual(await store.check(SCOPE), { state: "cooling", kind: "rate", untilMs: T0 + 2 + 60_000, source: "structured" });
}));

test("a clear that acknowledges a refresh is kept while a newer clear neither covers nor acknowledges that refresh", () => withStateDir(async (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  const refresh = "f-0123456789abcdef.json";
  fs.writeFileSync(path.join(dir, refresh), JSON.stringify({ v: 1, kind: "refresh", provider: PROVIDER, at: T0 + 20 }));
  fs.writeFileSync(path.join(dir, "c-0123456789abcdee.json"), JSON.stringify({ v: 1, kind: "clear", provider: PROVIDER, model: SCOPE.model, at: T0, ack: [refresh] }));
  fs.writeFileSync(path.join(dir, "r-0123456789abcdef.json"), JSON.stringify({ v: 1, kind: "transient", source: "default", provider: PROVIDER, observedAt: T0 + 1, untilMs: T0 + MIN + 1 }));
  await storeAt(dir, { now: T0 + 10 }).recordSuccess(SCOPE, T0 + 10); // newer clear covers the failure; refresh is at T0+20, so only the ack resolves it
  assert.equal(fs.existsSync(path.join(dir, "c-0123456789abcdee.json")), true);
  assert.deepEqual(await storeAt(dir, { now: T0 + 30 }).check(SCOPE), { state: "open" });
}));

test("clear acknowledgements must name refresh files; anything else fails closed", () => withStateDir(async (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "c-0123456789abcdef.json"), JSON.stringify({ v: 1, kind: "clear", provider: PROVIDER, model: SCOPE.model, at: T0, ack: ["../escape.json"] }));
  assert.deepEqual(await storeAt(dir, { now: T0 }).check(SCOPE), { state: "unavailable", reason: "malformed" });
}));

test("repeated refresh-probe cycles keep refresh and clear files bounded", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  for (let cycle = 0; cycle < 5; cycle++) {
    clock.now = T0 + cycle * 10 * MIN;
    await store.refreshAuth(PROVIDER);
    clock.now += 1;
    const lease = await store.tryProbe(SCOPE);
    assert.ok(lease);
    await lease.finish({ outcome: "success" });
    assert.deepEqual(await store.check(SCOPE), { state: "open" });
  }
  const names = fs.readdirSync(dir);
  assert.ok(names.filter((name) => name.startsWith("f-")).length <= 1);
  assert.ok(names.filter((name) => name.startsWith("c-")).length <= 1);
}));

test("clear files do not accumulate: a newer clear for the same model replaces older own clears", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  await store.recordTrustedError({ scope: SCOPE, kind: "rate" });
  await store.recordSuccess(SCOPE, T0 + 1);
  clock.now = T0 + 2;
  await store.recordTrustedError({ scope: SCOPE, kind: "rate" });
  await store.recordSuccess(SCOPE, T0 + 3);
  const names = fs.readdirSync(dir);
  assert.equal(names.filter((name) => name.startsWith("c-")).length, 1);
  assert.equal(names.filter((name) => name.startsWith("r-")).length, 0);
}));

test("scope ids are validated before any path is built", () => withStateDir(async (dir) => {
  await assert.rejects(storeAt(dir, { now: T0 }).check({ provider: "../escape" }), TypeError);
}));

test("a renew that loses a takeover between its ownership check and publish returns false; the new claim stays fresh", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const handoff: { takeover?: () => Promise<void>; second?: ProbeLease } = {};
  const store = storeAt(dir, clock, { beforeLeaseMetadata: async () => { const run = handoff.takeover; handoff.takeover = undefined; await run?.(); } });
  await store.recordTrustedError({ scope: SCOPE, kind: "rate" });
  clock.now = T0 + MIN;
  const first = await store.tryProbe(SCOPE);
  assert.ok(first);
  clock.now = T0 + MIN + LEASE_TTL_MS + 1;
  const other = storeAt(dir, clock);
  handoff.takeover = async () => { handoff.second = await other.tryProbe(SCOPE); };
  assert.equal(await first.renew(), false);
  const second = handoff.second;
  assert.ok(second);
  assert.equal(await other.tryProbe(SCOPE), undefined);
  assert.equal((await other.check(SCOPE)).state, "probe-busy");
  assert.equal(await second.renew(), true);
  assert.equal(await first.renew(), false);
}));

test("a stale finish that lands after a takeover cannot release the new owner's lease", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const handoff: { takeover?: () => Promise<void>; second?: ProbeLease } = {};
  const store = storeAt(dir, clock, { beforeLeaseMetadata: async () => { const run = handoff.takeover; handoff.takeover = undefined; await run?.(); } });
  await store.recordTrustedError({ scope: SCOPE, kind: "rate" });
  clock.now = T0 + MIN;
  const first = await store.tryProbe(SCOPE);
  assert.ok(first);
  clock.now = T0 + MIN + LEASE_TTL_MS + 1;
  const other = storeAt(dir, clock);
  handoff.takeover = async () => { handoff.second = await other.tryProbe(SCOPE); };
  await first.finish({ outcome: "abort" });
  const second = handoff.second;
  assert.ok(second);
  assert.equal((await other.check(SCOPE)).state, "probe-busy");
  assert.equal(await second.renew(), true);
}));

test("a partial (zero-byte or truncated) lease claim fails closed: unavailable, never open", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  await store.recordTrustedError({ scope: SCOPE, kind: "rate" });
  clock.now = T0 + MIN;
  fs.writeFileSync(path.join(dir, "lease-openai-codex-1.json"), "");
  assert.deepEqual(await store.check(SCOPE), { state: "unavailable", reason: "malformed" });
  assert.equal(await store.tryProbe(SCOPE), undefined);
  fs.writeFileSync(path.join(dir, "lease-openai-codex-1.json"), '{"v":1,"kind":"lease"');
  assert.deepEqual(await store.check(SCOPE), { state: "unavailable", reason: "malformed" });
}));

test("latest-generation fence: superseded generations never become current again; the highest claim survives finish", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const a = storeAt(dir, clock);
  await a.recordTrustedError({ scope: SCOPE, kind: "rate" });
  clock.now = T0 + MIN;
  const first = await a.tryProbe(SCOPE);
  assert.ok(first);
  clock.now = T0 + MIN + LEASE_TTL_MS + 1;
  const b = storeAt(dir, clock);
  const second = await b.tryProbe(SCOPE);
  assert.ok(second);
  assert.deepEqual(claimNames(dir), ["lease-openai-codex-2.json"]); // generation 1 pruned after the new claim
  assert.equal(await first.renew(), false);
  await first.finish({ outcome: "abort" });
  assert.deepEqual(claimNames(dir), ["lease-openai-codex-2.json"]); // stale metadata never recreates generation 1
  assert.equal((await b.check(SCOPE)).state, "probe-busy");
  await second.finish({ outcome: "abort" });
  assert.deepEqual(claimNames(dir), ["lease-openai-codex-2.json"]); // highest claim kept even when finished
  const third = await b.tryProbe(SCOPE);
  assert.ok(third);
  assert.deepEqual(claimNames(dir), ["lease-openai-codex-3.json"]);
  assert.equal(await second.renew(), false);
  assert.equal(await first.renew(), false);
}));

test("renewal metadata stays bounded across 600 renewals on a logical clock (no overflow)", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  await store.recordTrustedError({ scope: SCOPE, kind: "rate" });
  clock.now = T0 + MIN;
  const lease = await store.tryProbe(SCOPE);
  assert.ok(lease);
  let peak = 0;
  for (let i = 1; i <= 600; i++) {
    clock.now = T0 + MIN + i * LEASE_RENEW_MS;
    assert.equal(await lease.renew(), true, `renewal ${i}`);
    peak = Math.max(peak, fs.readdirSync(dir).length);
  }
  assert.ok(peak <= 5, `peak entries ${peak}`);
  assert.equal((await store.check(SCOPE)).state, "probe-busy");
  await lease.finish({ outcome: "abort" });
  assert.equal((await store.check(SCOPE)).state, "probe-due");
}));

test("same-generation losers do not retry a later generation in the same admission", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  await store.recordTrustedError({ scope: SCOPE, kind: "rate" });
  clock.now = T0 + MIN;
  const leases = await Promise.all(Array.from({ length: 8 }, () => store.tryProbe(SCOPE)));
  assert.equal(leases.filter(Boolean).length, 1);
  assert.deepEqual(claimNames(dir), ["lease-openai-codex-1.json"]);
  await leases.find(Boolean)?.finish({ outcome: "abort" });
}));

test("a renew in flight when finish starts is serialized first: the finish release is the last word", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  await store.recordTrustedError({ scope: SCOPE, kind: "rate" });
  clock.now = T0 + MIN;
  const lease = await store.tryProbe(SCOPE);
  assert.ok(lease);
  clock.now = T0 + MIN + LEASE_RENEW_MS;
  const renewing = lease.renew();
  await lease.finish({ outcome: "abort" });
  assert.equal(await renewing, true);
  assert.equal((await store.check(SCOPE)).state, "probe-due");
}));

test("typed trusted errors: a missing, unknown, transient or flat-text kind writes nothing", () => withStateDir(async (dir) => {
  const store = storeAt(dir, { now: T0 });
  for (const kind of [undefined, "", "transient", "none", "quota usage limit", "401 unauthorized", "upstream returned no response"]) {
    assert.equal(await store.recordTrustedError({ scope: SCOPE, kind: kind as never }), undefined, String(kind));
  }
  assert.equal(fs.existsSync(dir) ? fs.readdirSync(dir).length : 0, 0);
  assert.deepEqual(await store.check(SCOPE), { state: "open" });
}));

test("typed trusted errors: each closed kind records with its default; quota, auth and rate drop the model scope", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  assert.deepEqual(await store.recordTrustedError({ scope: { provider: "anthropic", model: "claude-x" }, kind: "rate" }), { kind: "rate", source: "default", untilMs: T0 + MIN });
  assert.deepEqual(await store.recordTrustedError({ scope: SCOPE, kind: "model" }), { kind: "model", source: "default", untilMs: T0 + MIN });
  assert.deepEqual(await store.recordTrustedError({ scope: SCOPE, kind: "quota" }), { kind: "quota", source: "default", untilMs: T0 + QUOTA_DEFAULT_MS });
  assert.deepEqual(await store.check({ provider: "anthropic", model: "other-model" }), { state: "cooling", kind: "rate", untilMs: T0 + MIN, source: "default" });
  assert.deepEqual(await store.check({ provider: PROVIDER, model: "gpt-other" }), { state: "cooling", kind: "quota", untilMs: T0 + QUOTA_DEFAULT_MS, source: "default" });
  assert.deepEqual(await store.check(SCOPE), { state: "cooling", kind: "quota", untilMs: T0 + QUOTA_DEFAULT_MS, source: "default" });
  assert.deepEqual(await store.recordTrustedError({ scope: { provider: "anthropic", model: "claude-x" }, kind: "auth" }), { kind: "auth", source: "indefinite" });
  assert.deepEqual(await store.check({ provider: "anthropic", model: "other-model" }), { state: "blocked", reason: "auth" });
}));

test("typed model kind without a model ID is rejected and never becomes an account-wide cooldown", () => withStateDir(async (dir) => {
  const store = storeAt(dir, { now: T0 });
  assert.equal(await store.recordTrustedError({ scope: { provider: PROVIDER }, kind: "model" }), undefined);
  assert.equal(fs.existsSync(dir) ? fs.readdirSync(dir).length : 0, 0);
  assert.deepEqual(await store.check({ provider: PROVIDER, model: "gpt-x" }), { state: "open" });
}));

test("typed probe error: its kind decides the record; a transient kind releases the lease with no record", () => withStateDir(async (dir) => {
  const clock = { now: T0 };
  const store = storeAt(dir, clock);
  await store.recordTrustedError({ scope: SCOPE, kind: "rate" });
  clock.now = T0 + MIN;
  const first = await store.tryProbe(SCOPE);
  assert.ok(first);
  assert.equal(await first.finish({ outcome: "error", kind: "transient" as never }), undefined);
  assert.deepEqual(await store.check(SCOPE), { state: "probe-due", kind: "rate" });
  const second = await store.tryProbe(SCOPE);
  assert.ok(second);
  clock.now = T0 + MIN + 1;
  assert.deepEqual(await second.finish({ outcome: "error", kind: "quota", trustedReset: { resetsAtEpochSeconds: (T0 + MIN + 120_000) / 1000 } }), { kind: "quota", source: "structured", untilMs: T0 + MIN + 120_000 });
  assert.deepEqual(await store.check(SCOPE), { state: "cooling", kind: "quota", untilMs: T0 + MIN + 120_000, source: "structured" });
}));
