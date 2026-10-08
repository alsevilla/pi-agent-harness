import { matchesKey, Key, getKeybindings, isKeyRelease, truncateToWidth, wrapTextWithAnsi, visibleWidth, ScrollView, MouseRegion, type Component, type ScrollViewScrollbar, type TuiMouseEvent, type TUI } from "@earendil-works/pi-tui";
import { AssistantMessageComponent, ToolExecutionComponent, createReadToolDefinition, createBashToolDefinition, createPowerShellToolDefinition, createEditToolDefinition, createWriteToolDefinition, createGrepToolDefinition, createFindToolDefinition, createLsToolDefinition, type ExtensionAPI, type ExtensionContext, type ToolRenderers } from "@earendil-works/pi-coding-agent";

export type WorkerState = "initializing" | "running" | "pausing" | "paused" | "completed" | "failed" | "aborted";
export interface ToolActivity {
  id: string; name: string; command: string; startedAt: number; endedAt?: number;
  state: "running" | "ok" | "error"; output: string; args: any; details?: any; revision: number; integration?: "serena" | "graphify";
}
export type TranscriptEntry = {type: "tool"; id: string} | {type: "assistant"; id: string; text: string; partial: boolean};
export interface WorkerRecord {
  id: string; name: string; task: string; model: string; reportedModel?: string;
  effort: string; state: WorkerState; activity: string; context?: number; contextLimit?: number;
  startedAt: number; endedAt?: number; spawned: boolean; output: string; events: string[];
  textBlocks?: Record<number, string>;
  tools: ToolActivity[]; graphReferences: number;
  integrations: Record<string, { calls: number; returned: number; errors: number }>;
  transcript: TranscriptEntry[]; assistantSequence: number; currentAssistant?: string;
}
const clean = (s: unknown) => String(s ?? "").replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, "").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");
const oneLine = (s: unknown) => clean(s).replace(/\s+/g, " ").trim();
export const elapsed = (r: WorkerRecord, now = Date.now()) => {
  const seconds = Math.max(0, Math.floor(((r.endedAt ?? now) - r.startedAt) / 1000));
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
};
const tokens = (n: number) => n < 1000 ? String(n) : `${(n / 1000).toFixed(1)}k`;
export const contextLabel = (r: WorkerRecord) => r.context === undefined ? "Awaiting first usage report" :
  `${tokens(r.context)}${r.contextLimit ? ` / ${tokens(r.contextLimit)} (${Math.round(r.context / r.contextLimit * 100)}%)` : ""} · last reported`;


// Mirrors SettingsManager.getFullscreenScrollbar; ExtensionAPI.getSettings() returns the raw value.
export function fullscreenScrollbarMode(value: unknown): ScrollViewScrollbar {
  return value === "always" || value === "hidden" ? value : "auto";
}
// Mirrors pi-tui layout.js getScrollbarGeometry, which is not exported. Upgrade to that export if pi-tui publishes it.
export function scrollbarThumb(track: number, content: number, scrollTop: number): {top: number; height: number} {
  const height = Math.max(Math.min(2, track), Math.min(track, Math.round((track * track) / Math.max(1, content))));
  const maxScrollTop = Math.max(0, content - track);
  return {top: maxScrollTop === 0 ? 0 : Math.round((scrollTop / maxScrollTop) * (track - height)), height};
}
// Idle glyphs from pi-tui paintScrollbar; this indicator has no hover or drag state.
const SCROLLBAR_THUMB = "┃", SCROLLBAR_TRACK = "│";
function toolCommand(name: string, args: any): string {
  if (args?.command) return "$ " + oneLine(args.command).slice(0, 1000) + (args.timeout ? " (timeout " + args.timeout + "s)" : "");
  const target = args?.relative_path ?? args?.file_path ?? args?.path;
  const symbol = args?.name_path ?? args?.name_path_pattern ?? args?.symbol_name ?? args?.pattern ?? args?.query;
  return [name, target && oneLine(target), symbol && oneLine(symbol)].filter(Boolean).join(" · ").slice(0, 1000);
}
function resultText(result: any): string {
  return clean((result?.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n")).slice(-12000);
}
function integrationLabel(r: WorkerRecord): string {
  const parts = ["serena", "graphify"].map(name => {
    const stats = r.integrations[name];
    return name + ": " + (stats?.calls ? stats.calls + " calls · " + stats.returned + " returned · " + stats.errors + " errors" : "no calls observed");
  });
  if (r.graphReferences) parts.push("graph references: " + r.graphReferences + " reads");
  return parts.join(" | ");
}


function taskLabel(task: string): string {
  try {
    const packet = JSON.parse(task);
    for (const key of ["task", "objective", "title", "goal"]) if (typeof packet?.[key] === "string") return oneLine(packet[key]);
  } catch { /* Most task packets are plain text or Markdown. */ }
  return oneLine(task);
}


function displayDetails(details: any): any {
  if (details === undefined) return undefined;
  try { return JSON.stringify(details).length <= 32000 ? details : undefined; } catch { return undefined; }
}
function displayArgs(args: any): any {
  const copy = {...args};
  for (const key of ["content", "oldText", "newText", "command"]) if (typeof copy[key] === "string") copy[key] = clean(copy[key]).slice(0, 16000);
  return displayDetails(copy) ?? {path: copy.path ?? copy.relative_path ?? copy.file_path, command: copy.command};
}
function statusLabel(r: WorkerRecord): string {
  return ({initializing: 'Initializing', running: 'Ongoing', pausing: 'Pausing', paused: 'Paused', completed: 'Completed', failed: 'Failed', aborted: 'Stopped'} as const)[r.state];
}
function workerRow(r: WorkerRecord, showStatus = false): string {
  return "#" + r.id.split(":")[1] + " " + r.name + " · " + (r.reportedModel ?? r.model).split("/").at(-1) + " · " + r.effort + " · " + (showStatus ? statusLabel(r) + " · " : "") + taskLabel(r.task);
}
function nativeRenderers(name: string, cwd: string): ToolRenderers | undefined {
  const factories: Record<string, (cwd: string) => ToolRenderers> = {
    read: createReadToolDefinition, bash: createBashToolDefinition, powershell: createPowerShellToolDefinition,
    edit: createEditToolDefinition, write: createWriteToolDefinition, grep: createGrepToolDefinition,
    find: createFindToolDefinition, ls: createLsToolDefinition,
  };
  return factories[name]?.(cwd);
}

function assistantEntry(r: WorkerRecord, text: string, partial: boolean) {
  let entry = r.transcript.find(e => e.type === "assistant" && e.id === r.currentAssistant);
  if (!entry || entry.type !== "assistant") {
    r.currentAssistant = "assistant-" + (++r.assistantSequence);
    entry = {type: "assistant", id: r.currentAssistant, text: "", partial}; r.transcript.push(entry);
  }
  if (entry.type === "assistant") { entry.text = text; entry.partial = partial; }
}
export class WorkerStore {
  records = new Map<string, WorkerRecord>();
  totalSpawned = 0; totalCompleted = 0; totalFailed = 0;
  private sequence = 0;
  private generation = 0;
  listeners = new Set<() => void>();
  reset() { this.generation++; this.records.clear(); this.sequence = 0; this.totalSpawned = this.totalCompleted = this.totalFailed = 0; this.changed(); }
  changed() { for (const fn of this.listeners) fn(); }
  begin(name: string, task: string, model: string, effort: string, contextLimit?: number): WorkerRecord {
    const r: WorkerRecord = { id: `${this.generation}:${++this.sequence}`, name: oneLine(name), task: clean(task), model: oneLine(model), effort: oneLine(effort),
      state: "initializing", activity: "Preparing worker", startedAt: Date.now(), spawned: false, output: "", events: [], tools: [], graphReferences: 0, integrations: {}, transcript: [], assistantSequence: 0, contextLimit };
    this.records.set(r.id, r);
    // Retain active workers and the latest 64 finished attempts. Counters retain the whole session.
    const finished = [...this.records.values()].filter(x => x.endedAt !== undefined);
    for (const old of finished.slice(0, Math.max(0, finished.length - 64))) this.records.delete(old.id);
    this.changed(); return r;
  }
  started(id: string) {
    const r = this.records.get(id); if (!r || r.spawned) return;
    r.spawned = true; this.totalSpawned++; r.state = "running"; r.activity = "Waiting for model"; this.changed();
  }
  event(id: string, event: any) {
    const r = this.records.get(id); if (!r || r.endedAt !== undefined) return;
    if (event.type === "worker_pause_state") { r.state = event.paused ? "paused" : "running"; r.activity = event.paused ? "Paused; waiting for resume" : "Resuming worker"; this.changed(); return; }
    const message = event.message;
    if (event.type === "message_start" && message?.role === "assistant") {
      r.textBlocks = {}; r.activity = "Model responding"; r.currentAssistant = undefined; assistantEntry(r, "", true);
    } else if (event.type === "message_update" && event.assistantMessageEvent) {
      const delta = event.assistantMessageEvent;
      if (delta.type === "text_delta" || delta.type === "text_end") {
        const blocks = r.textBlocks ??= {};
        const index = delta.contentIndex ?? 0;
        blocks[index] = clean(delta.type === "text_end" ? delta.content : (blocks[index] ?? "") + delta.delta).slice(-32000);
        r.output = Object.keys(blocks).map(Number).sort((a,b) => a-b).map(i => blocks[i]).join("\n").slice(-32000);
        assistantEntry(r, r.output, true);
        r.activity = "Writing response";
      } else if (delta.type.startsWith("thinking")) r.activity = "Thinking";
      else if (delta.type === "toolcall_start") r.activity = `Preparing ${oneLine(delta.toolName)}`;
      const u = event.usage;
      if (u?.totalTokens > 0) r.context = u.totalTokens;
    } else if (event.type === "tool_execution_start") {
      const name = oneLine(event.toolName ?? "tool"), args = event.args ?? {};
      const command = toolCommand(name, args);
      const integration = name.startsWith("serena_") ? "serena" : name.startsWith("graphify_") || /(?:^|[;&|\n])\s*(?:(?:uvx|npx|bunx)\s+|uv\s+run\s+|(?:python3?|py)\s+-m\s+)?(?:[^\s;&|]*[\/\\])?graphify(?:\.(?:exe|cmd|py))?(?=\s|$)/i.test(args.command ?? "") ? "graphify" : undefined;
      if (integration) (r.integrations[integration] ??= {calls: 0, returned: 0, errors: 0}).calls++;
      const target = args.path ?? args.relative_path ?? args.file_path ?? "";
      if (name === "read" && /graphify-out[\/\\]/i.test(target)) r.graphReferences++;
      r.tools.push({id: event.toolCallId ?? "tool-" + Date.now() + "-" + r.tools.length, name, command, startedAt: Date.now(), state: "running", output: "", args: displayArgs(args), revision: 1, integration});
      r.transcript.push({type: "tool", id: r.tools.at(-1)!.id});
      r.tools = r.tools.slice(-40);
      r.activity = command; r.events.push(command); r.events = r.events.slice(-40);
    } else if (event.type === "tool_execution_update" || event.type === "tool_execution_end") {
      let tool = r.tools.findLast(t => t.id === event.toolCallId);
      if (!tool) tool = r.tools.findLast(t => t.state === "running" && t.name === event.toolName);
      if (tool) {
        const result = event.type === "tool_execution_update" ? event.partialResult : event.result;
        tool.output = resultText(result); tool.details = displayDetails(result?.details); tool.revision++;
        if (event.type === "tool_execution_end" && tool.endedAt === undefined) {
          tool.endedAt = Date.now(); tool.state = event.isError ? "error" : "ok";
          if (tool.integration) r.integrations[tool.integration][event.isError ? "errors" : "returned"]++;
          r.activity = (event.isError ? "Failed: " : "Finished: ") + tool.command;
        }
      } else r.activity = event.isError ? "Tool reported an error" : "Tool finished; model continuing";
    }
    else if (event.type === "message_update" || event.type === "message_end") {
      if (message?.role === "assistant") {
        const text = (message.content ?? []).filter((p: any) => p.type === "text").map((p: any) => p.text).join("\n");
        if (text) { r.output = clean(text).slice(-32000); assistantEntry(r, r.output, event.type !== "message_end"); r.activity = "Writing response"; }
        else if ((message.content ?? []).some((p: any) => p.type === "thinking")) r.activity = "Thinking";
        const call = (message.content ?? []).findLast((p: any) => p.type === "toolCall");
        if (call) r.activity = `Preparing ${oneLine(call.name)}`;
        if (message.model) r.reportedModel = oneLine(message.provider && !message.model.startsWith(`${message.provider}/`) ? `${message.provider}/${message.model}` : message.model);
        const u = message.usage;
        if (event.type === "message_end" && u) {
          const size = u.totalTokens ?? ((u.input ?? 0) + (u.output ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0));
          if (size > 0) r.context = size;
        }
      }
    }
    const retainedTools = new Set(r.tools.map(t => t.id));
    r.transcript = r.transcript.filter(e => e.type === "assistant" || retainedTools.has(e.id)).slice(-120);
    this.changed();
  }
  finish(id: string, state: WorkerState, error?: string) {
    const r = this.records.get(id); if (!r || r.endedAt !== undefined) return;
    r.state = state; r.endedAt = Date.now();
    if (state === "completed") this.totalCompleted++;
    else this.totalFailed++;
    r.activity = error ? oneLine(error).slice(0, 300) : state === "completed" ? "Finished" : state;
    r.events.push(r.activity); r.events = r.events.slice(-40);
    const finished = [...this.records.values()].filter(x => x.endedAt !== undefined);
    for (const old of finished.slice(0, Math.max(0, finished.length - 64))) this.records.delete(old.id);
    this.changed();
  }
  list() {
    return [...this.records.values()].sort((a, b) => Number(a.endedAt !== undefined) - Number(b.endedAt !== undefined) || b.startedAt - a.startedAt);
  }
  summary() {
    const active = [...this.records.values()].filter(r => r.endedAt === undefined).length;
    return `Workers · ${active} active · ${this.totalSpawned} spawned · ${this.totalCompleted} done · ${this.totalFailed} failed/stopped`;
  }
}

interface ReadingPosition {top: number; following: boolean}
export class WorkerInspector implements Component {
  selectedId?: string;
  private documentLines: string[] = [];
  private viewport = new ScrollView({invalidate() {}, render: () => this.documentLines}, {follow: "end", overscroll: "contain", scrollbar: "hidden"});
  private responses = new Map<string, AssistantMessageComponent>();
  private expanded = false;
  private shown: WorkerRecord[] = [];
  private firstRow = 2;
  private bodyTop = 0;
  private framed = false;
  private pendingPosition?: ReadingPosition;
  private jump?: {row: number; col: number; width: number};
  private cacheWorker?: string;
  private turns = new Map<string, {component: ToolExecutionComponent; revision: number; tool: ToolActivity}>();
  private regions: {component: ToolExecutionComponent; top: number; height: number}[] = [];
  constructor(private store: WorkerStore, private tui: TUI, private theme: any, private done: () => void, id?: string, private positions = new Map<string, ReadingPosition>(), private scrollbarMode: () => ScrollViewScrollbar = () => "auto") { this.selectedId = id; }
  invalidate() { for (const entry of this.turns.values()) entry.component.invalidate(); for (const component of this.responses.values()) component.invalidate(); }
  dispose() {
    if (this.cacheWorker) this.positions.set(this.cacheWorker, {top: this.viewport.scrollTop, following: this.viewport.isFollowingEnd});
    for (const entry of this.turns.values()) entry.component.updateResult({content: [{type: "text", text: entry.tool.output}], details: entry.tool.details, isError: entry.tool.state === "error"}, false);
    this.turns.clear(); this.responses.clear(); this.regions = [];
  }
  private turn(tool: ToolActivity): ToolExecutionComponent {
    let entry = this.turns.get(tool.id);
    if (!entry) {
      const base = nativeRenderers(tool.name, process.cwd());
      const renderers = base ? {...base,
        renderCall: base.renderCall ? (args: any, theme: any, context: any) => {
          context.state.startedAt = tool.startedAt; context.state.endedAt = tool.endedAt;
          return base.renderCall!(args, theme, context);
        } : undefined,
        renderResult: base.renderResult ? (result: any, options: any, theme: any, context: any) => {
          context.state.startedAt = tool.startedAt; context.state.endedAt = tool.endedAt;
          return base.renderResult!(result, options, theme, context);
        } : undefined,
      } : undefined;
      const component = new ToolExecutionComponent(tool.name, tool.id, tool.args, {showImages: false}, renderers, this.tui, process.cwd());
      component.setArgsComplete(); component.markExecutionStarted(); component.setExpanded(this.expanded);
      entry = {component, revision: 0, tool}; this.turns.set(tool.id, entry);
    }
    if (entry.revision !== tool.revision) {
      entry.component.updateResult({content: [{type: "text", text: tool.output}], details: tool.details, isError: tool.state === "error"}, tool.state === "running");
      entry.revision = tool.revision;
    }
    return entry.component;
  }
  render(width: number): string[] {
    const outerWidth = width;
    const framed = this.framed = width >= 8;
    if (framed) width -= 4;
    // Auto and always keep one gutter cell so content does not reflow when the thumb appears; hidden keeps full width.
    const scrollbar = this.scrollbarMode();
    this.viewport.setScrollbar(scrollbar);
    const gutter = scrollbar !== "hidden" && width > 1;
    const bodyWidth = gutter ? width - 1 : width;
    this.jump = undefined;
    const all = this.store.list();
    const selected = all.find(r => r.id === this.selectedId) ?? all[0]; this.selectedId = selected?.id;
    const index = selected ? all.indexOf(selected) : 0;
    const height = Math.max(6, Math.floor((this.tui.terminal.rows ?? 30) * 0.94) - 2 - (framed ? 4 : 0));
    const count = height >= 22 ? 3 : 1;
    const start = Math.max(0, index - count + 1);
    this.shown = all.slice(start, start + count);
    const rows = [this.theme.fg("accent", " SUBAGENTS · live activity"), " " + this.store.summary()];
    for (const r of this.shown) rows.push(" " + (r.id === this.selectedId ? "▶ " : "  ") + workerRow(r, true));
    if (selected) {
      if (this.cacheWorker !== selected.id) { this.dispose(); this.cacheWorker = selected.id; this.pendingPosition = this.positions.get(selected.id); this.viewport.scrollToEnd(); }
      this.regions = [];
      rows.push(" Status: " + statusLabel(selected) + " · Model: " + (selected.reportedModel ?? selected.model) + " · Effort: " + selected.effort + " (requested)");
      rows.push(" Context: " + contextLabel(selected) + " · Time: " + elapsed(selected) + (selected.state === "paused" || selected.state === "pausing" ? " · " + selected.activity : ""));
      if (height >= 15) {
        rows.push(" " + integrationLabel(selected));
        rows.push(" Task: " + taskLabel(selected.task));
      }
      const tools = selected.tools;
      const retained = new Set(tools.map(tool => tool.id));
      for (const [id, entry] of this.turns) {
        if (retained.has(id)) continue;
        entry.component.updateResult({content: [{type: "text", text: entry.tool.output}], isError: entry.tool.state === "error"}, false);
        this.turns.delete(id);
      }
      const body: string[] = [];
      const current = new Set(selected.transcript.map(e => e.id));
      for (const id of this.responses.keys()) if (!current.has(id)) this.responses.delete(id);
      for (const entry of selected.transcript) {
        if (entry.type === "tool") {
          const tool = tools.find(t => t.id === entry.id); if (!tool) continue;
          const component = this.turn(tool);
          const lines = component.render(bodyWidth);
          this.regions.push({component, top: body.length, height: lines.length});
          body.push(...lines);
        } else if (entry.text) {
          let component = this.responses.get(entry.id);
          if (!component) { component = new AssistantMessageComponent(undefined, true); this.responses.set(entry.id, component); }
          component.updateContent({role: "assistant", content: [{type: "text", text: entry.text}], timestamp: selected.startedAt} as any, entry.partial);
          body.push(...component.render(bodyWidth));
        }
      }
      if (!body.length) body.push(" Waiting for the first response or tool call…");
      const available = Math.max(1, height - rows.length - 1);
      this.documentLines = body;
      this.viewport.updateLayout(body.length, available, () => this.tui.requestRender());
      if (this.pendingPosition) {
        if (!this.pendingPosition.following) this.viewport.scrollTo(this.pendingPosition.top, {disableFollow: true});
        this.pendingPosition = undefined;
      }
      this.bodyTop = rows.length;
      const visible = this.documentLines.slice(this.viewport.scrollTop, this.viewport.scrollTop + available);
      if (!this.viewport.isFollowingEnd && visible.length) {
        // Same label, styling, and click-to-bottom behavior as Pi's fullscreen transcript.
        const keys = getKeybindings().getKeys("tui.altScreen.bottom").map(key => key.split("+").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join("+")).join("/");
        const label = truncateToWidth(" ↓ Jump to latest message" + (keys ? " · " + keys : "") + " ", bodyWidth, "");
        const col = Math.max(0, Math.floor((bodyWidth - visibleWidth(label)) / 2));
        const row = visible.length - 1;
        visible[row] = " ".repeat(col) + this.theme.bg("selectedBg", this.theme.fg("text", label));
        this.jump = {row: this.bodyTop + row, col, width: visibleWidth(label)};
      }
      // One gutter cell per body row. Thumb and track show only while the native ScrollView reports the bar visible.
      const thumb = scrollbarThumb(available, body.length, this.viewport.scrollTop);
      const showBar = this.viewport.isScrollbarVisible;
      for (let row = 0; row < available; row++) {
        const line = visible[row] ?? "";
        if (!gutter) { rows.push(line); continue; }
        const clipped = truncateToWidth(line, bodyWidth, "");
        const cell = !showBar ? " " : row >= thumb.top && row < thumb.top + thumb.height ? this.theme.fg("scrollbarThumb", SCROLLBAR_THUMB) : this.theme.fg("scrollbarTrack", SCROLLBAR_TRACK);
        rows.push(clipped + " ".repeat(Math.max(0, bodyWidth - visibleWidth(clipped))) + cell);
      }
    }
    while (rows.length < height - 1) rows.push(" ");
    rows.push(" ↑/↓ worker · PgUp/PgDn scroll · Ctrl+End latest · Esc close");
    // Paint every cell so the main transcript cannot bleed through the overlay.
    const painted = rows.slice(0, height).map(row => {
      const line = truncateToWidth(row, Math.max(1, width), "…");
      return line + " ".repeat(Math.max(0, width - visibleWidth(line)));
    });
    if (!framed) return painted;
    const edge = (text: string) => this.theme.fg("border", text);
    return [edge("╭" + "─".repeat(outerWidth - 2) + "╮"), edge("│") + " ".repeat(outerWidth - 2) + edge("│"), ...painted.map(line => edge("│") + " " + line + " " + edge("│")), edge("│") + " ".repeat(outerWidth - 2) + edge("│"), edge("╰" + "─".repeat(outerWidth - 2) + "╯")];
  }
  handleInput(data: string) {
    if (matchesKey(data, Key.escape)) { this.done(); return; }
    if (isKeyRelease(data)) return;
    const keybindings = getKeybindings();
    const page = Math.max(1, this.viewport.viewportHeight - 4);
    const list = this.store.list(); const index = Math.max(0, list.findIndex(r => r.id === this.selectedId));
    if (matchesKey(data, Key.up) || matchesKey(data, Key.down)) {
      const next = Math.min(list.length - 1, Math.max(0, index + (matchesKey(data, Key.up) ? -1 : 1)));
      this.selectedId = list[next]?.id;
    } else if (keybindings.matches(data, "tui.altScreen.pageUp")) this.viewport.scrollBy(-page);
    else if (keybindings.matches(data, "tui.altScreen.pageDown")) this.viewport.scrollBy(page);
    else if (keybindings.matches(data, "tui.altScreen.halfPageUp")) this.viewport.scrollBy(-Math.max(1, Math.floor(this.viewport.viewportHeight / 2)));
    else if (keybindings.matches(data, "tui.altScreen.halfPageDown")) this.viewport.scrollBy(Math.max(1, Math.floor(this.viewport.viewportHeight / 2)));
    else if (keybindings.matches(data, "tui.altScreen.lineUp")) this.viewport.scrollBy(-1);
    else if (keybindings.matches(data, "tui.altScreen.lineDown")) this.viewport.scrollBy(1);
    else if (keybindings.matches(data, "tui.altScreen.top") || matchesKey(data, Key.home)) this.viewport.scrollToStart();
    else if (keybindings.matches(data, "tui.altScreen.bottom") || matchesKey(data, Key.end)) this.viewport.scrollToEnd();
    else if (matchesKey(data, "ctrl+o")) { this.expanded = !this.expanded; for (const entry of this.turns.values()) entry.component.setExpanded(this.expanded); }
    this.tui.requestRender();
  }
  handleMouse(event: TuiMouseEvent) {
    if (this.framed) { if (event.x < 2 || event.x >= event.width - 2 || event.y < 2 || event.y >= event.height - 2) return; event = {...event, x: event.x - 2, y: event.y - 2, width: event.width - 4, height: event.height - 4}; }
    if (event.type === "click" && event.button === "left") {
      if (this.jump && event.y === this.jump.row && event.x >= this.jump.col && event.x < this.jump.col + this.jump.width) { this.viewport.scrollToEnd(); return {handled: true, render: true}; }
      const r = this.shown[event.y - this.firstRow];
      if (r) { this.selectedId = r.id; return { handled: true, render: true }; }
      const position = event.y - this.bodyTop + this.viewport.scrollTop;
      if (event.y >= this.bodyTop && event.y < this.bodyTop + this.viewport.viewportHeight) {
        const region = this.regions.find(r => position >= r.top && position < r.top + r.height);
        if (region) {
          const result = region.component.handleMouse({...event, y: position - region.top, height: region.height});
          if (result) { this.tui.requestRender(); return {handled: true, render: true}; }
        }
      }
    }
    if (event.type === "wheel") { this.viewport.scrollBy(event.wheelDelta ?? 0); return { handled: true, render: true }; }
    return undefined;
  }
}

export class WorkerMonitor {
  readonly store = new WorkerStore();
  control?: (args: string, ctx: ExtensionContext) => Promise<void>;
  private ctx?: ExtensionContext;
  private overlayOpen = false;
  private positions = new Map<string, ReadingPosition>();
  private timer?: ReturnType<typeof setInterval>;
  constructor(private readonly pi: ExtensionAPI) {
    pi.on("session_start", (_event, ctx) => {
      if (this.timer) clearInterval(this.timer);
      this.ctx = ctx; this.store.reset(); this.positions.clear();
      if (!ctx.hasUI) return;
      ctx.ui.setWidget("subagent-workers", (tui, theme) => {
        let visible: WorkerRecord[] = [];
        const redraw = () => tui.requestRender();
        const component: Component & { dispose(): void } = {
          dispose: () => { this.store.listeners.delete(redraw); },
          invalidate() {},
          render: width => {
            visible = this.store.list().filter(r => r.endedAt === undefined);
            if (this.store.records.size === 0 && this.store.totalSpawned === 0) return [];
            const rows = [theme.fg("accent", this.store.summary())];
            for (const r of visible) rows.push(workerRow(r));
            return rows.map(row => truncateToWidth(row, Math.max(1, width), "…"));
          },
          handleMouse: event => {
            if (event.type !== "click" || event.button !== "left") return;
            void this.open(visible[event.y - 1]?.id);
            return { handled: true, render: false };
          },
        };
        this.store.listeners.add(redraw);
        return component;
      }, { placement: "aboveEditor" });
      this.timer = setInterval(() => { if (this.store.list().some(r => r.endedAt === undefined)) this.store.changed(); }, 1000);
      this.timer.unref?.();
    });
    pi.on("session_shutdown", () => {
      if (this.timer) clearInterval(this.timer); this.timer = undefined;
      this.store.listeners.clear(); this.ctx = undefined;
    });
    pi.registerCommand("subagent", { description: "Open live subagent inspector", handler: async (args, ctx) => { this.ctx = ctx; if (args.trim() && this.control) await this.control(args, ctx); else await this.open(); } });
    pi.registerShortcut("ctrl+shift+w", { description: "Inspect running subagents", handler: async ctx => { this.ctx = ctx; await this.open(); } });
  }
  async open(id?: string) {
    const ctx = this.ctx;
    if (!ctx?.hasUI || this.overlayOpen || this.store.records.size === 0) return;
    this.overlayOpen = true;
    let unsubscribe: (() => void) | undefined;
    let unsubscribeInput: (() => void) | undefined;
    let close: (() => void) | undefined;
    let overlayTui: TUI | undefined;
    let inspector: WorkerInspector | undefined;
    try {
      await ctx.ui.custom<void>((tui, theme, _keys, done) => {
        overlayTui = tui;
        close = () => done();
        inspector = new WorkerInspector(this.store, tui, theme, () => done(), id, this.positions, () => fullscreenScrollbarMode(this.pi.getSettings().fullscreenScrollbar));
        const redraw = () => tui.requestRender(); this.store.listeners.add(redraw);
        unsubscribe = () => this.store.listeners.delete(redraw);
        return inspector;
      }, { overlay: true, overlayOptions: { width: "98%", maxHeight: "94%", anchor: "center", margin: 1 }, onHandle: handle => {
        const outsideClick = (data: string) => {
          if (handle.isHidden()) return;
          const bounds = handle.getBounds(); if (!bounds) return;
          const sgr = /^\x1b\[<(\d+);(\d+);(\d+)M$/.exec(data);
          const legacy = data.length === 6 && data.startsWith("\x1b[M");
          const button = sgr ? Number(sgr[1]) : legacy ? data.charCodeAt(3) - 32 : -1;
          // Only a primary-button press: movement, release, and wheel input do not dismiss.
          if (button < 0 || (button & 3) !== 0 || (button & 96) !== 0) return;
          const x = sgr ? Number(sgr[2]) - 1 : data.charCodeAt(4) - 33;
          const y = sgr ? Number(sgr[3]) - 1 : data.charCodeAt(5) - 33;
          if (x < bounds.col || x >= bounds.col + bounds.width || y < bounds.row || y >= bounds.row + bounds.height) {
            // Model/editor changes can move focus away while this overlay remains visible.
            // Raise this specific overlay before done() removes the top overlay.
            handle.focus();
            close?.();
            // Consume the dismissal click so it cannot accidentally activate the main screen.
            return {consume: true};
          }
        };
        unsubscribeInput = ctx.ui.onTerminalInput(outsideClick);
        // Pi 1.0.4 installs its consuming mouse router before extension listeners.
        // Feature-detected compatibility adapter: put only our temporary listener
        // first, preserving the relative order of all existing listeners. Cleanup
        // still uses Pi's normal subscription API. No renderer method is replaced.
        const listeners = (overlayTui as unknown as {inputListeners?: Set<typeof outsideClick>} | undefined)?.inputListeners;
        if (listeners instanceof Set && listeners.has(outsideClick)) {
          const existing = [...listeners].filter(listener => listener !== outsideClick);
          listeners.clear(); listeners.add(outsideClick);
          for (const listener of existing) listeners.add(listener);
        }
      } });
    } finally { unsubscribeInput?.(); inspector?.dispose(); unsubscribe?.(); this.overlayOpen = false; }
  }
  compact(text: string, id?: string): Component {
    const component: Component = { invalidate() {}, render: width => text.split("\n").map(line => truncateToWidth(line, Math.max(1, width), "…")) };
    return new MouseRegion(component, event => {
      if (event.type === "click" && event.button === "left") { void this.open(id); return { handled: true, render: false }; }
    });
  }
}
