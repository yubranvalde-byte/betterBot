# prompts.py — BetterBot 2.0: Hybrid Agent & Skill Compiler Architecture

from pathlib import Path

# =====================================================================
# 1. Decision Engine Schemas (`gemini-decision-1` Configs)
# =====================================================================

HELPER_READINESS_QUESTIONS = [
    {
        "name": "target_type",
        "type": "choice",
        "choices": ["SKILL_PACKAGE", "SYSTEM_PROMPT", "HYBRID_BUNDLE", "SKILL_SUITE"],
        "question": (
            "Based on the user's request and interview history, what is the optimal compilation target? "
            "Choose 'SKILL_PACKAGE' for a single modular agent skill/SOP with triggers and optional `references/*`, "
            "'SYSTEM_PROMPT' for a standalone autonomous persona/assistant system prompt, "
            "'HYBRID_BUNDLE' when both a core System Prompt and a modular Skill package are required, or "
            "'SKILL_SUITE' ONLY when the request comprises 2-4 distinct, loosely coupled/orthogonal domains or workflows "
            "requiring separate activation triggers and independent Pick & Mix installation. "
            "ORTHOGONALITY RULE: Default to a single skill ('SKILL_PACKAGE' or 'HYBRID_BUNDLE' + `references/*`) "
            "whenever capabilities are tightly coupled or share a single workflow."
        ),
    },
    {
        "name": "has_core_objective",
        "type": "noul",
        "choices": ["Yes", "No"],
        "question": (
            "Has the user provided (or can we deterministically infer from domain standards) "
            "a clear core objective, role identity, and primary problem to solve?"
        ),
    },
    {
        "name": "has_trigger_or_context",
        "type": "noul",
        "choices": ["Yes", "No"],
        "question": (
            "Is there sufficient clarity on when this agent/skill should activate "
            "(positive triggers, input context, and scope boundaries)?"
        ),
    },
    {
        "name": "has_output_contract",
        "type": "noul",
        "choices": ["Yes", "No"],
        "question": (
            "Are the expected output structure, tone/language, and key operational guardrails "
            "either explicitly stated by the user or clearly inferable?"
        ),
    },
    {
        "name": "needs_auxiliary_files",
        "type": "noul",
        "choices": ["Yes", "No"],
        "question": (
            "Should auxiliary `references/<topic>.md` files be generated via Progressive Disclosure? "
            "Answer 'Yes' for heavy templates, long schemas, or detailed domain reference tables, AND "
            "explicitly answer 'Yes' whenever a SKILL_PACKAGE or HYBRID_BUNDLE spans 3+ distinct work modes, "
            "3+ deep professional sub-domains, or requires domain-specific standards, checklists, thresholds, "
            "or design tokens that should be modularized out of `SKILL.md`."
        ),
    },
    {
        "name": "needs_scripts",
        "type": "noul",
        "choices": ["Yes", "No"],
        "question": (
            "Should deterministic Python 3 stdlib helper scripts (`scripts/<name>.py`) be generated? "
            "Answer 'Yes' ONLY when the user's workflow includes deterministic, repetitive mechanical tasks "
            "(e.g., JSON/CSV validation, schema checks, math/data transformation, file parsing) that should be "
            "offloaded to Python stdlib scripts instead of LLM reasoning. "
            "Answer 'No' for pure writing, ideation, or conversational prompts, and ALWAYS answer 'No' for SYSTEM_PROMPT."
        ),
    },
    {
        "name": "is_repo_context",
        "type": "noul",
        "choices": ["Yes", "No"],
        "question": (
            "Is the user building a repository-level operational contract or root instruction file "
            "for AI coding agents (e.g., `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, or repo context engineering)? "
            "Answer 'Yes' ONLY for repository/codebase coding-agent contracts; answer 'No' for standard chatbot personas, "
            "general system prompts, or standalone non-repo workflows."
        ),
    },
    {
        "name": "ready_to_compile",
        "type": "noul",
        "choices": ["Yes", "No"],
        "question": (
            "Has at least 1 interview clarification turn occurred (or has the user provided a complete specification "
            "across turns, or reached 3 turns) such that The Helper should now compile the <ARTIFACT_BLUEPRINT>?"
        ),
    },
]

ADJUDICATOR_RUBRIC_QUESTIONS = [
    {
        "name": "intent_alignment",
        "type": "score",
        "min_score": 0,
        "max_score": 5,
        "question": "How accurately and completely does the compiled artifact fulfill the user's stated and inferred intent?",
        "rubric": {
            0: "Completely misses user intent or hallucinates unrelated functionality.",
            1: "Captures surface topic but omits critical workflow steps or persona constraints.",
            2: "Partially aligned; noticeable gaps between the XML blueprint and compiled output.",
            3: "Meets core intent with minor omissions in edge-case handling.",
            4: "Strong 1:1 alignment across identity, workflow, and guardrails.",
            5: "Flawless, high-resolution execution of user intent and blueprint specifications.",
        },
    },
    {
        "name": "token_density_no_bloat",
        "type": "score",
        "min_score": 0,
        "max_score": 5,
        "question": (
            "Does the artifact maintain high token density with zero bloat, avoiding redundant visible XML CoT forcing tags "
            "(e.g., mandatory visible <thinking>/<skeleton> output tags) and robotic filler?"
        ),
        "rubric": {
            0: "Severe bloat, repetitive boilerplate, or forces obsolete visible XML CoT tags in user output.",
            1: "Verbose instructions with redundant phrasing and legacy prompt clichés.",
            2: "Moderate fluff; several paragraphs could be compressed without losing signal.",
            3: "Acceptable density, though minor repetitive phrases remain.",
            4: "Crisp, high-signal instructions tailored for native-reasoning frontier models.",
            5: "Optimal token economy; every sentence carries high-leverage behavioral precision.",
        },
    },
    {
        "name": "trigger_precision",
        "type": "score",
        "min_score": 0,
        "max_score": 5,
        "question": (
            "For SKILL_PACKAGE/HYBRID_BUNDLE: Does the YAML frontmatter (`name`, `description`) define crisp positive "
            "and negative activation triggers? For SYSTEM_PROMPT: Are the role boundaries and activation scope unambiguous?"
        ),
        "rubric": {
            0: "Missing YAML frontmatter on a Skill or completely vague role scope.",
            1: "Generic description lacking concrete activation conditions or negative boundaries.",
            2: "Basic trigger description present but overly broad or prone to false activations.",
            3: "Clear positive triggers, but negative triggers/scope boundaries are weak.",
            4: "Precise routing conditions with explicit positive and negative boundaries.",
            5: "Surgical routing specification that guarantees exact activation and zero scope creep.",
        },
    },
    {
        "name": "progressive_disclosure",
        "type": "score",
        "min_score": 0,
        "max_score": 5,
        "question": (
            "Does the artifact properly apply Progressive Disclosure by keeping `SKILL.md` / core instructions "
            "as a lean router + core guardrails and separating deep workflows, heavy templates, schemas, checklists, "
            "or domain standards into `references/<topic>.md` when appropriate? "
            "MANDATORY PENALTY: Any multi-mode or complex `SKILL_PACKAGE` / `HYBRID_BUNDLE` (3+ distinct work modes, "
            "3+ deep sub-domains, domain-specific standards/checklists/tokens, or `NEEDS AUXILIARY FILES: True`) "
            "compiled into a single monolithic `SKILL.md` with 0 `references/*` files MUST score <= 2. "
            "Score 4–5 ONLY when pairing a lean router `SKILL.md` with concrete `references/*` files, OR when "
            "`NEEDS AUXILIARY FILES` is False and `<PROGRESSIVE_DISCLOSURE_REFS>` is `None` for a genuinely compact, "
            "single-mode self-contained skill under ~5KB."
        ),
        "rubric": {
            0: "Monolithic wall of text dumping massive raw templates, multi-mode playbooks, or bulky standards into a single file.",
            1: "Poor structural separation; multi-mode or complex skill mixes high-level routing with bulky static payloads and 0 `references/*` files.",
            2: "Monolithic complex/multi-mode skill lacking `references/*` extraction, OR superficial splitting that dumps shallow paraphrases instead of real operational depth.",
            3: "Acceptable sectioning, though core router conciseness or `references/*` modularity could be sharper.",
            4: "Well-structured modular architecture: lean router `SKILL.md` delegating to concrete `references/<topic>.md` files, OR a compact single-mode skill where `NEEDS AUXILIARY FILES` is False and `<PROGRESSIVE_DISCLOSURE_REFS>` is `None`.",
            5: "Exemplary Progressive Disclosure: ultra-lean `SKILL.md` router + core guardrails paired with deep, production-grade `references/*` files, OR an optimal single-mode compact skill (<5KB) where `NEEDS AUXILIARY FILES` is False.",
        },
    },
    {
        "name": "actionable_clarity",
        "type": "score",
        "min_score": 0,
        "max_score": 5,
        "question": (
            "Does the artifact favor concrete, affirmative operational directives ('Do X using Y') "
            "over passive or purely negative constraint lists ('Don't be vague')?"
        ),
        "rubric": {
            0: "Dominated by vague, passive, or purely negative 'do not' platitudes.",
            1: "Weak operational verbs; relies on generic admonitions instead of concrete procedures.",
            2: "Mix of affirmative steps and vague negative warnings.",
            3: "Mostly actionable workflow with a few generic constraints.",
            4: "Strong affirmative directives and deterministic decision gates.",
            5: "100% operative, deterministic instructions that convert every guardrail into an affirmative behavior.",
        },
    },
    {
        "name": "output_contract_strength",
        "type": "score",
        "min_score": 0,
        "max_score": 5,
        "question": (
            "Is the `<OUTPUT_CONTRACT>` translated into a deterministic, verifiable output specification "
            "with clear structure, edge-case handling, and verification criteria?"
        ),
        "rubric": {
            0: "No output format or verification contract specified.",
            1: "Vague output description (e.g., 'respond nicely in markdown').",
            2: "Basic format outlined but lacks structure or verification gates.",
            3: "Clear output template, though edge-case or ambiguity handling is minimal.",
            4: "Strong output contract paired with an internal verification rubric.",
            5: "Bulletproof, deterministic output contract with explicit structure and self-verification criteria.",
        },
    },
    {
        "name": "challenger_beats_champion",
        "type": "noul",
        "choices": ["Yes", "No"],
        "question": (
            "In regression or manual override iterations, does the Challenger accurately execute all logged QA directives "
            "and AUTHORITATIVE USER MANUAL OVERRIDE DIRECTIVES while maintaining or improving overall architectural quality "
            "compared to the current Champion?"
        ),
    },
]

OPERATIONAL_RESILIENCE_QUESTION = {
    "name": "operational_resilience",
    "type": "score",
    "min_score": 0,
    "max_score": 5,
    "question": (
        "Does the skill/bundle demonstrate production operational resilience: handling real-world edge cases, "
        "Scale Triage for large inputs/repos, Git/rollback safety guardrails when modifying files, "
        "portable `<skill_dir>/scripts/<name>.py` invocation (plus Windows `python` and manual fallbacks), "
        "Net-LOC / Simplification-First discipline, and Language Mirroring defaults?"
    ),
    "rubric": {
        0: "Unsafe or brittle instructions with no edge-case handling, rollback safety, or portability.",
        1: "Major resilience gaps: hardcoded paths, missing safety checks on file edits, or speculative bloat.",
        2: "Partial guardrails, but omits scale triage, rollback safety, or script portability/fallbacks.",
        3: "Acceptable operational hygiene with minor gaps in edge-case triage or fallback clarity.",
        4: "Strong operational resilience covering edge cases, scale triage, rollback safety, and portability.",
        5: "Bulletproof operational resilience: crisp scale triage, rollback guardrails, portable paths/fallbacks, Net-LOC discipline, and Language Mirroring.",
    },
}

SCRIPT_RIGOR_AND_PARITY_QUESTION = {
    "name": "script_rigor_and_parity",
    "type": "score",
    "min_score": 0,
    "max_score": 5,
    "question": (
        "For `scripts/*.py` (when `needs_scripts=True`): Does every deterministic metric, threshold, or check "
        "in `SKILL.md` / `references/*` have 1:1 computational parity in `scripts/*.py`, using O(N) algorithms "
        "and stdlib `ast`/`tokenize`/`json` parsers instead of naive line heuristics, without edge-case bugs "
        "(e.g., multi-line assigned strings vs. docstrings, lazy/`TYPE_CHECKING` imports, extensionless ops files)?"
    ),
    "rubric": {
        0: "Missing scripts despite `needs_scripts=True`, broken parity, or severe parser/runtime flaws.",
        1: "Major Script-Playbook Parity gaps, O(N^2) bottlenecks, or fragile naive line-parsing bugs.",
        2: "Partial implementation; several thresholds from `SKILL.md`/`references/*` are unimplemented or edge-case buggy.",
        3: "Functional stdlib scripts, though minor edge cases (lazy imports, multi-line strings, large inputs) or parity gaps remain.",
        4: "High-rigor O(N) stdlib scripts with full threshold parity and clean handling of common parser edge cases.",
        5: "Exemplary script engineering: 100% Script-Playbook Parity, O(N) single-pass indices, rock-solid `ast`/`tokenize`/`json` parsing, and zero edge-case defects.",
    },
}

TRIGGER_DECONFLICTION_QUESTION = {
    "name": "trigger_deconfliction",
    "type": "score",
    "min_score": 0,
    "max_score": 5,
    "question": (
        "For SKILL_SUITE: Do all sibling skills under `skills/<sub_slug>/SKILL.md` define crisp, mutually exclusive "
        "positive activation triggers and explicit mutual negative triggers in their YAML frontmatter (`description`) "
        "so sibling skills never collide on the same user request?"
    ),
    "rubric": {
        0: "Severe trigger collision; sibling skills share overlapping activation domains with no mutual exclusions.",
        1: "Vague sibling boundaries; multiple skills in the suite could easily activate on the same request.",
        2: "Partial domain separation, but missing explicit mutual negative triggers against sibling skills in YAML frontmatter.",
        3: "Distinct primary domains, though 1-2 sibling skills lack explicit negative exclusion pointers to each other.",
        4: "Clear orthogonal boundaries with explicit positive triggers and mutual negative exclusions across sibling skills.",
        5: "Surgical trigger deconfliction; every `skills/<sub_slug>/SKILL.md` has zero domain overlap and explicit negative triggers excluding its siblings.",
    },
}


def get_rubric_questions(
    target_type: str = "SYSTEM_PROMPT",
    needs_scripts: bool = False,
):
    """
    Returns the target-aware Gate 2 rubric questions for `gemini-decision-1`.
    - `SYSTEM_PROMPT`: preserves the standard 6-dimension rubric.
    - `SKILL_PACKAGE` / `HYBRID_BUNDLE`: appends `operational_resilience` (and `script_rigor_and_parity` when `needs_scripts=True`).
    - `SKILL_SUITE`: appends `operational_resilience`, optional `script_rigor_and_parity`, and `trigger_deconfliction`.
    """
    normalized = (target_type or "SYSTEM_PROMPT").strip().upper()
    if normalized == "SYSTEM_PROMPT":
        return list(ADJUDICATOR_RUBRIC_QUESTIONS)

    questions = list(ADJUDICATOR_RUBRIC_QUESTIONS[:-1])
    questions.append(OPERATIONAL_RESILIENCE_QUESTION)
    if needs_scripts:
        questions.append(SCRIPT_RIGOR_AND_PARITY_QUESTION)
    if normalized == "SKILL_SUITE":
        questions.append(TRIGGER_DECONFLICTION_QUESTION)
    questions.extend(ADJUDICATOR_RUBRIC_QUESTIONS[-1:])
    return questions


# =====================================================================
# 2. Core Agent Prompts (BetterBot 2.0 Architecture)
# =====================================================================

_PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"


def _load_prompt(filename: str) -> str:
    return (_PROMPTS_DIR / filename).read_text(encoding="utf-8").strip()


HELPER_PROMPT = _load_prompt("helper.md")
CONSTRUCT_PROMPT = _load_prompt("construct.md")
UPGRADER_PROMPT = _load_prompt("upgrader.md")
ADJUDICATOR_BASELINE_PROMPT = _load_prompt("adjudicator_baseline.md")
ADJUDICATOR_REGRESSION_PROMPT = _load_prompt("adjudicator_regression.md")
RED_TEAM_PROMPT = _load_prompt("red_team.md")
ATTACHMENT_DIGEST_PROMPT = _load_prompt("attachment_digest.md")
BETTY_TECH_SUPPORT_PROMPT = _load_prompt("betty_tech_support.md")
BETTY_PROMPT_ADVISOR_PROMPT = _load_prompt("betty_prompt_advisor.md")
