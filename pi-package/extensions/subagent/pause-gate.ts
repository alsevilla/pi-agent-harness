import * as fs from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Loaded only in a background child. A parent-owned control file enforces pause
// independently of model compliance, without interrupting an executing tool.
export default function pauseGate(pi: ExtensionAPI) {
  const controlPath = process.env.PI_SUBAGENT_CONTROL_FILE;
  if (!controlPath) return;
  let paused = true;
  let announced = false;
  const boundary = async () => {
    for (;;) {
      try { const state = fs.readFileSync(controlPath, "utf8"); if (state === "1" || state === "0") paused = state === "1"; }
      catch { /* Retain the last state if the control file is temporarily unreadable. */ }
      if (!paused) {
        if (announced) process.stdout.write(JSON.stringify({type: "worker_pause_state", paused: false}) + "\n");
        announced = false;
        return;
      }
      if (!announced) process.stdout.write(JSON.stringify({type: "worker_pause_state", paused: true}) + "\n");
      announced = true;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };
  pi.on("before_agent_start", boundary);
  pi.on("before_provider_request", boundary);
  pi.on("tool_call", boundary);
  pi.on("agent_before_settle", boundary);
}
