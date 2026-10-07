# design-dashboards

Agent skill for turning vague dashboard asks into decision-focused dashboard critique, concepts, and specs.

`design-dashboards` delivers a practical dashboard design process. Use it when you need to critique an existing dashboard, shape a new one from an operational problem, rethink KPIs and decision flow, or turn a dashboard idea into a KPI, panel, threshold, and drill-down spec. It treats dashboards as working instruments for monitoring, analysis, management, and response, not presentation graphics. It helps you shape a story and tell the user what changed, what matters, or what to do next.

## Install

Install from GitHub with `npx skills`:

```bash
npx skills add dastoyan/skills --skill design-dashboards --agent codex claude-code
```

Install for all supported agents detected locally:

```bash
npx skills add dastoyan/skills --skill design-dashboards --agent '*'
```

## Try It

After installing, ask your agent for one of these:

```text
/design-dashboards critique this dashboard screenshot
```

```text
/design-dashboards Run Dashboard Spec Grill to create a new concept for a real-time contact center dashboard for quality management
```

## Contents

- `SKILL.md`
  - Main skill instructions and operating modes
- `references/dashboard-design-principles.md`
  - Extended dashboard design and critique reference
- `NOTICE.md`
  - Attribution and third-party license notes for this skill
