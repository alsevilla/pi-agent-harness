# Conditional frontend capability selection

Read only when capability selection or design ownership is unresolved. Project
requirements govern mandatory capabilities; this reference does not waive them.
Use the narrowest applicable skill and pass findings to the assigned role.

| Unresolved concern | Skill | Role |
|---|---|---|
| Screen/step structure, branching, recovery | ux-flow-wireframer | ui-ux-specialist |
| Dashboard organization, KPI, table/chart information design | design-dashboards | ui-ux-specialist |
| Keyboard, focus, ARIA, forms/errors, reduced motion | accessible-ui-patterns | ui-ux-specialist for judgment; frontend-worker for accepted behavior |
| New visual direction | frontend-design OR ui-ux-pro-max | ui-ux-specialist |
| Purposeful motion and transitions | design-motion-principles | ui-ux-specialist; frontend-worker implements accepted behavior |
| Existing UI implementation audit | web-design-guidelines | ui-ux-specialist or explicitly selected reviewer |
| Solid reactivity, resources, cleanup, lifecycle | solidjs-engineering | frontend-worker; already preloaded |
| Complex generics/type utilities | typescript-advanced-types | frontend-worker |

Resolve material flow decisions before visual direction and affected implementation.
Do not load both broad visual skills by default, or advanced types for ordinary TS.
For SolidJS, keep Solid framework semantics; general design advice does not authorize
React/Next.js implementation patterns. A design audit is not independent VERIFY.

The specialist remains read-only; frontend-worker owns non-trivial frontend writes.
Pass the approved design or specialist handoff, applicable capabilities, relevant
paths, acceptance checks, and mutation boundary in the global agent packet.
If a required capability is blocked or manual-only, report the actual restriction;
do not invent a substitute or silently waive a project requirement.

For additional optional techniques, search `extended.md` and read only the relevant
section. Archived mandatory wording does not override current global routing policy.
