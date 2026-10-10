// Package role defaults regression (RED first). Defaults are the pinned HEAD baseline (byte-for-byte), discovered at the lowest tier.
// Every discovery scenario runs in a child Node process with PI_CODING_AGENT_DIR pointing at an owned temp profile; the real profile is never read.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = fileURLToPath(new URL("../../../../", import.meta.url));
const thisFile = fileURLToPath(import.meta.url);
const isBun = typeof (process.versions as Record<string, string>).bun === "string";
const BASELINE = "861c095cae2d2cd8313706c4af54d8d832865571";
const GENERIC = ["api-specialist", "architecture-specialist", "backend-worker", "concurrency-specialist", "debugger", "devops-specialist", "frontend-worker", "general-worker", "observability-specialist", "oracle", "performance-specialist", "release-engineer", "reviewer", "scout", "security-specialist", "sqlite-specialist", "test-engineer", "ui-ux-specialist"];
const EXCLUDED = ["attendance-domain-specialist", "event-reconciliation-specialist", "hardware-integration", "messaging-specialist", "privacy-compliance-specialist"];

if (isBun) {
	const { test } = await import("bun:test");
	test("package defaults suite passes under Node native TypeScript transform", () => {
		const env = { ...process.env };
		delete env.NODE_TEST_CONTEXT;
		const run = spawnSync("node", ["--experimental-transform-types", "--test", thisFile], { encoding: "utf8", timeout: 240_000, windowsHide: true, env });
		assert.equal(run.status, 0, run.stdout + run.stderr);
	}, 260_000);
} else {
	await runNodeSuite();
}

function headBytes(rel: string): Buffer {
	return execFileSync("git", ["show", `${BASELINE}:${rel}`], { cwd: repo, maxBuffer: 16 * 1024 * 1024 });
}

/** Runs one discovery in a child process: isolated profile, optional package copy, real installed Pi builds via registerHooks. */
type Found = { name: string; source: string; tools?: string[]; model?: string; thinking?: string; fallbackModel?: string[] };
type Discovery = { agents: Found[]; error: string | null };

function discoverRaw(agentsTs: string, cwd: string, profile: string, scope: string): Discovery {
	const helper = path.join(os.tmpdir(), `pkg-discover-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
	const installed = (rel: string) => pathToFileURL(path.join(repo, "agent", "install", "releases", "1.1.0", "node_modules", "@earendil-works", rel)).href;
	fs.writeFileSync(helper, `import { registerHooks } from "node:module";
const map = { "@earendil-works/pi-coding-agent": ${JSON.stringify(installed("pi-coding-agent/dist/index.js"))}, "@earendil-works/pi-ai": ${JSON.stringify(installed("pi-ai/dist/index.js"))}, "@earendil-works/pi-tui": ${JSON.stringify(installed("pi-tui/dist/index.js"))}, "@earendil-works/pi-agent-core": ${JSON.stringify(installed("pi-agent-core/dist/index.js"))} };
registerHooks({ resolve(s, c, next) { if (map[s]) return { url: map[s], shortCircuit: true }; return next(s, c); } });
const mod = await import(process.argv[2]);
const r = mod.discoverAgents(process.argv[3], process.argv[4]);
process.stdout.write(JSON.stringify({ agents: r.agents.map(({ name, source, tools, model, thinking, fallbackModel }) => ({ name, source, tools, model, thinking, fallbackModel })), error: r.error ?? null }));
`);
	try {
		const run = spawnSync("node", ["--experimental-transform-types", helper, pathToFileURL(agentsTs).href, cwd, scope], { encoding: "utf8", timeout: 120_000, windowsHide: true, env: { ...process.env, PI_CODING_AGENT_DIR: profile } });
		assert.equal(run.status, 0, run.stdout + run.stderr);
		return JSON.parse(run.stdout) as Discovery;
	} finally {
		fs.rmSync(helper, { force: true });
	}
}

function discover(agentsTs: string, cwd: string, profile: string, scope: string): Found[] {
	return discoverRaw(agentsTs, cwd, profile, scope).agents;
}

const installedPi = (rel: string) => pathToFileURL(path.join(repo, "agent", "install", "releases", "1.1.0", "node_modules", "@earendil-works", rel)).href;
const installedTypebox = pathToFileURL(path.join(repo, "agent", "install", "releases", "1.1.0", "node_modules", "typebox", "build", "index.mjs")).href;

/** Runs index.ts registration and one subagent dispatch in a child: counts child launches through the runtime double, never a provider. */
function dispatchProbe(indexTs: string, cwd: string, profile: string): { isError: boolean; text: string; spawned: number } {
	const helper = path.join(os.tmpdir(), `pkg-dispatch-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
	const doubles = pathToFileURL(path.join(repo, "agent", "extensions", "subagent", "tests", "fixtures", "runtime-doubles.mjs")).href;
	const entryStub = "data:text/javascript," + encodeURIComponent("export default function providerCooldownEntry() {}\nexport function registerProviderCooldown() {}\nexport async function runProviderCooldownCommand() { return { message: '', type: 'info' }; }\nexport async function providerLaunchState() { return { state: 'launch' }; }\nexport async function guardRefusalReplayable() { return false; }");
	fs.writeFileSync(helper, `import { registerHooks } from "node:module";
const indexUrl = ${JSON.stringify(pathToFileURL(indexTs).href)};
const map = { "@earendil-works/pi-coding-agent": ${JSON.stringify(installedPi("pi-coding-agent/dist/index.js"))}, "@earendil-works/pi-ai": ${JSON.stringify(installedPi("pi-ai/dist/index.js"))}, "@earendil-works/pi-tui": ${JSON.stringify(installedPi("pi-tui/dist/index.js"))}, "@earendil-works/pi-agent-core": ${JSON.stringify(installedPi("pi-agent-core/dist/index.js"))}, typebox: ${JSON.stringify(installedTypebox)} };
registerHooks({ resolve(s, c, next) {
	if (c.parentURL === indexUrl && s === "node:child_process") return { url: ${JSON.stringify(doubles)}, shortCircuit: true };
	if (c.parentURL === indexUrl && s === "./provider-cooldown-entry.ts") return { url: ${JSON.stringify(entryStub)}, shortCircuit: true };
	if (map[s]) return { url: map[s], shortCircuit: true };
	return next(s, c);
} });
let spawned = 0;
globalThis.__piSubagentFakeSpawn = () => { spawned += 1; return { events: [], exitCode: 0 }; };
const mod = await import(indexUrl);
const tools = new Map();
mod.default(new Proxy({}, { get: (_t, prop) => (prop === "registerTool" ? (def) => tools.set(def.name, def) : () => undefined) }));
const ctx = { cwd: process.argv[2], model: undefined, thinkingLevel: undefined, hasUI: false, isProjectTrusted: () => true, modelRegistry: undefined };
let r;
try {
	r = await tools.get("subagent").execute("probe", { agent: "general-worker", task: "probe", background: false }, undefined, undefined, ctx);
} catch (error) {
	process.stdout.write(JSON.stringify({ isError: false, text: "thrown: " + (error instanceof Error ? error.message : String(error)), spawned }));
	process.exit(0);
}
process.stdout.write(JSON.stringify({ isError: r.isError === true, text: r.content?.[0]?.text ?? "", spawned }));
`);
	try {
		const run = spawnSync("node", ["--experimental-transform-types", helper, cwd], { encoding: "utf8", timeout: 120_000, windowsHide: true, env: { ...process.env, PI_CODING_AGENT_DIR: profile } });
		assert.equal(run.status, 0, run.stdout + run.stderr);
		return JSON.parse(run.stdout);
	} finally {
		fs.rmSync(helper, { force: true });
	}
}

/** Reads one role snapshot through the source roles-editor in a child: the package baseline is an explicit argument. */
function editorProbe(profile: string, name: string, pkgRoot: string): { ok: boolean; error?: string; primary?: string } {
	const helper = path.join(os.tmpdir(), `pkg-editor-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
	const editorUrl = pathToFileURL(path.join(repo, "agent", "extensions", "subagent", "roles-editor.ts")).href;
	fs.writeFileSync(helper, `import { registerHooks } from "node:module";
const map = { "@earendil-works/pi-coding-agent": ${JSON.stringify(installedPi("pi-coding-agent/dist/index.js"))}, "@earendil-works/pi-ai": ${JSON.stringify(installedPi("pi-ai/dist/index.js"))}, "@earendil-works/pi-tui": ${JSON.stringify(installedPi("pi-tui/dist/index.js"))}, "@earendil-works/pi-agent-core": ${JSON.stringify(installedPi("pi-agent-core/dist/index.js"))}, typebox: ${JSON.stringify(installedTypebox)} };
registerHooks({ resolve(s, c, next) { if (map[s]) return { url: map[s], shortCircuit: true }; return next(s, c); } });
const editor = await import(${JSON.stringify(editorUrl)});
try {
	const snap = editor.readRoleSnapshot(process.argv[2], process.argv[3], process.argv[4]);
	process.stdout.write(JSON.stringify({ ok: true, primary: snap.current.primary }));
} catch (error) {
	process.stdout.write(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
}
`);
	try {
		const run = spawnSync("node", ["--experimental-transform-types", helper, profile, name, pkgRoot], { encoding: "utf8", timeout: 120_000, windowsHide: true });
		assert.equal(run.status, 0, run.stdout + run.stderr);
		return JSON.parse(run.stdout);
	} finally {
		fs.rmSync(helper, { force: true });
	}
}

async function runNodeSuite(): Promise<void> {
	const { test, before, after } = await import("node:test");
	const owned = fs.mkdtempSync(path.join(os.tmpdir(), "pkg-defaults-"));
	// Owned build output per file: parallel test files never rebuild or delete a shared tree (EPERM race).
	const pkg = path.join(owned, "generated");
	const copy = path.join(owned, "package");
	const emptyProfile = path.join(owned, "profile-empty");
	before(() => {
		const build = spawnSync("node", [path.join(repo, "scripts", "build-pi-package.mjs")], { cwd: repo, encoding: "utf8", timeout: 120_000, windowsHide: true, env: { ...process.env, PI_PACKAGE_OUT: pkg } });
		assert.equal(build.status, 0, build.stdout + build.stderr);
		fs.mkdirSync(emptyProfile, { recursive: true });
		fs.cpSync(pkg, copy, { recursive: true });
	});
	after(() => fs.rmSync(owned, { recursive: true, force: true }));

	test("defaults list exactly the 18 generic roles in baseline order and no RFID-specialized role", () => {
		const roles = JSON.parse(fs.readFileSync(path.join(pkg, "defaults", "roles.json"), "utf8"));
		assert.deepEqual(roles.map((r: { name: string }) => r.name), JSON.parse(headBytes("agent/roles.json").toString("utf8")).map((r: { name: string }) => r.name).filter((n: string) => GENERIC.includes(n)));
		assert.deepEqual([...roles.map((r: { name: string }) => r.name)].sort(), [...GENERIC].sort());
		for (const name of EXCLUDED) assert.equal(fs.existsSync(path.join(pkg, "defaults", "agents", `${name}.md`)), false, name);
	});

	test("defaults registry entries equal the pinned HEAD baseline, not the working overrides", () => {
		const headRoles = JSON.parse(headBytes("agent/roles.json").toString("utf8"));
		const packaged = JSON.parse(fs.readFileSync(path.join(pkg, "defaults", "roles.json"), "utf8"));
		for (const entry of packaged) assert.deepEqual(entry, headRoles.find((r: { name: string }) => r.name === entry.name), entry.name);
		const oracle = packaged.find((r: { name: string }) => r.name === "oracle");
		assert.equal(oracle.fallbackModel, "github-copilot/claude-opus-5.5");
	});

	test("default agent bodies are byte-identical to the pinned HEAD baseline", () => {
		for (const name of GENERIC) assert.deepEqual(fs.readFileSync(path.join(pkg, "defaults", "agents", `${name}.md`)), headBytes(`agent/agents/${name}.md`), name);
		assert.deepEqual(fs.readdirSync(path.join(pkg, "defaults", "agents")).sort(), GENERIC.map((n) => `${n}.md`).sort());
	});

	test("baseline record names the pinned commit and the roles.json digest", () => {
		const record = JSON.parse(fs.readFileSync(path.join(pkg, "defaults", "baseline.json"), "utf8"));
		assert.equal(record.commit, BASELINE);
		assert.equal(record.roles_sha256, createHash("sha256").update(headBytes("agent/roles.json")).digest("hex"));
	});

	test("packaged discovery exposes the 18 defaults under the package tier", () => {
		const found = discover(path.join(copy, "extensions", "subagent", "agents.ts"), owned, emptyProfile, "user");
		assert.deepEqual(found.map((a) => a.name).sort(), [...GENERIC].sort());
		assert.ok(found.every((a) => a.source === "package"), JSON.stringify(found.map((a) => a.source)));
		const general = found.find((a) => a.name === "general-worker");
		assert.deepEqual(general?.tools, ["read", "grep", "find", "ls", "bash", "powershell", "edit"]);
		assert.equal(general?.model, "anthropic/claude-haiku-5-5");
	});

	test("project scope never shows package defaults", () => {
		assert.deepEqual(discover(path.join(copy, "extensions", "subagent", "agents.ts"), owned, emptyProfile, "project"), []);
	});

	test("a user agent with the same name wins over the package default", () => {
		const profile = path.join(owned, "profile-override");
		fs.mkdirSync(path.join(profile, "agents"), { recursive: true });
		fs.writeFileSync(path.join(profile, "agents", "general-worker.md"), "---\nname: general-worker\ndescription: user override\ntools: read\n---\nbody\n");
		const found = discover(path.join(copy, "extensions", "subagent", "agents.ts"), owned, profile, "user");
		assert.equal(found.length, GENERIC.length);
		const general = found.find((a) => a.name === "general-worker");
		assert.equal(general?.source, "user");
		assert.deepEqual(general?.tools, ["read"]);
	});

	test("user roles.json overlays a default field-wise and keeps unset defaults", () => {
		const profile = path.join(owned, "profile-overlay");
		fs.mkdirSync(profile, { recursive: true });
		fs.writeFileSync(path.join(profile, "roles.json"), JSON.stringify([{ name: "scout", provider: "openai-codex", model: "gpt-6-luna", thinking: "high" }]));
		const scout = discover(path.join(copy, "extensions", "subagent", "agents.ts"), owned, profile, "user").find((a) => a.name === "scout");
		assert.equal(scout?.model, "openai-codex/gpt-6-luna");
		assert.equal(scout?.thinking, "high");
		assert.deepEqual(scout?.fallbackModel, ["openai-codex/gpt-6-luna", "github-copilot/gpt-6-luna"]);
	});

	test("live layout discovers no package tier from the profile-only agents directory", () => {
		const found = discover(path.join(repo, "agent", "extensions", "subagent", "agents.ts"), owned, emptyProfile, "user");
		assert.deepEqual(found, []);
	});

	// Fail-closed package mode (RED first): a broken package baseline or user registry is an error result, never a silent fallback.
	const mutant = (label: string, mutate: (dir: string) => void): string => {
		const dir = path.join(owned, label);
		fs.cpSync(pkg, dir, { recursive: true });
		mutate(dir);
		return dir;
	};
	const malformedProfile = (label: string, text: string): string => {
		const profile = path.join(owned, label);
		fs.mkdirSync(path.join(profile, "agents"), { recursive: true });
		fs.writeFileSync(path.join(profile, "roles.json"), text);
		return profile;
	};
	// Anthropic launches need the subscription connector file present; a probe stub inside the owned profile only.
	const withConnector = (profile: string): string => {
		const connector = path.join(profile, "npm", "node_modules", "pi-claude-subscription-connector", "extensions");
		fs.mkdirSync(connector, { recursive: true });
		fs.writeFileSync(path.join(connector, "subscription-guard.ts"), "export {};\n");
		return profile;
	};

	test("missing packaged roles.json is a discovery error and offers no package tier", () => {
		const dir = mutant("no-defaults-roles", (d) => fs.rmSync(path.join(d, "defaults", "roles.json")));
		const found = discoverRaw(path.join(dir, "extensions", "subagent", "agents.ts"), owned, emptyProfile, "user");
		assert.match(found.error ?? "", /package defaults roles\.json/);
		assert.deepEqual(found.agents, []);
	});

	test("missing packaged agents directory is a discovery error", () => {
		const dir = mutant("no-defaults-agents", (d) => fs.rmSync(path.join(d, "defaults", "agents"), { recursive: true }));
		const found = discoverRaw(path.join(dir, "extensions", "subagent", "agents.ts"), owned, emptyProfile, "user");
		assert.match(found.error ?? "", /package defaults agents/);
		assert.deepEqual(found.agents, []);
	});

	test("malformed packaged roles.json is a discovery error", () => {
		const dir = mutant("bad-defaults-roles", (d) => fs.writeFileSync(path.join(d, "defaults", "roles.json"), "{"));
		const found = discoverRaw(path.join(dir, "extensions", "subagent", "agents.ts"), owned, emptyProfile, "user");
		assert.match(found.error ?? "", /package defaults roles\.json/);
		assert.deepEqual(found.agents, []);
	});

	test("malformed user roles.json in package mode is a discovery error, never a silent reset", () => {
		const profile = malformedProfile("profile-malformed", '[{"name":"oracle"');
		const found = discoverRaw(path.join(copy, "extensions", "subagent", "agents.ts"), owned, profile, "user");
		assert.match(found.error ?? "", /user roles\.json/);
		assert.deepEqual(found.agents, []);
	});

	test("user roles.json that is not a JSON list is a discovery error in package mode", () => {
		const profile = malformedProfile("profile-object", '{"name":"scout"}');
		const found = discoverRaw(path.join(copy, "extensions", "subagent", "agents.ts"), owned, profile, "user");
		assert.match(found.error ?? "", /must be a JSON list/);
		assert.deepEqual(found.agents, []);
	});

	test("fresh profile without roles.json is silent and keeps all 18 defaults", () => {
		const found = discoverRaw(path.join(copy, "extensions", "subagent", "agents.ts"), owned, emptyProfile, "user");
		assert.equal(found.error, null);
		assert.equal(found.agents.length, GENERIC.length);
	});

	test("live layout: malformed user roles.json stays silent and frontmatter tools stand (baseline)", () => {
		const profile = malformedProfile("profile-live-malformed", '[{"name":"general-worker"');
		fs.writeFileSync(path.join(profile, "agents", "general-worker.md"), "---\nname: general-worker\ndescription: live\ntools: read\n---\nbody\n");
		const found = discoverRaw(path.join(repo, "agent", "extensions", "subagent", "agents.ts"), owned, profile, "user");
		assert.equal(found.error, null);
		assert.deepEqual(found.agents.find((a) => a.name === "general-worker")?.tools, ["read"]);
	});

	test("dispatch with a malformed user roles.json returns an error result and launches no child", () => {
		const profile = withConnector(malformedProfile("profile-dispatch-malformed", '[{"name":"oracle"'));
		const r = dispatchProbe(path.join(copy, "extensions", "subagent", "index.ts"), owned, profile);
		assert.equal(r.isError, true, r.text);
		assert.match(r.text, /user roles\.json/);
		assert.equal(r.spawned, 0);
	});

	test("dispatch with missing packaged roles.json returns an error result and launches no child", () => {
		const dir = mutant("dispatch-no-defaults", (d) => fs.rmSync(path.join(d, "defaults", "roles.json")));
		const guarded = withConnector(path.join(owned, "profile-guard-no-defaults"));
		const r = dispatchProbe(path.join(dir, "extensions", "subagent", "index.ts"), owned, guarded);
		assert.equal(r.isError, true, r.text);
		assert.match(r.text, /package defaults roles\.json/);
		assert.equal(r.spawned, 0);
	});

	test("control: a valid package profile dispatch reaches the launcher", () => {
		// Anthropic launches need the subscription connector file present; this is a probe stub inside the owned profile only.
		const r = dispatchProbe(path.join(copy, "extensions", "subagent", "index.ts"), owned, withConnector(path.join(owned, "profile-guarded")));
		assert.ok(r.spawned >= 1, r.text);
	});

	test("roles editor refuses a user override when the packaged roles.json baseline is missing", () => {
		const profile = malformedProfile("profile-editor-override", JSON.stringify([{ name: "scout", provider: "openai-codex", model: "gpt-6-luna", fallbackModel: "", thinking: "low" }], null, 2) + "\n");
		fs.writeFileSync(path.join(profile, "agents", "scout.md"), "---\nname: scout\ndescription: s\nmodel: openai-codex/gpt-6-luna\nfallbackModel: \"\"\nthinking: low\ntools: read\n---\nbody\n");
		const dir = mutant("editor-no-defaults-roles", (d) => fs.rmSync(path.join(d, "defaults", "roles.json")));
		const snap = editorProbe(profile, "scout", dir);
		assert.equal(snap.ok, false);
		assert.match(snap.error ?? "", /baseline|defaults/);
	});

	test("roles editor refuses a packaged role when the packaged agents directory is missing", () => {
		const dir = mutant("editor-no-defaults-agents", (d) => fs.rmSync(path.join(d, "defaults", "agents"), { recursive: true }));
		const snap = editorProbe(emptyProfile, "general-worker", dir);
		assert.equal(snap.ok, false);
		assert.match(snap.error ?? "", /baseline|defaults/);
	});

	test("control: roles editor reads the valid packaged baseline", () => {
		const snap = editorProbe(emptyProfile, "general-worker", copy);
		assert.deepEqual(snap, { ok: true, primary: "anthropic/claude-haiku-5-5" });
	});

	// Entry-level strictness (RED first): in package mode a bad user entry fails closed; it is never skipped while the rest loads.
	const badEntries: Array<[string, string]> = [
		["capitalised Name key", '[{"Name":"debugger","provider":"openai-codex","model":"gpt-6-luna"}]'],
		["non-string model", '[{"name":"scout","provider":"openai-codex","model":5}]'],
		["array entry", '[["reviewer"]]'],
		["typo key modle", '[{"name":"scout","modle":"gpt-6-luna"}]'],
		["non-string tools", '[{"name":"scout","tools":5}]'],
		["empty name", '[{"name":"","model":"x"}]'],
		["duplicate names", '[{"name":"scout","thinking":"low"},{"name":"scout","thinking":"high"}]'],
	];
	for (const [label, text] of badEntries) {
		test(`user roles.json entry with ${label} is a package discovery error`, () => {
			const profile = malformedProfile(`profile-entry-${label.replace(/\W+/g, "-")}`, text);
			const found = discoverRaw(path.join(copy, "extensions", "subagent", "agents.ts"), owned, profile, "user");
			assert.match(found.error ?? "", /user roles\.json/);
			assert.deepEqual(found.agents, []);
		});
	}

	test("valid partial user override (tools only) keeps every other default field", () => {
		const profile = malformedProfile("profile-partial", '[{"name":"scout","tools":["read","grep"]}]');
		const found = discoverRaw(path.join(copy, "extensions", "subagent", "agents.ts"), owned, profile, "user");
		assert.equal(found.error, null);
		const scout = found.agents.find((a) => a.name === "scout");
		const base = JSON.parse(headBytes("agent/roles.json").toString("utf8")).find((r: { name: string }) => r.name === "scout");
		assert.deepEqual(scout?.tools, ["read", "grep"]);
		assert.equal(scout?.model, `${base.provider}/${base.model}`);
	});

	test("live layout: a malformed roles.json entry stays silent (baseline)", () => {
		const profile = malformedProfile("profile-live-entry", '[{"Name":"general-worker","tools":5}]');
		fs.writeFileSync(path.join(profile, "agents", "general-worker.md"), "---\nname: general-worker\ndescription: live\ntools: read\n---\nbody\n");
		const found = discoverRaw(path.join(repo, "agent", "extensions", "subagent", "agents.ts"), owned, profile, "user");
		assert.equal(found.error, null);
		assert.deepEqual(found.agents.find((a) => a.name === "general-worker")?.tools, ["read"]);
	});

	test("package defaults roles.json with a duplicate name is a discovery error", () => {
		const dir = mutant("defaults-dup-role", (d) => {
			const roles = JSON.parse(fs.readFileSync(path.join(d, "defaults", "roles.json"), "utf8"));
			fs.writeFileSync(path.join(d, "defaults", "roles.json"), JSON.stringify([...roles, roles[0]], null, 2) + "\n");
		});
		const found = discoverRaw(path.join(dir, "extensions", "subagent", "agents.ts"), owned, emptyProfile, "user");
		assert.match(found.error ?? "", /package defaults roles\.json.*duplicate/);
		assert.deepEqual(found.agents, []);
	});

	// Corrupt package shape (RED first): a package-shaped tree with a missing manifest or a damaged defaults set must refuse, not look like the live layout.
	test("missing package manifest beside packaged defaults is a discovery error", () => {
		const dir = mutant("no-manifest", (d) => fs.rmSync(path.join(d, "package.json")));
		const found = discoverRaw(path.join(dir, "extensions", "subagent", "agents.ts"), owned, emptyProfile, "user");
		assert.match(found.error ?? "", /package manifest/);
		assert.deepEqual(found.agents, []);
	});

	test("missing manifest with no packaged defaults is the unchanged live layout", () => {
		const dir = path.join(owned, "live-shape");
		fs.cpSync(path.join(repo, "agent", "extensions", "subagent"), path.join(dir, "extensions", "subagent"), { recursive: true });
		const found = discoverRaw(path.join(dir, "extensions", "subagent", "agents.ts"), owned, emptyProfile, "user");
		assert.equal(found.error, null);
		assert.deepEqual(found.agents, []);
	});

	test("a renamed package bundle is accepted inert: no package tier and no error", () => {
		const dir = mutant("renamed", (d) => {
			const manifest = JSON.parse(fs.readFileSync(path.join(d, "package.json"), "utf8"));
			fs.writeFileSync(path.join(d, "package.json"), JSON.stringify({ ...manifest, name: "x-renamed-harness" }, null, 2) + "\n");
		});
		const found = discoverRaw(path.join(dir, "extensions", "subagent", "agents.ts"), owned, emptyProfile, "user");
		assert.equal(found.error, null);
		assert.deepEqual(found.agents, []);
	});

	test("package defaults with every agent file removed is a discovery error", () => {
		const dir = mutant("defaults-emptied", (d) => {
			for (const f of fs.readdirSync(path.join(d, "defaults", "agents"))) fs.rmSync(path.join(d, "defaults", "agents", f));
		});
		const found = discoverRaw(path.join(dir, "extensions", "subagent", "agents.ts"), owned, emptyProfile, "user");
		assert.match(found.error ?? "", /disagree/);
		assert.deepEqual(found.agents, []);
	});

	test("package defaults with one agent file deleted is a discovery error", () => {
		const dir = mutant("defaults-one-missing", (d) => fs.rmSync(path.join(d, "defaults", "agents", "reviewer.md")));
		const found = discoverRaw(path.join(dir, "extensions", "subagent", "agents.ts"), owned, emptyProfile, "user");
		assert.match(found.error ?? "", /disagree/);
		assert.deepEqual(found.agents, []);
	});

	test("package defaults with one agent file garbled is a discovery error", () => {
		const dir = mutant("defaults-one-garbled", (d) => fs.writeFileSync(path.join(d, "defaults", "agents", "reviewer.md"), "no frontmatter here\n"));
		const found = discoverRaw(path.join(dir, "extensions", "subagent", "agents.ts"), owned, emptyProfile, "user");
		assert.match(found.error ?? "", /disagree/);
		assert.deepEqual(found.agents, []);
	});

	test("package defaults roles.json [] is a discovery error", () => {
		const dir = mutant("defaults-roles-empty", (d) => fs.writeFileSync(path.join(d, "defaults", "roles.json"), "[]\n"));
		const found = discoverRaw(path.join(dir, "extensions", "subagent", "agents.ts"), owned, emptyProfile, "user");
		assert.match(found.error ?? "", /package defaults roles\.json/);
		assert.deepEqual(found.agents, []);
	});

	test("dispatch with a missing package manifest returns an error result and launches no child", () => {
		const dir = mutant("dispatch-no-manifest", (d) => fs.rmSync(path.join(d, "package.json")));
		const r = dispatchProbe(path.join(dir, "extensions", "subagent", "index.ts"), owned, withConnector(path.join(owned, "profile-dispatch-no-manifest")));
		assert.equal(r.isError, true, r.text);
		assert.match(r.text, /package manifest/);
		assert.equal(r.spawned, 0);
	});

	test("roles editor refuses a user roles.json entry with an unknown key", () => {
		const profile = malformedProfile("profile-editor-unknown-key", JSON.stringify([{ name: "scout", provider: "openai-codex", model: "gpt-6-luna", fallbackModel: "", thinking: "low", modle: "typo" }], null, 2) + "\n");
		const snap = editorProbe(profile, "scout", copy);
		assert.equal(snap.ok, false);
		assert.match(snap.error ?? "", /unknown key/);
	});
}
