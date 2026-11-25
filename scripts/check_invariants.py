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
OPERATIONAL_RESILIENCE_KEY = "operational_resilience"
SCRIPT_RIGOR_KEY = "script_rigor_and_parity"
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
    "prompts/red_team.md",
    "prompts/attachment_digest.md",
    "prompts/betty_tech_support.md",
    "prompts/betty_prompt_advisor.md",
    "render.yaml",
    "static/index.html",
    "frontend/src/components/common/AttachmentBar.tsx",
    "frontend/src/components/common/EffortTierSelector.tsx",
    "frontend/src/components/common/RedTeamPanel.tsx",
    "frontend/src/components/views/QaView.tsx",
    "frontend/src/types/api.ts",
)

PROMPT_EXPORTS = (
    "HELPER_PROMPT",
    "CONSTRUCT_PROMPT",
    "UPGRADER_PROMPT",
    "ADJUDICATOR_BASELINE_PROMPT",
    "ADJUDICATOR_REGRESSION_PROMPT",
    "RED_TEAM_PROMPT",
    "ATTACHMENT_DIGEST_PROMPT",
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
    """Check 3: Verify dynamic rubric keys match across `prompts.py` and active frontend files."""
    try:
        from prompts import get_rubric_questions
    except Exception as exc:
        return "FAIL", f"failed to import get_rubric_questions from prompts.py: {exc}"

    errors: List[str] = []
    expected_base = set(BASE_RUBRIC_KEYS)

    # Default-arg backward compatibility + full (target_type, needs_scripts) matrix
    cases = [
        ("SYSTEM_PROMPT", None, expected_base),
        ("SYSTEM_PROMPT", False, expected_base),
        ("SYSTEM_PROMPT", True, expected_base),
        ("SKILL_PACKAGE", None, expected_base | {OPERATIONAL_RESILIENCE_KEY}),
        ("SKILL_PACKAGE", False, expected_base | {OPERATIONAL_RESILIENCE_KEY}),
        ("SKILL_PACKAGE", True, expected_base | {OPERATIONAL_RESILIENCE_KEY, SCRIPT_RIGOR_KEY}),
        ("HYBRID_BUNDLE", None, expected_base | {OPERATIONAL_RESILIENCE_KEY}),
        ("HYBRID_BUNDLE", False, expected_base | {OPERATIONAL_RESILIENCE_KEY}),
        ("HYBRID_BUNDLE", True, expected_base | {OPERATIONAL_RESILIENCE_KEY, SCRIPT_RIGOR_KEY}),
        ("SKILL_SUITE", None, expected_base | {OPERATIONAL_RESILIENCE_KEY, SUITE_ONLY_KEY}),
        ("SKILL_SUITE", False, expected_base | {OPERATIONAL_RESILIENCE_KEY, SUITE_ONLY_KEY}),
        ("SKILL_SUITE", True, expected_base | {OPERATIONAL_RESILIENCE_KEY, SCRIPT_RIGOR_KEY, SUITE_ONLY_KEY}),
    ]
    for target, needs_scripts, expected_keys in cases:
        qs = (
            get_rubric_questions(target)
            if needs_scripts is None
            else get_rubric_questions(target, needs_scripts=needs_scripts)
        )
        keys = {q["name"] for q in qs if q.get("type") == "score"}
        if keys != expected_keys:
            errors.append(
                f"prompts.py ({target}, needs_scripts={needs_scripts}) mismatch: "
                f"got {sorted(keys)}, expected {sorted(expected_keys)}"
            )

    frontend_targets = (
        REPO_ROOT / "frontend" / "src" / "components" / "views" / "QaView.tsx",
        REPO_ROOT / "frontend" / "src" / "types" / "api.ts",
    )
    required_all = BASE_RUBRIC_KEYS + (
        OPERATIONAL_RESILIENCE_KEY,
        SCRIPT_RIGOR_KEY,
        SUITE_ONLY_KEY,
    )
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
        prompts_mod.ADJUDICATOR_BASELINE_PROMPT.format(
            user_input="u",
            challenger_xml="<x/>",
            challenger_prompt="p",
            decision_rubric_scores="{}",
            iteration_count=0,
        )
        prompts_mod.ADJUDICATOR_REGRESSION_PROMPT.format(
            user_input="u",
            champion_xml="<x/>",
            champion_prompt="p",
            challenger_xml="<x/>",
            challenger_prompt="p",
            error_log="e",
            decision_rubric_scores="{}",
            iteration_count=1,
        )
        prompts_mod.RED_TEAM_PROMPT.format(
            target_type="SKILL_PACKAGE",
            goal_summary="g",
            compiled_artifact="a",
        )
        prompts_mod.ATTACHMENT_DIGEST_PROMPT.format(
            filename="spec.pdf",
            mime_type="application/pdf",
        )
    except Exception as exc:
        return "FAIL", f"prompt template formatting failed: {exc}"

    return (
        "PASS",
        "dynamic rubric matrix, readiness flags & 7 prompt exports synced across prompts.py, QaView.tsx, api.ts",
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

    unsafe_scripts = {
        "eval()": "import sys\neval(sys.argv[1])\nsys.exit(0)\n",
        "exec()": "import sys\nexec(sys.argv[1])\nsys.exit(0)\n",
        "os.system()": "import os\nimport sys\nos.system(sys.argv[1])\nsys.exit(0)\n",
        "subprocess(..., shell=True)": (
            "import subprocess\nimport sys\n"
            "subprocess.run(sys.argv[1], shell=True)\nsys.exit(0)\n"
        ),
        "missing CLI args": "import sys\nsys.exit(1)\n",
        "missing exit handling": "import argparse\nparser = argparse.ArgumentParser()\nparser.parse_args()\n",
    }
    for label, src in unsafe_scripts.items():
        res = validate_compiled_artifacts(
            {
                "target_type": "SKILL_PACKAGE",
                "challenger_prompt": (
                    "---\nname: sample-skill\ndescription: Use when testing.\n---\n"
                    "Run `python scripts/validate.py`.\n"
                ),
                "reference_files": {"scripts/validate.py": src},
            }
        )
        if res.get("passed", True):
            failures.append(f"AST/CLI linter failed to reject {label}")

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
                    "import argparse\nimport json\nimport sys\n\n"
                    "def main() -> int:\n"
                    "    parser = argparse.ArgumentParser()\n"
                    "    parser.add_argument('--input', required=True)\n"
                    "    args = parser.parse_args()\n"
                    "    if not args.input:\n"
                    "        return 1\n"
                    "    print(json.dumps({'ok': True}))\n"
                    "    return 0\n\n"
                    "if __name__ == '__main__':\n"
                    "    sys.exit(main())\n"
                ),
            },
        }
    )
    if not valid_pkg.get("passed") or valid_pkg.get("errors"):
        failures.append(f"valid SKILL_PACKAGE failed: {valid_pkg.get('errors')}")

    valid_argv_return = validate_compiled_artifacts(
        {
            "target_type": "SKILL_PACKAGE",
            "challenger_prompt": (
                "---\nname: sample-skill\ndescription: Use when testing.\n---\n"
                "Run `python scripts/check_cli.py data.json`.\n"
            ),
            "reference_files": {
                "scripts/check_cli.py": (
                    "import sys\n\n"
                    "def main() -> int:\n"
                    "    if len(sys.argv) < 2:\n"
                    "        return 2\n"
                    "    return 0\n\n"
                    "if __name__ == '__main__':\n"
                    "    raise SystemExit(main())\n"
                ),
            },
        }
    )
    if not valid_argv_return.get("passed") or valid_argv_return.get("errors"):
        failures.append(f"valid sys.argv script failed: {valid_argv_return.get('errors')}")

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
                "skills/alpha/scripts/check.py": (
                    "import sys\n"
                    "if len(sys.argv) < 1:\n"
                    "    sys.exit(1)\n"
                    "sys.exit(0)\n"
                ),
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
    return "PASS", "11 defects rejected (incl. AST security & CLI hygiene), valid packages passed"


def check_effort_profiles_and_auth() -> Tuple[str, str]:
    """Check 6: Verify effort_tier profiles, Gate 2 Fast-Pass policies, and server-side 403 enforcement."""
    import os

    try:
        from fastapi import HTTPException
        from starlette.requests import Request
        import main as main_mod
        import server as server_mod
    except Exception as exc:
        return "FAIL", f"failed to import main/server for effort checks: {exc}"

    failures: List[str] = []

    expected_tiers = {"low", "medium", "high", "overkill"}
    profiles = getattr(main_mod, "EFFORT_PROFILES", {})
    if set(profiles.keys()) != expected_tiers:
        failures.append(f"EFFORT_PROFILES keys mismatch: {sorted(profiles.keys())}")

    if getattr(main_mod, "MASTER_ONLY_EFFORT_TIERS", None) != frozenset({"high", "overkill"}):
        failures.append("MASTER_ONLY_EFFORT_TIERS must equal {'high', 'overkill'}")

    if main_mod.normalize_effort_tier(None) != "medium" or main_mod.normalize_effort_tier("invalid") != "medium":
        failures.append("normalize_effort_tier failed to default unknown/empty input to 'medium'")

    for tier in expected_tiers:
        prof = profiles.get(tier) or {}
        roles = prof.get("roles") or {}
        if set(roles.keys()) != {
            "node_1_helper",
            "node_2_construct",
            "node_3_upgrader",
            "node_4_adjudicator",
            "red_team",
            "betty",
        }:
            failures.append(f"EFFORT_PROFILES[{tier!r}] missing role mappings")
        if "gate_2" not in prof or "auto_red_team" not in prof:
            failures.append(f"EFFORT_PROFILES[{tier!r}] missing gate_2 or auto_red_team")

    if not profiles.get("overkill", {}).get("auto_red_team"):
        failures.append("overkill profile must set auto_red_team=True")

    # Gate 2 Fast-Pass threshold checks
    if main_mod.evaluate_gate_2_fast_pass("low", 0.83, 3.0, 3.5, 0, 1.0, False) != (True, "fast_pass"):
        failures.append("low tier should fast-pass at avg=0.83, min_dim=3.0")
    if main_mod.evaluate_gate_2_fast_pass("medium", 0.83, 3.0, 3.5, 0, 1.0, False)[0]:
        failures.append("medium tier must reject fast-pass when script_rigor_and_parity < 4.0")
    if main_mod.evaluate_gate_2_fast_pass("medium", 0.83, 3.0, 4.0, 0, 1.0, False) != (True, "fast_pass"):
        failures.append("medium tier should fast-pass when script_rigor_and_parity >= 4.0")
    if main_mod.evaluate_gate_2_fast_pass("high", 0.85, 3.2, 4.0, 0, 1.0, False)[0]:
        failures.append("high tier must reject fast-pass below 0.88 / 3.5")
    if main_mod.evaluate_gate_2_fast_pass("high", 0.89, 3.6, 4.0, 0, 1.0, False) != (True, "fast_pass"):
        failures.append("high tier should fast-pass at avg=0.89, min_dim=3.6, script=4.0")
    if main_mod.evaluate_gate_2_fast_pass("overkill", 1.0, 5.0, 5.0, 0, 1.0, False)[0]:
        failures.append("overkill tier must disable Gate 2 Fast Pass")

    # Server-side Master Mode 403 enforcement checks
    def _make_req(headers: Dict[str, str]) -> Request:
        raw_headers = [(k.lower().encode("latin-1"), v.encode("latin-1")) for k, v in headers.items()]
        scope = {"type": "http", "method": "POST", "path": "/api/sessions", "headers": raw_headers}
        return Request(scope)

    prev_master = os.environ.get("MASTER_WORKSPACE_KEY")
    try:
        os.environ.pop("MASTER_WORKSPACE_KEY", None)
        if server_mod._enforce_effort_tier_auth("low", _make_req({})) != "low":
            failures.append("low tier rejected when MASTER_WORKSPACE_KEY unset")
        if server_mod._enforce_effort_tier_auth("medium", _make_req({})) != "medium":
            failures.append("medium tier rejected when MASTER_WORKSPACE_KEY unset")
        for locked_tier in ("high", "overkill"):
            try:
                server_mod._enforce_effort_tier_auth(locked_tier, _make_req({}))
                failures.append(f"{locked_tier} allowed when MASTER_WORKSPACE_KEY unset")
            except HTTPException as exc:
                if exc.status_code != 403:
                    failures.append(f"{locked_tier} returned {exc.status_code} instead of 403 (unset)")

        os.environ["MASTER_WORKSPACE_KEY"] = "unit-test-master-secret"
        for locked_tier in ("high", "overkill"):
            try:
                server_mod._enforce_effort_tier_auth(locked_tier, _make_req({"X-Master-Key": "wrong"}))
                failures.append(f"{locked_tier} allowed with wrong X-Master-Key")
            except HTTPException as exc:
                if exc.status_code != 403:
                    failures.append(f"{locked_tier} returned {exc.status_code} instead of 403 (wrong key)")

            if server_mod._enforce_effort_tier_auth(locked_tier, _make_req({"X-Master-Key": "unit-test-master-secret"})) != locked_tier:
                failures.append(f"{locked_tier} rejected despite valid X-Master-Key")
    finally:
        if prev_master is None:
            os.environ.pop("MASTER_WORKSPACE_KEY", None)
        else:
            os.environ["MASTER_WORKSPACE_KEY"] = prev_master

    if failures:
        return "FAIL", "; ".join(failures)
    return "PASS", "4 effort profiles, Gate 2 Fast-Pass gates & 403 Master Mode locks verified"


def check_red_team_engine() -> Tuple[str, str]:
    """Check 7: Verify Red-Team JSON normalization and overkill single-pass auto-hardening loop guard."""
    try:
        import main as main_mod
    except Exception as exc:
        return "FAIL", f"failed to import main for Red-Team checks: {exc}"

    failures: List[str] = []

    valid_json = (
        '{"verdict": "NEEDS_HARDENING", "summary": "Missing O(N) guard.", '
        '"findings": [{"id": "f1", "severity": "High", "target_file": "scripts/check.py", '
        '"title": "O(N^2) loop", "evidence": "nested scan", "fix": "use set"}], '
        '"patch_directive": "Fix scripts/check.py"}'
    )
    rep1 = main_mod.parse_red_team_report(valid_json)
    if rep1.get("verdict") != "NEEDS_HARDENING" or len(rep1.get("findings") or []) != 1 or rep1.get("parse_error"):
        failures.append(f"valid Red-Team JSON failed normalization: {rep1}")

    fenced_json = (
        '```json\n'
        '{"verdict": "PRODUCTION_READY", "summary": "Clean.", "findings": [], "patch_directive": ""}\n'
        '```'
    )
    rep2 = main_mod.parse_red_team_report(fenced_json)
    if rep2.get("verdict") != "PRODUCTION_READY" or rep2.get("findings") != [] or rep2.get("parse_error"):
        failures.append(f"fenced Red-Team JSON failed normalization: {rep2}")

    rep3 = main_mod.parse_red_team_report("not valid json at all")
    if rep3.get("verdict") != "NEEDS_HARDENING" or not rep3.get("parse_error"):
        failures.append(f"malformed Red-Team fallback failed: {rep3}")

    # Overkill single-pass auto_red_team loop guard
    if (
        main_mod.resolve_next_node(
            "node_4_adjudicator",
            {"effort_tier": "overkill", "error_log": ["[PASS]"], "red_team_auto_ran": False},
        )
        != "node_red_team_auto"
    ):
        failures.append("overkill PASS with red_team_auto_ran=False did not route to node_red_team_auto")

    if (
        main_mod.resolve_next_node(
            "node_4_adjudicator",
            {"effort_tier": "overkill", "error_log": ["[PASS]"], "red_team_auto_ran": True},
        )
        != main_mod.END
    ):
        failures.append("overkill PASS with red_team_auto_ran=True failed to terminate at END")

    if (
        main_mod.resolve_next_node(
            "node_4_adjudicator",
            {"effort_tier": "medium", "error_log": ["[PASS]"], "red_team_auto_ran": False},
        )
        != main_mod.END
    ):
        failures.append("medium PASS unexpectedly routed to node_red_team_auto")

    if (
        main_mod.resolve_next_node(
            "node_red_team_auto",
            {
                "red_team_report": {
                    "verdict": "NEEDS_HARDENING",
                    "patch_directive": "Fix scripts/check.py",
                }
            },
        )
        != "node_3_upgrader"
    ):
        failures.append("node_red_team_auto NEEDS_HARDENING did not route to node_3_upgrader")

    if (
        main_mod.resolve_next_node(
            "node_red_team_auto",
            {"red_team_report": {"verdict": "PRODUCTION_READY", "patch_directive": ""}},
        )
        != main_mod.END
    ):
        failures.append("node_red_team_auto PRODUCTION_READY did not route to END")

    if failures:
        return "FAIL", "; ".join(failures)
    return "PASS", "Red-Team JSON parser (valid/fenced/fallback) & overkill single-pass loop guard verified"


def check_attachment_distillation() -> Tuple[str, str]:
    """Check 8: Verify attachment upload validation, verbatim bypass, and context formatting."""
    try:
        from fastapi import HTTPException
        import main as main_mod
        import server as server_mod
    except Exception as exc:
        return "FAIL", f"failed to import main/server for attachment checks: {exc}"

    failures: List[str] = []

    if server_mod.sanitize_attachment_filename("../../etc/passwd.txt") != "passwd.txt":
        failures.append("path traversal filename was not sanitized to basename")
    if server_mod.sanitize_attachment_filename("..") != "":
        failures.append("'..' filename was not rejected")

    # Validation checks: disallowed ext/MIME (415), invalid magic bytes (415), NUL bytes (415), >10MB (413), >4 files (400)
    validation_cases = [
        ("bad ext", ("malware.exe", "application/octet-stream", b"MZ\x90", 0), 415),
        ("bad pdf magic", ("doc.pdf", "application/pdf", b"NOT_A_PDF", 0), 415),
        ("bad png magic", ("img.png", "image/png", b"NOT_PNG_HEADER", 0), 415),
        ("nul in py", ("script.py", "text/plain", b"print('hi')\x00", 0), 415),
        (
            "oversize >10MB",
            ("big.txt", "text/plain", b"a" * (server_mod.MAX_ATTACHMENT_BYTES + 1), 0),
            413,
        ),
        ("quota >4", ("ok.txt", "text/plain", b"hello", 4), 400),
    ]
    for label, args, expected_status in validation_cases:
        try:
            server_mod.validate_attachment_upload(*args)
            failures.append(f"validation failed to reject {label}")
        except HTTPException as exc:
            if exc.status_code != expected_status:
                failures.append(
                    f"{label} returned HTTP {exc.status_code}, expected {expected_status}"
                )

    clean_name, clean_mime = server_mod.validate_attachment_upload(
        "../../notes.md", "text/markdown", b"# Spec\nUse stdlib.\n", 0
    )
    if clean_name != "notes.md" or clean_mime != "text/markdown":
        failures.append(f"valid markdown upload misclassified: {(clean_name, clean_mime)}")

    # Small UTF-8 text verbatim bypass (0 LLM calls, no raw_bytes/base64/data keys)
    att = main_mod.distill_attachment("rules.txt", "text/plain", b"Rule 1: Always verify.")
    if att.get("mode") != "verbatim" or att.get("digest") != "Rule 1: Always verify.":
        failures.append(f"small text verbatim bypass failed: {att}")
    if any(k in att for k in ("raw_bytes", "base64", "data")):
        failures.append(f"attachment leaked binary/base64 keys: {list(att.keys())}")

    if main_mod.format_context_attachments({"context_attachments": []}) != "":
        failures.append("empty context_attachments did not format as ''")
    formatted = main_mod.format_context_attachments({"context_attachments": [att]})
    if "<ATTACHED_CONTEXT>" not in formatted or "Rule 1: Always verify." not in formatted:
        failures.append(f"populated format_context_attachments unexpected: {formatted!r}")

    if failures:
        return "FAIL", "; ".join(failures)
    return "PASS", "upload validation (400/413/415), verbatim bypass & <ATTACHED_CONTEXT> verified"


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
        ("6. Effort & Auth", check_effort_profiles_and_auth),
        ("7. Red-Team Engine", check_red_team_engine),
        ("8. Attachments", check_attachment_distillation),
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
