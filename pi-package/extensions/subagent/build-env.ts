import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

/** Walk up from cwd to the nearest directory containing `.git` (a folder, or a file in a worktree). */
function checkoutRoot(cwd: string): string | undefined {
  let dir = path.resolve(cwd);
  for (;;) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Cargo defaults for worker processes: one shared target directory per checkout under
 * PI_CARGO_TARGET_ROOT (so agents stop creating a new multi-GB build folder per task), and
 * non-incremental builds. Values already present in `env` win.
 */
export function cargoEnvDefaults(cwd: string, env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const defaults: Record<string, string> = {};
  if (env.CARGO_INCREMENTAL === undefined) defaults.CARGO_INCREMENTAL = "0";
  const root = env.PI_CARGO_TARGET_ROOT;
  if (root && env.CARGO_TARGET_DIR === undefined) {
    const top = checkoutRoot(cwd);
    if (top) {
      const id = crypto.createHash("sha1").update(process.platform === "win32" ? path.resolve(top).toLowerCase() : path.resolve(top)).digest("hex").slice(0, 8);
      defaults.CARGO_TARGET_DIR = path.join(root, `${path.basename(top)}-${id}`);
    }
  }
  return defaults;
}
