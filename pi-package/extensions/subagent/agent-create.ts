/**
 * Native `/subagent create`: operator-only. It freezes the chosen spec in an owned temp dir, previews the Python CLI, and applies
 * only after an explicit CREATE. The Python CLI is the sole validator and writer; this module chooses argv, freezes bytes and
 * classifies exits. Not a model tool, and created agents are not loaded, trusted or launched here.
 */
import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { packageRoot } from "./agents.ts";
import { pickFrom, type RoleCommandContext } from "./roles-editor.ts";

export const MAX_SPEC_BYTES = 256 * 1024;
const PREVIEW_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const EXIT_USAGE = 2;
const EXIT_REFUSED = 1;
const EXIT_PARTIAL = 3;
/** Windows `python` launcher missing from PATH (the Store stub's "not recognized" code). */
const LAUNCHER_NOT_FOUND = 9009;
const WRITER_REFUSAL = "ERROR: writer:true requires --allow-writers";
const SHELL_REFUSAL = /^ERROR: shell:(bash|powershell) requires --allow-shell$/;
const STATUS_KEY = "subagent-create";

export const CREATE_HELP = "/subagent create: operator-only. Asks for an absolute project root and spec JSON file, previews the files, and creates them only after you choose CREATE. Not a model tool; created agents are not active until used with agentScope project/both.";

export type ProcessResult =
	| { kind: "exit"; code: number; stdout: Buffer; stderr: Buffer }
	| { kind: "spawn"; code?: string; stdout: Buffer; stderr: Buffer }
	| { kind: "overflow"; stdout: Buffer; stderr: Buffer }
	| { kind: "killed"; signal: NodeJS.Signals | null; stdout: Buffer; stderr: Buffer };

/** shell:false, UTF-8 bytes kept whole (no per-chunk string concatenation), bounded output. */
export function runProcess(cmd: string, args: string[], opts: { cwd: string; timeoutMs?: number }): Promise<ProcessResult> {
	return new Promise((resolve) => {
		try {
			execFile(cmd, args, { cwd: opts.cwd, encoding: "buffer", maxBuffer: MAX_OUTPUT_BYTES, shell: false, timeout: opts.timeoutMs, windowsHide: true }, (error, stdout, stderr) => {
				if (!error) return resolve({ kind: "exit", code: 0, stdout, stderr });
				const e = error as NodeJS.ErrnoException & { killed?: boolean; signal?: NodeJS.Signals | null };
				if (e.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") return resolve({ kind: "overflow", stdout, stderr });
				if (typeof e.code === "number") return resolve({ kind: "exit", code: e.code, stdout, stderr });
				if (e.killed || e.signal) return resolve({ kind: "killed", signal: e.signal ?? null, stdout, stderr });
				return resolve({ kind: "spawn", code: typeof e.code === "string" ? e.code : undefined, stdout, stderr });
			});
		} catch (error) {
			// Node throws some spawn errors synchronously (Windows EFTYPE for a non-executable file), never through the callback.
			const code = (error as NodeJS.ErrnoException).code;
			resolve({ kind: "spawn", code: typeof code === "string" ? code : undefined, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) });
		}
	});
}

/** Display only: escapes controls, bidi and format characters so the review shows what the bytes contain. Never used for argv or files. */
export function sanitizeForDisplay(text: string): string {
	return text
		.replace(/\r\n?/g, "\n")
		.replace(/\t/g, "    ")
		.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u2028\u2029]|\p{Cf}/gu, (ch) => `<U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}>`);
}

export type CreateArgs = { kind: "flow" } | { kind: "help" } | { kind: "unknown"; value: string };

export function parseCreateArgs(args: string): CreateArgs {
	const value = args.trim();
	if (value === "") return { kind: "flow" };
	if (value === "help") return { kind: "help" };
	return { kind: "unknown", value };
}

export interface CreateContext extends RoleCommandContext {
	ui: RoleCommandContext["ui"] & {
		input(title: string): Promise<string | undefined>;
		setStatus(key: string, text: string | undefined): void;
	};
}

export interface CreateDeps {
	run?: (cmd: string, args: string[], opts: { cwd: string; timeoutMs?: number }) => Promise<ProcessResult>;
	python?: string;
	agentDir?: string;
	tmpRoot?: string;
}

type Grants = { writer: boolean; shell: boolean };
type Preview = { kind: "ok"; bytes: Buffer; text: string } | { kind: "launcher" } | { kind: "refused"; grant: "writer" | "shell" } | { kind: "fail"; message: string };

const defaultPython = (): string => (process.platform === "win32" ? "python" : "python3");

function decodeStrict(bytes: Buffer): string | undefined {
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return undefined;
	}
}

const isFile = (p: string): boolean => {
	try {
		return fs.statSync(p).isFile();
	} catch {
		return false;
	}
};

const isDirectory = (p: string): boolean => {
	try {
		return fs.statSync(p).isDirectory();
	} catch {
		return false;
	}
};

/** Strips one pair of surrounding quotes and whitespace from a typed path. */
function cleanPath(input: string): string {
	const t = input.trim();
	return t.length >= 2 && (t[0] === '"' || t[0] === "'") && t.at(-1) === t[0] ? t.slice(1, -1).trim() : t;
}

function cliArgs(cli: string, root: string, agentDir: string, frozen: string, grants: Grants): string[] {
	return [
		"-I",
		"-X",
		"utf8",
		cli,
		"--spec",
		frozen,
		"--project-root",
		root,
		"--agent-dir",
		agentDir,
		...(grants.writer ? ["--allow-writers"] : []),
		...(grants.shell ? ["--allow-shell"] : []),
	];
}

function classify(r: ProcessResult): Preview {
	if (r.kind === "spawn" || (r.kind === "exit" && r.code === LAUNCHER_NOT_FOUND)) return { kind: "launcher" };
	if (r.kind === "overflow") return { kind: "fail", message: "preview output exceeded 2 MiB; nothing was written." };
	if (r.kind === "killed") return { kind: "fail", message: "preview timed out or was killed after 30 s; nothing was written." };
	if (r.code === 0) {
		const text = decodeStrict(r.stdout);
		return text === undefined ? { kind: "fail", message: "preview output was not valid UTF-8; nothing was written." } : { kind: "ok", bytes: r.stdout, text };
	}
	const message = r.stderr.toString("utf8").trim();
	if (r.code === EXIT_REFUSED && message === WRITER_REFUSAL) return { kind: "refused", grant: "writer" };
	if (r.code === EXIT_REFUSED && SHELL_REFUSAL.test(message)) return { kind: "refused", grant: "shell" };
	const shown = sanitizeForDisplay(message) || "(no stderr)";
	if (r.code === EXIT_USAGE) return { kind: "fail", message: `CLI usage or argument mismatch (exit 2); nothing was written: ${shown}` };
	if (r.code === EXIT_REFUSED) return { kind: "fail", message: `CLI refused the spec (exit 1); nothing was written: ${shown}` };
	return { kind: "fail", message: `unexpected exit ${r.code}; nothing was written: ${shown}` };
}

async function askRoot(ctx: CreateContext): Promise<string | undefined> {
	for (;;) {
		const raw = await ctx.ui.input("Project root (absolute path; Esc cancels)");
		if (raw === undefined) return undefined;
		const root = cleanPath(raw);
		if (!path.isAbsolute(root)) ctx.ui.notify("Project root must be an absolute path.", "error");
		else if (!isDirectory(root)) ctx.ui.notify("Project root is not a directory.", "error");
		else return root;
	}
}

async function askSpec(ctx: CreateContext): Promise<string | undefined> {
	for (;;) {
		const raw = await ctx.ui.input("Spec JSON file (absolute path; Esc cancels)");
		if (raw === undefined) return undefined;
		const file = cleanPath(raw);
		if (!path.isAbsolute(file)) ctx.ui.notify("Spec path must be an absolute path.", "error");
		else if (!isFile(file)) ctx.ui.notify("Spec path is not a file.", "error");
		else if (fs.statSync(file).size > MAX_SPEC_BYTES) ctx.ui.notify(`Spec file exceeds 256 KiB (${MAX_SPEC_BYTES} bytes).`, "error");
		else return file;
	}
}

/** Shown only when the launcher could not start; Esc cancels. Nothing is installed, configured or guessed. */
async function askPython(ctx: CreateContext, failed: string): Promise<string | undefined> {
	ctx.ui.notify(`The Python launcher '${sanitizeForDisplay(failed)}' could not start. Enter an absolute path to Python 3, or Esc to cancel.`, "warning");
	for (;;) {
		const raw = await ctx.ui.input("Absolute path to a Python 3 executable (optional; Esc cancels)");
		if (raw === undefined || raw.trim() === "") return undefined;
		const exe = cleanPath(raw);
		if (path.isAbsolute(exe) && isFile(exe)) return exe;
		ctx.ui.notify("Python path must be an absolute path to an existing file.", "error");
	}
}

/** Explicit per-run grant after the exact known CLI refusal; Cancel is first and is the default. */
async function offerGrant(ctx: CreateContext, grant: "writer" | "shell"): Promise<boolean> {
	const message = grant === "writer" ? `The CLI refused writer:true (${WRITER_REFUSAL}). Allow the writer grant? It adds edit tools to the agent.` : "The CLI refused a shell grant. Allow shell (bash|powershell)? This is not a sandbox.";
	const accept = grant === "writer" ? "Allow writer (adds edit) and re-preview" : "Allow shell (bash|powershell; not a sandbox) and re-preview";
	return (await pickFrom(ctx, message, ["Cancel (default)", accept], { searchable: false, body: [message] })) === accept;
}

/** TUI: framed review with Cancel first. Other modes keep the native confirm. Never a typed confirmation. */
async function reviewCreate(ctx: CreateContext, text: string): Promise<boolean> {
	if (ctx.mode !== "tui" || !ctx.ui.custom) return ctx.ui.confirm("Create agent files?", text);
	const create = "CREATE the files listed above";
	return (await pickFrom(ctx, "Review agent files", ["Cancel", create], { searchable: false, body: text.split("\n") })) === create;
}

function reportApply(ctx: CreateContext, r: ProcessResult): void {
	if (r.kind === "spawn") return ctx.ui.notify("/subagent create: the Python launcher could not start for apply; nothing was written.", "error");
	if (r.kind === "overflow" || r.kind === "killed") return ctx.ui.notify("/subagent create: apply output exceeded 2 MiB or was killed; unknown completion; not retried. Review the project folder; nothing was deleted.", "error");
	const out = sanitizeForDisplay(r.stdout.toString("utf8").trimEnd());
	const err = sanitizeForDisplay(r.stderr.toString("utf8").trimEnd());
	if (r.code === 0) return ctx.ui.notify(`${out}\nNot active until used with agentScope project/both; nothing reloaded, trusted or launched.`, "info");
	if (r.code === EXIT_PARTIAL) return ctx.ui.notify(`Partial create (exit 3); review the partial file before any cleanup; nothing was deleted.\n${out}\n${err}`, "error");
	ctx.ui.notify(`/subagent create: apply exited ${r.code}; nothing was reported as created.\n${out}\n${err}`, "error");
}

export async function runAgentCreate(ctx: CreateContext, rawArgs: string, deps: CreateDeps = {}): Promise<void> {
	const parsed = parseCreateArgs(rawArgs);
	if (parsed.kind === "help") return void ctx.ui.notify(CREATE_HELP, "info");
	if (parsed.kind === "unknown") return void ctx.ui.notify(`Unknown /subagent create argument: ${sanitizeForDisplay(parsed.value)}. ${CREATE_HELP}`, "warning");
	if (!ctx.hasUI) return void ctx.ui.notify("/subagent create needs an interactive session; nothing was created.", "warning");

	const run = deps.run ?? runProcess;
	const agentDir = deps.agentDir ?? getAgentDir();
	const cli = path.join(packageRoot() ?? agentDir, "skills", "agent-creation", "scripts", "create_agent.py");
	let python = deps.python ?? defaultPython();
	let owned: string | undefined;
	ctx.ui.setStatus(STATUS_KEY, "subagent create: choosing inputs");
	try {
		const root = await askRoot(ctx);
		if (root === undefined) return;
		const specPath = await askSpec(ctx);
		if (specPath === undefined) return;
		if (!isFile(cli)) throw new Error(`agent-creation CLI not found at ${cli}`);

		const dir = fs.mkdtempSync(path.join(deps.tmpRoot ?? os.tmpdir(), "subagent-create-"));
		owned = dir;
		const frozen = path.join(dir, "spec.json");
		const frozenBytes = fs.readFileSync(specPath);
		if (frozenBytes.length > MAX_SPEC_BYTES) throw new Error("spec exceeds 256 KiB");
		fs.writeFileSync(frozen, frozenBytes, { flag: "wx" });
		const frozenUnchanged = (): boolean => fs.readFileSync(frozen).equals(frozenBytes);
		const argv = (grants: Grants): string[] => cliArgs(cli, root, agentDir, frozen, grants);
		const previewOnce = async (grants: Grants): Promise<Preview> =>
			classify(await run(python, argv(grants), { cwd: dir, timeoutMs: PREVIEW_TIMEOUT_MS }));

		let grants: Grants = { writer: false, shell: false };
		let first: Extract<Preview, { kind: "ok" }> | undefined;
		for (;;) {
			const out = await previewOnce(grants);
			if (out.kind === "launcher") {
				const next = await askPython(ctx, python);
				if (next === undefined) return;
				python = next;
				continue;
			}
			if (out.kind === "refused") {
				if (grants[out.grant]) return void ctx.ui.notify("/subagent create: the CLI still refused after the grant; nothing was written.", "error");
				if (!(await offerGrant(ctx, out.grant))) return;
				grants = { ...grants, [out.grant]: true };
				continue;
			}
			if (out.kind === "fail") return void ctx.ui.notify(`/subagent create: ${out.message}`, "error");
			first = out;
			break;
		}

		if (!frozenUnchanged()) return void ctx.ui.notify("/subagent create: frozen spec changed; nothing written.", "error");
		if (!(await reviewCreate(ctx, sanitizeForDisplay(first.text)))) return;

		const again = await previewOnce(grants);
		// Before classifying: a tampered frozen copy must not read as project drift.
		if (!frozenUnchanged()) return void ctx.ui.notify("/subagent create: frozen spec changed; nothing written.", "error");
		if (again.kind !== "ok") return void ctx.ui.notify("/subagent create: the repeat preview did not complete; nothing written.", "error");
		if (!again.bytes.equals(first.bytes)) return void ctx.ui.notify("/subagent create: project changed since preview; nothing written.", "error");
		if (!frozenUnchanged()) return void ctx.ui.notify("/subagent create: frozen spec changed; nothing written.", "error");

		ctx.ui.setStatus(STATUS_KEY, "subagent create: creating files");
		reportApply(ctx, await run(python, [...argv(grants), "--apply"], { cwd: dir }));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		ctx.ui.notify(`/subagent create stopped: ${sanitizeForDisplay(message)}. Check the project folder before retrying; nothing was deleted.`, "error");
	} finally {
		ctx.ui.setStatus(STATUS_KEY, undefined);
		if (owned) fs.rmSync(owned, { recursive: true, force: true });
	}
}

