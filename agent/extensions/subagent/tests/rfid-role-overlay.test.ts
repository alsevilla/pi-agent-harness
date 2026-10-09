import { test } from "bun:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

const agentDir = fileURLToPath(new URL("../../../", import.meta.url));
const integrations = JSON.parse(fs.readFileSync(new URL("../integrations.json", import.meta.url), "utf8"));
const roles = JSON.parse(fs.readFileSync(new URL("../../../roles.json", import.meta.url), "utf8"));

const newRoles = [
  "attendance-domain-specialist",
  "event-reconciliation-specialist",
  "messaging-specialist",
  "privacy-compliance-specialist",
  "release-engineer",
];

function frontmatter(name: string) {
  const path = new URL(`../../../agents/${name}.md`, import.meta.url);
  const text = fs.readFileSync(path, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, `${name}: frontmatter missing`);
  const field = (key: string) => match[1].match(new RegExp(`^${key}:\\s*(.*)$`, "m"))?.[1]?.trim();
  return { text, name: field("name"), tools: field("tools") ?? "", model: field("model"), fallbackModel: field("fallbackModel"), thinking: field("thinking") };
}

test("RFID overlay registers 23 unique roles without statusline-setup", () => {
  assert.equal(roles.length, 23);
  assert.equal(new Set(roles.map((r: { name: string }) => r.name)).size, 23);
  assert.ok(!roles.some((r: { name: string }) => r.name === "statusline-setup"));
  assert.ok(!fs.existsSync(new URL("../../../agents/statusline-setup.md", import.meta.url)), "statusline-setup definition removed");
  assert.equal(fs.readdirSync(new URL("../../../agents/", import.meta.url)).filter((f) => f.endsWith(".md")).length, 23);
  for (const name of newRoles) assert.ok(roles.some((r: { name: string }) => r.name === name), name);
});

test("all five new roles receive standard code navigation integrations", () => {
  for (const name of newRoles) assert.ok(integrations.roles.includes(name), name);
  assert.equal(integrations.roles.length, 23);
  assert.deepEqual([...integrations.roles].sort(), roles.map((r: { name: string }) => r.name).sort());
});

test("every role definition agrees with the final user registry", () => {
  for (const role of roles) {
    const fm = frontmatter(role.name);
    assert.equal(fm.name, role.name, `${role.name}: name`);
    assert.equal(fm.model, `${role.provider}/${role.model}`, `${role.name}: primary model`);
    assert.equal(fm.fallbackModel, role.fallbackModel, `${role.name}: fallbackModel`);
    assert.equal(fm.thinking, role.thinking, `${role.name}: thinking`);
    assert.equal(fm.tools, role.tools, `${role.name}: tools`);
  }
});

test("all five new role definitions link their assigned module and preserve model metadata", () => {
  const links = [
    ["attendance-domain-specialist", "attendance-domain/index.md"],
    ["event-reconciliation-specialist", "event-reconciliation/index.md"],
    ["messaging-specialist", "messaging-reliability/index.md"],
    ["privacy-compliance-specialist", "privacy-compliance/index.md"],
    ["release-engineer", "engineering-harness/ship/index.md"],
  ];
  for (const [name, module] of links) {
    const fm = frontmatter(name);
    assert.ok(fm.model, `${name}: missing model`);
    assert.ok(fm.thinking, `${name}: missing thinking level`);
    assert.ok(fm.text.includes(module), `${name}: missing assigned module ${module}`);
  }
});

test("four RFID domain specialists remain read-only", () => {
  for (const name of newRoles.slice(0, 4)) {
    const fm = frontmatter(name);
    assert.ok(!/(^|,\s*)(edit|write)(\s*,|$)/.test(fm.tools), `${name}: unexpected mutation tool`);
  }
});

test("release engineer has precise edit but not bulk write", () => {
  const fm = frontmatter("release-engineer");
  assert.match(fm.tools, /(^|,\s*)edit(\s*,|$)/);
  assert.ok(!/(^|,\s*)write(\s*,|$)/.test(fm.tools));
  assert.match(fm.text, /do \*\*not\*\* modify product implementation code/i);
});

test("registry mirrors precise edit restriction for implementation workers", () => {
  for (const name of ["backend-worker", "frontend-worker", "general-worker"]) {
    const role = roles.find((r: { name: string }) => r.name === name);
    assert.ok(role, name);
    assert.match(role.tools, /(^|,\s*)edit(\s*,|$)/);
    assert.ok(!/(^|,\s*)write(\s*,|$)/.test(role.tools));
  }
});

test("implementation workers are backend, frontend and general with the inherited rust defaults", () => {
  assert.equal(roles.find((r: { name: string }) => r.name === "rust-worker"), undefined, "rust-worker retired from registry");
  assert.equal(fs.existsSync(new URL("../../../agents/rust-worker.md", import.meta.url)), false, "rust-worker definition retired");
  const defaults = { provider: "anthropic", model: "claude-haiku-5-5", fallbackModel: "openai-codex/gpt-6-luna || github-copilot/gpt-6-luna", thinking: "low", tools: "read, grep, find, ls, bash, powershell, edit" };
  for (const name of ["backend-worker", "frontend-worker", "general-worker"]) {
    const role = roles.find((r: { name: string }) => r.name === name);
    assert.ok(role, name);
    assert.deepEqual({ provider: role.provider, model: role.model, fallbackModel: role.fallbackModel, thinking: role.thinking, tools: role.tools }, defaults, name);
  }
});

test("every role description is a YAML plain scalar (no ': ' that parses as a nested mapping)", () => {
  for (const role of roles) {
    const description = frontmatter(role.name).text.match(/^description:(.*)$/m)?.[1] ?? "";
    assert.ok(!/:\s/.test(description), `${role.name}: description contains ': ' and fails YAML frontmatter parsing`);
  }
});

test("lifecycle ownership is explicit: main PLAN, release SHIP and LEARN", () => {
  const plan = fs.readFileSync(new URL("../../../skills/engineering-harness/plan/index.md", import.meta.url), "utf8");
  const ship = fs.readFileSync(new URL("../../../skills/engineering-harness/ship/index.md", import.meta.url), "utf8");
  const learn = fs.readFileSync(new URL("../../../skills/engineering-harness/learn/index.md", import.meta.url), "utf8");
  assert.match(plan, /owned by the \*\*main orchestrator\*\*/i);
  assert.match(ship, /belongs to the `release-engineer` role/i);
  assert.match(learn, /belongs to the `release-engineer` role/i);
});

test("new assigned RFID module indexes exist", () => {
  for (const rel of [
    "../../../skills/rfid-attendance/attendance-domain/index.md",
    "../../../skills/rfid-attendance/event-reconciliation/index.md",
    "../../../skills/rfid-attendance/messaging-reliability/index.md",
    "../../../skills/rfid-attendance/privacy-compliance/index.md",
  ]) assert.ok(fs.existsSync(fileURLToPath(new URL(rel, import.meta.url))), rel);
});

test("RFID routing preserves domain boundaries and returns missing policy to main", () => {
  const route = fs.readFileSync(new URL("../../../skills/engineering-harness/references/routing.md", import.meta.url), "utf8");
  for (const role of ["attendance-domain-specialist", "event-reconciliation-specialist", "messaging-specialist", "privacy-compliance-specialist"]) {
    assert.ok(route.includes(role), `routing missing ${role}`);
  }
  assert.match(route, /RFID\/device I\/O.*hardware-integration/i);
  assert.match(route, /SQLite.*sqlite-specialist/i);
  assert.match(route, /Tokio.*concurrency-specialist/i);
  assert.match(route, /deployment.*devops-specialist/i);

  const domain = fs.readFileSync(new URL("../../../skills/rfid-attendance/attendance-domain/index.md", import.meta.url), "utf8");
  const events = fs.readFileSync(new URL("../../../skills/rfid-attendance/event-reconciliation/guide.md", import.meta.url), "utf8");
  const messaging = fs.readFileSync(new URL("../../../skills/rfid-attendance/messaging-reliability/guide.md", import.meta.url), "utf8");
  const privacy = fs.readFileSync(new URL("../../../skills/rfid-attendance/privacy-compliance/guide.md", import.meta.url), "utf8");
  assert.match(domain, /return the exact unresolved decision instead of inventing it/i);
  assert.match(events, /acknowledg\w+.*durab\w+/is);
  assert.match(messaging, /delivery callback.*different evidence/is);
  assert.match(privacy, /Do not assume.*applicable law/is);
  assert.match(route, /self-contained packet.*exact unresolved question/is);
  assert.match(route, /return unresolved school.*policy to main/is);
});
