// Unit contract for compact-handoff.ts: guidance text, bounded background completion, lossless retained results.
import assert from "node:assert/strict";
import test from "node:test";
import {
	BACKGROUND_COMPLETION_LIMIT,
	COMPACT_HANDOFF_INSTRUCTIONS,
	boundBackgroundCompletion,
	expandRetainedResult,
	extractFinalText,
	withTerminalDiagnostics,
} from "../compact-handoff.ts";

const text = (value: string) => ({ type: "text", text: value });
const assistant = (...content: unknown[]) => ({ role: "assistant", content });
const toolCallOnly = { role: "assistant", content: [{ type: "toolCall", id: "t1", name: "read", arguments: {} }] };

test("guidance names every handoff field, keeps verdict evidence and states exit 0 is not PASS", () => {
	for (const label of ["STATUS", "SUMMARY", "FILES", "CHECKS", "RISKS", "NEXT", "EVIDENCE"]) {
		assert.match(COMPACT_HANDOFF_INSTRUCTIONS, new RegExp(`^${label}:`, "m"), label);
	}
	assert.match(COMPACT_HANDOFF_INSTRUCTIONS, /150-250 tokens/);
	assert.match(COMPACT_HANDOFF_INSTRUCTIONS, /exit code of 0 alone is not PASS/);
	assert.match(COMPACT_HANDOFF_INSTRUCTIONS, /Do not conceal failed checks/);
	assert.match(COMPACT_HANDOFF_INSTRUCTIONS, /take precedence/);
});

test("background completion at or under the limit is delivered unchanged", () => {
	assert.equal(BACKGROUND_COMPLETION_LIMIT, 4000);
	const exact = "x".repeat(4000);
	assert.equal(boundBackgroundCompletion(exact, "bg-1"), exact);
	const short = "Subagent job bg-1 completed.\nSTATUS: PASS";
	assert.equal(boundBackgroundCompletion(short, "bg-1"), short);
});

test("oversized background completion is bounded, marked INCOMPLETE and carries the exact recovery command", () => {
	const body = "filler line\n".repeat(2000) + "RISKS: FAILED migration on tenant 7\n" + "tail filler\n".repeat(500);
	const message = `Subagent job bg-7 completed.\n${body}`;
	assert.ok(message.length > 4000);
	const bounded = boundBackgroundCompletion(message, "bg-7");
	assert.ok(bounded.length <= 4000, `length ${bounded.length}`);
	assert.match(bounded, /INCOMPLETE HANDOFF/);
	assert.ok(bounded.includes('subagent_control action "result" target "bg-7"'));
	assert.ok(bounded.includes("RISKS: FAILED migration on tenant 7"), "priority failure line kept");
});

test("oversized completion keeps a head excerpt and never claims PASS", () => {
	const message = `Subagent job bg-9 completed.\nSTATUS: FAIL\n${"y".repeat(9000)}`;
	const bounded = boundBackgroundCompletion(message, "bg-9");
	assert.ok(bounded.length <= 4000);
	assert.ok(bounded.startsWith("INCOMPLETE HANDOFF") || bounded.includes("INCOMPLETE HANDOFF"));
	assert.ok(bounded.includes("STATUS: FAIL"));
	assert.doesNotMatch(bounded, /STATUS: PASS/);
});

test("oversized completion keeps STATUS and RISKS verdicts even after twelve ERROR lines", () => {
	const errors = Array.from({ length: 12 }, (_, i) => `ERROR: step ${i} failed`).join("\n");
	const message = `Subagent job bg-10 completed.\n${errors}\n${"filler\n".repeat(600)}STATUS: FAIL\nRISKS: data loss on tenant 9\n`;
	assert.ok(message.length > 4000);
	const bounded = boundBackgroundCompletion(message, "bg-10");
	assert.ok(bounded.length <= 4000, `length ${bounded.length}`);
	assert.match(bounded, /INCOMPLETE HANDOFF/);
	assert.ok(bounded.includes('subagent_control action "result" target "bg-10"'));
	assert.ok(bounded.includes("STATUS: FAIL"), "verdict kept");
	assert.ok(bounded.includes("RISKS: data loss on tenant 9"), "risk kept");
	assert.doesNotMatch(bounded, /STATUS: PASS/);
});

test("oversized completion never splits a surrogate pair at the excerpt cut and stays within 4000 code units", () => {
	for (let pad = 3600; pad < 3800; pad++) {
		const message = `hdr\n${"a".repeat(pad)}${"\u{1F600}".repeat(200)}`;
		const bounded = boundBackgroundCompletion(message, "bg-s");
		assert.ok(bounded.length <= 4000, `length ${bounded.length} at pad ${pad}`);
		assert.doesNotMatch(bounded, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/, `lone surrogate at pad ${pad}`);
		assert.match(bounded, /INCOMPLETE HANDOFF/);
	}
});

test("extractFinalText joins every text block of the last text-bearing assistant message", () => {
	const messages = [assistant(text("older")), assistant(text("first"), text("second"))];
	assert.equal(extractFinalText(messages), "first\nsecond");
});

test("extractFinalText uses the last text-bearing assistant when the final assistant only calls a tool", () => {
	const messages = [assistant(text("report part one"), text("report part two")), toolCallOnly];
	assert.equal(extractFinalText(messages), "report part one\nreport part two");
});

test("extractFinalText is empty without any text-bearing assistant message", () => {
	assert.equal(extractFinalText([toolCallOnly]), "");
	assert.equal(extractFinalText([]), "");
});

test("extractFinalText skips an empty or whitespace-only latest assistant block and keeps the earlier report", () => {
	const call = { type: "toolCall", id: "t2", name: "read", arguments: {} };
	assert.equal(extractFinalText([assistant(text("REPORT-A")), assistant(text(""), call)]), "REPORT-A");
	assert.equal(extractFinalText([assistant(text("REPORT-A")), assistant(text(" \n\t "), call)]), "REPORT-A");
	assert.equal(extractFinalText([assistant(text("part A"), text("part B")), assistant(text(""), call)]), "part A\npart B");
});

test("extractFinalText keeps every block and the original spacing of the selected meaningful message", () => {
	assert.equal(extractFinalText([assistant(text("older")), assistant(text("  padded  "))]), "  padded  ");
	assert.equal(extractFinalText([assistant(text("first"), text(" "), text("second"))]), "first\n \nsecond");
});

test("expandRetainedResult returns a long completed child report in full", () => {
	const report = "detail line\n".repeat(1200) + "CHECKS: npm test PASS";
	const expanded = expandRetainedResult({ details: { results: [{ agent: "backend-worker", exitCode: 0, stopReason: "stop", messages: [assistant(text(report))] }] } });
	assert.equal(expanded, "### backend-worker — completed\n" + report);
});

test("expandRetainedResult keeps every text block and the tool-call-only tail case", () => {
	const expanded = expandRetainedResult({
		details: { results: [{ agent: "reviewer", exitCode: 0, stopReason: "stop", messages: [assistant(text("part A"), text("part B")), toolCallOnly] }] },
	});
	assert.equal(expanded, "### reviewer — completed\npart A\npart B");
});

test("expandRetainedResult reports failed or aborted children as failures with the exact error text", () => {
	const failed = expandRetainedResult({
		details: { results: [{ agent: "debugger", exitCode: 1, stopReason: "error", errorMessage: "503 provider unavailable", messages: [] }] },
	});
	assert.equal(failed, "### debugger — FAILED/STOPPED\nERROR: 503 provider unavailable\n(no final assistant output)");
	const aborted = expandRetainedResult({
		details: { results: [{ agent: "worker", exitCode: 0, stopReason: "aborted", stderr: "killed", messages: [] }] },
	});
	assert.match(aborted ?? "", /^### worker — FAILED\/STOPPED\nERROR: killed/);
});

test("expandRetainedResult joins all parallel and chain steps in order", () => {
	const expanded = expandRetainedResult({
		details: {
			results: [
				{ agent: "a", exitCode: 0, stopReason: "stop", messages: [assistant(text("one"))] },
				{ agent: "b", exitCode: 0, stopReason: "stop", messages: [assistant(text("two"))] },
			],
		},
	});
	assert.equal(expanded, "### a — completed\none\n\n---\n\n### b — completed\ntwo");
});

test("expandRetainedResult labels exit 0 without a terminal stop as INCOMPLETE and keeps the full text", () => {
	const report = "detail line\n".repeat(600) + "CHECKS: npm test PASS";
	const cut = expandRetainedResult({ details: { results: [{ agent: "backend-worker", exitCode: 0, stopReason: "length", messages: [assistant(text(report))] }] } });
	assert.equal(cut, "### backend-worker \u2014 INCOMPLETE (length)\n" + report);
	const toolUse = expandRetainedResult({ details: { results: [{ agent: "reviewer", exitCode: 0, stopReason: "toolUse", messages: [assistant(text("partial"))] }] } });
	assert.equal(toolUse, "### reviewer \u2014 INCOMPLETE (toolUse)\npartial");
	const silent = expandRetainedResult({ details: { results: [{ agent: "worker", exitCode: 0, messages: [] }] } });
	assert.equal(silent, "### worker \u2014 INCOMPLETE (no terminal stopReason)\n(no final assistant output)");
});

test("expandRetainedResult keeps the terminal stderr of an INCOMPLETE child even without assistant text", () => {
	const expanded = expandRetainedResult({ details: { results: [{ agent: "worker", exitCode: 0, stopReason: "length", stderr: "terminal diagnostic", messages: [] }] } });
	assert.equal(expanded, "### worker \u2014 INCOMPLETE (length)\nSTDERR: terminal diagnostic");
});

test("expandRetainedResult keeps partial text together with the errorMessage and stderr of an INCOMPLETE child", () => {
	const expanded = expandRetainedResult({ details: { results: [{ agent: "reviewer", exitCode: 0, stopReason: "length", errorMessage: "terminal diagnostic", stderr: "transport warning", messages: [assistant(text("partial report"))] }] } });
	assert.equal(expanded, "### reviewer \u2014 INCOMPLETE (length)\npartial report\n\nERROR: terminal diagnostic\n\nSTDERR: transport warning");
});

test("expandRetainedResult does not repeat a terminal diagnostic already carried as a canonical ERROR block", () => {
	const expanded = expandRetainedResult({ details: { results: [{ agent: "reviewer", exitCode: 0, stopReason: "length", errorMessage: "terminal diagnostic", messages: [assistant(text("partial report\nERROR: terminal diagnostic"))] }] } });
	assert.equal(expanded, "### reviewer \u2014 INCOMPLETE (length)\npartial report\nERROR: terminal diagnostic");
});

test("expandRetainedResult appends a terminal diagnostic that earlier prose only mentions", () => {
	const expanded = expandRetainedResult({ details: { results: [{ agent: "reviewer", exitCode: 0, stopReason: "length", errorMessage: "Connection closed", messages: [assistant(text("Recovered from earlier Connection closed; remaining checks pending."))] }] } });
	assert.equal(expanded, "### reviewer \u2014 INCOMPLETE (length)\nRecovered from earlier Connection closed; remaining checks pending.\n\nERROR: Connection closed");
});

test("withTerminalDiagnostics suppresses only a canonical labelled block at a line boundary, per field", () => {
	assert.equal(withTerminalDiagnostics("no failure mentioned; step 3: connection reset", { errorMessage: "connection reset" }), "no failure mentioned; step 3: connection reset\n\nERROR: connection reset");
	assert.equal(withTerminalDiagnostics("no failure mentioned", { errorMessage: "failure" }), "no failure mentioned\n\nERROR: failure");
	assert.equal(withTerminalDiagnostics("ERROR: connection closed by peer", { errorMessage: "connection closed" }), "ERROR: connection closed by peer\n\nERROR: connection closed");
	assert.equal(withTerminalDiagnostics("STDERR: transport warning", { errorMessage: "transport warning", stderr: "transport warning" }), "STDERR: transport warning\n\nERROR: transport warning");
	assert.equal(withTerminalDiagnostics("ERROR: transport warning", { stderr: "transport warning" }), "ERROR: transport warning\n\nSTDERR: transport warning");
});

test("withTerminalDiagnostics recognises a canonical multi-line block and a CRLF boundary, not a longer line", () => {
	const multi = "partial\nERROR: first line\nsecond line";
	assert.equal(withTerminalDiagnostics(multi, { errorMessage: "first line\nsecond line" }), multi);
	assert.equal(withTerminalDiagnostics("ERROR: first line\nsecond line plus", { errorMessage: "first line\nsecond line" }), "ERROR: first line\nsecond line plus\n\nERROR: first line\nsecond line");
	assert.equal(withTerminalDiagnostics("ERROR: boom\r\nafter", { errorMessage: "boom" }), "ERROR: boom\r\nafter");
});

test("expandRetainedResult keeps a malformed lone surrogate in the retained report verbatim", () => {
	const raw = "bad\uD800 tail";
	const expanded = expandRetainedResult({ details: { results: [{ agent: "a", exitCode: 0, stopReason: "stop", messages: [assistant(text(raw))] }] } });
	assert.equal(expanded, "### a \u2014 completed\n" + raw);
});

test("expandRetainedResult returns null when no retained child details exist", () => {
	assert.equal(expandRetainedResult({ content: [text("launch error")], isError: true }), null);
	assert.equal(expandRetainedResult({ details: { results: [] } }), null);
	assert.equal(expandRetainedResult(undefined), null);
});

test("withTerminalDiagnostics dedupes a canonical multi-line block across CRLF/LF without rewriting the text", () => {
	assert.equal(withTerminalDiagnostics("ERROR: line1\r\nline2", { errorMessage: "line1\nline2" }), "ERROR: line1\r\nline2");
	assert.equal(withTerminalDiagnostics("a\r\nERROR: l1\nl2\r\nb", { errorMessage: "l1\r\nl2" }), "a\r\nERROR: l1\nl2\r\nb");
	assert.equal(withTerminalDiagnostics("STDERR: a\r\nb", { stderr: "a\nb" }), "STDERR: a\r\nb");
	assert.equal(withTerminalDiagnostics("ERROR: line1\r\nline2 plus", { errorMessage: "line1\nline2" }), "ERROR: line1\r\nline2 plus\n\nERROR: line1\nline2");
});

test("oversized completion keeps a late long STATUS verdict ahead of 150 RISKS lines", () => {
	const risks = Array.from({ length: 150 }, (_, i) => `RISKS: item ${i} needs review`).join("\n");
	const status = "STATUS: FAIL - tenant 9 data loss in migration path confirmed by check X on fixture Y";
	const bounded = boundBackgroundCompletion(`Subagent job bg-3 completed.\n${risks}\n${"filler\n".repeat(300)}${status}\n`, "bg-3");
	assert.ok(bounded.length <= 4000);
	assert.match(bounded, /INCOMPLETE HANDOFF/);
	assert.ok(bounded.includes('subagent_control action "result" target "bg-3"'));
	assert.ok(bounded.slice(0, bounded.indexOf("Excerpt:")).includes(status), "STATUS in priority block");
	assert.doesNotMatch(bounded, /STATUS: PASS/);
});

const repeatLines = (count: number, line: (i: number) => string) => Array.from({ length: count }, (_, i) => line(i)).join("\n");

test("F1 300 identical PASS lines then a terminal STATUS: FAIL keeps the FAIL with the exact recovery command", () => {
	const bounded = boundBackgroundCompletion("STATUS: PASS check item\n".repeat(300) + "STATUS: FAIL final gate: migration check failed\n", "bg-9");
	assert.ok(bounded.length <= 4000, `length ${bounded.length}`);
	assert.ok(bounded.includes("STATUS: FAIL final gate: migration check failed"), "terminal FAIL kept");
	assert.ok(bounded.includes('subagent_control action "result" target "bg-9"'));
	assert.ok(bounded.endsWith("[TRUNCATED: do not infer PASS from this excerpt.]"));
});

test("F1 300 distinct PASS lines then a terminal STATUS: FAIL keeps the FAIL (dedupe alone is not the fix)", () => {
	const bounded = boundBackgroundCompletion(repeatLines(300, (i) => `STATUS: PASS check ${i}`) + "\nSTATUS: FAIL final gate\n", "bg-9");
	assert.ok(bounded.length <= 4000, `length ${bounded.length}`);
	assert.ok(bounded.includes("STATUS: FAIL final gate"), "terminal FAIL kept");
});

test("F1 seven PASS workers then a failing last worker keep its heading, ERROR and FAIL verdict", () => {
	const passing = Array.from({ length: 7 }, (_, w) => `### worker-${w} \u2014 completed\n` + repeatLines(40, (i) => `STATUS: PASS w${w} item ${i}`)).join("\n\n---\n\n");
	const bounded = boundBackgroundCompletion(`${passing}\n\n---\n\n### verifier \u2014 FAILED/STOPPED\nERROR: 503 unavailable\nSTATUS: FAIL gate x\n`, "bg-9");
	assert.ok(bounded.length <= 4000, `length ${bounded.length}`);
	assert.ok(bounded.includes("STATUS: FAIL gate x"), "FAIL verdict kept");
	assert.ok(bounded.includes("### verifier \u2014 FAILED/STOPPED"), "failed heading kept");
	assert.ok(bounded.includes("ERROR: 503 unavailable"), "error kept");
});

test("F1 mixed multiworker: a failing first worker and a long PASS list keep both verdicts", () => {
	const failing = "### worker-0 \u2014 FAILED/STOPPED\nERROR: 503 unavailable\nSTATUS: FAIL gate early";
	const passing = Array.from({ length: 6 }, (_, w) => `### worker-${w + 1} \u2014 completed\n` + repeatLines(40, (i) => `STATUS: PASS w${w + 1} item ${i}`) + "\nSTATUS: PASS worker done").join("\n\n---\n\n");
	const bounded = boundBackgroundCompletion(`${failing}\n\n---\n\n${passing}`, "bg-9");
	assert.ok(bounded.length <= 4000, `length ${bounded.length}`);
	assert.ok(bounded.includes("STATUS: FAIL gate early"), "early FAIL kept");
	assert.ok(bounded.includes("STATUS: PASS worker done"), "final verdict kept");
});

test("F1 300 negative lines then a final BLOCKED keeps the final verdict", () => {
	const bounded = boundBackgroundCompletion(repeatLines(300, (i) => `STATUS: FAIL item ${i}`) + "\nSTATUS: BLOCKED final\n", "bg-9");
	assert.ok(bounded.length <= 4000, `length ${bounded.length}`);
	assert.ok(bounded.includes("STATUS: BLOCKED final"), "final BLOCKED kept");
});

test("F1 without a final verdict, the newest negative line outranks older ones under budget", () => {
	const bounded = boundBackgroundCompletion(repeatLines(300, (i) => `ERROR: failure ${i}`), "bg-9");
	assert.ok(bounded.length <= 4000, `length ${bounded.length}`);
	assert.ok(bounded.includes("ERROR: failure 299"), "latest negative kept");
});

test("F3 an ABORTED-before-start node under a long PASS list keeps its ABORTED verdict in an oversized completion", () => {
	const bounded = boundBackgroundCompletion("STATUS: PASS check item\n".repeat(300) + "ABORTED before start: node \"b\" never spawned\n", "bg-11");
	assert.ok(bounded.length <= 4000, `length ${bounded.length}`);
	assert.ok(bounded.includes("ABORTED before start: node \"b\" never spawned"), "ABORTED line kept");
});

test("F2 failed child keeps errorMessage, distinct stderr and partial text in the explicit result", () => {
	const expanded = expandRetainedResult({ details: { results: [{ agent: "w", exitCode: 1, stopReason: "error", errorMessage: "503 unavailable", stderr: "stderr-detail-XYZ", messages: [assistant(text("partial text FINAL"))] }] } });
	assert.equal(expanded, "### w \u2014 FAILED/STOPPED\nERROR: 503 unavailable\nSTDERR: stderr-detail-XYZ\npartial text FINAL");
});

test("F2 failed child shows an identical errorMessage and stderr once; stderr alone keeps the ERROR label", () => {
	const same = expandRetainedResult({ details: { results: [{ agent: "w", exitCode: 1, stopReason: "error", errorMessage: "boom", stderr: " boom ", messages: [] }] } });
	assert.equal(same, "### w \u2014 FAILED/STOPPED\nERROR: boom\n(no final assistant output)");
	const stderrOnly = expandRetainedResult({ details: { results: [{ agent: "w", exitCode: 0, stopReason: "aborted", stderr: "killed", messages: [] }] } });
	assert.equal(stderrOnly, "### w \u2014 FAILED/STOPPED\nERROR: killed\n(no final assistant output)");
});

test("F2 dedupes only an exact whole-field duplicate, never a substring of the other field", () => {
	const expanded = expandRetainedResult({ details: { results: [{ agent: "w", exitCode: 1, stopReason: "error", errorMessage: "boom", stderr: "boom extra", messages: [] }] } });
	assert.equal(expanded, "### w \u2014 FAILED/STOPPED\nERROR: boom\nSTDERR: boom extra\n(no final assistant output)");
});

test("F2 fallback note keeps the primary failure chain in stderr next to the second errorMessage", () => {
	const expanded = expandRetainedResult({ details: { results: [{ agent: "w", exitCode: 1, stopReason: "error", errorMessage: "second 503", stderr: "Model a failed; retried with b. first 429\n", messages: [] }] } });
	assert.equal(expanded, "### w \u2014 FAILED/STOPPED\nERROR: second 503\nSTDERR: Model a failed; retried with b. first 429\n(no final assistant output)");
});
