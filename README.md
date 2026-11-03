# 🧠 BetterBot — The Intelligence Factory (מפעל הבינה)

מערכת מולטי-סוכנים (Multi-Agent System) אוטונומית להנדסת פרומפטים וייצור סוכני AI ברמת Production, המבוססת על **LangGraph**, **FastAPI**, **LangChain** ו-**Google Gemini (`gemini-3.5-flash-lite`)**.

המערכת כוללת **ממשק Web גרפי מלא (Full-Stack Control Center)** עם שידור חי (SSE) של זרימת הסוכנים, סטודיו תוצרים ובקרת איכות, ואת **בטי (Betty)** — עוזרת ויועצת AI צפה דו-מצבית המלווה את המשתמש בזמן אמת.

---

## 🎯 המטרה (Purpose)

כתיבת פרומפט מערכת (System Prompt) איכותי, עמיד ונטול הזיות דורשת היכרות מעמיקה עם טכניקות הנדסת פרומפטים מתקדמות (כגון Chain of Thought, Chain of Verification, Step-Back Prompting, ReAct, Output Fortification ועוד).

**BetterBot** פותר את הפער הזה מקצה לקצה:
1. מקבל מהמשתמש תיאור חופשי בשפה טבעית (בעברית) של הבוט שהוא חולם לבנות.
2. מראיין אותו בקצרה כמו מנהל מוצר וארכיטקט מערכות מנוסה.
3. מתרגם את הדרישות לארכיטקטורה קוגניטיבית מובנית ב-XML (`<GEM_BLUEPRINT>`).
4. מהדר אותה לפרומפט מערכת הנדסי שלם באנגלית.
5. מעביר את התוצר סדרת בדיקות איכות ותיקונים עצמיים אוטונומיים (Hill Climbing / Self-Correction) עד לאישור סופי (`PASS`) או התערבות ידנית מבוקרת (`ESCALATE`).

---

## 💡 הרעיון והארכיטקטורה (Core Concept & Architecture)

המערכת בנויה כגרף מצבים ציקלי (**StateGraph** ב-LangGraph) המנהל ארבעה סוכני AI מתמחים שפועלים יחד במודל **Champion vs. Challenger (Hill Climbing)** עם מנגנון הגנה מובנה (**Circuit Breaker**).

### תרשים זרימת המערכת

```mermaid
flowchart TD
    Start([START]) --> RouteStart{פקודה ידנית\nManual Override?}
    RouteStart -- לא --> Helper["Node 1: The Helper\n(ארכיטקט הדרישות)"]
    RouteStart -- כן --> Upgrader["Node 3: The Upgrader\n(העורך האטומי)"]

    Helper --> CheckBlueprint{האם הופק\nGEM_BLUEPRINT?}
    CheckBlueprint -- "לא (המשך ראיון)" --> UserInput[/קלט משתמש ב-Web / CLI/]
    UserInput --> Helper
    CheckBlueprint -- "כן (סיום ראיון)" --> Construct["Node 2: The Construct\n(מהדר הפרומפטים)"]

    Construct --> Adjudicator["Node 4: The Adjudicator\n(מבקר האיכות - QA)"]
    Upgrader --> Adjudicator

    Adjudicator --> RouteQA{החלטת QA}
    RouteQA -- "PASS" --> EndSuccess([סיום: אישור והצגת פרומפט סופי])
    RouteQA -- "FAIL (ניסיון < 3)" --> Upgrader
    RouteQA -- "ESCALATE או ניסיון >= 3" --> ManualOverride[/מצב עריכה ישירה - Manual Override/]
    ManualOverride --> Upgrader
```

### ארבעת הסוכנים בגרף הליבה

1. **Node 1 — The Helper (`The Requirements Architect`):**
   * **תפקיד:** מראיין את המשתמש בעברית (עד 3–4 סבבי שאלות ממוקדות) כדי לחלץ את המטרה, הפרסונה, סגנון הדיבור, תהליך העבודה והשגיאות שיש להימנע מהן.
   * **היגיון פנימי:** מנהל בלוק חשיבה סמוי (`<thought_process>`) באנגלית, מסיק מסקנות באופן עצמאי (Inference over Interrogation), וממפה את צרכי המשתמש ל**ארסנל הקוגניטיבי**:
     `Chain of Thought (CoT)`, `The Reviewer (CoVe)`, `The Interviewer`, `Skeleton-of-Thought`, `Step-Back Logic`, `ReAct Framework`, `Sentiment Parsing`.
   * **פלט:** תבנית ארכיטקטונית מובנית תחת התגית `<GEM_BLUEPRINT>`.

2. **Node 2 — The Construct (`The Compiler`):**
   * **תפקיד:** מקבל את ה-`<GEM_BLUEPRINT>` ומהדר אותו לפרומפט מערכת שלם ומקצועי באנגלית.
   * **הגנות מובנות:** מבצע בדיקת אימות עצמית (`<compilation_check>`) לפני הפקת הפלט, אוכף סדר פעולות כרונולוגי בין מודולים קוגניטיביים (Hybrid Sequencing), ומחייב **Output Fortification** (4 גרשיים הפוכים ```` למניעת זליגת בלוקים של Markdown).

3. **Node 3 — The Upgrader (`AI System Editor`):**
   * **תפקיד:** נכנס לפעולה כאשר מבקר האיכות פוסל את הפרומפט או כאשר המשתמש מזין הוראת שדרוג ישירה (`[MANUAL OVERRIDE]`).
   * **עבודה מובנית:** משתמש ב-Pydantic Structured Output (`UpgraderOutput`) לניתוח השפעה ועדכון אטומי ומסונכרן של ה-XML והפרומפט גם יחד.

4. **Node 4 — The Adjudicator (`Senior QA Architect`):**
   * **תפקיד:** שומר הסף של המפעל. משתמש ב-Structured Output (`AdjudicatorDecision`) ופועל בשני מצבים:
     * **Baseline QA (איטרציה 0):** בודק את הפרומפט הראשוני מול כוונת המשתמש והבלופרינט.
     * **Regression QA (איטרציה 1+):** משווה את הגרסה החדשה (`Challenger`) מול הגרסה הטובה ביותר עד כה (`Champion`), מוודא שהליקויים תוקנו ולא נוצרה רגרסיה.
   * **Circuit Breaker (מפסק פחת):** אם אחרי 3 איטרציות של תיקון אוטומטי הפרומפט עדיין לא עובר (`FAIL`), המערכת עוצרת ומעבירה את השליטה למשתמש (`ESCALATE`).

---

## 🖥️ ממשק ה-Web והעוזרת האישית "בטי" (Studio-Grade Engineering Workspace)

הממשק עוצב מחדש כסביבת עבודה הנדסית מוקפדת (**Tactical Obsidian Matte**) בהשראת **Linear**, **Cursor** ו-**Raycast** — ללא גרדיאנטים צעקניים או אימוג'ים גולמיים, עם אייקוני **Lucide SVG** מונוכרומטיים, טיפוגרפיית `Heebo` + `JetBrains Mono`, ובידוד BiDi אוטומטי למונחים טכניים (`<code class="tech-token" dir="ltr">`).

### 1. מרכז הבקרה הראשי (Split-Screen Workspace)
* **סרגל טלמטריה אינטראקטיבי בשורה אחת (`48px` Single-Row Telemetry Bar):**
  * מציג בזמן אמת (SSE) את סטטוס המערכת, 4 גלולות הסוכנים (`.agent-node`) ומד ה-**Circuit Breaker** (`0/3` עד `3/3`) ביישור מספרי טבלאי (`tabular-nums`).
  * **ניווט אינטראקטיבי בלחיצה על צומת:** לחיצה על `Node 1` ממקדת את תיבת הקלט, `Node 2` פותח את לשונית `XML Blueprint`, `Node 4` פותח את לשונית `QA`, ו-`Node 3` פותח את לשונית פרומפט המערכת.
* **ניהול סשנים ב-RAM (In-Memory Sessions):** אפשרות לפתוח סשנים חדשים (`+ סוכן חדש`) ולעבור בין סשנים קיימים בזיכרון השרת.
* **זירת האפיון והראיון (חלונית ימנית):**
  * **תבניות התחלה מהירה:** כרטיסיות קומפקטיות עם חיווי `↗` שלחיצה עליהן מזינה את הטקסט לתיבת ההקלדה עם הבהוב מסגרת עדין (`300ms`) לעריכה ושליחה.
  * **מגירת חשיבה סמויה:** בכל הודעת סוכן ניתן לפתוח את בלוק ה-`<thought_process>` הפנימי.
  * **מצב עריכה ישירה (Manual Override):** מופעל אוטומטית בעת `ESCALATE` או לאחר `PASS`, ומאפשר לשלוח פקודות שינוי ישירות ל-`Node 3: The Upgrader`.
* **סטודיו התוצרים ובקרת האיכות (חלונית שמאלית — 4 לשוניות נגישות WAI-ARIA):**
  1. **פרומפט המערכת:** רינדור Markdown מובנה או תצוגת קוד גולמי, שלד טעינה דינמי (Shimmer Skeleton) בזמן הידור/בדיקה, מד תווים וטוקנים (`{chars} תווים · ~{tokens} טוקנים`), חשיפת `<compilation_check>`, העתקה והורדה כקובץ `.md`.
  2. **XML Blueprint:** פירוק ויזואלי של תגיות ה-XML לכרטיסיות (`Title`, `Tone`, `Domain Expertise`, `Cognitive Modules`, `Workflow`, `Negative Constraints`, `Output Format`) לצד קוד ה-XML המלא.
  3. **בקרת איכות (QA) ומציג Diff מאוחד:** יומן החלטות ה-Adjudicator ומנוע השוואת גרסאות (**Champion מול Challenger**) עם מתג מעבר בין **Unified Diff** (סימון שורות שנוספו `+` בירוק ושורות שהוסרו `-` באדום) לבין תצוגת **Side-by-Side**.
  4. **יומן ריצה חי:** ציר זמן מפורט של כל האירועים בסשן.

### 2. בטי (Betty) — מגירת צד ננעלת (Dockable Slide-Over Drawer) וחלון צף
* **מצב עגינה (Docked Drawer — ברירת מחדל) או מצב צף (Floating):** באמצעות כפתור העגינה (`#bettyDockBtn`) בכותרת, בטי נצמדת כמגירת צד שמאלית נקייה (`width: 400px`) או הופכת לחלון צף חופשי הניתן לגרירה ולשינוי גודל מכל 8 הפינות והדפנות.
* **מודעות מלאה להקשר הסשן (`<current_session_context>`):** בטי קוראת בזמן אמת את מצב הסשן הפעיל שלך (שלב נוכחי, ה-XML Blueprint, הפרומפט הנוכחי ויומן השגיאות של ה-QA).
* **בורר מצבים אחוד (Segmented Control):**
  1. **תמיכה טכנית והדרכה (`tech_support`):** מומחית לאפליקציית BetterBot — מסבירה איך המערכת עובדת, מה קורה בכל שלב בגרף, ואיך לתפעל כל כלי ומצב בממשק.
  2. **Prompt Advisor (`prompt_advisor`):** מבוססת על **The Master Prompt Architect & Mentor (Ultimate V5)**. מבצעת ניתוח **Tree of Thoughts (ToT)** ו-**Chain of Verification (CoVe)** בתוך `<thought_process>`, ומייצרת תשובות עומק מובנות הכוללות **ייעוץ וביקורת**, **טבלת השוואת חלופות (Trade-off Matrix)**, **הסבר מונחים** ו**שאלות מנחות**.

---

## 🚀 התקנה ודרך השימוש (Installation & Usage)

### 1. דרישות קדם
* **Python 3.11+**
* מפתח API פעיל של **Google AI Studio (Gemini API)**

### 2. הגדרת הסביבה והתלויות
שכפלו את המאגר והתקינו את התלויות מתוך `requirements.txt`:

```powershell
git clone https://github.com/yubranvalde-byte/betterBot.git
cd betterBot

# יצירת סביבה וירטואלית והפעלתה
python -m venv venv
.\venv\Scripts\activate

# התקנת כלל החבילות (LangGraph, LangChain, FastAPI, Uvicorn, Pydantic וכו')
.\venv\Scripts\pip.exe install -r requirements.txt
```

### 3. הגדרת משתני סביבה
צרו קובץ `.env` בתיקיית השורש של הפרויקט והגדירו בו את מפתח ה-API שלכם:

```env
GOOGLE_API_KEY=your_actual_google_api_key_here
```

### 4. הפעלת אפליקציית ה-Web (מומלץ)
הריצו את שרת ה-FastAPI:

```powershell
.\venv\Scripts\python.exe server.py
```

לאחר ההפעלה, פתחו בדפדפן את הכתובת:
👉 **http://127.0.0.1:8000**

*(לחלופין, ניתן להריץ את המערכת גם במצב טרמינל CLI קלאסי באמצעות `.\venv\Scripts\python.exe main.py`).*

### 5. פריסה לענן (Cloud Deployment via Render)
הפרויקט מותאם במלואו להעלאה כ-**Web Service** ב-[Render](https://render.com) (כולל קובץ Blueprint מובנה `render.yaml`):
* **Build Command:**
  ```bash
  pip install -r requirements.txt
  ```
* **Start Command:**
  ```bash
  uvicorn server:app --host 0.0.0.0 --port $PORT
  ```
* **Environment Variables (בלוח הבקרה של Render):**
  * `GOOGLE_API_KEY`: מפתח ה-API של Google Gemini.
  * `PYTHON_VERSION`: `3.11.9`

---

## 📂 מבנה הקוד והפרויקט (Project Structure)

```text
BetterBot/
├── server.py            # שרת ה-FastAPI: ניהול סשנים ב-RAM, הזרמת SSE לגרף, ונקודות הקצה של בטי
├── main.py              # מנוע ה-LangGraph, הגדרות ה-FactoryState, ארבעת הצמתים, הניתובים ומעטפת ה-CLI
├── prompts.py           # פרומפטי המערכת של 4 סוכני הגרף + 2 פרומפטי המערכת של בטי (תמיכה ויועצת V5)
├── static/              # קבצי ה-Frontend של אפליקציית ה-Web
│   ├── index.html       # מבנה הממשק הדו-חלוני, סרגל הטלמטריה 48px, מציג ה-Diff ומגירת הצד של בטי
│   ├── styles.css       # עיצוב Tactical Obsidian Matte בהשראת Linear/Cursor, מערכת טוקנים ורספונסיביות
│   └── app.js           # לוגיקת ה-Client: האזנה ל-SSE, ניווט צמתים, מנוע Unified Diff, שלדי טעינה ובטי
├── requirements.txt     # רשימת כל חבילות ה-Python והגרסאות המדויקות שלהן (UTF-8 נקי)
├── render.yaml          # קובץ תצורה (Blueprint) לפריסה אוטומטית ב-Render
├── fronter.txt          # מסמך האפיון המקורי למעבר מ-CLI ל-Client-Server
├── .env                 # משתני סביבה (GOOGLE_API_KEY) - מוחרג מ-Git
├── .gitignore           # הגדרות קבצים ותיקיות מוחרגים מבקרת גרסאות
└── README.md            # תיעוד הפרויקט המלא
```
