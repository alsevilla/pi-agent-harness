# Accessible UI Patterns

Use this skill when accessibility is part of the behavior of an interface, not merely a final checklist.

Primary references:
- W3C WCAG 2.2
- WAI-ARIA Authoring Practices Guide (APG)
- web.dev guidance for interaction responsiveness (INP) and motion preferences

This is a **frontend capability**, not a lifecycle owner. The engineering harness still controls Discover, Plan, Execute, Verify, and Review.

## Core Principle

Prefer native HTML behavior first.

Use ARIA to communicate semantics and state when native HTML cannot express the required widget behavior. ARIA does not supply keyboard behavior automatically; custom widgets must implement the expected interaction model.

Accessibility must survive:
- keyboard-only use;
- visible focus;
- screen-reader semantics;
- zoom/reflow;
- high-contrast/forced-color environments where relevant;
- reduced-motion preferences;
- loading/error/empty/disabled states;
- async updates and validation;
- destructive actions and recovery paths.

## 1. Keyboard and Focus

For every interactive flow, determine:

1. What receives focus?
2. How does a keyboard user enter the component?
3. How do they move inside it?
4. How do they activate it?
5. Where does focus go after completion, cancellation, deletion, or dismissal?
6. Is focus always visible and predictable?

Use conventional keyboard behavior for established widgets.

Examples:
- `Tab` / `Shift+Tab` move between components;
- arrow-key navigation is often appropriate inside composite widgets such as menus, tablists, listboxes, trees, and grids;
- closing a dialog should normally restore focus to a logical triggering/continuation element;
- deleting the currently focused row/item must move focus somewhere useful instead of dropping it onto `body`.

Do not confuse:
- keyboard focus;
- selected state;
- hover state;
- active/pressed state.

Do not remove the visible focus indicator without providing an equally or more visible replacement.

## 2. Native Semantics Before ARIA

Prefer:
- `<button>` for actions;
- `<a href>` for navigation;
- `<label>` associated with form controls;
- semantic headings and landmarks;
- native table markup for tabular data.

Avoid clickable generic containers when a semantic element exists.

When ARIA is needed:
- provide correct role;
- expose state/properties;
- provide accessible names/descriptions;
- implement the expected keyboard interaction;
- keep DOM state and visual state synchronized.

ARIA is not a substitute for behavior.

## 3. Forms and Error Recovery

Forms must support successful recovery, not merely detect mistakes.

Require:
- persistent visible labels;
- clear required/optional indication;
- instructions before the user needs them;
- errors associated with the field that caused them;
- an error summary when multiple failures would otherwise be hard to discover;
- focus placement that helps the user reach the error;
- preservation of valid input after validation failure;
- no unnecessary re-entry of information already supplied;
- clear success/confirmation after submission.

For authentication:
- avoid mechanisms that unnecessarily depend on memory, puzzles, or transcription;
- allow password managers and paste where security policy permits;
- do not block assistive technology in the name of security.

For destructive actions:
- make consequences clear;
- distinguish destructive from ordinary actions;
- provide confirmation or undo when the consequence warrants it.

## 4. Target Size and Input

Interactive targets must be large and separated enough to operate reliably.

Do not rely on:
- hover as the only way to reveal required functionality;
- precision dragging as the only available interaction when an alternative can reasonably exist;
- tiny icon-only controls without accessible labels.

Touch target expectations should follow the governing product/platform standard. WCAG 2.2's minimum target-size criterion is a floor, not a design goal.

## 5. Dialogs, Menus, Tabs, Grids, and Tables

Before inventing interaction behavior, check the corresponding WAI-ARIA APG pattern.

For complex components define:
- role and accessible name;
- entry focus;
- internal navigation;
- activation keys;
- escape/cancel behavior;
- focus restoration;
- selection vs focus behavior;
- disabled-item behavior;
- dynamic announcements when state changes.

For data-heavy dashboards:
- preserve real table semantics when the user needs row/column relationships;
- do not convert every table into a generic grid merely to gain arrow-key navigation;
- charts must not rely on color alone and should expose a meaningful textual/tabular alternative when the data matters.

## 6. Motion and Reduced Motion

Motion must explain state, hierarchy, spatial continuity, or feedback.

Respect `prefers-reduced-motion`.

Reduced motion does not always mean "remove every transition"; it means avoid motion that is unnecessary, vestibularly risky, or required to understand/control the interface.

Do not make critical state comprehension depend on animation completing.

## 7. Interaction Responsiveness

Responsiveness is part of UX.

For important interactions:
- provide visible feedback promptly;
- avoid long synchronous event handlers;
- avoid blocking the main thread before the next visual response;
- split or defer heavy non-urgent work when practical;
- avoid interactions that appear dead and encourage duplicate clicks/taps.

Use Interaction to Next Paint (INP) as evidence for responsiveness when web-performance measurement is appropriate.

Performance work remains evidence-driven; do not turn this skill into speculative micro-optimization.

## 8. Async and Live Updates

For loading, saving, background refreshes, queues, and status updates:

- expose meaningful loading/progress state;
- prevent accidental duplicate destructive submissions;
- announce important status changes appropriately;
- do not spam assistive technology with every low-value update;
- preserve focus when content refreshes;
- distinguish disabled, busy, completed, failed, and retryable states.

## 9. Responsive and Zoom Resilience

Check:
- narrow viewport layout;
- text enlargement/zoom;
- wrapping of long labels and translated text;
- no essential information clipped by fixed heights;
- focus not obscured by sticky headers/footers;
- controls remain reachable without two-dimensional scrolling unless the content genuinely requires it.

## 10. Accessibility Review Output

When reviewing, report findings by user impact rather than by abstract rule count.

For each material finding include:
- affected component/flow;
- user impact;
- observable failure;
- applicable principle/pattern;
- recommended correction;
- verification method.

Do not claim conformance from static inspection alone when keyboard, screen-reader, responsive, or interaction behavior was not actually exercised.

## Relationship to Other Frontend Skills

Use this skill as the accessibility/interaction authority when another visual skill conflicts with it.

Typical combinations:
- dashboard accessibility: `design-dashboards` + `accessible-ui-patterns`;
- motion: `design-motion-principles` + `accessible-ui-patterns`;
- new visual direction: `frontend-design` or `ui-ux-pro-max`, then `accessible-ui-patterns` for interaction semantics;
- code audit: `web-design-guidelines` + `accessible-ui-patterns` when deeper keyboard/focus behavior matters.

Do not load every frontend skill for every task.
