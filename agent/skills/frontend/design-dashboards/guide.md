# Design Dashboards

Use this skill to critique, design, redesign, or specify dashboards as working instruments for decisions, not presentation graphics.

Open `references/dashboard-design-principles.md` before any critique, redesign, operational dashboard work, best-practice review, or spec where dashboard judgment matters. It is optional only for straightforward concept sketches that do not require chart, layout, Gestalt, perception, interaction, or visual-encoding reasoning.

## Mode Selection

Choose the narrowest mode that fits the user's request.

If the request involves an operational, real-time, monitoring, queue, incident-response, or other response-oriented dashboard, first choose the normal mode by task, then also apply the Operational Dashboard workflow:

- existing operational dashboard critique: Mode 1 plus Operational Dashboard
- new real-time or operations dashboard: Mode 2 plus Operational Dashboard
- existing operations dashboard redesign: Mode 3 plus Operational Dashboard
- operational dashboard spec: Mode 4 plus Operational Dashboard

### Mode 1: Dashboard Critique And Polish

Use by default when the user provides an existing dashboard, screenshot, wireframe, chart set, or asks whether a dashboard follows best practices. Give quick wins, visual-design misses, Gestalt assessment, strategic concerns, and logical gaps. Do not over-redesign.

Preserve:

- dashboard purpose unless it is clearly broken
- current information architecture where possible
- existing KPIs unless a KPI is visibly misleading
- product constraints and visual language

Focus on purpose, dashboard role, KPI validity, comparison context, chart/layout fit, visual emphasis, interaction behavior, and strategic gaps.

Return:

- **Verdict**
- **What works**
- **Severity-ranked issues**
- **Gestalt assessment**
- **Chart/KPI fixes**
- **Layout, color, and interaction polish**
- **Strategic concerns**
- **What context would change this**
- **Suggested next step**

Use three severity levels:

- **High**: blocks or misleads the dashboard's decision
- **Medium**: slows comprehension or weakens comparison
- **Low**: polish, consistency, or efficiency issue

Done when every major KPI, chart, layout group, color/emphasis pattern, interaction surface, and dashboard-role mismatch has been classified as keep, fix, replace, or out of scope. If the dashboard goal/spec is missing, state assumptions and warn that strategic critique is provisional. The **Suggested next step** must name the Dashboard Spec Grill and give the exact trigger phrase: "Run Dashboard Spec Grill."

### Mode 2: New Dashboard Concept

Use when the user starts from a business problem, requirements, metrics, or a blank slate.

Return 1-3 concepts. When uncertainty is high, give two contrasting concepts: one optimized for monitoring clarity and one optimized for deeper analysis.

For each concept, include:

- **Concept**
- **Best for**
- **Main story**
- **Audience**
- **Key questions answered**
- **Layout**
- **Visuals**
- **Context shown**
- **Color/emphasis**
- **Tradeoffs**
- **What to avoid**

Done when the concept identifies the audience, primary decision, cadence, dashboard role, KPI model, required comparison context, layout zones, visual choices, drill-down/alert behavior, and what stays off the overview. If those inputs are missing and materially affect the concept, ask one clarifying question or run the Dashboard Spec Grill.

### Mode 3: Existing Dashboard Redesign

Use when the user has an existing dashboard but wants to revisit the concept, KPI model, decision flow, or overall structure. Triggers include redesign, rethink, does this dashboard answer the right question, improve the dashboard strategy, rebuild this dashboard, or make this dashboard more useful.

Assess the current dashboard as an input, not as a constraint. Identify what should remain, what should change, and what concept should replace it.

Return:

- **Current job**
- **Mismatch**
- **New dashboard objective**
- **Audience and decisions**
- **KPI model**
- **Proposed structure**
- **Chart and interaction model**
- **Migration from current dashboard**
- **Risks/tradeoffs**

Done when the redesign states what to keep, what to remove, what decision the new dashboard optimizes for, how KPIs change, which charts/interactions replace the old structure, what moves to drill-down, and what migration risk remains. Call out visually polished but strategically weak dashboards directly.

### Mode 4: Dashboard Spec

Use when the user needs a wireframe, panel spec, KPI inventory, KPI-to-chart mapping, implementation-ready dashboard structure, or asks to turn requirements into a dashboard spec.

Produce:

- **Objective**
- **Audience**
- **Dashboard type**
- **KPI inventory**
- **Priority emphasis model**
- **Sections**
- **KPIs and visuals**
- **Thresholds/context**
- **Interactions**
- **Design notes**

Tie recommendations to perception, comparison, and decision support.

Done when every in-scope KPI or section has a recommended placement, comparison context, visual treatment, and interaction or alert behavior where relevant. If key inputs are missing, mark assumptions and unknowns explicitly or run the Dashboard Spec Grill.

## Operating Rules

1. Start with the decision, audience, and cadence before choosing visuals.
2. State assumptions when key inputs are missing, then proceed with a reasonable design.
3. Recommend one direction when options compete.
4. Treat `references/dashboard-design-principles.md` as the single source of truth for dashboard design rules.
5. Do not provide numeric scores or scorecards.
6. Be direct; do not soften clear design failures.
7. Use Gestalt for dashboard coherence: judge grouping, hierarchy, scan path, and figure/ground before local polish.

## Common Inputs

Collect or infer the minimum viable inputs:

- audience and role
- primary decisions or questions
- dashboard type: monitoring, analysis, management, or real-time operational
- key measures, dimensions, comparisons, and time windows
- update frequency and data freshness expectations
- thresholds, targets, benchmarks, or exception rules
- drill-down needs
- screen or form factor constraints
- alert handling needs: acknowledge, mute, reset, freeze/unfreeze, escalation
- what should not be answered on the overview

Ask at most one clarifying question before a quick critique. Ask only when the answer would materially change the critique or structure. Otherwise state assumptions, proceed, and recommend a Dashboard Spec Grill if context is too thin for strategic confidence. Use this exact wording when recommending it: `Run Dashboard Spec Grill`.

## Supporting Workflows

### Dashboard Spec Grill

Use when the user wants deeper dashboard shaping, when a critique lacks enough context for strategic confidence, or when the user asks to grill/spec the dashboard. Explicit triggers include `Run Dashboard Spec Grill`, `Dashboard Spec Grill`, `grill this dashboard`, and `spec this dashboard`. Keep the interview dashboard-specific and stop once the decision model is clear enough to design or critique.

Ask in rounds, not all at once. Cover every Common Input, plus what the dashboard should intentionally not answer.

Done when the audience, decision, cadence, dashboard type, KPI model, comparison context, exception rules, and main drill-downs are known or explicitly marked unknown. Then summarize the spec and recommend the dashboard critique, concept, redesign, or spec mode to use next.

### Operational Dashboard

Use alongside the selected mode when the dashboard is real-time, operational, alerting, response-oriented, or used for monitoring, queues, incidents, SLAs, health, command centers, or triage. Treat status, freshness, thresholds, and response behavior as part of the dashboard's main decision model.

Bias toward:

- simple display media
- sparse, high-salience exceptions
- clear thresholds and current state
- direct access to actionable detail
- quiet all-good states
- stable scan zones during live refresh
- freeze/unfreeze support only when it helps investigation without masking urgent conditions

Explicitly cover:

- status model: normal, warning, critical, stale, unknown, suppressed, and resolved states
- exception conditions, thresholds, severity, recency, and confidence
- owner, next action, escalation path, and expected response time
- acknowledge, assign, mute, reset, freeze/unfreeze, and audit behavior where relevant
- freshness indicators, delayed data states, no-data states, and system-failure states
- what appears automatically vs on click or hover
- how live refresh affects investigation
- drill-down path from status or exception to cause, impacted entity, history, and recent change

Done when every operational status, exception, or response surface has threshold/severity logic, freshness, owner/action, response state, escalation or suppression behavior, and drill-down path accounted for or explicitly marked not applicable.
