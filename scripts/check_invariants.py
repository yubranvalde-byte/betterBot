"""
Zero-dependency architectural invariant verification gate for BetterBot 2.0.
Uses Python stdlib only and makes zero LLM or network calls.
Exit codes: 0 = all checks passed (warnings allowed), 1 = one or more checks failed.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path
from typing import Callable, Dict, List, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

BASE_RUBRIC_KEYS = (
    "intent_alignment",
    "token_density_no_bloat",
    "trigger_precision",
    "progressive_disclosure",
    "actionable_clarity",
    "output_contract_strength",
)
SUITE_ONLY_KEY = "trigger_deconfliction"

CORE_FILES = (
    "AGENTS.md",
    "server.py",
    "storage.py",
    "main.py",
    "validators.py",
    "prompts.py",
    "prompts/helper.md",
    "prompts/construct.md",
    "prompts/upgrader.md",
    "prompts/adjudicator_baseline.md",
    "prompts/adjudicator_regression.md",
    "prompts/betty_tech_support.md",
    "prompts/betty_prompt_advisor.md",
    "render.yaml",
    "static/index.html",
    "frontend/src/components/views/QaView.tsx",
    "frontend/src/types/api.ts",
)

PROMPT_EXPORTS = (
    "HELPER_PROMPT",
    "CONSTRUCT_PROMPT",
    "UPGRADER_PROMPT",
    "ADJUDICATOR_BASELINE_PROMPT",
    "ADJUDICATOR_REGRESSION_PROMPT",
    "BETTY_TECH_SUPPORT_PROMPT",
    "BETTY_PROMPT_ADVISOR_PROMPT",
)


def _load_normalize_artifact_path() -> Tuple[Callable[[str], str], str]:
    """Loads `normalize_artifact_path` directly from stdlib-only `validators.py`."""
    from validators import normalize_artifact_path

    return normalize_artifact_path, "stdlib import (validators)"


def check_git_branch() -> Tuple[str, str]:
    """Check 1: Verify current Git branch is not `main` (warn on detached HEAD)."""
    try:
        proc = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            timeout=10,
        )
    except Exception as exc:
        return "FAIL", f"git invocation error: {exc}"

    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        return "FAIL", f"git rev-parse failed: {err or 'unknown error'}"

    branch = proc.stdout.strip()
    if not branch:
        return "FAIL", "empty branch name returned by git"
    if branch == "main":
        return "FAIL", "active branch is 'main' (must develop on 'develop')"
    if branch == "HEAD":
        return "WARN", "detached HEAD (expected 'develop'; not on 'main')"
    return "PASS", f"active branch is '{branch}'"


def check_path_sanitizer() -> Tuple[str, str]:
    """Check 2: Verify `normalize_artifact_path` rejects invalid/traversal paths and matches `storage.py`."""
    try:
        normalize_fn, loader_mode = _load_normalize_artifact_path()
        import storage as storage_mod
    except Exception as exc:
        return "FAIL", f"failed to load normalize_artifact_path: {exc}"

    if getattr(storage_mod, "_normalize_rel_path", None) is not normalize_fn:
        return (
            "FAIL",
            "storage._normalize_rel_path is not aliased to validators.normalize_artifact_path",
        )

    invalid_cases = [
        "",
        "/etc/passwd",
        "../secret.md",
        "skills/../../x.md",
        "\\windows\\path",
        "\\\\windows\\path",
        "C:\\secret.txt",
        "//server/share/x.md",
    ]
    valid_cases = [
        ("references/guide.md", "references/guide.md"),
        ("scripts/validate.py", "scripts/validate.py"),
        ("skills/sub_a/SKILL.md", "skills/sub_a/SKILL.md"),
        ("skills/sub_a/scripts/validate.py", "skills/sub_a/scripts/validate.py"),
    ]

    failures: List[str] = []
    for raw in invalid_cases:
        got = normalize_fn(raw)
        if got != "":
            failures.append(f"expected '' for {raw!r}, got {got!r}")

    for raw, expected in valid_cases:
        got = normalize_fn(raw)
        if got != expected:
            failures.append(f"expected {expected!r} for {raw!r}, got {got!r}")

    if failures:
        return "FAIL", f"({loader_mode}) " + "; ".join(failures)
    return (
        "PASS",
        f"({loader_mode}) {len(invalid_cases)} invalid rejected, {len(valid_cases)} valid accepted",
    )


def check_rubric_parity() -> Tuple[str, str]:
    """Check 3: Verify 6+1 rubric keys match across `prompts.py` and active frontend files."""
    try:
        from prompts import get_rubric_questions
    except Exception as exc:
        return "FAIL", f"failed to import get_rubric_questions from prompts.py: {exc}"

    errors: List[str] = []
    expected_base = set(BASE_RUBRIC_KEYS)
    expected_suite = expected_base | {SUITE_ONLY_KEY}

    for target in ("SYSTEM_PROMPT", "SKILL_PACKAGE", "HYBRID_BUNDLE"):
        keys = {
            q["name"]
            for q in get_rubric_questions(target)
            if q.get("type") == "score"
        }
        if keys != expected_base:
            errors.append(
                f"prompts.py {target} mismatch: got {sorted(keys)}, expected {sorted(expected_base)}"
            )

    suite_keys = {
        q["name"]
        for q in get_rubric_questions("SKILL_SUITE")
        if q.get("type") == "score"
    }
    if suite_keys != expected_suite:
        errors.append(
            f"prompts.py SKILL_SUITE mismatch: got {sorted(suite_keys)}, expected {sorted(expected_suite)}"
        )

    frontend_targets = (
        REPO_ROOT / "frontend" / "src" / "components" / "views" / "QaView.tsx",
        REPO_ROOT / "frontend" / "src" / "types" / "api.ts",
    )
    required_all = BASE_RUBRIC_KEYS + (SUITE_ONLY_KEY,)
    for path in frontend_targets:
        if not path.is_file():
            errors.append(f"missing frontend file: {path.relative_to(REPO_ROOT).as_posix()}")
            continue
        text = path.read_text(encoding="utf-8")
        missing = [
            key
            for key in required_all
            if not re.search(rf"\b{re.escape(key)}\b", text)
        ]
        if missing:
            rel = path.relative_to(REPO_ROOT).as_posix()
            errors.append(f"{rel} missing keys: {', '.join(missing)}")

    if errors:
        return "FAIL", "; ".join(errors)

    import prompts as prompts_mod

    missing_exports = [
        name
        for name in PROMPT_EXPORTS
        if not isinstance(getattr(prompts_mod, name, None), str)
        or not getattr(prompts_mod, name, "").strip()
    ]
    if missing_exports:
        return "FAIL", f"prompts.py missing/empty prompt exports: {', '.join(missing_exports)}"

    readiness_names = {q.get("name") for q in getattr(prompts_mod, "HELPER_READINESS_QUESTIONS", [])}
    missing_readiness = [
        k for k in ("needs_auxiliary_files", "needs_scripts", "is_repo_context") if k not in readiness_names
    ]
    if missing_readiness:
        return "FAIL", f"HELPER_READINESS_QUESTIONS missing flags: {', '.join(missing_readiness)}"

    if "{user_input}" in prompts_mod.HELPER_PROMPT:
        return "FAIL", "HELPER_PROMPT must not duplicate {user_input} (belongs in human message only)"

    try:
        prompts_mod.HELPER_PROMPT.format(
            missing_fields_hint="m",
            needs_scripts="False",
            is_repo_context="True",
        )
        prompts_mod.CONSTRUCT_PROMPT.format(
            challenger_xml="<x/>",
            needs_auxiliary_files="False",
            needs_scripts="False",
            is_repo_context="True",
        )
        prompts_mod.UPGRADER_PROMPT.format(
            champion_xml="<x/>",
            champion_prompt="p",
            error_log="e",
            needs_scripts="False",
            is_repo_context="True",
        )
    except Exception as exc:
        return "FAIL", f"prompt template formatting failed: {exc}"

    return (
        "PASS",
        "6+1 rubric keys, readiness flags & 7 prompt exports synced across prompts.py, QaView.tsx, api.ts",
    )


def check_core_files() -> Tuple[str, str]:
    """Check 4: Verify all core repository files exist (and prompts/*.md are non-empty)."""
    missing = [rel for rel in CORE_FILES if not (REPO_ROOT / rel).is_file()]
    if missing:
        return "FAIL", f"missing files: {', '.join(missing)}"
    empty_prompts = [
        rel
        for rel in CORE_FILES
        if rel.startswith("prompts/") and not (REPO_ROOT / rel).read_text(encoding="utf-8").strip()
    ]
    if empty_prompts:
        return "FAIL", f"empty prompt files: {', '.join(empty_prompts)}"
    return "PASS", f"all {len(CORE_FILES)} core files present"


def check_gate_1_5_linter() -> Tuple[str, str]:
    """Check 5: Verify Gate 1.5 deterministic linter rejects defects and passes valid packages."""
    try:
        from validators import validate_compiled_artifacts
    except Exception as exc:
        return "FAIL", f"failed to import validate_compiled_artifacts: {exc}"

    failures: List[str] = []

    missing_fm = validate_compiled_artifacts(
        {
            "target_type": "SKILL_PACKAGE",
            "challenger_prompt": "# No Frontmatter\nJust instructions.\n",
            "reference_files": {},
        }
    )
    if missing_fm.get("passed", True):
        failures.append("missing YAML frontmatter was not rejected")

    broken_ref = validate_compiled_artifacts(
        {
            "target_type": "SKILL_PACKAGE",
            "challenger_prompt": (
                "---\nname: sample-skill\ndescription: Use when testing.\n---\n"
                "See `references/missing.md` for details.\n"
            ),
            "reference_files": {},
        }
    )
    if broken_ref.get("passed", True):
        failures.append("broken reference was not rejected")

    broken_script_ref = validate_compiled_artifacts(
        {
            "target_type": "SKILL_PACKAGE",
            "challenger_prompt": (
                "---\nname: sample-skill\ndescription: Use when testing.\n---\n"
                "Run `python scripts/missing.py` to validate input.\n"
            ),
            "reference_files": {},
        }
    )
    if broken_script_ref.get("passed", True):
        failures.append("missing script reference was not rejected")

    orphan_script = validate_compiled_artifacts(
        {
            "target_type": "SKILL_PACKAGE",
            "challenger_prompt": (
                "---\nname: sample-skill\ndescription: Use when testing.\n---\n"
                "Standard instructions without script links.\n"
            ),
            "reference_files": {
                "scripts/orphan.py": "import sys\nprint(sys.version)\n",
            },
        }
    )
    if orphan_script.get("passed", True):
        failures.append("unreferenced orphan script was not rejected")

    invalid_py_syntax = validate_compiled_artifacts(
        {
            "target_type": "SKILL_PACKAGE",
            "challenger_prompt": (
                "---\nname: sample-skill\ndescription: Use when testing.\n---\n"
                "Run `python scripts/validate.py`.\n"
            ),
            "reference_files": {
                "scripts/validate.py": "def broken_syntax(:\n    return 1\n",
            },
        }
    )
    if invalid_py_syntax.get("passed", True):
        failures.append("invalid Python syntax in scripts/*.py was not rejected")

    valid_pkg = validate_compiled_artifacts(
        {
            "target_type": "SKILL_PACKAGE",
            "challenger_prompt": (
                "---\nname: sample-skill\ndescription: Use when testing.\n---\n"
                "See `references/guide.md` and run `python scripts/validate.py --input data.json`.\n"
            ),
            "reference_files": {
                "references/guide.md": "# Guide\nConcrete steps.\n",
                "scripts/validate.py": (
                    "import json\nimport sys\n\n"
                    "if __name__ == '__main__':\n"
                    "    sys.exit(0)\n"
                ),
            },
        }
    )
    if not valid_pkg.get("passed") or valid_pkg.get("errors"):
        failures.append(f"valid SKILL_PACKAGE failed: {valid_pkg.get('errors')}")

    valid_suite = validate_compiled_artifacts(
        {
            "target_type": "SKILL_SUITE",
            "challenger_prompt": "",
            "reference_files": {
                "skills/alpha/SKILL.md": (
                    "---\nname: alpha\ndescription: Alpha tasks; not beta.\n---\n"
                    "Consult `references/spec.md` and execute `python scripts/check.py`.\n"
                ),
                "skills/alpha/references/spec.md": "# Alpha Spec\n",
                "skills/alpha/scripts/check.py": "import sys\nsys.exit(0)\n",
                "skills/beta/SKILL.md": (
                    "---\nname: beta\ndescription: Beta tasks; not alpha.\n---\n"
                    "Standalone beta workflow.\n"
                ),
            },
        }
    )
    if not valid_suite.get("passed") or valid_suite.get("errors"):
        failures.append(f"valid SKILL_SUITE failed: {valid_suite.get('errors')}")

    if failures:
        return "FAIL", "; ".join(failures)
    return "PASS", "5 defects rejected (incl. AST & script refs), valid SKILL_PACKAGE & SKILL_SUITE passed"


def print_summary(rows: List[Tuple[str, str, str]]) -> None:
    col1_w = max(len("Check"), *(len(r[0]) for r in rows))
    col2_w = max(len("Status"), *(len(r[1]) for r in rows))
    col3_w = max(len("Details"), *(len(r[2]) for r in rows))

    sep = f"+-{'-' * col1_w}-+-{'-' * col2_w}-+-{'-' * col3_w}-+"
    print(sep)
    print(f"| {'Check':<{col1_w}} | {'Status':<{col2_w}} | {'Details':<{col3_w}} |")
    print(sep)
    for name, status, detail in rows:
        print(f"| {name:<{col1_w}} | {status:<{col2_w}} | {detail:<{col3_w}} |")
    print(sep)


def main() -> int:
    checks: List[Tuple[str, Callable[[], Tuple[str, str]]]] = [
        ("1. Git Branch", check_git_branch),
        ("2. Path Sanitizer", check_path_sanitizer),
        ("3. Rubric Parity", check_rubric_parity),
        ("4. Core Files", check_core_files),
        ("5. Gate 1.5 Linter", check_gate_1_5_linter),
    ]

    rows: List[Tuple[str, str, str]] = []
    has_failure = False
    for label, fn in checks:
        status, detail = fn()
        if status == "FAIL":
            has_failure = True
        rows.append((label, status, detail))

    print_summary(rows)
    return 1 if has_failure else 0


if __name__ == "__main__":
    raise SystemExit(main())
