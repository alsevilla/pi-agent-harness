// /subagent roles editor regression. Bun cannot resolve Pi packages from this directory, so under Bun this file launches the
// same body under the installed Node with registerHooks mapping bare Pi specifiers to the installed builds (monitor-scrollbar pattern).
// Every fixture lives in an owned os.tmpdir() root; the real profile is never the write target.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const isBun = typeof (process.versions as Record<string, string>).bun === "string";

if (isBun) {
	const { test } = await import("bun:test");
	test("roles editor suite passes under Node native TypeScript transform", () => {
		const env = { ...process.env };
		delete env.NODE_TEST_CONTEXT;
		const run = spawnSync("node", ["--experimental-transform-types", "--test", thisFile], { encoding: "utf8", timeout: 240_000, windowsHide: true, env });
		assert.equal(run.status, 0, run.stdout + run.stderr);
	}, 260_000);
} else {
	await runNodeSuite();
}

async function runNodeSuite(): Promise<void> {
	const { test, afterEach } = await import("node:test");
	const { registerHooks } = await import("node:module");
	const installed = (rel: string) => fileURLToPath(new URL(`../../../install/releases/1.1.0/node_modules/@earendil-works/${rel}`, import.meta.url));
	const installedUrl = (rel: string) => pathToFileURL(installed(rel)).href;
	registerHooks({
		resolve(specifier: string, context: object, nextResolve: (s: string, c: object) => { url: string }) {
			if (specifier === "@earendil-works/pi-coding-agent") return { url: installedUrl("pi-coding-agent/dist/index.js"), shortCircuit: true };
			if (specifier === "@earendil-works/pi-ai") return { url: installedUrl("pi-ai/dist/index.js"), shortCircuit: true };
			if (specifier === "@earendil-works/pi-tui") return { url: installedUrl("pi-tui/dist/index.js"), shortCircuit: true };
			return nextResolve(specifier, context);
		},
	} as never);
	const editor: any = await import(new URL("../roles-editor.ts", import.meta.url).href);
	const agents: any = await import(new URL("../agents.ts", import.meta.url).href);
	const piAi: any = await import(installedUrl("pi-ai/dist/index.js"));
	const piAgent: any = await import(installedUrl("pi-coding-agent/dist/index.js"));
	const piTui: any = await import(installedUrl("pi-tui/dist/index.js"));
	const themeModule: any = await import(installedUrl("pi-coding-agent/dist/modes/interactive/theme/theme.js"));
	themeModule.initTheme("dark", false);
	const stubTheme = themeModule.getThemeByName("dark");
	const stubTui = { requestRender() {} };

	// Built-in catalog through the approved public compat factories (1563 distinct provider/id pairs at this install).
	const compat: any = await import(installedUrl("pi-ai/dist/compat.js"));
	const CATALOG: any[] = compat.getProviders().flatMap((p: string) => compat.getModels(p));
	// Offline resolver proof (probe 2026-07): exactly this offered ref resolves to a different id, so the picker must exclude it.
	const UNRESOLVABLE = new Set(["openrouter/openrouter/auto"]);
	const AUTHED = new Set(["anthropic", "openai-codex", "baseten", "amazon-bedrock"]);
	const registry = () => ({
		getAll: () => CATALOG,
		find: (provider: string, id: string) => CATALOG.find((m) => m.provider === provider && m.id === id),
		hasConfiguredAuth: (model: { provider: string }) => AUTHED.has(model.provider),
	});
	const PLAIN = CATALOG.find((m) => m.reasoning !== true && /^[A-Za-z0-9._-]+$/.test(m.id));
	const PLAIN_REF = `${PLAIN.provider}/${PLAIN.id}`;
	const SLASH_REF = "baseten/deepseek-ai/DeepSeek-V4-Pro";
	// Verified non-slash models of providers this fixture does not connect (levels: off).
	const [DISCONNECTED_REF, DISCONNECTED_REF_2] = CATALOG.filter((m) => !AUTHED.has(m.provider) && !m.id.includes("/") && m.reasoning !== true).map((m) => `${m.provider}/${m.id}`);

	const formatJson = (data: unknown, eol: string) => JSON.stringify(data, null, 2).replace(/\n/g, eol) + eol;
	const effectiveRef = (role: { provider: string; model: string }) => (role.model.includes("/") ? role.model : `${role.provider}/${role.model}`);
	const yamlValue = (value: string) => (value === "" ? '""' : value);
	function roleMd(role: { name: string; provider: string; model: string; fallbackModel: string; thinking: string; tools: string }, eol: string): string {
		return ["---", `name: ${role.name}`, `description: ${role.name} test role`, `tools: ${role.tools}`, `model: ${effectiveRef(role)}`, `fallbackModel: ${yamlValue(role.fallbackModel)}`, `thinking: ${role.thinking}`, "---", `Body for ${role.name}.`, "", "Second paragraph.", ""].join(eol);
	}
	const DEFAULT_ROLES = [
		{ name: "alpha", provider: "anthropic", model: "claude-haiku-5-5", fallbackModel: "openai-codex/gpt-6-luna || github-copilot/gpt-6-luna", thinking: "medium", tools: "read, grep, find, ls, bash, powershell" },
		{ name: "beta", provider: "openai-codex", model: "gpt-6-luna", fallbackModel: "", thinking: "low", tools: "read, grep" },
		{ name: "legacy", provider: "anthropic", model: "not-in-catalog-model", fallbackModel: "github-copilot/gpt-6-luna", thinking: "xhigh", tools: "read" },
		{ name: "plain", provider: PLAIN.provider, model: PLAIN.id, fallbackModel: "", thinking: "medium", tools: "read" },
	];

	const dirs: string[] = [];
	const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
	afterEach(() => {
		if (originalAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = originalAgentDir;
		for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
	});

	function newFixture(opts: { crlf?: boolean; roles?: any[]; md?: Record<string, string>; registryText?: string } = {}) {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "roles-editor-"));
		dirs.push(dir);
		const eol = opts.crlf ? "\r\n" : "\n";
		const roles = opts.roles ?? DEFAULT_ROLES;
		fs.writeFileSync(path.join(dir, "roles.json"), opts.registryText ?? formatJson(roles, eol));
		fs.mkdirSync(path.join(dir, "agents"));
		for (const role of roles) fs.writeFileSync(path.join(dir, "agents", `${role.name}.md`), opts.md?.[role.name] ?? roleMd(role, eol));
		process.env.PI_CODING_AGENT_DIR = dir;
		return { dir, eol, registryPath: path.join(dir, "roles.json"), agentPath: (name: string) => path.join(dir, "agents", `${name}.md`) };
	}
	function snapshotDir(dir: string): Record<string, string> {
		const out: Record<string, string> = {};
		const walk = (current: string) => {
			for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
				const full = path.join(current, entry.name);
				if (entry.isDirectory()) walk(full);
				else out[path.relative(dir, full)] = fs.readFileSync(full).toString("base64");
			}
		};
		walk(dir);
		return out;
	}
	const choose = (prefix: string) => (_title: string, options: string[]) => {
		const hit = options.find((o) => o === prefix) ?? options.find((o) => o.startsWith(prefix));
		if (hit === undefined) throw new Error(`no option starting with ${prefix}: ${options.slice(0, 5).join(" | ")}`);
		return hit;
	};
	// Scripted native dialogs: each step is a literal answer (undefined = cancel) or a function of (title, options).
	function fakeCtx(steps: unknown[], hasUI = true, opts: { custom?: boolean; mode?: string } = {}) {
		const queue = [...steps];
		const dialogs: Array<{ kind: string; title: string; options?: unknown; body?: unknown }> = [];
		const notes: Array<{ message: string; type?: string }> = [];
		const answer = (kind: string, title: string, options?: unknown, body?: unknown) => {
			dialogs.push({ kind, title, options, body });
			if (queue.length === 0) throw new Error(`unexpected ${kind} dialog: ${title}`);
			const step = queue.shift();
			return typeof step === "function" ? step(title, options) : step;
		};
		// Real searchable picker: the factory's component is driven by keys; its title/options are the dialog's.
		const driveCustom = async (factory: (tui: unknown, theme: unknown, keys: unknown, done: (r: unknown) => void) => any) => {
			let settled = false;
			let value: unknown;
			const picker = factory(stubTui, stubTheme, piTui.getKeybindings(), (r: unknown) => {
				settled = true;
				value = r;
			});
			const expected = answer("custom", picker.title, picker.options, picker.body);
			drivePicker(picker, expected as string | undefined);
			assert.ok(settled, "picker closed without a result");
			assert.equal(value, expected, "picker returned a value other than the chosen label");
			return value;
		};
		const ctx = {
			hasUI,
			mode: opts.mode ?? (hasUI ? "tui" : "print"),
			cwd: os.tmpdir(),
			modelRegistry: registry(),
			ui: {
				select: async (title: string, options: string[]) => answer("select", title, options),
				confirm: async (title: string, message: string) => answer("confirm", title, message),
				input: async (title: string) => answer("input", title),
				notify: (message: string, type?: string) => notes.push({ message, type }),
				...(opts.custom ? { custom: driveCustom } : {}),
			},
		};
		return { ctx, dialogs, notes };
	}
	// alpha: primary -> slash-ID model, fallbacks [openai-codex/gpt-6-luna, github-copilot/gpt-6-luna] -> add anthropic/claude-haiku-5-5, move it up, thinking high, save.
	const SCENARIO = (finalStep: unknown = true) => [
		"alpha",
		choose(SLASH_REF),
		choose("Add fallback"),
		choose("anthropic/claude-haiku-5-5"),
		choose("Move fallback up"),
		choose("3. anthropic/claude-haiku-5-5"),
		choose("Done"),
		choose("high"),
		finalStep,
	];
	const SAVE = choose("Save role");
	const CANCEL = choose("Cancel");
	const ESCAPE = () => undefined;
	const SCENARIO_FALLBACKS = "openai-codex/gpt-6-luna || anthropic/claude-haiku-5-5 || github-copilot/gpt-6-luna";

	test("installed resolver maps every offered provider/id ref (incl. slash IDs) back to its own catalog model (offline proof)", () => {
		// Baseline provider set: with baseten configured, the ref moonshotai/kimi-k2.6 resolves to baseten's slash-ID model (verification excludes it in catalogFromRegistry).
		const stub = { getModels: () => CATALOG, hasConfiguredAuth: (p: string) => ["anthropic", "openai-codex"].includes(p) };
		const seen = new Set<string>();
		const mismatched: string[] = [];
		let slashRefs = 0;
		for (const m of CATALOG) {
			const ref = `${m.provider}/${m.id}`;
			if (seen.has(ref)) continue;
			seen.add(ref);
			if (m.id.includes("/")) slashRefs++;
			const resolved = piAgent.resolveCliModel({ cliModel: ref, modelRuntime: stub }).model;
			if (!resolved || resolved.provider !== m.provider || resolved.id !== m.id) mismatched.push(ref);
		}
		assert.deepEqual(mismatched, [...UNRESOLVABLE]);
		assert.ok(slashRefs > 800, `expected the built-in slash-ID set, got ${slashRefs}`);
	});

	test("catalog choices are unique provider/id refs of connected providers only, each resolver-verified", () => {
		const choices = editor.catalogFromRegistry(registry()).models();
		const refs = choices.map((m: any) => `${m.provider}/${m.id}`);
		assert.equal(new Set(refs).size, refs.length, "duplicate refs offered");
		assert.equal(refs.length, new Set(CATALOG.filter((m) => AUTHED.has(m.provider)).map((m) => `${m.provider}/${m.id}`)).size, "every verified ref of a connected provider, nothing else");
		assert.ok(!refs.some((r: string) => UNRESOLVABLE.has(r)), "unresolvable ref must not be offered");
		assert.ok(refs.every((r: string) => AUTHED.has(r.split("/")[0])), "disconnected provider offered");
		assert.ok(!refs.includes(DISCONNECTED_REF), "disconnected ref offered as a choice");
	});

	test("loader formula keeps short model fields for plain IDs and full refs for slash IDs", () => {
		assert.equal(editor.roleModelField("baseten", "deepseek-ai/DeepSeek-V4-Pro"), SLASH_REF);
		assert.equal(editor.roleModelField("anthropic", "claude-haiku-5-5"), "claude-haiku-5-5");
		assert.equal(editor.effectiveModelRef({ provider: "baseten", model: SLASH_REF }), SLASH_REF);
		assert.equal(editor.effectiveModelRef({ provider: "anthropic", model: "claude-haiku-5-5" }), "anthropic/claude-haiku-5-5");
	});

	test("PLAIN thinking support comes from the installed pi-ai (non-reasoning model offers only off)", () => {
		assert.deepEqual(piAi.getSupportedThinkingLevels(PLAIN), ["off"]);
	});

	test("no UI: refuses before any dialog or file read/write", async () => {
		const fx = newFixture();
		const before = snapshotDir(fx.dir);
		const run = fakeCtx([], false);
		await editor.editRoleConfig(run.ctx);
		assert.equal(run.dialogs.length, 0);
		assert.equal(run.notes.length, 1);
		assert.equal(run.notes[0].type, "warning");
		assert.deepEqual(snapshotDir(fx.dir), before);
	});

	test("full successful edit: slash-ID primary, ordered fallbacks, explicit thinking; only four registry fields and three md lines change", async () => {
		const fx = newFixture({ crlf: true });
		const run = fakeCtx(SCENARIO());
		await editor.editRoleConfig(run.ctx);
		assert.equal(run.dialogs.length, SCENARIO().length, "every scripted dialog consumed");
		const expectedRoles = DEFAULT_ROLES.map((r) => (r.name !== "alpha" ? r : { ...r, provider: "baseten", model: SLASH_REF, fallbackModel: SCENARIO_FALLBACKS, thinking: "high" }));
		assert.equal(fs.readFileSync(fx.registryPath, "utf8"), formatJson(expectedRoles, fx.eol));
		assert.equal(fs.readFileSync(fx.agentPath("alpha"), "utf8"), roleMd({ ...DEFAULT_ROLES[0], provider: "baseten", model: SLASH_REF, fallbackModel: SCENARIO_FALLBACKS, thinking: "high" }, fx.eol));
		for (const name of ["beta", "legacy", "plain"]) assert.equal(fs.readFileSync(fx.agentPath(name), "utf8"), roleMd(DEFAULT_ROLES.find((r) => r.name === name)!, fx.eol));
		assert.ok(run.notes.some((n) => n.type === "info" && /saved/i.test(n.message)), JSON.stringify(run.notes));
	});

	test("LF fixture keeps LF bytes and the Body paragraphs verbatim", async () => {
		const fx = newFixture({ crlf: false });
		await editor.editRoleConfig(fakeCtx(SCENARIO()).ctx);
		const text = fs.readFileSync(fx.agentPath("alpha"), "utf8");
		assert.ok(!text.includes("\r\n"));
		assert.ok(text.endsWith("Body for alpha.\n\nSecond paragraph.\n"));
	});

	test("every dialog cancelled in turn leaves all role files byte-identical and stops the flow", async () => {
		const steps = SCENARIO();
		for (let k = 0; k < steps.length; k++) {
			const fx = newFixture({ crlf: k % 2 === 1 });
			const before = snapshotDir(fx.dir);
			const run = fakeCtx(steps.map((s, i) => (i === k ? undefined : s)));
			await editor.editRoleConfig(run.ctx);
			assert.equal(run.dialogs.length, k + 1, `flow stops at cancelled dialog ${k}`);
			assert.deepEqual(snapshotDir(fx.dir), before, `cancel at ${k}`);
		}
	});

	test("declining the final confirm (false or undefined) saves nothing", async () => {
		for (const answer of [false, undefined]) {
			const fx = newFixture();
			const before = snapshotDir(fx.dir);
			const steps = SCENARIO();
			steps[steps.length - 1] = answer;
			await editor.editRoleConfig(fakeCtx(steps).ctx);
			assert.deepEqual(snapshotDir(fx.dir), before);
		}
	});

	test("fallback add excludes the primary and existing fallbacks; primary change drops an equal fallback", async () => {
		const fx = newFixture();
		const steps = SCENARIO();
		steps[3] = (_t: string, opts: string[]) => {
			// Exact matches: installed ids such as baseten/deepseek-ai/DeepSeek-V4-Pro-0813 legitimately share a prefix.
			assert.ok(!opts.includes(SLASH_REF), "primary offered as fallback");
			assert.ok(!opts.includes("openai-codex/gpt-6-luna"), "existing fallback offered again");
			return "anthropic/claude-haiku-5-5";
		};
		await editor.editRoleConfig(fakeCtx(steps).ctx);
		const roles = JSON.parse(fs.readFileSync(fx.registryPath, "utf8"));
		assert.equal(roles[0].model, SLASH_REF);
	});

	test("primary choices are connected models only; a declared out-of-catalog primary stays an exact labelled current choice", async () => {
		const fx = newFixture();
		let seen: string[] = [];
		const steps = ["legacy", (_t: string, opts: string[]) => { seen = opts; return undefined; }];
		await editor.editRoleConfig(fakeCtx(steps).ctx);
		assert.equal(seen[0], "Current anthropic/not-in-catalog-model (not in installed catalog)", "declared missing primary kept and labelled");
		assert.ok(seen.slice(1).every((o) => AUTHED.has(o.split("/")[0])), "a disconnected provider was offered as a primary");
		assert.deepEqual(fs.readFileSync(fx.registryPath, "utf8"), formatJson(DEFAULT_ROLES, fx.eol));
	});

	test("thinking choices are exactly the installed supported levels of the new primary; no silent clamp", async () => {
		const fx = newFixture();
		let offered: string[] = [];
		const steps = ["alpha", choose(PLAIN_REF), "Done", (_t: string, opts: string[]) => { offered = opts; return "off"; }, true];
		await editor.editRoleConfig(fakeCtx(steps).ctx);
		assert.deepEqual(offered, piAi.getSupportedThinkingLevels(PLAIN));
		const roles = JSON.parse(fs.readFileSync(fx.registryPath, "utf8"));
		assert.equal(roles[0].thinking, "off");
		assert.equal(roles[0].model, PLAIN.id);
	});

	test("planning refuses an unsupported thinking level for a changed primary (explicit choice, no clamp)", () => {
		const fx = newFixture();
		const snap = editor.readRoleSnapshot(fx.dir, "alpha");
		assert.throws(() => editor.planRoleChange(snap, { primary: PLAIN_REF, fallbacks: [], thinking: "high" }, editor.catalogFromRegistry(registry())), (e: Error) => /thinking/.test(e.message));
	});

	test("unchanged legacy thinking the primary no longer supports is kept, with a warning", () => {
		const fx = newFixture();
		const snap = editor.readRoleSnapshot(fx.dir, "plain");
		const plan = editor.planRoleChange(snap, { primary: PLAIN_REF, fallbacks: [], thinking: "medium" }, editor.catalogFromRegistry(registry()));
		assert.equal(plan.changed, false);
		assert.ok(plan.warnings.some((w: string) => /medium/.test(w) && /support/.test(w)), JSON.stringify(plan.warnings));
	});

	test("out-of-catalog declared model is retained unchanged and warned, never dropped", () => {
		const fx = newFixture();
		const snap = editor.readRoleSnapshot(fx.dir, "legacy");
		const plan = editor.planRoleChange(snap, { ...snap.current }, editor.catalogFromRegistry(registry()));
		assert.equal(plan.changed, false);
		assert.ok(plan.warnings.some((w: string) => /not in installed catalog/.test(w)), JSON.stringify(plan.warnings));
	});

	test("fallback that clamps the chosen thinking, uncredentialed primary, and missing catalog entries produce preview warnings", () => {
		const fx = newFixture();
		const snap = editor.readRoleSnapshot(fx.dir, "alpha");
		const plan = editor.planRoleChange(snap, { primary: "baseten/deepseek-ai/DeepSeek-V4-Pro", fallbacks: [PLAIN_REF, DISCONNECTED_REF, "nope/none"], thinking: "high" }, editor.catalogFromRegistry(registry()));
		assert.equal(plan.changed, true);
		assert.ok(plan.warnings.some((w: string) => w.includes(PLAIN_REF) && /clamp/.test(w)), JSON.stringify(plan.warnings));
		assert.ok(plan.warnings.some((w: string) => /nope\/none.*not in installed catalog/.test(w)), JSON.stringify(plan.warnings));
		assert.ok(plan.warnings.some((w: string) => w.includes(DISCONNECTED_REF) && /no configured credentials/.test(w)), JSON.stringify(plan.warnings));
		assert.match(plan.preview, /alpha/);
		assert.match(plan.preview, /Before: .*claude-haiku-5-5/);
		assert.match(plan.preview, /After: .*DeepSeek-V4-Pro/);
	});

	test("empty fallback list is saved as explicit empty string in both files and parses as []", async () => {
		const fx = newFixture();
		const steps = SCENARIO();
		steps[1] = choose("Current anthropic/claude-haiku-5-5");
		steps[2] = "Remove fallback";
		steps[3] = choose("1. openai-codex/gpt-6-luna");
		steps[4] = "Remove fallback";
		steps[5] = choose("1. github-copilot/gpt-6-luna");
		steps[6] = "Done";
		steps[7] = choose("medium");
		await editor.editRoleConfig(fakeCtx(steps).ctx);
		const roles = JSON.parse(fs.readFileSync(fx.registryPath, "utf8"));
		assert.strictEqual(roles[0].fallbackModel, "");
		assert.match(fs.readFileSync(fx.agentPath("alpha"), "utf8"), /^fallbackModel: ""\r?$/m);
		const loaded = agents.discoverAgents(fx.dir, "user").agents.find((a: any) => a.name === "alpha");
		assert.deepEqual(loaded.fallbackModel, []);
	});

	test("invalid registry and definition data refuse with a thrown RoleEditError and no writes", async () => {
		const cases: Array<[string, () => void, RegExp]> = [
			["malformed roles.json", () => newFixture({ registryText: "[{" }), /roles\.json/],
			["registry not an array", () => newFixture({ registryText: "{}\n" }), /array/],
			["duplicate registry role", () => newFixture({ roles: [DEFAULT_ROLES[0], DEFAULT_ROLES[0]] }), /duplicate/],
			["non-canonical registry formatting", () => newFixture({ registryText: JSON.stringify(DEFAULT_ROLES) + "\n" }), /canonical|formatting/],
			["missing definition file", () => { const fx = newFixture(); fs.rmSync(fx.agentPath("alpha")); }, /definition file/],
			["ambiguous definition file", () => { const fx = newFixture(); fs.writeFileSync(path.join(fx.dir, "agents", "copy.md"), fs.readFileSync(fx.agentPath("alpha"))); }, /ambiguous/],
			["malformed definition frontmatter", () => { const fx = newFixture(); fs.writeFileSync(fx.agentPath("alpha"), "---\nname: alpha\nmodel: [unclosed\n---\nbody\n"); }, /frontmatter/],
			["definition missing fallbackModel line", () => { const fx = newFixture(); fs.writeFileSync(fx.agentPath("alpha"), "---\nname: alpha\ndescription: x\ntools: read\nmodel: anthropic/claude-haiku-5-5\nthinking: medium\n---\nbody\n"); }, /fallbackModel/],
		];
		for (const [label, setup, pattern] of cases) {
			setup();
			const dir = process.env.PI_CODING_AGENT_DIR!;
			const before = snapshotDir(dir);
			assert.throws(() => editor.readRoleSnapshot(dir, "alpha"), (e: Error) => e.name === "RoleEditError" && pattern.test(e.message), label);
			const run = fakeCtx(SCENARIO());
			await editor.editRoleConfig(run.ctx).catch(() => {});
			assert.deepEqual(snapshotDir(dir), before, label);
		}
	});

	test("invalid registry refuses at the picker: notify error and no dialog", async () => {
		const fx = newFixture({ registryText: "[{" });
		const before = snapshotDir(fx.dir);
		const run = fakeCtx([]);
		await editor.editRoleConfig(run.ctx);
		assert.equal(run.dialogs.length, 0);
		assert.equal(run.notes[0].type, "error");
		assert.deepEqual(snapshotDir(fx.dir), before);
	});

	test("linked definition file is refused before writes (symlink target)", (t: any) => {
		const fx = newFixture();
		const outside = path.join(fx.dir, "outside-alpha.md");
		fs.renameSync(fx.agentPath("alpha"), outside);
		try {
			fs.symlinkSync(outside, fx.agentPath("alpha"), "file");
		} catch (error) {
			t.skip(`symlink creation not permitted here: ${(error as Error).message}`);
			return;
		}
		assert.throws(() => editor.readRoleSnapshot(fx.dir, "alpha"), (e: Error) => /link/.test(e.message));
	});

	// Commit and rollback behaviour with injected native rename failures.
	function preparedPlan(fx: ReturnType<typeof newFixture>, name = "alpha") {
		const snap = editor.readRoleSnapshot(fx.dir, name);
		const plan = editor.planRoleChange(snap, { primary: SLASH_REF, fallbacks: [], thinking: "high" }, editor.catalogFromRegistry(registry()));
		return { snap, plan };
	}
	const leftovers = (dir: string) => { const out: string[] = []; const walk = (c: string) => { for (const e of fs.readdirSync(c, { withFileTypes: true })) { const f = path.join(c, e.name); if (e.isDirectory()) walk(f); else if (/\.tmp$|\.rollback|\.recovery/.test(e.name)) out.push(e.name); } }; walk(dir); return out; };

	test("successful commit replaces the definition first and the registry last", () => {
		const fx = newFixture();
		const order: string[] = [];
		const { snap, plan } = preparedPlan(fx);
		const result = editor.commitRolePlan(snap, plan, { rename: (from: string, to: string) => { order.push(path.basename(to)); fs.renameSync(from, to); } });
		assert.equal(result.status, "saved");
		assert.deepEqual(order, ["alpha.md", "roles.json"]);
		assert.deepEqual(leftovers(fx.dir), []);
	});

	test("registry rename failure restores only our definition bytes and cleans owned temps", () => {
		const fx = newFixture();
		const before = snapshotDir(fx.dir);
		const { snap, plan } = preparedPlan(fx);
		const result = editor.commitRolePlan(snap, plan, { rename: (from: string, to: string) => { if (to === fx.registryPath) throw Object.assign(new Error("EPERM injected"), { code: "EPERM" }); fs.renameSync(from, to); } });
		assert.equal(result.status, "failed");
		assert.equal(result.rolledBack, true);
		assert.deepEqual(snapshotDir(fx.dir), before);
		assert.deepEqual(leftovers(fx.dir), []);
	});

	test("intervening external edit to the definition during failure is never overwritten by rollback", () => {
		const fx = newFixture();
		const { snap, plan } = preparedPlan(fx);
		const external = "---\nname: alpha\ndescription: someone else\n---\nexternal\n";
		const result = editor.commitRolePlan(snap, plan, { rename: (from: string, to: string) => { if (to === fx.registryPath) { fs.writeFileSync(fx.agentPath("alpha"), external); throw new Error("EBUSY injected"); } fs.renameSync(from, to); } });
		assert.equal(result.status, "failed");
		assert.equal(result.rolledBack, false);
		assert.equal(fs.readFileSync(fx.agentPath("alpha"), "utf8"), external);
		assert.match(result.reason, /external/);
	});

	test("rollback failure is surfaced with the original bytes retained as a recovery artifact", () => {
		const fx = newFixture();
		const original = fs.readFileSync(fx.agentPath("alpha"));
		const { snap, plan } = preparedPlan(fx);
		let mdRenames = 0;
		const result = editor.commitRolePlan(snap, plan, { rename: (from: string, to: string) => {
			if (to === fx.agentPath("alpha")) mdRenames++;
			if (to === fx.registryPath || (to === fx.agentPath("alpha") && mdRenames === 2)) throw new Error("EPERM injected " + path.basename(to));
			fs.renameSync(from, to);
		} });
		assert.equal(result.status, "failed");
		assert.equal(result.rolledBack, false);
		assert.ok(result.recovery.length >= 1, "recovery artifact reported");
		assert.deepEqual(fs.readFileSync(result.recovery[0]), original);
		assert.deepEqual(fs.readFileSync(fx.registryPath), snap.registryBytes);
	});

	test("definition rename failure leaves the registry untouched and cleans owned temps", () => {
		const fx = newFixture();
		const before = snapshotDir(fx.dir);
		const { snap, plan } = preparedPlan(fx);
		const result = editor.commitRolePlan(snap, plan, { rename: (from: string, to: string) => { if (to === fx.agentPath("alpha")) throw new Error("EACCES injected"); fs.renameSync(from, to); } });
		assert.equal(result.status, "failed");
		assert.deepEqual(snapshotDir(fx.dir), before);
		assert.deepEqual(leftovers(fx.dir), []);
	});

	test("external change to roles.json after preview is a conflict: zero writes", () => {
		const fx = newFixture();
		const { snap, plan } = preparedPlan(fx);
		const edited = fs.readFileSync(fx.registryPath, "utf8").replace("\"low\"", "\"high\"");
		fs.writeFileSync(fx.registryPath, edited);
		const before = snapshotDir(fx.dir);
		const result = editor.commitRolePlan(snap, plan);
		assert.equal(result.status, "conflict");
		assert.deepEqual(snapshotDir(fx.dir), before);
	});

	test("already-built discovery keeps accepted values; the next discovery sees the saved edit (loader parity)", () => {
		const fx = newFixture();
		const built = agents.discoverAgents(fx.dir, "user").agents;
		const before = JSON.stringify(built.find((a: any) => a.name === "alpha"));
		const { snap, plan } = preparedPlan(fx);
		assert.equal(editor.commitRolePlan(snap, plan).status, "saved");
		assert.equal(JSON.stringify(built.find((a: any) => a.name === "alpha")), before);
		const next = agents.discoverAgents(fx.dir, "user").agents.find((a: any) => a.name === "alpha");
		assert.equal(next.model, SLASH_REF);
		assert.deepEqual(next.fallbackModel, []);
		assert.equal(next.thinking, "high");
	});

	// Review repair: lossless UTF-8, link and hard-link refusal, legacy thinking, staged rollback, usage text.
	const onWindows = process.platform === "win32";
	const withRawByte = (bytes: Buffer, marker: string, offset: number, byte: number): Buffer => {
		const at = bytes.indexOf(Buffer.from(marker, "utf8"));
		assert.ok(at >= 0, `marker ${marker} not found`);
		return Buffer.concat([bytes.subarray(0, at + offset), Buffer.from([byte]), bytes.subarray(at + offset)]);
	};
	const tmpWithBytes = (dir: string, bytes: Buffer): boolean => fs.readdirSync(dir).some((n) => n.endsWith(".tmp") && fs.readFileSync(path.join(dir, n)).equals(bytes));
	const lastNote = (run: { notes: Array<{ type?: string }> }) => run.notes.at(-1)?.type;

	test("registry with a raw invalid UTF-8 byte in a string is refused before any preview or write", async () => {
		const fx = newFixture();
		fs.writeFileSync(fx.registryPath, withRawByte(fs.readFileSync(fx.registryPath), '"read, grep"', 7, 0xe9));
		const before = snapshotDir(fx.dir);
		const run = fakeCtx(SCENARIO());
		await editor.editRoleConfig(run.ctx);
		assert.equal(lastNote(run), "error", JSON.stringify(run.notes));
		assert.equal(run.dialogs.length, 0);
		assert.deepEqual(snapshotDir(fx.dir), before);
		assert.throws(() => editor.readRoleSnapshot(fx.dir, "alpha"), (e: Error) => e.name === "RoleEditError" && /UTF-8/.test(e.message));
	});

	test("definition with a raw invalid UTF-8 body byte is refused; the body is never rewritten as U+FFFD", async () => {
		const fx = newFixture();
		fs.writeFileSync(fx.agentPath("alpha"), withRawByte(Buffer.from(roleMd(DEFAULT_ROLES[0], "\n"), "utf8"), "Body for alpha", 0, 0xe9));
		const before = snapshotDir(fx.dir);
		const run = fakeCtx(SCENARIO());
		await editor.editRoleConfig(run.ctx);
		assert.equal(lastNote(run), "error", JSON.stringify(run.notes));
		assert.deepEqual(snapshotDir(fx.dir), before);
		assert.throws(() => editor.readRoleSnapshot(fx.dir, "alpha"), (e: Error) => e.name === "RoleEditError" && /UTF-8/.test(e.message));
	});

	test("valid multibyte UTF-8 body, legal lone-surrogate JSON escape and a BOM on the definition survive a save", async () => {
		const roles = DEFAULT_ROLES.map((r) => (r.name === "beta" ? { ...r, tools: "read, grep\ud800" } : r));
		const fx = newFixture({ roles, md: { alpha: roleMd(DEFAULT_ROLES[0], "\n").replace("Body for alpha.", "Body caf\u00e9 \u2713 for alpha.") } });
		fs.writeFileSync(fx.agentPath("alpha"), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), fs.readFileSync(fx.agentPath("alpha"))]));
		const run = fakeCtx(SCENARIO());
		await editor.editRoleConfig(run.ctx);
		assert.equal(lastNote(run), "info", JSON.stringify(run.notes));
		assert.ok(fs.readFileSync(fx.registryPath, "utf8").includes('"tools": "read, grep\\ud800"'));
		const after = fs.readFileSync(fx.agentPath("alpha"));
		assert.deepEqual([...after.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
		assert.ok(after.toString("utf8").includes("Body caf\u00e9 \u2713 for alpha."));
	});

	test("fallback-only edit on unsupported legacy thinking offers a labelled current option; the saved value is the exact original", async () => {
		const fx = newFixture();
		let offered: string[] = [];
		let preview = "";
		const steps: unknown[] = [
			"plain",
			choose(`Current ${PLAIN_REF}`),
			"Add fallback",
			choose("anthropic/claude-haiku-5-5"),
			"Done",
			(_t: string, opts: string[]) => {
				offered = opts;
				return opts.find((o) => /^medium \(current/.test(o));
			},
			(_t: string, message: string) => {
				preview = message;
				return true;
			},
		];
		const run = fakeCtx(steps);
		await editor.editRoleConfig(run.ctx);
		assert.ok(offered.some((o) => /^medium \(current/.test(o)), JSON.stringify(offered));
		assert.match(preview, /Warning: thinking medium is not supported by/);
		assert.equal(lastNote(run), "info", JSON.stringify(run.notes));
		const plain = JSON.parse(fs.readFileSync(fx.registryPath, "utf8")).find((r: any) => r.name === "plain");
		assert.equal(plain.thinking, "medium");
		assert.equal(plain.fallbackModel, "anthropic/claude-haiku-5-5");
		assert.match(fs.readFileSync(fx.agentPath("plain"), "utf8"), /^thinking: medium\r?$/m);
	});

	test("changing the primary off a legacy thinking level offers only the new primary's supported levels", async () => {
		newFixture();
		let offered: string[] = [];
		await editor.editRoleConfig(fakeCtx(["alpha", choose(PLAIN_REF), "Done", (_t: string, opts: string[]) => { offered = opts; return undefined; }]).ctx);
		assert.deepEqual(offered, piAi.getSupportedThinkingLevels(PLAIN));
	});

	test("the original definition bytes are staged before the first target is replaced", () => {
		const fx = newFixture();
		const { snap, plan } = preparedPlan(fx);
		const agentsDir = path.dirname(fx.agentPath("alpha"));
		let stagedBeforeReplace: boolean | undefined;
		const result = editor.commitRolePlan(snap, plan, { rename: (from: string, to: string) => {
			if (to === fx.agentPath("alpha") && stagedBeforeReplace === undefined) stagedBeforeReplace = tmpWithBytes(agentsDir, snap.agentBytes);
			fs.renameSync(from, to);
		} });
		assert.equal(result.status, "saved");
		assert.equal(stagedBeforeReplace, true, "original definition bytes must be staged before the definition is replaced");
	});

	test("a failed or partial stage of any temp file replaces nothing and leaves no owned temp", () => {
		const cases: Array<[string, (name: string, bytes: Buffer, snap: any, plan: any) => boolean]> = [
			["new definition", (name, bytes, _s, plan) => name.startsWith(".alpha.md.") && bytes.equals(Buffer.from(plan.agentText, "utf8"))],
			["original definition", (name, bytes, snap) => name.startsWith(".alpha.md.") && bytes.equals(snap.agentBytes)],
			["new registry", (name) => name.startsWith(".roles.json.")],
		];
		for (const partial of [false, true]) {
			for (const [label, hit] of cases) {
				const fx = newFixture();
				const before = snapshotDir(fx.dir);
				const { snap, plan } = preparedPlan(fx);
				const result = editor.commitRolePlan(snap, plan, { write: (file: string, bytes: Buffer) => {
					if (hit(path.basename(file), bytes, snap, plan)) {
						if (partial) fs.writeFileSync(file, bytes.subarray(0, 5), { flag: "wx" });
						throw Object.assign(new Error("ENOSPC injected"), { code: "ENOSPC" });
					}
					fs.writeFileSync(file, bytes, { flag: "wx" });
				} });
				const name = `${label}${partial ? " (partial write)" : ""}`;
				assert.equal(result.status, "failed", name);
				assert.match(result.reason, /nothing changed/, name);
				assert.deepEqual(snapshotDir(fx.dir), before, name);
				assert.deepEqual(leftovers(fx.dir), [], name);
			}
		}
	});

	test("junction at the agents directory is refused before any read or write (Windows; no privilege needed)", async (t: any) => {
		if (!onWindows) return t.skip("directory junctions are Windows-only");
		const fx = newFixture();
		const outside = fs.mkdtempSync(path.join(os.tmpdir(), "roles-editor-outside-"));
		dirs.push(outside);
		const agents = path.join(fx.dir, "agents");
		fs.renameSync(agents, path.join(outside, "agents"));
		fs.symlinkSync(path.join(outside, "agents"), agents, "junction");
		try {
			const before = snapshotDir(outside);
			const run = fakeCtx(SCENARIO());
			await editor.editRoleConfig(run.ctx);
			assert.equal(lastNote(run), "error", JSON.stringify(run.notes));
			assert.deepEqual(snapshotDir(outside), before, "outside the profile must stay byte-identical");
			assert.throws(() => editor.readRoleSnapshot(fx.dir, "alpha"), (e: Error) => /link/.test(e.message));
		} finally {
			fs.rmdirSync(agents);
		}
	});

	test("profile directory reached through a junction is refused before any read or write (Windows)", async (t: any) => {
		if (!onWindows) return t.skip("directory junctions are Windows-only");
		const real = newFixture();
		const link = `${real.dir}-link`;
		fs.symlinkSync(real.dir, link, "junction");
		process.env.PI_CODING_AGENT_DIR = link;
		try {
			const before = snapshotDir(real.dir);
			const run = fakeCtx(SCENARIO());
			await editor.editRoleConfig(run.ctx);
			assert.equal(lastNote(run), "error", JSON.stringify(run.notes));
			assert.deepEqual(snapshotDir(real.dir), before);
			assert.throws(() => editor.readRoleSnapshot(link, "alpha"), (e: Error) => /link/.test(e.message));
		} finally {
			fs.rmdirSync(link);
		}
	});

	test("roles.json that is a symlink is refused before any write (skipped where file symlinks are not permitted)", async (t: any) => {
		const fx = newFixture();
		const outside = `${fx.dir}-outside.json`;
		dirs.push(outside);
		fs.renameSync(fx.registryPath, outside);
		try {
			fs.symlinkSync(outside, fx.registryPath, "file");
		} catch (error) {
			return t.skip(`file symlink creation not permitted here: ${(error as Error).message}`);
		}
		const before = snapshotDir(fx.dir);
		const outsideBefore = fs.readFileSync(outside, "base64");
		assert.throws(() => editor.readRoleSnapshot(fx.dir, "alpha"), (e: Error) => /link/.test(e.message));
		const run = fakeCtx(SCENARIO());
		await editor.editRoleConfig(run.ctx);
		assert.equal(lastNote(run), "error", JSON.stringify(run.notes));
		assert.deepEqual(snapshotDir(fx.dir), before);
		assert.equal(fs.readFileSync(outside, "base64"), outsideBefore);
	});

	test("roles.json with a second hard link is refused before any write", async () => {
		const fx = newFixture();
		const alias = `${fx.dir}-alias.json`;
		dirs.push(alias);
		fs.linkSync(fx.registryPath, alias);
		const before = snapshotDir(fx.dir);
		const aliasBefore = fs.readFileSync(alias, "base64");
		assert.throws(() => editor.readRoleSnapshot(fx.dir, "alpha"), (e: Error) => /hard link/.test(e.message));
		const run = fakeCtx(SCENARIO());
		await editor.editRoleConfig(run.ctx);
		assert.equal(lastNote(run), "error", JSON.stringify(run.notes));
		assert.deepEqual(snapshotDir(fx.dir), before);
		assert.equal(fs.readFileSync(alias, "base64"), aliasBefore);
	});

	test("definition with a second hard link is refused before any write", async () => {
		const fx = newFixture();
		const alias = `${fx.dir}-alias.md`;
		dirs.push(alias);
		fs.linkSync(fx.agentPath("alpha"), alias);
		const before = snapshotDir(fx.dir);
		const aliasBefore = fs.readFileSync(alias, "base64");
		assert.throws(() => editor.readRoleSnapshot(fx.dir, "alpha"), (e: Error) => /hard link/.test(e.message));
		const run = fakeCtx(SCENARIO());
		await editor.editRoleConfig(run.ctx);
		assert.equal(lastNote(run), "error", JSON.stringify(run.notes));
		assert.deepEqual(snapshotDir(fx.dir), before);
		assert.equal(fs.readFileSync(alias, "base64"), aliasBefore);
	});

	test("a hard link added after preview is refused at commit: zero writes", () => {
		const fx = newFixture();
		const { snap, plan } = preparedPlan(fx);
		const alias = `${fx.dir}-late.json`;
		dirs.push(alias);
		fs.linkSync(fx.registryPath, alias);
		const before = snapshotDir(fx.dir);
		const result = editor.commitRolePlan(snap, plan);
		assert.equal(result.status, "failed");
		assert.match(result.reason, /hard link/);
		assert.deepEqual(snapshotDir(fx.dir), before);
	});

	test("a sibling entry without its own fallbackModel blocks editing (fail-closed; the sibling is not repaired)", () => {
		const roles = DEFAULT_ROLES.map((r) => (r.name === "beta" ? { name: r.name, provider: r.provider, model: r.model, thinking: r.thinking, tools: r.tools } : r));
		const fx = newFixture({ roles });
		const before = snapshotDir(fx.dir);
		assert.throws(() => editor.readRoleSnapshot(fx.dir, "alpha"), (e: Error) => /roles\.json entry 1 has a missing or non-string fallbackModel/.test(e.message));
		assert.deepEqual(snapshotDir(fx.dir), before);
	});

	// Searchable picker (editor slot): bounded rendering, native keys, exact return values, wheel, focus.
	const KEY = { up: "\x1b[A", down: "\x1b[B", enter: "\r", escape: "\x1b", pageUp: "\x1b[5~", pageDown: "\x1b[6~" };
	const stripAnsi = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");
	const wheel = (wheelDelta: number, y: number) => ({ type: "wheel", button: "none", x: 2, y, screenX: 2, screenY: y, width: 60, height: 16, shift: false, alt: false, ctrl: false, wheelDelta }) as never;
	/** Types the label, moves down to it, presses Enter; undefined presses Escape. */
	function drivePicker(picker: any, label: string | undefined): void {
		if (label === undefined) {
			picker.handleInput(KEY.escape);
			return;
		}
		for (const ch of label) picker.handleInput(ch);
		for (let i = 0; picker.selectedLabel() !== label && i <= picker.options.length; i++) picker.handleInput(KEY.down);
		assert.equal(picker.selectedLabel(), label, `picker cannot reach ${label}`);
		picker.handleInput(KEY.enter);
	}
	const PICK_OPTIONS: string[] = Array.from({ length: 160 }, (_, i) => (i === 39 ? "openai/model-39" : `prov${i % 9}/model-${i}`));
	const tuiRows = (rows: number) => ({ terminal: { rows } });
	function newPicker(options = PICK_OPTIONS, win: Record<string, unknown> = {}) {
		const done: unknown[] = [];
		const picker = new editor.SearchPicker("Primary model for alpha", options, stubTheme, piTui.getKeybindings(), (result: unknown) => done.push(result), win);
		return { picker, done };
	}

	test("searchable picker: terminal-height aware bounded render (one frame, one count line, one hint) and every line fits the width", () => {
		const { picker } = newPicker(PICK_OPTIONS, { tui: tuiRows(20) });
		const lines: string[] = picker.render(60);
		assert.ok(lines.length <= 18, `height ${lines.length}`);
		assert.ok(lines.every((l) => piTui.visibleWidth(l) <= 60), "a line exceeds the width");
		const text = stripAnsi(lines.join("\n"));
		assert.equal(lines.filter((l) => /model-\d+/.test(stripAnsi(l))).length, 9, "9 option rows at 20 rows (one scroll line)");
		assert.match(text, /160\/160 match/);
		assert.equal(text.split("\n").filter((l) => /type to search/.test(l)).length, 1, "exactly one keyboard hint");
	});

	test("searchable picker: Up/Down clamp (no wrap), PageDown/PageUp move 10, Enter returns the exact label", () => {
		const { picker, done } = newPicker();
		picker.handleInput(KEY.down);
		assert.equal(picker.selectedLabel(), PICK_OPTIONS[1]);
		picker.handleInput(KEY.pageDown);
		assert.equal(picker.selectedLabel(), PICK_OPTIONS[11]);
		picker.handleInput(KEY.pageDown);
		assert.equal(picker.selectedLabel(), PICK_OPTIONS[21]);
		picker.handleInput(KEY.pageUp);
		assert.equal(picker.selectedLabel(), PICK_OPTIONS[11]);
		for (let i = 0; i < 20; i++) picker.handleInput(KEY.pageDown);
		assert.equal(picker.selectedLabel(), PICK_OPTIONS[159], "PageDown clamps at the last option");
		picker.handleInput(KEY.down);
		assert.equal(picker.selectedLabel(), PICK_OPTIONS[159], "Down clamps at the last option");
		for (let i = 0; i < 200; i++) picker.handleInput(KEY.up);
		assert.equal(picker.selectedLabel(), PICK_OPTIONS[0], "Up clamps at the first option");
		picker.handleInput(KEY.pageDown);
		picker.handleInput(KEY.enter);
		assert.deepEqual(done, [PICK_OPTIONS[10]]);
	});

	test("searchable picker: typed text searches (j is text, not navigation); 'oai 39' finds openai/model-39 and Enter returns it", () => {
		const j = newPicker();
		j.picker.handleInput("j");
		assert.match(stripAnsi(j.picker.render(60).join("\n")), /0\/160 match/);
		assert.equal(j.picker.selectedLabel(), undefined);
		const oai = newPicker();
		for (const ch of "oai 39") oai.picker.handleInput(ch);
		assert.equal(oai.picker.selectedLabel(), "openai/model-39");
		assert.match(stripAnsi(oai.picker.render(60).join("\n")), /1\/160 match/);
		oai.picker.handleInput(KEY.enter);
		assert.deepEqual(oai.done, ["openai/model-39"]);
	});

	test("searchable picker: zero matches make Enter inert; Escape and Ctrl+C return undefined", () => {
		const zero = newPicker();
		for (const ch of "zzzz") zero.picker.handleInput(ch);
		assert.match(stripAnsi(zero.picker.render(60).join("\n")), /0\/160 match/);
		zero.picker.handleInput(KEY.enter);
		assert.deepEqual(zero.done, []);
		zero.picker.handleInput(KEY.escape);
		assert.deepEqual(zero.done, [undefined]);
		const ctrlC = newPicker();
		ctrlC.picker.handleInput("\x03");
		assert.deepEqual(ctrlC.done, [undefined]);
	});

	test("searchable picker: mouse wheel moves the native list one row per event through the container, clamped at the top", () => {
		const { picker, done } = newPicker();
		picker.render(60);
		picker.handleMouse(wheel(1, 5));
		assert.equal(picker.selectedLabel(), PICK_OPTIONS[1]);
		picker.handleMouse(wheel(-1, 5));
		picker.handleMouse(wheel(-1, 5));
		assert.equal(picker.selectedLabel(), PICK_OPTIONS[0]);
		assert.deepEqual(done, []);
	});

	test("searchable picker: focus propagates to the Input (IME cursor marker only while focused)", () => {
		const { picker } = newPicker();
		assert.ok(!picker.render(60).join("").includes(piTui.CURSOR_MARKER));
		picker.focused = true;
		assert.ok(picker.render(60).join("").includes(piTui.CURSOR_MARKER), "focused picker must place the cursor");
		picker.focused = false;
		assert.ok(!picker.render(60).join("").includes(piTui.CURSOR_MARKER));
	});

	test("TUI with ui.custom: every stage (role, primary, fallback menus, add, move, thinking, preview) is a custom window; no select dialog", async () => {
		const fx = newFixture({ crlf: true });
		const run = fakeCtx(SCENARIO(SAVE), true, { custom: true });
		await editor.editRoleConfig(run.ctx);
		const menu = `Fallbacks for alpha (primary ${SLASH_REF})`;
		assert.deepEqual(run.dialogs.filter((d) => d.kind === "custom").map((d) => d.title), ["Edit role model settings", "Primary model for alpha", menu, "Add fallback to alpha", menu, "Move which fallback up", menu, `Thinking level for alpha (${SLASH_REF})`, "Save role alpha?"]);
		assert.equal(run.dialogs.filter((d) => d.kind === "select").length, 0, "every TUI stage is a custom window");
		const expectedRoles = DEFAULT_ROLES.map((r) => (r.name !== "alpha" ? r : { ...r, provider: "baseten", model: SLASH_REF, fallbackModel: SCENARIO_FALLBACKS, thinking: "high" }));
		assert.equal(fs.readFileSync(fx.registryPath, "utf8"), formatJson(expectedRoles, fx.eol));
		assert.ok(run.notes.some((n) => n.type === "info" && /saved/i.test(n.message)), JSON.stringify(run.notes));
	});

	test("TUI custom pickers: cancelling any step (Escape) saves nothing and stops the flow", async () => {
		const steps = SCENARIO(SAVE);
		for (let k = 0; k < steps.length; k++) {
			const fx = newFixture({ crlf: k % 2 === 1 });
			const before = snapshotDir(fx.dir);
			const run = fakeCtx(steps.map((s, i) => (i === k ? undefined : s)), true, { custom: true });
			await editor.editRoleConfig(run.ctx);
			assert.equal(run.dialogs.length, k + 1, `flow stops at cancelled dialog ${k}`);
			assert.deepEqual(snapshotDir(fx.dir), before, `cancel at ${k}`);
		}
	});

	test("TUI custom pickers: out-of-catalog 'current' label saves the exact original primary ID; declining the confirm saves nothing", async () => {
		const fx = newFixture();
		const steps = ["legacy", choose("Current anthropic/not-in-catalog-model"), "Add fallback", choose("anthropic/claude-haiku-5-5"), "Done", choose("xhigh"), SAVE];
		const run = fakeCtx(steps, true, { custom: true });
		await editor.editRoleConfig(run.ctx);
		assert.equal(run.dialogs.filter((d) => d.kind === "custom").length, 7);
		const legacy = JSON.parse(fs.readFileSync(fx.registryPath, "utf8")).find((r: any) => r.name === "legacy");
		assert.equal(legacy.provider, "anthropic");
		assert.equal(legacy.model, "not-in-catalog-model");
		assert.equal(legacy.fallbackModel, "github-copilot/gpt-6-luna || anthropic/claude-haiku-5-5");
		assert.equal(legacy.thinking, "xhigh");
		const declined = newFixture();
		const before = snapshotDir(declined.dir);
		const declinedSteps = [...steps.slice(0, 6), CANCEL];
		await editor.editRoleConfig(fakeCtx(declinedSteps, true, { custom: true }).ctx);
		assert.deepEqual(snapshotDir(declined.dir), before);
	});

	test("TUI custom pickers: legacy thinking preview mapping saves the exact original level; declined preview writes nothing", async () => {
		const legacyThinking = (_t: string, opts: string[]) => opts.find((o) => /^medium \(current/.test(o));
		const head = ["plain", choose(`Current ${PLAIN_REF}`), "Add fallback", choose("anthropic/claude-haiku-5-5"), "Done", legacyThinking];
		const fx = newFixture();
		const run = fakeCtx([...head, SAVE], true, { custom: true });
		await editor.editRoleConfig(run.ctx);
		assert.ok(run.dialogs.some((d) => d.kind === "custom"), "TUI pickers must use ui.custom");
		assert.match((run.dialogs.at(-1) as any).body.join("\n"), /Warning: thinking medium is not supported by/);
		const plain = JSON.parse(fs.readFileSync(fx.registryPath, "utf8")).find((r: any) => r.name === "plain");
		assert.equal(plain.thinking, "medium");
		assert.equal(plain.fallbackModel, "anthropic/claude-haiku-5-5");
		const declined = newFixture();
		const before = snapshotDir(declined.dir);
		await editor.editRoleConfig(fakeCtx([...head, CANCEL], true, { custom: true }).ctx);
		assert.deepEqual(snapshotDir(declined.dir), before);
	});

	test("non-TUI mode (rpc) with ui.custom present keeps plain select for every dialog and the same saved bytes", async () => {
		const fx = newFixture({ crlf: true });
		const run = fakeCtx(SCENARIO(), true, { custom: true, mode: "rpc" });
		await editor.editRoleConfig(run.ctx);
		assert.equal(run.dialogs.filter((d) => d.kind === "custom").length, 0, "rpc must not render custom components");
		assert.equal(run.dialogs.length, SCENARIO().length);
		assert.equal(JSON.parse(fs.readFileSync(fx.registryPath, "utf8"))[0].model, SLASH_REF);
	});

	// Real fullscreen input path: installed TuiAltScreen gives plain PageUp/PageDown to the transcript unless an overlay has focus.
	// Installed TuiAltScreen (plain PageUp/PageDown reach the transcript unless an overlay has focus) with a custom router that mirrors
	// Pi's showExtensionCustom (overlay -> showOverlay(overlayOptions); else editor slot + setFocus) and its close (hideOverlay / restore).
	function fullscreen(columns: number, rows: number) {
		const term: any = { start(onInput: (d: string) => void) { this.onInput = onInput; }, stop() {}, drainInput: async () => {}, write() {}, columns, rows, kittyProtocolActive: false, moveBy() {}, hideCursor() {}, showCursor() {}, clearLine() {}, clearFromCursor() {}, clearScreen() {}, setTitle() {}, setProgress() {}, setProgramStatus() {} };
		const screen: any = new piTui.TuiAltScreen(term, false, undefined, { mouse: true });
		screen.start();
		const editorSlot = new piTui.Container();
		screen.addChild(new piTui.Text("transcript", 0, 0));
		screen.addChild(editorSlot);
		const pickers: any[] = [];
		const send = (data: string) => {
			term.onInput(data);
			screen.renderNow(true);
		};
		const custom = (factory: any, options?: { overlay?: boolean; overlayOptions?: unknown }) => new Promise((resolve) => {
			const done = (result: unknown) => {
				if (options?.overlay) screen.hideOverlay();
				else editorSlot.clear();
				resolve(result);
			};
			const picker = factory(screen, stubTheme, piTui.getKeybindings(), done);
			pickers.push(picker);
			if (options?.overlay) screen.showOverlay(picker, options.overlayOptions);
			else {
				editorSlot.clear();
				editorSlot.addChild(picker);
				screen.setFocus(picker);
			}
			screen.renderNow(true);
		});
		return { screen, pickers, send, custom, term };
	}

	const until = async (cond: () => boolean) => {
		for (let i = 0; i < 500 && !cond(); i++) await new Promise((r) => setTimeout(r, 2));
	};

	test("connection follows getAvailable when offered: snapshot exclusions are honored and unverified snapshot entries are never offered", () => {
		const haiku = CATALOG.find((m) => m.provider === "anthropic" && m.id === "claude-haiku-5-5");
		const slash = CATALOG.find((m) => `${m.provider}/${m.id}` === SLASH_REF);
		const codex = CATALOG.find((m) => m.provider === "openai-codex");
		const catalog = editor.catalogFromRegistry({ ...registry(), getAvailable: () => [haiku, slash, { provider: "anthropic", id: "not-verified-model" }] });
		assert.deepEqual(catalog.models().map((m: any) => `${m.provider}/${m.id}`).sort(), ["anthropic/claude-haiku-5-5", SLASH_REF].sort());
		assert.ok(catalog.find(`${codex.provider}/${codex.id}`), "find keeps the verified catalog for excluded refs");
	});

	test("zero connected models: one warning with /login guidance before any dialog, and nothing is written", async () => {
		const fx = newFixture();
		const before = snapshotDir(fx.dir);
		const run = fakeCtx([], true, { custom: true });
		run.ctx.modelRegistry = { getAll: () => CATALOG, hasConfiguredAuth: () => false, getAvailable: () => [] } as any;
		await editor.editRoleConfig(run.ctx);
		assert.equal(run.dialogs.length, 0);
		assert.equal(run.notes.length, 1);
		assert.equal(run.notes[0].type, "warning");
		assert.match(run.notes[0].message, /No connected models/);
		assert.match(run.notes[0].message, /\/login/);
		assert.deepEqual(snapshotDir(fx.dir), before);
	});

	test("legacy saved refs stay exact: a disconnected primary and fallback keep labelled current values; removal is allowed; an unchanged save reports No changes", async () => {
		const [primary, other] = [DISCONNECTED_REF, DISCONNECTED_REF_2];
		const roles = [{ name: "alpha", provider: primary.split("/")[0], model: primary.split("/")[1], fallbackModel: `${other} || anthropic/claude-haiku-5-5`, thinking: "off", tools: "read" }];
		const fx = newFixture({ roles });
		let primaryOptions: string[] = [];
		let fallbackOptions: string[] = [];
		const steps = ["alpha", (_t: string, opts: string[]) => { primaryOptions = opts; return opts[0]; }, "Remove fallback", (_t: string, opts: string[]) => { fallbackOptions = opts; return `1. ${other} (not connected)`; }, "Done", "off", true];
		await editor.editRoleConfig(fakeCtx(steps).ctx);
		assert.equal(primaryOptions[0], `Current ${primary} (not connected)`);
		assert.ok(fallbackOptions.includes(`1. ${other} (not connected)`), JSON.stringify(fallbackOptions));
		const saved = JSON.parse(fs.readFileSync(fx.registryPath, "utf8"))[0];
		assert.equal(`${saved.provider}/${saved.model}`, primary);
		assert.equal(saved.fallbackModel, "anthropic/claude-haiku-5-5");
		assert.equal(saved.thinking, "off");
		const same = newFixture({ roles });
		const before = snapshotDir(same.dir);
		const run = fakeCtx(["alpha", (_t: string, opts: string[]) => opts.find((o) => o.startsWith("Current ")), "Done", "off"]);
		await editor.editRoleConfig(run.ctx);
		assert.deepEqual(snapshotDir(same.dir), before);
		assert.ok(run.notes.some((n) => n.type === "info" && /No changes to role alpha/.test(n.message)), JSON.stringify(run.notes));
	});

	test("window (inspector frame): every line fits widths 20..120; at the 38-column overlay of 40x12 the selected row stays visible within 10 rows", () => {
		const { picker } = newPicker(PICK_OPTIONS, { tui: tuiRows(12) });
		for (let i = 0; i < 25; i++) picker.handleInput(KEY.down);
		const selected = picker.selectedLabel();
		for (let cols = 20; cols <= 120; cols += 5) {
			const lines: string[] = picker.render(cols);
			assert.ok(lines.length <= 10, `${cols} cols: ${lines.length} rows exceed the 10-row overlay`);
			assert.ok(lines.every((l) => piTui.visibleWidth(l) <= cols), `${cols} cols: a line exceeds the width`);
			assert.match(stripAnsi(lines[0]), /\u256d/, `${cols} cols: frame top missing`);
			assert.match(stripAnsi(lines[lines.length - 1]), /\u2570/, `${cols} cols: frame bottom missing`);
		}
		assert.ok(stripAnsi(picker.render(38).join("\n")).includes(selected), `selected ${selected} not visible at 40x12`);
	});

	test("window: wheel through the frame moves the list one row per event (frame-offset coordinates)", () => {
		const { picker, done } = newPicker(PICK_OPTIONS, { tui: tuiRows(20) });
		const lines: string[] = picker.render(60);
		const row = lines.findIndex((l) => stripAnsi(l).includes(PICK_OPTIONS[0]));
		assert.ok(row > 0, "first option row not inside the frame");
		picker.handleMouse({ ...wheel(1, row), height: lines.length } as never);
		assert.equal(picker.selectedLabel(), PICK_OPTIONS[1]);
		picker.handleMouse({ ...wheel(-1, row), height: lines.length } as never);
		picker.handleMouse({ ...wheel(-1, row), height: lines.length } as never);
		assert.equal(picker.selectedLabel(), PICK_OPTIONS[0]);
		assert.deepEqual(done, []);
	});

	test("TUI preview: Cancel and Escape write nothing; the body lists before, after and warnings", async () => {
		for (const finalStep of [CANCEL, ESCAPE]) {
			const fx = newFixture();
			const before = snapshotDir(fx.dir);
			const run = fakeCtx(SCENARIO(finalStep), true, { custom: true });
			await editor.editRoleConfig(run.ctx);
			const preview = run.dialogs.at(-1) as { kind: string; title: string; body: string[] };
			assert.equal(preview.kind, "custom");
			assert.equal(preview.title, "Save role alpha?");
			assert.match(preview.body.join("\n"), /Before: /);
			assert.match(preview.body.join("\n"), /After: /);
			assert.deepEqual(snapshotDir(fx.dir), before);
			assert.ok(run.notes.some((n) => /not saved/.test(n.message)), JSON.stringify(run.notes));
		}
	});

	test("TUI windows use the inspector's shared overlay options (98% width, 94% height, centered, margin 1)", async () => {
		newFixture();
		const { screen, pickers, send, custom } = fullscreen(100, 40);
		const seen: any[] = [];
		const ctx = { hasUI: true, mode: "tui", cwd: os.tmpdir(), modelRegistry: registry(), ui: { select: async () => undefined, confirm: async () => true, notify() {}, custom: (factory: any, options?: any) => { seen.push(options); return custom(factory, options); } } };
		const flow = editor.editRoleConfig(ctx);
		await until(() => pickers.length >= 1);
		send(KEY.escape);
		await flow;
		assert.ok(seen.length >= 1, "no custom window opened");
		for (const options of seen) {
			assert.equal(options.overlay, true);
			assert.deepEqual(options.overlayOptions, { width: "98%", maxHeight: "94%", anchor: "center", margin: 1 });
		}
		screen.stop();
	});

	test("TUI fullscreen 40x12: PageDown keeps the selected primary row inside the composed 12-row screen", async () => {
		newFixture();
		const { screen, pickers, send, custom } = fullscreen(40, 12);
		const ctx = { hasUI: true, mode: "tui", cwd: os.tmpdir(), modelRegistry: registry(), ui: { select: async () => undefined, confirm: async () => true, notify() {}, custom } };
		const flow = editor.editRoleConfig(ctx);
		for (const ch of "alpha") send(ch);
		send("\r");
		await until(() => pickers.length >= 2);
		const primary = pickers[1];
		send(KEY.pageDown);
		send(KEY.pageDown);
		const selected: string = primary.selectedLabel();
		assert.ok(selected, "a primary must be selected");
		const base = Array.from({ length: 12 }, (_, i) => (i === 0 ? "transcript" : ""));
		const frame: string[] = screen.compositeOverlays(base, 40, 12);
		assert.ok(frame.length <= 12, `${frame.length} rows`);
		assert.ok(frame.every((line) => piTui.visibleWidth(line) <= 40), "a line exceeds 40 columns");
		assert.ok(stripAnsi(frame.join("\n")).includes(selected.slice(0, 16)), `selected ${selected} not visible on the 40x12 screen`);
		send(KEY.escape);
		await flow;
		screen.stop();
	});

	test("TUI fullscreen (installed TuiAltScreen + custom router): PageDown/PageUp move the primary window by 10; Enter returns the exact label; Escape closes the flow", async () => {
		const fx = newFixture();
		const before = snapshotDir(fx.dir);
		const { screen, pickers, send, custom } = fullscreen(100, 40);
		const ctx = { hasUI: true, mode: "tui", cwd: os.tmpdir(), modelRegistry: registry(), ui: { select: async () => undefined, confirm: async () => true, notify() {}, custom } };
		const flow = editor.editRoleConfig(ctx);
		for (const ch of "alpha") send(ch);
		send("\r");
		await until(() => pickers.length >= 2);
		const primary = pickers[1];
		assert.ok(primary.options.length > 100, `connected choices ${primary.options.length}`);
		assert.equal(primary.selectedLabel(), primary.options[0]);
		send(KEY.pageDown);
		assert.equal(primary.selectedLabel(), primary.options[10], "PageDown through the fullscreen input path must move the window by 10");
		send(KEY.pageDown);
		assert.equal(primary.selectedLabel(), primary.options[20]);
		send(KEY.pageUp);
		assert.equal(primary.selectedLabel(), primary.options[10], "PageUp through the fullscreen input path must move the window back by 10");
		const chosen = primary.options[10];
		send(KEY.enter);
		await until(() => pickers.length >= 3);
		assert.equal(pickers[2].title, `Fallbacks for alpha (primary ${chosen})`, "Enter returns the picker's selected primary");
		send(KEY.escape);
		await flow;
		assert.equal(screen.hasOverlay(), false, "Escape must remove the menu overlay");
		assert.deepEqual(snapshotDir(fx.dir), before, "cancelled menu writes nothing");

		const again = editor.editRoleConfig(ctx);
		for (const ch of "alpha") send(ch);
		send(KEY.enter);
		await until(() => pickers.length >= 5);
		send(KEY.escape);
		await again;
		assert.equal(screen.hasOverlay(), false, "Escape must remove the overlay");
		assert.equal(pickers.length, 5, "Escape must not open another step");
		assert.deepEqual(snapshotDir(fx.dir), before, "cancel writes nothing");
		screen.stop();
	});

	test("TUI fullscreen small terminals (40x12, 20x8): the primary picker overlay composes inside the terminal height and width", async () => {
		for (const [columns, rows] of [[40, 12], [20, 8]]) {
			newFixture();
			const { screen, pickers, send, custom } = fullscreen(columns, rows);
			const ctx = { hasUI: true, mode: "tui", cwd: os.tmpdir(), modelRegistry: registry(), ui: { select: async () => undefined, confirm: async () => true, notify() {}, custom } };
			const flow = editor.editRoleConfig(ctx);
			for (const ch of "alpha") send(ch);
			send(KEY.enter);
			for (let i = 0; i < 500 && pickers.length < 2; i++) await new Promise((r) => setTimeout(r, 2));
			assert.ok(pickers[1], `primary picker never opened at ${columns}x${rows}`);
			const base = Array.from({ length: rows }, (_, i) => (i === 0 ? "transcript" : ""));
			const frame: string[] = screen.compositeOverlays(base, columns, rows);
			assert.ok(frame.length <= rows, `${columns}x${rows}: overlay frame is ${frame.length} rows`);
			assert.ok(frame.every((line) => piTui.visibleWidth(line) <= columns), `${columns}x${rows}: a line exceeds the width`);
			send(KEY.escape);
			await flow;
			assert.equal(screen.hasOverlay(), false, "Escape must remove the overlay");
			screen.stop();
		}
	});

	// Save preview at short terminals (review finding): the body keeps one row, PgUp/PgDn reach every line, Save stays unreachable when no body row fits.
	const PREVIEW_OPTIONS = ["Save role alpha", "Cancel"];
	const PREVIEW_BODY = ["Role alpha", "Before: primary a/b | fallbacks (none) | thinking medium", "After:  primary c/d | fallbacks e/f | thinking high", "Writes: roles.json entry alpha; agents/alpha.md model, fallbackModel, thinking lines", "Warning: fallback g is not in installed catalog"];

	test("save preview unit: at 5-8 rows (80 or 20 columns) a body row, Save and Cancel render, and PgDn reaches every body line", () => {
		for (const [width, rows] of [[80, 5], [80, 6], [80, 7], [80, 8], [20, 8]]) {
			const { picker, done } = newPicker(PREVIEW_OPTIONS, { searchable: false, body: PREVIEW_BODY, tui: tuiRows(rows) });
			const seen = new Set<string>();
			const grab = () => { for (const line of stripAnsi(picker.render(width).join("\n")).split("\n")) seen.add(line); };
			const first = stripAnsi(picker.render(width).join("\n"));
			assert.match(first, /Role alpha|Before:|After:|Writes:/, `${width}x${rows}: no preview body row`);
			// A 16-column frame clips the selected "→ Save role alpha" row; the Save stem stays visible.
			assert.match(first, width >= 40 ? /Save role alpha/ : /Save role/, `${width}x${rows}: Save not visible`);
			assert.match(first, /Cancel/, `${width}x${rows}: Cancel not visible`);
			for (let i = 0; i < 20; i++) { picker.handleInput(KEY.pageDown); grab(); }
			const text = [...seen].join("\n");
			for (const want of ["Before:", "After:", "Writes:", "Warning:"]) assert.ok(text.includes(want), `${width}x${rows}: "${want}" never reached by PgDn`);
			assert.deepEqual(done, [], `${width}x${rows}: scrolling must not finish the picker`);
		}
	});

	test("save preview unit: a terminal too short for any body row never offers Save; Enter is inert and Escape cancels", () => {
		const { picker, done } = newPicker(PREVIEW_OPTIONS, { searchable: false, body: PREVIEW_BODY, tui: tuiRows(4) });
		const text = stripAnsi(picker.render(80).join("\n"));
		assert.match(text, /too small/);
		assert.doesNotMatch(text, /Save role alpha/);
		picker.handleInput(KEY.enter);
		assert.deepEqual(done, []);
		picker.handleInput(KEY.escape);
		assert.deepEqual(done, [undefined]);
	});

	test("save preview unit: shrinking the terminal while open makes Enter inert (no blind Save); growing it again restores Save", () => {
		const win: any = { searchable: false, body: PREVIEW_BODY, tui: tuiRows(12) };
		const { picker, done } = newPicker(PREVIEW_OPTIONS, win);
		assert.match(stripAnsi(picker.render(80).join("\n")), /Save role alpha/);
		win.tui.terminal.rows = 4;
		assert.match(stripAnsi(picker.render(80).join("\n")), /too small/);
		picker.handleInput(KEY.enter);
		assert.deepEqual(done, []);
		win.tui.terminal.rows = 12;
		picker.render(80);
		picker.handleInput(KEY.enter);
		assert.deepEqual(done, ["Save role alpha"]);
	});

	// Drives the installed TuiAltScreen with the scenario keys (alpha, primary, fallbacks, thinking high) until the save preview is top.
	async function reachPreview(send: (data: string) => void, pickers: any[]) {
		let seen = 0;
		const nextPicker = async () => {
			await until(() => pickers.length > seen);
			seen = pickers.length;
			return pickers.at(-1);
		};
		const answer = async (typed: string, match: (label: string) => boolean) => {
			const picker = await nextPicker();
			for (const ch of typed) send(ch);
			for (let i = 0; i <= 400 && !match(picker.selectedLabel() ?? ""); i++) send(KEY.down);
			assert.ok(match(picker.selectedLabel() ?? ""), `picker cannot reach ${typed}`);
			send(KEY.enter);
		};
		await answer("alpha", (l) => l === "alpha");
		await answer(SLASH_REF, (l) => l === SLASH_REF);
		await answer("", (l) => l.startsWith("Add fallback"));
		await answer("anthropic/claude-haiku-5-5", (l) => l === "anthropic/claude-haiku-5-5");
		await answer("", (l) => l.startsWith("Move fallback up"));
		await answer("", (l) => l.startsWith("3. anthropic/claude-haiku-5-5"));
		await answer("", (l) => l === "Done");
		await answer("", (l) => l.startsWith("high"));
		return nextPicker();
	}

	test("TUI fullscreen save preview: at 80x6-8, 20x8, 40x12 and 80x24 the body is reachable with PgDn, Save and Cancel are visible, Cancel and Escape write nothing", async () => {
		for (const [columns, rows] of [[80, 6], [80, 7], [80, 8], [20, 8], [40, 12], [80, 24]]) {
			for (const exit of ["cancel", "escape"]) {
				const fx = newFixture();
				const before = snapshotDir(fx.dir);
				const { screen, pickers, send, custom } = fullscreen(columns, rows);
				const ctx = { hasUI: true, mode: "tui", cwd: os.tmpdir(), modelRegistry: registry(), ui: { select: async () => undefined, confirm: async () => true, notify() {}, custom } };
				const flow = editor.editRoleConfig(ctx);
				await reachPreview(send, pickers);
				const base = Array.from({ length: rows }, (_, i) => (i === 0 ? "transcript" : ""));
				const seen = new Set<string>();
				const grab = (): string[] => {
					const frame: string[] = screen.compositeOverlays(base, columns, rows).map(stripAnsi);
					for (const line of frame) seen.add(line.trim());
					return frame;
				};
				const first = grab();
				assert.ok(first.length <= rows, `${columns}x${rows}: frame is ${first.length} rows`);
				assert.ok(first.some((l) => (columns >= 40 ? /Save role alpha/ : /Save role/).test(l)) && first.some((l) => /Cancel/.test(l)), `${columns}x${rows}: Save and Cancel not both visible`);
				for (let i = 0; i < 40; i++) {
					send(KEY.pageDown);
					grab();
				}
				const text = [...seen].join("\n");
				for (const want of ["Role alpha", "Before:", "After:", "Writes:"]) assert.ok(text.includes(want), `${columns}x${rows}: "${want}" never reached by PgDn`);
				if (exit === "cancel") {
					send(KEY.down);
					send(KEY.enter);
				} else send(KEY.escape);
				await flow;
				assert.equal(screen.hasOverlay(), false, `${columns}x${rows} ${exit}: overlay left open`);
				assert.deepEqual(snapshotDir(fx.dir), before, `${columns}x${rows} ${exit}: a role file changed`);
				screen.stop();
			}
		}
	});

	test("TUI fullscreen save preview: shrinking the terminal to 4 rows while open makes Enter inert (no blind Save); Escape writes nothing", async () => {
		const fx = newFixture();
		const before = snapshotDir(fx.dir);
		const { screen, pickers, send, custom, term } = fullscreen(80, 24);
		const ctx = { hasUI: true, mode: "tui", cwd: os.tmpdir(), modelRegistry: registry(), ui: { select: async () => undefined, confirm: async () => true, notify() {}, custom } };
		const flow = editor.editRoleConfig(ctx);
		let settled = false;
		flow.then(() => { settled = true; });
		await reachPreview(send, pickers);
		term.rows = 4;
		screen.renderNow(true);
		send(KEY.enter);
		await new Promise((r) => setTimeout(r, 20));
		assert.equal(settled, false, "Enter closed the preview at 4 rows");
		assert.deepEqual(snapshotDir(fx.dir), before, "Enter wrote at 4 rows");
		send(KEY.escape);
		await flow;
		assert.deepEqual(snapshotDir(fx.dir), before, "Escape wrote");
		screen.stop();
	});

	// Current selections are listed in the fallback menu body (numbered, ordered, with access status); the Add picker says what is hidden.
	test("fallback menu dialog body lists the current primary and ordered fallbacks with access status", async () => {
		newFixture();
		const run = fakeCtx(["alpha", choose("Current anthropic/claude-haiku-5-5"), choose("Done"), undefined], true, { custom: true });
		await editor.editRoleConfig(run.ctx);
		const menu = run.dialogs.find((d) => d.kind === "custom" && d.title === "Fallbacks for alpha (primary anthropic/claude-haiku-5-5)") as { body?: string[] } | undefined;
		assert.deepEqual(menu?.body, [
			"Primary: anthropic/claude-haiku-5-5 (connected)",
			"Fallbacks, tried in order:",
			"1. openai-codex/gpt-6-luna (connected)",
			"2. github-copilot/gpt-6-luna (not connected)",
		]);
	});

	test("fallback menu body follows in-dialog moves and removals; an emptied chain says (none)", async () => {
		newFixture();
		const run = fakeCtx(["alpha", choose("Current anthropic/claude-haiku-5-5"), choose("Move fallback up"), choose("2. github-copilot"), choose("Remove fallback"), choose("1. github-copilot"), choose("Remove fallback"), choose("1. openai-codex"), choose("Done"), undefined], true, { custom: true });
		await editor.editRoleConfig(run.ctx);
		const menus = run.dialogs.filter((d) => d.kind === "custom" && d.title === "Fallbacks for alpha (primary anthropic/claude-haiku-5-5)") as Array<{ body?: string[] }>;
		assert.equal(menus.length, 4);
		assert.deepEqual(menus[1].body, [
			"Primary: anthropic/claude-haiku-5-5 (connected)",
			"Fallbacks, tried in order:",
			"1. github-copilot/gpt-6-luna (not connected)",
			"2. openai-codex/gpt-6-luna (connected)",
		]);
		assert.deepEqual(menus[3].body, ["Primary: anthropic/claude-haiku-5-5 (connected)", "Fallbacks: (none)"]);
	});

	test("Add fallback picker body says the primary and already-listed fallbacks are hidden", async () => {
		newFixture();
		const run = fakeCtx(["alpha", choose("Current anthropic/claude-haiku-5-5"), "Add fallback", undefined], true, { custom: true });
		await editor.editRoleConfig(run.ctx);
		const add = run.dialogs.find((d) => d.kind === "custom" && d.title === "Add fallback to alpha") as { body?: string[] } | undefined;
		assert.deepEqual(add?.body, ["Hidden: the primary and fallbacks already listed."]);
	});

	// Long chains: every entry is reachable by PgDn in the fullscreen menu; short synthetic refs keep each label and ref on one row at 20 columns.
	test("TUI fullscreen fallback menu: a 20-entry chain is listed in order and reachable with PgDn at 80x6, 20x8, 40x12 and 80x24; Escape writes nothing", async () => {
		const primary = "anthropic/claude-haiku-5-5";
		const chain = Array.from({ length: 20 }, (_, i) => `chain-${i + 1}/m${i + 1}`);
		const roles = DEFAULT_ROLES.map((r) => (r.name === "alpha" ? { ...r, fallbackModel: chain.join(" || ") } : r));
		const norm = (text: string) => text.replace(/\x1b\][^\x07]*\x07/g, "").replace(/[\s\u2502\u256d\u256e\u2570\u256f\u2500]/g, "");
		for (const [columns, rows] of [[80, 6], [20, 8], [40, 12], [80, 24]]) {
			const fx = newFixture({ roles });
			const before = snapshotDir(fx.dir);
			const { screen, pickers, send, custom } = fullscreen(columns, rows);
			const ctx = { hasUI: true, mode: "tui", cwd: os.tmpdir(), modelRegistry: registry(), ui: { select: async () => undefined, confirm: async () => true, notify() {}, custom } };
			const flow = editor.editRoleConfig(ctx);
			const pick = async (typed: string, label: string) => {
				const count = pickers.length;
				await until(() => pickers.length > count);
				const picker = pickers.at(-1);
				for (const ch of typed) send(ch);
				for (let i = 0; i <= 400 && picker.selectedLabel() !== label; i++) send(KEY.down);
				assert.equal(picker.selectedLabel(), label, `${columns}x${rows}: cannot reach ${label}`);
				send(KEY.enter);
			};
			await pick("alpha", "alpha");
			await pick(primary, `Current ${primary}`);
			await until(() => pickers.length >= 3);
			const menu = pickers[2];
			assert.equal(menu.title, `Fallbacks for alpha (primary ${primary})`);
			const base = Array.from({ length: rows }, (_, i) => (i === 0 ? "transcript" : ""));
			const seen = new Set<string>();
			const grab = () => {
				for (const line of screen.compositeOverlays(base, columns, rows)) seen.add(stripAnsi(line));
			};
			grab();
			for (let i = 0; i < 300; i++) {
				send(KEY.pageDown);
				grab();
			}
			// Per row: a wrapped row holds one entry; the primary wraps at narrow widths, so it is checked by fragments outside the title row.
			const body = [...seen].map(norm).filter((row) => !row.includes("(primary"));
			const reached = (piece: string) => body.some((row) => row.includes(norm(piece)));
			assert.ok(["Primary:", "anthropic", "haiku-5-5", "(connected)"].every(reached), `${columns}x${rows}: primary line not reachable`);
			// At 20 columns a two-digit number can wrap away from its ref, so each is checked on its own row.
			chain.forEach((ref, i) => assert.ok(reached(ref) && reached(`${i + 1}.`), `${columns}x${rows}: entry ${i + 1} not reachable`));
			for (let i = 0; i < 20 && menu.selectedLabel() !== "Done"; i++) send(KEY.down);
			assert.equal(menu.selectedLabel(), "Done", `${columns}x${rows}: Done not reachable`);
			assert.ok(stripAnsi(screen.compositeOverlays(base, columns, rows).join("\n")).includes("Done"), `${columns}x${rows}: selected action not visible`);
			send(KEY.escape);
			await flow;
			assert.equal(screen.hasOverlay(), false, `${columns}x${rows}: overlay left open`);
			assert.deepEqual(snapshotDir(fx.dir), before, `${columns}x${rows}: a role file changed`);
			screen.stop();
		}
	});

	test("fallback menu at 4 rows: an informational body never blocks the action list; Enter selects", () => {
		const { picker, done } = newPicker(["Add fallback", "Done"], { searchable: false, body: ["Primary: a/b (connected)", "Fallbacks: (none)"], optionalBody: true, tui: tuiRows(4) });
		const text = stripAnsi(picker.render(80).join("\n"));
		assert.match(text, /Done/);
		assert.doesNotMatch(text, /too small/);
		picker.handleInput(KEY.down);
		picker.handleInput(KEY.enter);
		assert.deepEqual(done, ["Done"]);
	});

	test("Add picker hint at 20x8: the informational body row shows and Enter still selects the first candidate", () => {
		const hint = ["Hidden: the primary and fallbacks already listed."];
		const short = newPicker(PICK_OPTIONS, { body: hint, optionalBody: true, tui: tuiRows(8) });
		const shortText = stripAnsi(short.picker.render(20).join("\n"));
		assert.doesNotMatch(shortText, /too small/);
		short.picker.handleInput(KEY.enter);
		assert.deepEqual(short.done, [PICK_OPTIONS[0]]);
		const tall = newPicker(PICK_OPTIONS, { body: hint, optionalBody: true, tui: tuiRows(12) });
		assert.match(stripAnsi(tall.picker.render(20).join("\n")), /Hidden:/);
	});

	test("Add picker at 20x12 and 20x16: a wrapped informational body never takes PgDn; PgDn moves the candidate list and Enter selects it", () => {
		for (const rows of [12, 16]) {
			const { picker, done } = newPicker(PICK_OPTIONS, { body: ["Hidden: the primary and fallbacks already listed."], optionalBody: true, tui: tuiRows(rows) });
			picker.render(20);
			picker.handleInput(KEY.pageDown);
			assert.equal(picker.selectedLabel(), PICK_OPTIONS[10], `${rows} rows: PgDn must page the list`);
			picker.handleInput(KEY.enter);
			assert.deepEqual(done, [PICK_OPTIONS[10]], `${rows} rows`);
		}
	});

	test("/subagent usage text lists roles and the exact roles branch stays a lazy import", () => {
		const src = fs.readFileSync(new URL("../index.ts", import.meta.url), "utf8");
		const usage = /Use \/subagent steer[^"]*/.exec(src)?.[0] ?? "";
		assert.match(usage, /, roles, create, or \/subagent to inspect/);
		assert.match(src, /if \(args\.trim\(\) === "roles"\) \{ const \{ editRoleConfig \} = await import\("\.\/roles-editor\.ts"\); await editRoleConfig\(ctx\); return; \}/);
	});

	// ---- Current primary pinned first; bare /subagent two-entry menu (behavior contract; RED before production edits) ----
	const CURRENT_REF = "anthropic/claude-opus-5-5";
	const ORACLE = [{ name: "oracle", provider: "anthropic", model: "claude-opus-5-5", fallbackModel: "", thinking: "high", tools: "read, grep, find, ls, bash, powershell" }];
	// Real connected catalog rows (no stub models): 60 entries with the current primary at index 11.
	const MODELS60: any[] = (() => {
		const rows = CATALOG.filter((m) => AUTHED.has(m.provider) && !m.id.includes("/") && !UNRESOLVABLE.has(`${m.provider}/${m.id}`) && `${m.provider}/${m.id}` !== CURRENT_REF).slice(0, 59);
		rows.splice(11, 0, CATALOG.find((m) => `${m.provider}/${m.id}` === CURRENT_REF));
		return rows;
	})();
	const registry60 = () => ({
		getAll: () => MODELS60,
		getAvailable: () => MODELS60,
		find: (provider: string, id: string) => CATALOG.find((m) => m.provider === provider && m.id === id),
		hasConfiguredAuth: (model: { provider: string }) => AUTHED.has(model.provider),
	});

	test("primary picker pins the current primary first and selects it (60 connected, current at index 11) with the marker visible before the first click at 80x24, 40x12, 20x8", async () => {
		assert.equal(MODELS60.findIndex((m) => `${m.provider}/${m.id}` === CURRENT_REF), 11);
		for (const [columns, rows] of [[80, 24], [40, 12], [20, 8]]) {
			newFixture({ roles: ORACLE });
			const { screen, pickers, send, custom } = fullscreen(columns, rows);
			const ctx = { hasUI: true, mode: "tui", cwd: os.tmpdir(), modelRegistry: registry60(), ui: { select: async () => undefined, confirm: async () => true, notify() {}, custom } };
			const flow = editor.editRoleConfig(ctx);
			send(KEY.enter);
			await until(() => pickers.length >= 2);
			const primary = pickers[1];
			assert.equal(primary.options[0], `Current ${CURRENT_REF}`, `${columns}x${rows}: current not pinned first`);
			assert.equal(primary.selectedLabel(), `Current ${CURRENT_REF}`, `${columns}x${rows}: current not preselected`);
			assert.equal(primary.options.filter((o: string) => o === CURRENT_REF).length, 0, `${columns}x${rows}: plain duplicate of the current primary`);
			assert.equal(primary.options.length, 60, `${columns}x${rows}: pinned row plus 59 plain rows`);
			const base = Array.from({ length: rows }, (_, i) => (i === 0 ? "transcript" : ""));
			const frame: string[] = screen.compositeOverlays(base, columns, rows);
			assert.ok(frame.length <= rows && frame.every((line) => piTui.visibleWidth(line) <= columns), `${columns}x${rows}: frame exceeds the terminal`);
			assert.ok(stripAnsi(frame.join("\n")).includes(columns >= 40 ? `Current ${CURRENT_REF.split("/")[0]}/` : "Current"), `${columns}x${rows}: current marker or provider not visible at first click`);
			send(KEY.escape);
			await flow;
			screen.stop();
		}
	});

	test("current label: connected is pinned once with no suffix; disconnected and out-of-catalog keep the exact ref and access suffix; the label maps to that ref", async () => {
		const cases: Array<[string, string]> = [
			[SLASH_REF, `Current ${SLASH_REF}`],
			[DISCONNECTED_REF, `Current ${DISCONNECTED_REF} (not connected)`],
			["anthropic/not-in-catalog-model", "Current anthropic/not-in-catalog-model (not in installed catalog)"],
		];
		for (const [ref, label] of cases) {
			const [provider, ...rest] = ref.split("/");
			newFixture({ roles: [{ name: "alpha", provider, model: rest.length > 1 ? ref : rest.join("/"), fallbackModel: "", thinking: "off", tools: "read" }] });
			let seen: string[] = [];
			const run = fakeCtx(["alpha", (_t: string, opts: string[]) => { seen = opts; return opts[0]; }, "Done", (_t: string, opts: string[]) => opts[0], CANCEL], true, { custom: true });
			await editor.editRoleConfig(run.ctx);
			assert.equal(seen[0], label, `${ref}: pinned label`);
			assert.equal(seen.filter((o) => o === ref).length, 0, `${ref}: plain duplicate row`);
			assert.equal(seen.filter((o) => o.replace(/^Current /, "").replace(/ \([^)]*\)$/, "") === ref).length, 1, `${ref}: exactly one row maps to the current ref`);
			assert.equal(run.dialogs[2].title, `Fallbacks for alpha (primary ${ref})`, `${ref}: label did not map back to the exact ref`);
		}
	});

	test("primary picker filter 'opus' selects the current row first; Escape at the primary step saves nothing and opens no next step", async () => {
		const fx = newFixture({ roles: ORACLE });
		const before = snapshotDir(fx.dir);
		const { screen, pickers, send, custom } = fullscreen(80, 24);
		const ctx = { hasUI: true, mode: "tui", cwd: os.tmpdir(), modelRegistry: registry60(), ui: { select: async () => undefined, confirm: async () => true, notify() {}, custom } };
		const flow = editor.editRoleConfig(ctx);
		send(KEY.enter);
		await until(() => pickers.length >= 2);
		for (const ch of "opus") send(ch);
		assert.equal(pickers[1].selectedLabel(), `Current ${CURRENT_REF}`);
		send(KEY.escape);
		await flow;
		assert.equal(pickers.length, 2, "Escape must not open another step");
		assert.deepEqual(snapshotDir(fx.dir), before, "cancelled filter writes nothing");
		screen.stop();
	});

	test("scratch oracle (anthropic/claude-opus-5-5, empty fallback): Save keeps fallbackModel empty in roles.json and oracle.md; Cancel leaves every byte identical", async () => {
		const fx = newFixture({ roles: ORACLE });
		const before = snapshotDir(fx.dir);
		const steps = ["oracle", choose(`Current ${CURRENT_REF}`), "Done", choose("medium")];
		await editor.editRoleConfig(fakeCtx([...steps, CANCEL], true, { custom: true }).ctx);
		assert.deepEqual(snapshotDir(fx.dir), before, "Cancel must leave every byte identical");
		await editor.editRoleConfig(fakeCtx([...steps, SAVE], true, { custom: true }).ctx);
		const reg = JSON.parse(fs.readFileSync(fx.registryPath, "utf8"))[0];
		assert.equal(reg.fallbackModel, "");
		assert.equal(reg.thinking, "medium");
		const md = fs.readFileSync(fx.agentPath("oracle"), "utf8");
		assert.match(md, /^fallbackModel: ""$/m);
		assert.match(md, /^thinking: medium$/m);
		assert.doesNotMatch(md, /github-copilot/);
	});

	// Real registered bare command: WorkerMonitor registers through a stub Pi; the captured handlers are the production path.
	const monitorModule: any = await import(new URL("../monitor.ts", import.meta.url).href);
	const MENU_TITLE = "Subagent workers";
	function bareHarness() {
		const commands = new Map<string, any>();
		const shortcuts = new Map<string, any>();
		const pi: any = { on() {}, registerCommand: (name: string, spec: any) => commands.set(name, spec), registerShortcut: (key: string, spec: any) => shortcuts.set(key, spec), getSettings: () => ({}) };
		const monitor = new monitorModule.WorkerMonitor(pi);
		return { monitor, bare: commands.get("subagent").handler as (args: string, ctx: any) => Promise<void>, shortcut: shortcuts.get("ctrl+shift+w").handler as (ctx: any) => Promise<void> };
	}
	// TUI ctx: each custom picker is built by the production factory and driven by the test (answer picks its label, undefined = Escape).
	function menuCtx(answer: (picker: any) => string | undefined, opts: { mode?: string } = {}) {
		const calls: Array<{ kind: string; title?: string; options?: unknown }> = [];
		const notes: Array<{ message: string; type?: string }> = [];
		const seen: any[] = [];
		const ctx: any = {
			hasUI: true, mode: opts.mode ?? "tui", cwd: os.tmpdir(), modelRegistry: registry(),
			ui: {
				select: async (title: string, options: string[]) => { calls.push({ kind: "select", title, options }); return undefined; },
				confirm: async () => false,
				notify: (message: string, type?: string) => notes.push({ message, type }),
				custom: (factory: any) => {
					let value: unknown;
					const picker = factory(stubTui, stubTheme, piTui.getKeybindings(), (r: unknown) => { value = r; });
					seen.push(picker);
					calls.push({ kind: "custom", title: picker.title, options: picker.options });
					drivePicker(picker, answer(picker));
					return Promise.resolve(value);
				},
			},
		};
		return { ctx, calls, notes, seen };
	}

	test("bare /subagent (TUI): one menu, Inspect workers (0) first and preselected, then Edit roles; Esc does nothing", async () => {
		const h = bareHarness();
		const menu = menuCtx(() => undefined);
		await h.bare("", menu.ctx);
		assert.equal(menu.calls.length, 1, "exactly one dialog");
		assert.equal(menu.calls[0].title, MENU_TITLE);
		assert.deepEqual(menu.calls[0].options, ["Inspect workers (0)", "Edit roles", "Create agent"]);
		assert.equal(menu.seen[0].selectedLabel(), "Inspect workers (0)");
		assert.deepEqual(menu.notes, []);
	});

	test("bare /subagent: the Inspect entry counts retained workers, e.g. Inspect workers (2)", async () => {
		const h = bareHarness();
		h.monitor.store.begin("a", "t", "anthropic/claude-opus-5-5", "high");
		h.monitor.store.begin("b", "t", "anthropic/claude-opus-5-5", "high");
		const menu = menuCtx(() => undefined);
		await h.bare("", menu.ctx);
		assert.deepEqual(menu.calls[0]?.options, ["Inspect workers (2)", "Edit roles", "Create agent"]);
	});

	test("bare /subagent: Inspect with no workers notifies 'No subagent workers yet.' and opens nothing", async () => {
		const h = bareHarness();
		const menu = menuCtx((p) => (p.title === MENU_TITLE ? "Inspect workers (0)" : undefined));
		await h.bare("", menu.ctx);
		assert.equal(menu.calls.length, 1, "no inspector or second dialog");
		assert.deepEqual(menu.notes, [{ message: "No subagent workers yet.", type: "info" }]);
	});

	test("bare /subagent: Edit roles runs the existing role editor once with no workers; Cancel at its first step writes nothing", async () => {
		const fx = newFixture();
		const before = snapshotDir(fx.dir);
		const h = bareHarness();
		const menu = menuCtx((p) => (p.title === MENU_TITLE ? "Edit roles" : undefined));
		await h.bare("", menu.ctx);
		assert.equal(menu.calls.filter((c) => c.title === MENU_TITLE).length, 1, "menu shown once");
		assert.equal(menu.calls.filter((c) => c.title === "Edit role model settings").length, 1, "role editor opened once");
		assert.deepEqual(snapshotDir(fx.dir), before);
	});

	test("bare /subagent without UI (print): one line naming the existing commands; no popup", async () => {
		const h = bareHarness();
		const notes: Array<{ message: string; type?: string }> = [];
		const noPopup = () => { throw new Error("no popup without UI"); };
		const ctx: any = { hasUI: false, mode: "print", cwd: os.tmpdir(), modelRegistry: registry(), ui: { notify: (message: string, type?: string) => notes.push({ message, type }), select: noPopup, confirm: noPopup, custom: noPopup } };
		await h.bare("", ctx);
		assert.equal(notes.length, 1);
		assert.doesNotMatch(notes[0].message, /\n/);
		assert.match(notes[0].message, /steer #N message.*list.*result bg-N.*roles/);
	});

	test("bare /subagent in RPC (hasUI, mode rpc): ctx.ui.select fallback with the same two entries; no custom component", async () => {
		const h = bareHarness();
		const menu = menuCtx(() => undefined, { mode: "rpc" });
		await h.bare("", menu.ctx);
		assert.deepEqual(menu.calls, [{ kind: "select", title: MENU_TITLE, options: ["Inspect workers (0)", "Edit roles", "Create agent"] }]);
	});

	test("bare-command args unchanged: 'roles' and 'list' still reach the control path and never open the menu", async () => {
		const got: string[] = [];
		const h = bareHarness();
		h.monitor.control = async (args: string) => { got.push(args); };
		const menu = menuCtx(() => undefined);
		await h.bare("roles", menu.ctx);
		await h.bare("list", menu.ctx);
		assert.deepEqual(got, ["roles", "list"]);
		assert.deepEqual(menu.calls, []);
	});

	test("bare /subagent while the menu is already open keeps it: a second bare call opens no duplicate menu", async () => {
		const h = bareHarness();
		let customs = 0;
		const ctx: any = { hasUI: true, mode: "tui", cwd: os.tmpdir(), modelRegistry: registry(), ui: { notify() {}, select: async () => undefined, confirm: async () => false, custom: () => { customs++; return new Promise(() => {}); } } };
		void h.bare("", ctx);
		await new Promise((r) => setTimeout(r, 5));
		void h.bare("", ctx);
		await new Promise((r) => setTimeout(r, 5));
		assert.equal(customs, 1, "second bare call opened a duplicate window");
	});

	test("Ctrl+Shift+W while the bare menu is open adds no window and leaves the menu as it was; after Esc the shortcut opens the inspector once", async () => {
		const h = bareHarness();
		h.monitor.store.begin("a", "t", "anthropic/claude-opus-5-5", "high");
		const windows: string[] = [];
		let menuPicker: any;
		let closeMenu: ((value: unknown) => void) | undefined;
		const ctx: any = { hasUI: true, mode: "tui", cwd: os.tmpdir(), modelRegistry: registry(), ui: { notify() {}, select: async () => undefined, confirm: async () => false, onTerminalInput: () => () => {}, custom: (factory: any) => {
			if (windows.length === 0) return new Promise((resolve) => { menuPicker = factory(stubTui, stubTheme, piTui.getKeybindings(), resolve); windows.push(menuPicker.title); closeMenu = resolve; });
			windows.push("inspector");
			return new Promise(() => {});
		} } };
		void h.bare("", ctx);
		await until(() => windows.length >= 1);
		void h.shortcut(ctx);
		await new Promise((r) => setTimeout(r, 5));
		assert.deepEqual(windows, [MENU_TITLE], "Ctrl+Shift+W added a window over the open menu");
		assert.equal(menuPicker.selectedLabel(), "Inspect workers (1)", "menu selection changed");
		closeMenu?.(undefined);
		await new Promise((r) => setTimeout(r, 5));
		void h.shortcut(ctx);
		await until(() => windows.length >= 2);
		assert.deepEqual(windows, [MENU_TITLE, "inspector"], "after Esc the shortcut opens the inspector once");
	});

	test("bare /subagent: Inspect with one live worker opens the inspector once, after the menu closes", async () => {
		const h = bareHarness();
		h.monitor.store.begin("a", "t", "anthropic/claude-opus-5-5", "high");
		const windows: string[] = [];
		const ctx: any = { hasUI: true, mode: "tui", cwd: os.tmpdir(), modelRegistry: registry(), ui: { notify() {}, select: async () => undefined, confirm: async () => false, onTerminalInput: () => () => {}, custom: (factory: any) => {
			if (windows.length === 0) return new Promise((resolve) => { const picker = factory(stubTui, stubTheme, piTui.getKeybindings(), resolve); windows.push(picker.title); drivePicker(picker, "Inspect workers (1)"); });
			windows.push("inspector");
			return new Promise(() => {});
		} } };
		void h.bare("", ctx);
		await until(() => windows.length >= 2);
		await new Promise((r) => setTimeout(r, 5));
		assert.deepEqual(windows, [MENU_TITLE, "inspector"], "one menu, then exactly one inspector window");
	});

	test("bare /subagent while the inspector is open: no menu and no second window", async () => {
		const h = bareHarness();
		h.monitor.store.begin("a", "t", "anthropic/claude-opus-5-5", "high");
		let customs = 0;
		const notes: string[] = [];
		const ctx: any = { hasUI: true, mode: "tui", cwd: os.tmpdir(), modelRegistry: registry(), ui: { notify: (m: string) => notes.push(m), select: async () => undefined, confirm: async () => false, onTerminalInput: () => () => {}, custom: () => { customs++; return new Promise(() => {}); } } };
		void h.shortcut(ctx);
		await new Promise((r) => setTimeout(r, 5));
		assert.equal(customs, 1, "Ctrl+Shift+W opened the inspector");
		void h.bare("", ctx);
		await new Promise((r) => setTimeout(r, 5));
		assert.equal(customs, 1, "bare /subagent added a menu or window over the open inspector");
		assert.deepEqual(notes, []);
	});

	test("bare /subagent: a menu whose window throws or rejects clears the guard; the next bare call shows the menu", async () => {
		for (const failure of [(): never => { throw new Error("boom"); }, (): Promise<never> => Promise.reject(new Error("boom"))]) {
			const h = bareHarness();
			const broken: any = { hasUI: true, mode: "tui", cwd: os.tmpdir(), modelRegistry: registry(), ui: { notify() {}, select: async () => undefined, confirm: async () => false, custom: failure } };
			await assert.rejects(h.bare("", broken), /boom/);
			const menu = menuCtx(() => undefined);
			await h.bare("", menu.ctx);
			assert.equal(menu.calls.length, 1, "menu guard stuck after a failed window");
			assert.equal(menu.calls[0].title, MENU_TITLE);
		}
	});

	test("Ctrl+Shift+W stays the direct inspector: silent with no workers and no menu; with a worker one inspector window at the shared options", async () => {
		const h = bareHarness();
		const log: string[] = [];
		const ctx: any = { hasUI: true, mode: "tui", cwd: os.tmpdir(), modelRegistry: registry(), ui: { notify: (m: string) => log.push(`notify ${m}`), select: async () => undefined, confirm: async () => false, custom: (_f: unknown, o: any) => { log.push(`custom ${o?.overlay} ${JSON.stringify(o?.overlayOptions)}`); return new Promise(() => {}); } } };
		await h.shortcut(ctx);
		assert.deepEqual(log, []);
		h.monitor.store.begin("a", "t", "anthropic/claude-opus-5-5", "high");
		void h.shortcut(ctx);
		await new Promise((r) => setTimeout(r, 5));
		assert.deepEqual(log, [`custom true ${JSON.stringify({ width: "98%", maxHeight: "94%", anchor: "center", margin: 1 })}`]);
	});

	test("bare /subagent fullscreen at 40x12 and 20x8: both entries visible on the composed screen; Down reaches Edit roles; Escape does nothing", async () => {
		for (const [columns, rows] of [[40, 12], [20, 8]]) {
			const fx = newFixture();
			const before = snapshotDir(fx.dir);
			const h = bareHarness();
			const { screen, pickers, send, custom } = fullscreen(columns, rows);
			const ctx: any = { hasUI: true, mode: "tui", cwd: os.tmpdir(), modelRegistry: registry(), ui: { notify() {}, select: async () => undefined, confirm: async () => false, custom } };
			const flow = h.bare("", ctx);
			await until(() => pickers.length >= 1);
			const base = Array.from({ length: rows }, (_, i) => (i === 0 ? "transcript" : ""));
			const frame = stripAnsi(screen.compositeOverlays(base, columns, rows).join("\n"));
			assert.match(frame, /Inspect/, `${columns}x${rows}: Inspect entry not visible`);
			// 20x8 fits one list row; the 3-entry list scrolls, so Edit roles is asserted visible only at 40x12 and reached by Down below.
			if (columns >= 40) assert.match(frame, /Edit roles/, `${columns}x${rows}: Edit roles entry not visible`);
			assert.equal(pickers[0].selectedLabel(), "Inspect workers (0)");
			send(KEY.down);
			assert.equal(pickers[0].selectedLabel(), "Edit roles", `${columns}x${rows}: Down did not reach Edit roles`);
			send(KEY.down);
			assert.equal(pickers[0].selectedLabel(), "Create agent", `${columns}x${rows}: second Down did not reach Create agent`);
			send(KEY.escape);
			await flow;
			assert.equal(pickers.length, 1, "Escape must not open another step");
			assert.deepEqual(snapshotDir(fx.dir), before);
			screen.stop();
		}
	});

	test("monitor.ts keeps roles-editor out of static imports; the bare handler lazy-imports it; pickFrom is exported", () => {
		const monitorSrc = fs.readFileSync(new URL("../monitor.ts", import.meta.url), "utf8");
		assert.doesNotMatch(monitorSrc, /^import[^;]*roles-editor/m);
		assert.match(monitorSrc, /await import\("\.\/roles-editor\.ts"\)/);
		const editorSrc = fs.readFileSync(new URL("../roles-editor.ts", import.meta.url), "utf8");
		assert.match(editorSrc, /^export function pickFrom\(/m);
	});

	// Packaged defaults (RED first): the editor lists the package's default roles, saves only a user roles.json override and never copies a definition.
	const PKG_ROLES = [
		{ name: "pkg-one", provider: "anthropic", model: "claude-haiku-5-5", fallbackModel: "openai-codex/gpt-6-luna || github-copilot/gpt-6-luna", thinking: "low", tools: "read, grep" },
		{ name: "pkg-two", provider: "openai-codex", model: "gpt-6-luna", fallbackModel: "", thinking: "medium", tools: "read" },
	];
	function packageFixture(): string {
		const pkg = fs.mkdtempSync(path.join(os.tmpdir(), "roles-editor-pkg-"));
		dirs.push(pkg);
		fs.mkdirSync(path.join(pkg, "defaults", "agents"), { recursive: true });
		fs.writeFileSync(path.join(pkg, "defaults", "roles.json"), formatJson(PKG_ROLES, "\n"));
		for (const role of PKG_ROLES) fs.writeFileSync(path.join(pkg, "defaults", "agents", `${role.name}.md`), roleMd(role, "\n"));
		return pkg;
	}
	function freshProfile(): string {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "roles-editor-fresh-"));
		dirs.push(dir);
		process.env.PI_CODING_AGENT_DIR = dir;
		return dir;
	}

	test("fresh profile lists the packaged defaults and saves only a roles.json override with no definition copy", async () => {
		const pkg = packageFixture();
		const dir = freshProfile();
		const pkgBefore = snapshotDir(pkg);
		const run = fakeCtx(["pkg-one", choose(SLASH_REF), choose("Done"), choose("high"), SAVE], true, { custom: true });
		await editor.editRoleConfig(run.ctx, { packageRoot: pkg });
		assert.deepEqual(run.dialogs[0].options, ["pkg-one", "pkg-two"]);
		assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "roles.json"), "utf8")), [
			{ name: "pkg-one", provider: "baseten", model: SLASH_REF, fallbackModel: "openai-codex/gpt-6-luna || github-copilot/gpt-6-luna", thinking: "high" },
		]);
		assert.equal(fs.existsSync(path.join(dir, "agents")), false, "no definition copy may be created");
		assert.deepEqual(snapshotDir(pkg), pkgBefore, "package defaults are read-only");
	});

	test("cancelling the packaged-role flow writes nothing in a fresh profile", async () => {
		const pkg = packageFixture();
		const dir = freshProfile();
		const run = fakeCtx(["pkg-one", choose(SLASH_REF), undefined]);
		await editor.editRoleConfig(run.ctx, { packageRoot: pkg });
		assert.deepEqual(fs.readdirSync(dir), []);
		assert.match(run.notes.at(-1)?.message ?? "", /cancelled; nothing saved/);
	});

	test("a fresh profile without any package default still reports that no roles exist", async () => {
		const dir = freshProfile();
		const run = fakeCtx([]);
		await editor.editRoleConfig(run.ctx, { packageRoot: null });
		assert.deepEqual(fs.readdirSync(dir), []);
		assert.equal(run.notes.at(-1)?.message, "roles.json has no roles to edit.");
	});

	test("a packaged-only role resolves its effective settings from the package registry", () => {
		const pkg = packageFixture();
		const dir = freshProfile();
		const snap = editor.readRoleSnapshot(dir, "pkg-one", pkg);
		assert.equal(snap.agentPath, null);
		assert.deepEqual(snap.current, { primary: "anthropic/claude-haiku-5-5", fallbacks: ["openai-codex/gpt-6-luna", "github-copilot/gpt-6-luna"], thinking: "low" });
	});

	test("a user roles.json entry with no definition in either tier is still refused", () => {
		const pkg = packageFixture();
		const fx = newFixture({ roles: [{ ...DEFAULT_ROLES[0], name: "ghost" }] });
		fs.rmSync(path.join(fx.dir, "agents"), { recursive: true });
		assert.throws(() => editor.readRoleSnapshot(fx.dir, "ghost", pkg), (e: Error) => e.name === "RoleEditError" && /missing definition file/.test(e.message));
	});
}
