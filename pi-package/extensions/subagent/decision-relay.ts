// Background-only child tool: announces one blocking question over RPC stdout, then waits on the exact
// input dialog the parent holds for it. The reply reports the decision only; it grants no tool or scope.
import { randomBytes } from "node:crypto";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { DECISION_DIALOG_PREFIX, DECISION_RECORD_PREFIX, DECISION_RELAY_ENV, DECISION_TOOL } from "./decision-relay-state.ts";

const PLACEHOLDER = "Freeform answer; the main agent decides";

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: DECISION_TOOL,
		label: "Request decision",
		description: "Ask the orchestrator to decide a question that blocks the next write. Returns answered only with a recorded answer; otherwise cancelled. It grants no tool, scope, server, commit or deploy permission.",
		promptGuidelines: [
			"Call request_decision BEFORE any write that depends on the answer, never in parallel with sibling mutations.",
			"Options are recommendations; a freeform answer is valid and must not be mapped onto an option.",
			"A cancelled result is not approval: do not perform the blocked scope.",
		],
		parameters: Type.Object({
			question: Type.String({ minLength: 1, maxLength: 1000, description: "The decision needed, answerable in one message." }),
			options: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 200 }), { maxItems: 6, description: "Recommended answers; not restrictive." })),
			context: Type.Optional(Type.String({ minLength: 1, maxLength: 1000 })),
			blockedScope: Type.String({ minLength: 1, maxLength: 500, description: "The writes or steps this decision blocks." }),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			if (process.env[DECISION_RELAY_ENV] !== "1" || !ctx.hasUI) return outcome("unavailable", "Decision relay is available only to background workers with an RPC UI.");
			const requestId = "dec-" + randomBytes(9).toString("hex");
			const payload = { type: "worker_decision_request", requestId, question: params.question, options: params.options, context: params.context, blockedScope: params.blockedScope };
			ctx.ui.notify(DECISION_RECORD_PREFIX + JSON.stringify(payload), "info");
			const value = await ctx.ui.input(DECISION_DIALOG_PREFIX + requestId, PLACEHOLDER, { signal });
			return interpret(requestId, value);
		},
	});
}

function nonBlank(value: unknown): value is string {
	return typeof value === "string" && value.trim() !== "";
}

function interpret(requestId: string, value: unknown) {
	if (typeof value !== "string") return outcome("cancelled", "No decision was recorded.");
	let parsed: any;
	try { parsed = JSON.parse(value); } catch { return outcome("cancelled", "The decision response was not valid JSON."); }
	if (!parsed || typeof parsed !== "object" || parsed.requestId !== requestId) return outcome("cancelled", "The decision response does not match this request.");
	if (parsed.decision === "declined") return outcome("cancelled", nonBlank(parsed.reason) ? parsed.reason : "Declined without a reason.");
	if (parsed.decision === "answered" && nonBlank(parsed.answer) && (parsed.basis === "user_answer" || parsed.basis === "existing_authorization") && nonBlank(parsed.reference)) {
		return {
			content: [{ type: "text", text: "Decision answered (basis " + parsed.basis + ", reference " + parsed.reference + "): " + parsed.answer }],
			details: { status: "answered", requestId, answer: parsed.answer, basis: parsed.basis, reference: parsed.reference, scope: "The answer reports a decision only; it grants no tool, scope, server, commit or deploy permission." },
		};
	}
	return outcome("cancelled", "The decision response was incomplete.");
}

function outcome(status: "unavailable" | "cancelled", reason: string) {
	return {
		content: [{ type: "text", text: "Decision " + status + ": " + reason + " Do not perform the blocked scope unless a decision is answered." }],
		details: { status, reason },
	};
}
