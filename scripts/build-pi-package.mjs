// Generates the npm publish tree pi-package/ from explicit allowlists. Generated output only: no hand-written source is produced here.
// Role defaults are read from the pinned baseline commit (never the working personal roles.json). Hand-authored files
// (pi-package/package.json, README.md, defaults/AGENTS.policy-template.md) are not touched.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const authored = path.join(repo, "pi-package");
// PI_PACKAGE_OUT: absolute isolated output (tests). Unset keeps the explicit default destination. It must lie outside the repository and must not contain it, because the cleanup below must never reach repository files.
const out = process.env.PI_PACKAGE_OUT;
// Exact boundary: ".." or ".."+sep leads out; "..evil" is a child name, and an absolute relative path is another volume.
const escapes = (rel) => rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel);
if (out !== undefined && (!path.isAbsolute(out) || !escapes(path.relative(repo, out)) || !escapes(path.relative(out, repo)))) throw new Error(`PI_PACKAGE_OUT must be an absolute path outside the repository and not containing it: ${out}`);
const pkg = out === undefined ? authored : path.resolve(out);
const BASELINE = "861c095cae2d2cd8313706c4af54d8d832865571";
const GENERIC = ["api-specialist", "architecture-specialist", "backend-worker", "concurrency-specialist", "debugger", "devops-specialist", "frontend-worker", "general-worker", "observability-specialist", "oracle", "performance-specialist", "release-engineer", "reviewer", "scout", "security-specialist", "sqlite-specialist", "test-engineer", "ui-ux-specialist"];
const EXCLUDED = ["attendance-domain-specialist", "event-reconciliation-specialist", "hardware-integration", "messaging-specialist", "privacy-compliance-specialist"];
// Exact literal transforms, applied only to package copies. Counts are enforced so a drifted source fails the build.
const TRANSFORMS = [
	// Skill-relative: pi resolves skill references against the skill directory, so the profile prefix is dropped.
	{ from: "~/.pi/agent/skills/engineering-harness/", to: "" },
	// Private checkout path in worktree guidance; the generic `<primary-parent>/worktrees/<repo>/<task>` form remains.
	{ from: "For RFID this is `C:/Users/MSI/RFID/worktrees/RFIDAttendance-Rust/<task>`.\r\n", to: "", expected: 2 },
	// Optional run-manifest and skill-evaluation features are not bundled: their references are removed from the package copy only.
	{ from: "; `references/run-manifest.md` for the optional main-owned manifest of complex multi-stage runs; `references/skill-evaluation.md` for the offline routing-fixture evaluator.", to: ".", expected: 1 },
	// Profile routing index is not bundled: point to the packaged routing reference instead.
	{ from: "Use `~/.pi/agent/skills/SKILLS.md` as the canonical routing index when needed.", to: "Use `references/routing.md` as the routing index when needed.", expected: 1 },
	{ from: "Consult the routing index in `~/.pi/agent/skills/SKILLS.md` when needed.", to: "Consult the routing index in `references/routing.md` when needed.", expected: 1 },
	{ from: "If `~/.pi/agent/skills/SKILLS.md` or the required registered procedure is missing", to: "If the required registered procedure is missing", expected: 1 },
	// Unbundled frontend catalog: named as not bundled so the guide is not treated as available.
	{ from: "`~/.pi/agent/skills/frontend/ux-flow-wireframer/index.md`", to: "`frontend/ux-flow-wireframer/index.md` (not bundled in this package; use project UX guidance)", expected: 1 },
	// Excluded roles stay optional: never an automatic dispatch target in the package.
	{ from: "One specialist is preferred. Multiple specialists require distinct unresolved questions.", to: "One specialist is preferred. Multiple specialists require distinct unresolved questions. In this package, hardware-integration, attendance-domain-specialist, event-reconciliation-specialist, messaging-specialist and privacy-compliance-specialist are optional and not bundled: never dispatch them automatically; return their questions to main.", expected: 1 },
	// Repository path in a shipped reference: the packaged module is the same file at package-relative path.
	{ from: "from `agent/extensions/subagent/compact-handoff.ts`", to: "from the packaged `extensions/subagent/compact-handoff.ts`", expected: 1 },
	// Private repository collection name in shared runtime guidance: generic wording keeps the rule.
	{ from: "For this RFID repository, the existing rfid-rust collection contains primary-checkout docs;", to: "The existing project collection may contain primary-checkout docs;", expected: 1 },
];
const SKILL_FILES = { "agent-creation": ["SKILL.md", "scripts/create_agent.py", "examples/dotnet-worker.json"] };
const HARNESS_EXCLUDED = [/^examples\//, /^scripts\//, /^tests\//, /^references\/legacy-catalog\.md$/, /^references\/skill-evaluation\.md$/, /^references\/run-manifest\.md$/];
const TEXT = /\.(md|ts|json|py)$/;
const PACKAGE_NOTICES = `# Third-party notices

Generated for @alsevilla/pi-engineering-harness by scripts/build-pi-package.mjs. It lists only the third-party material in this package; the repository notices are not shipped.

## Pi (MIT)

- \`extensions/subagent/index.ts\` and \`extensions/subagent/agents.ts\` are derived from the Pi example \`examples/extensions/subagent\` (packages/coding-agent) in https://github.com/earendil-works/pi. Derivation audited by file header comparison.
- Permission notice: \`PI-LICENSE\` in this package root, a verbatim copy of the MIT license distributed with Pi. Keep it with any copy.

## Host peer packages (not bundled)

- \`@earendil-works/pi-agent-core\`, \`@earendil-works/pi-ai\`, \`@earendil-works/pi-coding-agent\`, \`@earendil-works/pi-tui\` and \`typebox\` are supplied by the host installation and are not copied here.

## Skills (origin not audited)

- \`skills/engineering-harness\` and \`skills/agent-creation\` carry no license or origin notice in this repository. Their origin was not audited; this is not a legal audit.
- No third-party agent framework is bundled. A keyword check of this package found no ECC text (ECC is named only as a concept source in another repository skill, which is not shipped).

This package's own license is in \`LICENSE\`.
`;
const transformHits = TRANSFORMS.map(() => 0);

const headBytes = (rel) => execFileSync("git", ["show", `${BASELINE}:${rel}`], { cwd: repo, maxBuffer: 16 * 1024 * 1024 });
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const walk = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join("/")]);
const copy = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); };

// Baseline gate: the committed roles registry must be exactly the generic set plus the excluded set.
execFileSync("git", ["cat-file", "-e", `${BASELINE}^{commit}`], { cwd: repo });
const headRoles = JSON.parse(headBytes("agent/roles.json").toString("utf8"));
const headNames = headRoles.map((r) => r.name).sort().join(",");
if (headNames !== [...GENERIC, ...EXCLUDED].sort().join(",")) throw new Error(`unexpected baseline role set at ${BASELINE}: ${headNames}`);
const defaultRoles = headRoles.filter((r) => GENERIC.includes(r.name));

// Isolated output starts from the authored hand-written files, so generation sees the same inputs as the default build.
if (out !== undefined && pkg !== authored) for (const rel of ["package.json", "README.md", "defaults/AGENTS.policy-template.md"]) copy(path.join(authored, rel), path.join(pkg, rel));
// Regenerate only generated paths; hand-authored policy template and manifest stay in place.
for (const rel of ["extensions", "skills", "defaults/agents", "defaults/roles.json", "defaults/baseline.json", "LICENSE", "PI-LICENSE", "THIRD_PARTY_NOTICES.md"]) fs.rmSync(path.join(pkg, rel), { recursive: true, force: true });

// Defaults: byte-identical HEAD bodies plus the HEAD registry entries for the generic set.
const agentHashes = {};
for (const name of GENERIC) {
	const bytes = headBytes(`agent/agents/${name}.md`);
	fs.mkdirSync(path.join(pkg, "defaults", "agents"), { recursive: true });
	fs.writeFileSync(path.join(pkg, "defaults", "agents", `${name}.md`), bytes);
	agentHashes[name] = sha(bytes);
}
const rolesBytes = Buffer.from(JSON.stringify(defaultRoles, null, 2) + "\n");
fs.writeFileSync(path.join(pkg, "defaults", "roles.json"), rolesBytes);
fs.writeFileSync(path.join(pkg, "defaults", "baseline.json"), JSON.stringify({ commit: BASELINE, roles_path: "agent/roles.json", roles_sha256: sha(headBytes("agent/roles.json")), generic: GENERIC, excluded: EXCLUDED, agents_sha256: agentHashes }, null, 2) + "\n");

// Runtime extension: every top-level TypeScript source (no tests). Integrations are explicitly disabled in the package.
const extSrc = path.join(repo, "agent", "extensions", "subagent");
for (const file of fs.readdirSync(extSrc).filter((f) => f.endsWith(".ts") && !/\.(test|node)\.ts$/.test(f))) copy(path.join(extSrc, file), path.join(pkg, "extensions", "subagent", file));
// ask_user: only the runtime pair (MIT, no deps); its tests and README stay in the profile.
for (const file of ["index.ts", "core.ts"]) copy(path.join(repo, "agent", "extensions", "ask-user", file), path.join(pkg, "extensions", "ask-user", file));
fs.writeFileSync(path.join(pkg, "extensions", "subagent", "integrations.json"), JSON.stringify({ roles: [], readOnlyTools: [], workerTools: [] }, null, 2) + "\n");

// Skills: agent-creation CLI and harness modules (dev-only examples, scripts, tests and unaudited catalogs excluded).
for (const file of SKILL_FILES["agent-creation"]) copy(path.join(repo, "agent", "skills", "agent-creation", file), path.join(pkg, "skills", "agent-creation", file));
const harnessSrc = path.join(repo, "agent", "skills", "engineering-harness");
for (const rel of walk(harnessSrc).filter((f) => !HARNESS_EXCLUDED.some((re) => re.test(f)))) {
	const from = path.join(harnessSrc, ...rel.split("/"));
	const to = path.join(pkg, "skills", "engineering-harness", ...rel.split("/"));
	if (!TEXT.test(rel)) { copy(from, to); continue; }
	let text = fs.readFileSync(from, "utf8");
	TRANSFORMS.forEach((t, i) => {
		transformHits[i] += text.split(t.from).length - 1;
		text = text.split(t.from).join(t.to);
	});
	fs.mkdirSync(path.dirname(to), { recursive: true });
	fs.writeFileSync(to, text);
}

TRANSFORMS.forEach((t, i) => { if (t.expected !== undefined && transformHits[i] !== t.expected) throw new Error(`transform drift: expected ${t.expected}, found ${transformHits[i]} for ${JSON.stringify(t.from)}`); });

// License: repository LICENSE verbatim; Pi's MIT permission notice verbatim as PI-LICENSE (the source is agent/PI-LICENSE).
copy(path.join(repo, "LICENSE"), path.join(pkg, "LICENSE"));
copy(path.join(repo, "agent", "PI-LICENSE"), path.join(pkg, "PI-LICENSE"));
// Package-only notices: generated for the shipped components; the repository's broader notices are not copied.
fs.writeFileSync(path.join(pkg, "THIRD_PARTY_NOTICES.md"), PACKAGE_NOTICES);

// Fail closed on private machine paths in anything shipped.
const leaks = walk(pkg).filter((rel) => TEXT.test(rel) && /C:[\\/]Users[\\/]|\/Users\/MSI/.test(fs.readFileSync(path.join(pkg, ...rel.split("/")), "utf8")));
if (leaks.length) throw new Error(`private machine path in package: ${leaks.join(", ")}`);

// Ledger for main: remaining references to profile skills that are not bundled (reported, not silently removed).
const unbundled = {};
for (const rel of walk(pkg).filter((r) => TEXT.test(r))) for (const m of fs.readFileSync(path.join(pkg, ...rel.split("/")), "utf8").matchAll(/~\/\.pi\/agent\/skills\/([A-Za-z0-9_.-]+)/g)) unbundled[m[1]] = (unbundled[m[1]] ?? 0) + 1;
console.log(JSON.stringify({ baseline: BASELINE, defaults: GENERIC.length, files: walk(pkg).length, unbundled_profile_skill_refs: unbundled }, null, 2));
