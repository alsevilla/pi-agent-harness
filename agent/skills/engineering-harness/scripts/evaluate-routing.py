#!/usr/bin/env python3
"""Offline routing-fixture evaluator (stdlib only; no model, network or provider calls).

Scores explicitly provided routing predictions (JSONL, one object per case) against
examples/routing-cases.json. Passing provided predictions does NOT prove runtime skill
activation; --self-check only proves fixture/evaluator consistency.
Exit: 0 all matched and no critical failure; 1 mismatch or critical failure; 2 invalid input or usage.
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

SCHEMA = "engineering-harness/routing-cases/v1"
ROUTES = frozenset({
    "T0_MAIN", "T1_WORKER", "T2_DEBUG_WORKER", "T3_SPECIALIST_FIRST", "T4_ORACLE_ESCALATION",
    "DISCOVER_SCOUT_FIRST", "LOCAL_DONE", "VERIFY_INDEPENDENT", "REVIEW", "SHIP_AUTHORIZED",
    "BLOCKED_NO_AUTHORITY", "STOP_NO_LAUNCH", "QUEUE_NO_LAUNCH",
})
# Mirrors agent/agents/*.md; tests/test_evaluate_routing.py checks the drift.
ROLES = frozenset({
    "api-specialist", "architecture-specialist", "attendance-domain-specialist", "backend-worker",
    "concurrency-specialist", "debugger", "devops-specialist", "event-reconciliation-specialist",
    "frontend-worker", "general-worker", "hardware-integration", "messaging-specialist",
    "observability-specialist", "oracle", "performance-specialist", "privacy-compliance-specialist",
    "release-engineer", "reviewer", "scout", "security-specialist", "sqlite-specialist",
    "test-engineer", "ui-ux-specialist",
})
KINDS = frozenset({"positive", "near_miss"})
FIXTURE_KEYS = frozenset({"schema", "description", "cases"})
CASE_KEYS = frozenset({"id", "kind", "question", "context", "critical", "expect"})
EXPECT_KEYS = frozenset({"routes", "roles_required", "roles_allowed", "skills_required", "skills_forbidden"})
PRED_KEYS = frozenset({"id", "route", "roles", "skills"})
# Used with fullmatch: a `$` anchor would accept a trailing newline.
ID_RE = re.compile(r"R[0-9]{2,3}")
SKILL_RE = re.compile(r"[a-z0-9][a-z0-9/-]*")
VIOLATION_KINDS = ("route", "role_missing", "role_order", "role_unexpected", "skill_missing", "skill_forbidden")


class RoutingEvalError(ValueError):
    """Invalid fixture, predictions or usage. The evaluator fails closed."""


def _reject_constant(token):
    raise RoutingEvalError(f"non-finite or unsupported JSON constant: {token}")


def _no_duplicate_keys(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            raise RoutingEvalError(f"duplicate JSON key: {key}")
        out[key] = value
    return out


def _loads(text, where):
    try:
        return json.loads(text, parse_constant=_reject_constant, object_pairs_hook=_no_duplicate_keys)
    except json.JSONDecodeError as exc:
        raise RoutingEvalError(f"{where}: malformed JSON ({exc.msg}, line {exc.lineno})") from exc
    except RecursionError as exc:
        raise RoutingEvalError(f"{where}: JSON nesting too deep") from exc


def _obj(value, keys, where):
    if not isinstance(value, dict):
        raise RoutingEvalError(f"{where}: expected object")
    unknown = sorted(set(value) - keys)
    if unknown:
        raise RoutingEvalError(f"{where}: unrecognized fields {unknown}")
    missing = sorted(keys - set(value))
    if missing:
        raise RoutingEvalError(f"{where}: missing fields {missing}")
    return value


def _text(value, where):
    if not isinstance(value, str) or not value.strip():
        raise RoutingEvalError(f"{where}: expected non-empty string")
    return value


def _choice(value, allowed, where):
    if not isinstance(value, str) or value not in allowed:
        raise RoutingEvalError(f"{where}: unknown value {value!r}")
    return value


def _names(value, where, allowed=None, pattern=None, unique=True):
    if not isinstance(value, list) or not all(isinstance(x, str) for x in value):
        raise RoutingEvalError(f"{where}: expected list of strings")
    if unique and len(set(value)) != len(value):
        raise RoutingEvalError(f"{where}: duplicate entries")
    for item in value:
        if allowed is not None and item not in allowed:
            raise RoutingEvalError(f"{where}: unknown value {item!r}")
        if pattern is not None and not pattern.fullmatch(item):
            raise RoutingEvalError(f"{where}: malformed value {item!r}")
    return value


def _covers(router, skill):
    # Path-component boundary: `frontend` covers `frontend/x`, not `frontend-tools`.
    return skill == router or skill.startswith(router + "/")


def parse_fixture(text):
    data = _obj(_loads(text, "fixture"), FIXTURE_KEYS, "fixture")
    if data["schema"] != SCHEMA:
        raise RoutingEvalError(f"fixture: schema must be {SCHEMA}")
    _text(data["description"], "fixture.description")
    cases = data["cases"]
    if not isinstance(cases, list) or not cases:
        raise RoutingEvalError("fixture: cases must be a non-empty list")
    seen = set()
    for index, raw in enumerate(cases):
        case = _obj(raw, CASE_KEYS, f"case[{index}]")
        cid = case["id"]
        if not isinstance(cid, str) or not ID_RE.fullmatch(cid):
            raise RoutingEvalError(f"case[{index}]: malformed id {cid!r}")
        if cid in seen:
            raise RoutingEvalError(f"fixture: duplicate case id {cid}")
        seen.add(cid)
        _choice(case["kind"], KINDS, f"{cid}.kind")
        _text(case["question"], f"{cid}.question")
        _text(case["context"], f"{cid}.context")
        if not isinstance(case["critical"], bool):
            raise RoutingEvalError(f"{cid}.critical: expected boolean")
        exp = _obj(case["expect"], EXPECT_KEYS, f"{cid}.expect")
        if not _names(exp["routes"], f"{cid}.routes", allowed=ROUTES):
            raise RoutingEvalError(f"{cid}.routes: must be non-empty")
        required = _names(exp["roles_required"], f"{cid}.roles_required", allowed=ROLES)
        allowed = _names(exp["roles_allowed"], f"{cid}.roles_allowed", allowed=ROLES)
        if not set(required) <= set(allowed):
            raise RoutingEvalError(f"{cid}: roles_required must be a subset of roles_allowed")
        s_req = _names(exp["skills_required"], f"{cid}.skills_required", pattern=SKILL_RE)
        s_forb = _names(exp["skills_forbidden"], f"{cid}.skills_forbidden", pattern=SKILL_RE)
        if any(_covers(f, r) for f in s_forb for r in s_req):
            raise RoutingEvalError(f"{cid}: a skill cannot be both required and forbidden")
    return data


def parse_predictions(text, case_ids):
    lines = text.splitlines()
    if not lines:
        raise RoutingEvalError("predictions: empty dataset")
    preds = {}
    for number, line in enumerate(lines, 1):
        where = f"predictions line {number}"
        if not line.strip():
            raise RoutingEvalError(f"{where}: blank line")
        rec = _obj(_loads(line, where), PRED_KEYS, where)
        pid = rec["id"]
        if not isinstance(pid, str) or pid not in case_ids:
            raise RoutingEvalError(f"{where}: unknown case id {pid!r}")
        if pid in preds:
            raise RoutingEvalError(f"{where}: duplicate case id {pid}")
        preds[pid] = {
            "route": _choice(rec["route"], ROUTES, f"{where}.route"),
            "roles": _names(rec["roles"], f"{where}.roles", allowed=ROLES, unique=False),
            "skills": _names(rec["skills"], f"{where}.skills", pattern=SKILL_RE),
        }
    missing = sorted(set(case_ids) - set(preds))
    if missing:
        raise RoutingEvalError(f"predictions: missing case ids {missing}")
    return preds


def _in_order(needed, actual):
    rest = iter(actual)
    return all(item in rest for item in needed)


def evaluate(fixture, predictions):
    results, counts, critical_total = [], dict.fromkeys(VIOLATION_KINDS, 0), 0
    for case in fixture["cases"]:
        exp, pred = case["expect"], predictions[case["id"]]
        found = []
        if pred["route"] not in exp["routes"]:
            found.append(("route", f"route {pred['route']} not in {exp['routes']}"))
        missing = [r for r in exp["roles_required"] if r not in pred["roles"]]
        if missing:
            found.append(("role_missing", f"missing roles {missing}"))
        elif not _in_order(exp["roles_required"], pred["roles"]):
            found.append(("role_order", f"roles out of order, required {exp['roles_required']}"))
        extra = [r for r in pred["roles"] if r not in exp["roles_allowed"]]
        if extra:
            found.append(("role_unexpected", f"roles not allowed {extra}"))
        missing_skills = [s for s in exp["skills_required"] if s not in pred["skills"]]
        if missing_skills:
            found.append(("skill_missing", f"missing skills {missing_skills}"))
        forbidden = [s for s in exp["skills_forbidden"] if any(_covers(s, p) for p in pred["skills"])]
        if forbidden:
            found.append(("skill_forbidden", f"forbidden skills selected {forbidden}"))
        # Critical: any miss in a critical case, or any forbidden skill (always critical).
        critical = bool(found) and (case["critical"] or any(k == "skill_forbidden" for k, _ in found))
        for kind, _ in found:
            counts[kind] += 1
        critical_total += 1 if critical else 0
        results.append({"id": case["id"], "matched": not found, "critical_failure": critical,
                        "details": [detail for _, detail in found]})
    total = len(results)
    matched = sum(1 for r in results if r["matched"])
    cases = fixture["cases"]
    return {
        "total": total, "matched": matched, "mismatched": total - matched, "accuracy": matched / total,
        "positive": sum(1 for c in cases if c["kind"] == "positive"),
        "near_miss": sum(1 for c in cases if c["kind"] == "near_miss"),
        "critical_cases": sum(1 for c in cases if c["critical"]),
        "violations": counts, "critical_failures": critical_total,
        "mismatches": [r for r in results if not r["matched"]],
        "ok": matched == total and critical_total == 0,
    }


def format_report(rep, provenance):
    lines = [
        f"provenance: {provenance}",
        f"cases: {rep['total']} (positive {rep['positive']}, near_miss {rep['near_miss']}, critical {rep['critical_cases']})",
        f"matched: {rep['matched']}/{rep['total']} accuracy: {rep['accuracy']:.4f}",
        "violations: " + " ".join(f"{k}={v}" for k, v in rep["violations"].items()),
        f"critical_failures: {rep['critical_failures']}",
    ]
    for m in rep["mismatches"]:
        tag = " [CRITICAL]" if m["critical_failure"] else ""
        lines.append(f"MISMATCH {m['id']}{tag}: " + "; ".join(m["details"]))
    lines.append("RESULT: " + ("PASS" if rep["ok"] else "FAIL"))
    return "\n".join(lines)


def _self_check_predictions(fixture):
    return {c["id"]: {"route": c["expect"]["routes"][0], "roles": list(c["expect"]["roles_required"]),
                      "skills": list(c["expect"]["skills_required"])} for c in fixture["cases"]}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Score recorded routing predictions against the routing fixture (offline).")
    parser.add_argument("--cases", required=True, type=Path, help="routing fixture JSON")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--predictions", type=Path, help="JSONL: one prediction object per case id")
    source.add_argument("--self-check", action="store_true", help="mirror the fixture expectations (consistency only)")
    args = parser.parse_args(argv)
    try:
        fixture = parse_fixture(args.cases.read_text(encoding="utf-8"))
        if args.self_check:
            preds = _self_check_predictions(fixture)
            provenance = ("self-check: fixture expectations mirrored as predictions; fixture consistency only, "
                          "NOT measured model accuracy")
        else:
            raw = args.predictions.read_bytes()
            text = raw.decode("utf-8")
            preds = parse_predictions(text, {c["id"] for c in fixture["cases"]})
            digest = hashlib.sha256(raw).hexdigest()
            provenance = (f"recorded predictions {args.predictions} sha256={digest}; scores provided labels only, "
                          "does NOT prove runtime skill activation")
    except (OSError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    report = evaluate(fixture, preds)
    print(format_report(report, provenance))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
