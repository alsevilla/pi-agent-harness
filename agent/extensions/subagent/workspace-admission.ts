// Process-local workspace admission: one FIFO claim queue per canonical checkout, shared by every launch path.
// Not a cross-Pi-process guarantee; separate processes need isolated worktrees.
import * as fs from "node:fs";
import * as path from "node:path";

export type WorkspaceAccess = "read" | "write";
export interface WorkspaceAdmissionOptions {
	access?: WorkspaceAccess; // default write; read only from a trusted main declaration, never inferred from tools or shell
	signal?: AbortSignal;
	onQueued?: (position: number) => void; // 1-based; observer errors are contained so they cannot strand a claim
}
export interface WorkspaceLease {
	readonly key: string;
	readonly access: WorkspaceAccess;
	readonly token: symbol; // opaque per grant; release only matches this owner
}
export class WorkspaceAdmissionError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "WorkspaceAdmissionError";
	}
}

type Claim = {
	access: WorkspaceAccess;
	token: symbol;
	resolve: (lease: WorkspaceLease) => void;
	reject: (error: Error) => void;
	detach: () => void;
};
type Entry = { readers: Set<symbol>; writer?: symbol; queue: Claim[] };
const workspaces = new Map<string, Entry>();

function canonicalKey(dir: string): string {
	return process.platform === "win32" ? dir.toLowerCase() : dir; // NTFS is case-insensitive; other platforms keep case
}

// Synchronous by design: identity is fixed before any await or provider work.
export function resolveCheckoutKey(cwd: string): string {
	let start: string;
	try {
		start = fs.realpathSync.native(path.resolve(cwd));
		if (!fs.statSync(start).isDirectory()) throw new Error("not a directory");
	} catch (cause) {
		throw new WorkspaceAdmissionError(`workspace cwd is not an existing directory: ${cwd}`, { cause });
	}
	let dir = start;
	for (;;) {
		try {
			fs.lstatSync(path.join(dir, ".git")); // .git directory or worktree gitfile marks the checkout root
			return canonicalKey(dir);
		} catch (cause) {
			if ((cause as { code?: string }).code !== "ENOENT") {
				throw new WorkspaceAdmissionError(`workspace checkout cannot be inspected: ${dir}`, { cause });
			}
		}
		const parent = path.dirname(dir);
		if (parent === dir) return canonicalKey(start); // no checkout above: the directory is its own identity
		dir = parent;
	}
}

// Registers synchronously (before returning) so a queued claim is visible before any await.
export function acquireWorkspace(cwd: string, options: WorkspaceAdmissionOptions = {}): Promise<WorkspaceLease> {
	let key: string;
	try {
		key = resolveCheckoutKey(cwd);
	} catch (error) {
		return Promise.reject(error);
	}
	if (options.signal?.aborted) return Promise.reject(abortError());
	const access = options.access ?? "write";
	const entry = workspaces.get(key) ?? { readers: new Set<symbol>(), queue: [] };
	workspaces.set(key, entry);
	return new Promise<WorkspaceLease>((resolve, reject) => {
		const claim: Claim = { access, token: Symbol(key), resolve, reject, detach: () => {} };
		entry.queue.push(claim);
		pump(key, entry);
		if (!entry.queue.includes(claim)) return; // granted synchronously
		const onAbort = () => {
			const index = entry.queue.indexOf(claim);
			if (index === -1) return; // already granted: the caller owns the lease and releases after its work settles
			entry.queue.splice(index, 1);
			reject(abortError());
			pump(key, entry);
		};
		options.signal?.addEventListener("abort", onAbort, { once: true });
		claim.detach = () => options.signal?.removeEventListener("abort", onAbort);
		try {
			options.onQueued?.(entry.queue.indexOf(claim) + 1);
		} catch {
			// an observer failure must not strand the queued claim
		}
	});
}

// Token-fenced: only the exact owner of a grant can release it; duplicates and forgeries return false.
export function releaseWorkspace(lease: Pick<WorkspaceLease, "key" | "token">): boolean {
	const entry = workspaces.get(lease.key);
	if (!entry) return false;
	if (entry.writer === lease.token) entry.writer = undefined;
	else if (!entry.readers.delete(lease.token)) return false;
	pump(lease.key, entry);
	return true;
}

// Grants the FIFO head while compatible: readers share, a writer waits for and excludes everyone.
function pump(key: string, entry: Entry): void {
	while (entry.queue.length > 0) {
		const next = entry.queue[0];
		if (entry.writer !== undefined || (next.access === "write" && entry.readers.size > 0)) break;
		entry.queue.shift();
		if (next.access === "write") entry.writer = next.token;
		else entry.readers.add(next.token);
		next.detach();
		next.resolve({ key, access: next.access, token: next.token });
	}
	if (entry.writer === undefined && entry.readers.size === 0 && entry.queue.length === 0) workspaces.delete(key);
}

function abortError(): Error {
	const error = new Error("workspace admission aborted");
	error.name = "AbortError";
	return error;
}
