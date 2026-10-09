// Cross-process proof for the provider-cooldown probe lease: real node processes race one expired probe.
// Node-only (named *.node.ts so Bun discovery skips it). Run: node --experimental-strip-types --test agent/extensions/subagent/tests/provider-cooldown-race.node.ts
// Child processes re-enter this same file through PROVIDER_COOLDOWN_RACE_ROLE and never register tests.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { LEASE_TTL_MS, createCooldownStore } from "../provider-cooldown.ts";

const selfPath = fileURLToPath(import.meta.url);
const CONTENDERS = 12;
const SCOPE = { provider: "openai-codex", model: "gpt-6.1-sol" };
const CLAIM_FILE = /^lease-openai-codex-\d+\.json$/; // generation-fenced claims

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

async function waitUntil(ready: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!ready()) {
    if (Date.now() > deadline) throw new Error("barrier timed out");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

// "contend": wait at a file barrier, then race tryProbe. "orphan": take the lease and exit unfinished (simulated crash).
async function runRole(role: string): Promise<{ index?: number; won: boolean }> {
  const offset = Number(process.env.PROVIDER_COOLDOWN_RACE_OFFSET_MS ?? 0);
  const store = createCooldownStore({ dir: required("PROVIDER_COOLDOWN_RACE_DIR"), now: () => Date.now() + offset });
  if (role === "contend") {
    const barrier = required("PROVIDER_COOLDOWN_RACE_BARRIER");
    const index = Number(required("PROVIDER_COOLDOWN_RACE_INDEX"));
    fs.writeFileSync(path.join(barrier, `ready-${index}`), "");
    await waitUntil(() => fs.readdirSync(barrier).filter((name) => name.startsWith("ready-")).length >= CONTENDERS, 20_000);
    return { index, won: (await store.tryProbe(SCOPE)) !== undefined };
  }
  if (role === "orphan") return { won: (await store.tryProbe(SCOPE)) !== undefined };
  throw new Error(`unknown role ${role}`);
}

const role = process.env.PROVIDER_COOLDOWN_RACE_ROLE;
if (role) {
  runRole(role).then(
    (result) => process.stdout.write(`${JSON.stringify(result)}\n`, () => process.exit(0)),
    (error: unknown) => process.stderr.write(`${String(error)}\n`, () => process.exit(2)),
  );
} else {
  function fixture(): { root: string; dir: string; barrier: string } {
    const root = fs.mkdtempSync(path.join(process.env.PROVIDER_COOLDOWN_TEST_ROOT ?? os.tmpdir(), "provider-cooldown-race-"));
    const barrier = path.join(root, "barrier");
    fs.mkdirSync(barrier);
    return { root, dir: path.join(root, "state"), barrier };
  }

  // A transient failure observed 10 minutes ago: its 60 s deadline has passed, so the next admission is probe-due.
  async function seedExpiredProbe(dir: string): Promise<void> {
    await createCooldownStore({ dir, now: () => Date.now() }).recordTrustedError({ scope: SCOPE, kind: "rate", observedAt: Date.now() - 600_000 });
  }

  function runChild(childRole: string, env: Record<string, string>): Promise<{ code: number | null; stdout: string; stderr: string }> {
    const childEnv: Record<string, string | undefined> = { ...process.env, ...env, PROVIDER_COOLDOWN_RACE_ROLE: childRole };
    delete childEnv.NODE_TEST_CONTEXT; // inherited from a parent node --test would make the child emit TAP
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["--experimental-strip-types", selfPath], { env: childEnv, windowsHide: true, timeout: 60_000 });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => (stdout += chunk));
      child.stderr.on("data", (chunk: Buffer) => (stderr += chunk));
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, stdout, stderr }));
    });
  }

  test("twelve real processes race one expired probe: exactly one lease winner", async () => {
    const { root, dir, barrier } = fixture();
    try {
      await seedExpiredProbe(dir);
      const runs = await Promise.all(
        Array.from({ length: CONTENDERS }, (_, index) =>
          runChild("contend", { PROVIDER_COOLDOWN_RACE_DIR: dir, PROVIDER_COOLDOWN_RACE_BARRIER: barrier, PROVIDER_COOLDOWN_RACE_INDEX: String(index) }),
        ),
      );
      const outcomes = runs.map((run) => {
        assert.equal(run.code, 0, run.stderr);
        return JSON.parse(run.stdout.trim()) as { won: boolean };
      });
      assert.equal(outcomes.length, CONTENDERS);
      assert.equal(outcomes.filter((outcome) => outcome.won).length, 1);
      assert.equal(fs.readdirSync(dir).filter((name) => CLAIM_FILE.test(name)).length, 1); // losers never claim a later generation
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("a crashed probe owner's lease is taken over only after its TTL (cross-process)", async () => {
    const { root, dir } = fixture();
    try {
      await seedExpiredProbe(dir);
      const orphan = await runChild("orphan", { PROVIDER_COOLDOWN_RACE_DIR: dir });
      assert.equal(orphan.code, 0, orphan.stderr);
      assert.deepEqual(JSON.parse(orphan.stdout.trim()), { won: true });
      const live = createCooldownStore({ dir, now: () => Date.now() });
      assert.equal(await live.tryProbe(SCOPE), undefined);
      const later = createCooldownStore({ dir, now: () => Date.now() + LEASE_TTL_MS + 1_000 });
      const lease = await later.tryProbe(SCOPE);
      assert.ok(lease);
      await lease.finish({ outcome: "abort" });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}
