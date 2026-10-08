/**
 * Agent discovery and configuration
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { CONFIG_DIR_NAME, getAgentDir, parseFrontmatter } from "@earendil-works/pi-coding-agent";
import { parseFallbackModels } from "./model-routing.ts";

export type AgentScope = "user" | "project" | "both";

export interface AgentConfig {
	name: string;
	description: string;
	tools?: string[];
	model?: string;
	fallbackModel?: string[];
	thinking?: string;
	systemPrompt: string;
	source: "user" | "project";
	filePath: string;
}

export interface AgentDiscoveryResult {
	agents: AgentConfig[];
	projectAgentsDir: string | null;
}

/**
 * Raw agent frontmatter. Values are `unknown` because `parseFrontmatter` runs a
 * real YAML parser, so any scalar or collection can appear here.
 *
 * A type alias rather than an interface: `parseFrontmatter` constrains its
 * parameter to `Record<string, unknown>`, and only an alias picks up the
 * implicit index signature that satisfies it.
 */
type AgentFrontmatter = {
	name?: unknown;
	description?: unknown;
	tools?: unknown;
	model?: unknown;
	fallbackModel?: unknown;
	thinking?: unknown;
};

/**
 * Normalize a frontmatter `tools` value to a list of tool names.
 *
 * Both spellings are valid YAML and both are in use:
 *
 *     tools: read, bash        # string
 *     tools: [read, bash]      # array
 *
 * so accept either. Anything else (a number, a map, a nested list) yields no
 * tools rather than throwing: this runs inside agent discovery, where a single
 * bad file must not take down every other agent in the same directory.
 */
function parseToolList(value: unknown): string[] | undefined {
	const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
	const tools = raw
		.filter((t): t is string => typeof t === "string")
		.map((t) => t.trim())
		.filter(Boolean);
	return tools.length > 0 ? tools : undefined;
}

/** Fields roles.json defines for a user role; an omitted field keeps the definition file's frontmatter value. */
interface RoleOverride {
	model?: string;
	fallbackModel?: string[];
	thinking?: string;
	tools?: string[];
}

/** roles.json is the canonical registry for user roles: provider + model are joined into one catalog ID. */
function loadRoleRegistry(): Map<string, RoleOverride> {
	const roles = new Map<string, RoleOverride>();
	try {
		const registry: unknown = JSON.parse(fs.readFileSync(path.join(getAgentDir(), "roles.json"), "utf-8"));
		if (Array.isArray(registry)) {
			for (const role of registry) {
				if (typeof role !== "object" || role === null) continue;
				const entry = role as { name?: unknown; provider?: unknown; model?: unknown; fallbackModel?: unknown; thinking?: unknown; tools?: unknown };
				if (typeof entry.name !== "string") continue;
				const model = typeof entry.model === "string" ? entry.model.trim() : "";
				roles.set(entry.name, {
					model: model && typeof entry.provider === "string" && !model.includes("/") ? `${entry.provider}/${model}` : model || undefined,
					fallbackModel: typeof entry.fallbackModel === "string" ? parseFallbackModels(entry.fallbackModel) : undefined,
					thinking: typeof entry.thinking === "string" ? entry.thinking : undefined,
					tools: parseToolList(entry.tools),
				});
			}
		}
	} catch {
		// Missing or invalid registry leaves every user definition on its own frontmatter.
	}
	return roles;
}

function loadAgentsFromDir(
	dir: string,
	source: "user" | "project",
	roles: ReadonlyMap<string, RoleOverride> = new Map(),
): AgentConfig[] {
	const agents: AgentConfig[] = [];

	if (!fs.existsSync(dir)) {
		return agents;
	}

	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return agents;
	}

	for (const entry of entries) {
		if (!entry.name.endsWith(".md")) continue;
		if (!entry.isFile() && !entry.isSymbolicLink()) continue;

		const filePath = path.join(dir, entry.name);
		let content: string;
		try {
			content = fs.readFileSync(filePath, "utf-8");
		} catch {
			continue;
		}

		const { frontmatter, body } = parseFrontmatter<AgentFrontmatter>(content);

		if (typeof frontmatter.name !== "string" || typeof frontmatter.description !== "string") {
			continue;
		}

		const role = roles.get(frontmatter.name);
		agents.push({
			name: frontmatter.name,
			description: frontmatter.description,
			tools: role?.tools ?? parseToolList(frontmatter.tools),
			model: role?.model ?? (typeof frontmatter.model === "string" ? frontmatter.model : undefined),
			fallbackModel:
				role?.fallbackModel ??
				(typeof frontmatter.fallbackModel === "string" ? parseFallbackModels(frontmatter.fallbackModel) : undefined),
			thinking: role?.thinking ?? (typeof frontmatter.thinking === "string" ? frontmatter.thinking : undefined),
			systemPrompt: body,
			source,
			filePath,
		});
	}

	return agents;
}

function isDirectory(p: string): boolean {
	try {
		return fs.statSync(p).isDirectory();
	} catch {
		return false;
	}
}

function findNearestProjectAgentsDir(cwd: string): string | null {
	let currentDir = cwd;
	while (true) {
		const candidate = path.join(currentDir, CONFIG_DIR_NAME, "agents");
		if (isDirectory(candidate)) return candidate;

		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) return null;
		currentDir = parentDir;
	}
}

export function discoverAgents(cwd: string, scope: AgentScope): AgentDiscoveryResult {
	const userDir = path.join(getAgentDir(), "agents");
	const projectAgentsDir = findNearestProjectAgentsDir(cwd);

	const userAgents = scope === "project" ? [] : loadAgentsFromDir(userDir, "user", loadRoleRegistry());
	const projectAgents = scope === "user" || !projectAgentsDir ? [] : loadAgentsFromDir(projectAgentsDir, "project");

	const agentMap = new Map<string, AgentConfig>();

	if (scope === "both") {
		for (const agent of userAgents) agentMap.set(agent.name, agent);
		for (const agent of projectAgents) agentMap.set(agent.name, agent);
	} else if (scope === "user") {
		for (const agent of userAgents) agentMap.set(agent.name, agent);
	} else {
		for (const agent of projectAgents) agentMap.set(agent.name, agent);
	}

	return { agents: Array.from(agentMap.values()), projectAgentsDir };
}

export function formatAgentList(agents: AgentConfig[], maxItems: number): { text: string; remaining: number } {
	if (agents.length === 0) return { text: "none", remaining: 0 };
	const listed = agents.slice(0, maxItems);
	const remaining = agents.length - listed.length;
	return {
		text: listed.map((a) => `${a.name} (${a.source}): ${a.description}`).join("; "),
		remaining,
	};
}
