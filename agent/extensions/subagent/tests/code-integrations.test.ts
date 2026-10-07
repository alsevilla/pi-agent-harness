import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

const agentDir = fileURLToPath(new URL("../../../", import.meta.url));
mock.module("@earendil-works/pi-coding-agent", () => ({
  getAgentDir: () => agentDir,
}));
const { configureCodeIntegrations } = await import("../code-integrations.ts");
const config = JSON.parse(fs.readFileSync(new URL("../integrations.json", import.meta.url), "utf8"));
const unsafeMutations = [
  "serena_replace_symbol_body", "serena_insert_before_symbol", "serena_insert_after_symbol",
  "serena_rename_symbol", "serena_safe_delete_symbol", "serena_replace_content",
];
function role(name: string) {
  const filePath = new URL(`../../../agents/${name}.md`, import.meta.url);
  const content = fs.readFileSync(filePath, "utf8");
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(frontmatter, `${name}: frontmatter missing`);
  const toolsLine = frontmatter[1].match(/^tools:\s*([^\r\n]*)/m);
  assert.ok(toolsLine, `${name}: tools declaration missing`);
  return { name, description: "actual role test", source: "user" as const, filePath: fileURLToPath(filePath),
    tools: toolsLine[1].split(",").map(tool => tool.trim()) };
}
function effectiveTools(agent: ReturnType<typeof role>) {
  const args: string[] = [];
  assert.equal(configureCodeIntegrations(args, agent), true);
  const index = args.indexOf("--tools");
  assert.ok(index >= 0 && args[index + 1], "effective allowlist missing");
  return args[index + 1].split(",");
}
for (const name of ["rust-worker", "frontend-worker"]) {
  test(`${name} actual frontmatter keeps precise edit, excludes write and six Serena mutations`, () => {
    const agent = role(name);
    assert.ok(agent.tools.includes("edit"));
    assert.ok(!agent.tools.includes("write"));
    const tools = effectiveTools(agent);
    for (const tool of agent.tools) assert.ok(tools.includes(tool), `role tool lost: ${tool}`);
    assert.ok(!tools.includes("write"));
    for (const tool of unsafeMutations) assert.ok(!tools.includes(tool), `unexpected mutation: ${tool}`);
    assert.ok(config.readOnlyTools.length > 0, "read-only integrations unexpectedly absent");
    for (const tool of config.readOnlyTools) assert.ok(tools.includes(tool), `read-only integration lost: ${tool}`);
  });
}
test("actual read-only scout grants remain unchanged", () => {
  const agent = role("scout");
  assert.ok(!agent.tools.includes("edit") && !agent.tools.includes("write"));
  const tools = effectiveTools(agent);
  for (const tool of [...agent.tools, ...config.readOnlyTools]) assert.ok(tools.includes(tool), tool);
  for (const tool of ["edit", "write", ...unsafeMutations]) assert.ok(!tools.includes(tool), tool);
});
