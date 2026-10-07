# UX Flow & Wireframer

Use this skill to make a user flow understandable **before** visual polish or
source-code implementation.

It is most useful for onboarding, enrollment, setup wizards, approval flows,
multi-step forms, admin workflows, funnels, recovery paths, or an existing flow
with suspected dead ends or redundant steps.

It is not the default for a localized CSS defect, a single component with an
already-defined interaction contract, or a page whose task flow is already
authoritative and unchanged.

## Authority

This is a read-only design/reasoning capability by default.

It does not authorize:
- source mutation;
- repository artifact creation;
- product/business decisions;
- API/backend behavior invention;
- navigation/permission changes merely for UX convenience.

If a durable flow/wireframe document should be written into the repository,
that is a workspace mutation and requires the governing engineering authority.

## Inputs

Prefer authoritative evidence in this order:

1. explicit user/approved product decisions;
2. project requirements and existing behavior;
3. existing routes, forms, states, permissions, and API contracts;
4. supplied research/support/usability evidence;
5. task-specific design references;
6. generic UX heuristics.

Do not invent research, roles, permissions, or backend capabilities.

## Workflow

### 1. Establish the flow contract

Identify, from existing evidence where possible:

- target user and relevant context/device constraints;
- the single primary goal of this flow;
- the observable success condition;
- scope boundaries and known constraints.

If information is genuinely missing, record it as an assumption or open
question. Do not silently manufacture a material product decision.

### 2. Identify entry and exit conditions

List meaningful entry points such as:

- navigation from another product surface;
- deep link;
- notification/action link;
- empty-state CTA;
- first-run/start action.

Define the successful end state and any legitimate non-success exits such as
cancel, save-for-later, permission denial, or escalation.

### 3. Map the happy path

For each step record:

- screen/state name;
- user's intent;
- information needed to proceed;
- dominant primary action;
- relevant secondary/back action.

Challenge steps that neither inform the user nor require a decision/action.

### 4. Map branches and recovery

At each decision/input boundary, consider only states that can actually occur:

- validation failure;
- missing/empty data;
- permission/authorization failure;
- stale/conflicting data;
- partial/degraded result;
- abandonment/cancel;
- back navigation;
- retry/recovery;
- destructive confirmation;
- success/confirmation.

Every recoverable failure path should have an understandable next action.
Do not create dead ends unless the product truly has no valid continuation.

### 5. Produce a flow diagram

Use Mermaid when it improves clarity.

Keep screen/state names identical across the diagram, step table, and
wireframes.

Show user actions on transitions and decisions at branch points.

### 6. Produce low-fidelity wireframes

For each important screen/state, provide a compact text/ASCII wireframe showing:

- reading order;
- key information/content blocks;
- primary action;
- relevant secondary/back actions;
- validation/status placement;
- notes for responsive or accessibility-sensitive structure when material.

Use realistic sample copy when available. Avoid meaningless filler text.

These are structural wireframes, not final visual design.

### 7. Audit the flow

Check:

- number of steps to success;
- inputs that could be deferred or removed;
- redundant confirmation;
- unclear ownership between screens;
- inconsistent naming;
- loops or dead ends;
- missing recovery;
- missing loading/empty/error/success states;
- keyboard/focus implications where interaction structure is material.

### 8. Separate open decisions

List unresolved product decisions separately.

Do not choose for momentum between materially different:
- permissions;
- business rules;
- persistence behavior;
- navigation semantics;
- destructive behavior;
- data requirements;
- external side effects.

Return those to the orchestrator/user authority.

## Output Contract

A useful result normally contains:

1. flow goal, user/context, success condition;
2. assumptions and authoritative constraints;
3. Mermaid flowchart when useful;
4. step table: step, screen/state, intent, primary action, branch/error cases;
5. low-fidelity wireframes for important screens;
6. relevant loading/empty/error/success/recovery states;
7. accessibility/responsive notes where material;
8. open product decisions and unresolved evidence.

## Handoff

After the flow is accepted/sufficiently specified:

- visual direction may use `frontend-design`, `design-dashboards`, or
  `ui-ux-pro-max` as appropriate;
- accessibility-sensitive behavior may use `accessible-ui-patterns`;
- implementation routes to `frontend-worker`;
- independent behavioral evidence and review remain owned by the engineering
  harness.

Do not let visual styling reopen an already-authorized task flow without a
material reason.
