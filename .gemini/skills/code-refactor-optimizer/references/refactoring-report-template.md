# Refactoring Audit & Execution Report Template

Use this exact deterministic structure when presenting Phase 1 (Audit & Refactoring Blueprint) and Phase 2 (Execution & Diff Generation) deliverables. Keep all narrative explanations in **Hebrew** and all file paths, symbols, and code blocks in **English**.

---

## 1. תקציר מנהלים ואבחון ארכיטקטוני (Executive Summary)
* **היקף הסריקה (Scanned Scope):** `[List directories/modules/files analyzed]`
* **מצב בריאות הקוד (Architectural Health Overview):** `[2-4 sentences in Hebrew summarizing structural strengths, primary technical debt hotspots, coupling issues, and test coverage readiness]`
* **מטרות ה-Refactoring המרכזיות (Primary Objectives):**
  * `[Objective 1 in Hebrew - e.g., צמצום כפילויות קוד בשכבת הוולידציה וה-Services]`
  * `[Objective 2 in Hebrew - e.g., הורדת סיבוכיות ציקלומטית בפונקציות הליבה]`
  * `[Objective 3 in Hebrew - e.g., הפרדת לוגיקה עסקית משכבת ה-I/O וה-Database]`

---

## 2. מטריצת ממצאים ותעדוף (Prioritized Smells Matrix)
Rank findings from highest leverage (**High Impact / Low-Med Effort**) to lowest. Categories must be one of: `DRY Violation`, `High Complexity / Bloated Logic`, `Tight Coupling / SOLID`, or `Algorithmic / Performance Bottleneck`.

| עדיפות (Priority) | מזהה (ID) | מיקום בקוד (File Paths & Symbols) | קטגוריית כשל (Smell Category) | השפעה (Impact) | מאמץ/סיכון (Effort/Risk) | תיאור הבעיה והפתרון המוצע (Hebrew Summary) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **P1 (Critical)** | `REF-01` | `src/services/order.ts` (`processOrder`) | `High Complexity / Bloated Logic` | High | Low | פונקציית ענק עם קינון עמוק (5 רמות); פיצול ל-Guard Clauses ופונקציות עזר טהורות. |
| **P2 (High)** | `REF-02` | `src/api/user.ts`, `src/api/admin.ts` | `DRY Violation` | High | Medium | לוגיקת אימות ומיפוי שגיאות משוכפלת; חילוץ ל-Shared Middleware/Utility. |
| **P3 (Medium)** | `REF-03` | `src/utils/matcher.ts` (`findMatches`) | `Algorithmic / Performance Bottleneck` | Medium | Low | חיפוש מקונן ב-$O(N^2)$ בתוך לולאה; המרה ל-`Map`/`Set` ב-$O(N)$. |

> **שער אישור (Clarification / Approval Gate - Phase 1):**
> *האם תרצה שאבצע את השינויים לפי סדר העדיפויות בטבלה (כולל עדכון כל נקודות הקריאה בפרויקט), או שנתמקד תחילה במזהים ספציפיים?*

---

## 3. השוואת קוד ונימוק הנדסי (Before / After Code Diffs)
For each approved or demonstrated refactoring item (`REF-XX`), provide the exact structural comparison:

### `[REF-XX]` — `[Short Descriptive Title in Hebrew]`
* **קבצים מושפעים (Affected Files):** `path/to/fileA.ts`, `path/to/fileB.ts`
* **רציונל הנדסי (Architectural Rationale):** `[Explain in Hebrew why the original code was fragile/bloated and how the refactored version improves readability, complexity, or performance while preserving exact behavior]`

#### Before (הקוד המקורי)
```typescript
// File: path/to/fileA.ts
// [Minimal, accurate excerpt showing the exact smell or duplication]
```

#### After (הקוד לאחר Refactoring)
```typescript
// File: path/to/fileA.ts
// [Clean, idiomatic, behavior-preserving refactored implementation]
```

* **עדכון נקודות קריאה ותלויות (Cross-File Call-Site Updates):**
  * `path/to/consumer1.ts`: `[Describe import/signature alignment in Hebrew]`
  * `path/to/consumer2.ts`: `[Describe import/signature alignment in Hebrew]`

---

## 4. רשימת תיוג לאימות ומניעת רגרסיות (Regression Verification Checklist)
- [ ] **שמירה על התנהגות (Behavioral Equivalence):** כל הקלטים, הפלטים, טיפוסי ההחזרה וטיפול בשגיאות (`try/catch`, `null`/`undefined`, Edge Cases) זהים לחלוטין להתנהגות המקורית.
- [ ] **שלמות חוצת-קבצים (Cross-File Compilation & Imports):** כל ה-Imports, ה-Exports וחתימות הפונקציות עודכנו בכל הקבצים התלויים בפרויקט.
- [ ] **בדיקות אוטומטיות (Test Suite Verification):** פקודה להרצת בדיקות: `[e.g., npm test / pytest / cargo test]` + `[ציין אילו טסטים קיימים מכסים את האזור או אילו Unit Tests מומלץ להוסיף]`.