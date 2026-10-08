// Pure parent-side registry for worker decision requests. No pi API or IO here: background.ts performs
// delivery, and every transition is exactly-once. A request decides only the reported question; it grants nothing.

export const DECISION_TOOL = "request_decision";
export const DECISION_RELAY_ENV = "PI_SUBAGENT_DECISION_RELAY";
export const DECISION_RECORD_PREFIX = "pi-worker-decision-request ";
export const DECISION_DIALOG_PREFIX = "pi-decision ";
export const MAX_OPEN_PER_WORKER = 1;
export const MAX_DECISIONS_PER_SESSION = 4;

const REQUEST_KEYS = ["type", "requestId", "question", "options", "context", "blockedScope"];
const REQUEST_ID = /^dec-[A-Za-z0-9]{8,40}$/;
const BASES: readonly string[] = ["user_answer", "existing_authorization"];

export type DecisionBasis = "user_answer" | "existing_authorization";
export interface DecisionRequest { requestId: string; question: string; options: string[]; context?: string; blockedScope: string }
// delivering: an answer or decline is reserved while its stream write is pending; only settleDelivery ends it.
export type DecisionState = "announced" | "open" | "delivering" | "settled";
export interface DecisionRecord extends DecisionRequest {
	jobId: string; workerId: string; candidate: string; state: DecisionState; dialogId?: string; reason?: string;
}
// value is the answer body to deliver; undefined means the held dialog is cancelled.
export interface DecisionSettlement { workerId: string; dialogId?: string; value?: string; record: DecisionRecord }
export type DecisionRejection = { ok: false; requestId?: string; error: string };
// Parent-side action from subagent_control; the registry validates every field before settling.
export type DecisionAction = { kind: "answer"; answer?: string; basis?: string; reference?: string } | { kind: "decline"; reason?: string };

function isText(value: unknown, max: number): value is string {
	return typeof value === "string" && value.trim() !== "" && value.length <= max;
}

function fail(error: string, requestId?: string): DecisionRejection {
	return { ok: false, requestId, error };
}

// Decodes a stdout notify line. Non-JSON bodies stay strings so validation reports them as invalid.
export function decisionPayload(message: string): unknown {
	const body = message.slice(DECISION_RECORD_PREFIX.length);
	try { return JSON.parse(body); } catch { return body; }
}

export function parseDecisionRequest(raw: unknown): ({ ok: true; request: DecisionRequest } | DecisionRejection) {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return fail("payload is not a JSON object");
	const data = raw as Record<string, unknown>;
	const requestId = typeof data.requestId === "string" && REQUEST_ID.test(data.requestId) ? data.requestId : undefined;
	if (Object.keys(data).some(key => !REQUEST_KEYS.includes(key))) return fail("unknown field in request", requestId);
	if (data.type !== "worker_decision_request") return fail("wrong message type", requestId);
	if (!requestId) return fail("requestId must be dec- followed by 8-40 letters or digits");
	if (!isText(data.question, 1000)) return fail("question must be non-blank and at most 1000 characters", requestId);
	if (!isText(data.blockedScope, 500)) return fail("blockedScope must be non-blank and at most 500 characters", requestId);
	if (data.context !== undefined && !isText(data.context, 1000)) return fail("context must be non-blank and at most 1000 characters", requestId);
	const options = data.options ?? [];
	if (!Array.isArray(options) || options.length > 6 || !options.every(option => isText(option, 200))) {
		return fail("options must be at most 6 non-blank strings of up to 200 characters", requestId);
	}
	return { ok: true, request: { requestId, question: data.question as string, options: options as string[], context: data.context as string | undefined, blockedScope: data.blockedScope as string } };
}

export class DecisionRelay {
	private records = new Map<string, DecisionRecord>();

	announce(input: { jobId: string; workerId: string; candidate: string; raw: unknown }): ({ ok: true; record: DecisionRecord } | DecisionRejection) {
		const parsed = parseDecisionRequest(input.raw);
		if (!parsed.ok) return parsed;
		const { request } = parsed;
		if (this.records.has(request.requestId)) return fail("requestId already used in this session", request.requestId);
		if (this.unsettled().some(record => record.workerId === input.workerId)) return fail("worker already has an open decision request (limit " + MAX_OPEN_PER_WORKER + ")", request.requestId);
		if (this.records.size >= MAX_DECISIONS_PER_SESSION) return fail("session limit of " + MAX_DECISIONS_PER_SESSION + " decision requests reached", request.requestId);
		const record: DecisionRecord = { ...request, jobId: input.jobId, workerId: input.workerId, candidate: input.candidate, state: "announced" };
		this.records.set(request.requestId, record);
		return { ok: true, record };
	}

	// Holds only the exact dialog for an announced request from the same job and worker; anything else returns undefined.
	holdDialog(input: { jobId: string; workerId: string; method: string; title: unknown; dialogId: unknown }): DecisionRecord | undefined {
		if (input.method !== "input" || typeof input.title !== "string" || typeof input.dialogId !== "string" || !input.title.startsWith(DECISION_DIALOG_PREFIX)) return undefined;
		const record = this.records.get(input.title.slice(DECISION_DIALOG_PREFIX.length));
		if (!record || record.state !== "announced" || record.jobId !== input.jobId || record.workerId !== input.workerId) return undefined;
		record.state = "open";
		record.dialogId = input.dialogId;
		return record;
	}

	openRecord(requestId: string): DecisionRecord | undefined {
		const record = this.records.get(requestId);
		return record?.state === "open" ? record : undefined;
	}

	answer(requestId: string, input: { answer: unknown; basis: unknown; reference: unknown }): ({ ok: true; value: string; record: DecisionRecord } | { ok: false; error: string }) {
		const record = this.openRecord(requestId);
		if (!record) return this.missing(requestId);
		if (!isText(input.answer, 2000)) return { ok: false, error: "answer must be non-blank text of at most 2000 characters" };
		if (typeof input.basis !== "string" || !BASES.includes(input.basis)) return { ok: false, error: "basis must be user_answer or existing_authorization" };
		if (!isText(input.reference, 300)) return { ok: false, error: "reference must name the traceable source of the answer or authorization (non-blank, at most 300 characters)" };
		return this.beginDelivery(record, JSON.stringify({ requestId, decision: "answered", answer: input.answer, basis: input.basis, reference: input.reference }));
	}

	decline(requestId: string, reason: unknown): ({ ok: true; value: string; record: DecisionRecord } | { ok: false; error: string }) {
		const record = this.openRecord(requestId);
		if (!record) return this.missing(requestId);
		if (!isText(reason, 500)) return { ok: false, error: "decline needs a non-blank reason of at most 500 characters" };
		return this.beginDelivery(record, JSON.stringify({ requestId, decision: "declined", reason }));
	}

	settleWorker(workerId: string, reason: string): DecisionSettlement[] {
		return this.settle(record => record.workerId === workerId, reason);
	}

	settleJob(jobId: string, reason: string): DecisionSettlement[] {
		return this.settle(record => record.jobId === jobId, reason);
	}

	// Session reset: settle everything, then forget it. Settlements are returned so callers can deliver them first.
	clear(reason: string): DecisionSettlement[] {
		const settled = this.settle(() => true, reason);
		this.records.clear();
		return settled;
	}

	list() {
		return [...this.records.values()].map(({ dialogId: _dialogId, ...record }) => ({ ...record }));
	}

	// Reserves the request while its stream write is pending; only settleDelivery makes it terminal.
	private beginDelivery(record: DecisionRecord, value: string) {
		record.state = "delivering";
		return { ok: true as const, value, record };
	}

	// Terminal only while the answer is in flight; false means a settlement or reset already won.
	settleDelivery(record: DecisionRecord, reason: string): boolean {
		if (record.state !== "delivering") return false;
		record.state = "settled";
		record.reason = reason;
		return true;
	}

	private missing(requestId: string) {
		const inFlight = this.records.get(requestId)?.state === "delivering";
		return { ok: false as const, error: inFlight ? "Decision " + requestId + " is already being delivered; the duplicate is rejected and nothing is written." : lateError(requestId) };
	}

	private settle(match: (record: DecisionRecord) => boolean, reason: string): DecisionSettlement[] {
		const settled: DecisionSettlement[] = [];
		for (const record of this.records.values()) {
			if (record.state === "settled" || !match(record)) continue;
			// An in-flight answer already owns the held dialog, so settling it must not write a second response.
			const dialogId = record.state === "delivering" ? undefined : record.dialogId;
			record.state = "settled";
			record.reason = reason;
			settled.push({ workerId: record.workerId, dialogId, record });
		}
		return settled;
	}

	private unsettled() {
		return [...this.records.values()].filter(record => record.state !== "settled");
	}
}

function lateError(requestId: string) {
	return "No open decision request " + requestId + ". It is unknown, not yet asked, or already settled; late answers are rejected.";
}

export interface DecisionNotice {
	state: "open" | "settled" | "rejected";
	requestId?: string; jobId: string; workerId: string; candidate: string;
	question?: string; options?: string[]; context?: string; blockedScope?: string; reason?: string;
}

// Main-facing text. Only main decides whether to ask the human; nothing here opens a dialog.
export function formatDecisionNotice(notice: DecisionNotice): string {
	if (notice.state === "rejected") {
		return "Worker decision request rejected" + (notice.requestId ? " [" + notice.requestId + "]" : "") + " from " + notice.workerId + " (job " + notice.jobId + "): " + notice.reason + ". Any dialog it opened was cancelled.";
	}
	if (notice.state === "settled") {
		return "Worker decision " + notice.requestId + " settled: " + notice.reason + ". The parent registry is closed for this request; whether worker " + notice.workerId + " in job " + notice.jobId + " received it or still waits on it is unconfirmed.";
	}
	return [
		"Worker decision requested [" + notice.requestId + "]. Main decides; no human prompt was opened automatically.",
		"Candidate: " + notice.candidate,
		"Job: " + notice.jobId + " · Worker: " + notice.workerId,
		"Question: " + notice.question,
		"Options (recommendations only; freeform answers allowed): " + (notice.options?.length ? notice.options.join(" | ") : "none (freeform)"),
		"Context: " + (notice.context ?? "none"),
		"Blocked scope: " + notice.blockedScope,
		"Triage: subagent_control decisions; then answer " + notice.requestId + " (basis user_answer or existing_authorization, plus reference) or decline " + notice.requestId + " (reason). Steer cannot unblock the worker.",
	].join("\n");
}
