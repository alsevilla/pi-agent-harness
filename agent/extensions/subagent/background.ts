import * as fs from "node:fs";
import type { ChildProcess } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { WorkerMonitor } from "./monitor.ts";
import { DecisionRelay, decisionPayload, formatDecisionNotice, type DecisionAction, type DecisionNotice, type DecisionRecord, type DecisionSettlement } from "./decision-relay-state.ts";

export class RpcWorker {
  private sequence = 0;
  private pending = new Map<string, {resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>}>();
  closed = false;
  private writes = new Set<(error: Error) => void>(); // decision responses whose stream write has not been confirmed
  constructor(readonly proc: ChildProcess, readonly controlPath?: string) { proc.stdin?.on("error", error => this.close(error.message)); }
  send(type: string, message?: string): Promise<any> {
    if (this.closed || !this.proc.stdin?.writable) return Promise.reject(new Error("Worker has finished or disconnected"));
    const id = `control-${++this.sequence}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error("Worker did not acknowledge the instruction within 30s")); }, 30000);
      this.pending.set(id, {resolve, reject, timer});
      this.proc.stdin!.write(JSON.stringify({id, type, ...(message === undefined ? {} : {message})}) + "\n", error => {
        if (error) { const p = this.pending.get(id); if (p) { clearTimeout(p.timer); this.pending.delete(id); reject(error); } }
      });
    });
  }
  // Delivers one held decision dialog's response. Resolves only when the stream confirms the write; rejects when stdin is closed, missing, failing or the worker closes first.
  respond(id: string, body: {value: string} | {cancelled: true}): Promise<void> {
    const stdin = this.proc.stdin;
    if (this.closed || !stdin?.writable) return Promise.reject(new Error("worker input is closed; unavailable"));
    return new Promise<void>((resolve, reject) => {
      const fail = (error: Error) => { if (this.writes.delete(fail)) reject(error); };
      this.writes.add(fail);
      try {
        stdin.write(JSON.stringify({type: "extension_ui_response", id, ...body}) + "\n", (error?: Error | null) => {
          if (!this.writes.delete(fail)) return; // close already settled this write
          if (error) reject(error); else resolve();
        });
      } catch (error) {
        this.writes.delete(fail);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
  setPaused(paused: boolean) {
    if (this.closed || !this.controlPath) throw new Error("Worker has finished or lacks pause support; restart Pi to load the updated worker runtime");
    fs.writeFileSync(this.controlPath, paused ? "1" : "0", {flag: "r+"});
  }
  event(event: any) {
    if (event.type !== "response") return;
    const p = this.pending.get(event.id); if (!p) return;
    clearTimeout(p.timer); this.pending.delete(event.id);
    if (event.success) p.resolve(event.data ?? {}); else p.reject(new Error(event.error ?? "Worker rejected the instruction"));
  }
  close(reason = "Worker finished before acknowledging the instruction") {
    this.closed = true;
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error(reason)); }
    this.pending.clear();
    for (const fail of [...this.writes]) fail(new Error("worker closed before the response write was confirmed: " + reason));
  }
}

interface Job {
  id: string; generation: number; state: "running" | "completed" | "failed" | "aborted";
  controller: AbortController; workerIds: string[]; result?: any; pendingSteers: string[]; paused?: boolean;
}
export class BackgroundWorkers {
  jobs = new Map<string, Job>();
  clients = new Map<string, RpcWorker>();
  private controllers = new Map<string, AbortController>();
  private steering = new Map<string, string[]>();
  private generation = 0;
  private sequence = 0;
  private slots = 0;
  private queue: {signal?: AbortSignal; resolve: (release: () => void) => void; reject: (error: Error) => void; abort: () => void}[] = [];
  constructor(private pi: ExtensionAPI, readonly monitor: WorkerMonitor, private decisions = new DecisionRelay()) {
    pi.on("session_start", () => this.reset());
    pi.on("session_shutdown", () => this.reset());
  }
  reset() {
    this.settleDecisions(this.decisions.clear("session-reset"));
    this.generation++;
    for (const job of this.jobs.values()) job.controller.abort();
    for (const controller of this.controllers.values()) controller.abort();
    this.jobs.clear(); this.clients.clear(); this.controllers.clear(); this.steering.clear();
  }
  async acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) throw new Error("Subagent was aborted");
    if (this.slots < 4) { this.slots++; return this.releaseOnce(); }
    return new Promise((resolve, reject) => {
      const item = {signal, resolve, reject, abort: () => { this.queue = this.queue.filter(x => x !== item); reject(new Error("Subagent was aborted")); }};
      this.queue.push(item); signal?.addEventListener("abort", item.abort, {once: true});
    });
  }
  private releaseOnce() {
    let released = false;
    return () => {
      if (released) return; released = true;
      const next = this.queue.shift();
      if (next) { next.signal?.removeEventListener("abort", next.abort); next.resolve(this.releaseOnce()); }
      else this.slots--;
    };
  }
  start(run: (signal: AbortSignal, jobId: string) => Promise<any>) {
    if ([...this.jobs.values()].filter(j => j.state === "running").length >= 16) throw new Error("16 background jobs are already active; finish or stop a job first");
    const id = `bg-${++this.sequence}`;
    const job: Job = {id, generation: this.generation, state: "running", controller: new AbortController(), workerIds: [], pendingSteers: []};
    this.jobs.set(id, job);
    void (async () => {
      try {
        job.result = await run(job.controller.signal, id);
        job.state = job.controller.signal.aborted ? "aborted" : job.result.isError ? "failed" : "completed";
      } catch (error) {
        job.state = job.controller.signal.aborted ? "aborted" : "failed";
        job.controller.abort(); // Stop siblings if a chain/parallel job throws.
        job.result = {isError: true, content: [{type: "text", text: String(error)}]};
      }
      this.settleDecisions(this.decisions.settleJob(id, "job-ended"));
      if (job.generation !== this.generation) return;
      const output = (job.result.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
      try {
        await this.pi.sendMessage({customType: "subagent-completion", content: `Subagent job ${id} ${job.state}. Workers: ${job.workerIds.join(", ") || "none"}.\n${output.slice(0, 50000)}${output.length > 50000 ? "\n[Remaining output available via subagent_control result.]" : ""}`, display: false, details: {jobId: id, state: job.state}}, {triggerTurn: true, deliverAs: "followUp"});
      } catch { /* Session can close while its completion is being delivered. */ }
      const finished = [...this.jobs.values()].filter(j => j.state !== "running");
      for (const old of finished.slice(0, Math.max(0, finished.length - 64))) {
        this.jobs.delete(old.id); for (const workerId of old.workerIds) this.steering.delete(workerId);
      }
    })();
    return job;
  }
  assertCanLaunch(roles: string[]) {
    const heldJob = [...this.jobs.values()].find(j => j.state === "running" && j.paused);
    if (heldJob) throw new Error("Job " + heldJob.id + " is paused. Resume or cancel it before launching another job; a pause must not be bypassed with replacement workers.");
    const held = [...this.monitor.store.records.values()].find(r => !r.endedAt && (r.state === "paused" || r.state === "pausing") && roles.includes(r.name));
    if (held) throw new Error("Worker " + held.id + " (" + held.name + ") is paused. Resume or cancel it before launching another worker with that role.");
  }
  note(jobId: string, workerId: string) { this.jobs.get(jobId)?.workerIds.push(workerId); }
  attach(jobId: string, workerId: string, client: RpcWorker, controller: AbortController) {
    this.clients.set(workerId, client); this.controllers.set(workerId, controller);
    const job = this.jobs.get(jobId);
    if (job?.paused) client.setPaused(true);
    for (const message of job?.pendingSteers.splice(0) ?? []) {
      void client.send("steer", message).then(() => {
        this.recordSteer(workerId, message);
      }).catch(error => {
        this.monitor.store.records.get(workerId)?.events.push("Steering failed: " + error.message);
        this.monitor.store.changed();
      });
    }
  }
  private recordSteer(workerId: string, message: string) {
    const messages = this.steering.get(workerId) ?? []; messages.push(message); this.steering.set(workerId, messages);
    const r = this.monitor.store.records.get(workerId);
    if (r) { r.events.push("Steering acknowledged: " + message.slice(0, 150)); r.events = r.events.slice(-40); r.activity = "Steering queued: " + message.replace(/\s+/g, " ").slice(0, 150); this.monitor.store.changed(); }
  }
  steeringFor(workerId: string) { return this.steering.get(workerId) ?? []; }
  detach(workerId: string) { this.settleDecisions(this.decisions.settleWorker(workerId, "worker-exited")); this.clients.get(workerId)?.close(); this.clients.delete(workerId); this.controllers.delete(workerId); }
  private worker(target: string): string | undefined {
    if (this.clients.has(target)) return target;
    const number = target.replace(/^#/, "");
    return [...this.monitor.store.records.values()].find(r => r.id.split(":")[1] === number)?.id;
  }
  async waitRunnable(jobId: string, signal?: AbortSignal) {
    while (this.jobs.get(jobId)?.paused) {
      if (signal?.aborted) throw new Error("Subagent was aborted");
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (signal?.aborted) throw new Error("Subagent was aborted");
  }
  pause(target: string, paused = true) {
    const job = this.jobs.get(target);
    if (job && job.state !== "running") throw new Error("Job has already finished");
    const ids = job ? job.workerIds.filter(id => this.clients.has(id)) : [this.worker(target)].filter(Boolean) as string[];
    if (!job && !ids.length) throw new Error("No active worker matches " + target);
    for (const id of ids) {
      const client = this.clients.get(id); if (!client) throw new Error("Worker has finished");
      client.setPaused(paused);
      const r = this.monitor.store.records.get(id);
      if (r) { r.state = paused ? "pausing" : "running"; r.activity = paused ? "Pause requested; finishing current tool/model call" : "Resuming worker"; }
    }
    if (job) job.paused = paused;
    this.monitor.store.changed();
    return paused ? "Pause requested for " + target + ". Current tool/model call may finish; the next boundary is held until resume. " + (job ? "Later chain workers are also held. " : "") + "Use subagent_control resume; do not launch a replacement worker." : "Resumed " + target + ". Continuing the same worker/job.";
  }
  async steer(target: string, message: string) {
    if (/^\s*(?:please\s+)?(?:stop for a bit|pause(?: for a bit)?|hold on|wait for (?:me|my instructions))\s*[.!]?\s*$/i.test(message)) return this.pause(target);
    const job = this.jobs.get(target);
    if (job && job.state !== "running") throw new Error("Job has already finished");
    const active = job?.workerIds.filter(id => this.clients.has(id)) ?? [];
    if (active.length > 1) throw new Error("Job has multiple active workers; select a worker ID: " + active.join(", "));
    if (job && active.length === 0) { job.pendingSteers.push(message); return "Queued until the next worker starts; not acknowledged yet"; }
    const id = active[0] ?? this.worker(target); const client = id ? this.clients.get(id) : undefined;
    if (!client) throw new Error("Worker is not ready or has finished; use subagent_control list to find active worker IDs");
    const acknowledgement = await client.send("steer", message);
    this.recordSteer(id!, message);
    return `Worker ${id}: ${acknowledgement.disposition ?? "acknowledged"}. Instruction will apply between tool turns.`;
  }
  cancel(target: string) {
    const job = this.jobs.get(target);
    if (job) { if (job.state !== "running") throw new Error("Job has already finished"); this.settleDecisions(this.decisions.settleJob(target, "cancelled")); job.controller.abort(); return "Stopping job " + target; }
    const id = this.worker(target), controller = id ? this.controllers.get(id) : undefined;
    if (!controller) throw new Error("No active worker matches " + target);
    this.settleDecisions(this.decisions.settleWorker(id!, "cancelled"));
    controller.abort(); return "Stopping worker " + id;
  }
  // Parent side of request_decision: announce a validated request, hold its exact dialog, relay the answer.
  announceDecision(jobId: string, workerId: string, candidate: string, message: string) {
    const result = this.decisions.announce({jobId, workerId, candidate, raw: decisionPayload(message)});
    if (result.ok) this.notifyDecision({...result.record, state: "open"}, true);
    else this.notifyDecision({state: "rejected", requestId: result.requestId, jobId, workerId, candidate, reason: result.error}, true);
  }
  holdDecisionDialog(jobId: string, workerId: string, event: {method: string; title?: unknown; id?: unknown}): boolean {
    return !!this.decisions.holdDialog({jobId, workerId, method: event.method, title: event.title, dialogId: event.id});
  }
  // Records answered/declined only after the stream write is confirmed. Failure or a racing settlement stays terminal and unanswered.
  async answerDecision(requestId: string, action: DecisionAction): Promise<string> {
    const result = action.kind === "answer"
      ? this.decisions.answer(requestId, {answer: action.answer, basis: action.basis, reference: action.reference})
      : this.decisions.decline(requestId, action.reason);
    if (!result.ok) throw new Error(result.error);
    const {record} = result;
    try {
      const client = this.clients.get(record.workerId);
      if (!client) throw new Error("worker is no longer attached");
      await client.respond(record.dialogId!, {value: result.value});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!this.decisions.settleDelivery(record, "delivery-failed: " + message)) throw this.settledError(record);
      this.notifyDecision({...record, state: "settled"}, false);
      throw new Error("Decision " + requestId + " was not delivered (" + message + "); it is settled as failed and not recorded as answered.");
    }
    if (!this.decisions.settleDelivery(record, action.kind === "answer" ? "answered" : "declined")) throw this.settledError(record);
    const job = this.jobs.get(record.jobId);
    return "Decision " + requestId + " recorded (" + (action.kind === "answer" ? "answered, basis " + action.basis : "declined") + "). Worker " + record.workerId + " stream write confirmed; the worker's receipt is not confirmed. " + (job?.paused ? "Job " + job.id + " stays paused; resume separately." : "Job continues.");
  }
  private settledError(record: DecisionRecord) {
    return new Error("Decision " + record.requestId + " was settled (" + record.reason + ") before its delivery completed; it is not recorded as answered.");
  }
  private settleDecisions(settlements: DecisionSettlement[]) {
    for (const settled of settlements) {
      // Settlement is already terminal; a failed cleanup write must not leave an unhandled rejection.
      if (settled.dialogId) this.clients.get(settled.workerId)?.respond(settled.dialogId, settled.value === undefined ? {cancelled: true as const} : {value: settled.value}).catch(() => {});
      this.notifyDecision({...settled.record, state: "settled"}, false);
    }
  }
  private notifyDecision(notice: DecisionNotice, triggerTurn: boolean) {
    try {
      void Promise.resolve(this.pi.sendMessage({customType: "subagent-decision", content: formatDecisionNotice(notice), display: true, details: notice}, {triggerTurn, deliverAs: "followUp"})).catch(() => {});
    } catch { /* Session can close while its decision notice is delivered. */ }
  }
  list() {
    return [...this.jobs.values()].map(j => ({jobId: j.id, state: j.state, paused: !!j.paused, workers: j.workerIds.map(id => {
      const r = this.monitor.store.records.get(id);
      return {id, name: r?.name, model: r?.reportedModel ?? r?.model, state: r?.state ?? "history expired", activity: r?.activity};
    })}));
  }
  result(target: string) {
    const job = this.jobs.get(target); if (!job) throw new Error("Unknown job " + target);
    return job.result ?? {content: [{type: "text", text: `Job ${target} is still running. Continue other work; completion will arrive automatically.`}]};
  }
}
