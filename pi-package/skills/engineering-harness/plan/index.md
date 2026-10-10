## PLAN procedure
This lifecycle procedure is owned by the **main orchestrator**, not by a leaf specialist.

Use only when sequencing/dependencies/risk justify an explicit execution plan.

Produce:
- scope + acceptance criteria;
- ordered implementation steps;
- writer ownership;
- specialist gates only where justified;
- focused verification;
- rollout/rollback/recovery concerns if relevant.

Architecture analysis may feed PLAN, but `architecture-specialist` does not own PLAN and must not sequence or launch other agents. Main incorporates accepted architectural constraints into the execution plan.

For localized work, skip formal PLAN and send a compact worker packet instead.
Load `references/extended.md` only for complex plans.

Resolve relative references from this module folder. This procedure supplies guidance; main still owns lifecycle sequencing and actual named-agent launches.
