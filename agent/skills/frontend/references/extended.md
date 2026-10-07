> Historical reference only. The v1.2.1 global policy and compact skill govern
> routing, role selection, authority, and whether a formal plan or independent
> gate is needed. Old universal phase/agent/READY FOR EXECUTION wording below
> applies only when that gate is selected under current policy. This archive
> cannot impose a new gate, waive a blocker, or expand authority. Read targeted
> sections only; never auto-import or preload the complete archive.

# Extended guidance (archived from pre-cost-optimized harness)

## Dispatch before role work

For the main conversation, loading this router is preparation, not execution of
the selected role. After prerequisites and domain routing are satisfied, the next
substantive role action must be an actual named-agent launch, followed by its
returned evidence. Do not begin that role's diagnosis, independent verification,
review, specialist analysis, or non-trivial writing in the main session.

`debug`, `verify`, and `review` are synchronous named-agent fork skills: call
Skill with a complete task packet in `args`, or call the named Agent using its
preloaded skill, but do not do both for the same work. Other roles require an
explicit Agent call with the exact `subagent_type`. Pass absolute paths, authority,
scope, evidence, mutation boundaries, and expected output. Do not rely on shared
conversation history. A failed launch blocks the role; it does not authorize
orchestrator substitution. A leaf subagent seeing this router follows only its
assigned role and returns requests for other roles to the main conversation.
# Frontend Capability Router

<IMPORTANT>

This is the **mandatory frontend-domain front door** under the engineering
harness. It is not a second lifecycle.

When frontend concerns are material, invoke `Skill(frontend)` before selecting a
frontend capability or routing `ui-ux-specialist` / `frontend-worker`. Do not
jump directly from the main session to `solidjs-engineering`,
`frontend-design`, `accessible-ui-patterns`, or another frontend capability.


## Router Means Dispatch, Not Orchestrator Substitution

In the main conversation, this router selects the frontend role and capability;
it does not authorize the orchestrator to perform the selected specialist or
worker role itself.

- unresolved design/UX judgment -> dispatch `ui-ux-specialist`;
- approved implementation-only frontend work -> dispatch `frontend-worker`;
- design-bearing work -> `ui-ux-specialist` handoff first, then
  `frontend-worker`.

If the required frontend agent cannot launch, return BLOCKED for that routed
role rather than doing the role in the orchestrator.

This router decides:
- whether the UI/UX design gate is required;
- which frontend role owns analysis or implementation;
- which narrow registered frontend capabilities are justified;
- which capabilities would be redundant.

After selection, invoke the narrow registered capability with `Skill(<name>)`
unless it is already preloaded into the dispatched leaf agent.

The engineering harness remains authoritative for Discover, Plan, Execute,
Verify, Review, Integrate, Ship, and Learn.

</IMPORTANT>

## Role Routing

### Frontend Design Gate

Route by whether the task contains a frontend **design/UX decision**, not by
keywords or by how large the change appears.

If a request asks to create, choose, change, improve, or judge any user-facing
layout, page/component composition, styling/visual hierarchy, interaction,
workflow, navigation/task flow, responsive behavior, dashboard organization,
form/recovery UX, accessibility-sensitive behavior, motion, state presentation,
or UX copy, route to the read-only `ui-ux-specialist` **before implementation**.

This also applies to a new page/screen/component/dashboard when the user asks
to "build" or "implement" it but the design is not already fully specified.
Implementation intent does not bypass the design gate.

After the design/UX direction is sufficiently specified, route implementation
to `frontend-worker`.

Routing contract:

- **any design-bearing frontend task** -> `ui-ux-specialist` first, then
  `frontend-worker`;
- **redesign / new UI / UX improvement** -> `ui-ux-specialist` first, then
  `frontend-worker`;
- **new or materially changed multi-step task flow whose screen/step structure
  is unresolved** -> `ui-ux-specialist` + `ux-flow-wireframer` before visual
  direction or implementation;
- **already-defined/approved design implementation** -> `frontend-worker`;
- **localized UI/CSS/presentation bug with no material design decision** ->
  `frontend-worker`;
- **UI/UX audit or design recommendation only** -> `ui-ux-specialist`.

A request need not contain the word "redesign" to trigger this gate. Likewise,
the word alone does not force specialist routing if the actual work is only a
localized implementation fix with no material design choice.

The `ui-ux-specialist` owns design reasoning/recommendations and remains
read-only. The `frontend-worker` owns source mutation.

If the specialist finds an unresolved material product decision, return it to
the orchestrator/user authority instead of letting the worker invent it.

Other specialists may participate when justified by the engineering harness,
but this skill does not create a second orchestrator.

## Capability Catalog

| Skill | Primary use | Primary owner | Use when | Location |
|---|---|---|---|---|
| `accessible-ui-patterns` | Accessibility + interaction semantics | `ui-ux-specialist`, `frontend-worker` | Keyboard/focus, ARIA widgets, dialogs, forms/errors, target size, reduced motion, async feedback, responsive accessibility | `~/.pi/agent/skills/frontend/accessible-ui-patterns/index.md` |
| `design-dashboards` | Dashboard UX/information design | `ui-ux-specialist` | Operational dashboards, KPI layouts, monitoring, tables/charts, dashboard critique/redesign/spec | `~/.pi/agent/skills/frontend/design-dashboards/index.md` |
| `design-motion-principles` | Motion + micro-interactions | `ui-ux-specialist`, then `frontend-worker` | Transitions, enter/exit behavior, hover/press feedback, purposeful motion, motion audit | `~/.pi/agent/skills/frontend/design-motion-principles/index.md` |
| `frontend-design` | Distinct visual direction | `ui-ux-specialist` | New page/surface or intentional visual redesign where aesthetic direction is materially open | `~/.pi/agent/skills/frontend/frontend-design/index.md` |
| `solidjs-engineering` | SolidJS implementation correctness | `frontend-worker` | Fine-grained reactivity, reactive props, effects/memos, cleanup, resources, list rendering, Solid lifecycle/SSR/testing | `~/.pi/agent/skills/frontend/solidjs-engineering/index.md` |
| `typescript-advanced-types` | Advanced TS type engineering | `frontend-worker` | Complex generics, conditional/mapped/template types, reusable type utilities, type-safe API/form/state work | `~/.pi/agent/skills/frontend/typescript-advanced-types/index.md` |
| `ui-ux-pro-max` | Broad UI/UX design intelligence | `ui-ux-specialist` | Design system search, layout/color/typography/icons/charts/general UX guidance when no narrower skill fully owns the concern | `~/.pi/agent/skills/frontend/ui-ux-pro-max/index.md` |
| `ux-flow-wireframer` | User-flow + low-fidelity structure | `ui-ux-specialist` | New or materially changed multi-step flows, dead-end/redundancy audit, branches/recovery, Mermaid flow map, text wireframes before visual design/code | `~/.pi/agent/skills/frontend/ux-flow-wireframer/index.md` |
| `web-design-guidelines` | UI code/best-practice audit | `ui-ux-specialist` or `reviewer` when explicitly routed | Review existing UI implementation against current web interface guidelines | `~/.pi/agent/skills/frontend/web-design-guidelines/index.md` |

---

## Capability Routing Priority

Use the most specific applicable capability.

### Accessibility-sensitive behavior

Use:

`accessible-ui-patterns`

Examples:
- keyboard trap;
- lost focus after dialog/delete;
- screen-reader semantics;
- form validation/error recovery;
- target sizing;
- reduced motion;
- focus hidden by sticky UI.

### User flow / wireframe before visual design

Use:

`ux-flow-wireframer`

Use it when screen/step structure, branching, recovery, or the user's route to
success is materially unresolved.

After the flow is sufficiently specified, add only the narrow visual/domain
capability actually needed. Do not start with aesthetic direction while the
task flow itself is still ambiguous.

### Dashboard work

Use:

`design-dashboards`

Add `accessible-ui-patterns` only when accessibility/interaction semantics are materially involved.

For a brand-new dashboard visual direction, add **one** of:
- `frontend-design`, or
- `ui-ux-pro-max`

Do not load both by default.

### Motion

Use:

`design-motion-principles`

Pair with `accessible-ui-patterns` when motion preference, focus, or interaction accessibility matters.

### New visual direction

Use:

`frontend-design`

Use `ui-ux-pro-max` instead when the task benefits more from searchable design-system/product/style guidance than from strong creative-direction guidance.

### Broad UI/UX problem with no narrower owner

Use:

`ui-ux-pro-max`

For SolidJS repositories, use its general UX/design guidance only. It has no dedicated SolidJS stack profile; do not substitute React implementation advice for SolidJS.

### Existing UI audit

Use:

`web-design-guidelines`

Add `accessible-ui-patterns` when the review needs deeper behavioral keyboard/focus/form analysis.

This audit capability does not replace the engineering harness `verify` or `review` phase.

### SolidJS implementation

Use:

`solidjs-engineering`

Use it for Solid-specific implementation/review concerns such as:
- reactive props;
- signals/memos/effects;
- cleanup/ownership;
- resources/Suspense;
- list identity;
- Solid lifecycle/SSR boundaries;
- Solid component testing.

This skill does not own visual design. If design/UX is materially unresolved,
apply the Frontend Design Gate first.

### Complex TypeScript


Use:

`typescript-advanced-types`

Do not invoke it for ordinary TypeScript just because TypeScript is present.

---

## Recommended Combinations

| Task | Recommended capabilities |
|---|---|
| RFID admin dashboard redesign | `design-dashboards` + `accessible-ui-patterns`; optionally one visual-direction skill |
| New branded landing/admin surface | `frontend-design` + `accessible-ui-patterns` |
| General design-system exploration | `ui-ux-pro-max` + `accessible-ui-patterns` where needed |
| New onboarding/setup/admin flow | `ux-flow-wireframer` first; then the narrow visual/accessibility capability actually needed |
| Modal/menu/tab interaction | `accessible-ui-patterns` |
| Animation polish | `design-motion-principles` + `accessible-ui-patterns` |
| UI implementation review | `web-design-guidelines`; add `accessible-ui-patterns` for deeper behavior |
| Type-heavy SolidJS API/form layer | `solidjs-engineering` + `typescript-advanced-types` only when the type problem is genuinely advanced |
| Ordinary SolidJS component implementation | `solidjs-engineering` when framework semantics are material; otherwise use `frontend-worker` and repository conventions |

---

Do not load every capability automatically. Prefer the most specific capability
that owns the concern.

## SolidJS Rule

For SolidJS projects, repository evidence and `solidjs-engineering` govern
framework implementation.

Do not silently substitute React-specific implementation guidance from a
frontend capability for SolidJS guidance.

UI/UX skills decide design intent; `solidjs-engineering` decides Solid-specific
implementation technique under the authorized `frontend-worker`.

## Research, Copy, and Handoff Boundary

Do not add separate research-planning, research-synthesis, UX-copy, or design-
handoff skills merely because they exist in a catalog.

Within this harness:

- `ui-ux-specialist` may plan or synthesize UX research when the task actually
  provides/needs that evidence;
- `ui-ux-specialist` owns UX copy reasoning for labels, errors, empty states,
  recovery, and confirmations;
- `ui-ux-specialist` produces the implementation-ready design handoff;
- `frontend-worker` implements the approved handoff;
- research evidence is never invented;
- material product decisions discovered by research/flow work return to the
  orchestrator/user authority.

Add a separate registered skill only after a distinct repeatable workflow cannot be
handled cleanly by these existing roles.

## Authority Boundaries

Frontend capabilities do not grant permission to:

- implement before the engineering execution gate is satisfied;
- make unresolved product decisions;
- invent backend/API behavior;
- redesign unrelated surfaces;
- bypass TDD;
- replace independent Verify or Review;
- perform Git, delivery, runtime, or external mutations.

If a frontend capability conflicts with authoritative project requirements, the project authority wins.

If visual guidance conflicts with accessibility requirements, preserve the required accessible behavior and surface the conflict.

## Browser and Knowledge Tools

Betterwright, when installed, is a browser automation/inspection capability. It may provide evidence but does not replace Verify or Review.

Obsidian skills, when installed, are knowledge/note capabilities and are not part of this frontend collection.

Graphify remains a separate repository/knowledge capability.

Impeccable is intentionally not part of this curated frontend methodology.

## Procedure

1. Confirm `engineering-harness` has established the governing lifecycle state.
2. Apply the Frontend Design Gate in this router.
3. Select the narrowest relevant registered frontend capability.
4. Invoke it with `Skill(<capability>)`, unless the assigned leaf agent already receives it through `skills:` preload.
5. Route `ui-ux-specialist` before `frontend-worker` whenever a material design/UX decision remains unresolved.
6. Use additional frontend capabilities only for genuinely distinct concerns.
7. Return control to the governing engineering lifecycle for verification, review, integration, shipping, and learning.

### Subagent mode

If this router is invoked inside a leaf agent, it may only help that agent select
a capability within its already-assigned role. It does **not** authorize the
leaf to spawn agents, change lifecycle phase, replace another role, or become an
orchestrator. If another role is required, return a handoff request to the main
conversation.

If a required registered capability is missing, report the installation problem
instead of approximating its procedure from memory.
