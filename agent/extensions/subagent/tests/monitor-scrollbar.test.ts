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

	// Pointer geometry: width 40 is framed (gutter at outer column 37); width 6 is unframed (gutter at column 5).
	const ev = (type: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({ type, button: "left", x, y, screenX: x, screenY: y, width: 40, height: 26, shift: false, alt: false, ctrl: false, ...extra });
	const bar = (view: any, width = 40) => {
		const framed = width >= 8, ox = framed ? 2 : 0, inner = framed ? width - 4 : width;
		return { col: inner - 1 + ox, top: view.bodyTop + ox, height: view.viewport.viewportHeight };
	};
	const hover = (view: any, b: { col: number; top: number }, row = 3) => view.handleMouse(ev("move", b.col, b.top + row));

	test("auto press on a hidden bar is ignored: no capture, no scroll", () => {
		const { store } = assistantStore(60);
		const { view } = inspector(store, () => "auto");
		view.render(40);
		const b = bar(view), before = view.viewport.scrollTop;
		assert.equal(view.handleMouse(ev("press", b.col, b.top + 3)), undefined);
		assert.equal(view.viewport.scrollTop, before);
		assert.equal(view.viewport.isScrollbarActive, false);
	});

	test("auto hover reveals the bar with a solid thumb, and a visible press captures it", () => {
		const { store } = assistantStore(60);
		const { view } = inspector(store, () => "auto");
		view.render(40);
		const b = bar(view);
		assert.equal(hover(view, b)?.handled, true, "hover on the gutter is handled");
		view.render(40);
		assert.equal(view.viewport.isScrollbarVisible, true, "hover reveals the transient bar");
		assert.ok(gutters(view, 40).includes("█"), "active thumb paints a solid glyph");
		const press = view.handleMouse(ev("press", b.col, b.top + 3));
		assert.equal(press?.handled, true);
		assert.equal(press?.capture, true);
	});

	test("hover █ holds while the pointer stays on the bar and expires 1000ms after it leaves", () => {
		mock.timers.enable({ apis: ["setTimeout"] });
		try {
			const { store } = assistantStore(60);
			const { view } = inspector(store, () => "auto");
			view.render(40);
			const b = bar(view);
			hover(view, b);
			view.render(40);
			mock.timers.tick(5000);
			assert.ok(gutters(view, 40).includes("█"), "pointer still on bar past 1000ms");
			view.handleMouse(ev("move", 5, b.top + 3));
			view.render(40);
			mock.timers.tick(999);
			assert.ok(gutters(view, 40).includes("┃"), "idle thumb still visible at 999ms after leaving");
			mock.timers.tick(1);
			assert.equal(gutters(view, 40).filter((c: string) => c === THUMB || c === TRACK).length, 0, "blank after expiry");
		} finally {
			mock.timers.reset();
		}
	});

	test("press off the thumb jumps the thumb centre to the pointer; grab is half the thumb", () => {
		const { store } = assistantStore(60);
		const { view } = inspector(store, () => "auto");
		view.render(40);
		const b = bar(view);
		hover(view, b);
		view.render(40);
		const content = view.documentLines.length, track = b.height, max = content - track;
		const thumbH = monitor.scrollbarThumb(track, content, 0).height;
		const row = Math.floor(track / 2);
		view.handleMouse(ev("press", b.col, b.top + row));
		const maxThumb = track - thumbH, grab = Math.floor(thumbH / 2);
		const offset = Math.max(0, Math.min(maxThumb, row - grab));
		assert.equal(view.viewport.scrollTop, Math.round((offset / maxThumb) * max));
	});

	test("press on the thumb keeps the scroll and drags with the grab offset", () => {
		const { store } = assistantStore(60);
		const { view } = inspector(store, () => "auto");
		view.render(40);
		const b = bar(view);
		hover(view, b);
		view.viewport.scrollTo(Math.floor((view.documentLines.length - b.height) / 2), { disableFollow: true });
		view.render(40);
		const content = view.documentLines.length, track = b.height, max = content - track;
		const s0 = view.viewport.scrollTop;
		const thumb = monitor.scrollbarThumb(track, content, s0);
		view.handleMouse(ev("press", b.col, b.top + thumb.top + 1));
		assert.equal(view.viewport.scrollTop, s0, "thumb grab does not jump");
		view.handleMouse(ev("drag", b.col, b.top + thumb.top + 5));
		const maxThumb = track - thumb.height;
		assert.equal(view.viewport.scrollTop, Math.round((Math.min(maxThumb, thumb.top + 4) / maxThumb) * max));
	});

	test("captured drag clamps outside the track, resumes following at the end, and release ends it", () => {
		const { store } = assistantStore(60);
		const { view } = inspector(store, () => "auto");
		view.render(40);
		const b = bar(view);
		hover(view, b);
		view.render(40);
		const max = view.documentLines.length - b.height;
		view.handleMouse(ev("press", b.col, b.top + Math.floor(b.height / 2)));
		const up = view.handleMouse(ev("drag", b.col, b.top - 40));
		assert.equal(up?.capture, true, "drag keeps capture outside the track");
		assert.equal(view.viewport.scrollTop, 0, "clamps at the top");
		view.handleMouse(ev("drag", b.col, b.top + b.height + 40));
		assert.equal(view.viewport.scrollTop, max, "clamps at the bottom");
		assert.equal(view.viewport.isFollowingEnd, true, "dragging to the end resumes following");
		const release = view.handleMouse(ev("release", b.col, b.top + b.height + 40));
		assert.notEqual(release?.capture, true, "release does not recapture");
		assert.equal(view.handleMouse(ev("drag", b.col, b.top + 1)), undefined, "no drag after release");
		assert.equal(view.viewport.scrollTop, max);
	});

	test("a border press ends a stale scrollbar drag before the frame rejects it", () => {
		const { store } = assistantStore(60);
		const { view } = inspector(store, () => "auto");
		view.render(40);
		const b = bar(view);
		hover(view, b);
		view.render(40);
		// This press's release never arrives, so the gesture stays captured.
		assert.equal(view.handleMouse(ev("press", b.col, b.top + Math.floor(b.height / 2)))?.capture, true);
		const held = view.viewport.scrollTop;
		assert.ok(held > 0, "stale drag moved the transcript");
		// Right frame border: rejected by the frame, yet it starts a new gesture and must end the old drag.
		assert.equal(view.handleMouse(ev("press", 39, b.top + 5)), undefined, "frame border press is rejected");
		assert.equal(view.drag, undefined, "border press ends the stale drag");
		// Ordinary left drag inside the frame must neither recapture nor scroll.
		assert.notEqual(view.handleMouse(ev("drag", b.col, b.top + 1))?.capture, true, "stale drag does not recapture");
		assert.equal(view.viewport.scrollTop, held, "stale drag does not scroll");
		// A proper new gutter press still captures and seeks.
		assert.equal(view.handleMouse(ev("press", b.col, b.top + 1))?.capture, true, "new gutter press captures");
		assert.equal(view.viewport.scrollTop, 0, "new gutter press seeks to the top");
	});

	test("a visible gutter click is consumed; a hidden gutter click keeps transcript handling", () => {
		const { store } = assistantStore(60);
		const { view } = inspector(store, () => "auto");
		view.render(40);
		const b = bar(view);
		assert.equal(view.handleMouse(ev("click", b.col, b.top + 3)), undefined, "hidden bar: no gutter consumption");
		hover(view, b);
		view.render(40);
		assert.deepEqual(view.handleMouse(ev("click", b.col, b.top + 3)), { handled: true, render: false });
	});

	test("always captures a fitting transcript: full thumb and scroll stays at 0", () => {
		const { store } = assistantStore(2);
		const { view } = inspector(store, () => "always");
		view.render(40);
		const b = bar(view);
		const press = view.handleMouse(ev("press", b.col, b.top + 3));
		assert.equal(press?.capture, true);
		view.render(40);
		assert.equal(view.viewport.scrollTop, 0);
		assert.equal(gutters(view, 40).filter((c: string) => c === "█").length, b.height, "full active thumb");
	});

	test("auto with a fitting transcript and hidden mode ignore gutter hover and press", () => {
		const fits = assistantStore(2);
		const auto = inspector(fits.store, () => "auto").view;
		auto.render(40);
		const b = bar(auto);
		assert.equal(hover(auto, b), undefined);
		assert.equal(auto.viewport.isScrollbarActive, false);
		assert.equal(auto.handleMouse(ev("press", b.col, b.top + 3)), undefined);
		const long = assistantStore(60);
		const hidden = inspector(long.store, () => "hidden").view;
		hidden.render(40);
		assert.equal(hidden.handleMouse(ev("press", b.col, b.top + 3)), undefined, "hidden has no gutter");
	});

	test("gutter column follows each render: framed, resized, and unframed narrow widths", () => {
		const { store } = assistantStore(60);
		const { view } = inspector(store, () => "always");
		view.render(40);
		const b40 = bar(view, 40);
		assert.equal(b40.col, 37);
		assert.equal(view.handleMouse(ev("press", 38, b40.top + 1))?.capture, undefined, "padding cell is not the gutter");
		assert.equal(view.handleMouse(ev("press", b40.col, b40.top + 1))?.capture, true, "framed gutter captures");
		view.handleMouse(ev("release", b40.col, b40.top + 1));
		view.render(60);
		const b60 = bar(view, 60);
		assert.equal(view.handleMouse(ev("press", b40.col, b40.top + 1, { width: 60 })), undefined, "old column is no longer the gutter");
		assert.equal(view.handleMouse(ev("press", b60.col, b60.top + 1, { width: 60 }))?.capture, true, "resized gutter captures");
		view.handleMouse(ev("release", b60.col, b60.top + 1, { width: 60 }));
		view.render(6);
		const narrow = bar(view, 6);
		assert.equal(narrow.col, 5);
		assert.equal(view.handleMouse(ev("press", narrow.col, narrow.top + 1, { width: 6 }))?.capture, true, "unframed gutter at column 5");
		view.handleMouse(ev("release", narrow.col, narrow.top + 1, { width: 6 }));
	});

	test("leaving the gutter or the frame clears hover", () => {
		const { store } = assistantStore(60);
		const { view } = inspector(store, () => "auto");
		view.render(40);
		const b = bar(view);
		hover(view, b);
		assert.equal(view.viewport.isScrollbarActive, true);
		view.handleMouse(ev("move", 20, b.top + 3));
		assert.equal(view.viewport.isScrollbarActive, false, "body cell clears hover");
		hover(view, b);
		view.handleMouse(ev("move", 39, b.top + 3));
		assert.equal(view.viewport.isScrollbarActive, false, "frame border clears hover");
	});

	test("clearPointer and dispose drop a captured drag; later drags do nothing", () => {
		const { store } = assistantStore(60);
		const { view } = inspector(store, () => "auto");
		view.render(40);
		const b = bar(view);
		hover(view, b);
		view.render(40);
		assert.equal(view.handleMouse(ev("press", b.col, b.top + Math.floor(b.height / 2)))?.capture, true);
		view.clearPointer();
		view.clearPointer();
		assert.equal(view.viewport.isScrollbarActive, false);
		const s = view.viewport.scrollTop;
		assert.equal(view.handleMouse(ev("drag", b.col, b.top + 1)), undefined, "dropped drag is not applied");
		assert.equal(view.viewport.scrollTop, s);
		view.handleMouse(ev("press", b.col, b.top + Math.floor(b.height / 2)));
		view.dispose();
		assert.equal(view.handleMouse(ev("drag", b.col, b.top + 1)), undefined, "dispose drops the drag");
	});

	test("real TUI routing: gutter capture, outside captured drag clamps, buttonless motion and focus-out clear hover only", async () => {
		const term: any = { start(i: any) { this.onInput = i; }, stop() {}, drainInput: async () => {}, write() {}, columns: 120, rows: 40, kittyProtocolActive: false, moveBy() {}, hideCursor() {}, showCursor() {}, clearLine() {}, clearFromCursor() {}, clearScreen() {}, setTitle() {}, setProgress() {}, setProgramStatus() {} };
		const t: any = new tui.TuiAltScreen(term, false, undefined, { mouse: true });
		t.start();
		const handlers: Record<string, (event: unknown, ctx: unknown) => void> = {};
		const pi = { on: (name: string, fn: (event: unknown, ctx: unknown) => void) => { handlers[name] = fn; }, registerCommand() {}, registerShortcut() {}, getSettings: () => ({ fullscreenScrollbar: "auto" }) };
		const m: any = new monitor.WorkerMonitor(pi as never);
		let overlay: any, view: any;
		const ctx: any = { hasUI: true, ui: { setWidget() {}, onTerminalInput: (fn: any) => t.addInputListener(fn), custom(factory: any, options: any) {
			return new Promise<void>(resolve => {
				const done = () => { overlay?.hide(); resolve(); };
				view = factory(t, theme, null, done);
				overlay = t.showOverlay(view, options.overlayOptions);
				options.onHandle?.(overlay);
				t.renderNow(true);
			});
		} } };
		handlers.session_start!({}, ctx);
		const r = m.store.begin("worker", "Routing task", "provider/model", "high");
		m.store.started(r.id);
		m.store.event(r.id, { type: "message_start", message: { role: "assistant" } });
		m.store.event(r.id, { type: "message_update", message: { role: "assistant" }, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: Array.from({ length: 150 }, (_, i) => `line ${i + 1}`).join("\n\n") } });
		const listenersBefore = t.inputListeners.size;
		const opened = m.open();
		t.renderNow(true);
		const b = overlay.getBounds();
		const gx = b.col + 2 + (b.width - 4) - 1, top = b.row + 2 + view.bodyTop;
		const feed = (d: string) => { term.onInput(d); t.renderNow(true); };
		const sgr = (button: number, x: number, y: number, up = false) => `\x1b[<${button};${x + 1};${y + 1}${up ? "m" : "M"}`;
		try {
			feed(sgr(35, gx, top + 2));
			assert.equal(view.viewport.isScrollbarActive, true, "inside buttonless motion reaches the component and reveals");
			feed(sgr(0, gx, top + 5));
			assert.ok(t.mouseCapture, "gutter press captures");
			assert.ok(view.viewport.scrollTop > 0, "track press jumps");
			feed(sgr(32, 0, 0));
			assert.equal(view.viewport.scrollTop, 0, "captured left drag outside the overlay still clamps");
			assert.equal(view.viewport.isScrollbarActive, true, "raw hook did not clear the captured drag");
			feed(sgr(0, 0, 0, true));
			assert.equal(t.mouseCapture, undefined, "release ends capture");
			feed(sgr(35, gx, top + 2));
			feed(sgr(35, 0, 0));
			assert.equal(view.viewport.isScrollbarActive, false, "outside buttonless motion clears hover");
			feed(sgr(35, gx, top + 2));
			assert.equal(view.viewport.isScrollbarActive, true);
			feed("\x1b[O");
			assert.equal(view.viewport.isScrollbarActive, false, "focus-out clears hover");
			feed("\x1b");
			await opened;
			assert.equal(t.inputListeners.size, listenersBefore, "raw hook removed on close");
		} finally {
			handlers.session_shutdown!({}, ctx);
			t.stop();
		}
	});
}
