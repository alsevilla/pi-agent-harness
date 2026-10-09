// Bun-discovered launcher for the ordered-fallback runtime regression. Bun 1.4.2 lacks node:module registerHooks,
// so the hook-heavy suite (fallback-runtime.node.ts) runs under the installed `node` on PATH; never process.execPath (Bun).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import * as path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(testsDir, "fallback-runtime.node.ts");

interface NodeRun {
	status: number | null;
	signal: string | null;
	output: string;
	error?: Error;
}

function runUnderNode(): Promise<NodeRun> {
	const env = { ...process.env };
	delete env.NODE_TEST_CONTEXT; // inherited from a parent node --test would make the child emit TAP
	return new Promise((resolve) => {
		let output = "";
		const child = spawn("node", ["--test", runner], { cwd: testsDir, env, timeout: 120_000, windowsHide: true });
		child.stdout.on("data", (chunk) => (output += chunk));
		child.stderr.on("data", (chunk) => (output += chunk));
		child.on("error", (error) => resolve({ status: null, signal: null, output, error }));
		child.on("close", (status, signal) => resolve({ status, signal, output }));
	});
}

test("ordered fallback runtime regression passes under installed Node", { timeout: 150_000 }, async () => {
	const result = await runUnderNode();
	const output = result.output.trim();
	assert.equal(result.error, undefined, `failed to launch "node --test ${runner}" (cwd ${testsDir}): ${result.error?.message}\n${output}`);
	assert.equal(result.status, 0, `"node --test ${runner}" exited with ${result.status ?? result.signal}\n${output}`);
	// Pass count guards against a runner that loads cleanly but silently loses discovery/guard coverage (27 tests today: 20 prior plus 7 guard-refusal, probe-busy, unavailable and pre-spawn-abort proofs).
	assert.match(output, /(?:\u2139|#) pass 27\b/, `expected 27 passing runtime tests\n${output}`);
});
