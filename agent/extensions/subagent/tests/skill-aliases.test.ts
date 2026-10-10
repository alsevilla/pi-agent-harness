// Harness bare slash aliases (/engineering-harness, /agent-creation). Loads the REAL candidate subagent/index.ts through the
// installed Pi public API: DefaultResourceLoader + createAgentSession + session.prompt (real command dispatch and real
// /skill: expansion). The model is an offline capture provider registered by an inline extension, so nothing reaches a
// network or paid provider. Fixtures live under os.tmpdir() (TEMP/TMP); process-global state is not mutated.
import { expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION = path.resolve(TESTS_DIR, "..", "index.ts");
const SKILLS_DIR = path.resolve(TESTS_DIR, "..", "..", "..", "skills");
const PI_MODULES = path.resolve(TESTS_DIR, "..", "..", "..", "install", "releases", "1.1.0", "node_modules", "@earendil-works");
const pi: any = await import(pathToFileURL(path.join(PI_MODULES, "pi-coding-agent", "dist", "index.js")).href);
const ai: any = await import(pathToFileURL(path.join(PI_MODULES, "pi-ai", "dist", "index.js")).href);

const HARNESS_SKILLS = ["engineering-harness", "agent-creation"];
const CAPTURE = "harness-skill-alias-capture";
const MODEL = {
	id: "capture-model",
	name: "Offline capture model",
	api: CAPTURE,
	provider: CAPTURE,
	baseUrl: "http://offline.invalid/v1",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 8192,
	maxTokens: 1024,
};
const ZERO_USAGE = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };

function textOf(content: any): string {
	if (typeof content === "string") return content;
	return (content ?? []).filter((part: any) => part.type === "text").map((part: any) => part.text).join("\n");
}

/** Offline provider: records the last user text of every model call and answers "ok". The first call waits on `gate` when given. */
function captureExtension(sent: string[], gate?: Promise<void>) {
	return (pi: any) => {
		pi.registerProvider(CAPTURE, {
			api: CAPTURE,
			apiKey: "offline-test-key", // synthetic; the stream never leaves the process
			baseUrl: MODEL.baseUrl,
			models: [{ id: MODEL.id, name: MODEL.name, reasoning: false, input: ["text"], cost: MODEL.cost, contextWindow: MODEL.contextWindow, maxTokens: MODEL.maxTokens }],
			streamSimple: (model: any, context: any) => {
				const user = [...context.messages].reverse().find((m: any) => m.role === "user");
				sent.push(textOf(user?.content));
				const stream = ai.createAssistantMessageEventStream();
				const message = { role: "assistant", content: [{ type: "text", text: "ok" }], api: CAPTURE, provider: CAPTURE, model: model.id, usage: ZERO_USAGE, stopReason: "stop", timestamp: Date.now() };
				void (async () => {
					if (gate && sent.length === 1) await gate;
					stream.push({ type: "start", partial: { ...message, content: [] } });
					stream.push({ type: "done", reason: "stop", message });
					stream.end();
				})();
				return stream;
			},
		});
	};
}

type OpenOptions = { gate?: Promise<void>; templates?: string[]; extra?: Array<(pi: any) => void>; withUi?: boolean };

async function openSession(options: OpenOptions) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "harness-skill-aliases-"));
	const agentDir = path.join(root, "agent");
	const cwd = path.join(root, "project");
	fs.mkdirSync(cwd, { recursive: true });
	for (const name of options.templates ?? []) {
		fs.mkdirSync(path.join(agentDir, "prompts"), { recursive: true });
		fs.writeFileSync(path.join(agentDir, "prompts", `${name}.md`), `Template ${name}\n`);
	}
	const sent: string[] = [];
	const notes: Array<[string, string]> = [];
	const settingsManager = pi.SettingsManager.inMemory();
	const resourceLoader = new pi.DefaultResourceLoader({
		cwd,
		agentDir,
		settingsManager,
		additionalExtensionPaths: [EXTENSION],
		additionalSkillPaths: [SKILLS_DIR],
		extensionFactories: [captureExtension(sent, options.gate), ...(options.extra ?? [])],
		disabledBuiltinExtensions: ["mcp", "codemode", "tool-search", "llama.cpp"],
		skillsOverride: (base: any) => ({ skills: base.skills.filter((s: any) => HARNESS_SKILLS.includes(s.name)), diagnostics: base.diagnostics }),
		noThemes: true,
		noContextFiles: true,
	});
	await resourceLoader.reload();
	const { session } = await pi.createAgentSession({ cwd, agentDir, settingsManager, resourceLoader, model: MODEL, sessionManager: pi.SessionManager.inMemory(cwd) });
	const uiContext = { notify: (message: string, type = "info") => notes.push([message, type]) };
	await session.bindExtensions(options.withUi === false ? {} : { uiContext });
	return { session, sent, notes, cleanup: () => { session.dispose(); fs.rmSync(root, { recursive: true, force: true }); } };
}

async function withSession(options: OpenOptions, body: (s: Awaited<ReturnType<typeof openSession>>) => Promise<void>) {
	const opened = await openSession(options);
	try {
		await body(opened);
	} finally {
		opened.cleanup();
	}
}

async function until(condition: () => boolean, label: string, ms = 10_000): Promise<void> {
	const deadline = Date.now() + ms;
	while (!condition()) {
		if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
}

/** Waits until the model has been called `count` times and the agent run has finished. */
async function settle(session: any, sent: string[], count: number) {
	await until(() => sent.length >= count, `model call ${count}`);
	await until(() => !session.isStreaming, "agent idle");
}

function skillBody(name: string): { file: string; body: string } {
	const file = path.join(SKILLS_DIR, name, "SKILL.md");
	return { file, body: pi.stripFrontmatter(fs.readFileSync(file, "utf8")).trim() };
}

const t = (name: string, body: () => Promise<void>) => test(name, body, 60_000);

t("bare harness aliases are registered as native-skill commands with the expected description", () =>
	withSession({}, async ({ session }) => {
		for (const name of HARNESS_SKILLS) {
			const cmd = session.extensionRunner.getCommand(name);
			expect(cmd?.invocationName).toBe(name);
			expect(cmd?.description).toBe(`Run /skill:${name}`);
			expect(typeof cmd?.handler).toBe("function");
		}
		expect(session.extensionRunner.getRegisteredCommands().map((c: any) => c.invocationName).filter((n: string) => n.startsWith("engineering-harness") || n.startsWith("agent-creation"))).toEqual(expect.arrayContaining(["engineering-harness", "agent-creation"]));
	}));

t("native subagent and provider-cooldown commands remain registered beside the aliases", () =>
	withSession({}, async ({ session }) => {
		expect(session.extensionRunner.getCommand("provider-cooldown")?.invocationName).toBe("provider-cooldown");
		expect(session.extensionRunner.getCommand("subagent")?.invocationName).toBe("subagent");
	}));

t("typed alias forwards trimmed args and the real SKILL.md expands before the model call", () =>
	withSession({}, async ({ session, sent, notes }) => {
		const eh = skillBody("engineering-harness");
		const ac = skillBody("agent-creation");

		await session.prompt("/engineering-harness   review src/app.ts  ");
		await settle(session, sent, 1);
		expect(sent[0].startsWith(`<skill name="engineering-harness" location="${eh.file}">`)).toBe(true);
		expect(sent[0]).toContain(eh.body);
		expect(sent[0].endsWith("</skill>\n\nreview src/app.ts")).toBe(true);
		expect(sent[0]).not.toContain("/skill:engineering-harness");

		await session.prompt("/agent-creation");
		await settle(session, sent, 2);
		expect(sent[1].startsWith(`<skill name="agent-creation" location="${ac.file}">`)).toBe(true);
		expect(sent[1]).toContain(ac.body);
		expect(sent[1].endsWith("</skill>")).toBe(true);
		expect(notes).toEqual([]);
	}));

t("busy session queues the alias as a follow-up that expands after the active turn", () => {
	let release!: () => void;
	const gate = new Promise<void>((resolve) => (release = resolve));
	return withSession({ gate }, async ({ session, sent, notes }) => {
		const first = session.prompt("plain request");
		await until(() => sent.length === 1, "first model call");
		expect(session.isStreaming).toBe(true);

		await session.prompt("/agent-creation tune");
		expect(notes).toEqual([["agent-creation queued as follow-up.", "info"]]);

		release();
		await first;
		await settle(session, sent, 2);
		expect(sent[0]).toBe("plain request");
		expect(sent[1].startsWith('<skill name="agent-creation"')).toBe(true);
		expect(sent[1].endsWith("</skill>\n\ntune")).toBe(true);
	});
});

t("without a UI context a busy alias still queues and does not throw", () => {
	let release!: () => void;
	const gate = new Promise<void>((resolve) => (release = resolve));
	return withSession({ gate, withUi: false }, async ({ session, sent }) => {
		const first = session.prompt("plain request");
		await until(() => sent.length === 1, "first model call");
		await session.prompt("/engineering-harness");
		release();
		await first;
		await settle(session, sent, 2);
		expect(sent[1].startsWith('<skill name="engineering-harness"')).toBe(true);
	});
});

t("a prompt template with the same name gates the alias with a warning and an error on use; native /skill: still works", () =>
	withSession({ templates: ["engineering-harness"] }, async ({ session, sent, notes }) => {
		expect(notes).toEqual([["/engineering-harness collides with another command; use /skill:engineering-harness.", "warning"]]);

		await session.prompt("/engineering-harness review");
		expect(sent).toEqual([]);
		expect(notes.at(-1)).toEqual(["/engineering-harness is unavailable; use /skill:engineering-harness.", "error"]);

		await session.prompt("/skill:engineering-harness review");
		await settle(session, sent, 1);
		expect(sent[0].startsWith('<skill name="engineering-harness"')).toBe(true);
		expect(sent[0].endsWith("</skill>\n\nreview")).toBe(true);
	}));

t("an extension command with the same name suffixes natively and the session_start gate warns (baseline, no overwrite claim)", () => {
	const rival = (pi: any) => pi.registerCommand("agent-creation", { description: "Rival command", handler: async () => {} });
	return withSession({ extra: [rival] }, async ({ session, notes }) => {
		const names = session.extensionRunner.getRegisteredCommands().map((c: any) => c.invocationName).filter((n: string) => n.startsWith("agent-creation"));
		expect(names.sort()).toEqual(["agent-creation:1", "agent-creation:2"]);
		expect(notes).toEqual([["/agent-creation collides with another command; use /skill:agent-creation.", "warning"]]);
	});
});
