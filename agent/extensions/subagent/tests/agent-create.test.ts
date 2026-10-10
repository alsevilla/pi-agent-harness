// Native /subagent create regression (RED first). Bun cannot resolve Pi packages from this directory, so under Bun this file
// relaunches the same body under the installed Node with registerHooks mapping bare Pi specifiers (roles-editor pattern).
// Every fixture lives under os.tmpdir() (the caller's TEMP/TMP); the real profile is only read (CLI copied into a synthetic agent dir).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const isBun = typeof (process.versions as Record<string, string>).bun === "string";
/** Test-only: an explicit Python 3 for the real-CLI test. Bare `python` on Windows is often the Store stub (exit 9009). */
const TEST_PYTHON_ENV = "SUBAGENT_CREATE_TEST_PYTHON";

/** Explicit env is used as given (it must run: a broken explicit interpreter fails, it does not skip). Otherwise the conventional launcher if it is functional, else undefined (skip). */
function resolveTestPython(): string | undefined {
	const explicit = process.env[TEST_PYTHON_ENV];
	if (explicit) return explicit;
	const conventional = process.platform === "win32" ? "python" : "python3";
	const probe = spawnSync(conventional, ["-I", "-X", "utf8", "-c", "import sys; print(sys.version_info[0])"], { encoding: "utf8", windowsHide: true, timeout: 20_000 });
	return probe.status === 0 && probe.stdout.trim() === "3" ? conventional : undefined;
}
const testPython = resolveTestPython();

if (isBun) {
	const { test } = await import("bun:test");
	test("native create suite passes under Node native TypeScript transform", () => {
		const env = { ...process.env, PYTHONDONTWRITEBYTECODE: "1" };
		delete env.NODE_TEST_CONTEXT;
		const run = spawnSync("node", ["--experimental-transform-types", "--test", thisFile], { encoding: "utf8", timeout: 300_000, windowsHide: true, env });
		assert.equal(run.status, 0, run.stdout + run.stderr);
	}, 320_000);
} else {
	await runNodeSuite();
}

async function runNodeSuite(): Promise<void> {
	const { test, after } = await import("node:test");
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
	const mod: any = await import(new URL("../agent-create.ts", import.meta.url).href);
	const editor: any = await import(new URL("../roles-editor.ts", import.meta.url).href);
	const monitorMod: any = await import(new URL("../monitor.ts", import.meta.url).href);
	const piTui: any = await import(installedUrl("pi-tui/dist/index.js"));
	const themeModule: any = await import(installedUrl("pi-coding-agent/dist/modes/interactive/theme/theme.js"));
	themeModule.initTheme("dark", false);
	const stubTheme = themeModule.getThemeByName("dark");
	const REAL_CLI = fileURLToPath(new URL("../../../skills/agent-creation/scripts/create_agent.py", import.meta.url));

	const SPEC_JSON = JSON.stringify({ name: "alpha-review", description: "Reviews alpha", instructions: "Review carefully.", model: "anthropic/claude-haiku-5-5" });
	const PREVIEW = "mode: preview\nproject root: <root>\npermissions: tools=read, grep, find, ls; write-tool=disabled; source-edit=readonly; writer=false; shell=false\nagent file: <root>/.pi/agents/alpha-review.md -> create\nno files written; re-run with --apply to create the files listed above\n--- BEGIN agent file: x ---\nbody\n--- END agent file ---\n";
	const exitOk = (stdout: string, stderr = "") => ({ kind: "exit", code: 0, stdout: Buffer.from(stdout, "utf8"), stderr: Buffer.from(stderr, "utf8") });
	const exitWith = (code: number, stderr = "", stdout = "") => ({ kind: "exit", code, stdout: Buffer.from(stdout, "utf8"), stderr: Buffer.from(stderr, "utf8") });
	const spawnFail = (code = "ENOENT") => ({ kind: "spawn", code, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) });
	const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

	// Scripted ctx: each prompt must match the next step in order; a function value answers from the prompt title/options.
	function harness(script: [string, unknown][], opts: { hasUI?: boolean; mode?: string } = {}) {
		const prompts: { kind: string; title: string }[] = [];
		const notes: { message: string; type?: string }[] = [];
		const statuses: { key: string; text: unknown }[] = [];
		const queue = [...script];
		const take = (kind: string, title: string, options?: string[]) => {
			prompts.push({ kind, title });
			const next = queue.shift();
			assert.ok(next, `unexpected ${kind} prompt: ${title}`);
			assert.equal(next[0], kind, `expected ${next[0]} but got ${kind}: ${title}`);
			return typeof next[1] === "function" ? (next[1] as (t: string, o?: string[]) => unknown)(title, options) : next[1];
		};
		const ctx = {
			hasUI: opts.hasUI ?? true,
			mode: opts.mode ?? "rpc",
			ui: {
				input: async (title: string) => take("input", title),
				select: async (title: string, options: string[]) => take("select", title, options),
				confirm: async (title: string) => take("confirm", title),
				notify: (message: string, type?: string) => notes.push({ message, type }),
				setStatus: (key: string, text: unknown) => statuses.push({ key, text }),
			},
		};
		return { ctx, prompts, notes, statuses, queue };
	}

	function fakeRunner(handler: (args: string[], cmd: string, opts: any, n: number) => any) {
		const calls: { cmd: string; args: string[]; cwd?: string; timeoutMs?: number }[] = [];
		const run = async (cmd: string, args: string[], opts: any) => {
			calls.push({ cmd, args: [...args], cwd: opts.cwd, timeoutMs: opts.timeoutMs });
			return handler(args, cmd, opts, calls.length);
		};
		return { run, calls };
	}

	const bases: string[] = [];
	after(() => { for (const base of bases) fs.rmSync(base, { recursive: true, force: true }); });
	function workspace() {
		const base = fs.mkdtempSync(path.join(os.tmpdir(), "subagent-create-case-"));
		bases.push(base);
		const root = path.join(base, "project");
		fs.mkdirSync(root);
		const agentDir = path.join(base, "global");
		fs.mkdirSync(path.join(agentDir, "skills", "agent-creation", "scripts"), { recursive: true });
		fs.writeFileSync(path.join(agentDir, "roles.json"), "[]");
		fs.writeFileSync(path.join(agentDir, "skills", "agent-creation", "scripts", "create_agent.py"), "# stub: never executed by fake runners\n");
		const spec = path.join(base, "spec.json");
		fs.writeFileSync(spec, SPEC_JSON);
		const tmpRoot = path.join(base, "owned-tmp");
		fs.mkdirSync(tmpRoot);
		return { base, root, agentDir, spec, tmpRoot };
	}
	const deps = (w: ReturnType<typeof workspace>, run: any, extra: Record<string, unknown> = {}) => ({ run, python: "PYEXE", agentDir: w.agentDir, tmpRoot: w.tmpRoot, ...extra });
	const frozenOf = (args: string[]) => args[args.indexOf("--spec") + 1];
	const ownedDirs = (w: ReturnType<typeof workspace>) => fs.readdirSync(w.tmpRoot);

	// --- entry, prompts, cancel --------------------------------------------------------------------------------------------

	test("no UI: notifies and runs nothing", async () => {
		const w = workspace();
		const h = harness([], { hasUI: false });
		const fake = fakeRunner(() => exitOk(PREVIEW));
		await mod.runAgentCreate(h.ctx, "", deps(w, fake.run));
		assert.equal(fake.calls.length, 0);
		assert.equal(h.prompts.length, 0);
		assert.match(h.notes[0].message, /needs an interactive session; nothing was created/);
		assert.deepEqual(ownedDirs(w), []);
	});

	test("help and unknown arguments: informational help; unknown args fail closed with no prompt or run", async () => {
		assert.equal(mod.parseCreateArgs("").kind, "flow");
		assert.equal(mod.parseCreateArgs("  help ").kind, "help");
		assert.equal(mod.parseCreateArgs("--apply").kind, "unknown");
		const w = workspace();
		const h = harness([]);
		const fake = fakeRunner(() => exitOk(PREVIEW));
		await mod.runAgentCreate(h.ctx, "help", deps(w, fake.run));
		assert.match(h.notes.at(-1).message, /\/subagent create/);
		await mod.runAgentCreate(h.ctx, "--apply now", deps(w, fake.run));
		assert.match(h.notes.at(-1).message, /Unknown \/subagent create argument/);
		assert.equal(h.prompts.length, 0);
		assert.equal(fake.calls.length, 0);
	});

	test("Cancel at the project-root prompt writes nothing and creates no owned temp dir", async () => {
		const w = workspace();
		const h = harness([["input", undefined]]);
		const fake = fakeRunner(() => exitOk(PREVIEW));
		await mod.runAgentCreate(h.ctx, "", deps(w, fake.run));
		assert.equal(fake.calls.length, 0);
		assert.deepEqual(fs.readdirSync(w.root), []);
		assert.deepEqual(ownedDirs(w), []);
		assert.equal(h.statuses.at(-1).text, undefined);
	});

	test("project root must be absolute: relative is re-prompted; surrounding quotes are trimmed", async () => {
		const w = workspace();
		const h = harness([["input", "relative/project"], ["input", `"${w.root}"`], ["input", undefined]]);
		const fake = fakeRunner(() => exitOk(PREVIEW));
		await mod.runAgentCreate(h.ctx, "", deps(w, fake.run));
		assert.match(h.notes[0].message, /absolute/);
		assert.equal(fake.calls.length, 0);
		assert.equal(h.queue.length, 0);
	});

	test("spec path: directory, relative and oversized (>256 KiB) files are rejected; Cancel at the spec prompt runs nothing", async () => {
		const w = workspace();
		const big = path.join(w.base, "big.json");
		fs.writeFileSync(big, Buffer.alloc(256 * 1024 + 1, 0x20));
		const h = harness([["input", w.root], ["input", w.base], ["input", "spec.json"], ["input", big], ["input", undefined]]);
		const fake = fakeRunner(() => exitOk(PREVIEW));
		await mod.runAgentCreate(h.ctx, "", deps(w, fake.run));
		const errors = h.notes.filter((n) => n.type === "error").map((n) => n.message).join("\n");
		assert.match(errors, /not a file/);
		assert.match(errors, /absolute/);
		assert.match(errors, /256 KiB/);
		assert.equal(fake.calls.length, 0);
		assert.deepEqual(ownedDirs(w), []);
	});

	// --- freeze and preview -----------------------------------------------------------------------------------------------

	test("preview freezes exact spec bytes in an owned temp dir; argv is exact and isolated; no grants; Cancel at review runs no apply", async () => {
		const w = workspace();
		let seen: Buffer | undefined;
		const h = harness([["input", w.root], ["input", w.spec], ["confirm", false]]);
		const fake = fakeRunner((args) => { seen = fs.readFileSync(frozenOf(args)); return exitOk(PREVIEW); });
		await mod.runAgentCreate(h.ctx, "", deps(w, fake.run));
		assert.equal(fake.calls.length, 1);
		const [call] = fake.calls;
		const frozen = frozenOf(call.args);
		assert.equal(call.cmd, "PYEXE");
		assert.deepEqual(call.args.slice(0, 4), ["-I", "-X", "utf8", path.join(w.agentDir, "skills", "agent-creation", "scripts", "create_agent.py")]);
		assert.deepEqual(call.args.slice(4), ["--spec", frozen, "--project-root", w.root, "--agent-dir", w.agentDir]);
		assert.equal(call.timeoutMs, 30_000);
		assert.equal(call.cwd, path.dirname(frozen));
		assert.ok(path.dirname(frozen).startsWith(w.tmpRoot), "frozen dir must be in the owned temp root");
		assert.ok(seen && seen.equals(fs.readFileSync(w.spec)), "frozen bytes equal the original spec bytes");
		assert.equal(call.args.some((a) => a.startsWith("--allow-") || a === "--apply"), false);
		assert.deepEqual(fs.readdirSync(w.root), [], "no project writes");
		assert.deepEqual(ownedDirs(w), [], "owned temp dir removed on cancel");
		assert.equal(h.statuses.at(-1).text, undefined, "status cleared");
	});

	test("original spec edited after preview: CREATE still applies the frozen bytes with argv equal to preview plus --apply", async () => {
		const w = workspace();
		let frozenAtPreview: Buffer | undefined;
		const h = harness([["input", w.root], ["input", w.spec], ["confirm", true]]);
		const fake = fakeRunner((args) => {
			if (args.includes("--apply")) return exitOk("created: <root>/.pi/agents/alpha-review.md\n");
			frozenAtPreview ??= fs.readFileSync(frozenOf(args));
			fs.writeFileSync(w.spec, JSON.stringify({ name: "changed", description: "x", instructions: "y", model: "m" }));
			return exitOk(PREVIEW);
		});
		await mod.runAgentCreate(h.ctx, "", deps(w, fake.run));
		assert.equal(fake.calls.length, 3, "preview, re-preview, apply");
		const [preview, repreview, apply] = fake.calls;
		assert.deepEqual(apply.args, [...preview.args, "--apply"]);
		assert.deepEqual(repreview.args, preview.args);
		assert.equal(apply.timeoutMs, undefined, "apply has no timeout");
		assert.ok(frozenAtPreview && frozenAtPreview.equals(Buffer.from(SPEC_JSON)));
		assert.deepEqual(ownedDirs(w), []);
	});

	test("tampered frozen copy aborts before any apply", async () => {
		const w = workspace();
		const h = harness([["input", w.root], ["input", w.spec], ["confirm", true]]);
		const fake = fakeRunner((args) => {
			fs.writeFileSync(frozenOf(args), "{\"tampered\":true}");
			return exitOk(PREVIEW);
		});
		await mod.runAgentCreate(h.ctx, "", deps(w, fake.run));
		assert.equal(fake.calls.filter((c) => c.args.includes("--apply")).length, 0);
		assert.match(h.notes.map((n) => n.message).join("\n"), /frozen spec changed; nothing written/);
		assert.deepEqual(fs.readdirSync(w.root), []);
		assert.deepEqual(ownedDirs(w), []);
	});

	for (const [label, tampered, repeat] of [
		["valid JSON", '{"tampered":true}', exitOk(`${PREVIEW}tampered\n`)],
		["invalid JSON", "not json {", exitWith(1, "ERROR: spec is not valid JSON\n")],
	] as const) {
		test(`tampered frozen copy during review (${label}): honest 'frozen spec changed', not 'project changed'; nothing applied`, async () => {
			const w = workspace();
			const fake = fakeRunner((_args, _cmd, _opts, n) => (n === 2 ? repeat : exitOk(PREVIEW)));
			const h = harness([["input", w.root], ["input", w.spec], ["confirm", () => { fs.writeFileSync(frozenOf(fake.calls[0].args), tampered); return true; }]]);
			await mod.runAgentCreate(h.ctx, "", deps(w, fake.run));
			const text = h.notes.map((n) => n.message).join("\n");
			assert.equal(fake.calls.filter((c) => c.args.includes("--apply")).length, 0);
			assert.match(text, /frozen spec changed; nothing written/);
			assert.doesNotMatch(text, /project changed since preview/);
			assert.deepEqual(fs.readdirSync(w.root), []);
			assert.deepEqual(ownedDirs(w), []);
		});
	}

	test("project change between CREATE and apply (re-preview differs) aborts with nothing applied", async () => {
		const w = workspace();
		const h = harness([["input", w.root], ["input", w.spec], ["confirm", true]]);
		const fake = fakeRunner((args, _cmd, _opts, n) => (n === 2 ? exitOk(PREVIEW + "changed\n") : exitOk(PREVIEW)));
		await mod.runAgentCreate(h.ctx, "", deps(w, fake.run));
		assert.equal(fake.calls.filter((c) => c.args.includes("--apply")).length, 0);
		assert.match(h.notes.map((n) => n.message).join("\n"), /project changed since preview; nothing written/);
	});

	// --- grants (refusal-driven, per run, independent) ---------------------------------------------------------------------

	test("writer refusal: offered after the exact CLI message with Cancel first; accepting re-previews with --allow-writers only", async () => {
		const w = workspace();
		const h = harness([["input", w.root], ["input", w.spec], ["select", (_t: string, o: string[]) => { assert.equal(o[0], "Cancel (default)"); return o[1]; }], ["confirm", true]]);
		const fake = fakeRunner((args, _c, _o, n) => (n === 1 ? exitWith(1, "ERROR: writer:true requires --allow-writers\n") : args.includes("--apply") ? exitOk("created: x\n") : exitOk(PREVIEW)));
		await mod.runAgentCreate(h.ctx, "", deps(w, fake.run));
		assert.equal(fake.calls.length, 4, "preview, re-preview after grant, repeat before apply, apply");
		const [first, second] = fake.calls;
		const apply = fake.calls.at(-1)!;
		assert.equal(first.args.includes("--allow-writers"), false, "no default grant");
		assert.ok(second.args.includes("--allow-writers"));
		assert.equal(second.args.includes("--allow-shell"), false, "writer yes does not add shell");
		assert.deepEqual(apply.args, [...second.args, "--apply"]);
	});

	test("declined grant (Cancel) runs no re-preview and no apply; unmatched refusal text fails closed with no grant prompt", async () => {
		const w = workspace();
		const h = harness([["input", w.root], ["input", w.spec], ["select", (_t: string, o: string[]) => o[0]]]);
		const fake = fakeRunner(() => exitWith(1, "ERROR: shell:bash requires --allow-shell\n"));
		await mod.runAgentCreate(h.ctx, "", deps(w, fake.run));
		assert.equal(fake.calls.length, 1);

		const w2 = workspace();
		const h2 = harness([["input", w2.root], ["input", w2.spec]]);
		const fake2 = fakeRunner(() => exitWith(1, "ERROR: something unexpected happened\n"));
		await mod.runAgentCreate(h2.ctx, "", deps(w2, fake2.run));
		assert.equal(fake2.calls.length, 1);
		assert.match(h2.notes.map((n) => n.message).join("\n"), /something unexpected happened/);
	});

	test("shell refusal is offered separately; accepting adds only --allow-shell on the re-preview", async () => {
		const w = workspace();
		const h = harness([["input", w.root], ["input", w.spec], ["select", (_t: string, o: string[]) => o[1]], ["confirm", false]]);
		const fake = fakeRunner((_a, _c, _o, n) => (n === 1 ? exitWith(1, "ERROR: shell:powershell requires --allow-shell\n") : exitOk(PREVIEW)));
		await mod.runAgentCreate(h.ctx, "", deps(w, fake.run));
		assert.equal(fake.calls.length, 2);
		assert.ok(fake.calls[1].args.includes("--allow-shell"));
		assert.equal(fake.calls[1].args.includes("--allow-writers"), false);
	});

	// --- exit mapping: nothing but a zero exit with exact stdout can reach CREATE ------------------------------------------

	const failures: [string, unknown, RegExp][] = [
		["usage exit 2", exitWith(2, "usage: create_agent.py\n"), /usage|mismatch/i],
		["nonzero 7 without ERROR text", exitWith(7, "boom\n"), /unexpected exit 7/],
		["killed by timeout", { kind: "killed", signal: "SIGTERM", stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }, /timed out or was killed/],
		["output overflow", { kind: "overflow", stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }, /output exceeded/],
		["invalid UTF-8 stdout", exitOk("\u0000"), /valid UTF-8/],
	];
	for (const [label, result, pattern] of failures) {
		test(`preview ${label}: nothing applies and the message is distinct`, async () => {
			const w = workspace();
			const h = harness([["input", w.root], ["input", w.spec]]);
			const bad = label === "invalid UTF-8 stdout" ? { ...exitOk(""), stdout: Buffer.from([0xff, 0xfe, 0x41]) } : result;
			const fake = fakeRunner((args) => (args.includes("--apply") ? assert.fail("apply must not run") : bad));
			await mod.runAgentCreate(h.ctx, "", deps(w, fake.run));
			assert.equal(fake.calls.length, 1);
			assert.match(h.notes.map((n) => n.message).join("\n"), pattern);
			assert.deepEqual(fs.readdirSync(w.root), []);
		});
	}

	test("spawn failure (launcher) offers an absolute interpreter path; Cancel stops; a supplied path is fixed for preview and apply", async () => {
		const w = workspace();
		const override = path.join(w.agentDir, "skills", "agent-creation", "scripts", "create_agent.py");
		const h = harness([["input", w.root], ["input", w.spec], ["input", "relative.exe"], ["input", override], ["confirm", true]]);
		const fake = fakeRunner((args) => {
			if (args.includes("--apply")) return exitOk("created: x\n");
			return fake.calls.length === 1 ? spawnFail() : exitOk(PREVIEW);
		});
		await mod.runAgentCreate(h.ctx, "", deps(w, fake.run));
		assert.match(h.prompts[2].title, /Absolute path to a Python 3 executable/);
		assert.match(h.notes.map((n) => n.message).join("\n"), /absolute/);
		assert.deepEqual(fake.calls.map((c) => c.cmd), ["PYEXE", override, override, override]);
	});

	test("non-executable absolute interpreter: the launcher prompt appears (not 'stopped'); Esc runs nothing and writes nothing", async () => {
		const w = workspace();
		const notExecutable = path.join(w.base, "not-python.txt");
		fs.writeFileSync(notExecutable, "not a program\n");
		const h = harness([["input", w.root], ["input", w.spec], ["input", undefined]]);
		await mod.runAgentCreate(h.ctx, "", { python: notExecutable, agentDir: w.agentDir, tmpRoot: w.tmpRoot });
		const text = h.notes.map((n) => n.message).join("\n");
		assert.match(h.prompts[2].title, /Absolute path to a Python 3 executable/);
		assert.match(text, /could not start/);
		assert.doesNotMatch(text, /stopped/);
		assert.deepEqual(fs.readdirSync(w.root), []);
		assert.deepEqual(ownedDirs(w), []);
	});

	test("launcher failure with Cancel at the override prompt runs nothing more", async () => {
		const w = workspace();
		const h = harness([["input", w.root], ["input", w.spec], ["input", undefined]]);
		const fake = fakeRunner(() => spawnFail());
		await mod.runAgentCreate(h.ctx, "", deps(w, fake.run));
		assert.equal(fake.calls.length, 1);
		assert.deepEqual(fs.readdirSync(w.root), []);
		assert.deepEqual(ownedDirs(w), []);
	});

	// --- apply ---------------------------------------------------------------------------------------------------------------

	test("apply exit 0 reports created lines and that nothing was activated, reloaded or launched", async () => {
		const w = workspace();
		const h = harness([["input", w.root], ["input", w.spec], ["confirm", true]]);
		const fake = fakeRunner((args) => (args.includes("--apply") ? exitOk("created: <root>/.pi/agents/alpha-review.md\n") : exitOk(PREVIEW)));
		await mod.runAgentCreate(h.ctx, "", deps(w, fake.run));
		const text = h.notes.map((n) => n.message).join("\n");
		assert.match(text, /created: /);
		assert.match(text, /Not active until used with agentScope project\/both; nothing reloaded, trusted or launched/);
	});

	test("apply exit 3 shows the complete partial report and deletes nothing", async () => {
		const w = workspace();
		const h = harness([["input", w.root], ["input", w.spec], ["confirm", true]]);
		const partialPath = path.join(w.root, ".pi", "agents", "alpha-review.md");
		const fake = fakeRunner((args) => (args.includes("--apply") ? exitWith(3, `ERROR: write failed after 0 complete file(s); partial file left at ${partialPath}: disk full; nothing was deleted; review the partial file before any cleanup\n`, `partial: ${partialPath}\n`) : exitOk(PREVIEW)));
		await mod.runAgentCreate(h.ctx, "", deps(w, fake.run));
		const text = h.notes.map((n) => n.message).join("\n");
		assert.match(text, /partial: /);
		assert.match(text, /nothing was deleted/);
		assert.ok(h.notes.some((n) => n.type === "error"));
	});

	test("apply killed or overflowed: unknown completion is reported, never retried", async () => {
		const w = workspace();
		const h = harness([["input", w.root], ["input", w.spec], ["confirm", true]]);
		const fake = fakeRunner((args) => (args.includes("--apply") ? { kind: "overflow", stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) } : exitOk(PREVIEW)));
		await mod.runAgentCreate(h.ctx, "", deps(w, fake.run));
		assert.equal(fake.calls.filter((c) => c.args.includes("--apply")).length, 1);
		assert.match(h.notes.map((n) => n.message).join("\n"), /unknown completion; not retried/);
	});

	test("unexpected error during create is reported, status cleared, owned temp dir removed", async () => {
		const w = workspace();
		const h = harness([["input", w.root], ["input", w.spec], ["confirm", true]]);
		const fake = fakeRunner((args) => { if (args.includes("--apply")) throw new Error("injected failure"); return exitOk(PREVIEW); });
		await mod.runAgentCreate(h.ctx, "", deps(w, fake.run));
		assert.match(h.notes.map((n) => n.message).join("\n"), /injected failure/);
		assert.deepEqual(ownedDirs(w), []);
		assert.equal(h.statuses.at(-1).text, undefined);
	});

	// --- process runner: exact UTF-8, bounds, classification (real child processes) --------------------------------------------

	test("runProcess keeps UTF-8 split across chunks exact", async () => {
		const text = "中文 😀 café\nΩ end\n";
		const script = `const b=Buffer.from(${JSON.stringify(text)},'utf8');let i=0;const t=setInterval(()=>{if(i>=b.length){clearInterval(t);return;}process.stdout.write(b.subarray(i,i+1));i++;},1);`;
		const r = await mod.runProcess(process.execPath, ["-e", script], { cwd: os.tmpdir() });
		assert.equal(r.kind, "exit");
		assert.equal(r.code, 0);
		assert.equal(new TextDecoder("utf-8", { fatal: true }).decode(r.stdout), text);
	});

	test("runProcess: >2 MiB output is an overflow; a missing executable is a spawn error; a slow child is killed by timeout", async () => {
		const over = await mod.runProcess(process.execPath, ["-e", "process.stdout.write(Buffer.alloc(3145728, 65))"], { cwd: os.tmpdir() });
		assert.equal(over.kind, "overflow");
		const missing = await mod.runProcess("definitely-missing-binary-for-subagent-create", [], { cwd: os.tmpdir() });
		assert.equal(missing.kind, "spawn");
		const slow = await mod.runProcess(process.execPath, ["-e", "setTimeout(() => {}, 20000)"], { cwd: os.tmpdir(), timeoutMs: 300 });
		assert.equal(slow.kind, "killed");
	});

	test("non-executable absolute interpreter: runProcess reports a spawn error instead of rejecting (Windows throws EFTYPE synchronously)", async () => {
		const w = workspace();
		const notExecutable = path.join(w.base, "not-python.txt");
		fs.writeFileSync(notExecutable, "not a program\n");
		const r = await mod.runProcess(notExecutable, ["-I"], { cwd: w.base });
		assert.equal(r.kind, "spawn");
	});

	// --- display sanitiser: display only --------------------------------------------------------------------------------------

	test("sanitizeForDisplay escapes ESC, NUL, bidi override and line separators, keeps readable newlines, and does not touch frozen bytes", () => {
		const raw = "a\r\nb\tc\u202Ed\u2028e\u001b[31mR\u0000\nend";
		const out = mod.sanitizeForDisplay(raw);
		assert.equal(out.includes("\u202e"), false);
		assert.equal(out.includes("\u001b"), false);
		assert.equal(out.includes("\r"), false);
		assert.equal(out.includes("\t"), false);
		assert.ok(out.includes("<U+202E>") && out.includes("<U+001B>") && out.includes("<U+0000>") && out.includes("<U+2028>"));
		assert.equal(out.split("\n").length, 3);
		assert.equal(raw.includes("\u202e"), true);
	});

	// --- real Python CLI (synthetic project, synthetic global agent dir) ------------------------------------------------------

	test("real CLI: preview writes nothing; CREATE creates the previewed file; repeat is unchanged; a differing file is refused", { skip: testPython ? false : `no functional Python 3; set ${TEST_PYTHON_ENV} to an explicit interpreter` }, async () => {
		const w = workspace();
		fs.copyFileSync(REAL_CLI, path.join(w.agentDir, "skills", "agent-creation", "scripts", "create_agent.py"));
		const agentFile = path.join(w.root, ".pi", "agents", "alpha-review.md");
		const real = (ctxScript: [string, unknown][]) => mod.runAgentCreate(harness(ctxScript).ctx, "", { python: testPython, agentDir: w.agentDir, tmpRoot: w.tmpRoot });
		await real([["input", w.root], ["input", w.spec], ["confirm", false]]);
		assert.equal(fs.existsSync(agentFile), false, "preview and cancel write nothing");
		await real([["input", w.root], ["input", w.spec], ["confirm", true]]);
		assert.equal(fs.existsSync(agentFile), true, "CREATE creates the file");
		const created = fs.readFileSync(agentFile);
		assert.match(created.toString("utf8"), /alpha-review/);
		const h = harness([["input", w.root], ["input", w.spec], ["confirm", true]]);
		await mod.runAgentCreate(h.ctx, "", { python: testPython, agentDir: w.agentDir, tmpRoot: w.tmpRoot });
		assert.match(h.notes.map((n) => n.message).join("\n"), /unchanged: /);
		assert.deepEqual(fs.readFileSync(agentFile), created);
		fs.writeFileSync(agentFile, "someone else's file\n");
		const h2 = harness([["input", w.root], ["input", w.spec]]);
		await mod.runAgentCreate(h2.ctx, "", { python: testPython, agentDir: w.agentDir, tmpRoot: w.tmpRoot });
		assert.match(h2.notes.map((n) => n.message).join("\n"), /existing file differs/);
		assert.equal(fs.readFileSync(agentFile, "utf8"), "someone else's file\n");
		assert.deepEqual(ownedDirs(w), []);
	});

	// --- review window: small terminals, Cancel first, blind guard ----------------------------------------------------------------

	test("review window at 80x24, 40x12 and 20x8: Cancel is first and preselected; CREATE is visible or the window refuses blind", () => {
		const body = Array.from({ length: 40 }, (_, i) => `line ${i} of the review body`);
		for (const [cols, rows] of [[80, 24], [40, 12], [20, 8]]) {
			const done: unknown[] = [];
			const picker = new editor.SearchPicker("Review agent files", ["Cancel", "CREATE the files listed above"], stubTheme, piTui.getKeybindings(), (r: unknown) => done.push(r), { searchable: false, body, tui: { terminal: { rows } } });
			const text = stripAnsi(picker.render(cols).join("\n"));
			assert.equal(picker.selectedLabel(), "Cancel", `${cols}x${rows}`);
			if (!text.includes("CREATE")) assert.match(text, /terminal too small/, `${cols}x${rows}: CREATE hidden needs a blind notice`);
			picker.handleInput("\r");
			assert.ok(done.length === 0 || done[0] === "Cancel", `${cols}x${rows}: Enter must never confirm CREATE`);
		}
	});

	// --- bare menu guard shared by /subagent create, the menu and Ctrl+Shift+W ----------------------------------------------

	test("create holds the menu guard for the whole flow: open refuses, a second create is refused, the guard is released after cancel and after an error", async () => {
		const pi: any = { on() {}, registerCommand() {}, registerShortcut() {}, getSettings: () => ({}) };
		const monitor = new monitorMod.WorkerMonitor(pi);
		const notes: string[] = [];
		let inputs = 0;
		let customs = 0;
		let resolveInput!: (v: string | undefined) => void;
		const ctx: any = {
			hasUI: true,
			mode: "rpc",
			ui: {
				input: () => { inputs++; return new Promise((r) => { resolveInput = r; }); },
				select: async () => undefined,
				confirm: async () => false,
				notify: (m: string) => notes.push(m),
				setStatus() {},
				custom: async () => { customs++; },
			},
		};
		(monitor as any).ctx = ctx;
		monitor.store.begin("a", "t", "anthropic/claude-opus-5-5", "high");
		const first = (monitor as any).create(ctx, "");
		await new Promise((r) => setTimeout(r, 0));
		assert.equal((monitor as any).menuOpen, true, "guard held during prompts");
		await monitor.open();
		assert.equal(customs, 0, "open refused while create holds the guard");
		await (monitor as any).create(ctx, "");
		assert.equal(inputs, 1, "second create refused with no new prompt");
		assert.match(notes.join("\n"), /already open/);
		resolveInput(undefined);
		await first;
		assert.equal((monitor as any).menuOpen, false, "released after cancel");

		const thrower: any = { ...ctx, ui: { ...ctx.ui, input: () => Promise.reject(new Error("ui broke")) } };
		await (monitor as any).create(thrower, "");
		assert.equal((monitor as any).menuOpen, false, "released after an error");
		assert.match(notes.join("\n"), /ui broke/);
	});
}

