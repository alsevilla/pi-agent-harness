"""Focused stdlib tests for the agent-creation CLI. No model, network or Pi launch."""
import argparse
import contextlib
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "create_agent.py"
EXAMPLE = ROOT / "examples" / "dotnet-worker.json"
TEST_ROOT = os.environ.get("AGENT_CREATION_TEST_ROOT") or None

BASE_SPEC = {
    "name": "dotnet-worker",
    "description": "Implements scoped .NET changes with the native SDK.",
    "instructions": "Work only on the assigned .NET project.",
    "model": "anthropic/claude-haiku-5-5",
    "thinking": "low",
    "fallbackModel": "openai-codex/gpt-6-luna || github-copilot/gpt-6-luna",
}
SKILL = {
    "name": "dotnet-sdk-first",
    "description": "Use the native .NET SDK first when editing .NET projects.",
    "instructions": "Prefer built-in SDK APIs. Add no new packages.",
}


PACKAGED_ROLES = [
    {"name": "reviewer", "provider": "anthropic", "model": "claude-haiku-5-5", "fallbackModel": "", "thinking": "low", "tools": "read"},
    {"name": "scout", "provider": "anthropic", "model": "claude-haiku-5-5", "fallbackModel": "", "thinking": "low", "tools": "read"},
]


def load_module():
    spec = importlib.util.spec_from_file_location("create_agent", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class Case(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp(prefix="agent-creation-test-", dir=TEST_ROOT))
        self.home = self.dir / "home"
        self.agent = self.dir / "agent"
        self.project = self.dir / "project"
        self.links = []
        for d in (self.home, self.agent / "agents", self.agent / "skills", self.project / ".git"):
            d.mkdir(parents=True)
        roles = [{"name": "backend-worker", "provider": "anthropic", "model": "claude-haiku-5-5",
                  "fallbackModel": "openai-codex/gpt-6-luna || github-copilot/gpt-6-luna",
                  "thinking": "low", "tools": "read, grep, find, ls, bash, powershell, edit"}]
        (self.agent / "roles.json").write_text(json.dumps(roles), encoding="utf-8")

    def tearDown(self):
        for link in self.links:
            if os.path.lexists(link):
                try:
                    os.rmdir(link)
                except OSError:
                    os.unlink(link)
        shutil.rmtree(self.dir, ignore_errors=True)

    def make_junction(self, link, target):
        if os.name != "nt":
            self.skipTest("junction checks are Windows-only")
        r = subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(target)], capture_output=True, text=True)
        if r.returncode != 0:
            self.fail(f"junction creation failed: {r.stdout}{r.stderr}")
        self.links.append(link)

    def make_symlink(self, link, target):
        try:
            os.symlink(target, link, target_is_directory=True)
        except OSError as exc:
            self.skipTest(f"NOT RUN: symlink privilege unavailable ({exc.strerror})")
        self.links.append(link)

    def env(self, **extra):
        env = {k: v for k, v in os.environ.items() if k != "PI_CODING_AGENT_DIR"}
        tmp = self.dir / "tmp"
        tmp.mkdir(exist_ok=True)
        env.update(PYTHONDONTWRITEBYTECODE="1", PYTHONIOENCODING="utf-8", HOME=str(self.home),
                   USERPROFILE=str(self.home), TEMP=str(tmp), TMP=str(tmp))
        env.update(extra)
        return env

    def spec(self, **over):
        data = dict(BASE_SPEC)
        data.update(over)
        return data

    def cli(self, spec, *extra, env=None, project=None, agent=True):
        spec_path = self.dir / "spec.json"
        spec_path.write_text(spec if isinstance(spec, str) else json.dumps(spec), encoding="utf-8")
        args = [sys.executable, str(SCRIPT), "--spec", str(spec_path), "--project-root", str(project or self.project)]
        if agent:
            args += ["--agent-dir", str(self.agent)]
        args += list(extra)
        return subprocess.run(args, capture_output=True, text=True, encoding="utf-8",
                              env=env or self.env(), timeout=60)

    def agent_file(self, name="dotnet-worker"):
        return self.project / ".pi" / "agents" / f"{name}.md"

    def skill_file(self, name="dotnet-sdk-first"):
        return self.project / ".pi" / "skills" / name / "SKILL.md"

    def tools_of(self, text):
        line = [l for l in text.splitlines() if l.startswith("tools: ")][0]
        return [t.strip() for t in json.loads(line[len("tools: "):]).split(",")]


class PreviewAndCreation(Case):
    def test_preview_is_default_and_writes_nothing(self):
        r = self.cli(self.spec(skill=SKILL))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("no files written", r.stdout)
        self.assertIn('name: "dotnet-worker"', r.stdout)
        self.assertFalse((self.project / ".pi").exists())

    def test_apply_creates_agent_and_optional_skill(self):
        r = self.cli(self.spec(skill=SKILL), "--apply")
        self.assertEqual(r.returncode, 0, r.stderr)
        agent = self.agent_file().read_text(encoding="utf-8")
        self.assertTrue(agent.startswith('---\nname: "dotnet-worker"\n'))
        self.assertIn('\nmodel: "anthropic/claude-haiku-5-5"\n', agent)
        skill = self.skill_file().read_text(encoding="utf-8")
        self.assertTrue(skill.startswith('---\nname: "dotnet-sdk-first"\n'))
        self.assertIn("created: ", r.stdout)

    def test_apply_without_skill_creates_no_skill_directory(self):
        r = self.cli(self.spec(), "--apply")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue(self.agent_file().exists())
        self.assertFalse((self.project / ".pi" / "skills").exists())

    def test_agent_body_reads_absolute_skill_path(self):
        r = self.cli(self.spec(skill=SKILL), "--apply")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn(str(self.skill_file()), self.agent_file().read_text(encoding="utf-8"))

    def test_generated_frontmatter_round_trips_metadata(self):
        mod = load_module()
        tricky = self.spec(description='Quotes "x", back\\slash, colon: hash # and unicode \u00e9', thinking="low")
        r = self.cli(tricky, "--apply")
        self.assertEqual(r.returncode, 0, r.stderr)
        data = mod.parse_frontmatter_subset(self.agent_file().read_bytes().decode("utf-8"))
        self.assertEqual(data["name"], "dotnet-worker")
        self.assertEqual(data["description"], tricky["description"])
        self.assertEqual(data["model"], "anthropic/claude-haiku-5-5")
        self.assertEqual(data["thinking"], "low")
        self.assertEqual(data["tools"], "read, grep, find, ls")

    def test_skill_frontmatter_round_trips_metadata(self):
        mod = load_module()
        skill = dict(SKILL, description='Use "SDK" first: back\\slash # not a comment')
        r = self.cli(self.spec(skill=skill), "--apply")
        self.assertEqual(r.returncode, 0, r.stderr)
        data = mod.parse_frontmatter_subset(self.skill_file().read_bytes().decode("utf-8"))
        self.assertEqual(data["name"], skill["name"])
        self.assertEqual(data["description"], skill["description"])

    def test_example_spec_needs_explicit_grants_then_previews(self):
        spec = json.loads(EXAMPLE.read_text(encoding="utf-8"))
        self.assertEqual(spec["name"], "dotnet-worker")
        r = self.cli(json.dumps(spec))
        self.assertEqual(r.returncode, 1)
        r = self.cli(json.dumps(spec), "--allow-writers", "--allow-shell")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("powershell", r.stdout)
        self.assertFalse((self.project / ".pi").exists())

    def test_maximum_length_name_is_accepted(self):
        r = self.cli(self.spec(name="a" * 64))
        self.assertEqual(r.returncode, 0, r.stderr)


class StrictSpec(Case):
    def test_unknown_key_refused(self):
        r = self.cli(self.spec(extra=1))
        self.assertEqual(r.returncode, 1)
        self.assertIn("unknown", r.stderr)

    def test_duplicate_key_refused(self):
        raw = '{"name":"dotnet-worker","name":"other","description":"d","instructions":"i","model":"m"}'
        r = self.cli(raw)
        self.assertEqual(r.returncode, 1)
        self.assertIn("duplicate", r.stderr)

    def test_malformed_json_refused(self):
        r = self.cli('{"name":')
        self.assertEqual(r.returncode, 1)
        self.assertIn("invalid JSON", r.stderr)

    def test_bom_prefixed_spec_refused(self):
        r = self.cli("\ufeff" + json.dumps(self.spec()))
        self.assertEqual(r.returncode, 1)

    def test_nonfinite_numbers_refused(self):
        for token in ("NaN", "Infinity", "-Infinity"):
            with self.subTest(token=token):
                raw = '{"name":"dotnet-worker","description":"d","instructions":"i","model":"m","thinking":' + token + "}"
                r = self.cli(raw)
                self.assertEqual(r.returncode, 1)
                self.assertIn("nonfinite", r.stderr)

    def test_wrong_types_refused(self):
        cases = {
            "writer-string": {"writer": "true"}, "writer-int": {"writer": 1}, "writer-null": {"writer": None},
            "shell-true": {"shell": True}, "shell-sh": {"shell": "sh"}, "shell-cmd": {"shell": "cmd"},
            "shell-upper": {"shell": "BASH"}, "shell-empty": {"shell": ""}, "shell-int": {"shell": 0},
            "model-int": {"model": 5}, "model-null": {"model": None}, "model-list": {"model": []},
            "instructions-list": {"instructions": ["a"]}, "thinking-int": {"thinking": 1},
            "fallback-list": {"fallbackModel": ["a"]}, "skill-string": {"skill": "x"},
            "name-int": {"name": 5}, "name-null": {"name": None},
        }
        for label, over in cases.items():
            with self.subTest(case=label):
                r = self.cli(self.spec(**over), "--allow-writers", "--allow-shell")
                self.assertEqual(r.returncode, 1, r.stdout)

    def test_missing_required_fields_refused(self):
        for key in ("name", "description", "instructions", "model"):
            with self.subTest(missing=key):
                data = self.spec()
                del data[key]
                self.assertEqual(self.cli(data).returncode, 1)

    def test_invalid_names_refused_before_any_output(self):
        names = ["", " dotnet", "Dotnet", "dotnet--worker", "-dotnet", "dotnet-", "dot.net", "dot_net",
                 "../x", "a/b", "a\\b", "con", "nul", "com1", "lpt9", "x" * 65, "dotnet worker"]
        for name in names:
            with self.subTest(name=name):
                r = self.cli(self.spec(name=name, skill=SKILL), "--apply")
                self.assertEqual(r.returncode, 1, r.stdout)
                self.assertFalse((self.project / ".pi").exists())

    def test_control_and_whitespace_metadata_refused(self):
        bad = ["a\nb", "a\tb", "a\x01b", "a\x85b", "a\u2028b", "a\u0000b", " lead", "trail ", ""]
        for field in ("description", "thinking", "model", "fallbackModel"):
            for value in bad:
                with self.subTest(field=field, value=repr(value)):
                    r = self.cli(self.spec(**{field: value}))
                    self.assertEqual(r.returncode, 1, r.stdout)
        r = self.cli(self.spec(description="x" * 1025))
        self.assertEqual(r.returncode, 1)
        for value in ("a\rb", "a\x00b"):
            with self.subTest(instructions=repr(value)):
                self.assertEqual(self.cli(self.spec(instructions=value)).returncode, 1)

    def test_skill_object_is_strict(self):
        cases = [dict(SKILL, extra=1), {k: v for k, v in SKILL.items() if k != "description"},
                 dict(SKILL, name="Bad_Name"), dict(SKILL, instructions="")]
        for skill in cases:
            with self.subTest(skill=sorted(skill)):
                self.assertEqual(self.cli(self.spec(skill=skill)).returncode, 1)

    def test_usage_error_exits_2(self):
        r = subprocess.run([sys.executable, str(SCRIPT)], capture_output=True, text=True, env=self.env())
        self.assertEqual(r.returncode, 2)


class Permissions(Case):
    def test_writer_requires_exact_true_and_flag(self):
        r = self.cli(self.spec(writer=True), "--apply")
        self.assertEqual(r.returncode, 1)
        self.assertIn("--allow-writers", r.stderr)
        self.assertFalse((self.project / ".pi").exists())
        self.assertEqual(self.cli(self.spec(writer="true")).returncode, 1)
        self.assertEqual(self.cli(self.spec(writer=True), "--allow-writers").returncode, 0)

    def test_shell_requires_literal_value_and_flag(self):
        self.assertEqual(self.cli(self.spec(shell="bash")).returncode, 1)
        self.assertEqual(self.cli(self.spec(shell="bash"), "--allow-writers").returncode, 1)
        r = self.cli(self.spec(shell="bash"), "--allow-shell")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("bash", r.stdout)

    def test_flags_alone_grant_nothing(self):
        r = self.cli(self.spec(), "--allow-writers", "--allow-shell", "--apply")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.tools_of(self.agent_file().read_text(encoding="utf-8")), ["read", "grep", "find", "ls"])

    def test_granted_tools_are_read_only_plus_edit_and_shell_only(self):
        r = self.cli(self.spec(writer=True, shell="powershell"), "--allow-writers", "--allow-shell", "--apply")
        self.assertEqual(r.returncode, 0, r.stderr)
        tools = self.tools_of(self.agent_file().read_text(encoding="utf-8"))
        self.assertEqual(set(tools), {"read", "grep", "find", "ls", "edit", "powershell"})
        for forbidden in ("write", "subagent", "mcp", "serena", "bash"):
            self.assertFalse(any(forbidden in t for t in tools), forbidden)


class ModelPreservation(Case):
    def test_model_fallback_and_thinking_preserved_verbatim(self):
        spec = self.spec(model="claude-sonnet-5.5", fallbackModel="openai-codex/gpt-6-luna||github-copilot/gpt-6-luna",
                         thinking="high")
        r = self.cli(spec, "--apply")
        self.assertEqual(r.returncode, 0, r.stderr)
        text = self.agent_file().read_text(encoding="utf-8")
        self.assertIn('\nmodel: "claude-sonnet-5.5"\n', text)
        self.assertIn('\nfallbackModel: "openai-codex/gpt-6-luna||github-copilot/gpt-6-luna"\n', text)
        self.assertIn('\nthinking: "high"\n', text)

    def test_absent_optional_fields_are_omitted(self):
        spec = {k: v for k, v in BASE_SPEC.items() if k not in ("thinking", "fallbackModel")}
        r = self.cli(spec, "--apply")
        self.assertEqual(r.returncode, 0, r.stderr)
        text = self.agent_file().read_text(encoding="utf-8")
        self.assertNotIn("thinking:", text)
        self.assertNotIn("fallbackModel:", text)

    def test_roles_registry_is_not_modified(self):
        before = (self.agent / "roles.json").read_bytes()
        self.assertEqual(self.cli(self.spec(), "--apply").returncode, 0)
        self.assertEqual((self.agent / "roles.json").read_bytes(), before)


class Overwrite(Case):
    def test_repeat_identical_is_unchanged(self):
        self.assertEqual(self.cli(self.spec(skill=SKILL), "--apply").returncode, 0)
        first = self.agent_file().read_bytes(), self.skill_file().read_bytes()
        r = self.cli(self.spec(skill=SKILL), "--apply")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("unchanged: ", r.stdout)
        self.assertEqual((self.agent_file().read_bytes(), self.skill_file().read_bytes()), first)

    def test_differing_existing_agent_refused_not_overwritten(self):
        self.agent_file().parent.mkdir(parents=True)
        self.agent_file().write_bytes(b"different\n")
        r = self.cli(self.spec(skill=SKILL), "--apply")
        self.assertEqual(r.returncode, 1)
        self.assertEqual(self.agent_file().read_bytes(), b"different\n")
        self.assertFalse(self.skill_file().exists())

    def test_collision_on_skill_blocks_agent_creation(self):
        self.skill_file().parent.mkdir(parents=True)
        self.skill_file().write_bytes(b"other\n")
        r = self.cli(self.spec(skill=SKILL), "--apply")
        self.assertEqual(r.returncode, 1)
        self.assertFalse(self.agent_file().exists())
        self.assertEqual(self.skill_file().read_bytes(), b"other\n")

    def test_adding_skill_to_existing_agent_changes_bytes_and_is_refused(self):
        self.assertEqual(self.cli(self.spec(), "--apply").returncode, 0)
        before = self.agent_file().read_bytes()
        r = self.cli(self.spec(skill=SKILL), "--apply")
        self.assertEqual(r.returncode, 1, r.stderr)
        self.assertIn("will not be overwritten", r.stderr)
        self.assertEqual(self.agent_file().read_bytes(), before)
        self.assertFalse(self.skill_file().exists())


class Collisions(Case):
    def write_file(self, path, text):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(text.encode("utf-8"))

    def assert_refused_no_output(self, r):
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertFalse((self.project / ".pi").exists())

    def test_global_role_name_refused_case_insensitively(self):
        r = self.cli(self.spec(name="backend-worker"), "--apply")
        self.assert_refused_no_output(r)

    def test_global_agent_stem_refused(self):
        self.write_file(self.agent / "agents" / "dotnet-worker.md", "---\nname: other\ndescription: d\n---\nbody\n")
        self.assert_refused_no_output(self.cli(self.spec(), "--apply"))

    def test_global_frontmatter_name_refused_when_stem_differs(self):
        self.write_file(self.agent / "agents" / "elsewhere.md", "---\nname: dotnet-worker\ndescription: d\n---\nbody\n")
        self.assert_refused_no_output(self.cli(self.spec(), "--apply"))

    def test_project_agent_collision_refused(self):
        self.write_file(self.project / ".pi" / "agents" / "other.md", "---\nname: dotnet-worker\ndescription: d\n---\nb\n")
        r = self.cli(self.spec(skill=SKILL), "--apply")
        self.assertEqual(r.returncode, 1)
        self.assertFalse(self.skill_file().exists())

    def test_supported_name_spellings_are_detected(self):
        spellings = ['name: "dotnet\\u002dworker"', "name: 'dotnet-worker'", "name: dotnet-worker",
                     'name: "DOTNET-worker"']
        for i, line in enumerate(spellings):
            with self.subTest(line=line):
                self.write_file(self.agent / "agents" / f"spelling{i}.md", "---\n" + line + "\ndescription: d\n---\nb\n")
                self.assertEqual(self.cli(self.spec(), "--apply").returncode, 1)
                (self.agent / "agents" / f"spelling{i}.md").unlink()

    def test_unsupported_frontmatter_refused_before_writes(self):
        cases = {
            "hex-escape": 'name: "dotnet\\x2dworker"',
            "anchor": "name: &a dotnet-worker",
            "alias": "name: *a",
            "duplicate-name": "name: a\nname: dotnet-worker",
            "quoted-key": '"name": dotnet-worker',
            "block-scalar": "name: |\n  dotnet-worker",
            "colon-plain": "name: a: b",
            "numeric-plain": "name: 123",
            "tag": "name: !!str dotnet-worker",
            "flow-sequence": "name: [dotnet-worker]",
        }
        for label, line in cases.items():
            with self.subTest(case=label):
                self.write_file(self.agent / "agents" / "odd.md", "---\n" + line + "\ndescription: d\n---\nb\n")
                self.assert_refused_no_output(self.cli(self.spec(skill=SKILL), "--apply"))
                (self.agent / "agents" / "odd.md").unlink()

    def test_ancestor_project_agents_shadow_warning_and_collision(self):
        outer = self.dir / "outer"
        inner = outer / "inner"
        (inner / ".git").mkdir(parents=True)
        self.write_file(outer / ".pi" / "agents" / "ancestor.md", "---\nname: ancestor-agent\ndescription: d\n---\nb\n")
        r = self.cli(self.spec(), project=inner)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("shadow", r.stdout)
        self.write_file(outer / ".pi" / "agents" / "ancestor.md", "---\nname: dotnet-worker\ndescription: d\n---\nb\n")
        self.assertEqual(self.cli(self.spec(), project=inner).returncode, 1)

    def test_skill_name_from_skill_md_not_only_dirname(self):
        self.write_file(self.agent / "skills" / "unrelated-dir" / "SKILL.md",
                        "---\nname: dotnet-sdk-first\ndescription: d\n---\nb\n")
        self.assertEqual(self.cli(self.spec(skill=SKILL), "--apply").returncode, 1)
        self.assertFalse(self.agent_file().exists())

    def test_skill_dirname_reserved_when_frontmatter_name_differs(self):
        self.write_file(self.agent / "skills" / "dotnet-sdk-first" / "SKILL.md",
                        "---\nname: other-name\ndescription: d\n---\nb\n")
        self.assertEqual(self.cli(self.spec(skill=SKILL), "--apply").returncode, 1)
        self.assertEqual(self.cli(self.spec(skill=dict(SKILL, name="other-name")), "--apply").returncode, 1)

    def test_project_agents_skills_root_collision_refused(self):
        self.write_file(self.project / ".agents" / "skills" / "dotnet-sdk-first" / "SKILL.md",
                        "---\nname: dotnet-sdk-first\ndescription: d\n---\nb\n")
        self.assertEqual(self.cli(self.spec(skill=SKILL), "--apply").returncode, 1)
        self.assertFalse(self.agent_file().exists())

    def test_unsupported_skill_frontmatter_refused(self):
        self.write_file(self.agent / "skills" / "odd" / "SKILL.md", "---\nname: |\n  x\n---\nb\n")
        self.assertEqual(self.cli(self.spec(skill=SKILL), "--apply").returncode, 1)


class PathRefusals(Case):
    def test_dot_dot_root_segment_refused(self):
        r = self.cli(self.spec(), project=Path(str(self.project) + os.sep + ".." + os.sep + "project"))
        self.assertEqual(r.returncode, 1, r.stderr)
        self.assertIn("..", r.stderr)
        self.assertFalse((self.project / ".pi").exists())

    def test_project_root_inside_global_agent_dir_refused(self):
        inner = self.agent / "projects" / "p"
        (inner / ".git").mkdir(parents=True)
        r = self.cli(self.spec(), project=inner)
        self.assertEqual(r.returncode, 1, r.stderr)
        self.assertIn("global agent directory", r.stderr)
        self.assertFalse((inner / ".pi").exists())

    def test_agent_dir_precedence_flag_over_environment(self):
        env = self.env(PI_CODING_AGENT_DIR=str(self.project / ".pi"))
        r = self.cli(self.spec(), agent=False, env=env)
        self.assertEqual(r.returncode, 1, r.stdout)
        r = self.cli(self.spec(), env=env)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_relative_or_missing_project_root_refused(self):
        r = self.cli(self.spec(), project=Path("relative-project"))
        self.assertEqual(r.returncode, 1)
        self.assertIn("absolute", r.stderr)
        self.assertEqual(self.cli(self.spec(), project=self.dir / "missing").returncode, 1)

    def test_junction_root_and_ancestor_refused(self):
        link = self.dir / "jroot"
        self.make_junction(link, self.project)
        self.assertEqual(self.cli(self.spec(), project=link).returncode, 1)
        (self.project / "child").mkdir()
        self.assertEqual(self.cli(self.spec(), project=link / "child").returncode, 1)
        self.assertFalse((self.project / ".pi").exists())

    def test_junction_pi_dir_refused_and_target_untouched(self):
        target = self.dir / "elsewhere"
        target.mkdir()
        self.make_junction(self.project / ".pi", target)
        r = self.cli(self.spec(skill=SKILL), "--apply")
        self.assertEqual(r.returncode, 1, r.stderr)
        self.assertEqual(list(target.iterdir()), [])

    def test_junction_agents_dir_refused_and_target_untouched(self):
        target = self.dir / "elsewhere"
        target.mkdir()
        (self.project / ".pi").mkdir()
        self.make_junction(self.project / ".pi" / "agents", target)
        r = self.cli(self.spec(skill=SKILL), "--apply")
        self.assertEqual(r.returncode, 1, r.stderr)
        self.assertEqual(list(target.iterdir()), [])
        self.assertFalse(self.skill_file().exists())

    def test_junction_skills_dir_blocks_all_outputs(self):
        target = self.dir / "elsewhere"
        target.mkdir()
        (self.project / ".pi" / "agents").mkdir(parents=True)
        self.make_junction(self.project / ".pi" / "skills", target)
        r = self.cli(self.spec(skill=SKILL), "--apply")
        self.assertEqual(r.returncode, 1, r.stderr)
        self.assertFalse(self.agent_file().exists())
        self.assertEqual(list(target.iterdir()), [])

    def test_symlink_pi_dir_refused_when_privilege_available(self):
        target = self.dir / "elsewhere"
        target.mkdir()
        self.make_symlink(self.project / ".pi", target)
        self.assertEqual(self.cli(self.spec(), "--apply").returncode, 1)
        self.assertEqual(list(target.iterdir()), [])


class PartialFailure(Case):
    def test_late_io_failure_reports_created_without_deletes(self):
        mod = load_module()
        real_write = mod._create_exclusive
        calls = []

        def flaky(path, data):
            calls.append(str(path))
            if len(calls) == 2:
                raise OSError("injected late write failure")
            return real_write(path, data)

        spec_path = self.dir / "spec.json"
        spec_path.write_text(json.dumps(self.spec(skill=SKILL)), encoding="utf-8")
        argv = ["--spec", str(spec_path), "--project-root", str(self.project),
                "--agent-dir", str(self.agent), "--apply"]
        saved = {k: os.environ.get(k) for k in ("HOME", "USERPROFILE")}
        os.environ["HOME"] = os.environ["USERPROFILE"] = str(self.home)
        out, err = io.StringIO(), io.StringIO()
        mod._create_exclusive = flaky
        try:
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                code = mod.main(argv)
        finally:
            for k, v in saved.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v
        self.assertEqual(code, 3, err.getvalue())
        self.assertEqual(len(calls), 2)
        self.assertTrue(self.agent_file().exists())
        self.assertFalse(self.skill_file().exists())
        self.assertIn("created: " + str(self.agent_file()), out.getvalue())
        self.assertIn("uncreated: " + str(self.skill_file()), out.getvalue())


class MultiSpaceMetadata(Case):
    def write_file(self, path, text):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(text.encode("utf-8"))

    def test_parser_strips_value_spaces_before_scalar_rules(self):
        parse = load_module().parse_frontmatter_subset
        self.assertEqual(parse("---\nname: newbie\n---\n")["name"], "newbie")
        self.assertEqual(parse("---\nname:  newbie  \n---\n")["name"], "newbie")
        self.assertEqual(parse('---\nname:   "dotnet-worker"\n---\n')["name"], "dotnet-worker")
        self.assertEqual(parse("---\nname:  'dotnet-worker'\n---\n")["name"], "dotnet-worker")
        self.assertEqual(parse('---\nname:  "a  b"\n---\n')["name"], "a  b")
        mod = load_module()
        for line in ("name:  123", "name:     true", "name:  ~", "name:  !!str x", "name:  [a]", "name:  &a x"):
            with self.subTest(line=line):
                with self.assertRaises(mod.Unsupported):
                    mod.parse_frontmatter_subset("---\n" + line + "\n---\n")

    def test_multi_space_name_collides_in_every_scanned_location(self):
        cases = {
            "global agent, stem differs": (self.agent / "agents" / "elsewhere.md", "name:  dotnet-worker"),
            "global agent, five spaces quoted": (self.agent / "agents" / "quoted.md", 'name:     "dotnet-worker"'),
            "project agent, five spaces": (self.project / ".pi" / "agents" / "other.md", "name:     dotnet-worker"),
            "global skill SKILL.md": (self.agent / "skills" / "unrelated-dir" / "SKILL.md", "name:  dotnet-sdk-first"),
            "project skill SKILL.md": (self.project / ".agents" / "skills" / "elsewhere" / "SKILL.md", "name:  dotnet-sdk-first"),
        }
        for label, (path, line) in cases.items():
            with self.subTest(label=label):
                self.write_file(path, "---\n" + line + "\ndescription: d\n---\nb\n")
                r = self.cli(self.spec(skill=SKILL), "--apply")
                self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
                self.assertFalse(self.agent_file().exists())
                path.unlink()

    def test_single_space_control_still_applies(self):
        self.write_file(self.agent / "agents" / "control.md", "---\nname: unrelated-agent\ndescription: d\n---\nb\n")
        r = self.cli(self.spec(), "--apply")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue(self.agent_file().exists())

    def test_multi_space_typed_scalar_refused(self):
        self.write_file(self.agent / "agents" / "typed.md", "---\nname:     true\ndescription: d\n---\nb\n")
        self.assertEqual(self.cli(self.spec(), "--apply").returncode, 1)
        self.assertFalse((self.project / ".pi").exists())


class WriteFailure(Case):
    """Mock disk-full / close failure after the exclusive create; not a physical disk failure."""

    def late_failure(self, when, target):
        mod = load_module()
        real_open = io.open
        wanted = os.path.normcase(os.path.normpath(str(target)))

        class FaultyFile:
            def __init__(self, fh):
                self.fh = fh

            def __enter__(self):
                return self

            def write(self, data):
                if when == "write":
                    self.fh.write(data[:10])
                    raise OSError(28, "No space left on device (MOCK)")
                return self.fh.write(data)

            def __exit__(self, *exc):
                self.fh.close()
                if when == "close":
                    raise OSError(5, "close failed (MOCK)")
                return False

        def faulty_open(path, mode="r", *args, **kwargs):
            fh = real_open(path, mode, *args, **kwargs)
            if "x" in mode and os.path.normcase(os.path.normpath(str(path))) == wanted:
                return FaultyFile(fh)
            return fh

        mod.open = faulty_open
        spec_path = self.dir / "spec.json"
        spec_path.write_text(json.dumps(self.spec(skill=SKILL)), encoding="utf-8")
        argv = ["--spec", str(spec_path), "--project-root", str(self.project),
                "--agent-dir", str(self.agent), "--apply"]
        saved = {k: os.environ.get(k) for k in ("HOME", "USERPROFILE")}
        os.environ["HOME"] = os.environ["USERPROFILE"] = str(self.home)
        out, err = io.StringIO(), io.StringIO()
        try:
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                code = mod.main(argv)
        finally:
            for k, v in saved.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v
        return code, out.getvalue(), err.getvalue()

    def test_late_write_failure_reports_partial_not_uncreated(self):
        code, out, err = self.late_failure("write", self.skill_file())
        self.assertEqual(code, 3, err)
        self.assertIn("created: " + str(self.agent_file()), out)
        self.assertIn("partial: " + str(self.skill_file()), out)
        self.assertNotIn("uncreated: " + str(self.skill_file()), out)
        self.assertEqual(len(self.skill_file().read_bytes()), 10)
        self.assertIn("partial file left", err)
        retry = self.cli(self.spec(skill=SKILL), "--apply")
        self.assertEqual(retry.returncode, 1, retry.stdout + retry.stderr)
        self.assertEqual(len(self.skill_file().read_bytes()), 10)

    def test_late_close_failure_reports_partial_not_uncreated(self):
        code, out, err = self.late_failure("close", self.skill_file())
        self.assertEqual(code, 3, err)
        self.assertIn("partial: " + str(self.skill_file()), out)
        self.assertNotIn("uncreated: " + str(self.skill_file()), out)
        self.assertTrue(self.skill_file().exists())

    def test_first_output_partial_leaves_second_uncreated(self):
        code, out, err = self.late_failure("write", self.agent_file())
        self.assertEqual(code, 3, err)
        self.assertIn("partial: " + str(self.agent_file()), out)
        self.assertIn("uncreated: " + str(self.skill_file()), out)
        self.assertNotIn("created: " + str(self.agent_file()), out)
        self.assertFalse(self.skill_file().exists())


def short_path(path):
    import ctypes
    buf = ctypes.create_unicode_buffer(32768)
    n = ctypes.windll.kernel32.GetShortPathNameW(str(path), buf, len(buf))
    return buf.value if n else None


class ShortPathAlias(Case):
    def test_short_path_root_inside_global_agent_dir_refused(self):
        if os.name != "nt":
            self.skipTest("8.3 short names are Windows-only")
        inner = self.agent / "Projects With Long Name" / "repo"
        (inner / ".git").mkdir(parents=True)
        short = short_path(inner)
        if not short or os.path.normcase(short) == os.path.normcase(str(inner)):
            self.skipTest("NOT RUN: 8.3 short names unavailable on this volume")
        r = self.cli(self.spec(), "--apply", project=Path(short))
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("global agent directory", r.stderr)
        self.assertFalse((inner / ".pi").exists())


class ParserLimits(Case):
    def test_deep_nesting_refused_without_traceback(self):
        r = self.cli('{"name": "x", "deep": ' + "[" * 5000 + "]" * 5000 + "}")
        self.assertEqual(r.returncode, 1, r.stderr)
        self.assertNotIn("Traceback", r.stderr)
        self.assertIn("exceeds parser limits", r.stderr)

    def test_oversized_integer_refused_without_traceback(self):
        r = self.cli('{"name": "x", "n": ' + "9" * 5000 + "}")
        self.assertEqual(r.returncode, 1, r.stderr)
        self.assertNotIn("Traceback", r.stderr)
        self.assertIn("exceeds parser limits", r.stderr)


class PermissionDisplay(Case):
    def test_preview_states_write_tool_and_source_edit_status(self):
        r = self.cli(self.spec())
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("write-tool=disabled", r.stdout)
        self.assertIn("source-edit=readonly", r.stdout)
        self.assertNotIn("write=never", r.stdout)
        r = self.cli(self.spec(writer=True), "--allow-writers")
        self.assertIn("source-edit=approved", r.stdout)

    def test_shell_power_is_explicit_in_preview(self):
        r = self.cli(self.spec(shell="bash"), "--allow-shell")
        self.assertIn("shell=bash (explicit grant; not a sandbox)", r.stdout)
        self.assertIn("shell=false", self.cli(self.spec()).stdout)


class NativeLinkAndNameFallbacks(Case):
    """Native Pi loads these entries under their own names; the collision check must reserve them."""
    def write_file(self, path, text):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(text.encode("utf-8"))

    def junction_entry(self, root, entry, declared):
        target = self.dir / "target"
        self.write_file(target / "SKILL.md", "---\n" + (f"name: {declared}\n" if declared else "") + "description: d\n---\nb\n")
        root.mkdir(parents=True, exist_ok=True)
        self.make_junction(root / entry, target)
        return target

    def assert_linked_refused(self, skill_name, target):
        r = self.cli(self.spec(skill=dict(SKILL, name=skill_name)), "--apply")
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("linked skill entry refused", r.stderr)
        self.assertFalse(self.agent_file().exists())
        self.assertFalse(self.skill_file(skill_name).exists())
        self.assertEqual([p.name for p in target.iterdir()], ["SKILL.md"])

    def test_junction_entry_refused_in_global_agent_skills(self):
        self.assert_linked_refused("linked-x", self.junction_entry(self.agent / "skills", "lnk", "linked-x"))

    def test_junction_entry_refused_in_project_pi_skills(self):
        self.assert_linked_refused("linked-x", self.junction_entry(self.project / ".pi" / "skills", "lnk", "linked-x"))

    def test_junction_entry_refused_in_project_agents_skills(self):
        self.assert_linked_refused("linked-x", self.junction_entry(self.project / ".agents" / "skills", "lnk", "linked-x"))

    def test_junction_entry_refused_in_home_agents_skills(self):
        self.assert_linked_refused("linked-x", self.junction_entry(self.home / ".agents" / "skills", "lnk", "linked-x"))

    def test_nameless_skill_inside_junction_refused(self):
        self.assert_linked_refused("lnk-nameless", self.junction_entry(self.agent / "skills", "lnk-nameless", None))

    def test_linked_file_entry_refused_by_stat_mock_not_physical_link(self):
        mod = load_module()
        self.write_file(self.agent / "skills" / "fl" / "SKILL.md", "---\nname: fl-x\ndescription: d\n---\nb\n")
        real = mod._is_link
        args = argparse.Namespace(spec=None, project_root=str(self.project), agent_dir=str(self.agent),
                                  apply=True, allow_writers=False, allow_shell=False)
        spec_path = self.dir / "spec-mock.json"
        spec_path.write_text(json.dumps(self.spec(skill=dict(SKILL, name="fl-x"))), encoding="utf-8")
        args.spec = str(spec_path)
        with mock.patch.object(mod, "_is_link", side_effect=lambda p: os.path.basename(p) == "SKILL.md" or real(p)), \
                mock.patch.dict(os.environ, {"HOME": str(self.home), "USERPROFILE": str(self.home)}):
            with self.assertRaises(mod.Refusal) as cm:
                mod.run(args, io.StringIO())
        self.assertIn("linked skill entry refused", str(cm.exception))
        self.assertFalse(self.agent_file().exists())

    def test_dot_and_node_modules_junction_entries_stay_ignored(self):
        root = self.agent / "skills"
        self.junction_entry(root, ".lnk", "linked-x")
        self.make_junction(root / "node_modules", self.dir / "target")
        r = self.cli(self.spec(skill=dict(SKILL, name="linked-x")))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_nameless_root_md_reserves_parent_skills_name(self):
        for label, root in (("global", self.agent / "skills"), ("project-pi", self.project / ".pi" / "skills")):
            with self.subTest(root=label):
                self.write_file(root / "legacy.md", "---\ndescription: legacy desc\n---\nbody\n")
                r = self.cli(self.spec(skill=dict(SKILL, name="skills")), "--apply")
                self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
                self.assertFalse(self.agent_file().exists())
                (root / "legacy.md").unlink()

    def test_nameless_nested_agents_md_reserves_parent_directory_name(self):
        for label, root in (("project", self.project / ".agents" / "skills"), ("home", self.home / ".agents" / "skills")):
            with self.subTest(root=label):
                self.write_file(root / "sub" / "leaf.md", "---\ndescription: d\n---\nbody\n")
                r = self.cli(self.spec(skill=dict(SKILL, name="sub")), "--apply")
                self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
                self.assertFalse(self.agent_file().exists())
                shutil.rmtree(root / "sub")

    def test_explicit_name_nested_agents_md_reserves_declared_name_only(self):
        self.write_file(self.project / ".agents" / "skills" / "sub" / "leaf.md", "---\nname: explicit-leaf\ndescription: d\n---\nb\n")
        self.assertEqual(self.cli(self.spec(skill=dict(SKILL, name="explicit-leaf")), "--apply").returncode, 1)
        self.assertEqual(self.cli(self.spec(skill=dict(SKILL, name="sub"))).returncode, 0)

    def test_nested_md_in_pi_skill_roots_is_not_native_loaded_control(self):
        self.write_file(self.project / ".pi" / "skills" / "sub" / "leaf.md", "---\ndescription: d\n---\nb\n")
        self.write_file(self.agent / "skills" / "sub2" / "leaf.md", "---\ndescription: d\n---\nb\n")
        self.assertEqual(self.cli(self.spec(skill=dict(SKILL, name="sub"))).returncode, 0)
        self.assertEqual(self.cli(self.spec(skill=dict(SKILL, name="sub2"))).returncode, 0)

    def test_unsupported_nested_agents_md_frontmatter_refused(self):
        self.write_file(self.project / ".agents" / "skills" / "odd" / "notes.md", "---\nname: |\n  x\n---\nb\n")
        self.assertEqual(self.cli(self.spec(skill=SKILL), "--apply").returncode, 1)
        self.assertFalse(self.agent_file().exists())


class PackageDefaults(Case):
    """Package mode: the bundled CLI at <package>/skills/agent-creation/scripts also reserves the packaged default role names."""

    def setUp(self):
        super().setUp()
        self.pkg = self.dir / "pkg"
        (self.pkg / "skills" / "agent-creation" / "scripts").mkdir(parents=True)
        (self.pkg / "defaults" / "agents").mkdir(parents=True)
        shutil.copyfile(SCRIPT, self.pkg / "skills" / "agent-creation" / "scripts" / "create_agent.py")
        self.pkg_script = self.pkg / "skills" / "agent-creation" / "scripts" / "create_agent.py"
        (self.pkg / "package.json").write_text(json.dumps({"name": "@alsevilla/pi-engineering-harness", "version": "0.1.0"}), encoding="utf-8")
        (self.pkg / "defaults" / "agents" / "reviewer.md").write_text("---\nname: reviewer\ndescription: r\ntools: read\n---\nbody\n", encoding="utf-8")
        (self.pkg / "defaults" / "agents" / "scout.md").write_text("---\nname: scout\ndescription: s\ntools: read\n---\nbody\n", encoding="utf-8")
        self._roles(PACKAGED_ROLES)
        (self.agent / "roles.json").unlink()  # fresh profile: no user registry at all

    def pkg_cli(self, spec, *extra, script=None):
        spec_path = self.dir / "spec.json"
        spec_path.write_text(json.dumps(spec), encoding="utf-8")
        args = [sys.executable, str(script or self.pkg_script), "--spec", str(spec_path), "--project-root", str(self.project), "--agent-dir", str(self.agent), *extra]
        return subprocess.run(args, capture_output=True, text=True, encoding="utf-8", env=self.env(), timeout=60)

    def test_packaged_agent_file_name_refused_on_fresh_profile_with_no_output(self):
        r = self.pkg_cli(self.spec(name="reviewer"), "--apply")
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("package default", r.stderr)
        self.assertNotIn(str(self.pkg), r.stderr)
        self.assertFalse((self.project / ".pi").exists())

    def test_packaged_roles_json_name_refused_in_preview_too(self):
        r = self.pkg_cli(self.spec(name="scout"))
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertFalse((self.project / ".pi").exists())

    def test_non_colliding_name_still_creates_in_package_mode(self):
        self.assertEqual(self.pkg_cli(self.spec(), "--apply").returncode, 0)
        self.assertTrue(self.agent_file().exists())

    def test_live_layout_without_package_root_keeps_preview_behaviour(self):
        self.assertEqual(self.cli(self.spec(name="reviewer")).returncode, 0)

    def test_package_name_mismatch_is_not_treated_as_the_package(self):
        (self.pkg / "package.json").write_text(json.dumps({"name": "other-package"}), encoding="utf-8")
        self.assertEqual(self.pkg_cli(self.spec(name="reviewer")).returncode, 0)

    def test_unreadable_package_manifest_refuses_instead_of_skipping_defaults(self):
        (self.pkg / "package.json").write_text("{not json", encoding="utf-8")
        r = self.pkg_cli(self.spec(name="reviewer"))
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("package manifest", r.stderr)

    def test_missing_packaged_roles_json_refuses_with_no_output(self):
        (self.pkg / "defaults" / "roles.json").unlink()
        r = self.pkg_cli(self.spec(), "--apply")
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("package defaults missing", r.stderr)
        self.assertNotIn(str(self.pkg), r.stderr)
        self.assertFalse(self.agent_file().exists())
        self.assertFalse((self.project / ".pi").exists())

    def test_missing_packaged_agents_dir_refuses_with_no_output(self):
        shutil.rmtree(self.pkg / "defaults" / "agents")
        r = self.pkg_cli(self.spec(), "--apply")
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("package defaults missing", r.stderr)
        self.assertFalse(self.agent_file().exists())
        self.assertFalse((self.project / ".pi").exists())


    def _roles(self, data):
        (self.pkg / "defaults" / "roles.json").write_text(json.dumps(data), encoding="utf-8")

    def assert_refused_no_output(self, r, text):
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn(text, r.stderr)
        self.assertNotIn(str(self.pkg), r.stderr)
        self.assertFalse(self.agent_file().exists())
        self.assertFalse((self.project / ".pi").exists())

    def test_missing_manifest_beside_packaged_defaults_refuses_with_no_output(self):
        (self.pkg / "package.json").unlink()
        self.assert_refused_no_output(self.pkg_cli(self.spec(), "--apply"), "package manifest")

    def test_missing_manifest_without_packaged_defaults_is_live_layout(self):
        live = self.dir / "live" / "skills" / "agent-creation" / "scripts"
        live.mkdir(parents=True)
        shutil.copyfile(SCRIPT, live / "create_agent.py")
        self.assertEqual(self.pkg_cli(self.spec(name="reviewer"), script=live / "create_agent.py").returncode, 0)

    def test_renamed_bundle_with_defaults_stays_inert_and_creates(self):
        (self.pkg / "package.json").write_text(json.dumps({"name": "x-renamed-harness"}), encoding="utf-8")
        self.assertEqual(self.pkg_cli(self.spec(name="reviewer")).returncode, 0)

    def test_packaged_role_without_definition_refuses_with_no_output(self):
        self._roles(PACKAGED_ROLES + [{"name": "ghost", "provider": "anthropic", "model": "claude-haiku-5-5", "fallbackModel": "", "thinking": "low", "tools": "read"}])
        self.assert_refused_no_output(self.pkg_cli(self.spec(), "--apply"), "package defaults roles.json and agents disagree")

    def test_packaged_definition_without_role_refuses_with_no_output(self):
        (self.pkg / "defaults" / "agents" / "scout.md").unlink()
        self.assert_refused_no_output(self.pkg_cli(self.spec(), "--apply"), "package defaults roles.json and agents disagree")

    def test_garbled_packaged_definition_refuses_with_no_output(self):
        (self.pkg / "defaults" / "agents" / "scout.md").write_text("no frontmatter here\n", encoding="utf-8")
        self.assert_refused_no_output(self.pkg_cli(self.spec(), "--apply"), "package defaults roles.json and agents disagree")

    def test_emptied_packaged_agents_refuse_with_no_output(self):
        for f in (self.pkg / "defaults" / "agents").glob("*.md"):
            f.unlink()
        self.assert_refused_no_output(self.pkg_cli(self.spec(), "--apply"), "package defaults roles.json and agents disagree")

    def test_empty_packaged_roles_list_refuses_with_no_output(self):
        self._roles([])
        self.assert_refused_no_output(self.pkg_cli(self.spec(), "--apply"), "package defaults roles.json must list")

    def test_garbled_packaged_role_entry_refuses_with_no_output(self):
        self._roles([{"Name": "scout"}, PACKAGED_ROLES[0]])
        self.assert_refused_no_output(self.pkg_cli(self.spec(), "--apply"), "package defaults roles.json must list")

    def test_duplicate_packaged_role_name_refuses_with_no_output(self):
        self._roles(PACKAGED_ROLES + [PACKAGED_ROLES[0]])
        self.assert_refused_no_output(self.pkg_cli(self.spec(), "--apply"), "package defaults roles.json must list")


if __name__ == "__main__":
    unittest.main()
