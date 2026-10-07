# SolidJS Engineering

This skill supplies **SolidJS-specific implementation guidance** to
`frontend-worker`.

It is not another frontend writer and does not own UI/UX design decisions.

## Authority

Use after the frontend design gate has been satisfied when a material design
decision exists.

For a localized SolidJS implementation bug, `frontend-worker` may use this
skill directly.

Do not import React, Next.js, React Native, hook, or React Context assumptions.

## Fine-grained reactivity

Solid components are not React render functions that rerun wholesale on every
state change.

Reason about the reactive dependency graph.

Prefer the smallest reactive owner for each value.

## Props

Props are reactive accessors/proxies.

Do not casually destructure or copy reactive props into ordinary locals.

Prefer:
- direct `props.foo` access;
- accessor functions when needed;
- `splitProps` for reactive prop partitioning;
- `mergeProps` for reactive defaults/merging.

Use the `children` helper when repeated child resolution would otherwise create
unexpected behavior.

## Derived values

Prefer `createMemo` for derived reactive values when memoization/change
suppression is useful.

Keep memo calculations pure.

Do not use an effect merely to copy one signal into another derived signal.

## Effects

Use `createEffect` for side effects that react to changing dependencies.

Remember:
- dependencies are discovered from reactive reads;
- the initial effect run is scheduled after the current render phase;
- effects do not run during SSR;
- effect ordering should not be relied upon.

Avoid setting reactive state inside effects unless the design clearly requires
it and feedback-loop risk is understood.

Use more specialized primitives only when their timing semantics are actually
needed.

## Cleanup and ownership

Subscriptions, timers, observers, listeners, and other owned side effects need
cleanup tied to the Solid owner.

Use `onCleanup` where appropriate.

Do not leak event listeners/timers/subscriptions across component disposal.

## Async data

Prefer the project's established data layer.

When using `createResource`, design explicitly for its actual states rather
than treating all non-ready periods as the same spinner.

Consider:
- unresolved/pending;
- ready;
- refreshing;
- errored;
- refetch behavior;
- optimistic/local mutation semantics;
- Suspense/ErrorBoundary integration where used.

Do not hide API contract ambiguity behind resource state.

## Lists

Choose list control flow according to identity semantics.

Use `<For>` when item identity/reordering is the important reactive dimension.

Use `<Index>` when positions are stable and values at those positions change.

Do not choose based only on syntax preference.

## Context and shared state

Use context when cross-tree shared dependencies justify it.

Do not turn all application state into global context.

Preserve repository conventions for stores/signals/resources before
introducing a new state abstraction.

## DOM and lifecycle boundaries

For DOM-dependent work distinguish:
- render-phase timing;
- mount timing;
- effect timing;
- SSR/hydration behavior.

Do not access browser-only APIs during server execution when the project has an
SSR surface.

## Components

Before creating a new component:
- scout existing primitives;
- reuse established design-system components/tokens;
- preserve controlled/uncontrolled/state ownership conventions;
- avoid variant/boolean-prop explosion.

Keep framework-specific engineering separate from visual design decisions.

## TypeScript

Let TypeScript model:
- component props;
- discriminated UI states;
- API contract data;
- event/handler types;
- reusable primitives.

Load `typescript-advanced-types` only when the type problem is genuinely
advanced.

## Testing

Use the project's actual test stack.

For Solid projects, common tools include:
- Vitest;
- `@solidjs/testing-library`;
- Testing Library queries;
- `user-event` for realistic user interaction sequences.

Test observable behavior and state transitions.

When testing effects/reactivity, account for their scheduling semantics rather
than assuming synchronous React-style rerender behavior.

Worker tests do not replace independent Verify.

## Performance

Do not apply React memoization folklore.

Investigate:
- accidental broad reactive dependencies;
- repeated expensive derivation;
- unnecessary resource refetches;
- excessive DOM/list churn;
- event/listener leaks;
- large synchronous work;
- network/resource waterfalls.

Measure user-visible impact.

## Review checklist

Challenge:
- broken prop reactivity from destructuring/copying;
- effect used for derivation;
- missing cleanup;
- stale closure/ownership assumptions;
- incorrect list primitive;
- async states collapsed incorrectly;
- unnecessary global state;
- React patterns transplanted into Solid;
- browser-only behavior crossing SSR boundaries.

## Completion

Return:
- Solid-specific assumptions;
- reactive ownership;
- async/list/lifecycle implications;
- tests/checks run;
- remaining UX/API/design risks.
