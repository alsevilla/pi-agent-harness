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
# Engineering Harness

<SUBAGENT-STOP>

If you were dispatched as a subagent for a specific role or task, do not use this bootstrap to become an orchestrator. Follow your assigned agent role, scope, mutation boundary, and any registered skill explicitly delegated to you.

A subagent must never invoke `Agent` / legacy `Task` or create helper agents. If another role is required, return the need and evidence to the main conversation. Only the main conversation owns delegation and lifecycle sequencing.

</SUBAGENT-STOP>


## Router/Role Separation — Mandatory

This skill is an orchestration entrypoint, not permission for the main session to
perform every engineering role itself.

After choosing a phase, dispatch the dedicated role when that phase has one:

- repository reconnaissance -> `scout` when needed;
- unknown-cause defect -> `debugger` (mandatory);
- non-trivial backend implementation -> `backend-worker`;
- non-trivial frontend implementation -> `frontend-worker`;
- non-trivial general implementation -> `general-worker`;
- independent verification -> `test-engineer`;
- adversarial review -> `reviewer`;
- unresolved specialist-domain decision -> the justified read-only specialist.

The router and lifecycle skills define **how to route and what evidence is
required**. They are not substitutes for the agents above.

If a required agent launch is blocked, return the phase as BLOCKED/UNKNOWN and
report the blocker. Never have the orchestrator impersonate the blocked role.
A blocked agent wrapper showing zero tool uses does not count as role completion.


<IMPORTANT>

For main-session engineering work, this skill is the **mandatory front door**.
Do not treat it as optional documentation and do not bypass it because the next
phase appears obvious.

This entrypoint must:

1. reconstruct the current lifecycle state;
2. invoke the registered lifecycle skill that owns the unresolved state;
3. invoke `frontend` whenever frontend concerns are material;
4. invoke `backend` whenever backend concerns are material;
5. keep all agent creation/sequencing in the main conversation.

Use `references/routing.md` as the routing index when needed.
Invoke registered skills through the Skill mechanism instead of recreating their
procedures from memory.

</IMPORTANT>

## Authority

The governing order remains:

1. user instructions;
2. project-specific instructions and confirmed requirements;
3. global `CLAUDE.md`;
4. agent role definitions and routing decisions;
5. workflow and technical skills.

This bootstrap and the skills catalog cannot weaken a selected skill's gates, TDD requirements, read-only boundaries, candidate identity, Git authority, evidence requirements, or external-action authorization.

Explicitly invoking a skill does not bypass its prerequisites.

## Bootstrap Procedure

1. Reconstruct the user's actual engineering goal and the latest trustworthy lifecycle state.
2. Consult the routing index in `references/routing.md` when needed. Read only applicable extended-policy sections, not the entire appendix.
3. Identify unresolved authority, product, scope, evidence, and candidate-state questions.
4. Select the **single lifecycle skill** that owns the current unresolved state.
5. Prepare the phase task packet and pass prerequisite/authority gates; do not start dedicated role work yet.
6. Detect material domain scope:
   - frontend material -> invoke `Skill(frontend)`;
   - backend material -> invoke `Skill(backend)`;
   - cross-stack -> invoke both, while preserving one lifecycle owner.
7. Let each domain router select only the narrow registered capabilities and specialists actually justified.
8. Invoke the lifecycle skill with the prepared task packet after domain routing. For debug/verify/review this launches the named agent; alternatively dispatch the preloaded named Agent directly. For other required roles issue Agent explicitly. Wait for evidence and preserve one-writer discipline.
9. Delegate with the smallest sufficient task packet; reference authoritative plans/contracts instead of duplicating unrelated context.
10. For delegated isolated writers, preserve the assigned worktree until terminal handoff and require actual write-tool path confinement before mutation.
11. If a writer terminates before handoff, freeze its candidate and explicitly transfer ownership before another writer modifies or commits it.
12. Preserve every unmet completion requirement across that transfer.
13. Stop when the selected lifecycle/domain skill or global policy requires a user decision or separate authorization; do not resolve material product choices merely for momentum.
14. Otherwise continue through compatible internal phases only as allowed by the selected skills and current evidence.

### Router hierarchy

```text
main engineering request
        |
        v
Skill(engineering-harness)       <- mandatory lifecycle front door
        |
        +--> Skill(discover/debug/plan/execute/verify/review/...)
        |
        +--> Skill(frontend)      <- mandatory when frontend is material
        |       +--> narrow frontend capability / frontend roles
        |
        +--> Skill(backend)       <- mandatory when backend is material
                +--> narrow backend capability / backend roles
```

The routers select; they do not implement. Lifecycle skills govern phase
procedure. Domain capabilities govern narrow technical/design procedure. Agents
perform assigned roles under the main orchestrator.

## Non-Negotiable Routing Principles

- Agents are roles, not workflow owners.
- `engineering-harness` is mandatory for main-session engineering work; `frontend` and `backend` are mandatory domain entrypoints when their domains are material.
- Do not bypass a router from the main session by jumping straight to a narrow capability.
- The main session remains the orchestrator.
- TDD remains the default for meaningful behavioral change.
- Diagnose uncertain failures before speculative fixes.
- Worker tests do not replace independent verification.
- Review remains independent.
- Verification/review belong to the exact candidate.
- Worktree isolation does not grant execution authority.
- Worktree `cwd` does not prove tool-level write isolation.
- Blocked/waiting workers retain their assigned worktrees until terminal handoff or explicit abandonment.
- Delegated workers do not mutate the orchestrator/main checkout.
- Material product decisions are never auto-resolved for momentum.
- Worker prompts use the smallest sufficient context without dropping material constraints.
- Any frontend work containing a design/UX decision routes through the read-only `ui-ux-specialist` first, before `frontend-worker` implementation; only already-defined/approved designs and localized implementation/presentation bugs with no design judgment may route directly.
- Terminated-writer changes require explicit ownership adoption before further mutation or commit.
- Tests passing does not erase missing browser, review, verification, or other completion evidence.
- Git and delivery authorities are operation-specific.
- Readiness does not equal delivery authorization.
- External methodologies do not silently replace this harness.

If the required registered procedure is missing, report the installation problem instead of silently approximating the workflow.
