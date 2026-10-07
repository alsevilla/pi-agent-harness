# Modular skill map

The registered engineering skills are engineering-harness, frontend and backend.
Each owns its module folders; no child directory contains a registered SKILL.md.
Read one module index for the task, then only relevant guide/reference sections.
The main orchestrator owns actual named-agent launches; leaf agents never delegate.

## Engineering harness modules
debug, decision, discover, execute, integrate, knowledge, learn, plan, review, ship,
verify and worktree live under engineering-harness/<name>/index.md.
Historical catalogs and router guidance live under engineering-harness/references/;
they cannot add mandatory phases or override current global policy.

## Frontend modules
ux-flow-wireframer, design-dashboards, design-motion-principles, frontend-design,
ui-ux-pro-max, accessible-ui-patterns, solidjs-engineering, web-design-guidelines,
typescript-advanced-types live under frontend/<name>/index.md.
Choose frontend-design OR ui-ux-pro-max for broad direction unless distinct needs
justify both. Modules grant guidance, not design/implementation authority.

## Backend modules
rust-axum-engineering, sqlite-sqlx-engineering, load-resilience-testing live under
backend/<name>/index.md. Use only the capabilities justified by the task.

## Compatibility
Pi's manual shortcuts live under ~/.pi/agent/prompts/. They expand instructions;
they do not automatically fork agents. Required debug/verify/review routes use
actual subagent calls to debugger, test-engineer or reviewer with task packets.
The parent skills select ordinary module indexes rather than registering each
module as another skill. Restricting a shortcut does not prevent reference reads.
Former agent skill preloads become explicit assigned-module reads; do not assume
automatic injection or reinvoke the manual shortcut. Missing context stays BLOCKED.

Browser (Betterwright) and the profile-adapted Graphify skill remain independent.
There is one browser entry; graphify-pi supplies its native extension while its
package skill is disabled to keep main and worker guidance consistent. A folder move
alone saves no tokens: savings come from fewer catalog entries, smaller module indexes,
selective detail loading and avoiding blanket preload of long capability guides.

## Policy details on demand
Main entry: engineering-harness/SKILL.md. Its references/routing.md, recovery.md, worker-control.md, runtime.md and git-attribution.md each have a specific read trigger; do not preload all. Optional references/roles/ catalogs support Scout, DevOps and UI/UX only when deeper topic guidance is needed. These files have no SKILL.md and add no skill-discovery entries. Unused upstream Graphify pipeline references are removed; keep the adapted query/build procedures.
