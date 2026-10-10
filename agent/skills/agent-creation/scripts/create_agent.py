#!/usr/bin/env python3
"""Create one project-local Pi agent and an optional skill from a strict JSON spec.

Preview is the default and writes nothing. --apply is explicit operator approval to create
the listed files; it is not project trust, reload, activation or launch authority.
Stdlib only: no model, network, Pi or .NET calls. Trusted single-user projects only:
this is not an adversarial race or OS sandbox.
"""
import argparse
import json
import math
import os
import re
import stat
import sys
import unicodedata

EXIT_OK = 0
EXIT_REFUSED = 1
EXIT_PARTIAL = 3
MAX_SPEC_BYTES = 256 * 1024
MAX_META = 1024
MAX_MODEL = 256
MAX_INSTRUCTIONS = 32 * 1024
MAX_NAME = 64
REPARSE_ATTR = 0x400  # FILE_ATTRIBUTE_REPARSE_POINT: junctions and other reparse points
NAME_RE = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
RESERVED_NAMES = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}
SHELLS = ("bash", "powershell")
SPEC_KEYS = {"name", "description", "instructions", "model", "thinking", "fallbackModel", "writer", "shell", "skill"}
REQUIRED_KEYS = ("name", "description", "instructions", "model")
SKILL_KEYS = {"name", "description", "instructions"}
BAD_META_CATEGORIES = {"Cc", "Cs", "Cf", "Zl", "Zp"}
BASE_TOOLS = ["read", "grep", "find", "ls"]
# Value spaces after the colon are consumed here, so scalar rules see the value Pi sees.
KEY_RE = re.compile(r"([A-Za-z_][A-Za-z0-9_-]*):(?:[ ]+(.*))?")
# Plain scalars YAML would type as non-strings (or that are ambiguous); refused, never guessed.
TYPED_PLAIN_RE = re.compile(
    r"~|null|Null|NULL|true|True|TRUE|false|False|FALSE|yes|Yes|YES|no|No|NO|on|On|ON|off|Off|OFF"
    r"|[-+]?(?:0|[1-9][0-9_]*)(?:\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|[-+]?\.[0-9_]+(?:[eE][-+]?[0-9]+)?"
    r"|0x[0-9a-fA-F_]+|0o[0-7_]+|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN)"
)
INDICATORS = set("!&*|>[]{}%@`,#?-:")


class Refusal(Exception):
    """Validation, permission, safety or collision refusal. Raised before any write."""


class Unsupported(Exception):
    """Frontmatter outside the conservative subset; the caller refuses before writes."""


class PartialWrite(Exception):
    """The exclusive create succeeded but the write or close failed: the partial file is kept, never deleted."""


# ---- strict spec JSON -------------------------------------------------------

def _reject_duplicates(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            raise Refusal(f"duplicate key in JSON object: {key}")
        out[key] = value
    return out


def _nonfinite(token):
    raise Refusal(f"nonfinite number not allowed: {token}")


def _finite_float(text):
    value = float(text)
    if not math.isfinite(value):
        raise Refusal(f"nonfinite number not allowed: {text}")
    return value


def strict_json(text):
    try:
        return json.loads(text, object_pairs_hook=_reject_duplicates, parse_constant=_nonfinite,
                          parse_float=_finite_float)
    except json.JSONDecodeError as exc:
        raise Refusal(f"invalid JSON: {exc.msg} (line {exc.lineno})") from None
    except (RecursionError, ValueError):
        # deep nesting or an integer over the digit limit: refuse cleanly, never a traceback
        raise Refusal("JSON value exceeds parser limits (nesting depth or integer digits)") from None


def load_spec(path):
    try:
        with open(path, "rb") as fh:
            raw = fh.read(MAX_SPEC_BYTES + 1)
    except OSError as exc:
        raise Refusal(f"cannot read spec: {exc.strerror}") from None
    if len(raw) > MAX_SPEC_BYTES:
        raise Refusal("spec exceeds the size limit")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise Refusal("spec is not valid UTF-8") from None
    data = strict_json(text)
    if not isinstance(data, dict):
        raise Refusal("spec must be a JSON object")
    return data


def _slug(value, field):
    if not isinstance(value, str):
        raise Refusal(f"{field} must be a string")
    if len(value) > MAX_NAME or not NAME_RE.fullmatch(value):
        raise Refusal(f"{field} must be a lowercase slug of at most {MAX_NAME} characters (a-z, 0-9, single hyphens)")
    if value.upper() in RESERVED_NAMES:
        raise Refusal(f"{field} is a reserved Windows device name")
    return value


def _meta(value, field, limit):
    if not isinstance(value, str):
        raise Refusal(f"{field} must be a string")
    if not value or value != value.strip():
        raise Refusal(f"{field} must be non-empty with no leading or trailing whitespace")
    if len(value) > limit:
        raise Refusal(f"{field} exceeds {limit} characters")
    if any(unicodedata.category(ch) in BAD_META_CATEGORIES for ch in value):
        raise Refusal(f"{field} must be single-line text without control or format characters")
    return value


def _instructions(value, field):
    if not isinstance(value, str) or not value.strip():
        raise Refusal(f"{field} must be a non-empty string")
    if len(value) > MAX_INSTRUCTIONS:
        raise Refusal(f"{field} exceeds {MAX_INSTRUCTIONS} characters")
    for ch in value:
        if ch not in "\n\t" and unicodedata.category(ch) in ("Cc", "Cs"):
            raise Refusal(f"{field} contains a control character")
    return value


def validate_spec(data):
    unknown = sorted(set(data) - SPEC_KEYS)
    if unknown:
        raise Refusal("unknown key(s) in spec: " + ", ".join(unknown))
    for key in REQUIRED_KEYS:
        if key not in data:
            raise Refusal(f"missing required key: {key}")
    writer = data.get("writer", False)
    if type(writer) is not bool:
        raise Refusal("writer must be exactly JSON true or false")
    shell = data.get("shell", False)
    if not (shell is False or (isinstance(shell, str) and shell in SHELLS)):
        raise Refusal('shell must be false, "bash" or "powershell"')
    skill = None
    if "skill" in data:
        raw = data["skill"]
        if not isinstance(raw, dict):
            raise Refusal("skill must be an object")
        unknown = sorted(set(raw) - SKILL_KEYS)
        if unknown:
            raise Refusal("unknown key(s) in skill: " + ", ".join(unknown))
        for key in SKILL_KEYS:
            if key not in raw:
                raise Refusal(f"missing required skill key: {key}")
        skill = {
            "name": _slug(raw["name"], "skill.name"),
            "description": _meta(raw["description"], "skill.description", MAX_META),
            "instructions": _instructions(raw["instructions"], "skill.instructions"),
        }
    return {
        "name": _slug(data["name"], "name"),
        "description": _meta(data["description"], "description", MAX_META),
        "instructions": _instructions(data["instructions"], "instructions"),
        "model": _meta(data["model"], "model", MAX_MODEL),
        "thinking": _meta(data["thinking"], "thinking", MAX_MODEL) if "thinking" in data else None,
        "fallbackModel": _meta(data["fallbackModel"], "fallbackModel", MAX_MODEL) if "fallbackModel" in data else None,
        "writer": writer,
        "shell": shell,
        "skill": skill,
    }


# ---- filesystem safety (lstat before any resolution) -------------------------

def _kind(path):
    """'dir', 'file' or None (missing). Links, junctions and reparse points are refused."""
    try:
        st = os.lstat(path)
    except FileNotFoundError:
        return None
    except OSError as exc:
        raise Refusal(f"cannot inspect {path}: {exc.strerror}") from None
    if stat.S_ISLNK(st.st_mode) or getattr(st, "st_file_attributes", 0) & REPARSE_ATTR:
        raise Refusal(f"symlink, junction or reparse point refused: {path}")
    if stat.S_ISDIR(st.st_mode):
        return "dir"
    if stat.S_ISREG(st.st_mode):
        return "file"
    raise Refusal(f"unsupported filesystem entry: {path}")


def _is_link(path):
    try:
        st = os.lstat(path)
    except OSError:
        return False
    return stat.S_ISLNK(st.st_mode) or bool(getattr(st, "st_file_attributes", 0) & REPARSE_ATTR)


def check_root(raw):
    if not os.path.isabs(raw):
        raise Refusal("project root must be an absolute path")
    if any(part in (".", "..") for part in re.split(r"[\\/]+", raw)):
        raise Refusal("project root must not contain . or .. segments")
    root = os.path.normpath(raw)
    kind = _kind(root)
    if kind is None:
        raise Refusal("project root does not exist")
    if kind != "dir":
        raise Refusal("project root must be a directory")
    prefix = os.path.splitdrive(root)[0] + os.sep
    cur = prefix
    for part in [p for p in os.path.relpath(root, prefix).split(os.sep) if p and p != "."][:-1]:
        cur = os.path.join(cur, part)
        if _kind(cur) != "dir":
            raise Refusal(f"project root ancestor is not a plain directory: {cur}")
    return root


def inspect_chain(path, root):
    """Refuse links below root; return 'dir', 'file' or None for the final path."""
    kind = "dir"
    cur = root
    for part in os.path.relpath(path, root).split(os.sep):
        cur = os.path.join(cur, part)
        kind = _kind(cur)
        if kind is None:
            return None
        if cur != path and kind != "dir":
            raise Refusal(f"path component is not a directory: {cur}")
    return kind


def ensure_parent_dirs(path, root, created_dirs):
    cur = root
    for part in os.path.relpath(os.path.dirname(path), root).split(os.sep):
        if part in ("", "."):
            continue
        cur = os.path.join(cur, part)
        if _kind(cur) is None:
            os.mkdir(cur)
            created_dirs.append(cur)
            if _kind(cur) != "dir":
                raise Refusal(f"directory changed during creation: {cur}")


def _within(path, base):
    p = os.path.normcase(os.path.normpath(path))
    b = os.path.normcase(os.path.normpath(base))
    try:
        return os.path.commonpath([p, b]) == b
    except ValueError:
        return False


def resolve_agent_dir(explicit, environ):
    value = explicit or environ.get("PI_CODING_AGENT_DIR") or os.path.join(os.path.expanduser("~"), ".pi", "agent")
    value = os.path.expanduser(value)
    if not os.path.isabs(value):
        raise Refusal("agent dir must be an absolute path")
    return os.path.normpath(value)


# ---- conservative frontmatter subset ----------------------------------------

def _scalar(raw):
    if raw == "":
        return None
    if raw[0] == '"':
        try:
            value = json.loads(raw)
        except ValueError:
            raise Unsupported("double-quoted scalar is not a single-line JSON-compatible string") from None
        if not isinstance(value, str):
            raise Unsupported("double-quoted scalar is not a string")
        return value
    if raw[0] == "'":
        if len(raw) < 2 or raw[-1] != "'":
            raise Unsupported("single-quoted scalar is not closed on the same line")
        body, out, i = raw[1:-1], [], 0
        while i < len(body):
            if body[i] == "'":
                if i + 1 < len(body) and body[i + 1] == "'":
                    out.append("'")
                    i += 2
                    continue
                raise Unsupported("single-quoted scalar has an unescaped quote")
            out.append(body[i])
            i += 1
        return "".join(out)
    if raw[0] in INDICATORS or " #" in raw or ": " in raw or raw.endswith(":"):
        raise Unsupported(f"plain scalar uses YAML syntax outside the supported subset: {raw[:40]!r}")
    if TYPED_PLAIN_RE.fullmatch(raw):
        raise Unsupported(f"plain scalar would be typed by YAML: {raw[:40]!r}")
    return raw


def parse_frontmatter_subset(text):
    """Return {key: str|None} for a '---' block, or None when no frontmatter is present.

    Supported: top-level `key: value` lines with plain, JSON-compatible double-quoted or simple
    single-quoted scalars; full-line comments; blank lines. Anything else raises Unsupported.
    """
    if text.startswith("\ufeff"):
        text = text[1:]
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    if not text.startswith("---"):
        return None
    lines = text.split("\n")
    if lines[0] != "---":
        raise Unsupported("frontmatter opener must be a bare --- line")
    try:
        close = lines.index("---", 1)
    except ValueError:
        raise Unsupported("frontmatter has no closing --- line") from None
    data = {}
    for line in lines[1:close]:
        if not line.strip() or line.startswith("#"):
            continue
        if any(ord(ch) < 0x20 for ch in line):
            raise Unsupported("control character inside frontmatter")
        match = KEY_RE.fullmatch(line)
        if match is None:
            raise Unsupported(f"line outside the supported key/value subset: {line[:40]!r}")
        key = match.group(1)
        if key in data:
            raise Unsupported(f"duplicate frontmatter key: {key}")
        data[key] = _scalar((match.group(2) or "").rstrip(" "))
    return data


def _frontmatter(data, path):
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        raise Refusal(f"not valid UTF-8, collision check cannot be established: {path}") from None
    try:
        return parse_frontmatter_subset(text)
    except Unsupported as exc:
        raise Refusal(f"unsupported frontmatter, collision check cannot be established ({exc}): {path}") from None


def _read_bytes(path):
    try:
        with open(path, "rb") as fh:
            return fh.read()
    except OSError as exc:
        raise Refusal(f"cannot read {path}: {exc.strerror}") from None


# ---- collision registry -----------------------------------------------------

def _add(table, key, source):
    if key:
        table.setdefault(key.casefold(), []).append(source)


def load_roles(agent_dir):
    path = os.path.join(agent_dir, "roles.json")
    if not os.path.exists(path):
        return []
    try:
        with open(path, "rb") as fh:
            data = strict_json(fh.read().decode("utf-8"))
    except (OSError, UnicodeDecodeError):
        raise Refusal(f"roles.json unreadable, collision check cannot be established: {path}") from None
    if not isinstance(data, list):
        raise Refusal(f"roles.json must be a list: {path}")
    return [entry["name"] for entry in data if isinstance(entry, dict) and isinstance(entry.get("name"), str)]


def scan_agent_dir(dir_path, label, own, table):
    if not os.path.isdir(dir_path):
        return
    try:
        entries = sorted(os.listdir(dir_path))
    except OSError as exc:
        raise Refusal(f"cannot scan {label} {dir_path}: {exc.strerror}") from None
    for entry in entries:
        path = os.path.join(dir_path, entry)
        if not entry.endswith(".md") or not os.path.isfile(path):
            continue
        data = _read_bytes(path)
        if own.get(os.path.normcase(path)) == data:
            continue
        fm = _frontmatter(data, path)
        _add(table, entry[:-3], f"{label} file name {path}")
        if fm and isinstance(fm.get("name"), str):
            _add(table, fm["name"], f"{label} frontmatter name in {path}")


def _nearest_project_agents_dir(root):
    cur = os.path.dirname(root)
    while True:
        candidate = os.path.join(cur, ".pi", "agents")
        if os.path.isdir(candidate):
            return candidate
        parent = os.path.dirname(cur)
        if parent == cur:
            return None
        cur = parent


PACKAGE_NAME = "@alsevilla/pi-engineering-harness"


def package_root(script_file=__file__):
    # Bundled as <package>/skills/agent-creation/scripts/create_agent.py; a live profile has no such package.json.
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(script_file)))))
    manifest = os.path.join(root, "package.json")
    if not os.path.lexists(manifest):
        # Packaged defaults without their manifest is a damaged package, not the live profile.
        if os.path.lexists(os.path.join(root, "defaults")):
            raise Refusal("package manifest is missing beside package defaults, collision check cannot be established")
        return None
    try:
        with open(manifest, "rb") as fh:
            data = strict_json(fh.read().decode("utf-8"))
    except (OSError, UnicodeDecodeError, Refusal):
        raise Refusal(f"package manifest unreadable, collision check cannot be established: {manifest}") from None
    if not isinstance(data, dict):
        raise Refusal(f"package manifest must be an object, collision check cannot be established: {manifest}")
    return root if data.get("name") == PACKAGE_NAME else None


def package_role_names(defaults):
    # Names contract only (not a full role parser): a non-empty list of objects with unique non-empty string names.
    path = os.path.join(defaults, "roles.json")
    try:
        data = strict_json(_read_bytes(path).decode("utf-8"))
    except UnicodeDecodeError:
        raise Refusal("package defaults roles.json must list named roles, collision check cannot be established") from None
    names = [entry.get("name") if isinstance(entry, dict) else None for entry in data] if isinstance(data, list) else []
    if not names or any(not isinstance(n, str) or not n.strip() for n in names) or len(set(names)) != len(names):
        raise Refusal("package defaults roles.json must list named roles without duplicates, collision check cannot be established")
    return names


def scan_package_defaults(root, table):
    # Bundled role names are reserved as a static label; paths stay out of the refusal text.
    defaults = os.path.join(root, "defaults")
    agents = os.path.join(defaults, "agents")
    # Package mode fails closed: a partial bundle would let a colliding name through the collision check.
    if not os.path.isfile(os.path.join(defaults, "roles.json")) or not os.path.isdir(agents):
        raise Refusal("package defaults missing, collision check cannot be established")
    declared = package_role_names(defaults)
    for name in declared:
        _add(table, name, "package default roles.json")
    try:
        entries = sorted(os.listdir(agents))
    except OSError as exc:
        raise Refusal(f"cannot scan package defaults: {exc.strerror}") from None
    defined = []
    for entry in entries:
        path = os.path.join(agents, entry)
        if not entry.endswith(".md") or not os.path.isfile(path):
            continue
        fm = _frontmatter(_read_bytes(path), path)
        _add(table, entry[:-3], "package default agent file")
        name = fm.get("name") if fm else None
        if not isinstance(name, str) or not name.strip():
            raise Refusal("package defaults roles.json and agents disagree on role names, collision check cannot be established")
        defined.append(name)
        _add(table, name, "package default agent frontmatter name")
    # Exact set equality: each declared role has one parsed definition and no definition is undeclared.
    if sorted(declared) != sorted(defined):
        raise Refusal("package defaults roles.json and agents disagree on role names, collision check cannot be established")


def agent_registry(agent_dir, root, own, warnings, pkg=None):
    table = {}
    for name in load_roles(agent_dir):
        _add(table, name, "global roles.json")
    if pkg:
        scan_package_defaults(pkg, table)
    scan_agent_dir(os.path.join(agent_dir, "agents"), "global agents", own, table)
    target = os.path.join(root, ".pi", "agents")
    if _kind(target) == "dir":
        scan_agent_dir(target, "project agents", own, table)
    else:
        nearest = _nearest_project_agents_dir(root)
        if nearest:
            scan_agent_dir(nearest, "nearest ancestor project agents", own, table)
            warnings.append(
                f"warning: creating {target} shadows the nearest project agents directory {nearest} "
                f"for sessions started in {root}; its agents are not discovered from that root"
            )
    return table


def _skill_roots(agent_dir, root, home):
    roots = [(os.path.join(agent_dir, "skills"), "pi"), (os.path.join(home, ".agents", "skills"), "agents"),
             (os.path.join(root, ".pi", "skills"), "pi"), (os.path.join(root, ".agents", "skills"), "agents")]
    cur = root
    while True:
        roots.append((os.path.join(cur, ".agents", "skills"), "agents"))
        if os.path.exists(os.path.join(cur, ".git")):
            break
        parent = os.path.dirname(cur)
        if parent == cur:
            break
        cur = parent
    seen, out = set(), []
    for item, mode in roots:
        key = os.path.normcase(os.path.normpath(item))
        if key not in seen:
            seen.add(key)
            out.append((item, mode))
    return out


def scan_skill_root(base, mode, own, table):
    # mode 'pi' loads root-level *.md; mode 'agents' loads nested *.md (Pi package-manager rules)
    if not os.path.isdir(base):
        return
    stack = [base]
    while stack:
        cur = stack.pop()
        try:
            entries = sorted(os.scandir(cur), key=lambda e: e.name)
        except OSError as exc:
            raise Refusal(f"cannot scan skill root {cur}: {exc.strerror}") from None
        for entry in entries:
            if entry.name.startswith(".") or entry.name == "node_modules":
                continue  # native ignores these entries too
            if _is_link(entry.path):
                raise Refusal(f"linked skill entry refused; native follows links, collision check cannot be established: {entry.path}")
            if entry.is_dir(follow_symlinks=False):
                stack.append(entry.path)
            elif entry.is_file(follow_symlinks=False) and (entry.name == "SKILL.md" or (entry.name.endswith(".md") and (cur == base or mode == "agents"))):
                data = _read_bytes(entry.path)
                if own.get(os.path.normcase(entry.path)) == data:
                    continue
                fm = _frontmatter(data, entry.path)
                declared = fm.get("name") if fm and isinstance(fm.get("name"), str) else None
                if entry.name == "SKILL.md":
                    _add(table, declared, f"skill name in {entry.path}")
                    _add(table, os.path.basename(cur), f"skill directory name for {entry.path}")
                else:
                    _add(table, declared, f"skill file name in {entry.path}")
                    if cur == base:
                        _add(table, entry.name[:-3], f"skill file stem {entry.path}")
                    # native name = frontmatter name || parent directory; root *.md only loads in pi mode
                    if not declared and (cur != base or mode == "pi"):
                        _add(table, os.path.basename(cur), f"skill file parent-directory name for {entry.path}")


# ---- rendering ----------------------------------------------------------------

def _q(value):
    # JSON-quoted YAML double-quoted scalar; control characters were already refused.
    return json.dumps(value, ensure_ascii=False)


def tools_for(spec):
    tools = list(BASE_TOOLS)
    if spec["writer"]:
        tools.append("edit")
    if spec["shell"] is not False:
        tools.append(spec["shell"])
    return tools


def render_agent(spec, skill_path):
    fm = ["---", f"name: {_q(spec['name'])}", f"description: {_q(spec['description'])}",
          f"model: {_q(spec['model'])}"]
    if spec["thinking"] is not None:
        fm.append(f"thinking: {_q(spec['thinking'])}")
    if spec["fallbackModel"] is not None:
        fm.append(f"fallbackModel: {_q(spec['fallbackModel'])}")
    fm += [f"tools: {_q(', '.join(tools_for(spec)))}", "---"]
    body = [f"# {spec['name']}", "", spec["instructions"].rstrip(), "", "## Generated boundaries",
            "- Work only inside the assigned project and task scope; preserve unrelated code, tests and user changes.",
            "- Do not launch, delegate or supervise other agents, helpers or subagent tools.",
            "- Do not commit, push, merge, publish, deploy or change model, provider, fallback or global role configuration.",
            "- Use only the tools listed in this definition; shell access, when granted, is not a sandbox."]
    if skill_path:
        body.append("- Before starting, read the original skill instructions at this absolute path and follow them "
                    f"within this role's authority: {skill_path}")
    return "\n".join(fm + [""] + body) + "\n"


def render_skill(skill):
    lines = ["---", f"name: {_q(skill['name'])}", f"description: {_q(skill['description'])}", "---", "",
             f"# {skill['name']}", "", skill["instructions"].rstrip()]
    return "\n".join(lines) + "\n"


class Target:
    def __init__(self, label, path, text):
        self.label = label
        self.path = path
        self.data = text.encode("utf-8")
        self.status = None


def build_targets(spec, root, agent_dir):
    skill_path = None
    targets = []
    if spec["skill"]:
        skill_path = os.path.join(root, ".pi", "skills", spec["skill"]["name"], "SKILL.md")
    agent_path = os.path.join(root, ".pi", "agents", spec["name"] + ".md")
    targets.append(Target("agent", agent_path, render_agent(spec, skill_path)))
    if spec["skill"]:
        targets.append(Target("skill", skill_path, render_skill(spec["skill"])))
    for target in targets:
        if _within(target.path, agent_dir) or _within(target.path, os.path.realpath(agent_dir)):
            raise Refusal(f"output inside the global agent directory refused: {target.path}")
    return targets


def _create_exclusive(path, data):
    fh = open(path, "xb")  # a failure here creates nothing
    try:
        with fh:
            fh.write(data)
    except OSError as exc:
        raise PartialWrite(exc.strerror or str(exc)) from None


# ---- run -----------------------------------------------------------------------

def _stop(created_dirs, created, partial, uncreated, exc):
    for d in created_dirs:
        print(f"created-dir: {d}")
    for c in created:
        print(f"created: {c}")
    if partial:
        print(f"partial: {partial}")
    for u in uncreated:
        print(f"uncreated: {u}")
    if partial:
        print(f"ERROR: write failed after {len(created)} complete file(s); partial file left at {partial}: {exc}; "
              "nothing was deleted; review the partial file before any cleanup", file=sys.stderr)
    else:
        print(f"ERROR: write stopped after {len(created)} file(s): {exc}; nothing was deleted", file=sys.stderr)


def _emit_plan(out, mode, root, agent_dir, spec, targets, warnings):
    print(f"mode: {mode}")
    print(f"project root: {root}")
    print(f"agent dir: {agent_dir}")
    shell = f"{spec['shell']} (explicit grant; not a sandbox)" if spec["shell"] is not False else "false"
    print(f"permissions: tools={', '.join(tools_for(spec))}; write-tool=disabled; "
          f"source-edit={'approved' if spec['writer'] else 'readonly'}; writer={str(spec['writer']).lower()}; "
          f"shell={shell}; "
          f"model={spec['model']}; fallbackModel={spec['fallbackModel'] or 'none'}; thinking={spec['thinking'] or 'none'}")
    for line in warnings:
        print(line)
    for t in targets:
        print(f"{t.label} file: {t.path} -> {t.status}")
    if mode == "preview":
        print("no files written; re-run with --apply to create the files listed above")
        for t in targets:
            print(f"--- BEGIN {t.label} file: {t.path} ---")
            print(t.data.decode("utf-8"), end="")
            print(f"--- END {t.label} file ---")


def run(args, out):
    spec = validate_spec(load_spec(args.spec))
    if spec["writer"] and not args.allow_writers:
        raise Refusal("writer:true requires --allow-writers")
    if spec["shell"] is not False and not args.allow_shell:
        raise Refusal(f"shell:{spec['shell']} requires --allow-shell")
    root = check_root(args.project_root)
    agent_dir = resolve_agent_dir(args.agent_dir, os.environ)
    targets = build_targets(spec, root, agent_dir)
    for t in targets:
        kind = inspect_chain(t.path, root)
        if kind == "file":
            if _read_bytes(t.path) == t.data:
                t.status = "unchanged"
            else:
                raise Refusal(f"existing file differs and will not be overwritten: {t.path}")
        elif kind == "dir":
            raise Refusal(f"output path is a directory: {t.path}")
        else:
            t.status = "create"
    # Canonical check after the lstat/reparse refusals above: 8.3 or other aliases of the global dir are caught.
    real_agent = os.path.realpath(agent_dir)
    for t in targets:
        if _within(os.path.realpath(t.path), real_agent):
            raise Refusal(f"output inside the global agent directory refused: {t.path}")
    if _within(os.path.realpath(root), real_agent):
        raise Refusal(f"project root inside the global agent directory refused: {root}")
    own = {os.path.normcase(t.path): t.data for t in targets if t.status == "unchanged"}
    warnings = []
    home = os.path.expanduser("~")
    agents = agent_registry(agent_dir, root, own, warnings, package_root())
    skills = {}
    for base, mode in _skill_roots(agent_dir, root, home):
        scan_skill_root(base, mode, own, skills)
    for t in targets:
        table = agents if t.label == "agent" else skills
        key = spec["name"] if t.label == "agent" else spec["skill"]["name"]
        if key.casefold() in table:
            raise Refusal(f"{t.label} name '{key}' collides with: {table[key.casefold()][0]}")
    mode = "apply" if args.apply else "preview"
    _emit_plan(out, mode, root, agent_dir, spec, targets, warnings)
    if not args.apply:
        return EXIT_OK
    created, created_dirs, pending = [], [], [t for t in targets if t.status == "create"]
    for t in targets:
        if t.status == "unchanged":
            print(f"unchanged: {t.path}")
    for index, t in enumerate(pending):
        try:
            ensure_parent_dirs(t.path, root, created_dirs)
            if _kind(t.path) is not None:
                raise Refusal(f"path appeared during apply: {t.path}")
            _create_exclusive(t.path, t.data)
        except PartialWrite as exc:
            _stop(created_dirs, created, t.path, [u.path for u in pending[index + 1:]], exc)
            return EXIT_PARTIAL
        except (OSError, Refusal) as exc:
            _stop(created_dirs, created, None, [u.path for u in pending[index:]], exc)
            return EXIT_PARTIAL
        created.append(t.path)
    for d in created_dirs:
        print(f"created-dir: {d}")
    for c in created:
        print(f"created: {c}")
    return EXIT_OK


def main(argv=None):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Preview or create a project-local Pi agent (and optional skill).")
    parser.add_argument("--spec", required=True, help="strict JSON spec file")
    parser.add_argument("--project-root", required=True, help="absolute existing project root")
    parser.add_argument("--agent-dir", help="global agent dir (else PI_CODING_AGENT_DIR, else ~/.pi/agent)")
    parser.add_argument("--apply", action="store_true", help="create files (default: preview only)")
    parser.add_argument("--allow-writers", action="store_true", help="permit writer:true (adds edit)")
    parser.add_argument("--allow-shell", action="store_true", help="permit shell bash/powershell")
    args = parser.parse_args(argv)
    try:
        return run(args, sys.stdout)
    except Refusal as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return EXIT_REFUSED


if __name__ == "__main__":
    sys.exit(main())
