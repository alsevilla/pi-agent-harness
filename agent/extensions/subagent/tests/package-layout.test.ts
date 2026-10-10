// Package layout regression (RED first): pi-package/ is a generated, explicitly allowlisted publish tree. Node-run body; under Bun it
// relaunches under Node like roles-editor. Fixtures are a per-file isolated build of the candidate's sources (PI_PACKAGE_OUT); no profile, npm or network access.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../../../../", import.meta.url));
const thisFile = fileURLToPath(import.meta.url);
const isBun = typeof (process.versions as Record<string, string>).bun === "string";

if (isBun) {
	const { test } = await import("bun:test");
	test("package layout suite passes under Node native TypeScript transform", () => {
		const env = { ...process.env };
		delete env.NODE_TEST_CONTEXT;
		const run = spawnSync("node", ["--experimental-transform-types", "--test", thisFile], { encoding: "utf8", timeout: 240_000, windowsHide: true, env });
		assert.equal(run.status, 0, run.stdout + run.stderr);
	}, 260_000);
} else {
	await runNodeSuite();
}

function walk(dir: string): string[] {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		return entry.isDirectory() ? walk(full) : [full];
	});
}

async function runNodeSuite(): Promise<void> {
	const { test, before, after } = await import("node:test");
	// Owned output per file: parallel test files never rebuild or delete a shared tree (EPERM race).
	const owned = fs.mkdtempSync(path.join(os.tmpdir(), "pkg-layout-"));
	const pkg = path.join(owned, "package");
	before(() => {
		// The build is the only producer of pi-package/ generated content; a failing build fails every layout check.
		const run = spawnSync("node", [path.join(repo, "scripts", "build-pi-package.mjs")], { cwd: repo, encoding: "utf8", timeout: 120_000, windowsHide: true, env: { ...process.env, PI_PACKAGE_OUT: pkg } });
		assert.equal(run.status, 0, run.stdout + run.stderr);
	});
	after(() => fs.rmSync(owned, { recursive: true, force: true }));

	test("manifest declares the explicit entry, skills, host peers and no dependencies", () => {
		const manifest = JSON.parse(fs.readFileSync(path.join(pkg, "package.json"), "utf8"));
		assert.equal(manifest.name, "@alsevilla/pi-engineering-harness");
		assert.equal(manifest.version, "0.1.0");
		assert.equal(manifest.license, "MIT");
		assert.deepEqual(manifest.pi.extensions, ["./extensions/subagent/index.ts", "./extensions/ask-user/index.ts"]);
		assert.deepEqual(manifest.pi.skills, ["./skills/engineering-harness", "./skills/agent-creation"]);
		assert.equal(manifest.dependencies, undefined);
		assert.deepEqual(manifest.peerDependencies, {
			"@earendil-works/pi-agent-core": "*",
			"@earendil-works/pi-ai": "*",
			"@earendil-works/pi-coding-agent": "*",
			"@earendil-works/pi-tui": "*",
			typebox: "*",
		});
		assert.deepEqual(manifest.files, ["extensions", "skills", "defaults", "README.md", "LICENSE", "PI-LICENSE", "THIRD_PARTY_NOTICES.md"]);
		assert.deepEqual(manifest.publishConfig, { access: "public" });
		assert.deepEqual(manifest.engines, { node: ">=22.19.0" });
		assert.equal(manifest.repository?.url, "git+https://github.com/alsevilla/pi-agent-harness.git");
		assert.equal(manifest.repository?.directory, "pi-package");
	});

	test("ask_user ships as a second explicit extension: only its runtime files are copied, byte-identical to source", () => {
		const dir = path.join(pkg, "extensions", "ask-user");
		assert.deepEqual(fs.readdirSync(dir).sort(), ["core.ts", "index.ts"]);
		for (const file of ["core.ts", "index.ts"]) assert.deepEqual(fs.readFileSync(path.join(dir, file)), fs.readFileSync(path.join(repo, "agent", "extensions", "ask-user", file)));
	});

	test("publish tree holds only allowlisted top-level entries", () => {
		assert.deepEqual(fs.readdirSync(pkg).sort(), ["LICENSE", "PI-LICENSE", "README.md", "THIRD_PARTY_NOTICES.md", "defaults", "extensions", "package.json", "skills"]);
	});

	test("no personal, runtime, test or dev-only file reaches the package", () => {
		assert.ok(walk(pkg).length > 20, "generated tree missing");
		const forbidden = /^scripts([\\/]|$)|(^|[\\/])(auth\.json|settings(\.example)?\.json|models(-store)?\.json|mcp-onboarding\.json|INTEGRATION-VERIFICATION\.json|sessions|node_modules|\.git|_scratch|_evidence|install|npm|tests|examples(?![\\/]dotnet-worker\.json$)|legacy-catalog\.md|skill-evaluation\.md|run-manifest\.md)([\\/]|$)|\.test\.ts$|\.node\.ts$|rfid-role-overlay/;
		assert.deepEqual(walk(pkg).map((f) => path.relative(pkg, f)).filter((f) => forbidden.test(f)), []);
	});

	test("extension sources import only node builtins, host Pi packages and typebox", () => {
		const sources = walk(path.join(pkg, "extensions")).filter((f) => f.endsWith(".ts"));
		assert.ok(sources.length >= 10, "runtime extension sources missing");
		const bare = new Set<string>();
		for (const file of sources) for (const m of fs.readFileSync(file, "utf8").matchAll(/\bimport\s+(?:type\s+)?(?:[\w*{}\s,$]+?\s+from\s+)?"([^"]+)"|\bexport\s+(?:type\s+)?[\w*{}\s,$]+?\s+from\s+"([^"]+)"|\bimport\(\s*"([^"]+)"\s*\)/g)) { const s = (m[1] ?? m[2] ?? m[3]) as string; if (!s.startsWith(".")) bare.add(s); }
		const allowed = /^(node:|@earendil-works\/pi-(agent-core|ai|coding-agent|tui)$|@earendil-works\/pi-ai\/compat$|typebox$)/;
		assert.deepEqual([...bare].filter((s) => !allowed.test(s)), []);
	});

	test("packaged integrations config disables every code integration", () => {
		const packaged = JSON.parse(fs.readFileSync(path.join(pkg, "extensions", "subagent", "integrations.json"), "utf8"));
		assert.deepEqual(packaged.roles, []);
		assert.deepEqual(packaged.readOnlyTools, []);
		assert.deepEqual(packaged.workerTools, []);
		assert.notEqual(fs.readFileSync(path.join(pkg, "extensions", "subagent", "integrations.json")).equals(fs.readFileSync(path.join(repo, "agent", "extensions", "subagent", "integrations.json"))), true);
	});

	test("license copies are verbatim and the package notices are scoped to shipped components", () => {
		assert.deepEqual(fs.readFileSync(path.join(pkg, "LICENSE")), fs.readFileSync(path.join(repo, "LICENSE")));
		assert.deepEqual(fs.readFileSync(path.join(pkg, "PI-LICENSE")), fs.readFileSync(path.join(repo, "agent", "PI-LICENSE")));
		const notices = fs.readFileSync(path.join(pkg, "THIRD_PARTY_NOTICES.md"), "utf8");
		assert.match(notices, /PI-LICENSE/);
		assert.match(notices, /extensions\/subagent\/index\.ts/);
		assert.equal(/agent\/PI-LICENSE/.test(notices), false, "no pointer to a file that is not shipped");
		for (const unshipped of ["Phosphor", "Google Fonts", "frontend-design", "BetterWright", "design-dashboards"]) assert.equal(notices.includes(unshipped), false, unshipped);
	});

	test("every bundled skill reference resolves inside the package (non-vacuous)", () => {
		const cases = [
			{ skill: path.join(pkg, "skills", "engineering-harness"), file: "SKILL.md" },
			{ skill: path.join(pkg, "skills", "agent-creation"), file: "SKILL.md" },
		];
		let checked = 0;
		const missing: string[] = [];
		for (const { skill, file } of cases) {
			for (const m of fs.readFileSync(path.join(skill, file), "utf8").matchAll(/`((?:references|scripts|examples)\/[A-Za-z0-9_./-]+\.(?:md|py|json))`/g)) {
				checked++;
				if (!fs.existsSync(path.join(skill, m[1]))) missing.push(`${path.relative(pkg, skill)}: ${m[1]}`);
			}
		}
		assert.ok(checked >= 6, `expected skill references, found ${checked}`);
		assert.deepEqual(missing, []);
	});

	test("no shipped guidance points at a profile-only routing index or the repository path", () => {
		for (const file of walk(path.join(pkg, "skills")).concat(walk(path.join(pkg, "defaults", "agents")))) {
			if (!/\.md$/.test(file)) continue;
			const text = fs.readFileSync(file, "utf8");
			assert.equal(/skills\/SKILLS\.md|agent\/extensions\/subagent\/|references\/run-manifest\.md|references\/skill-evaluation\.md/.test(text), false, path.relative(pkg, file));
		}
	});

	test("no private machine path or RFID repository name in packaged text", () => {
		const leaks: string[] = [];
		assert.ok(walk(pkg).length > 20, "generated tree missing");
		for (const file of walk(pkg)) {
			if (!/\.(md|ts|json|py|mjs)$/.test(file)) continue;
			const text = fs.readFileSync(file, "utf8");
			if (/C:[\\/]Users[\\/]|\/Users\/MSI|RFIDAttendance/.test(text)) leaks.push(path.relative(pkg, file));
		}
		assert.deepEqual(leaks, []);
	});

	test("extension children and guidance resolve package-relative, live fallback unchanged", () => {
		const index = fs.readFileSync(path.join(repo, "agent", "extensions", "subagent", "index.ts"), "utf8");
		assert.equal(index.includes('getAgentDir(), "extensions", "subagent"'), false);
		assert.match(index, /throw new Error\("Claude subscription guard missing/);
	});

	// Output guard (RED first): PI_PACKAGE_OUT must be absolute and outside the checkout; a refused run never reaches cleanup.
	// Fake checkout in an owned temp dir: refusals must leave every sentinel byte-identical.
	test("PI_PACKAGE_OUT inside, equal to, or containing the checkout is refused before any cleanup", () => {
		const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "pkg-guard-"));
		try {
			const fake = path.join(sandbox, "repo");
			fs.mkdirSync(path.join(fake, "scripts"), { recursive: true });
			fs.copyFileSync(path.join(repo, "scripts", "build-pi-package.mjs"), path.join(fake, "scripts", "build-pi-package.mjs"));
			for (const rel of ["agent/extensions/subagent/index.ts", "agent/skills/agent-creation/SKILL.md", "agent/PI-LICENSE", "LICENSE"]) {
				fs.mkdirSync(path.dirname(path.join(fake, rel)), { recursive: true });
				fs.writeFileSync(path.join(fake, rel), `sentinel ${rel}\n`);
			}
			const snapshot = () => walk(fake).sort().map((f) => `${path.relative(fake, f)}\0${fs.readFileSync(f, "utf8")}`);
			const before = snapshot();
			const build = (out: string) => spawnSync("node", [path.join(fake, "scripts", "build-pi-package.mjs")], { cwd: fake, encoding: "utf8", timeout: 120_000, windowsHide: true, env: { ...process.env, PI_PACKAGE_OUT: out } });
			const refused = [path.join(fake, "agent"), fake, path.join(fake, "..evil", "out"), sandbox, "relative-out"];
			for (const out of refused) {
				const run = build(out);
				assert.notEqual(run.status, 0, out);
				assert.match(run.stderr, /PI_PACKAGE_OUT must be an absolute path outside the repository/, out);
				assert.deepEqual(snapshot(), before, `tree changed for ${out}`);
			}
			// Boundary: a sibling named "..evil-out" outside the checkout passes the guard (the fake has no git, so the run fails later, not at the guard).
			const accepted = build(path.join(sandbox, "..evil-out"));
			assert.doesNotMatch(accepted.stderr, /PI_PACKAGE_OUT must be/);
			assert.deepEqual(snapshot(), before, "outside refusal path changed the checkout");
		} finally {
			fs.rmSync(sandbox, { recursive: true, force: true });
		}
	});
}
