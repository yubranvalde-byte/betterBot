# 🧠 BetterBot 2.0 — Hybrid Agent & Skill Compiler (מפעל הבינה)

מערכת מולטי-סוכנים (Multi-Agent System) אוטונומית ודו-שלבית להנדסת פרומפטים, תכנון סוכני AI והידור חבילות **Agent Skills** ברמת Production, המבוססת על **LangGraph**, **FastAPI**, שכבת אחסון דו-מנועית **Neon PostgreSQL + SQLite fallback (`storage.py`)**, ממשק **Vite + React + TypeScript (`frontend/`)**, ואינטגרציה היברידית מדורגת של מודלי **Google Gemini (`gemini-4-neon`, `gemini-4-hydrogen`, ו-`gemini-decision-1`)**.

המערכת כוללת ממשק **Obsidian & Neural Glass Studio (v3.6)** מלא עם שידור חי (SSE), בידוד מרחבי עבודה ו-**סנכרון מרחב עבודה (`Master Mode`)** + ייבוא/ייצוא JSON בלחיצה אחת, ספריית היסטוריית יצירות מתמידה, מעבדת תוצרים היררכית רב-קובצית (`SKILL.md`, `AGENTS.md`, `references/*`, סקריפטי עזר בפייתון stdlib תחת `scripts/*.py`, `skills/<sub_slug>/SKILL.md`, וייצוא `.ZIP` הכולל `BETTERBOT_INSTALL.md`), מד מוכנות וניקוד רובריקות דינמי של 6/7 ממדים (`gemini-decision-1`), ואת **בטי (Betty)** — עוזרת ויועצת ארכיטקטורה צפה ומעוגנת בזמן אמת המודעת גם לטופולוגיית `SKILL_SUITE`.

> [!NOTE]
> **מדיניות ענפים וסביבת Live Production:**
> ענף `main` שמור כגרסת הייצור היציבה המחוברת לפריסה החיה ב-**Render** (המקושרת בקורות החיים). כל עבודת הפיתוח השוטפת, השיפורים והגרסאות החדשות מנוהלים ונדחפים לענף `develop` בלבד, ויימזגו ל-`main` רק לאחר ייצוב ובדיקה מקיפה כדי להבטיח זמינות וריצה חלקה של האתר שבאוויר.

---

## 🎯 המטרה ו-4 יעדי ההידור (Purpose & Compilation Targets)

מודלים מתקדמים בעלי חשיבה טבעית (Native Reasoning) כבר אינם זקוקים לפרומפטים עמוסים ומנופחים עם תגיות חשיבה גלויות. במקום לייצר "קיר טקסט" אחיד, **BetterBot 2.0** ממיר דרישה חופשית בעברית לאחד מארבעה יעדי הידור ייעודיים תחת תבנית `<ARTIFACT_BLUEPRINT>`:

1. **`SKILL_PACKAGE` (`SKILL.md` + `references/*` + `scripts/*.py` אופציונלי):**
   * מפיק קובץ `SKILL.md` מודולרי עם **YAML Frontmatter** מדויק (`name`, `description` הכולל טריגרים חיוביים ושליליים) ונוהל ביצוע תמציתי (SOP).
   * מיישם **חשיפה הדרגתית (Progressive Disclosure)**: תבניות כבדות, סכמות ודוגמאות מופרדות אוטומטית לקובצי עזר תחת `references/<filename>.md`, ומשימות מכניות דטרמיניסטיות (`needs_scripts=True`) מורדות לסקריפטי CLI עצמאיים מבוססי **Python 3 stdlib בלבד** תחת `scripts/<name>.py`.
2. **`SYSTEM_PROMPT` (Constitutional System Prompt / `AGENTS.md`):**
   * מפיק פרומפט מערכת חוקתי בדחיסות טוקנים גבוהה, מונחה-פעולה (Affirmative Actionability) ונטול תגיות CoT גלויות מיותרות, המגובה ברובריקת אימות פנימית שקטה (`<VERIFICATION_RUBRIC>`). במצב **`is_repo_context=True`** (חוזה תפעולי לסוכני קוד בריפו), הפלט מיוצא ישירות כקובץ **`AGENTS.md`** ממוקד-ריפו (Git/Branch Guardrails, טבלת Directory-as-Router, אינווריאנטים ופרוטוקול אימות) ללא הוספת יעד חמישי וללא סקריפטי `scripts/*.py`.
3. **`HYBRID_BUNDLE` (`SYSTEM_PROMPT.md` / `AGENTS.md` + `SKILL.md` + `references/*` + `scripts/*.py` אופציונלי):**
   * מפיק חבילה משולבת הכוללת גם זהות ליבה חוקתית (או `AGENTS.md` במצב ריפו) וגם סקיל מודולרי נפרד וקובצי עזר/סקריפטים, הארוזה להורדה ישירה כארכיון `.zip` תחת `<slug_name>/` בצירוף `BETTERBOT_INSTALL.md`.
4. **`SKILL_SUITE` (`skills/<sub_slug>/SKILL.md` + `skills/<sub_slug>/references/*` + `skills/<sub_slug>/scripts/*.py` אופציונלי):**
   * מהדר חבילה רב-סקילית של 2–4 סקילים אטומיים הניתנים להתקנה עצמאית (Pick & Mix) בעץ תיקיות מקונן תחת `skills/<sub_slug>/...`, עם ייצוא `.zip` היררכי תחת `<slug_name>/` ו-`BETTERBOT_INSTALL.md`.
   * כפוף ל**כלל האורתוגונליות (Orthogonality Rule)** ב-Gate 1: המערכת בוחרת כברירת מחדל בסקיל יחיד (`SKILL_PACKAGE` או `HYBRID_BUNDLE` + `references/*`) עבור תהליך עבודה מצומד, ומפעילה `SKILL_SUITE` רק ל-2–4 דומיינים נפרדים, תוך אכיפת טריגרים שליליים הדדיים ב-`description` של כל סקיל אח למניעת התנגשות טריגרים.

---

## 💡 הארכיטקטורה ההיברידית ומנוע ההחלטות (`gemini-decision-1`)

המערכת בנויה כגרף מצבים ציקלי (**StateGraph** ב-LangGraph) המשלב **מודל החלטות חד-מעברי (`gemini-decision-1` — 0 טוקני פלט)** כשני שערי בקרה כמותיים (**Gate 1 & Gate 2**) לצד ניתוב מודלים מדורג בין **`gemini-4-neon`** (להידור, שדרוג אטומי וביקורת איכות) לבין **`gemini-4-hydrogen`** (לראיון, בטי ו-Fallback):

### תרשים זרימת המערכת (BetterBot 2.0)

```mermaid
flowchart TD
    Start([START]) --> RouteStart{פקודה ידנית\nManual Override?}
    RouteStart -- לא --> Gate1["Gate 1: gemini-decision-1\nReadiness & Target Classifier"]
    RouteStart -- כן --> Upgrader["Node 3: The Upgrader 2.0\n(Delta-Patcher אטומי רב-קבצי)"]

    Gate1 -- "missing_fields_hint +\nTARGET_TYPE" --> Helper["Node 1: The Helper\n(ארכיטקט הדרישות)"]
    Helper --> CheckBlueprint{האם הופק\nARTIFACT_BLUEPRINT?}
    CheckBlueprint -- "לא (המשך ראיון)" --> UserInput[/קלט משתמש ב-Web / CLI/]
    UserInput --> Gate1
    CheckBlueprint -- "כן (סיום ראיון)" --> Construct["Node 2: The Construct 2.0\n(מהדר סקילים ופרומפטים)"]

    Construct --> Gate15["Gate 1.5: validators.py\nDeterministic Structural Linter (0 טוקנים)"]
    Upgrader --> Gate15
    Gate15 -- "FAIL (ניסיון < 1)" --> Upgrader
    Gate15 -- "PASS או תקרה (1)" --> Gate2["Gate 2: gemini-decision-1\nDynamic 6/7-Point Rubric Scorer"]

    Gate2 --> FastCheck{"Fast Pass >= 82%\n& Min Dim >= 3.0?"}
    FastCheck -- "כן (0 טוקנים)" --> EndSuccess([PASS: אישור מהיר ושמירה ב-DB])
    FastCheck -- לא --> PlateauCheck{"Plateau Detected?\n(שיפור < 0.02)"}
    PlateauCheck -- כן --> Escalate([ESCALATE: עצירה להתערבות ידנית])
    PlateauCheck -- לא --> Adjudicator["Node 4: The Adjudicator 2.0\n(הפקת correction_directive ממוקדת)"]

    Adjudicator --> RouteQA{החלטת QA}
    RouteQA -- "PASS" --> EndSuccess
    RouteQA -- "FAIL (ניסיון < 2)" --> Upgrader
    RouteQA -- "ESCALATE או ניסיון >= 2" --> Escalate
    Escalate --> ManualOverride[/מצב עריכה ישירה - Manual Override/]
    ManualOverride --> Upgrader
```

### שערי המנוע ההיברידי וארבעת הסוכנים

1. **Gate 1 — בדיקת מוכנות ראיון וכלל האורתוגונליות (`gemini-decision-1` + `HELPER_READINESS_QUESTIONS`):**
   * מעריך בכל תור שיחה 8 שדות (`target_type` מתוך 4 ערכים חוקיים: `SKILL_PACKAGE`, `SYSTEM_PROMPT`, `HYBRID_BUNDLE`, `SKILL_SUITE`; וכן `has_core_objective`, `has_trigger_or_context`, `has_output_contract`, `needs_auxiliary_files`, `needs_scripts`, `is_repo_context`, `ready_to_compile`), אוכף את **כלל האורתוגונליות (Orthogonality Rule)** למניעת פיצול יתר של תהליכי עבודה מצומדים, ומזריק ל-Helper רמז מדויק (`missing_fields_hint`).
2. **Node 1 — The Helper (`The Requirements Architect`):**
   * מראיין את המשתמש בעברית (עד 3 סבבים) בעקרון **Inference over Interrogation**, ממקד סשנים במצב `is_repo_context=True` בטופולוגיית ריפו ואילוץ אימות במקום פרסונת צ'אטבוט, ומפיק תבנית `<ARTIFACT_BLUEPRINT>` הכוללת `<META>`, `<IDENTITY_AND_STANCE>`, `<ROUTING_AND_TRIGGERS>`, `<EXECUTION_ARCHITECTURE>` ו-`<OUTPUT_CONTRACT>` (תוך תמיכה מלאה לאחור ב-`<GEM_BLUEPRINT>`). כאשר `target_type == "SKILL_SUITE"`, התבנית כוללת גם `<SUITE_TOPOLOGY>` המגדיר 2–4 סקילים אטומיים (`slug`, `single_responsibility`, `positive_triggers`, ו-`negative_triggers_vs_siblings`).
3. **Node 2 — The Construct 2.0 (`The Hybrid Compiler`):**
   * מופעל על ידי `COMPILER_MODEL` (`gemini-4-neon` עם Fallback אוטומטי ל-`FALLBACK_MODEL` / `gemini-4-hydrogen`), עם `thinking_level="medium"` לחבילות רב-קובציות (`SKILL_PACKAGE` / `HYBRID_BUNDLE` / `SKILL_SUITE` / קובצי `references/` / `scripts/`) ו-`thinking_level="low"` ל-`SYSTEM_PROMPT` קל. מפצל בלוקי `### FILE: <path>` מקוננים (כגון `references/...`, `scripts/<name>.py`, `AGENTS.md`, `skills/<sub_slug>/SKILL.md`, `skills/<sub_slug>/references/<file>.md`, ו-`skills/<sub_slug>/scripts/<name>.py`) דרך סניטציית נתיבים קשיחה (`normalize_artifact_path` הדוחה נתיבים ריקים, אבסולוטיים או קטעי `..`) וניקוי דפנסיבי של בלוקי קוד מקבצי `.py` (`_strip_python_code_fence`) לתוך מפת `state["reference_files"]` האחידה.
4. **Gate 1.5 — לינטר מבני דטרמיניסטי (`validators.py` — `gate_1_5_linter`, 0 טוקנים):**
   * מופעל אוטומטית אחרי `The Construct 2.0` ו-`The Upgrader 2.0` ולפני Gate 2 (`gemini-decision-1`) כדי לתפוס כשלים מבניים אובייקטיביים באפס קריאות LLM: תקינות YAML Frontmatter (`name`, `description`), אימות תחביר Python דטרמיניסטי באמצעות `ast.parse()` על כל `scripts/*.py` (`skills/<sub_slug>/scripts/*.py`), איסור סקריפטים ב-`SYSTEM_PROMPT`, קישורי `references/*` ו-`scripts/*` שבורים או קבצים יתומים (כולל רזולוציית נתיבים יחסית תחת `skills/<sub_slug>/...` ב-`SKILL_SUITE`), טופולוגיית 2–4 סקילים ב-`SKILL_SUITE`, זיהוי `AGENTS.md` כנקודת כניסה חוקית, ובטיחות נתיבים (`normalize_artifact_path`). מוגבל לתקרה ייעודית של `MAX_LINTER_RETRIES = 1` דרך `linter_retries` מבלי לצרוך את תקציב ה-QA של Gate 2 (`MAX_QA_ITERATIONS = 2`).
5. **Gate 2 & Node 4 — The Adjudicator 2.0 (`gemini-decision-1` + `get_rubric_questions`):**
   * **Stage A (דירוג כמותי דינמי ב-v1beta/decisions ב-~500ms):** מופעל באמצעות `get_rubric_questions(target_type)` — שומר על 6 הממדים הסטנדרטיים (`intent_alignment`, `token_density_no_bloat`, `trigger_precision`, `progressive_disclosure`, `actionable_clarity`, ו-`output_contract_strength`) עבור `SYSTEM_PROMPT`, `SKILL_PACKAGE` ו-`HYBRID_BUNDLE`, ומוסיף דינמית ממד שביעי `trigger_deconfliction` (0–5) עבור `SKILL_SUITE` בלבד — תוך העברת מלוא תוכן `reference_files` להערכה, עיגון מתמשך של כל הנחיות `[MANUAL OVERRIDE]` בתוך כוונת המשתמש (`effective_user_input`), והערכת `challenger_beats_champion` מול ה-Champion הקודם.
   * **Stage B (Fast Pass / Manual Override Calibration / Plateau Breaker):** מאשר מיידית ללא קריאת LLM יצרנית כשהציון המשוקלל `>= 0.82` (וכל ממד `>= 3.0`), או לאחר עקיפה ידנית (`post_override_pass` כאשר `min_dim_score >= 3.0` ו-`weighted_avg >= 0.82` או `beats_champ >= 0.5`, תוך קידום ל-Champion ועקיפת Plateau Breaker שלאחר Override); מגן מפני מונוליטים באמצעות חסם דטרמיניסטי (`progressive_disclosure <= 2.0` + `FAIL` כשנדרשים `references/*` וחסרים בפועל) לצד ניקוד מכויל לסקילים קומפקטיים חד-קובציים (`<5KB` כש-`needs_auxiliary_files=False`); עוצר ב-`ESCALATE` בזיהוי קיפאון (עלייה `< 0.02`), או מפיק `correction_directive` ממוקד באמצעות `ADJUDICATOR_MODEL` (`gemini-4-neon`, `thinking_level="low"`, עם Fallback ל-`gemini-4-hydrogen`) — מוגבל ל-`MAX_QA_ITERATIONS = 2`.
6. **Node 3 — The Upgrader 2.0 (`Atomic Delta-Patcher`):**
   * מופעל על ידי `UPGRADER_MODEL` (`gemini-4-neon`, `thinking_level="medium"`, עם Fallback ל-`gemini-4-hydrogen`) ופועל בשיטת **Delta-Patching** במקום שכתוב מלא: פולט רק בלוקי `### FILE: <path>` שנוספו/שונו (כולל `scripts/*.py` ו-`AGENTS.md`) והנחיות `### DELETE: <path>` אופציונליות, ממזג את השינויים אל `state["reference_files"]` תוך שמירת שאר הקבצים ללא מגע, ומסנכרן אטומית את `<ARTIFACT_BLUEPRINT>` ואת קובצי הליבה בעקבות כשלון QA או פקודת `[MANUAL OVERRIDE]`.

---

## 🖥️ ממשק ה-Studio, התמדה דו-מנועית וייצוא חבילות (v3.6)

* **אחסון דו-מנועי מתמיד — Neon PostgreSQL + SQLite Fallback ([storage.py](storage.py)):**
  * תמיכה מובנית ב-**Neon PostgreSQL** בפרודקשן (`DATABASE_URL` דרך `psycopg` v3) עם נפילה אוטומטית (Zero-Config Fallback) ל-**SQLite** מקומי (`betterbot_history.db`) באמצעות מתאם החיבורים המאוחד `_ConnAdapter`.
  * כולל הידרציה מסוננת של נתיבי `reference_files` מקוננים ודגלי `needs_scripts` / `is_repo_context`, מיגרציות אידמפוטנטיות לפי `owner_id`, ושחזור אוטומטי מ-`betterbot_sessions_snapshot.json` במידה וקיים.
  * הסשן הפעיל וחלון העבודה האחרון משוחזרים אוטומטית ברענון הדף דרך `localStorage`.
* **בידוד מרחבי עבודה, `Master Mode` וניוד JSON (Multi-Tenant Isolation & Portability):**
  * כל דפדפן מבודד אוטומטית תחת מזהה UUID (`betterbot_workspace_id`) הנשלח בכותרת `X-Workspace-ID`, ומפריד ברמת ה-`owner_id` ב-PostgreSQL/SQLite, במטמון הזיכרון (`SESSIONS`) ובהיסטוריית בטי (`Betty`).
  * מודאל **"סנכרון מרחב עבודה"** (`WorkspaceSyncModal`) ומצב **`Master Mode`** אופציונלי (`MASTER_WORKSPACE_KEY` דרך כותרת `X-Master-Key` ואימות `POST /api/workspace/verify-master`) מאפשרים לבעלים גישה מכל דפדפן להיסטוריה המרכזית ללא חומת התחברות.
  * כפתורי **ייצוא / ייבוא JSON** בלחיצה אחת (`GET /api/workspace/export` ו-`POST /api/workspace/import`) מספקים גיבוי ושחזור ניידים עם Upsert אידמפוטנטי ומיפוי מזהים מחדש בהתנגשות בין מרחבים.
* **כיול זמני חשיבה וניתוב מודלים (Thinking Budget, Tiered Routing & Fallback):**
  * `FAST_MODEL` (`gemini-4-hydrogen`, `thinking_level="low"`): משמש את `The Helper`, בטי (`Betty`), ומשמש כיעד `FALLBACK_MODEL` דטרמיניסטי.
  * `COMPILER_MODEL` (`gemini-4-neon`): משמש את `The Construct 2.0` (`thinking_level="medium"` עבור `SKILL_PACKAGE`, `HYBRID_BUNDLE`, `SKILL_SUITE`, `references/` או `scripts/`, ו-`low` ל-`SYSTEM_PROMPT` קל), את `The Upgrader 2.0` (`thinking_level="medium"`), ואת Stage B ב-`The Adjudicator 2.0` (`thinking_level="low"`), עם Fallback אוטומטי ל-`FALLBACK_MODEL` / `gemini-4-hydrogen`.
  * שער ההחלטות `v1beta/decisions` (`gemini-decision-1`) רץ ב-~500ms בלבד עם 0 טוקני פלט ו-Timeout קשיח של 5 שניות.
* **ספריית היסטוריית יצירות (History Drawer):**
  * מגירת צד (`HistoryDrawer`) עם חיפוש חופשי, סינון לפי `SKILL_PACKAGE` / `SYSTEM_PROMPT` / `HYBRID_BUNDLE` / `SKILL_SUITE` (`SUITE`), תגיות סטטוס מובחנות, איפוס קובץ פעיל במעבר בין סשנים, שינוי שם (`PATCH /api/sessions/{id}`), מחיקה (`DELETE /api/sessions/{id}`), וייצוא/ייבוא JSON.
* **סטודיו תוצרים היררכי וייצוא `.ZIP` (`ArtifactsView`):**
  * בורר קבצים חכם (`buildArtifactTree`): מקבץ עץ תיקיות פר `<sub_slug>` עבור `SKILL_SUITE` (עם בחירה אוטומטית של ה-`SKILL.md` הראשון כשהפרומפט הראשי ריק), מציג וממיין קובצי `AGENTS.md`, `SKILL.md`, `references/*` ו-`scripts/*.py`, לצד כרטיסיות Bento עבור `<ARTIFACT_BLUEPRINT>`.
  * כפתור **"הורד חבילה (.ZIP)"** (`GET /api/sessions/{id}/download`) אורז הכול תחת תיקיית שורש נקייה `<slug_name>/` (כולל `AGENTS.md` במצב `is_repo_context`, `scripts/*.py` ו-`blueprint.xml`) בצירוף מדריך **`<slug_name>/BETTERBOT_INSTALL.md`** דטרמיניסטי (0 קריאות LLM, בשיטת "Do No Harm" — כולל אזהרת מיזוג לפני דריסת `AGENTS.md`/`CLAUDE.md`/`GEMINI.md`, תיעוד סקריפטי Python 3 stdlib-only ללא צורך ב-`pip install`, והחרגת `blueprint.xml` מהרצה).
* **Decision 1 Rubric Scorecard (`QaView`) ומד מוכנות (`InterviewView`):**
  * מציג 6 ממדי רובריקה עם רכיבי `PrismBar` (0–5), ומוסיף דינמית את הממד השביעי `trigger_deconfliction` (**Trigger De-confliction**) רק בסשני `SKILL_SUITE`, לצד ציון משוקלל, אינדיקטור `Challenger > Champion` ומשווה Unified / Side-by-Side Diff.
* **בטי (Betty) — AI Advisor:**
  * פאנל צד דו-מצבי (`Tech Support` ו-`Prompt Advisor`) עם היסטוריה ומטמון מבודדי-מרחב (`owner_id`) והקשר חי מלא הכולל `target_type`, עץ קובצי `skills/<sub_slug>/...` וטריגרים הדדיים, ציוני `gemini-decision-1` (כולל `trigger_deconfliction`), והנחיות התקנה דרך `BETTERBOT_INSTALL.md`.

---

## 🚀 התקנה, פריסה ומשתני סביבה (Installation & Deployment)

### 1. התקנה והרצה מקומית
```powershell
git clone https://github.com/yubranvalde-byte/betterBot.git
cd betterBot

python -m venv venv
.\venv\Scripts\activate
.\venv\Scripts\pip.exe install -r requirements.txt
.\venv\Scripts\python.exe server.py
```
לאחר ההפעלה פתחו בדפדפן: 👉 **http://127.0.0.1:8000**

### 2. משתני סביבה (`.env` ו-`render.yaml`)
| משתנה | ברירת מחדל | תיאור |
| :--- | :--- | :--- |
| `GOOGLE_API_KEY` | *(חובה)* | מפתח API פעיל של Google AI Studio / Gemini |
| `FAST_MODEL` | `gemini-4-hydrogen` | המודל המהיר (`thinking_level="low"`) לראיון (`The Helper`), בטי (`Betty`) ול-Fallback |
| `COMPILER_MODEL` | `gemini-4-neon` | המודל המרכזי (`The Construct 2.0` ב-`medium`/`low`, `The Upgrader 2.0` ב-`medium`, ו-`The Adjudicator 2.0` ב-`low`) |
| `FALLBACK_MODEL` | `gemini-4-hydrogen` | יעד Fallback דטרמיניסטי בעת כשל או אי-זמינות של `COMPILER_MODEL` |
| `DECISION_MODEL` | `gemini-decision-1` | מנוע ההחלטות החד-מעברי לשערי מוכנות ראיון ורובריקות QA (Gate 1 & Gate 2) |
| `HELPER_MODEL` / `CONSTRUCT_MODEL` / `UPGRADER_MODEL` / `ADJUDICATOR_MODEL` / `BETTY_MODEL` | *(אופציונלי — ברירת מחדל לפי תפקיד)* | עקיפת מודל מפורשת פר-סוכן או תפקיד בסביבה |
| `DATABASE_URL` | *(אופציונלי — Fallback ל-SQLite דרך `DB_PATH`)* | מחרוזת חיבור ל-**Neon PostgreSQL** בפרודקשן (דרך `psycopg` v3; בהיעדרה המערכת נופלת אוטומטית ל-SQLite מקומי) |
| `DB_PATH` | `betterbot_history.db` | נתיב קובץ מסד הנתונים של SQLite לשמירת סשנים והיסטוריה מקומית (Fallback) |
| `MASTER_WORKSPACE_KEY` | *(אופציונלי)* | מפתח סודי להפעלת `Master Mode` וגישה מאובטחת להיסטוריית הבעלים המרכזית בפריסה משותפת / Render (אימות בזמן-קבוע דרך כותרת `X-Master-Key`) |

---

## 📂 מבנה הקוד והפרויקט (Project Structure)

```text
BetterBot/
├── server.py                  # שרת FastAPI: הזרמת SSE, בידוד מרחבים (X-Workspace-ID / X-Master-Key), ייבוא/ייצוא JSON, CRUD, ייצוא .ZIP היררכי (כולל AGENTS.md ו-scripts/*.py) + BETTERBOT_INSTALL.md והקשר חי לבטי
├── storage.py                 # שכבת התמדה דו-מנועית לפי owner_id: Neon PostgreSQL (DATABASE_URL / psycopg v3) + SQLite Fallback, מיגרציות אידמפוטנטיות והידרציית reference_files ודגלי מצב
├── main.py                    # מנוע LangGraph 2.0, gemini-decision-1 (Gate 1/2), Gate 1.5, סקריפטי stdlib (needs_scripts), מצב AGENTS.md (is_repo_context), תמיכת SKILL_SUITE, Delta-Patching וכיול Manual Override
├── validators.py              # לינטר מבני דטרמיניסטי Gate 1.5 באפס טוקנים (YAML frontmatter, ast.parse() על scripts/*.py, הפניות, SKILL_SUITE topology, AGENTS.md) ו-normalize_artifact_path
├── prompts.py                 # טוען stdlib דק + רובריקות דינמיות (HELPER_READINESS_QUESTIONS כולל needs_scripts ו-is_repo_context, get_rubric_questions עם trigger_deconfliction)
├── prompts/                   # תבניות Markdown מופרדות פר-סוכן (helper, construct, upgrader, adjudicator_baseline, adjudicator_regression, betty_*)
├── frontend/                  # אפליקציית ה-Studio ב-Vite + React + TypeScript + Tailwind (src/api/client.ts, components/, utils/, types/) הנבנית ישירות ל-static/
├── static/                    # תוצרי הפרודקשן המהודרים ע"י Vite בלבד (index.html, favicon.svg, assets/*) — אין לערוך ידנית
├── scripts/
│   └── check_invariants.py    # שער אימות ארכיטקטוני באפס תלויות ו-0 קריאות LLM (ענף, סניטציית נתיבים, רובריקות, קבצים ולינטר)
├── AGENTS.md                  # חוזה תפעולי, מפת ארכיטקטורה וכללי אימות לסוכני קוד
├── requirements.txt           # חבילות Python וגרסאות
├── render.yaml                # קובץ Blueprint לפריסה ב-Render כולל משתני המודלים וה-DB
├── .gitignore                 # החרגת סביבה, סודות ומסדי נתונים מקומיים
└── README.md                  # תיעוד הפרויקט
```
