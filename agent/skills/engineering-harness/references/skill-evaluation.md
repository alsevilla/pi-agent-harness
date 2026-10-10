# Routing and skill-selection evaluation (offline)

Read only when measuring or changing routing/skill-selection guidance. This is an optional offline check: it is not a gate, not a runtime hook and not a model caller.

## Components
- Fixture: `examples/routing-cases.json` (schema `engineering-harness/routing-cases/v1`): 23 synthetic cases, 18 positive and 5 near-miss. Expected labels come from the current policy in `agent/AGENTS.md`, `SKILL.md`, `references/routing.md`, and the frontend, backend and rfid-attendance routers when relevant.
- Evaluator: `scripts/evaluate-routing.py` (Python stdlib only; no network, no model calls).
- Tests: `tests/test_evaluate_routing.py` (deterministic unit checks).

## Field meanings
- `route`: the orchestrator's main route label (`T0_MAIN`, `T1_WORKER`, `T2_DEBUG_WORKER`, `T3_SPECIALIST_FIRST`, `T4_ORACLE_ESCALATION`, `DISCOVER_SCOUT_FIRST`, `LOCAL_DONE`, `VERIFY_INDEPENDENT`, `REVIEW`, `SHIP_AUTHORIZED`, `BLOCKED_NO_AUTHORITY`, `STOP_NO_LAUNCH`, `QUEUE_NO_LAUNCH`). It is not a role name.
- `roles`: actual named roles launched, in order.
- `skills`: skills or modules selected for the case, including guidance already loaded earlier in the session. Selection is not a read: the evaluator cannot verify that a skill was read or activated, and a correctly formatted name does not prove activation.
- `expect.routes`: accepted route labels. Policy-valid alternatives are listed explicitly.
- `expect.roles_required`: ordered subsequence that must appear. Order matters (for example `debugger` before `backend-worker`). For unresolved decisions the required role is the specialist only (R02 `sqlite-specialist`, R04 `ui-ux-specialist`); the worker stays in `roles_allowed` for after the decision. Order of allowed-but-not-required roles is not checked, so this does not prove that no write precedes the decision.
- `expect.roles_allowed`: closed set. Any other role is `role_unexpected`.
- `expect.skills_required` / `expect.skills_forbidden`: required and forbidden skill selections. Required names match exactly. A forbidden name also covers its children at a path-component boundary: `frontend` covers `frontend/solidjs-engineering`, not `frontend-tools`. A skill may not be both required and covered by a forbidden name.
- `critical`: any mismatch in a critical case fails the run even when aggregate accuracy is high. Any forbidden skill selection is critical regardless of the flag.

## Predictions format (JSONL)
One object per fixture case, exactly these four fields:

```json
{"id": "R05", "route": "T2_DEBUG_WORKER", "roles": ["debugger", "backend-worker"], "skills": []}
```

Every case id appears exactly once. Blank lines, unknown fields, unknown ids or roles, duplicate JSON keys and `NaN`/`Infinity` are rejected. Ids and skill names are matched in full: a trailing newline, carriage return, leading space or uppercase letter is malformed (exit 2), never stripped. Syntax-valid skill names outside the installed set are accepted as generic vocabulary. The file is never rewritten.

## Commands (run from the candidate root `C:/Users/MSI/.pi`)
- Fixture consistency: `python agent/skills/engineering-harness/scripts/evaluate-routing.py --cases agent/skills/engineering-harness/examples/routing-cases.json --self-check`
- Recorded predictions: `python agent/skills/engineering-harness/scripts/evaluate-routing.py --cases agent/skills/engineering-harness/examples/routing-cases.json --predictions <absolute path to .jsonl>`
- Unit checks: `python -m unittest discover -s agent/skills/engineering-harness/tests -p "test_*.py" -v`

Exit codes: `0` all matched and no critical failure; `1` mismatch or critical failure; `2` invalid input or usage. The report prints a provenance line that separates self-check output from recorded predictions. Its `sha256` is computed over the predictions file's raw bytes (CRLF files included). A UTF-8 BOM or invalid UTF-8 exits 2. JSON nested too deeply for the parser exits 2 with `error:` and no traceback.

## What each result proves
| Input | Proves | Does NOT prove |
|---|---|---|
| `--self-check` | The fixture is internally consistent and the scorer runs | Any model or harness accuracy |
| Hand-written predictions | The scorer's arithmetic and labels as given | That a runtime chose those routes or skills |
| Recorded runtime observations | Agreement between recorded decisions and policy labels for those cases | Activation in other sessions, representativeness, cost or latency |
| Unit tests | Evaluator branches behave as specified | Harness accuracy |

Never report self-check or hand-written results as measured skill-activation accuracy.

## Collecting recorded routing observations (manual, when measuring)
This guide does not run models. An operator runs the fixture questions manually, in their own sessions, and records what was actually observed:
1. Freeze the fixture before running. Do not add or edit cases after seeing results.
2. For each case, record the orchestrator's chosen route, the roles actually launched (from the real launch calls, not intent), and the skills actually read (from tool reads of skill or module paths). A skill already loaded earlier in the same session will not appear as a read; say so rather than counting it as unselected.
3. Record provenance per case: session id, date, model, harness commit, and whether the session was fresh.
4. Write one JSONL predictions file to the assigned `_evidence` path, score it, and keep both the file and the printed report.
5. Report measured results separately from `--self-check` output.

If an operator wants repeated or paid runs, that is an explicit operator action. The evaluator, the tests and this guide never start them.

## Relation to the upstream manual check
The comparison evidence (`_evidence/baryonlabs-harness-comparison/REPORT.md`, row 3) describes an upstream manual skill-trigger guide with 20 queries (10 should-trigger, 10 should-not, near-miss emphasis). That is a human checklist and an optional optimizer concept. Its query set is not this fixture. The 23-case fixture here is derived from this repository's current policy, so the two results are not interchangeable. The upstream optimizer was not adopted, and no upstream text or code was copied.

## Limits
- Expected labels are policy expectations, not ground truth from measurement.
- The case count is small; per-case results are more informative than the aggregate.
- Single-turn questions only; multi-turn routing is not covered.
- LOW, retained: route and roles are scored independently. Route/role consistency is not validated, so `T2_DEBUG_WORKER` without `debugger` (R06) or `T1_WORKER` without `backend-worker` (R07) can still pass. Consistency is a reviewer check; no policy engine was added.
- LOW, retained: predicted skill names are not checked against installed skills (intentional generic vocabulary). The test suite checks only that fixture skill names resolve to an installed `SKILL.md` or `index.md`.
- Order of allowed-but-not-required roles is not checked (see `roles_required`).
- LOW, retained: prediction lines are split with `str.splitlines()`, so a raw U+2028 (or similar line separator) inside a JSON string makes that line malformed. This fails closed (exit 2), never as a false PASS.
- No cost, latency or token measurement.
