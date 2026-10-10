/**
 * Handoff shaping for child reports. Foreground results stay full (no background job id to recover from).
 * Only automatic background completion is bounded; explicit retained results are returned losslessly.
 * This module never changes agent tool permissions, execution, or exit status.
 */
export const COMPACT_HANDOFF_INSTRUCTIONS = `
## Final handoff to main
Return a compact evidence-based report, normally 150-250 tokens, using:
STATUS: PASS | FAIL | BLOCKED | ESCALATE
SUMMARY: concrete outcome (1-2 sentences)
FILES: paths changed, or none
CHECKS: commands and actual results; say NOT RUN if applicable
RISKS: remaining risks/warnings, or none
NEXT: done, or one justified next action
EVIDENCE: existing exact path(s), or none
This is guidance only: full details requested by the user or needed for correctness take precedence.
Do not paste whole logs, stack traces, or diffs unless they are the evidence itself.
Do not conceal failed checks, security/data risks, blockers, or unresolved questions.
Only claim PASS when the assigned scope and its required checks passed; an exit code of 0 alone is not PASS.
The main orchestrator owns delegations, approvals, and phase routing.
`;

export const BACKGROUND_COMPLETION_LIMIT = 4000;

const VERDICT_LINE = /^\s*(?:STATUS|VERDICT|RISKS?|BLOCKERS?)\s*:|\bpending decisions?\b/i; // ranked before other priority lines
const TERMINAL_VERDICT = /^\s*(?:STATUS|VERDICT)\s*:/i; // reserved first: a late STATUS must not starve behind RISKS lines
const NEGATIVE = /\b(?:FAIL(?:ED)?|BLOCKED|ESCALATE|REQUEST CHANGES|INCONCLUSIVE|INCOMPLETE|ERROR|ABORTED)\b/i; // conservative: a PASS line naming a failure is kept too
const CRITICAL_LINE = /^(?:\s*(?:STATUS|RISKS?|WARNINGS?|BLOCKERS?|ERRORS?|CHECKS?|NEXT)\s*:|.*\b(?:FAILED|FAIL|BLOCKED|ESCALATE|REQUEST CHANGES|INCONCLUSIVE|ABORTED|DATA LOSS|SECURITY RISK|ERROR|PENDING DECISIONS?)\b)/i;

/**
 * Automatic background delivery is bounded. An oversized message is explicitly INCOMPLETE and names the
 * exact recovery command; priority lines (failures, blockers, checks) are kept before the head excerpt.
 */
export function boundBackgroundCompletion(message: string, jobId: string): string {
	if (message.length <= BACKGROUND_COMPLETION_LIMIT) return message;
	const header = `INCOMPLETE HANDOFF: job ${jobId} output exceeds ${BACKGROUND_COMPLETION_LIMIT} chars and is not fully shown. Full result: subagent_control action "result" target "${jobId}".\n`;
	const footer = "\n[TRUNCATED: do not infer PASS from this excerpt.]";
	const budget = BACKGROUND_COMPLETION_LIMIT - header.length - footer.length;
	const priorityBlock = priorityLines(message, Math.floor(budget / 2));
	const excerptLabel = "Excerpt:\n";
	return `${header}${priorityBlock}${excerptLabel}${cutUnits(message, budget - priorityBlock.length - excerptLabel.length)}${footer}`;
}

/**
 * Final verdict first (any polarity), then negative verdicts/headings/ERROR lines newest first, then other verdicts newest first,
 * then remaining verdict lines and critical lines in original order. Whole lines only, within maxChars.
 */
function priorityLines(message: string, maxChars: number): string {
	const label = "Priority lines:\n";
	const critical = message.split(/\r?\n/).map((line, index) => ({ index, line })).filter(({ line }) => CRITICAL_LINE.test(line));
	const lastVerdict = critical.reduce((last, { index, line }) => (TERMINAL_VERDICT.test(line) ? index : last), -1);
	const negative = ({ line }: { line: string }) => NEGATIVE.test(line) && (TERMINAL_VERDICT.test(line) || /^#{3}\s/.test(line) || /^\s*(?:ERROR\s*:|ABORTED\b)/i.test(line));
	const rank = (entry: { index: number; line: string }) => (entry.index === lastVerdict ? 0 : negative(entry) ? 1 : TERMINAL_VERDICT.test(entry.line) ? 2 : VERDICT_LINE.test(entry.line) ? 3 : 4);
	const newestFirst = (r: number) => r === 1 || r === 2; // the latest negative line survives a flood of earlier ones
	const ranked = [...critical].sort((a, b) => rank(a) - rank(b) || (newestFirst(rank(a)) ? b.index - a.index : a.index - b.index));
	const chosen: { index: number; line: string }[] = [];
	let used = label.length;
	for (const entry of ranked) {
		const line = entry.line.length > 180 ? `${cutUnits(entry.line, 175)}[…]` : entry.line;
		if (used + line.length + 1 > maxChars) continue;
		chosen.push({ index: entry.index, line });
		used += line.length + 1;
	}
	return chosen.length ? `${label}${chosen.sort((a, b) => a.index - b.index).map(entry => entry.line).join("\n")}\n` : "";
}

/** Code-unit cut that never splits a surrogate pair; an unpaired surrogate already in the input is kept as-is. */
function cutUnits(text: string, max: number): string {
	if (max <= 0) return "";
	if (max >= text.length) return text;
	const high = text.charCodeAt(max - 1) >= 0xd800 && text.charCodeAt(max - 1) <= 0xdbff;
	const low = text.charCodeAt(max) >= 0xdc00 && text.charCodeAt(max) <= 0xdfff;
	return text.slice(0, high && low ? max - 1 : max);
}

/** All text blocks of the last assistant message with non-blank text; empty, whitespace-only or tool-call-only messages are skipped. */
export function extractFinalText(messages: any[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg?.role !== "assistant" || !Array.isArray(msg.content)) continue;
		const parts = msg.content.filter((part: any) => part?.type === "text" && typeof part.text === "string").map((part: any) => part.text);
		const combined = parts.join("\n");
		if (combined.trim()) return combined;
	}
	return "";
}

/** True when block occurs as whole line(s) of text: starts at a line start and ends at a line end. */
function hasBlock(text: string, block: string): boolean {
	const lf = (value: string) => value.replace(/\r\n/g, "\n"); // comparison only; returned text keeps its original newlines
	text = lf(text);
	block = lf(block);
	for (let at = text.indexOf(block); at !== -1; at = text.indexOf(block, at + 1)) {
		const end = at + block.length;
		if ((at === 0 || text[at - 1] === "\n") && (end === text.length || text[end] === "\n" || text.startsWith("\r\n", end))) return true;
	}
	return false;
}

/** Adds the terminal errorMessage and stderr (labelled) unless their exact ERROR:/STDERR: block already appears. */
export function withTerminalDiagnostics(text: string, entry: { errorMessage?: string; stderr?: string }): string {
	const parts = [text];
	for (const [label, value] of [["ERROR", entry.errorMessage], ["STDERR", entry.stderr]] as const) {
		const diagnostic = typeof value === "string" ? value.trim() : "";
		if (diagnostic && !hasBlock(text, `${label}: ${diagnostic}`)) parts.push(`${label}: ${diagnostic}`);
	}
	return parts.filter(Boolean).join("\n\n");
}

/** Distinct diagnostics of a failed child: errorMessage, then stderr unless it is the same whole text (labelled STDERR when an errorMessage exists). */
export function failureDiagnostics(entry: { errorMessage?: string; stderr?: string }): { label: "ERROR" | "STDERR"; value: string }[] {
	const message = typeof entry?.errorMessage === "string" ? entry.errorMessage.trim() : "";
	const stderr = typeof entry?.stderr === "string" ? entry.stderr.trim() : "";
	const found: { label: "ERROR" | "STDERR"; value: string }[] = [];
	if (message) found.push({ label: "ERROR", value: message });
	if (stderr && stderr !== message) found.push({ label: message ? "STDERR" : "ERROR", value: stderr });
	return found;
}

/** Exit 0 alone is not success: only a terminal "stop" completes; length, toolUse, pending, deferred or no stopReason is INCOMPLETE. */
export function isIncompleteStop(entry: { exitCode: number; stopReason?: string } | undefined): boolean {
	return entry?.exitCode === 0 && entry.stopReason !== "stop" && entry.stopReason !== "error" && entry.stopReason !== "aborted";
}

export function incompleteLabel(stopReason?: string): string {
	return `INCOMPLETE (${stopReason ?? "no terminal stopReason"})`;
}

/** One retained child or DAG node as a headed block. DAG nodes are headed by node ID, so repeated agents stay distinct; a not-run node is labelled, not failed. */
export function retainedEntryBlock(entry: any): string {
	const failed = entry?.exitCode !== 0 || entry?.stopReason === "error" || entry?.stopReason === "aborted";
	const incomplete = isIncompleteStop(entry);
	const dag = entry?.dag;
	const notRun = dag?.status === "blocked" || (dag?.status === "aborted" && dag?.started === false);
	const label = dag?.status === "blocked" ? `BLOCKED by ${(dag.blockedBy ?? []).join(", ")}` : notRun ? "ABORTED before start" : failed ? "FAILED/STOPPED" : incomplete ? incompleteLabel(entry.stopReason) : "completed";
	const agent = String(entry?.agent ?? "unknown agent");
	const name = entry?.nodeId !== undefined ? `node "${entry.nodeId}" (${agent})` : agent;
	const text = extractFinalText(Array.isArray(entry?.messages) ? entry.messages : []);
	const issue = failed ? failureDiagnostics(entry).map((d) => `${d.label}: ${d.value}`).join("\n") : "";
	// Failed children lead with their error; INCOMPLETE children keep the partial text first, then every terminal diagnostic.
	const detail = notRun ? "(not run)" : incomplete ? withTerminalDiagnostics(text, entry) || "(no final assistant output)" : [issue, text || "(no final assistant output)"].filter(Boolean).join("\n");
	return `### ${name} \u2014 ${label}\n${detail}`;
}

/** Explicit recovery: the complete retained child reports. Returns null when the job has no retained child details. */
export function expandRetainedResult(jobResult: any): string | null {
	const results = jobResult?.details?.results;
	if (!Array.isArray(results) || results.length === 0) return null;
	return results.map(retainedEntryBlock).join("\n\n---\n\n");
}
