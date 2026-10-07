# ui-ux-specialist topic reference

Reference guidance only; the current role, candidate authority and AGENTS policy govern. Search headings and read the task-relevant section; do not load the whole catalog.

## Evidence Priority

Prefer:
1. explicit user/approved product decisions;
2. authoritative project requirements and behavioral contracts;
3. authoritative project design system/spec;
4. preserved existing product behavior;
5. user research/support/usability evidence;
6. task-specific references;
7. generic design heuristics.

Do not let a style skill override product truth, accessibility, security,
permissions, persistence semantics, or established interaction contracts.

## UX Discovery and Research Evidence

When material design direction is unclear, first inspect available evidence.

Useful discovery dimensions include:
- target user/context;
- user goal and motivation;
- current behavior/workaround;
- pain points/triggers;
- critical journey/task;
- success signal;
- known evidence vs assumptions;
- open product decisions.

Do not invent interviews, personas, survey results, support feedback, or user
research.

### Research planning

When the user explicitly needs a research plan, define:
- the decision(s) the research should inform;
- method choice and why;
- participant criteria and realistic sample rationale;
- recruitment/constraints when known;
- task/question sequence;
- per-task observation criteria;
- wrap-up;
- known bias risks.

Avoid leading questions. Prefer neutral prompts and observable behavior.

### Research synthesis

When actual research material is provided:
- preserve source traceability;
- cluster evidence into specific themes;
- distinguish repeated patterns from low-frequency/high-signal surprises;
- identify user jobs/outcomes where supported;
- produce testable hypotheses, not invented conclusions;
- recommend next steps with confidence/limitations.

Research evidence informs design; it does not grant authority to decide a
material product policy.

## User Flow and Wireframe Mode

When the screen/step structure is unresolved, load:

`~/.pi/agent/skills/frontend/ux-flow-wireframer/index.md`

Resolve flow structure before visual polish.

Surface:
- entry points;
- success condition;
- happy path;
- branches;
- validation/recovery;
- loading/empty/error/success states;
- abandonment/back paths;
- dead ends/redundancy;
- open product decisions.

Do not let visual styling silently alter an accepted flow.

## UX Copy

Treat interface language as behavior when it affects comprehension or recovery.

Prefer:
- action-oriented labels;
- specific wording over generic wording;
- helpful error/recovery language rather than blame;
- established project terminology;
- clear empty/loading/success/permission states.

Do not rewrite brand/product terminology without scope/authority.

## Design Analysis

Consider:
- user goal and task flow;
- information and visual hierarchy;
- navigation/orientation;
- dashboards and operational status;
- forms and recovery;
- tables, grids, charts, filters;
- loading, empty, error, success, busy, disabled, retry states;
- destructive/irreversible actions;
- responsive behavior and text expansion;
- keyboard interaction;
- focus management/restoration;
- accessible names, semantics, state;
- touch/target sizing;
- reduced-motion behavior;
- perceived responsiveness;
- design-system consistency;
- density/scannability;
- localization/i18n resilience when relevant.

Do not redesign merely to make the UI different.

## Dashboard Priorities

For dashboards prioritize:
1. important information first;
2. clear status distinction;
3. actionable exceptions;
4. scannability;
5. appropriate density;
6. comparison/context for metrics;
7. clear filters/time scope;
8. drill-down paths;
9. safe administrative actions;
10. accessible tables/charts/status indicators.

Never rely on color alone for critical state.

## Design Handoff Contract

Before handing a material design to `frontend-worker`, provide only the detail
needed to implement it correctly.

Depending on scope, include:
- accepted user/task flow;
- layout/grid/spacing/breakpoint constraints;
- authoritative tokens/components to reuse;
- component variants/props when relevant;
- default/hover/active/focus/disabled/loading/error states;
- responsive behavior;
- empty/long-text/permissions/error edge cases;
- motion/reduced-motion behavior;
- keyboard/focus/ARIA expectations;
- UX copy requirements;
- assets/reference-fidelity notes;
- explicit assumptions/open decisions/out-of-scope items;
- expected acceptance/browser evidence.

Tiny localized fixes do not need ceremonial handoff documents.

If the handoff still contains a material unresolved product decision, stop that
affected scope and return it to the orchestrator/user.

## Collaboration

Coordinate through the orchestrator with:
- `frontend-worker` for implementation;
- `api-specialist` when frontend behavior depends on uncertain API contracts;
- `observability-specialist` for operational-dashboard telemetry semantics;
- `security-specialist` for auth/security-sensitive UI;
- `performance-specialist` for measured frontend performance problems;
- `reviewer` / `test-engineer` for independent post-implementation challenge.

Do not invent backend fields, permissions, or API behavior.

## Completion

Return:
- the design/research/flow conclusion;
- evidence and assumptions;
- selected capability/capabilities;
- implementation-ready handoff when implementation follows;
- unresolved product decisions;
- verification/review evidence that should be required later.

Do not claim implementation completion or verification.
