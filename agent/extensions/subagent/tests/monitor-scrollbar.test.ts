// Subagent inspector scrollbar regression. Bun discovers this file and launches its body under Node,
// where registerHooks maps bare Pi packages to the INSTALLED real pi-tui and pi-coding-agent builds.
// Only the host TUI handle (terminal rows and a render counter) is stubbed; every painted cell is real.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const isBun = typeof (process.versions as Record<string, string>).bun === "string";

if (isBun) {
	const { test } = await import("bun:test");
	test("subagent scrollbar suite passes under Node native TypeScript transform", () => {
		const run = spawnSync("node", ["--experimental-transform-types", "--test", thisFile], { encoding: "utf8", timeout: 180_000, windowsHide: true });
		assert.equal(run.status, 0, run.stdout + run.stderr);
	}, 200_000);
} else {
	await runNodeSuite();
}

async function runNodeSuite() {
	const { test, mock } = await import("node:test");
	const { registerHooks } = await import("node:module");
	// The tests directory sits under agent/, so the profile install is three levels up.
	const pkg = (path: string) => new URL(`../../../install/releases/1.1.0/node_modules/@earendil-works/${path}`, import.meta.url).href;
	registerHooks({
		resolve(specifier: string, context: object, nextResolve: (s: string, c: object) => { url: string }) {
			if (specifier === "@earendil-works/pi-tui") return { url: pkg("pi-tui/dist/index.js"), shortCircuit: true };
			if (specifier === "@earendil-works/pi-coding-agent") return { url: pkg("pi-coding-agent/dist/index.js"), shortCircuit: true };
			return nextResolve(specifier, context);
		},
	} as never);
	const tui: any = await import(pkg("pi-tui/dist/index.js"));
	const native: any = await import(pkg("pi-tui/dist/layout.js"));
	const themes: any = await import(pkg("pi-coding-agent/dist/modes/interactive/theme/theme.js"));
	const monitor: any = await import(new URL("../monitor.ts", import.meta.url).href);
	tui.setKeybindings(new tui.KeybindingsManager(tui.TUI_KEYBINDINGS));
	const theme = themes.getThemeByName("dark");

	const THUMB = "┃", TRACK = "│";
	const plain = (line: string) => line.replace(/\x1b\][^\x07]*\x07|\x1b\[[0-?]*[ -/]*[@-~]/g, "");
	const framed = (width: number) => width >= 8;
	// Content cells without the outer frame; gutter is the last cell of each row.
	function cells(view: any, width: number): string[] {
		const lines: string[] = view.render(width);
		const body = framed(width) ? lines.slice(1, -1) : lines;
		return body.map(line => framed(width) ? plain(line).slice(2, -2) : plain(line));
	}
	const gutters = (view: any, width: number) => cells(view, width).map(cell => cell.at(-1));
	function assistantStore(lines: number) {
		const store = new monitor.WorkerStore();
		const r = store.begin("worker", "Scrollbar task", "provider/model", "high");
		store.started(r.id);
		store.event(r.id, { type: "message_start", message: { role: "assistant" } });
		const text = Array.from({ length: lines }, (_, i) => `line ${i + 1}`).join("\n\n");
		store.event(r.id, { type: "message_update", message: { role: "assistant" }, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: text } });
		return { store, id: r.id };
	}
	function inspector(store: any, scrollbar: () => string) {
		const host = { terminal: { rows: 30 }, renders: 0, requestRender() { this.renders++; } };
		const view = new monitor.WorkerInspector(store, host, theme, () => {}, undefined, new Map(), scrollbar);
		return { host, view };
	}
	const wheel = (view: any, delta: number) => view.handleMouse({ type: "wheel", x: 20, y: 10, width: 40, height: 30, wheelDelta: delta });

	test("auto paints a thumb and track in the gutter after a manual scroll", () => {
		const { store } = assistantStore(60);
		const { view } = inspector(store, () => "auto");
		view.render(40);
		assert.equal(gutters(view, 40).filter((c: string) => c === THUMB || c === TRACK).length, 0, "auto stays blank before any scroll");
		wheel(view, -20);
		const cellsAfter = gutters(view, 40);
		const glyphs = cellsAfter.filter((c: string) => c === THUMB || c === TRACK);
		assert.equal(glyphs.length, view.viewport.viewportHeight, "every body row carries a glyph while the transient is visible");
		assert.ok(cellsAfter.includes(THUMB) && cellsAfter.includes(TRACK), "thumb and track both painted");
	});

	test("auto returns to a blank gutter 1000ms after the last scroll movement", () => {
		mock.timers.enable({ apis: ["setTimeout"] });
		try {
			const { store } = assistantStore(60);
			const { view, host } = inspector(store, () => "auto");
			view.render(40);
			wheel(view, -20);
			view.render(40);
			const before = host.renders;
			mock.timers.tick(999);
			assert.ok(gutters(view, 40).includes(THUMB), "still visible at 999ms");
			mock.timers.tick(1);
			assert.ok(host.renders > before, "expiry requests a redraw");
			assert.equal(gutters(view, 40).filter((c: string) => c === THUMB || c === TRACK).length, 0, "blank after expiry");
		} finally {
			mock.timers.reset();
		}
	});

	test("hidden paints no glyph and uses the full width after a manual scroll", () => {
		const { store } = assistantStore(60);
		const { view } = inspector(store, () => "hidden");
		view.render(40);
		wheel(view, -20);
		assert.equal(gutters(view, 40).filter((c: string) => c === THUMB || c === TRACK).length, 0);
	});

	test("hidden gives the body one more cell than auto (no reserved column)", () => {
		const store = new monitor.WorkerStore();
		const r = store.begin("worker", "Width task", "provider/model", "high");
		store.started(r.id);
		store.event(r.id, { type: "message_start", message: { role: "assistant" } });
		store.event(r.id, { type: "message_update", message: { role: "assistant" }, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "x".repeat(36) } });
		const longestRun = (view: any) => Math.max(...cells(view, 40).map((c: string) => (c.match(/x+/g) ?? [""]).reduce((a: string, b: string) => (b.length > a.length ? b : a)).length));
		const hidden = longestRun(inspector(store, () => "hidden").view);
		const auto = longestRun(inspector(store, () => "auto").view);
		assert.equal(hidden, auto + 1, `hidden run ${hidden} vs auto run ${auto}`);
	});

	test("always reserves and paints a full track even when the transcript fits", () => {
		const { store } = assistantStore(2);
		const { view } = inspector(store, () => "always");
		view.render(40);
		const cellsNow = gutters(view, 40);
		assert.equal(cellsNow.filter((c: string) => c === THUMB).length, view.viewport.viewportHeight, "fits: thumb spans the whole track");
		assert.equal(cellsNow.filter((c: string) => c === TRACK).length, 0);
	});

	test("auto stays blank when the transcript fits", () => {
		const { store } = assistantStore(2);
		const { view } = inspector(store, () => "auto");
		view.render(40);
		wheel(view, -5);
		assert.equal(gutters(view, 40).filter((c: string) => c === THUMB || c === TRACK).length, 0);
	});

	test("streaming follow-end never reveals the transient thumb", () => {
		const { store, id } = assistantStore(60);
		const { view } = inspector(store, () => "auto");
		view.render(40);
		for (let i = 0; i < 5; i++) {
			store.event(id, { type: "message_update", message: { role: "assistant" }, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: `\n\nstream ${i}` } });
			view.render(40);
		}
		assert.equal(view.viewport.isFollowingEnd, true, "native follow-end state unchanged");
		assert.equal(gutters(view, 40).filter((c: string) => c === THUMB || c === TRACK).length, 0);
	});

	test("thumb geometry matches pi-tui getScrollbarGeometry across the matrix", () => {
		for (const track of [1, 2, 5, 22]) {
			for (const content of [0, 1, track - 1, track, track + 1, 100]) {
				const max = Math.max(0, content - track);
				for (let scrollTop = 0; scrollTop <= max; scrollTop++) {
					const view = new tui.ScrollView({ invalidate() {}, render: () => [] }, { scrollbar: "always" });
					view.updateLayout(content, track, () => {});
					view.scrollTo(scrollTop, { disableFollow: true });
					const box = { scrollView: view, rect: { x: 0, y: 0, width: 10, height: track }, clip: { x: 0, y: 0, width: 10, height: track }, children: [{ rect: { height: content } }] };
					const expected = native.getScrollbarGeometry(box);
					const actual = monitor.scrollbarThumb(track, content, view.scrollTop);
					assert.deepEqual({ top: expected.thumbTop, height: expected.thumbHeight }, actual, `track ${track} content ${content} top ${scrollTop}`);
				}
			}
		}
	});

	test("narrow and framed widths keep every row within the requested width", () => {
		for (const width of [1, 2, 7, 8, 12, 40]) {
			for (const mode of ["auto", "always", "hidden"]) {
				const { store } = assistantStore(60);
				const { view } = inspector(store, () => mode);
				view.render(width);
				wheel(view, -10);
				for (const line of view.render(width)) assert.ok(tui.visibleWidth(line) <= width, `${mode} width ${width}: ${JSON.stringify(plain(line))}`);
			}
		}
	});

	test("WorkerMonitor reads the effective fullscreenScrollbar setting on each render", () => {
		const settings: { fullscreenScrollbar?: string } = { fullscreenScrollbar: "always" };
		const handlers: Record<string, (event: unknown, ctx: unknown) => void> = {};
		const pi = { on: (name: string, fn: (event: unknown, ctx: unknown) => void) => { handlers[name] = fn; }, registerCommand() {}, registerShortcut() {}, getSettings: () => settings };
		const m: any = new monitor.WorkerMonitor(pi as never);
		let factory: any;
		const ctx = { hasUI: true, ui: { setWidget() {}, onTerminalInput: () => () => {}, custom(f: unknown) { factory = f; return new Promise(() => {}); } } };
		handlers.session_start!({}, ctx);
		const id = m.store.begin("worker", "Settings task", "provider/model", "high").id;
		m.store.started(id);
		m.store.event(id, { type: "message_start", message: { role: "assistant" } });
		m.store.event(id, { type: "message_update", message: { role: "assistant" }, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: Array.from({ length: 2 }, (_, i) => `line ${i}`).join("\n\n") } });
		void m.open();
		const host = { terminal: { rows: 30 }, requestRender() {} };
		const view = factory(host, theme, null, () => {});
		assert.equal(gutters(view, 40).filter((c: string) => c === THUMB).length, view.viewport.viewportHeight, "always: full track");
		settings.fullscreenScrollbar = "hidden";
		assert.equal(gutters(view, 40).filter((c: string) => c === THUMB || c === TRACK).length, 0, "hidden: no glyph");
		settings.fullscreenScrollbar = "bogus";
		assert.equal(gutters(view, 40).filter((c: string) => c === THUMB || c === TRACK).length, 0, "invalid normalizes to auto (fits, blank)");
		handlers.session_shutdown!({}, ctx);
	});
}
