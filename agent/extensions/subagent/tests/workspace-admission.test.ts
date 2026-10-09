import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  WorkspaceAdmissionError,
  acquireWorkspace,
  releaseWorkspace,
  resolveCheckoutKey,
  type WorkspaceAccess,
  type WorkspaceLease,
} from "../workspace-admission.ts";

const EXTENSION = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CANDIDATE = path.resolve(EXTENSION, "..", "..", ".."); // read-only: resolved, never written
const flush = () => new Promise<void>((resolve) => setImmediate(resolve)); // drains microtasks; no timing assumption

// Fixture root honours the assigned scratch via TMP/TEMP; links this test made are unlinked before the tree is removed.
async function withFixtures(run: (root: string, links: string[]) => Promise<void>): Promise<void> {
  const root = fs.mkdtempSync(path.join(process.env.WORKSPACE_ADMISSION_TEST_ROOT ?? os.tmpdir(), "workspace-admission-"));
  const links: string[] = [];
  try {
    await run(root, links);
  } finally {
    for (const link of links) {
      try {
        fs.lstatSync(link);
        fs.rmdirSync(link); // removes only the junction itself, never its target
      } catch {
        // already removed by the test
      }
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function checkout(root: string, name: string): string {
  const dir = path.join(root, name);
  fs.mkdirSync(path.join(dir, ".git"), { recursive: true });
  fs.mkdirSync(path.join(dir, "src", "deep"), { recursive: true });
  return dir;
}

function worktree(root: string, name: string, commonGit: string): string {
  const dir = path.join(root, name);
  fs.mkdirSync(path.join(dir, "src", "deep"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".git"), `gitdir: ${commonGit}/worktrees/${name}\n`);
  return dir;
}

type Claim = { promise: Promise<WorkspaceLease>; granted: boolean; lease?: WorkspaceLease; queued: number[] };
// queued records synchronous observer positions, so registration is observable before any await.
function ask(cwd: string, options: { access?: WorkspaceAccess; signal?: AbortSignal } = {}): Claim {
  const queued: number[] = [];
  const promise = acquireWorkspace(cwd, { ...options, onQueued: (position: number) => { queued.push(position); } });
  const claim: Claim = { promise, granted: false, queued };
  promise.then((lease) => { claim.granted = true; claim.lease = lease; }, () => {});
  return claim;
}

test("real checkout root and its subdirectories resolve to one canonical key", () => {
  const key = resolveCheckoutKey(CANDIDATE);
  assert.equal(resolveCheckoutKey(EXTENSION), key);
  assert.equal(resolveCheckoutKey(path.join(EXTENSION, "tests")), key);
});

test("junction alias and its subdirectories share the checkout key; unlinking the alias leaves the target intact", () => withFixtures(async (root, links) => {
  const repo = checkout(root, "repo");
  const alias = path.join(root, "alias");
  fs.symlinkSync(repo, alias, "junction");
  links.push(alias);
  const key = resolveCheckoutKey(repo);
  assert.equal(resolveCheckoutKey(alias), key);
  assert.equal(resolveCheckoutKey(path.join(alias, "src", "deep")), key);
  assert.equal(resolveCheckoutKey(path.join(repo, "src", "deep")), key);
  fs.rmdirSync(alias);
  links.length = 0;
  assert.ok(fs.statSync(path.join(repo, ".git")).isDirectory());
}));

test("separate worktrees sharing one common git dir keep distinct keys", () => withFixtures(async (root) => {
  const common = path.join(root, "repo.git");
  const a = worktree(root, "wt-a", common);
  const b = worktree(root, "wt-b", common);
  assert.notEqual(resolveCheckoutKey(a), resolveCheckoutKey(b));
  assert.equal(resolveCheckoutKey(path.join(a, "src", "deep")), resolveCheckoutKey(a));
  assert.equal(resolveCheckoutKey(path.join(b, "src", "deep")), resolveCheckoutKey(b));
}));

test("non-git cwd keys to its own canonical directory, not an ancestor", () => withFixtures(async (root) => {
  const plain = path.join(root, "plain", "nested");
  const sibling = path.join(root, "plain", "other");
  fs.mkdirSync(plain, { recursive: true });
  fs.mkdirSync(sibling, { recursive: true });
  assert.match(resolveCheckoutKey(plain), /nested$/i);
  assert.notEqual(resolveCheckoutKey(plain), resolveCheckoutKey(sibling));
  assert.notEqual(resolveCheckoutKey(plain), resolveCheckoutKey(CANDIDATE));
}));

test("nonexistent or non-directory cwd fails closed with a non-launch error", () => withFixtures(async (root) => {
  const missing = path.join(root, "missing");
  const file = path.join(root, "file.txt");
  fs.writeFileSync(file, "x");
  assert.throws(() => resolveCheckoutKey(missing), WorkspaceAdmissionError);
  assert.throws(() => resolveCheckoutKey(file), WorkspaceAdmissionError);
  await assert.rejects(acquireWorkspace(missing), WorkspaceAdmissionError);
  await assert.rejects(acquireWorkspace(file), WorkspaceAdmissionError);
}));

test("Windows checkout keys ignore path case", { skip: process.platform !== "win32" }, () => {
  const flipped = CANDIDATE.replace(/[a-z]/gi, (c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()));
  assert.equal(resolveCheckoutKey(flipped), resolveCheckoutKey(CANDIDATE));
});

test("reader-reader overlap on one checkout is granted immediately", () => withFixtures(async (root) => {
  const repo = checkout(root, "repo");
  const r1 = ask(repo, { access: "read" });
  const r2 = ask(path.join(repo, "src", "deep"), { access: "read" });
  await flush();
  assert.equal(r1.granted && r2.granted, true);
  assert.deepEqual(r2.queued, []);
  assert.equal(releaseWorkspace(r1.lease!), true);
  assert.equal(releaseWorkspace(r2.lease!), true);
}));

test("a writer excludes readers and writers on one checkout, registering synchronously in FIFO order", () => withFixtures(async (root) => {
  const repo = checkout(root, "repo");
  const w1 = ask(repo);
  await flush();
  assert.equal(w1.granted, true);
  const r = ask(path.join(repo, "src", "deep"), { access: "read" });
  const w2 = ask(repo);
  assert.deepEqual(r.queued, [1]); // observed before any await
  assert.deepEqual(w2.queued, [2]);
  await flush();
  assert.equal(r.granted || w2.granted, false);
  assert.equal(releaseWorkspace(w1.lease!), true);
  await flush();
  assert.equal(r.granted, true);
  assert.equal(w2.granted, false);
  assert.equal(releaseWorkspace(r.lease!), true);
  await flush();
  assert.equal(w2.granted, true);
  assert.equal(releaseWorkspace(w2.lease!), true);
}));

test("a queued writer is not starved by readers arriving later", () => withFixtures(async (root) => {
  const repo = checkout(root, "repo");
  const r1 = ask(repo, { access: "read" });
  await flush();
  const w = ask(repo);
  const r2 = ask(repo, { access: "read" });
  assert.deepEqual(w.queued, [1]);
  assert.deepEqual(r2.queued, [2]);
  await flush();
  assert.equal(w.granted || r2.granted, false);
  assert.equal(releaseWorkspace(r1.lease!), true);
  await flush();
  assert.equal(w.granted, true);
  assert.equal(r2.granted, false);
  assert.equal(releaseWorkspace(w.lease!), true);
  await flush();
  assert.equal(r2.granted, true);
  assert.equal(releaseWorkspace(r2.lease!), true);
}));

test("unrelated checkouts are admitted independently", () => withFixtures(async (root) => {
  const a = ask(checkout(root, "repo-a"));
  const b = ask(checkout(root, "repo-b"));
  await flush();
  assert.equal(a.granted && b.granted, true);
  assert.deepEqual(a.queued.concat(b.queued), []);
}));

test("an already-aborted signal rejects with AbortError and leaves no claim behind", () => withFixtures(async (root) => {
  const repo = checkout(root, "repo");
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(acquireWorkspace(repo, { signal: ac.signal }), { name: "AbortError" });
  const next = ask(repo);
  await flush();
  assert.equal(next.granted, true);
  assert.deepEqual(next.queued, []);
  assert.equal(releaseWorkspace(next.lease!), true);
}));

test("cancelling a queued claim removes it, rejects with AbortError and does not block the next claim", () => withFixtures(async (root) => {
  const repo = checkout(root, "repo");
  const holder = ask(repo);
  await flush();
  const ac = new AbortController();
  const cancelled = ask(repo, { signal: ac.signal });
  assert.deepEqual(cancelled.queued, [1]);
  ac.abort();
  await assert.rejects(cancelled.promise, { name: "AbortError" });
  const next = ask(repo);
  assert.deepEqual(next.queued, [1]);
  assert.equal(releaseWorkspace(holder.lease!), true);
  await flush();
  assert.equal(next.granted, true);
  assert.equal(cancelled.granted, false);
  assert.equal(releaseWorkspace(next.lease!), true);
}));

test("cancelling a queued writer lets readers queued behind it proceed", () => withFixtures(async (root) => {
  const repo = checkout(root, "repo");
  const holder = ask(repo, { access: "read" });
  await flush();
  const ac = new AbortController();
  const w = ask(repo, { signal: ac.signal });
  const r = ask(repo, { access: "read" });
  assert.deepEqual(w.queued, [1]);
  assert.deepEqual(r.queued, [2]);
  ac.abort();
  await assert.rejects(w.promise, { name: "AbortError" });
  await flush();
  assert.equal(r.granted, true);
  assert.equal(releaseWorkspace(holder.lease!), true);
  assert.equal(releaseWorkspace(r.lease!), true);
}));

test("release is fenced by an opaque token: forged and duplicate releases free nothing they do not own", () => withFixtures(async (root) => {
  const repo = checkout(root, "repo");
  const r1 = ask(repo, { access: "read" });
  const r2 = ask(repo, { access: "read" });
  await flush();
  const w = ask(repo);
  assert.deepEqual(w.queued, [1]);
  assert.equal(releaseWorkspace({ key: r1.lease!.key, token: Symbol("forged") }), false);
  assert.equal(releaseWorkspace(r1.lease!), true);
  assert.equal(releaseWorkspace(r1.lease!), false);
  await flush();
  assert.equal(w.granted, false);
  assert.equal(releaseWorkspace(r2.lease!), true);
  await flush();
  assert.equal(w.granted, true);
  assert.equal(releaseWorkspace(r2.lease!), false);
  assert.equal(releaseWorkspace(w.lease!), true);
}));

test("abort after a grant neither rejects nor auto-releases the granted claim", () => withFixtures(async (root) => {
  const repo = checkout(root, "repo");
  const holder = ask(repo);
  await flush();
  const ac = new AbortController();
  const b = ask(repo, { signal: ac.signal });
  const c = ask(repo);
  assert.deepEqual(b.queued, [1]);
  assert.deepEqual(c.queued, [2]);
  assert.equal(releaseWorkspace(holder.lease!), true); // grants b synchronously
  ac.abort();
  const leaseB = await b.promise;
  await flush();
  assert.equal(c.granted, false);
  assert.equal(releaseWorkspace(leaseB), true);
  await flush();
  assert.equal(c.granted, true);
  assert.equal(releaseWorkspace(c.lease!), true);
}));

test("a throwing queue observer cannot strand a queued claim", () => withFixtures(async (root) => {
  const repo = checkout(root, "repo");
  const holder = ask(repo);
  await flush();
  let granted = false;
  const waiting = acquireWorkspace(repo, { onQueued: () => { throw new Error("observer failed"); } });
  waiting.then((lease) => { granted = true; releaseWorkspace(lease); }, () => {});
  await flush();
  assert.equal(granted, false);
  assert.equal(releaseWorkspace(holder.lease!), true);
  await flush();
  assert.equal(granted, true);
}));
