"""
Deterministic, zero-LLM structural linter (Gate 1.5) and path sanitizer for BetterBot 2.0.
Uses Python stdlib only.
"""

from __future__ import annotations

import ast
import re
from typing import Any, Dict, List, Optional, Set, Tuple

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9_-]*$")
_SUITE_SKILL_RE = re.compile(r"^skills/([^/]+)/SKILL\.md$")
_SUITE_SCRIPT_RE = re.compile(r"^skills/[^/]+/scripts/.+$")
_REF_PATH_RE = re.compile(
    r"(?<![a-zA-Z0-9_./-])((?:skills/[a-zA-Z0-9_-]+/)?(?:references|scripts)/[a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)"
)
_CORE_ENTRYPOINTS = frozenset(
    {
        "SKILL.md",
        "SYSTEM_PROMPT.md",
        "AGENTS.md",
        "blueprint.xml",
        "BETTERBOT_INSTALL.md",
    }
)


def normalize_artifact_path(raw_path: str) -> str:
    """Normalizes relative artifact paths and rejects traversal, drive prefixes, or UNC/empty paths."""
    if not isinstance(raw_path, str):
        return ""
    cleaned = raw_path.strip().strip("`\"'").strip()
    if not cleaned or "\x00" in cleaned:
        return ""
    if (
        re.match(r"^[a-zA-Z]:", cleaned)
        or cleaned.startswith("\\")
        or cleaned.startswith("/")
    ):
        return ""
    cleaned = cleaned.replace("\\", "/").strip("/")
    if not cleaned:
        return ""
    segments = cleaned.split("/")
    for seg in segments:
        if not seg or seg in (".", "..") or ":" in seg:
            return ""
    return "/".join(segments)


def _strip_wrapper(text: str) -> str:
    """Strips `<compilation_check>` blocks and outer Markdown fences."""
    if not text:
        return ""
    body = re.sub(
        r"<compilation_check>.*?</compilation_check>",
        "",
        text,
        flags=re.DOTALL | re.IGNORECASE,
    ).strip()
    code_match = re.search(
        r"^`{3,4}(?:markdown|md)?\s*\n(.*?)\n`{3,4}\s*$",
        body,
        flags=re.DOTALL,
    )
    return code_match.group(1).strip() if code_match else body


def _extract_file_section(primary_text: str, filename: str) -> str:
    """Extracts a `### FILE: <filename>` section from primary prompt text if present."""
    if not primary_text:
        return ""
    stripped = _strip_wrapper(primary_text)
    parts = re.split(r"(?m)^###\s+FILE:\s*(.+?)\s*$", stripped)
    if len(parts) <= 1:
        return ""
    for i in range(1, len(parts), 2):
        norm = normalize_artifact_path(parts[i])
        if norm == filename:
            return parts[i + 1].strip() if i + 1 < len(parts) else ""
    return ""


def _parse_frontmatter(text: str) -> Tuple[bool, Dict[str, str], str]:
    """
    Validates leading YAML frontmatter (`---` ... `---`) and parses top-level scalar fields
    (including single-line quoted values and multi-line `|`/`>` YAML block scalars).
    Returns `(has_valid_delimiters, fields_dict, error_reason)`.
    """
    cleaned = _strip_wrapper(text).lstrip("\ufeff \t\r\n")
    if not cleaned:
        return False, {}, "file is empty"

    lines = cleaned.splitlines()
    if lines[0].strip() != "---":
        return False, {}, "missing opening '---' YAML frontmatter delimiter"

    end_idx: Optional[int] = None
    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            end_idx = idx
            break

    if end_idx is None:
        return False, {}, "missing closing '---' YAML frontmatter delimiter"

    fm_lines = lines[1:end_idx]
    fields: Dict[str, str] = {}
    i = 0
    while i < len(fm_lines):
        line = fm_lines[i]
        stripped_line = line.strip()
        if not stripped_line or stripped_line.startswith("#"):
            i += 1
            continue

        key_match = re.match(r"^([A-Za-z0-9_-]+)\s*:\s*(.*)$", line)
        if not key_match:
            i += 1
            continue

        key = key_match.group(1).strip()
        raw_val = key_match.group(2).strip()

        if raw_val in ("|", "|-", "|+", ">", ">-", ">+") or raw_val == "":
            block_parts: List[str] = []
            j = i + 1
            while j < len(fm_lines):
                next_line = fm_lines[j]
                if not next_line.strip():
                    block_parts.append("")
                    j += 1
                    continue
                if next_line.startswith((" ", "\t")):
                    block_parts.append(next_line.strip())
                    j += 1
                    continue
                break
            fields[key] = " ".join(p for p in block_parts if p).strip()
            i = j
            continue

        if (raw_val.startswith('"') and raw_val.endswith('"') and len(raw_val) >= 2) or (
            raw_val.startswith("'") and raw_val.endswith("'") and len(raw_val) >= 2
        ):
            raw_val = raw_val[1:-1].strip()
        fields[key] = raw_val
        i += 1

    return True, fields, ""


def _validate_skill_frontmatter(label: str, content: str, errors: List[str]) -> None:
    has_fm, fields, fm_err = _parse_frontmatter(content)
    if not has_fm:
        errors.append(f"{label}: invalid YAML frontmatter ({fm_err}).")
        return

    name_val = (fields.get("name") or "").strip()
    desc_val = (fields.get("description") or "").strip()
    if not name_val:
        errors.append(f"{label}: YAML frontmatter missing non-empty 'name' field.")
    elif not _SLUG_RE.match(name_val):
        errors.append(
            f"{label}: YAML 'name' ({name_val!r}) must be a valid lowercase kebab/snake slug."
        )
    if not desc_val:
        errors.append(f"{label}: YAML frontmatter missing non-empty 'description' field.")


def _extract_reference_paths(content: str) -> List[str]:
    """Extracts concrete `references/...` or `skills/<sub_slug>/references/...` paths."""
    if not content:
        return []
    found: List[str] = []
    seen: Set[str] = set()
    for match in _REF_PATH_RE.finditer(content):
        candidate = match.group(1)
        if any(ch in candidate for ch in "<>[]*"):
            continue
        norm = normalize_artifact_path(candidate)
        if norm and norm not in seen:
            seen.add(norm)
            found.append(norm)
    return found


def _is_nonzero_int_expr(node: Optional[ast.AST]) -> bool:
    """Returns True if an AST return expression contains a non-zero integer constant."""
    if node is None:
        return False
    for child in ast.walk(node):
        if (
            isinstance(child, ast.Constant)
            and isinstance(child.value, int)
            and not isinstance(child.value, bool)
            and child.value != 0
        ):
            return True
    return False


def _lint_script_ast(rel_path: str, tree: ast.AST, errors: List[str]) -> None:
    """
    Strictly static AST security and CLI hygiene inspection for generated `scripts/*.py`.
    NEVER executes generated scripts.
    """
    os_aliases: Set[str] = set()
    os_system_aliases: Set[str] = set()
    subprocess_aliases: Set[str] = set()
    subprocess_fn_aliases: Set[str] = set()
    sys_aliases: Set[str] = set()
    sys_argv_aliases: Set[str] = set()
    sys_exit_aliases: Set[str] = set()
    builtins_aliases: Set[str] = set()
    builtins_exec_aliases: Set[str] = set()

    uses_argparse = False
    uses_sys_argv = False
    has_error_exit = False

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                bound = alias.asname or alias.name.split(".")[0]
                if alias.name == "os":
                    os_aliases.add(bound)
                elif alias.name == "subprocess":
                    subprocess_aliases.add(bound)
                elif alias.name == "sys":
                    sys_aliases.add(bound)
                elif alias.name == "argparse":
                    uses_argparse = True
                elif alias.name == "builtins":
                    builtins_aliases.add(bound)
        elif isinstance(node, ast.ImportFrom):
            mod = node.module or ""
            for alias in node.names:
                bound = alias.asname or alias.name
                if mod == "os" and alias.name == "system":
                    os_system_aliases.add(bound)
                elif mod == "subprocess":
                    subprocess_fn_aliases.add(bound)
                elif mod == "sys":
                    if alias.name == "argv":
                        sys_argv_aliases.add(bound)
                    elif alias.name == "exit":
                        sys_exit_aliases.add(bound)
                elif mod == "argparse":
                    uses_argparse = True
                elif mod == "builtins" and alias.name in ("eval", "exec"):
                    builtins_exec_aliases.add(bound)

    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute):
            if (
                isinstance(node.value, ast.Name)
                and node.value.id in sys_aliases
                and node.attr == "argv"
            ):
                uses_sys_argv = True
            elif (
                isinstance(node.value, ast.Name)
                and node.value.id in sys_aliases
                and node.attr == "exit"
            ):
                has_error_exit = True
        elif isinstance(node, ast.Name):
            if node.id in sys_argv_aliases:
                uses_sys_argv = True
            elif node.id == "SystemExit":
                has_error_exit = True
            elif node.id == "argparse":
                uses_argparse = True

        if isinstance(node, ast.FunctionDef) and node.name == "main":
            for inner in ast.walk(node):
                if isinstance(inner, ast.Return) and _is_nonzero_int_expr(inner.value):
                    has_error_exit = True
                    break

        if isinstance(node, ast.Call):
            func = node.func
            lineno = getattr(node, "lineno", "?")
            if isinstance(func, ast.Name):
                if func.id in ("eval", "exec") or func.id in builtins_exec_aliases:
                    errors.append(
                        f"Unsafe execution primitive '{func.id}()' in '{rel_path}' (line {lineno}): "
                        "remove eval/exec and use explicit stdlib parsing (ast/json)."
                    )
                elif func.id in os_system_aliases:
                    errors.append(
                        f"Unsafe execution primitive 'os.system()' via '{func.id}()' in '{rel_path}' (line {lineno}): "
                        "use subprocess.run([...], shell=False) or pure Python stdlib instead."
                    )
                elif func.id in sys_exit_aliases:
                    has_error_exit = True
                elif func.id in subprocess_fn_aliases and any(
                    kw.arg == "shell"
                    and isinstance(kw.value, ast.Constant)
                    and bool(kw.value.value) is True
                    for kw in node.keywords
                ):
                    errors.append(
                        f"Unsafe subprocess shell=True call '{func.id}(..., shell=True)' in '{rel_path}' (line {lineno}): "
                        "pass an argument list with shell=False."
                    )
            elif isinstance(func, ast.Attribute):
                owner_id = func.value.id if isinstance(func.value, ast.Name) else None
                if owner_id in builtins_aliases and func.attr in ("eval", "exec"):
                    errors.append(
                        f"Unsafe execution primitive '{owner_id}.{func.attr}()' in '{rel_path}' (line {lineno}): "
                        "remove eval/exec and use explicit stdlib parsing (ast/json)."
                    )
                elif owner_id in os_aliases and func.attr == "system":
                    errors.append(
                        f"Unsafe execution primitive '{owner_id}.system()' in '{rel_path}' (line {lineno}): "
                        "use subprocess.run([...], shell=False) or pure Python stdlib instead."
                    )
                elif owner_id in subprocess_aliases and any(
                    kw.arg == "shell"
                    and isinstance(kw.value, ast.Constant)
                    and bool(kw.value.value) is True
                    for kw in node.keywords
                ):
                    errors.append(
                        f"Unsafe subprocess shell=True call '{owner_id}.{func.attr}(..., shell=True)' in '{rel_path}' (line {lineno}): "
                        "pass an argument list with shell=False."
                    )
                elif owner_id in sys_aliases and func.attr == "exit":
                    has_error_exit = True
                elif func.attr == "error":
                    has_error_exit = True

    if not (uses_argparse or uses_sys_argv):
        errors.append(
            f"CLI contract missing in '{rel_path}': script must read CLI arguments via `argparse` or `sys.argv`."
        )
    if not has_error_exit:
        errors.append(
            f"CLI error exit handling missing in '{rel_path}': script must exit cleanly on errors via `sys.exit(...)`, `SystemExit`, `parser.error(...)`, or non-zero `return` in `main()`."
        )


def validate_compiled_artifacts(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes objective, zero-token structural validation (Gate 1.5) on compiled artifacts.
    Returns `{"passed": bool, "errors": list[str], "correction_directive": str}`.
    """
    errors: List[str] = []
    target_type = str((state or {}).get("target_type") or "SYSTEM_PROMPT").strip().upper()
    primary_prompt = str((state or {}).get("challenger_prompt") or "")
    raw_ref_files = (state or {}).get("reference_files") or {}
    if not isinstance(raw_ref_files, dict):
        errors.append("state['reference_files'] must be a dict.")
        raw_ref_files = {}

    # 1. Path Safety
    valid_refs: Dict[str, str] = {}
    for raw_key, raw_val in raw_ref_files.items():
        if not isinstance(raw_key, str):
            errors.append(f"Unsafe or non-string artifact path key: {raw_key!r}.")
            continue
        norm_key = normalize_artifact_path(raw_key)
        if not norm_key or norm_key != raw_key:
            errors.append(
                f"Unsafe or unnormalized path key in reference_files: {raw_key!r} "
                "(must pass normalize_artifact_path)."
            )
            continue
        valid_refs[norm_key] = raw_val if isinstance(raw_val, str) else str(raw_val or "")

    # 2. Target-specific YAML Frontmatter & SKILL_SUITE Topology
    skill_docs: List[Tuple[str, str, Optional[str]]] = []

    if target_type == "SKILL_PACKAGE":
        skill_content = valid_refs.get("SKILL.md")
        if skill_content is None:
            skill_content = _extract_file_section(primary_prompt, "SKILL.md") or primary_prompt
        _validate_skill_frontmatter("SKILL.md", skill_content, errors)
        skill_docs.append(("SKILL.md", skill_content, None))

    elif target_type == "HYBRID_BUNDLE":
        skill_content = valid_refs.get("SKILL.md")
        if skill_content is None:
            skill_content = _extract_file_section(primary_prompt, "SKILL.md")
        if not skill_content.strip():
            errors.append("HYBRID_BUNDLE: missing required SKILL.md artifact.")
        else:
            _validate_skill_frontmatter("SKILL.md", skill_content, errors)
            skill_docs.append(("SKILL.md", skill_content, None))

        sys_content = (
            valid_refs.get("SYSTEM_PROMPT.md")
            or valid_refs.get("AGENTS.md")
            or _extract_file_section(primary_prompt, "SYSTEM_PROMPT.md")
            or _extract_file_section(primary_prompt, "AGENTS.md")
        )
        if sys_content:
            sys_label = (
                "AGENTS.md"
                if (valid_refs.get("AGENTS.md") or _extract_file_section(primary_prompt, "AGENTS.md"))
                else "SYSTEM_PROMPT.md"
            )
            skill_docs.append((sys_label, sys_content, None))

    elif target_type == "SKILL_SUITE":
        suite_skills: List[Tuple[str, str]] = []
        seen_slugs: Set[str] = set()
        for rel_path in sorted(valid_refs.keys()):
            m = _SUITE_SKILL_RE.match(rel_path)
            if m:
                sub_slug = m.group(1)
                suite_skills.append((rel_path, sub_slug))
                if not _SLUG_RE.match(sub_slug):
                    errors.append(
                        f"{rel_path}: sub_slug {sub_slug!r} must be lowercase alphanumeric/kebab/snake."
                    )
                if sub_slug in seen_slugs:
                    errors.append(f"SKILL_SUITE: duplicate sub_slug {sub_slug!r}.")
                seen_slugs.add(sub_slug)

        if not (2 <= len(suite_skills) <= 4):
            errors.append(
                f"SKILL_SUITE: expected 2-4 `skills/<sub_slug>/SKILL.md` files, found {len(suite_skills)}."
            )

        for rel_path, sub_slug in suite_skills:
            content = valid_refs[rel_path]
            _validate_skill_frontmatter(rel_path, content, errors)
            skill_docs.append((rel_path, content, sub_slug))

    else:  # SYSTEM_PROMPT or fallback
        for rel_path in sorted(valid_refs.keys()):
            if (
                rel_path.startswith("scripts/")
                or _SUITE_SCRIPT_RE.match(rel_path)
                or rel_path.endswith(".py")
            ):
                errors.append(
                    f"SYSTEM_PROMPT targets forbid executable scripts (`{rel_path}`)."
                )
        if valid_refs and primary_prompt.strip():
            skill_docs.append(("SYSTEM_PROMPT.md", _strip_wrapper(primary_prompt), None))

    # 3. Broken References & Orphan Auxiliary/Script Files
    referenced_keys: Set[str] = set()
    valid_ref_key_set = set(valid_refs.keys())

    for owner_label, doc_content, sub_slug in skill_docs:
        for ref in _extract_reference_paths(doc_content):
            if sub_slug and (ref.startswith("references/") or ref.startswith("scripts/")):
                scoped_ref = f"skills/{sub_slug}/{ref}"
                if scoped_ref in valid_ref_key_set:
                    referenced_keys.add(scoped_ref)
                elif ref in valid_ref_key_set:
                    referenced_keys.add(ref)
                else:
                    errors.append(
                        f"Broken reference in {owner_label}: '{scoped_ref}' (from '{ref}') "
                        "is missing from reference_files."
                    )
            else:
                if ref in valid_ref_key_set:
                    referenced_keys.add(ref)
                else:
                    errors.append(
                        f"Broken reference in {owner_label}: '{ref}' is missing from reference_files."
                    )

    for rel_path in sorted(valid_ref_key_set):
        if rel_path in _CORE_ENTRYPOINTS or _SUITE_SKILL_RE.match(rel_path):
            continue
        if rel_path not in referenced_keys:
            errors.append(
                f"Orphan file in reference_files: '{rel_path}' is not referenced by any SKILL.md."
            )

    # 4. Deterministic Python AST Syntax Validation for scripts/*.py
    for rel_path in sorted(valid_ref_key_set):
        is_script_path = rel_path.startswith("scripts/") or bool(
            _SUITE_SCRIPT_RE.match(rel_path)
        )
        if not (is_script_path and rel_path.endswith(".py")):
            continue
        script_src = (valid_refs.get(rel_path) or "").strip()
        if not script_src:
            errors.append(
                f"Empty Python script '{rel_path}': scripts/*.py must contain valid executable Python 3 stdlib code."
            )
            continue
        try:
            tree = ast.parse(script_src, filename=rel_path)
        except SyntaxError as exc:
            line_info = f"line {exc.lineno}" + (
                f", col {exc.offset}" if exc.offset else ""
            )
            bad_line = (exc.text or "").strip()
            snippet = f" near `{bad_line}`" if bad_line else ""
            errors.append(
                f"Python SyntaxError in '{rel_path}' ({line_info}: {exc.msg}{snippet}). "
                f"Re-emit a syntactically valid Python 3 stdlib `### FILE: {rel_path}` block."
            )
        else:
            _lint_script_ast(rel_path, tree, errors)

    passed = len(errors) == 0
    correction_directive = (
        ""
        if passed
        else "Fix the following deterministic Gate 1.5 structural defects via Delta-Patching:\n"
        + "\n".join(f"- {err}" for err in errors)
    )
    return {
        "passed": passed,
        "errors": errors,
        "correction_directive": correction_directive,
    }
