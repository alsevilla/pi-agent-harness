/**
 * /subagent roles: edit a registry role's model settings through native dialogs.
 * Writes only the roles.json entry (provider, model, fallbackModel, thinking) and the
 * model, fallbackModel and thinking frontmatter lines of agents/<name>.md.
 */

import { randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { getAgentDir, getSelectListTheme, parseFrontmatter, resolveCliModel, type Theme } from "@earendil-works/pi-coding-agent";
import { type Component, type Focusable, fuzzyFilter, Input, type KeybindingsManager, SelectList, truncateToWidth, type TUI, type TuiMouseEvent, type TuiMouseEventResult, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { clampThinkingLevel, getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import type { Api, Model } from "@earendil-works/pi-ai";
import { packageRoot, roleRegistryViolation } from "./agents.ts";
import { parseFallbackModels } from "./model-routing.ts";
import { frameWindow, SUBAGENT_WINDOW_OPTIONS } from "./monitor.ts";

export class RoleEditError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RoleEditError";
	}
}

/** Raised when any dialog is cancelled; the flow stops and nothing is written. */
class RoleFlowCancelled extends Error {}

type CatalogModel = Model<Api>;

export interface RegistryLike {
	getAll(): CatalogModel[];
	hasConfiguredAuth(model: CatalogModel): boolean;
	/** Optional snapshot of the registry's available models; when absent, explicit configured auth decides. */
	getAvailable?(): CatalogModel[];
}

export interface RoleCommandContext {
	hasUI: boolean;
	mode: "tui" | "rpc" | "json" | "print";
	ui: {
		select(title: string, options: string[]): Promise<string | undefined>;
		confirm(title: string, message: string): Promise<boolean>;
		notify(message: string, type?: "info" | "warning" | "error"): void;
		/** Present in TUI mode: renders a component in the editor slot. */
		custom?<T>(factory: (tui: TUI, theme: Theme, keybindings: KeybindingsManager, done: (result: T) => void) => Component, options?: { overlay?: boolean; overlayOptions?: unknown }): Promise<T>;
	};
	modelRegistry: RegistryLike;
}

export interface RoleSettings {
	primary: string;
	fallbacks: string[];
	thinking: string;
}

export interface RoleCatalog {
	models(): CatalogModel[];
	find(ref: string): CatalogModel | undefined;
	configured(model: CatalogModel): boolean;
}

interface RegistryEntry {
	name: string;
	provider: string;
	model: string;
	fallbackModel: string;
	thinking: string;
	[key: string]: unknown;
}

interface RegistryFile {
	path: string;
	/** null when roles.json does not exist yet (fresh profile). */
	bytes: Buffer | null;
	text: string;
	eol: string;
	entries: RegistryEntry[];
}

export interface RoleSnapshot {
	name: string;
	registryPath: string;
	registryBytes: Buffer | null;
	registryText: string;
	eol: string;
	/** User roles.json entries only; a packaged-only role has no entry here until it is saved. */
	entries: RegistryEntry[];
	/** Effective entry the settings start from: the user entry, else the packaged default. */
	base: RegistryEntry;
	/** null for a packaged-only role: the package definition is read-only and never copied. */
	agentPath: string | null;
	agentBytes: Buffer | null;
	agentText: string | null;
	current: RoleSettings;
}

export interface RolePlan {
	changed: boolean;
	warnings: string[];
	preview: string;
	registryPath: string;
	registryText: string;
	agentPath: string | null;
	agentText: string | null;
}

export interface CommitResult {
	status: "saved" | "failed" | "conflict";
	rolledBack: boolean;
	recovery: string[];
	reason: string;
}

const DEFINITION_KEYS = ["model", "fallbackModel", "thinking"] as const;
const FALLBACK_SEPARATOR = " || ";

function errorText(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function formatJson(data: unknown, eol: string): string {
	return JSON.stringify(data, null, 2).replace(/\n/g, eol) + eol;
}

export const roleModelField = (provider: string, id: string): string => (id.includes("/") ? `${provider}/${id}` : id);

/** Same join the loader uses (agents.ts): a short model plus provider becomes provider/model. */
export const effectiveModelRef = (role: { provider: string; model: string }): string =>
	role.model.includes("/") ? role.model : `${role.provider}/${role.model}`;

/** Lossless UTF-8 only: an invalid byte would decode to U+FFFD and be written back on save. */
function decodeUtf8(bytes: Buffer, file: string): string {
	const text = bytes.toString("utf8");
	if (!Buffer.from(text, "utf8").equals(bytes)) throw new RoleEditError(`${file} is not valid UTF-8; refusing to rewrite it`);
	return text;
}

/** lstat without following links: a symbolic link or Windows junction is refused, never resolved. */
function plainStat(file: string, what: string): fs.Stats {
	let stat: fs.Stats;
	try {
		stat = fs.lstatSync(file);
	} catch (error) {
		throw new RoleEditError(`cannot inspect ${what} ${file}: ${errorText(error)}`);
	}
	if (stat.isSymbolicLink()) throw new RoleEditError(`linked ${what} is refused: ${file}`);
	return stat;
}

/** Every component from the profile directory up to the filesystem root must be a plain entry. */
function assertPlainChain(dir: string): void {
	for (let current = path.resolve(dir); ; current = path.dirname(current)) {
		plainStat(current, "profile path");
		if (path.dirname(current) === current) return;
	}
}

/** A regular file with no other hard link, so an alias cannot diverge from the rewritten file. */
function assertPlainFile(file: string, what: string): void {
	const stat = plainStat(file, what);
	if (!stat.isFile()) throw new RoleEditError(`${what} is not a regular file: ${file}`);
	if (stat.nlink > 1) throw new RoleEditError(`hard link refused for ${what} (nlink ${stat.nlink}): ${file}`);
}

/** Canonical containment: the real target must stay inside the real profile directory. */
function assertContained(dir: string, file: string): void {
	const rel = path.relative(fs.realpathSync.native(dir), fs.realpathSync.native(file));
	if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new RoleEditError(`${file} resolves outside the profile`);
}

/** True when the name exists (a link counts), false only for ENOENT; other lstat errors are refused. */
function existsNoFollow(file: string): boolean {
	try {
		fs.lstatSync(file);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
		throw new RoleEditError(`cannot inspect roles.json ${file}: ${errorText(error)}`);
	}
}

/** Commit revalidates the paths on disk, not only the bytes captured at preview. */
function assertTargets(snap: RoleSnapshot): void {
	const dir = path.dirname(snap.registryPath);
	assertPlainChain(dir);
	if (snap.registryBytes === null) {
		if (existsNoFollow(snap.registryPath)) throw new RoleEditError("roles.json appeared after preview; nothing written");
	} else {
		assertPlainFile(snap.registryPath, "roles.json");
		assertContained(dir, snap.registryPath);
	}
	if (snap.agentPath !== null) {
		plainStat(path.dirname(snap.agentPath), "agents directory");
		assertPlainFile(snap.agentPath, "definition file");
		assertContained(dir, snap.agentPath);
	}
}

function readRegistry(dir: string): RegistryFile {
	const file = path.join(dir, "roles.json");
	assertPlainChain(dir);
	if (!existsNoFollow(file)) return { path: file, bytes: null, text: "", eol: "\n", entries: [] };
	assertPlainFile(file, "roles.json");
	let bytes: Buffer;
	try {
		bytes = fs.readFileSync(file);
	} catch (error) {
		throw new RoleEditError(`cannot read roles.json: ${errorText(error)}`);
	}
	const text = decodeUtf8(bytes, file);
	assertContained(dir, file);
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		throw new RoleEditError(`roles.json is not valid JSON: ${errorText(error)}`);
	}
	if (!Array.isArray(parsed)) throw new RoleEditError("roles.json must be a JSON array of roles");
	// Shared contract with agents.ts (keys, types, duplicate names); the editor adds only its write requirements below.
	const violation = roleRegistryViolation(parsed, true);
	if (violation) throw new RoleEditError(`roles.json ${violation}`);
	const entries = (parsed as Record<string, unknown>[]).map((entry, index) => {
		const row = entry as RegistryEntry;
		if (!row.name || !row.model || !row.provider || row.provider.includes("/")) {
			throw new RoleEditError(`roles.json entry ${index} needs a name, a model and a provider without "/"`);
		}
		return row;
	});
	const eol = text.includes("\r\n") ? "\r\n" : "\n";
	if (formatJson(parsed, eol) !== text) {
		throw new RoleEditError(`roles.json is not in canonical formatting (2-space JSON, ${eol === "\r\n" ? "CRLF" : "LF"}); refusing to rewrite it`);
	}
	return { path: file, bytes, text, eol, entries };
}

/** Locate the three persisted frontmatter lines; each must occur exactly once. */
function definitionLines(text: string): { lines: string[]; index: Record<(typeof DEFINITION_KEYS)[number], number> } {
	const lines = text.split("\n");
	const clean = (line: string) => line.replace(/\r$/, "");
	if (clean(lines[0]).replace(/^\uFEFF/, "") !== "---") throw new RoleEditError("definition has no frontmatter block");
	const close = lines.findIndex((line, i) => i > 0 && clean(line) === "---");
	if (close < 0) throw new RoleEditError("definition frontmatter is not closed");
	const index = {} as Record<(typeof DEFINITION_KEYS)[number], number>;
	for (const key of DEFINITION_KEYS) {
		const hits: number[] = [];
		for (let i = 1; i < close; i++) if (clean(lines[i]).startsWith(`${key}:`)) hits.push(i);
		if (hits.length !== 1) throw new RoleEditError(`definition needs exactly one ${key} frontmatter line (found ${hits.length})`);
		index[key] = hits[0];
	}
	return { lines, index };
}

function rewriteDefinition(text: string, values: Record<(typeof DEFINITION_KEYS)[number], string>): string {
	const { lines, index } = definitionLines(text);
	for (const key of DEFINITION_KEYS) {
		const i = index[key];
		const cr = lines[i].endsWith("\r") ? "\r" : "";
		const value = values[key] === "" ? '""' : values[key];
		lines[i] = `${key}: ${value}${cr}`;
	}
	return lines.join("\n");
}

/** Exactly one definition must carry this role name; links, malformed and duplicate matches are refused. A packaged role may have none (null). */
function findDefinition(dir: string, name: string, packaged: boolean): { path: string; bytes: Buffer; text: string } | null {
	const agentsDir = path.join(dir, "agents");
	let agentsStat: fs.Stats | undefined;
	try {
		agentsStat = fs.lstatSync(agentsDir);
	} catch {
		// Missing agents directory: reported below as a missing definition.
	}
	if (agentsStat?.isSymbolicLink()) throw new RoleEditError(`linked agents directory is refused: ${agentsDir}`);
	let dirents: fs.Dirent[] = [];
	try {
		dirents = fs.readdirSync(agentsDir, { withFileTypes: true });
	} catch {
		// Missing agents directory: reported below as a missing definition.
	}
	const matches: Array<{ file: string; linked: boolean }> = [];
	for (const dirent of dirents) {
		if (!dirent.name.endsWith(".md") || !(dirent.isFile() || dirent.isSymbolicLink())) continue;
		const file = path.join(agentsDir, dirent.name);
		const named = dirent.name === `${name}.md`;
		let text: string;
		try {
			text = fs.readFileSync(file, "utf8");
		} catch (error) {
			if (named) throw new RoleEditError(`cannot read definition file ${file}: ${errorText(error)}`);
			continue;
		}
		let frontmatter: Record<string, unknown>;
		try {
			frontmatter = parseFrontmatter<Record<string, unknown>>(text).frontmatter;
		} catch (error) {
			if (named) throw new RoleEditError(`malformed frontmatter in ${file}: ${errorText(error)}`);
			continue;
		}
		if (frontmatter.name === name) matches.push({ file, linked: dirent.isSymbolicLink() });
	}
	const linked = matches.find((m) => m.linked);
	if (linked) throw new RoleEditError(`linked definition file is refused: ${linked.file}`);
	if (matches.length === 0) {
		if (packaged) return null;
		throw new RoleEditError(`missing definition file for role ${name} in ${agentsDir}`);
	}
	if (matches.length > 1) throw new RoleEditError(`ambiguous definition files for role ${name}: ${matches.map((m) => path.basename(m.file)).join(", ")}`);
	const file = matches[0].file;
	assertPlainFile(file, "definition file");
	assertContained(dir, file);
	const bytes = fs.readFileSync(file);
	const text = decodeUtf8(bytes, file);
	definitionLines(text);
	return { path: file, bytes, text };
}

/** Packaged defaults registry (defaults/roles.json, the pinned baseline); empty when no package root is given. */
export function readPackageEntries(pkgRoot: string | null): RegistryEntry[] {
	if (!pkgRoot) return [];
	const defaults = path.join(pkgRoot, "defaults");
	// A partial package must not be edited from a fallback: both halves of the pinned baseline are required.
	if (!existsNoFollow(path.join(defaults, "roles.json"))) throw new RoleEditError("package defaults roles.json is missing; the package baseline cannot be read, nothing was changed");
	if (!fs.existsSync(path.join(defaults, "agents")) || !fs.statSync(path.join(defaults, "agents")).isDirectory()) throw new RoleEditError("package defaults agents directory is missing; the package baseline cannot be read, nothing was changed");
	return readRegistry(defaults).entries;
}

/** Reads the user roles.json (absent = fresh profile) and the packaged default for the name; a user entry wins as the base. */
export function readRoleSnapshot(dir: string, name: string, pkgRoot: string | null = null): RoleSnapshot {
	const registry = readRegistry(dir);
	const userEntry = registry.entries.find((e) => e.name === name);
	const packagedEntry = readPackageEntries(pkgRoot).find((e) => e.name === name);
	const base = userEntry ?? packagedEntry;
	if (!base) throw new RoleEditError(`role ${name} is not in roles.json`);
	const definition = findDefinition(dir, name, packagedEntry !== undefined);
	return {
		name,
		registryPath: registry.path,
		registryBytes: registry.bytes,
		registryText: registry.text,
		eol: registry.eol,
		entries: registry.entries,
		base,
		agentPath: definition?.path ?? null,
		agentBytes: definition?.bytes ?? null,
		agentText: definition?.text ?? null,
		current: { primary: effectiveModelRef(base), fallbacks: parseFallbackModels(base.fallbackModel), thinking: base.thinking },
	};
}

/**
 * Verified refs are provider/id pairs the installed resolver maps back to the same catalog model. Offered choices are the
 * verified refs that are connected: the registry's available snapshot when offered, else explicit configured auth.
 */
export function catalogFromRegistry(registry: RegistryLike): RoleCatalog {
	const all = registry.getAll();
	const firstByRef = new Map<string, CatalogModel>();
	for (const model of all) {
		const ref = `${model.provider}/${model.id}`;
		if (!firstByRef.has(ref)) firstByRef.set(ref, model);
	}
	const modelRuntime = {
		getModels: () => all,
		hasConfiguredAuth: (provider: string) => {
			const model = all.find((m) => m.provider === provider);
			return model !== undefined && registry.hasConfiguredAuth(model);
		},
	};
	const verified = new Map<string, CatalogModel>();
	for (const [ref, model] of firstByRef) {
		const resolved = resolveCliModel({ cliModel: ref, modelRuntime: modelRuntime as never }).model;
		if (resolved?.provider === model.provider && resolved?.id === model.id) verified.set(ref, model);
	}
	const available = registry.getAvailable?.() ?? all.filter((m) => registry.hasConfiguredAuth(m) === true);
	const connected = new Set(available.map((m) => `${m.provider}/${m.id}`));
	const offered = [...verified].filter(([ref]) => connected.has(ref)).map(([, model]) => model);
	return {
		models: () => offered,
		find: (ref) => verified.get(ref),
		configured: (model) => registry.hasConfiguredAuth(model),
	};
}

export function planRoleChange(snap: RoleSnapshot, proposed: RoleSettings, catalog: RoleCatalog): RolePlan {
	const primary = proposed.primary.trim();
	const thinking = proposed.thinking.trim();
	const slash = primary.indexOf("/");
	if (slash <= 0 || slash === primary.length - 1) throw new RoleEditError(`primary model must be provider/model, got "${primary}"`);
	if (!thinking) throw new RoleEditError("a thinking level is required");
	const fallbacks = parseFallbackModels(proposed.fallbacks.join(FALLBACK_SEPARATOR)).filter((ref) => ref !== primary);
	const warnings: string[] = [];
	for (const ref of proposed.fallbacks) if (ref === primary) warnings.push(`${primary} is the primary and was removed from fallbacks`);

	const current = snap.current;
	const primaryChanged = primary !== current.primary;
	const thinkingChanged = thinking !== current.thinking;
	const fallbackText = fallbacks.join(FALLBACK_SEPARATOR);
	const changed = primaryChanged || thinkingChanged || fallbackText !== current.fallbacks.join(FALLBACK_SEPARATOR);

	const model = catalog.find(primary);
	if (primaryChanged && !model) throw new RoleEditError(`primary ${primary} is not in the installed catalog`);
	const levels = model ? getSupportedThinkingLevels(model) : undefined;
	if ((primaryChanged || thinkingChanged) && levels && !levels.includes(thinking as never)) {
		throw new RoleEditError(`thinking ${thinking} is not supported by ${primary}; choose one of: ${levels.join(", ")}`);
	}
	if (!model) warnings.push(`primary ${primary} is not in installed catalog; kept as declared`);
	else if (!catalog.configured(model)) warnings.push(`primary ${primary} has no configured credentials`);
	if (levels && !levels.includes(thinking as never)) warnings.push(`thinking ${thinking} is not supported by ${primary}; kept as declared`);
	for (const ref of fallbacks) {
		const fallback = catalog.find(ref);
		if (!fallback) {
			warnings.push(`fallback ${ref} is not in installed catalog`);
			continue;
		}
		if (!catalog.configured(fallback)) warnings.push(`fallback ${ref} has no configured credentials`);
		const clamped = clampThinkingLevel(fallback, thinking as never);
		if (clamped !== thinking) warnings.push(`fallback ${ref} cannot run thinking ${thinking}; it will clamp to ${clamped}`);
	}

	let registryText = snap.registryText;
	let agentText = snap.agentText;
	if (changed) {
		const id = primary.slice(slash + 1);
		const provider = primary.slice(0, slash);
		const change = { ...(primaryChanged ? { provider, model: roleModelField(provider, id) } : {}), fallbackModel: fallbackText, thinking };
		// A user entry is edited in place; a packaged-only role gets a new override entry with the editor's five fields (no tools copy).
		const entries = snap.entries.some((e) => e.name === snap.name)
			? snap.entries.map((e) => (e.name === snap.name ? { ...e, ...change } : e))
			: [...snap.entries, { name: snap.name, provider: snap.base.provider, model: snap.base.model, ...change }];
		registryText = formatJson(entries, snap.eol);
		if (snap.agentPath !== null && snap.agentText !== null) {
			agentText = rewriteDefinition(snap.agentText, { model: primary, fallbackModel: fallbackText, thinking });
			// Validate what will be written with the real parsers before any file is touched.
			const md = parseFrontmatter<Record<string, unknown>>(agentText).frontmatter;
			if (md.model !== primary || md.fallbackModel !== fallbackText || md.thinking !== thinking) {
				throw new RoleEditError(`definition ${snap.agentPath} does not round-trip the proposed values`);
			}
		}
		const row = (JSON.parse(registryText) as RegistryEntry[]).find((e) => e.name === snap.name);
		if (!row || row.fallbackModel !== fallbackText || row.thinking !== thinking || effectiveModelRef(row) !== primary) {
			throw new RoleEditError("roles.json does not round-trip the proposed values");
		}
	}

	const fmt = (s: RoleSettings) => `primary ${s.primary} | fallbacks ${s.fallbacks.length ? s.fallbacks.join(FALLBACK_SEPARATOR) : "(none)"} | thinking ${s.thinking}`;
	const preview = [
		`Role ${snap.name}`,
		`Before: ${fmt(current)}`,
		`After:  ${fmt({ primary, fallbacks, thinking })}`,
		snap.agentPath === null
			? `Writes: roles.json override entry ${snap.name}; packaged definition unchanged, not copied`
			: `Writes: roles.json entry ${snap.name}; agents/${path.basename(snap.agentPath)} model, fallbackModel, thinking lines`,
		...warnings.map((w) => `Warning: ${w}`),
	].join("\n");
	return { changed, warnings, preview, registryPath: snap.registryPath, registryText, agentPath: snap.agentPath, agentText };
}

const readOrNull = (file: string): Buffer | null => {
	try {
		return fs.readFileSync(file);
	} catch {
		return null;
	}
};
const sameBytes = (actual: Buffer | null, expected: Buffer | null): boolean =>
	expected === null ? actual === null : actual !== null && actual.equals(expected);

/**
 * Atomic same-directory replace of the definition first, registry last (commit point).
 * Not cross-file atomic: a failed registry replace rolls back only our definition bytes.
 */
export function commitRolePlan(
	snap: RoleSnapshot,
	plan: RolePlan,
	opts: { rename?: (from: string, to: string) => void; write?: (file: string, bytes: Buffer) => void } = {},
): CommitResult {
	if (!plan.changed) return { status: "saved", rolledBack: false, recovery: [], reason: "no changes" };
	const rename = opts.rename ?? ((from: string, to: string) => fs.renameSync(from, to));
	const write = opts.write ?? ((file: string, bytes: Buffer) => fs.writeFileSync(file, bytes, { flag: "wx" }));
	const recovery: string[] = [];
	const owned = new Set<string>();
	const agentDir = plan.agentPath === null ? "" : path.dirname(plan.agentPath);
	const agentBase = plan.agentPath === null ? "" : path.basename(plan.agentPath);
	const newAgentBytes = plan.agentText === null ? null : Buffer.from(plan.agentText, "utf8");
	// Tracked before the write, so a partially written temp is cleaned up like a complete one.
	const stage = (dir: string, base: string, bytes: Buffer): string => {
		const tmp = path.join(dir, `.${base}.${randomBytes(6).toString("hex")}.tmp`);
		owned.add(tmp);
		write(tmp, bytes);
		return tmp;
	};
	const keep = (tmp: string): void => {
		owned.delete(tmp);
		recovery.push(tmp);
	};
	try {
		assertTargets(snap);
	} catch (error) {
		return { status: "failed", rolledBack: false, recovery, reason: `${errorText(error)}; nothing written` };
	}
	if (!sameBytes(readOrNull(snap.registryPath), snap.registryBytes) || (snap.agentPath !== null && !sameBytes(readOrNull(snap.agentPath), snap.agentBytes))) {
		return { status: "conflict", rolledBack: false, recovery, reason: "roles.json or the definition changed after preview; nothing written" };
	}

	try {
		// Every temp is staged before the first replace, so a staging failure leaves both targets untouched.
		let agentTmp: string | undefined;
		let originalTmp: string | undefined;
		let registryTmp: string;
		try {
			if (plan.agentPath !== null && newAgentBytes !== null && snap.agentBytes !== null) {
				agentTmp = stage(agentDir, agentBase, newAgentBytes);
				originalTmp = stage(agentDir, agentBase, snap.agentBytes);
			}
			registryTmp = stage(path.dirname(plan.registryPath), path.basename(plan.registryPath), Buffer.from(plan.registryText, "utf8"));
		} catch (error) {
			return { status: "failed", rolledBack: false, recovery, reason: `staging failed (${errorText(error)}); nothing changed` };
		}
		// Restores our pre-staged original only while our definition is still in place; otherwise it is kept for recovery.
		const rollback = (reason: string): CommitResult => {
			if (agentTmp === undefined || originalTmp === undefined) return { status: "failed", rolledBack: false, recovery, reason: `${reason}; no definition was replaced` };
			if (!sameBytes(readOrNull(plan.agentPath as string), newAgentBytes)) {
				keep(originalTmp);
				return { status: "failed", rolledBack: false, recovery, reason: `${reason}; definition changed externally, not rolled back; original definition bytes kept at ${originalTmp}` };
			}
			try {
				rename(originalTmp, plan.agentPath as string);
				owned.delete(originalTmp);
				return { status: "failed", rolledBack: true, recovery, reason: `${reason}; definition rolled back` };
			} catch (error) {
				keep(originalTmp);
				return { status: "failed", rolledBack: false, recovery, reason: `${reason}; rollback failed (${errorText(error)}); original definition bytes kept at ${originalTmp}` };
			}
		};
		if (agentTmp !== undefined) {
			try {
				rename(agentTmp, plan.agentPath as string);
				owned.delete(agentTmp);
			} catch (error) {
				return { status: "failed", rolledBack: false, recovery, reason: `definition replace failed (${errorText(error)}); nothing changed` };
			}
		}
		if (!sameBytes(readOrNull(snap.registryPath), snap.registryBytes)) return { ...rollback("roles.json changed before commit"), status: "conflict" };
		try {
			rename(registryTmp, plan.registryPath);
			owned.delete(registryTmp);
		} catch (error) {
			return rollback(`roles.json replace failed (${errorText(error)})`);
		}
		return { status: "saved", rolledBack: false, recovery, reason: "" };
	} catch (error) {
		return { status: "failed", rolledBack: false, recovery, reason: `unexpected failure (${errorText(error)}); check roles.json and the definition before retrying` };
	} finally {
		for (const tmp of owned) {
			try {
				fs.rmSync(tmp, { force: true });
			} catch {
				// Leftover temp names end in .tmp; a later run can see them.
			}
		}
	}
}

const PICKER_ROWS = 10;
/** Rows a window may use: pi-tui places it at maxHeight (SUBAGENT_WINDOW_OPTIONS) with a margin row above and below. */
const windowBudget = (rows: number | undefined): number =>
	rows === undefined ? Number.POSITIVE_INFINITY : Math.min(Math.floor((rows * Number.parseFloat(SUBAGENT_WINDOW_OPTIONS.maxHeight)) / 100), rows - 2 * SUBAGENT_WINDOW_OPTIONS.margin);

export interface PickerView {
	searchable?: boolean;
	body?: string[];
	/** Informational body: dropped (never gating Enter) when no body row fits beside the list. */
	optionalBody?: boolean;
	tui?: { terminal?: { rows?: number } };
}

/**
 * Framed window (the subagent inspector's frame and placement). Searchable pickers filter with Input; menus and the save
 * preview are not. Rows fit the window budget; a preview body that does not fit scrolls with PgUp/PgDn. Labels are unique,
 * so a label is the returned value.
 */
export class SearchPicker implements Component, Focusable {
	private readonly input = new Input({ prompt: "search: " });
	private readonly searchable: boolean;
	readonly body: string[];
	private list: SelectList | undefined;
	private listCap = PICKER_ROWS;
	private filtered: string[] = [];
	private settled = false;
	private hasFocus = false;
	private bodyOffset = 0;
	private bodyShown = 0;
	private bodyTotal = 0;
	// shortcut: input is gated only after the first render (a frame showing the body); upgrade if a key can precede the first paint.
	private laidOut = false;
	private listTop = 0;
	private listHeight = 0;

	constructor(
		readonly title: string,
		readonly options: string[],
		private readonly theme: Theme,
		private readonly keybindings: KeybindingsManager,
		private readonly done: (result: string | undefined) => void,
		private readonly view: PickerView = {},
	) {
		this.searchable = view.searchable ?? true;
		this.body = view.body ?? [];
		this.rebuild();
	}

	/** Forwards focus to the Input so the IME cursor lands on the search field. */
	get focused(): boolean {
		return this.hasFocus;
	}

	set focused(value: boolean) {
		this.hasFocus = value;
		this.input.focused = value;
	}

	selectedLabel(): string | undefined {
		return this.list?.getSelectedItem()?.value;
	}

	handleInput(data: string): void {
		const kb = this.keybindings;
		if (kb.matches(data, "tui.select.cancel")) this.finish(undefined);
		else if (kb.matches(data, "tui.select.confirm") || data === "\n") {
			// Zero matches: Enter is inert, not a cancel.
			const label = this.selectedLabel();
			if (label !== undefined && !this.blind()) this.finish(label);
		} else if (kb.matches(data, "tui.select.up")) this.move(-1);
		else if (kb.matches(data, "tui.select.down")) this.move(1);
		else if (kb.matches(data, "tui.select.pageUp")) this.page(-1);
		else if (kb.matches(data, "tui.select.pageDown")) this.page(1);
		else if (this.searchable) {
			const before = this.input.getValue();
			this.input.handleInput(data);
			if (this.input.getValue() !== before) this.rebuild();
		}
	}

	/** A preview whose body has no visible row must not be confirmed: Save is not on screen and Enter stays inert (Escape cancels). */
	private blind(): boolean {
		return this.laidOut && this.body.length > 0 && this.bodyShown < 1 && !this.view.optionalBody;
	}

	/** PgUp/PgDn scroll a non-searchable body (menu roster, save preview) that does not fit; searchable pickers, including the Add hint, page the list. */
	private page(direction: 1 | -1): void {
		if (!this.searchable && this.bodyTotal > this.bodyShown) {
			this.bodyOffset = Math.max(0, Math.min(this.bodyTotal - this.bodyShown, this.bodyOffset + direction * Math.max(1, this.bodyShown)));
			return;
		}
		this.move(direction * PICKER_ROWS);
	}

	private rebuild(): void {
		this.filtered = fuzzyFilter(this.options, this.input.getValue(), (option) => option);
		this.buildList(this.listCap);
	}

	/** SelectList has no setMaxVisible, so the list is rebuilt when its row budget changes; `keep` retains the selection. */
	private buildList(cap: number, keep?: string): void {
		this.listCap = Math.max(1, cap);
		this.list = this.filtered.length > 0 ? new SelectList(this.filtered.map((value) => ({ value, label: value })), this.listCap, getSelectListTheme()) : undefined;
		const at = keep === undefined ? -1 : this.filtered.indexOf(keep);
		if (this.list && at >= 0) this.list.setSelectedIndex(at);
	}

	private move(delta: number): void {
		if (!this.list) return;
		const current = this.filtered.indexOf(this.selectedLabel() ?? "");
		this.list.setSelectedIndex(Math.max(0, Math.min(this.filtered.length - 1, current + delta)));
	}

	/** Wheel moves the list from anywhere in the window; press and click must land on a list row. */
	handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
		if (!this.list) return undefined;
		const y = event.y - this.listTop;
		if (event.type !== "wheel" && (y < 0 || y >= this.listHeight)) return undefined;
		return this.list.handleMouse({ ...event, y });
	}

	render(width: number): string[] {
		const budget = windowBudget(this.view.tui?.terminal?.rows);
		const listMin = Math.max(1, Math.min(this.filtered.length, 2));
		// An optional body needs the head (title or search), one body row and one list row; otherwise it is dropped.
		const hasBody = this.body.length > 0 && (!this.view.optionalBody || budget >= (this.searchable ? 2 : 1) + 2);
		// A preview needs its body row and options: the frame (chrome) goes first when it cannot hold them.
		const framed = width >= 8 && (!hasBody || budget - 2 >= 1 + listMin);
		const inner = framed ? width - 4 : width;
		const pad = framed && budget >= 14 ? 1 : 0;
		const room = budget - (framed ? 2 + 2 * pad : 0);
		// Title and search (or menu) always stay; status, then hint, drop on short terminals so the list keeps 2 rows.
		// A preview drops its title before its body row or options give way.
		let used = this.searchable ? 2 : 1;
		const showTitle = !hasBody || room >= 1 + 1 + listMin;
		if (!showTitle) used--;
		const showStatus = this.searchable && room >= used + 3;
		if (showStatus) used++;
		const showHint = room >= used + (hasBody ? 2 + listMin : 3);
		if (showHint) used++;
		const space = Math.max(2, room - used);
		const count = this.filtered.length;
		const bodyLines = hasBody ? this.body.flatMap((line) => wrapTextWithAnsi(line, inner)) : [];
		const want = count <= PICKER_ROWS ? count : PICKER_ROWS + 1;
		const listRows = Math.max(Math.min(count, 2), Math.min(want, space - Math.min(bodyLines.length, 3)));
		const cap = count <= listRows ? count : listRows - 1;
		if (this.list && cap !== this.listCap) this.buildList(cap, this.selectedLabel());
		const listLines = this.list ? this.list.render(inner) : [this.theme.fg("muted", "no matches")];
		const shown = Math.min(bodyLines.length, Math.max(0, space - listLines.length));
		this.bodyTotal = bodyLines.length;
		this.bodyShown = shown;
		this.laidOut = true;
		this.bodyOffset = Math.max(0, Math.min(this.bodyOffset, bodyLines.length - shown));
		const muted = (text: string) => this.theme.fg("muted", text);
		if (hasBody && shown < 1 && !this.view.optionalBody) {
			// No body row fits: no list is drawn, so no Save is offered; Escape still cancels.
			this.listTop = 0;
			this.listHeight = 0;
			const notice = [truncateToWidth(muted("terminal too small to review changes · Esc cancel"), inner, "", true)];
			return framed ? frameWindow(notice, width, (text) => this.theme.fg("border", text), pad === 1) : notice;
		}
		const head = showTitle ? [this.theme.fg("accent", this.theme.bold(this.title))] : [];
		if (this.searchable) head.push(...this.input.render(inner));
		if (showStatus) head.push(muted(`${count}/${this.options.length} match`));
		const shownBody = bodyLines.slice(this.bodyOffset, this.bodyOffset + shown);
		const hint = this.searchable ? "type to search · ↑↓ PgUp/PgDn · Enter select · Esc cancel" : `${this.bodyTotal > shown ? "PgUp/PgDn scroll · " : ""}↑↓ choose · Enter select · Esc cancel`;
		const painted = [...head, ...shownBody, ...listLines, ...(showHint ? [muted(hint)] : [])].map((line) => truncateToWidth(line, inner, "", true));
		this.listTop = (framed ? 1 + pad : 0) + head.length + shownBody.length;
		this.listHeight = listLines.length;
		return framed ? frameWindow(painted, width, (text) => this.theme.fg("border", text), pad === 1) : painted;
	}

	invalidate(): void {}

	private finish(result: string | undefined): void {
		if (this.settled) return;
		this.settled = true;
		this.done(result);
	}
}

/** TUI mode: every choice is a framed window (menus and the save preview too); RPC and other modes keep native dialogs. */
export function pickFrom(ctx: RoleCommandContext, title: string, options: string[], view: Omit<PickerView, "tui"> = {}): Promise<string | undefined> {
	if (ctx.mode !== "tui" || !ctx.ui.custom) return ctx.ui.select(title, options);
	// overlay: fullscreen keeps plain PageUp/PageDown for the transcript unless an overlay has focus; placement is the inspector's.
	return ctx.ui.custom<string | undefined>((tui, theme, keybindings, done) => new SearchPicker(title, options, theme, keybindings, done, { ...view, tui }), { overlay: true, overlayOptions: { ...SUBAGENT_WINDOW_OPTIONS } });
}

/** Save preview: TUI shows the before/after body with explicit Save and Cancel; other modes keep the native confirm. */
async function confirmSave(ctx: RoleCommandContext, name: string, preview: string): Promise<boolean> {
	if (ctx.mode !== "tui" || !ctx.ui.custom) return ctx.ui.confirm(`Save role ${name}?`, preview);
	const save = `Save role ${name}`;
	return (await pickFrom(ctx, `Save role ${name}?`, [save, "Cancel"], { searchable: false, body: preview.split("\n") })) === save;
}

function askOrCancel(pick: (title: string, options: string[]) => Promise<string | undefined>) {
	return async (title: string, options: string[]): Promise<string> => {
		const picked = await pick(title, options);
		if (picked === undefined) throw new RoleFlowCancelled();
		return picked;
	};
}

/** Entry point for `/subagent roles`: native dialogs only; no write before a final confirm. Packaged defaults are listed with their effective settings; a save writes only a user roles.json override. */
export async function editRoleConfig(ctx: RoleCommandContext, opts: { packageRoot?: string | null } = {}): Promise<void> {
	if (!ctx.hasUI) {
		ctx.ui.notify("/subagent roles needs an interactive session; nothing was changed.", "warning");
		return;
	}
	try {
		const dir = getAgentDir();
		const pkgRoot = opts.packageRoot !== undefined ? opts.packageRoot : packageRoot();
		const registry = readRegistry(dir);
		const names = [...registry.entries.map((e) => e.name), ...readPackageEntries(pkgRoot).map((e) => e.name).filter((n) => !registry.entries.some((e) => e.name === n))];
		if (names.length === 0) {
			ctx.ui.notify("roles.json has no roles to edit.", "warning");
			return;
		}
		const catalog = catalogFromRegistry(ctx.modelRegistry);
		if (catalog.models().length === 0) {
			ctx.ui.notify("No connected models: connect a provider with /login or set its API key environment variable, then run /subagent roles again. Nothing was changed.", "warning");
			return;
		}
		const ask = askOrCancel((title, options) => pickFrom(ctx, title, options, { searchable: false }));
		const askSearch = askOrCancel((title, options) => pickFrom(ctx, title, options));
		const name = await askSearch("Edit role model settings", names);
		const snap = readRoleSnapshot(dir, name, pkgRoot);
		const connected = new Set(catalog.models().map((m) => `${m.provider}/${m.id}`));
		// Saved refs that are not connected stay visible with an explicit label; the label maps back to the exact ref.
		const access = (ref: string) => (connected.has(ref) ? "connected" : catalog.find(ref) ? "not connected" : "not in installed catalog");
		const suffix = (ref: string) => (connected.has(ref) ? "" : ` (${access(ref)})`);

		// The current primary is always pinned first under its exact ref; plain catalog rows never repeat it.
		const picks = new Map<string, string>();
		picks.set(`Current ${snap.current.primary}${suffix(snap.current.primary)}`, snap.current.primary);
		for (const model of catalog.models()) if (`${model.provider}/${model.id}` !== snap.current.primary) picks.set(`${model.provider}/${model.id}`, `${model.provider}/${model.id}`);
		const askPrimary = askOrCancel((title, options) => pickFrom(ctx, title, options, { body: [`Current primary: ${snap.current.primary} (${access(snap.current.primary)})`], optionalBody: true }));
		const primaryLabel = await askPrimary(`Primary model for ${name}`, [...picks.keys()]);
		const primary = picks.get(primaryLabel);
		if (!primary) throw new RoleEditError(`unknown primary choice: ${primaryLabel}`);

		const fallbacks = [...snap.current.fallbacks];
		const candidates = () => catalog.models().map((m) => `${m.provider}/${m.id}`).filter((ref) => ref !== primary && !fallbacks.includes(ref));
		// Current selections, numbered in order, rebuilt on every pass so the menu body follows each change.
		const roster = () => [
			`Primary: ${primary} (${access(primary)})`,
			...(fallbacks.length ? ["Fallbacks, tried in order:", ...fallbacks.map((ref, i) => `${i + 1}. ${ref} (${access(ref)})`)] : ["Fallbacks: (none)"]),
		];
		const askMenu = askOrCancel((title, options) => pickFrom(ctx, title, options, { searchable: false, body: roster(), optionalBody: true }));
		const askAdd = askOrCancel((title, options) => pickFrom(ctx, title, options, { body: ["Hidden: the primary and fallbacks already listed."], optionalBody: true }));
		const pickIndex = async (title: string): Promise<number> => {
			const options = fallbacks.map((ref, i) => `${i + 1}. ${ref}${suffix(ref)}`);
			const index = options.indexOf(await askSearch(title, options));
			if (index < 0) throw new RoleEditError("unknown fallback choice");
			return index;
		};
		for (;;) {
			const items = [
				...(candidates().length ? ["Add fallback"] : []),
				...(fallbacks.length ? ["Remove fallback"] : []),
				...(fallbacks.length > 1 ? ["Move fallback up", "Move fallback down"] : []),
				"Done",
			];
			const action = await askMenu(`Fallbacks for ${name} (primary ${primary})`, items);
			if (action === "Done") break;
			if (action === "Add fallback") fallbacks.push(await askAdd(`Add fallback to ${name}`, candidates()));
			else if (action === "Remove fallback") fallbacks.splice(await pickIndex("Remove which fallback"), 1);
			else if (action === "Move fallback up") {
				const i = await pickIndex("Move which fallback up");
				if (i > 0) [fallbacks[i - 1], fallbacks[i]] = [fallbacks[i], fallbacks[i - 1]];
			} else if (action === "Move fallback down") {
				const i = await pickIndex("Move which fallback down");
				if (i < fallbacks.length - 1) [fallbacks[i], fallbacks[i + 1]] = [fallbacks[i + 1], fallbacks[i]];
			}
		}

		const model = catalog.find(primary);
		const levels = model ? getSupportedThinkingLevels(model) : [snap.current.thinking];
		// An unchanged legacy level stays selectable under a labelled option; the label maps back to the exact value.
		const thinkingPicks = new Map<string, string>(levels.map((level) => [level, level] as const));
		if (primary === snap.current.primary && !levels.includes(snap.current.thinking as never)) {
			thinkingPicks.set(`${snap.current.thinking} (current, unsupported by ${primary})`, snap.current.thinking);
		}
		const thinkingLabel = await ask(`Thinking level for ${name} (${primary})`, [...thinkingPicks.keys()]);
		const thinking = thinkingPicks.get(thinkingLabel);
		if (!thinking) throw new RoleEditError(`unknown thinking choice: ${thinkingLabel}`);

		let plan: RolePlan;
		try {
			plan = planRoleChange(snap, { primary, fallbacks, thinking }, catalog);
		} catch (error) {
			ctx.ui.notify(errorText(error), "error");
			return;
		}
		if (!plan.changed) {
			ctx.ui.notify(`No changes to role ${name}; nothing saved.`, "info");
			return;
		}
		if (!(await confirmSave(ctx, name, plan.preview))) {
			ctx.ui.notify("Role changes not saved.", "info");
			return;
		}
		const result = commitRolePlan(snap, plan);
		if (result.status === "saved") {
			ctx.ui.notify(`Saved role ${name}. Jobs already accepted keep their snapshot; new jobs use the saved settings.`, "info");
		} else {
			const recovery = result.recovery.length ? ` Recovery files: ${result.recovery.join(", ")}` : "";
			ctx.ui.notify(`Role ${name} not saved: ${result.reason}.${recovery}`, "error");
		}
	} catch (error) {
		if (error instanceof RoleFlowCancelled) ctx.ui.notify("Role edit cancelled; nothing saved.", "info");
		else ctx.ui.notify(errorText(error), "error");
	}
}
