# Dashboard Design Principles

Design dashboards as working decision tools. Optimize for fast perception, meaningful comparison, and timely action.

## Core Rules

1. Start with the decision, not the chart.
2. Keep the primary overview within one screen when the comparison depends on simultaneous visibility.
3. Show comparison context for important measures: target, prior period, forecast, peer, range, threshold, or status band.
4. Match the display medium to the job: lookup, comparison, trend, relationship, distribution, status, or action.
5. Use position and length for quantitative comparison before color, angle, area, or volume.
6. Encode categories and alerts with restrained visual differences that stay semantically consistent.
7. Group by meaning and task with whitespace, alignment, and proximity before adding borders or containers.
8. Keep important comparisons visible together; avoid hiding the main story behind tabs, scrolling, or filter states.
9. Remove decoration, excessive precision, redundant labels, and controls that compete with the data.
10. Make the scan path obvious and put the highest-priority cues where attention naturally lands first.

## Dashboard Roles

- Strategic dashboards monitor high-level objectives, trends, targets, and exceptions for periodic review.
- Analytical dashboards support diagnosis and exploration; they can carry richer comparisons and drill paths, but the first screen should still orient quickly.
- Operational dashboards support live monitoring and response; they need freshness, severity, ownership, and next action to be visible without interpretation work.

Do not mix roles casually. A dashboard can support more than one role, but each role needs its own cadence, level of detail, interaction model, and definition of done.

## Measures And Context

- Prefer measures that directly represent the user's decision or responsibility.
- Treat a KPI without context as unfinished unless the raw value alone triggers an obvious action.
- Use summaries and exceptions for overview; push transaction-level detail into drill-downs.
- Use only as much precision as the decision requires.
- Show time windows, units, and baselines close to the measure they qualify.
- Distinguish current value, target, variance, trend, forecast, and status; do not collapse them into one ambiguous indicator.

Examples:

- Weak: `Revenue: $3,848,305.93`
- Strong: `Revenue: $3.8M, -9% vs budget, 3-month trend down`
- Weak: `Average handle time: 00:06:42.382`
- Strong: `Average handle time: 6m 42s, +38s vs target, worsening since 10:00`
- Weak: `Actual: $76,934; Budget: $85,000`
- Strong: `Budget variance: -9% (-$8.1K)`

## Common Dashboard Failures

- KPI cards without target, delta, or trend context
- dashboards split across screens, tabs, carousels, or scroll regions when the user needs one overview
- excessive precision, dense transaction detail, or low-value labels on the overview
- measures that are technically accurate but weak proxies for the decision
- too many bright colors competing for attention
- chart types that slow comparison
- gauges, meters, pies, donuts, maps, or decorative visuals used when bars, lines, tables, or small multiples would communicate faster
- fragmented views that hide the main comparison across tabs or filters
- labels, legends, or table formatting that force visual decoding work
- misleading encodings such as truncated bar scales, 3D effects, inconsistent scales, or non-baseline stacked-segment comparisons
- poor arrangement: unrelated proximity, equal emphasis everywhere, weak alignment, or no intended reading order
- important exceptions not highlighted, or highlighted so often that nothing stands out
- decorative imagery, logos, borders, shadows, instructions, and controls taking prime visual space
- operational status or alerts without clear severity, ownership, or next action
- unattractive or inconsistent visual treatment that reduces trust, legibility, or sustained use

## Chart Choice Heuristics

- Use text for single exact values when no pattern or comparison is needed.
- Use tables when exact lookup matters more than pattern detection; mute grid lines and formatting.
- Use bars for ranked or categorical comparison.
- Use horizontal bars when category labels are long or ranked comparison matters.
- Start bar scales at zero unless the design clearly signals a specialized exception.
- Use lines for trends over continuous time.
- Use sparklines when compact trend shape matters more than exact reading.
- Use small multiples when repeated comparisons need the same scale and visual form.
- Use bullet/progress-style views for actual vs target.
- Use scatterplots only when relationship or outlier detection is central and the audience can read them.
- Avoid pies and donuts when precise comparison matters.
- Avoid stacked charts when the comparison target is a non-baseline segment.
- Avoid radial gauges and meters; they consume space and usually encode little more than a compact linear display.
- Avoid 3D charts unless the third dimension represents real data and improves the task, which is rare on dashboards.

Examples:

- Weak: six radial gauges showing actual vs target.
- Strong: six aligned bullet-style measures with target markers and variance labels.
- Weak: a pie chart for region ranking.
- Strong: sorted horizontal bars for region ranking.
- Weak: a dense table for month-by-month trend scanning.
- Strong: compact lines or sparklines next to the measures.
- Weak: stacked bars when the user must compare the middle segment.
- Strong: separate aligned bars or small multiples for the segment being compared.

## Visual Perception

- Design for rapid visual intake, not sequential reading.
- Use preattentive attributes deliberately: position, length, orientation, size, hue, intensity, enclosure, and simple shape.
- Use position and length for precise quantitative decoding.
- Use color, intensity, shape, and enclosure mostly for category, linkage, status, and emphasis.
- Keep the number of competing visual distinctions small enough to remember without a legend hunt.
- Do not require users to compare values that are separated by page state, hidden controls, or unrelated scales.

## Layout And Hierarchy

- Reserve top-left and upper regions for the most important decision cues.
- Use zones with clear semantic grouping.
- Keep overview, explanation, and action flow spatially coherent.
- Avoid equal emphasis on everything.
- Let spacing do most of the grouping work before borders or cards.
- Keep legends, filters, navigation, help text, and branding secondary to the data.
- Prefer stable regions for recurring use: users should learn where to look for status, exceptions, causes, and actions.
- Place related context next to the value it explains; do not make users assemble meaning from distant panels.

## Gestalt In Dashboards

- Proximity: related items should sit together.
- Similarity: repeated visual treatment should imply repeated meaning.
- Enclosure: boxed groups should mean something, not just decorate.
- Closure: use partial structure, whitespace, and axes when they communicate enough; full boxes and heavy grids are often unnecessary.
- Continuity: align elements to support left-to-right or top-to-bottom scanning.
- Connection: lines and links create strong grouping; use them only when the relationship is real and important.
- Figure/Ground: active information must separate clearly from background chrome.

## Color And Emphasis

- Keep a restrained neutral baseline.
- Reserve saturated color for alerts, exceptions, and active focus.
- Prefer one hue with intensity steps over multi-hue severity rainbows.
- Keep semantics stable across the screen.
- Choose colors deliberately for accessibility; do not assume the common red/yellow/green traffic-light palette is readable or sufficient.
- Ensure status and severity work for color-impaired users through labels, icons, position, shape, or intensity in addition to hue.
- Highlight only what needs attention now or anchors the decision flow.
- Use contrast from the local pattern, not just louder styling.
- Avoid red/green-only meaning, decorative palettes, and color legends that users must decode repeatedly.
- For all-good states, keep the dashboard quiet; make exceptions salient by scarcity.

Examples:

- Weak: every KPI card uses a different saturated color.
- Strong: neutral KPI cards, with saturated color only on breached or selected measures.
- Weak: red/yellow/green icons as the only status signal.
- Strong: status text, threshold value, shape or icon, and restrained severity color used consistently.
- Weak: making the logo, navigation, and data all visually loud.
- Strong: muted chrome and branding, with highest contrast reserved for the decision cue.

## Interaction And Usability

- A dashboard is an overview first, not a full application screen.
- Use drill-downs for cause, history, transactions, and remediation details that do not belong in the overview.
- Make clickable data elements preferable to separate button banks when interaction is needed.
- Keep filters and controls compact, predictable, and visually subordinate.
- Do not spend persistent space on instructions that users only need once.
- Validate with real users performing real decisions; aesthetic approval is not the same as dashboard usability.

## Operational Dashboard Requirements

- Show status, freshness, severity, owner, and next action for every actionable exception.
- Represent stale, unknown, suppressed, resolved, and no-data states explicitly.
- Keep refresh behavior stable enough for investigation; avoid moving targets while users are reading.
- Provide escalation and suppression controls only when the workflow needs them and their audit trail is clear.
- Let users move from an exception to cause, impacted entity, recent change, and history without losing the current overview.

Examples:

- Weak: `Queue health: red`
- Strong: `Critical: 18 orders breaching SLA, updated 2m ago, owner: Fulfillment, next action: reassign backlog`
- Weak: live rows reorder while an operator is investigating an incident.
- Strong: new exceptions are flagged while the investigated row stays stable until refresh or release.
- Weak: alert can be muted with no duration, reason, owner, or audit trail.
- Strong: mute requires duration and reason, shows owner, and leaves a visible suppressed state.
