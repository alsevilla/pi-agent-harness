import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test, { after } from "node:test";
import { cargoEnvDefaults } from "../build-env.ts";

const fixtures: string[] = [];
after(() => {
  for (const fixture of fixtures) fs.rmSync(fixture, { recursive: true, force: true });
});

function repo(name: string, gitAsFile = false) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "build-env-"));
  fixtures.push(base);
  const top = path.join(base, name);
  fs.mkdirSync(path.join(top, "backend", "src"), { recursive: true });
  if (gitAsFile) fs.writeFileSync(path.join(top, ".git"), "gitdir: elsewhere");
  else fs.mkdirSync(path.join(top, ".git"));
  return top;
}

test("without PI_CARGO_TARGET_ROOT only non-incremental builds are defaulted", () => {
  assert.deepEqual(cargoEnvDefaults(repo("app"), {}), { CARGO_INCREMENTAL: "0" });
});

test("target dir is stable per checkout, under the root, and distinct between checkouts", () => {
  const a = repo("app"), b = repo("app", true);
  const env = { PI_CARGO_TARGET_ROOT: "C:/cargo-target" };
  const first = cargoEnvDefaults(path.join(a, "backend", "src"), env).CARGO_TARGET_DIR;
  assert.ok(first && first.startsWith(path.join("C:/cargo-target", "app-")));
  assert.equal(cargoEnvDefaults(a, env).CARGO_TARGET_DIR, first);
  assert.notEqual(cargoEnvDefaults(b, env).CARGO_TARGET_DIR, first);
});

test("values already in the environment win", () => {
  const env = { PI_CARGO_TARGET_ROOT: "C:/cargo-target", CARGO_TARGET_DIR: "D:/mine", CARGO_INCREMENTAL: "1" };
  assert.deepEqual(cargoEnvDefaults(repo("app"), env), {});
});

test("checkout hash preserves case on case-sensitive platforms", { skip: process.platform === "win32" }, () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "build-env-case-"));
  fixtures.push(base);
  const upper = path.join(base, "A", "repo"), lower = path.join(base, "a", "repo");
  for (const top of [upper, lower]) {
    fs.mkdirSync(path.join(top, "backend", "src"), { recursive: true });
    fs.mkdirSync(path.join(top, ".git"));
  }
  const env = { PI_CARGO_TARGET_ROOT: "C:/cargo-target" };
  assert.notEqual(
    cargoEnvDefaults(upper, env).CARGO_TARGET_DIR,
    cargoEnvDefaults(lower, env).CARGO_TARGET_DIR,
  );
});

test("without a git checkout root, target dir is not defaulted", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "build-env-no-git-"));
  fixtures.push(base);
  const cwd = path.join(base, "backend", "src");
  fs.mkdirSync(cwd, { recursive: true });
  assert.deepEqual(cargoEnvDefaults(cwd, { PI_CARGO_TARGET_ROOT: "C:/cargo-target" }), { CARGO_INCREMENTAL: "0" });
});
