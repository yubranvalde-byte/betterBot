# BetterBot 2.0 — Agent Operational Contract

> Deterministic repository map, architectural invariants, and verification gate for coding agents.

## 1. Git & Deployment Policy (Strict)

- **Active branch only:** Work exclusively on `develop`. Verify `git branch --show-current` is `develop` before editing or committing.
- **Protected production branch:** NEVER commit to, merge into, rebase onto, or modify `main` (reserved for Live Production on Render via `render.yaml`).
- **Frontend builds:** Never hand-edit compiled bundles under `static/assets/*` or `static/index.html`; edit `frontend/src/*` and rebuild via Vite (`npm run build` in `frontend/`).

## 2. Directory-as-Router Map

| Path | Exact Responsibility |
| :--- | :--- |
| `server.py` | FastAPI backend, SSE execution stream (`/api/sessions/{id}/stream`), `X-Workspace-ID` / `X-Master-Key` auth, session CRUD, JSON workspace export/import, `.ZIP` export + `BETTERBOT_INSTALL.md`, Betty advisor routes. |
| `storage.py` | SQLite persistence (`betterbot_history.db`) scoped by `owner_id`, idempotent migrations, legacy JSON snapshot import, nested `reference_files` path sanitization (`_normalize_rel_path`) & hydration. |
| `main.py` | LangGraph 2.0 `StateGraph` (Nodes 1–4 + Gate 1.5 `gate_1_5_linter`), tiered Gemini routing & fallback, `gemini-decision-1` Gate 1/2 engine, `SKILL_SUITE`, Delta-Patching. |
| `validators.py` | Zero-LLM stdlib structural linter (`validate_compiled_artifacts`, Gate 1.5) & single-source `normalize_artifact_path` sanitizer. |
| `prompts.py` | Thin stdlib loader + dynamic rubric engine: `HELPER_READINESS_QUESTIONS` (Orthogonality Rule), `get_rubric_questions(target_type)` (6 base + dynamic `trigger_deconfliction`). |
| `prompts/*.md` | Externalized Markdown agent/Betty system prompts (`helper`, `construct`, `upgrader`, `adjudicator_baseline`, `adjudicator_regression`, `betty_tech_support`, `betty_prompt_advisor`). |
| `frontend/` | React + TypeScript + Vite + Tailwind UI source (`src/components/views/QaView.tsx`, `src/types/api.ts`, `src/api/client.ts`); `vite.config.ts` builds into `../static` (`emptyOutDir: true`). |
| `static/index.html`, `static/assets/*` | Vite-compiled production bundle served by FastAPI at `/static` with `no-cache, no-store` headers. Generated artifact — do not hand-edit. |
| `render.yaml` | Render Web Service blueprint (Python `3.11.9`, `uvicorn server:app`, `/api/health`, model & DB environment variables). |
| `scripts/check_invariants.py` | Zero-dependency, zero-LLM stdlib verification script enforcing branch safety, path sanitization, rubric parity, and core file presence. |

## 3. Core Architectural Invariants (Must Not Break)

### Compilation Targets & Graph Pipeline (`main.py`, `prompts.py`)
- `VALID_TARGET_TYPES`: `SKILL_PACKAGE`, `SYSTEM_PROMPT`, `HYBRID_BUNDLE`, `SKILL_SUITE` (2–4 orthogonal atomic skills under `skills/<sub_slug>/SKILL.md`).
- **Gate 1 (`HELPER_READINESS_QUESTIONS`):** Enforces the Orthogonality Rule (default tightly coupled workflows to single-skill targets) and caps interviews at 3 turns before `<ARTIFACT_BLUEPRINT>`.
- **Gate 1.5 (`gate_1_5_linter` in `validators.py`):** Zero-token stdlib linter between `node_2_construct`/`node_3_upgrader` and Gate 2 checking YAML frontmatter, broken/orphan references (`SKILL_SUITE` resolves relative `references/*` to `skills/<sub_slug>/references/*`), `SKILL_SUITE` topology (2–4 slugs), and path safety. Capped at `MAX_LINTER_RETRIES = 1` via `state["linter_retries"]` without incrementing `iteration_count` (`MAX_QA_ITERATIONS = 2` remains strictly reserved for Gate 2).
- **Delta-Patching (`node_3_upgrader`):** Emits only modified/new `### FILE: <path>` blocks and optional `### DELETE: <path>` lines; preserves untouched files in `state["reference_files"]`.

### Model Routing & Budgets (`main.py`, `render.yaml`)
- `FAST_MODEL` = `gemini-4-hydrogen` (`thinking_level="low"` for `node_1_helper` and `betty`).
- `COMPILER_MODEL` = `gemini-4-neon` (`thinking_level="medium"` for `node_2_construct` multi-file targets `HYBRID_BUNDLE`/`SKILL_PACKAGE`/`SKILL_SUITE`/refs and `node_3_upgrader`; `low` for light `SYSTEM_PROMPT` in Construct and Stage B of `node_4_adjudicator`).
- `FALLBACK_MODEL` = `gemini-4-hydrogen` (deterministic fallback chain when `COMPILER_MODEL` fails).
- `DECISION_MODEL` = `gemini-decision-1` via `v1beta/decisions` (`0` output tokens, `5.0s` hard timeout, non-blocking fallback).
- **QA Circuit Breakers:**
  - `MAX_QA_ITERATIONS = 2`.
  - **Fast Pass:** Skip generative Adjudicator when `weighted_avg >= 0.82` and `min_dim_score >= 3.0` (`iteration_count == 0 or beats_champ >= 0.5`).
  - **Plateau Breaker:** Escalate (`ESCALATE`) when improvement stalls (`weighted_avg - prev_weighted_avg < 0.02`, bypassed on manual override).
  - **Progressive Disclosure Monolith Guardrail:** Cap `progressive_disclosure` at `2.0/5.0` and force `FAIL` when `SKILL_PACKAGE` or `HYBRID_BUNDLE` has `needs_auxiliary_files=True` and `0` `references/*` files.

### Security & Multi-Tenant Isolation (`server.py`, `storage.py`, `main.py`)
- **Workspace Isolation:** Every visitor is isolated by UUID in `X-Workspace-ID` -> `owner_id` in SQLite (`storage.py`) and `(owner_id, session_id)` keys in `SESSIONS` (`server.py`). Direct `X-Workspace-ID: master` is rejected (`403`).
- **Master Mode Auth:** `X-Master-Key` is verified against `MASTER_WORKSPACE_KEY` strictly in constant time using `hmac.compare_digest` (`_verify_master_key_value`).
- **Strict Path Sanitization:** `normalize_artifact_path` (`main.py`) and `_normalize_rel_path` (`storage.py`) MUST reject empty strings, null bytes (`\x00`), leading `/` or `\`, drive prefixes (`C:...`), UNC paths (`\\...`, `//...`), `.` / `..` segments, and `:` inside segments — returning `""`.

### Dynamic Rubric Sync (`prompts.py` <-> `frontend/`)
- **6 Base Dimensions (`0–5`):** `intent_alignment`, `token_density_no_bloat`, `trigger_precision`, `progressive_disclosure`, `actionable_clarity`, `output_contract_strength`.
- **Dynamic 7th Dimension (`SKILL_SUITE` only):** `trigger_deconfliction` MUST be appended by `get_rubric_questions("SKILL_SUITE")` and omitted for `SYSTEM_PROMPT`, `SKILL_PACKAGE`, and `HYBRID_BUNDLE`.
- All 6 base keys + `trigger_deconfliction` MUST stay synchronized across `prompts.py`, `frontend/src/components/views/QaView.tsx`, and `frontend/src/types/api.ts`.

### Export Contract (`server.py`)
- `GET /api/sessions/{session_id}/download` packages a `.ZIP` archive rooted cleanly under `<slug_name>/` (preserving nested `references/*` and `skills/<sub_slug>/*`).
- `build_install_guide_md` generates `<slug_name>/BETTERBOT_INSTALL.md` deterministically (`0` LLM calls), **never** named `README.md` (to avoid overwriting target repo docs), and excludes `blueprint.xml` and `BETTERBOT_INSTALL.md` from runtime installation directories.

## 4. Verification Protocol

Before finishing ANY task, run the zero-dependency invariant check and require exit code `0`:

```powershell
python scripts/check_invariants.py
# When working inside the project virtual environment:
.\venv\Scripts\python.exe scripts/check_invariants.py
```
