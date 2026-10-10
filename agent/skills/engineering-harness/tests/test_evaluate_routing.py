"""Deterministic checks for the offline routing evaluator and its fixture.

These prove evaluator behavior and fixture policy consistency only; they do not
measure model or runtime skill-activation accuracy.
"""
import copy
import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "evaluate-routing.py"
CASES = ROOT / "examples" / "routing-cases.json"
AGENTS_DIR = Path(__file__).resolve().parents[3] / "agents"
SKILLS_DIR = ROOT.parent

spec = importlib.util.spec_from_file_location("evaluate_routing", SCRIPT)
ev = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ev)


def load_fixture():
    return ev.parse_fixture(CASES.read_text(encoding="utf-8"))


def by_id(fixture):
    return {c["id"]: c for c in fixture["cases"]}


def perfect_predictions(fixture):
    rows = []
    for c in fixture["cases"]:
        e = c["expect"]
        rows.append({"id": c["id"], "route": e["routes"][0], "roles": e["roles_required"], "skills": e["skills_required"]})
    return rows


def to_jsonl(rows):
    return "\n".join(json.dumps(r) for r in rows) + "\n"


def evaluate_rows(rows, fixture=None):
    fixture = fixture or load_fixture()
    preds = ev.parse_predictions(to_jsonl(rows), {c["id"] for c in fixture["cases"]})
    return ev.evaluate(fixture, preds)


def set_row(rows, cid, **changes):
    for r in rows:
        if r["id"] == cid:
            r.update(changes)
            return rows
    raise KeyError(cid)


def run_cli(*args):
    return subprocess.run([sys.executable, str(SCRIPT), *args], capture_output=True, text=True, encoding="utf-8")


class FixtureSpecimenTests(unittest.TestCase):
    def test_twenty_three_unique_cases_with_positive_and_near_miss(self):
        fx = load_fixture()
        ids = [c["id"] for c in fx["cases"]]
        self.assertEqual(len(ids), 23)
        self.assertEqual(len(set(ids)), 23)
        kinds = [c["kind"] for c in fx["cases"]]
        self.assertGreaterEqual(kinds.count("near_miss"), 3)
        self.assertGreaterEqual(kinds.count("positive"), 3)

    def test_current_policy_expectations(self):
        c = by_id(load_fixture())
        # known backend -> backend-worker only; Rust guidance not required for a Go service
        self.assertEqual(c["R01"]["expect"]["roles_allowed"], ["backend-worker"])
        self.assertIn("backend/rust-axum-engineering", c["R01"]["expect"]["skills_forbidden"])
        # accepted UI -> frontend-worker; ui-ux-specialist not needed
        self.assertEqual(c["R03"]["expect"]["roles_allowed"], ["frontend-worker"])
        # unresolved UX -> ui-ux-specialist required; frontend-worker only allowed after the decision
        self.assertEqual(c["R04"]["expect"]["roles_required"], ["ui-ux-specialist"])
        self.assertEqual(c["R04"]["expect"]["roles_allowed"], ["ui-ux-specialist", "frontend-worker"])
        # unresolved owner key -> sqlite-specialist required; backend-worker only allowed after the decision
        self.assertEqual(c["R02"]["expect"]["roles_required"], ["sqlite-specialist"])
        self.assertEqual(c["R02"]["expect"]["roles_allowed"], ["sqlite-specialist", "backend-worker"])
        # unknown cause -> debugger before backend-worker
        self.assertEqual(c["R05"]["expect"]["roles_required"], ["debugger", "backend-worker"])
        # standalone mechanical edit: main allowed, worker also valid
        self.assertIn("T0_MAIN", c["R07"]["expect"]["routes"])
        # tooling/docs -> general-worker
        self.assertEqual(c["R08"]["expect"]["roles_required"], ["general-worker"])
        # independent verify and review
        self.assertEqual(c["R09"]["expect"]["roles_required"], ["test-engineer"])
        self.assertEqual(c["R10"]["expect"]["roles_required"], ["reviewer"])
        # publish without authority holds; authorized ship -> release-engineer
        self.assertEqual(c["R20"]["expect"]["routes"], ["BLOCKED_NO_AUTHORITY"])
        self.assertEqual(c["R20"]["expect"]["roles_allowed"], [])
        self.assertEqual(c["R21"]["expect"]["roles_required"], ["release-engineer"])
        # unresolved narrow domain roles; confirmed attendance rule excludes the specialist
        self.assertEqual(c["R16"]["expect"]["roles_required"], ["attendance-domain-specialist"])
        self.assertEqual(c["R17"]["expect"]["roles_required"], ["messaging-specialist"])
        self.assertEqual(c["R18"]["expect"]["roles_required"], ["privacy-compliance-specialist"])
        self.assertNotIn("attendance-domain-specialist", c["R15"]["expect"]["roles_allowed"])
        # scout only for unknown location; no scout when location is supplied
        self.assertEqual(c["R13"]["expect"]["roles_required"], ["scout"])
        self.assertNotIn("scout", c["R14"]["expect"]["roles_allowed"])
        # oracle is exceptional; a passing localized change needs no review or oracle
        self.assertEqual(c["R12"]["expect"]["roles_required"], ["oracle"])
        self.assertEqual(c["R11"]["expect"]["roles_allowed"], [])
        # user stop and queue never launch
        self.assertEqual(c["R22"]["expect"]["roles_allowed"], [])
        self.assertEqual(c["R23"]["expect"]["roles_allowed"], [])
        # frontend keyword in a backend-only task must not select frontend guidance
        self.assertIn("frontend", c["R19"]["expect"]["skills_forbidden"])

    def test_roles_match_current_agent_directory(self):
        self.assertTrue(AGENTS_DIR.is_dir(), f"role registry missing: {AGENTS_DIR}")
        stems = {p.stem for p in AGENTS_DIR.glob("*.md")}
        self.assertEqual(stems, set(ev.ROLES))

    def test_fixture_skill_names_resolve_to_installed_skills(self):
        names = set()
        for c in load_fixture()["cases"]:
            names.update(c["expect"]["skills_required"], c["expect"]["skills_forbidden"])
        self.assertTrue(names)
        for name in sorted(names):
            folder = SKILLS_DIR / name
            self.assertTrue((folder / "SKILL.md").is_file() or (folder / "index.md").is_file(),
                            f"fixture skill not installed: {name}")


class EvaluatorTests(unittest.TestCase):
    def test_perfect_predictions_pass(self):
        rep = evaluate_rows(perfect_predictions(load_fixture()))
        self.assertTrue(rep["ok"])
        self.assertEqual(rep["matched"], 23)
        self.assertEqual(rep["accuracy"], 1.0)
        self.assertEqual(rep["critical_failures"], 0)

    def test_wrong_role_on_critical_case_fails(self):
        fx = load_fixture()
        rows = set_row(perfect_predictions(fx), "R05", roles=["backend-worker"])
        rep = evaluate_rows(rows, fx)
        self.assertFalse(rep["ok"])
        self.assertEqual(rep["violations"]["role_missing"], 1)
        self.assertEqual(rep["critical_failures"], 1)

    def test_unexpected_role_on_noncritical_case_is_mismatch_not_critical(self):
        fx = load_fixture()
        rows = set_row(perfect_predictions(fx), "R14", roles=["scout", "backend-worker"])
        rep = evaluate_rows(rows, fx)
        self.assertEqual(rep["violations"]["role_unexpected"], 1)
        self.assertEqual(rep["mismatched"], 1)
        self.assertEqual(rep["critical_failures"], 0)
        self.assertFalse(rep["ok"])

    def test_forbidden_skill_is_critical_even_on_noncritical_case(self):
        fx = load_fixture()
        self.assertFalse(by_id(fx)["R01"]["critical"])
        rows = set_row(perfect_predictions(fx), "R01", skills=["backend", "backend/rust-axum-engineering"])
        rep = evaluate_rows(rows, fx)
        self.assertEqual(rep["violations"]["skill_forbidden"], 1)
        self.assertEqual(rep["critical_failures"], 1)
        self.assertFalse(rep["ok"])

    def test_single_critical_miss_not_hidden_by_high_aggregate(self):
        fx = load_fixture()
        rows = set_row(perfect_predictions(fx), "R05", route="T1_WORKER", roles=["backend-worker"])
        rep = evaluate_rows(rows, fx)
        self.assertEqual(rep["matched"], 22)
        self.assertGreater(rep["accuracy"], 0.95)
        self.assertEqual(rep["critical_failures"], 1)
        self.assertFalse(rep["ok"])

    def test_swapped_critical_case_labels_both_flagged(self):
        fx = load_fixture()
        rows = perfect_predictions(fx)
        a = next(r for r in rows if r["id"] == "R05")
        b = next(r for r in rows if r["id"] == "R13")
        a["route"], b["route"] = b["route"], a["route"]
        a["roles"], b["roles"] = b["roles"], a["roles"]
        rep = evaluate_rows(rows, fx)
        mismatched = {m["id"] for m in rep["mismatches"]}
        self.assertEqual(mismatched, {"R05", "R13"})
        self.assertEqual(rep["critical_failures"], 1)
        self.assertFalse(rep["ok"])

    def test_role_order_violation_detected(self):
        fx = load_fixture()
        rows = set_row(perfect_predictions(fx), "R05", roles=["backend-worker", "debugger"])
        rep = evaluate_rows(rows, fx)
        self.assertEqual(rep["violations"]["role_order"], 1)
        self.assertEqual(rep["violations"]["role_missing"], 0)

    def test_policy_valid_alternative_route_accepted(self):
        fx = load_fixture()
        rows = set_row(perfect_predictions(fx), "R06", route="T2_DEBUG_WORKER", roles=["debugger", "backend-worker"])
        rep = evaluate_rows(rows, fx)
        self.assertTrue(rep["ok"])

    def test_wrong_route_detected(self):
        fx = load_fixture()
        rows = set_row(perfect_predictions(fx), "R13", route="T1_WORKER", roles=[])
        rep = evaluate_rows(rows, fx)
        self.assertEqual(rep["violations"]["route"], 1)
        self.assertFalse(rep["ok"])

    def test_specialist_only_hold_passes_unresolved_cases(self):
        fx = load_fixture()
        rows = set_row(perfect_predictions(fx), "R02", roles=["sqlite-specialist"])
        rows = set_row(rows, "R04", roles=["ui-ux-specialist"])
        rep = evaluate_rows(rows, fx)
        self.assertTrue(rep["ok"], rep["mismatches"])

    def test_worker_without_specialist_on_unresolved_case_is_critical(self):
        fx = load_fixture()
        rows = set_row(perfect_predictions(fx), "R02", roles=["backend-worker"])
        rep = evaluate_rows(rows, fx)
        self.assertEqual(rep["violations"]["role_missing"], 1)
        self.assertEqual(rep["critical_failures"], 1)

    def test_forbidden_router_rejects_child_skill(self):
        fx = load_fixture()
        rows = set_row(perfect_predictions(fx), "R19", skills=["backend", "frontend/solidjs-engineering"])
        rep = evaluate_rows(rows, fx)
        self.assertEqual(rep["violations"]["skill_forbidden"], 1)
        self.assertEqual(rep["critical_failures"], 1)
        self.assertFalse(rep["ok"])

    def test_sibling_skill_name_not_forbidden_by_router_prefix(self):
        fx = load_fixture()
        rows = set_row(perfect_predictions(fx), "R19", skills=["backend", "frontend-tools"])
        rep = evaluate_rows(rows, fx)
        self.assertEqual(rep["violations"]["skill_forbidden"], 0)
        self.assertTrue(rep["ok"])

    def test_unregistered_but_syntax_valid_predicted_skill_not_rejected(self):
        fx = load_fixture()
        rows = set_row(perfect_predictions(fx), "R19", skills=["backend", "generic/vocabulary-path"])
        self.assertTrue(evaluate_rows(rows, fx)["ok"])


class InputValidationTests(unittest.TestCase):
    def setUp(self):
        self.fx = load_fixture()
        self.ids = {c["id"] for c in self.fx["cases"]}
        self.good = to_jsonl(perfect_predictions(self.fx))

    def assertInvalid(self, text):
        with self.assertRaises(ev.RoutingEvalError):
            ev.parse_predictions(text, self.ids)

    def test_good_text_parses(self):
        self.assertEqual(len(ev.parse_predictions(self.good, self.ids)), 23)

    def test_malformed_json_line(self):
        self.assertInvalid(self.good[:-2] + "\n")  # truncated final object

    def test_missing_case(self):
        self.assertInvalid("\n".join(self.good.splitlines()[:-1]) + "\n")

    def test_duplicate_case(self):
        lines = self.good.splitlines()
        self.assertInvalid("\n".join(lines + [lines[0]]) + "\n")

    def test_unknown_case_id(self):
        self.assertInvalid(self.good + json.dumps({"id": "R99", "route": "T0_MAIN", "roles": [], "skills": []}) + "\n")

    def test_empty_predictions(self):
        self.assertInvalid("")

    def test_blank_interior_line(self):
        lines = self.good.splitlines()
        self.assertInvalid("\n".join(lines[:3] + [""] + lines[3:]) + "\n")

    def test_unrecognized_field(self):
        rec = json.loads(self.good.splitlines()[0])
        rec["confidence"] = 0.9
        self.assertInvalid(json.dumps(rec) + "\n" + "\n".join(self.good.splitlines()[1:]) + "\n")

    def test_wrong_types_fail_closed(self):
        base = json.loads(self.good.splitlines()[0])
        for patch in ({"roles": "backend-worker"}, {"route": True}, {"id": 1}, {"skills": ["ok", 2]}, {"route": "T9_UNKNOWN"}, {"roles": ["not-a-role"]}):
            rec = dict(base, **patch)
            self.assertInvalid(json.dumps(rec) + "\n" + "\n".join(self.good.splitlines()[1:]) + "\n")

    def test_non_finite_constants_rejected(self):
        for token in ("NaN", "Infinity", "-Infinity"):
            text = self.good.replace('"skills": []', '"skills": [' + token + ']', 1)
            self.assertInvalid(text)

    def test_duplicate_json_key_rejected(self):
        first = self.good.splitlines()[0]
        dup = first[:-1] + ', "route": "T0_MAIN"}'
        self.assertInvalid(dup + "\n" + "\n".join(self.good.splitlines()[1:]) + "\n")

    def text_with(self, cid, **changes):
        rows = perfect_predictions(self.fx)
        set_row(rows, cid, **changes)
        return to_jsonl(rows)

    def test_skill_with_trailing_newline_cr_or_noncanonical_is_malformed(self):
        for skill in ("frontend\n", "frontend\r", "frontend\r\n", " frontend", "Frontend"):
            self.assertInvalid(self.text_with("R19", skills=[skill]))

    def test_id_with_trailing_newline_or_cr_is_unknown(self):
        for cid in ("R19\n", "R19\r", " R19"):
            self.assertInvalid(self.text_with("R19", id=cid))

    def test_deeply_nested_json_is_routing_eval_error(self):
        self.assertInvalid("[" * 100000 + "]" * 100000 + "\n")


class FixtureValidationTests(unittest.TestCase):
    def raw(self):
        return json.loads(CASES.read_text(encoding="utf-8"))

    def assertBadFixture(self, data):
        with self.assertRaises(ev.RoutingEvalError):
            ev.parse_fixture(json.dumps(data))

    def test_empty_cases(self):
        d = self.raw()
        d["cases"] = []
        self.assertBadFixture(d)

    def test_duplicate_case_id(self):
        d = self.raw()
        d["cases"][1]["id"] = d["cases"][0]["id"]
        self.assertBadFixture(d)

    def test_critical_must_be_boolean(self):
        d = self.raw()
        d["cases"][0]["critical"] = 1
        self.assertBadFixture(d)

    def test_required_role_must_be_allowed(self):
        d = self.raw()
        d["cases"][0]["expect"]["roles_allowed"] = []
        self.assertBadFixture(d)

    def test_skill_cannot_be_required_and_forbidden(self):
        d = self.raw()
        d["cases"][0]["expect"]["skills_forbidden"] = ["backend"]
        self.assertBadFixture(d)

    def test_unknown_role_in_fixture(self):
        d = self.raw()
        d["cases"][0]["expect"]["roles_allowed"] = ["backend-worker", "backend-wrker"]
        d["cases"][0]["expect"]["roles_required"] = ["backend-wrker"]
        self.assertBadFixture(d)

    def test_unrecognized_top_level_field(self):
        d = self.raw()
        d["extra"] = 1
        self.assertBadFixture(d)

    def test_case_id_with_trailing_newline_is_malformed(self):
        d = self.raw()
        d["cases"][0]["id"] = "R01\n"
        self.assertBadFixture(d)

    def test_skill_name_with_trailing_newline_is_malformed(self):
        d = self.raw()
        d["cases"][0]["expect"]["skills_required"] = ["backend\n"]
        self.assertBadFixture(d)

    def test_required_skill_under_forbidden_router_rejected(self):
        d = self.raw()
        r19 = next(c for c in d["cases"] if c["id"] == "R19")
        r19["expect"]["skills_required"] = ["frontend/solidjs-engineering"]
        self.assertBadFixture(d)

    def test_deeply_nested_fixture_is_routing_eval_error(self):
        with self.assertRaises(ev.RoutingEvalError):
            ev.parse_fixture("[" * 100000 + "]" * 100000)


class CliTests(unittest.TestCase):
    def setUp(self):
        self.fx = load_fixture()
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, name, text):
        p = self.dir / name
        p.write_text(text, encoding="utf-8")
        return str(p)

    def test_perfect_predictions_exit_zero(self):
        p = self.write("pred.jsonl", to_jsonl(perfect_predictions(self.fx)))
        r = run_cli("--cases", str(CASES), "--predictions", p)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("matched: 23/23", r.stdout)
        self.assertIn("RESULT: PASS", r.stdout)
        self.assertIn("does NOT prove runtime skill activation", r.stdout)

    def test_mismatch_exit_one_with_report(self):
        rows = set_row(perfect_predictions(self.fx), "R05", roles=["backend-worker"])
        p = self.write("pred.jsonl", to_jsonl(rows))
        r = run_cli("--cases", str(CASES), "--predictions", p)
        self.assertEqual(r.returncode, 1, r.stderr)
        self.assertIn("MISMATCH R05 [CRITICAL]", r.stdout)
        self.assertIn("RESULT: FAIL", r.stdout)

    def test_invalid_input_exit_two(self):
        p = self.write("bad.jsonl", "{not json}\n")
        r = run_cli("--cases", str(CASES), "--predictions", p)
        self.assertEqual(r.returncode, 2)
        self.assertIn("error:", r.stderr)

    def test_missing_file_exit_two(self):
        r = run_cli("--cases", str(self.dir / "absent.json"), "--self-check")
        self.assertEqual(r.returncode, 2)
        self.assertIn("error:", r.stderr)

    def test_self_check_is_labelled_not_measured(self):
        r = run_cli("--cases", str(CASES), "--self-check")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("NOT measured model accuracy", r.stdout)

    def test_requires_one_input_source(self):
        r = run_cli("--cases", str(CASES))
        self.assertEqual(r.returncode, 2)

    def test_forbidden_child_skill_exit_one_critical(self):
        rows = set_row(perfect_predictions(self.fx), "R19", skills=["backend", "frontend/solidjs-engineering"])
        p = self.write("child.jsonl", to_jsonl(rows))
        r = run_cli("--cases", str(CASES), "--predictions", p)
        self.assertEqual(r.returncode, 1, r.stderr)
        self.assertIn("MISMATCH R19 [CRITICAL]", r.stdout)

    def test_trailing_newline_skill_exit_two(self):
        rows = set_row(perfect_predictions(self.fx), "R19", skills=["backend", "frontend\n"])
        p = self.write("nl.jsonl", to_jsonl(rows))
        r = run_cli("--cases", str(CASES), "--predictions", p)
        self.assertEqual(r.returncode, 2, r.stdout)
        self.assertIn("error:", r.stderr)

    def test_crlf_predictions_hash_raw_bytes(self):
        raw = to_jsonl(perfect_predictions(self.fx)).replace("\n", "\r\n").encode("utf-8")
        p = self.dir / "crlf.jsonl"
        p.write_bytes(raw)
        r = run_cli("--cases", str(CASES), "--predictions", str(p))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("sha256=" + hashlib.sha256(raw).hexdigest(), r.stdout)
        self.assertIn("matched: 23/23", r.stdout)

    def test_utf8_bom_and_invalid_utf8_predictions_exit_two(self):
        body = to_jsonl(perfect_predictions(self.fx)).encode("utf-8")
        for name, raw in (("bom.jsonl", b"\xef\xbb\xbf" + body), ("bad.jsonl", b"\xff" + body)):
            p = self.dir / name
            p.write_bytes(raw)
            r = run_cli("--cases", str(CASES), "--predictions", str(p))
            self.assertEqual(r.returncode, 2, name)
            self.assertIn("error:", r.stderr)

    def test_deeply_nested_predictions_exit_two_without_traceback(self):
        p = self.write("deep.jsonl", "[" * 100000 + "]" * 100000 + "\n")
        r = run_cli("--cases", str(CASES), "--predictions", p)
        self.assertEqual(r.returncode, 2, r.stderr)
        self.assertIn("error:", r.stderr)
        self.assertNotIn("Traceback", r.stderr)
        self.assertNotIn("RESULT:", r.stdout)

    def test_deeply_nested_fixture_exit_two_without_traceback(self):
        p = self.write("deep.json", '{"schema": ' + "[" * 100000 + "]" * 100000 + "}\n")
        r = run_cli("--cases", p, "--self-check")
        self.assertEqual(r.returncode, 2, r.stderr)
        self.assertIn("error:", r.stderr)
        self.assertNotIn("Traceback", r.stderr)
        self.assertNotIn("RESULT:", r.stdout)


if __name__ == "__main__":
    unittest.main()

