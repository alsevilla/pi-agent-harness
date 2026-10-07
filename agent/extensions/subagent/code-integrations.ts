import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { AgentConfig } from "./agents.ts";

type IntegrationConfig = {
  roles: string[];
  readOnlyTools: string[];
  workerTools: string[];
};

export const CODE_NAVIGATION_GUIDANCE = `
## Shell syntax
Match command syntax to the selected tool, not to the operating system. The bash
tool runs Bash on Windows too: use export NAME='value', &&, and Bash conditionals.
PowerShell syntax ($env:NAME, $LASTEXITCODE, -ne, and brace-form if statements)
belongs in the powershell tool. Never submit it to bash. Set the assigned candidate
working directory explicitly and preserve native command failures. A shell parse
error means the checks did not run; correct the shell invocation before reporting
test results or diagnosing application code. Do not rerun checks already completed
successfully merely to repair a later invocation error.

## Rust build output
Workers inherit a per-checkout CARGO_TARGET_DIR (shared, outside the repo) and
CARGO_INCREMENTAL=0. Use that directory for every cargo command; do not create or
set another target directory, do not delete the shared one, and do not run servers
from it (run a copy of the executable from the run folder instead: a running .exe
locks its file and breaks later builds). If CARGO_TARGET_DIR is unset, or a task
packet names a different one, follow the packet and say so in the handoff.

## Artifact placement
Main supplies absolute scratch/evidence paths in task packet when an assignment
may produce files outside its candidate. Put separate QA fixtures, temporary
copies, external build targets and logs in the assigned _scratch/<task> path;
put captured backups and durable evidence in _evidence/<task>. These paths
normally live under <primary-parent>/worktrees/<repo>, not beside the checkout.
Do not create scratch directories beside the primary checkout.
Return to main when required artifact paths are missing; do not guess a sibling
folder. Report actual artifact paths at handoff. Source/test edits stay in the
assigned candidate. Shell access is not a filesystem sandbox; verify targets
before write-capable commands.
Do not move live SQLite .db, -wal and -shm files or a running executable.
Obtain authorized downtime and verify processes have stopped before relocating
whole directories. Restart only with verified DB_PATH and runtime configuration;
otherwise leave services stopped and return that scope to main.

## Code navigation integrations
Ponytail's native extension is explicitly active in this code leaf and injects
the configured default/session mode without an extra skill read. Apply its reuse
and minimal-correct-change guidance within the assigned role. It cannot override
user requirements, candidate boundaries, required checks or delegation policy.
Do not reload its base skill merely to activate it or launch extra audit/review
work. Missing graphs never authorize a fresh graph build as a prerequisite.
For prior decisions, specs, notes or plans relevant to this assignment, use a focused
qmd_search with maxResults 3 (at most 5) and a useful collection scope. Search
only when that context is needed; read only selected hits. Do not initialize/update
indexes, request feedback writes, or treat retrieval as authoritative current code.
When graphify-out artifacts exist, first use their wiki index/report to orient this
assignment. Then prefer Serena symbol overview, symbol lookup and references for
source navigation; use read/grep for docs/config or targeted source follow-up.
The profile-adapted graphify skill is available on demand for graph queries and
paths. Its standard-library read_graph.py helper is the read-only query path;
native Graphify CLI queries can write stamps and are not permitted read-only
retrieval. Do not load build procedures or scan the repository without a task
reason. Report a missing interpreter/backend rather than inventing results.
Read-only roles must not build/update graphs, onboard projects, or edit
source; return stale-graph findings to the authorized worker. If Serena is unavailable,
report the concrete failure and use only focused permitted fallback reads.
These integrations do not authorize nested agents, broader writes, or new tasks.
`;

export function candidateProjectRoot(cwd: string): string {
    const candidate = path.resolve(cwd);
    let root = candidate;
    while (!fs.existsSync(path.join(root, ".git"))) {
      const parent = path.dirname(root); if (parent === root) { root = candidate; break; }
      root = parent;
    }
    return root;
}

export function globalGraphGuidance(roots: string[], directory: string): string {
  const graph = path.join(directory, "global-graph.json");
  if (!fs.existsSync(graph) || !fs.statSync(graph).isFile()) return "";
  const manifest = path.join(directory, "global-manifest.json");
  let repositories: string[] = [], matches: string[] = [];
  try {
    if (fs.statSync(manifest).size <= 65536) {
      const data = JSON.parse(fs.readFileSync(manifest, "utf8"));
      const entries = Object.entries(data.repos ?? {}) as [string, {source_path?: string}][];
      repositories = entries.map(([name]) => name);
      matches = entries.filter(([, entry]) => typeof entry.source_path === "string" && roots.some(root =>
        path.resolve(entry.source_path!) === path.resolve(root, "graphify-out", "graph.json")))
        .map(([name]) => name);
    }
  } catch { /* A missing/stale manifest does not establish project coverage. */ }
  const wiki = path.join(directory, "wiki", "index.md");
  return "\n## Global graph reference (separate corpus)\nExisting global graph: " + graph +
    (fs.existsSync(wiki) ? "\nGlobal wiki index: " + wiki : "") +
    (fs.existsSync(manifest) ? "\nCoverage manifest: " + manifest : "") +
    "\nManifest repositories: " + (repositories.slice(0, 12).join(", ") || "unknown") +
    "\nCandidate/primary checkout manifest matches: " + (matches.join(", ") || "none; coverage is not established") +
    "\nPrefer the verified project graph below when available. Global artifacts can include other projects and stale revisions; never treat their nodes as candidate source evidence. " +
    (matches.length ? "If no project graph exists, the matched global corpus can supply read-only orientation; verify source in the candidate." : "Do not use this global graph as the candidate's graph or an automatic fallback. Use it only for an explicitly assigned cross-project question or after confirming relevant coverage.") +
    " Do not load the entire global JSON into context, copy it into the worktree, or rebuild/merge/update it to repair a missing candidate folder.\n";
}

export function graphReferenceGuidance(cwd: string, globalDirectory = path.join(os.homedir(), ".graphify")): string {
  const project = candidateProjectRoot(cwd);
  const navigation = "\n## Candidate navigation and shared retrieval\nFor Serena calls pass project explicitly as " + project + ". Resolve relative_path from that root, even if the shell cwd is backend/frontend. Do not activate the primary checkout just because it contains the graph; symbol lookups and references must target the candidate. Do not automatically onboard or recreate Serena project configuration.\nQMD uses the profile's existing shared named index, not a worktree-local index. Scope queries to the relevant existing collection; retrieved document paths can belong to the primary checkout. Use indexed notes as prior evidence, then verify current files/requirements in the candidate. Do not create/update/clone indexes or rewrite QMD references under the worktree.\n";
  try {
    const root = project;
    const roots = [root];
    const gitMarker = path.join(root, ".git");
    if (fs.existsSync(gitMarker) && fs.statSync(gitMarker).isFile()) {
      const match = /^gitdir:\s*(.+)\s*$/m.exec(fs.readFileSync(gitMarker, "utf8"));
      if (match) {
        const gitDir = path.resolve(root, match[1].trim());
        const commonFile = path.join(gitDir, "commondir");
        if (fs.existsSync(commonFile)) {
          const commonDir = path.resolve(gitDir, fs.readFileSync(commonFile, "utf8").trim());
          if (path.basename(commonDir).toLowerCase() === ".git") roots.push(path.dirname(commonDir));
        }
      }
    }
    for (const source of [...new Set(roots)]) {
      const report = path.join(source, "graphify-out", "GRAPH_REPORT.md");
      const wiki = path.join(source, "graphify-out", "wiki", "index.md");
      const graph = path.join(source, "graphify-out", "graph.json");
      const artifacts = [wiki, report, graph].filter(file => fs.existsSync(file) && fs.statSync(file).isFile());
      if (!artifacts.length) continue;
      return navigation + globalGraphGuidance(roots, globalDirectory) + "\n## Graph reference location\nCandidate checkout: " + root + "\nGraph source checkout: " + source +
        "\nGraph directory (verified to exist): " + path.join(source, "graphify-out") +
        "\nExisting artifacts (absolute paths):\n" + artifacts.map(file => "- " + file).join("\n") +
        "\nUse these absolute paths directly. This resolved location overrides relative graphify-out paths and existence-check examples in the Graphify skill. Do not ls/read the candidate's graphify-out to rediscover this reference when the graph source differs. For queries, pass --graph with the listed absolute graph.json path only if it is listed; absence of a wiki/report is not a reason to try its unlisted path. If this directory/artifact disappears, skip the graph rather than retrying a known missing path. Never change the candidate cwd/project to make a relative graph path work." +
        (source !== root ? "\nThis graph belongs to another checkout of the same repository. Use it only for orientation; it may differ from the candidate branch or uncommitted edits. Do not rewrite its paths into the candidate worktree or build/copy/update the source checkout's graph as part of this assignment." : "\nGraph paths were checked at dispatch; if an artifact is removed, use focused permitted navigation instead of repeating the missing read.") +
        "\nVerify symbols and changed behavior against the candidate checkout using Serena/read/grep. All source edits and tests stay in the assigned candidate; graph reference access does not widen write authority.\n";
    }
    return navigation + globalGraphGuidance(roots, globalDirectory) + "\nNo Graphify report/wiki/graph was found in the candidate or its primary checkout at dispatch. Do not ls/read an assumed candidate graphify-out folder. Use a global reference only under its coverage guidance above; otherwise continue with focused permitted Serena/read/grep navigation.\n";
  } catch {
    return navigation + "\nGraph location could not be resolved at dispatch. Check existence before reading Graphify artifacts; do not assume a worktree contains a graph or rebuild another checkout's graph. Continue with focused permitted navigation.\n";
  }
}

export function configureCodeIntegrations(args: string[], agent: AgentConfig): boolean {
  const config = JSON.parse(fs.readFileSync(new URL("./integrations.json", import.meta.url), "utf8")) as IntegrationConfig;
  if (!config.roles.includes(agent.name)) {
    if (agent.tools?.length) args.push("--tools", agent.tools.join(","));
    return false;
  }
  const packages = path.join(getAgentDir(), "npm", "node_modules");
  const resources = [
    ["--extension", path.join(packages, "@dietrichgebert", "ponytail", "pi-extension", "index.js")],
    ["--extension", fileURLToPath(new URL("../qmd/index.ts", import.meta.url))],
    ["--extension", path.join(packages, "@bacnh85", "pi-serena", "extensions", "index.ts")],
    ["--extension", path.join(packages, "graphify-pi", "extensions", "graphify.ts")],
    ["--skill", path.join(getAgentDir(), "skills", "graphify", "SKILL.md")],
  ];
  for (const [flag, file] of resources) {
    if (!fs.existsSync(file)) throw new Error(`Code integration missing for ${agent.name}: ${file}. Install @dietrichgebert/ponytail, @bacnh85/pi-serena, graphify-pi through Pi; configure plain QMD in extensions/qmd/config.json.`);
    args.push(flag, file);
  }
  // Exact names preserve role authority; never select all serena_* tools by wildcard.
  const tools = new Set([...(agent.tools ?? ["read", "grep", "find", "ls"]), ...config.readOnlyTools]);
  if (tools.has("edit") || tools.has("write")) for (const tool of config.workerTools) tools.add(tool);
  args.push("--tools", [...tools].join(","));
  return true;
}
