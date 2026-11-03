// ==========================================
// BetterBot — The Intelligence Factory UI
// ==========================================

let currentSession = null;
let isStreaming = false;
let showRawPrompt = false;

const els = {
  modelNameText: document.getElementById("modelNameText"),
  sessionSelect: document.getElementById("sessionSelect"),
  newSessionBtn: document.getElementById("newSessionBtn"),

  globalStageBadge: document.getElementById("globalStageBadge"),
  globalStageDesc: document.getElementById("globalStageDesc"),
  cbDots: document.getElementById("cbDots"),
  iterationBadge: document.getElementById("iterationBadge"),

  presetsContainer: document.getElementById("presetsContainer"),
  chatMessages: document.getElementById("chatMessages"),
  activeExecutionBar: document.getElementById("activeExecutionBar"),
  execNodeTitle: document.getElementById("execNodeTitle"),
  execNodeDesc: document.getElementById("execNodeDesc"),

  chatForm: document.getElementById("chatForm"),
  userInput: document.getElementById("userInput"),
  sendBtn: document.getElementById("sendBtn"),
  inputModeBadge: document.getElementById("inputModeBadge"),
  overrideNotice: document.getElementById("overrideNotice"),
  chatSubheader: document.getElementById("chatSubheader"),

  promptStatusPill: document.getElementById("promptStatusPill"),
  qaCountPill: document.getElementById("qaCountPill"),
  promptVersionTag: document.getElementById("promptVersionTag"),
  promptStatsText: document.getElementById("promptStatsText"),
  toggleRawPromptBtn: document.getElementById("toggleRawPromptBtn"),
  copyPromptBtn: document.getElementById("copyPromptBtn"),
  downloadPromptBtn: document.getElementById("downloadPromptBtn"),

  promptEmptyState: document.getElementById("promptEmptyState"),
  promptDisplayContainer: document.getElementById("promptDisplayContainer"),
  compilationCheckBox: document.getElementById("compilationCheckBox"),
  compilationCheckContent: document.getElementById("compilationCheckContent"),
  promptFormattedView: document.getElementById("promptFormattedView"),
  promptRawView: document.getElementById("promptRawView"),

  blueprintEmptyState: document.getElementById("blueprintEmptyState"),
  blueprintContainer: document.getElementById("blueprintContainer"),
  bpCardsGrid: document.getElementById("bpCardsGrid"),
  xmlRawViewer: document.getElementById("xmlRawViewer"),
  copyXmlBtn: document.getElementById("copyXmlBtn"),
  bpVersionText: document.getElementById("bpVersionText"),

  qaLogsList: document.getElementById("qaLogsList"),
  diffComparisonSection: document.getElementById("diffComparisonSection"),
  diffChampionPre: document.getElementById("diffChampionPre"),
  diffChallengerPre: document.getElementById("diffChallengerPre"),

  timelineList: document.getElementById("timelineList"),
  toast: document.getElementById("toast"),
};

// ==========================================
// Initialization
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  bindUIEvents();
  initBettyWidget();
  await checkHealth();
  await initSession();
});

async function checkHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    if (data.model) {
      els.modelNameText.textContent = data.model;
    }
  } catch (err) {
    console.warn("Health check error:", err);
  }
}

async function initSession() {
  const listRes = await fetch("/api/sessions");
  const listData = await listRes.json();

  if (listData.sessions && listData.sessions.length > 0) {
    const firstId = listData.sessions[0].session_id;
    const sessRes = await fetch(`/api/sessions/${firstId}`);
    currentSession = await sessRes.json();
    await refreshSessionSelector();
    renderAll(currentSession);
  } else {
    await createNewSession();
  }
}

async function createNewSession() {
  if (isStreaming) return;
  const res = await fetch("/api/sessions", { method: "POST" });
  currentSession = await res.json();
  await refreshSessionSelector();
  renderAll(currentSession);
  els.userInput.focus();
}

async function refreshSessionSelector() {
  const res = await fetch("/api/sessions");
  const data = await res.json();
  els.sessionSelect.innerHTML = "";
  (data.sessions || []).forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.session_id;
    opt.textContent = `${s.title} (${s.created_at})`;
    if (currentSession && s.session_id === currentSession.session_id) {
      opt.selected = true;
    }
    els.sessionSelect.appendChild(opt);
  });
}

// ==========================================
// Event Bindings
// ==========================================
function bindUIEvents() {
  els.newSessionBtn.addEventListener("click", createNewSession);

  els.sessionSelect.addEventListener("change", async (e) => {
    const sid = e.target.value;
    if (!sid || isStreaming) return;
    const res = await fetch(`/api/sessions/${sid}`);
    currentSession = await res.json();
    renderAll(currentSession);
  });

  // Tabs switching
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Preset cards — populate input textarea for user editing instead of immediate send
  document.querySelectorAll(".preset-card").forEach((card) => {
    card.addEventListener("click", () => {
      if (isStreaming) return;
      const prompt = card.dataset.prompt || "";
      els.userInput.value = prompt;
      els.userInput.focus();
      els.userInput.setSelectionRange(prompt.length, prompt.length);
      els.userInput.classList.remove("input-flash");
      void els.userInput.offsetWidth; // trigger reflow
      els.userInput.classList.add("input-flash");
      showToast("✏️ ההצעה הועתקה לתיבת הטקסט — תוכל לערוך אותה וללחוץ על 'שלח'");
    });
  });

  // Form submit & Enter key
  els.chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = els.userInput.value.trim();
    if (!text || isStreaming) return;
    sendUserMessage(text);
  });

  els.userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = els.userInput.value.trim();
      if (text && !isStreaming) {
        sendUserMessage(text);
      }
    }
  });

  // Toggle Raw vs Formatted Prompt
  els.toggleRawPromptBtn.addEventListener("click", () => {
    showRawPrompt = !showRawPrompt;
    els.toggleRawPromptBtn.textContent = showRawPrompt ? "תצוגה מעוצבת" : "תצוגת קוד גולמי";
    els.promptFormattedView.classList.toggle("hidden", showRawPrompt);
    els.promptRawView.classList.toggle("hidden", !showRawPrompt);
  });

  // Copy Prompt
  els.copyPromptBtn.addEventListener("click", () => {
    const promptText = getBestPrompt(currentSession);
    if (!promptText) return;
    navigator.clipboard.writeText(promptText);
    showToast("✅ פרומפט המערכת הועתק ללוח!");
  });

  // Download Prompt .MD
  els.downloadPromptBtn.addEventListener("click", () => {
    const promptText = getBestPrompt(currentSession);
    if (!promptText) return;
    const blob = new Blob([promptText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system_prompt_${currentSession?.session_id || "gem"}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("📥 הקובץ ירד בהצלחה!");
  });

  // Copy XML
  els.copyXmlBtn.addEventListener("click", () => {
    const xml = currentSession?.raw_blueprint || "";
    if (!xml) return;
    navigator.clipboard.writeText(xml);
    showToast("✅ קוד ה-XML Blueprint הועתק ללוח!");
  });
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tabId);
  });
  document.querySelectorAll(".tab-content").forEach((c) => {
    c.classList.toggle("active", c.id === tabId);
  });
}

// ==========================================
// Streaming Execution (SSE)
// ==========================================
async function sendUserMessage(messageText) {
  if (!currentSession || isStreaming) return;
  isStreaming = true;
  els.userInput.value = "";
  els.sendBtn.disabled = true;
  els.presetsContainer.classList.add("hidden");

  // Optimistically render user bubble
  appendOptimisticUserBubble(messageText);

  try {
    const response = await fetch(`/api/sessions/${currentSession.session_id}/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: messageText, mode: "auto" }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const block of parts) {
        handleSSEBlock(block);
      }
    }
  } catch (err) {
    showToast(`⚠️ שגיאת תקשורת: ${err.message}`);
  } finally {
    isStreaming = false;
    els.sendBtn.disabled = false;
    els.activeExecutionBar.classList.add("hidden");
    await refreshSessionSelector();
    els.userInput.focus();
  }
}

function handleSSEBlock(block) {
  const lines = block.split("\n");
  let eventType = "message";
  let dataStr = "";

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataStr += line.slice(5).trim();
    }
  }

  if (!dataStr) return;
  let payload;
  try {
    payload = JSON.parse(dataStr);
  } catch {
    return;
  }

  if (eventType === "session_update") {
    currentSession = payload;
    renderAll(currentSession);
  } else if (eventType === "node_start") {
    els.activeExecutionBar.classList.remove("hidden");
    els.execNodeTitle.textContent = payload.title;
    els.execNodeDesc.textContent = payload.description;
    highlightActiveNode(payload.node, payload.description);
  } else if (eventType === "node_complete") {
    currentSession = payload.session;
    renderAll(currentSession);
    if (payload.node === "node_1_helper" && currentSession.raw_blueprint) {
      switchTab("blueprintTab");
    } else if (payload.node === "node_2_construct" || payload.node === "node_4_adjudicator") {
      switchTab("promptTab");
    }
  } else if (eventType === "done") {
    currentSession = payload;
    els.activeExecutionBar.classList.add("hidden");
    renderAll(currentSession);
    if (currentSession.status === "passed") {
      switchTab("promptTab");
      showToast("🌟 הפרומפט אושר על ידי מבקר האיכות!");
    } else if (currentSession.status === "escalated") {
      switchTab("qaTab");
      showToast("⚠️ נדרשת הכוונה ידנית (Circuit Breaker)");
    }
  } else if (eventType === "error") {
    els.activeExecutionBar.classList.add("hidden");
    if (payload.session) {
      currentSession = payload.session;
      renderAll(currentSession);
    }
    showToast(`❌ שגיאה: ${payload.error}`);
  }
}

// ==========================================
// Rendering Functions
// ==========================================
function renderAll(session) {
  if (!session) return;
  const state = session.state || {};
  const userTurns = (session.chat_history || []).filter((m) => m.role === "user").length;
  els.presetsContainer.classList.toggle("hidden", userTurns > 0);

  renderPipelineStatus(session);
  renderChatHistory(session.chat_history || []);
  renderInputMode(session);
  renderPromptTab(session);
  renderBlueprintTab(session);
  renderQATab(session);
  renderTimelineTab(session.timeline || []);
}

function renderPipelineStatus(session) {
  const state = session.state || {};
  const iter = state.iteration_count || 0;
  const hasBlueprint = Boolean(session.raw_blueprint);
  const hasPrompt = Boolean(session.clean_champion_prompt || session.clean_challenger_prompt);
  const status = session.status;

  // Circuit breaker dots
  els.iterationBadge.textContent = `${iter} / 3`;
  const dots = els.cbDots.querySelectorAll(".cb-dot");
  dots.forEach((dot, idx) => {
    const stepNum = idx + 1;
    dot.className = "cb-dot";
    if (status === "escalated" && stepNum <= iter) {
      dot.classList.add("tripped");
    } else if (stepNum <= iter) {
      dot.classList.add("used");
    }
  });

  // Global status banner
  els.globalStageBadge.className = "stage-indicator";
  if (status === "passed") {
    els.globalStageBadge.classList.add("status-passed");
    els.globalStageBadge.textContent = "אושר סופית (PASS)";
    els.globalStageDesc.textContent = "הפרומפט עבר בקרת איכות ומוכן להטמעה. ניתן לשלוח הנחיות שדרוג נוספות.";
  } else if (status === "escalated") {
    els.globalStageBadge.classList.add("status-escalated");
    els.globalStageBadge.textContent = "הסלמה (ESCALATE)";
    els.globalStageDesc.textContent = "מפסק הפחת הופעל. הזן הוראת תיקון ידנית בתיבת הצ'אט עבור The Upgrader.";
  } else if (status === "compiling") {
    els.globalStageBadge.textContent = "הידור ובקרת איכות";
    els.globalStageDesc.textContent = "הסוכנים מהדרים ובודקים את הפרומפט מול תוכנית האב...";
  } else if (status === "interviewing") {
    els.globalStageBadge.textContent = "שלב הראיון (Phase 1)";
    els.globalStageDesc.textContent = "The Helper אוסף מידע לאפיון ה-XML Blueprint";
  } else {
    els.globalStageBadge.textContent = "מוכן להפעלה";
    els.globalStageDesc.textContent = "תאר את הבוט הרצוי כדי להתחיל את תהליך הייצור";
  }

  // Update visual graph nodes
  const nodes = ["node_1_helper", "node_2_construct", "node_3_upgrader", "node_4_adjudicator"];
  nodes.forEach((nid) => {
    const el = document.getElementById(`graph-${nid}`);
    const badge = document.getElementById(`badge-${nid}`);
    if (!el || !badge) return;
    el.className = "agent-node";

    if (session.active_node === nid) {
      el.classList.add("active");
      badge.textContent = "פעיל כעת...";
      return;
    }

    if (nid === "node_1_helper") {
      if (hasBlueprint) {
        el.classList.add("completed");
        badge.textContent = "הופק XML";
      } else if (status === "interviewing") {
        badge.textContent = "מראיין";
      } else {
        badge.textContent = "המתנה";
      }
    } else if (nid === "node_2_construct") {
      if (hasPrompt) {
        el.classList.add("completed");
        badge.textContent = "הודר";
      } else {
        badge.textContent = "המתנה";
      }
    } else if (nid === "node_3_upgrader") {
      if (iter > 1) {
        el.classList.add("completed");
        badge.textContent = `שודרג (${iter - 1})`;
      } else {
        badge.textContent = "מוכן";
      }
    } else if (nid === "node_4_adjudicator") {
      if (status === "passed") {
        el.classList.add("completed");
        badge.textContent = "PASS ✅";
      } else if (status === "escalated") {
        el.classList.add("danger");
        badge.textContent = "ESCALATE ⚠️";
      } else if (iter > 0) {
        el.classList.add("warning");
        badge.textContent = `בבדיקה (${iter})`;
      } else {
        badge.textContent = "המתנה";
      }
    }
  });
}

function highlightActiveNode(nodeId, description) {
  const nodes = ["node_1_helper", "node_2_construct", "node_3_upgrader", "node_4_adjudicator"];
  nodes.forEach((nid) => {
    const el = document.getElementById(`graph-${nid}`);
    const badge = document.getElementById(`badge-${nid}`);
    if (!el || !badge) return;
    if (nid === nodeId) {
      el.classList.add("active");
      badge.textContent = "פועל...";
    } else {
      el.classList.remove("active");
    }
  });
  els.globalStageDesc.textContent = description;
}

function renderInputMode(session) {
  const isOverrideMode =
    session.status === "escalated" ||
    session.status === "passed" ||
    (session.state && session.state.iteration_count > 0);

  if (isOverrideMode) {
    els.inputModeBadge.textContent = "מצב עריכה ישירה (Upgrader)";
    els.inputModeBadge.classList.add("override-mode");
    els.overrideNotice.classList.remove("hidden");
    els.userInput.placeholder =
      "כתוב הנחיית שדרוג או תיקון עבור The Upgrader (למשל: 'הוסף חוק שאוסר על שימוש באימוג'ים')...";
    els.chatSubheader.textContent = "שליחת פקודות שדרוג אטומיות ישירות לסוכן העריכה (Node 3)";
  } else {
    els.inputModeBadge.textContent = "מצב ראיון";
    els.inputModeBadge.classList.remove("override-mode");
    els.overrideNotice.classList.add("hidden");
    els.userInput.placeholder =
      "תאר את הבוט שאתה רוצה לבנות או ענה לשאלות הארכיטקט... (Enter לשליחה)";
    els.chatSubheader.textContent = "שיחה אינטראקטיבית עם The Helper לבניית תוכנית האב";
  }
}

function renderChatHistory(history) {
  els.chatMessages.innerHTML = "";
  history.forEach((msg) => {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${msg.role}`;
    if (msg.is_override) bubble.classList.add("override-bubble");
    if (msg.verdict === "PASS") bubble.classList.add("verdict-pass");
    if (msg.verdict === "ESCALATE") bubble.classList.add("verdict-escalate");

    const header = document.createElement("div");
    header.className = "bubble-header";

    const agentSpan = document.createElement("span");
    agentSpan.className = "bubble-agent-name";
    agentSpan.textContent =
      msg.role === "user"
        ? msg.is_override
          ? "⚡ אתה (פקודת Override)"
          : "👤 אתה"
        : `🤖 ${msg.agent || "BetterBot"}`;

    const timeSpan = document.createElement("span");
    timeSpan.textContent = msg.timestamp || "";

    header.appendChild(agentSpan);
    header.appendChild(timeSpan);
    bubble.appendChild(header);

    const textDiv = document.createElement("div");
    textDiv.className = "bubble-text";
    textDiv.innerHTML = formatSimpleMarkdown(msg.text || "");
    bubble.appendChild(textDiv);

    // Collapsible hidden thought process if present
    if (msg.thought) {
      const details = document.createElement("details");
      details.className = "thought-drawer";
      const summary = document.createElement("summary");
      summary.textContent = "🧠 הצג תהליך חשיבה סמוי (<thought_process>)";
      const pre = document.createElement("pre");
      pre.dir = "ltr";
      pre.textContent = msg.thought;
      details.appendChild(summary);
      details.appendChild(pre);
      bubble.appendChild(details);
    }

    els.chatMessages.appendChild(bubble);
  });

  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function appendOptimisticUserBubble(text) {
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble user";
  const now = new Date().toTimeString().slice(0, 8);
  bubble.innerHTML = `
    <div class="bubble-header">
      <span class="bubble-agent-name">👤 אתה</span>
      <span>${now}</span>
    </div>
    <div class="bubble-text">${escapeHtml(text)}</div>
  `;
  els.chatMessages.appendChild(bubble);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function getBestPrompt(session) {
  if (!session) return "";
  return session.clean_champion_prompt || session.clean_challenger_prompt || "";
}

function renderPromptTab(session) {
  const promptText = getBestPrompt(session);
  const state = session.state || {};

  if (!promptText) {
    els.promptEmptyState.classList.remove("hidden");
    els.promptDisplayContainer.classList.add("hidden");
    els.copyPromptBtn.disabled = true;
    els.downloadPromptBtn.disabled = true;
    els.promptStatusPill.textContent = "ריק";
    els.promptVersionTag.textContent = "ממתין להידור";
    els.promptVersionTag.className = "badge badge-neutral";
    els.promptStatsText.textContent = "0 תווים";
    return;
  }

  els.promptEmptyState.classList.add("hidden");
  els.promptDisplayContainer.classList.remove("hidden");
  els.copyPromptBtn.disabled = false;
  els.downloadPromptBtn.disabled = false;

  const charCount = promptText.length;
  const estTokens = Math.round(charCount / 3.8);
  els.promptStatsText.textContent = `${charCount.toLocaleString()} תווים (~${estTokens} טוקנים)`;

  if (session.status === "passed") {
    els.promptStatusPill.textContent = "מאושר ✅";
    els.promptVersionTag.textContent = "🏆 Champion Prompt (Approved)";
    els.promptVersionTag.className = "badge badge-success";
  } else {
    els.promptStatusPill.textContent = `איטרציה ${state.iteration_count || 1}`;
    els.promptVersionTag.textContent = "⚡ גרסת עבודה (Challenger / Champion)";
    els.promptVersionTag.className = "badge badge-warning";
  }

  if (session.compilation_check) {
    els.compilationCheckBox.classList.remove("hidden");
    els.compilationCheckContent.textContent = session.compilation_check;
  } else {
    els.compilationCheckBox.classList.add("hidden");
  }

  els.promptFormattedView.textContent = promptText;
  els.promptRawView.textContent = state.champion_prompt || state.challenger_prompt || promptText;
}

function renderBlueprintTab(session) {
  const rawXml = session.raw_blueprint || "";
  const parsed = session.parsed_blueprint || {};

  if (!rawXml) {
    els.blueprintEmptyState.classList.remove("hidden");
    els.blueprintContainer.classList.add("hidden");
    els.copyXmlBtn.disabled = true;
    return;
  }

  els.blueprintEmptyState.classList.add("hidden");
  els.blueprintContainer.classList.remove("hidden");
  els.copyXmlBtn.disabled = false;
  els.bpVersionText.textContent = `V${parsed.version || "1.0"}`;

  const cardDefs = [
    { key: "title", label: "🎯 Title (פרסונה ותפקיד)", full: false },
    { key: "tone", label: "🎙️ Tone (סגנון דיבור)", full: false },
    { key: "domain_expertise", label: "🧠 Domain Expertise (תחומי מומחיות)", full: false },
    { key: "cognitive_modules", label: "⚙️ Cognitive Modules (מודולים קוגניטיביים)", full: false },
    { key: "workflow", label: "🔄 Workflow (תהליך עבודה מובנה)", full: true },
    { key: "negative_constraints", label: "🚫 Negative Constraints (איסורים ומגבלות)", full: true },
    { key: "output_format", label: "📄 Output Format (תבנית פלט)", full: true },
  ];

  els.bpCardsGrid.innerHTML = "";
  cardDefs.forEach((def) => {
    if (!parsed[def.key]) return;
    const card = document.createElement("div");
    card.className = `bp-card ${def.full ? "full-width" : ""}`;
    card.dir = "ltr";
    card.innerHTML = `
      <div class="bp-card-label">${def.label}</div>
      <div class="bp-card-value">${escapeHtml(parsed[def.key])}</div>
    `;
    els.bpCardsGrid.appendChild(card);
  });

  els.xmlRawViewer.textContent = rawXml;
}

function renderQATab(session) {
  const state = session.state || {};
  const logs = state.error_log || [];
  els.qaCountPill.textContent = String(logs.length);

  if (logs.length === 0) {
    els.qaLogsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-illustration">🛡️</div>
        <h3>טרם בוצעו סבבי QA</h3>
        <p>ברגע שיופק פרומפט ראשוני, ה-Adjudicator יבצע ביקורת איכות קפדנית ויציג כאן את הממצאים.</p>
      </div>
    `;
    els.diffComparisonSection.classList.add("hidden");
    return;
  }

  els.qaLogsList.innerHTML = "";
  logs.forEach((entry, idx) => {
    const item = document.createElement("div");
    let cls = "qa-item";
    if (entry.includes("[PASS]")) cls += " pass";
    else if (entry.includes("[FAIL]")) cls += " fail";
    else if (entry.includes("[ESCALATE]")) cls += " escalate";
    item.className = cls;
    item.dir = "ltr";
    item.innerHTML = `<strong>#${idx + 1}</strong> — ${escapeHtml(entry)}`;
    els.qaLogsList.appendChild(item);
  });

  if (session.clean_champion_prompt || session.clean_challenger_prompt) {
    els.diffComparisonSection.classList.remove("hidden");
    els.diffChampionPre.textContent = session.clean_champion_prompt || "(טרם נקבע Champion)";
    els.diffChallengerPre.textContent = session.clean_challenger_prompt || "(טרם נקבע Challenger)";
  } else {
    els.diffComparisonSection.classList.add("hidden");
  }
}

function renderTimelineTab(timeline) {
  els.timelineList.innerHTML = "";
  timeline.slice().reverse().forEach((item) => {
    const row = document.createElement("div");
    row.className = "timeline-item";
    row.innerHTML = `
      <div class="tl-time">${escapeHtml(item.timestamp || "")}</div>
      <div class="tl-body">
        <div class="tl-title">${escapeHtml(item.title || "")}</div>
        <div class="tl-detail">${escapeHtml(item.detail || "")}</div>
      </div>
    `;
    els.timelineList.appendChild(row);
  });
}

// ==========================================
// Helpers
// ==========================================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatSimpleMarkdown(text) {
  let safe = escapeHtml(text);
  safe = safe.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  safe = safe.replace(/`([^`]+)`/g, '<code class="mono-text">$1</code>');
  return safe;
}

let toastTimer = null;
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.add("hidden");
  }, 3400);
}



// =========================================================
// BETTY (בטי) — Floating Draggable & Resizable Assistant
// =========================================================
let bettyMode = "tech_support"; // "tech_support" | "prompt_advisor"
let bettyHistories = {
  tech_support: [],
  prompt_advisor: [],
};
let isBettyLoading = false;

const BETTY_QUICK_SUGGESTIONS = {
  tech_support: [
    "איך עובדים 4 הסוכנים במערכת?",
    "מה קורה במצב ESCALATE (מפסק פחת)?",
    "מה ההבדל בין Champion ל-Challenger?",
    "איך עובד מצב עריכה ישירה (Manual Override)?",
  ],
  prompt_advisor: [
    "אילו מודולים קוגניטיביים כדאי לבחור לבוט שלי?",
    "נתח ובקר את ה-Blueprint / הפרומפט הנוכחי שלי",
    "איך למנוע הזיות (Hallucinations) בפרומפט מורכב?",
    "נסח לי פקודת שדרוג מדויקת עבור ה-Upgrader",
  ],
};

async function initBettyWidget() {
  const fab = document.getElementById("bettyFab");
  const win = document.getElementById("bettyWindow");
  const closeBtn = document.getElementById("bettyCloseBtn");
  const maxBtn = document.getElementById("bettyMaximizeBtn");
  const clearBtn = document.getElementById("bettyClearBtn");
  const form = document.getElementById("bettyForm");
  const input = document.getElementById("bettyInput");
  const dragHeader = document.getElementById("bettyDragHeader");

  if (!fab || !win) return;

  // Fetch initial histories from backend
  try {
    const res = await fetch("/api/betty/history");
    if (res.ok) {
      const data = await res.json();
      bettyHistories.tech_support = data.tech_support || [];
      bettyHistories.prompt_advisor = data.prompt_advisor || [];
    }
  } catch (err) {
    console.warn("Could not load Betty history:", err);
  }

  renderBettyModeUI();

  // Open / Close toggle
  fab.addEventListener("click", () => {
    win.classList.remove("hidden");
    fab.classList.add("hidden");
    renderBettyMessages();
    input.focus();
  });

  closeBtn.addEventListener("click", () => {
    win.classList.add("hidden");
    fab.classList.remove("hidden");
  });

  // Maximize / Restore
  maxBtn.addEventListener("click", () => {
    win.classList.toggle("maximized");
  });

  // Double-clicking header also toggles maximize
  dragHeader.addEventListener("dblclick", (e) => {
    if (e.target.closest("button")) return;
    win.classList.toggle("maximized");
  });

  // Clear history for current mode
  clearBtn.addEventListener("click", async () => {
    if (isBettyLoading) return;
    try {
      const res = await fetch("/api/betty/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: bettyMode }),
      });
      if (res.ok) {
        const data = await res.json();
        bettyHistories[bettyMode] = data.history || [];
        renderBettyMessages();
        showToast("🧹 שיחת בטי במצב הנוכחי אופסה");
      }
    } catch (err) {
      console.warn(err);
    }
  });

  // Mode buttons
  document.querySelectorAll(".betty-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetMode = btn.dataset.mode;
      if (!targetMode || targetMode === bettyMode) return;
      bettyMode = targetMode;
      renderBettyModeUI();
    });
  });

  // Submit & Enter handling
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || isBettyLoading) return;
    sendBettyMessage(text);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = input.value.trim();
      if (text && !isBettyLoading) {
        sendBettyMessage(text);
      }
    }
  });

  // Setup Dragging & Resizing
  setupBettyDragAndResize(win, dragHeader);
}

function renderBettyModeUI() {
  document.querySelectorAll(".betty-mode-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === bettyMode);
  });

  const subStatus = document.getElementById("bettySubStatus");
  const input = document.getElementById("bettyInput");
  if (bettyMode === "tech_support") {
    subStatus.textContent = "מצב פעיל: 🛠️ תמיכה טכנית והדרכה על המערכת";
    input.placeholder = "שאל את בטי איך האפליקציה עובדת, מה קורה בכל שלב או איך לתפעל...";
  } else {
    subStatus.textContent = "מצב פעיל: 🧠 יועצת הנדסת פרומפטים (Master Architect V5)";
    input.placeholder = "התייעץ עם בטי על ארכיטקטורת הבוט, פרומפטים, מודולים קוגניטיביים...";
  }

  // Render quick chips (clicking populates input box for user editing/sending)
  const chipsContainer = document.getElementById("bettyQuickChips");
  chipsContainer.innerHTML = "";
  (BETTY_QUICK_SUGGESTIONS[bettyMode] || []).forEach((q) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "betty-chip";
    chip.textContent = q;
    chip.addEventListener("click", () => {
      input.value = q;
      input.focus();
      input.setSelectionRange(q.length, q.length);
    });
    chipsContainer.appendChild(chip);
  });

  renderBettyMessages();
}

function renderBettyMessages() {
  const container = document.getElementById("bettyMessages");
  if (!container) return;
  container.innerHTML = "";

  const list = bettyHistories[bettyMode] || [];
  list.forEach((msg) => {
    const div = document.createElement("div");
    div.className = `betty-msg ${msg.role}`;
    if (msg.role === "assistant" && bettyMode === "prompt_advisor") {
      div.classList.add("advisor-msg");
    }

    const meta = document.createElement("div");
    meta.className = "betty-msg-meta";
    const sender =
      msg.role === "user"
        ? "👤 אתה"
        : bettyMode === "tech_support"
        ? "🛠️ בטי — תמיכה טכנית"
        : "🧠 בטי — Prompt Advisor V5";
    meta.innerHTML = `<strong>${sender}</strong><span>${escapeHtml(msg.timestamp || "")}</span>`;
    div.appendChild(meta);

    const body = document.createElement("div");
    body.className = "bubble-text";
    body.innerHTML = formatRichBettyMarkdown(msg.text || "");
    div.appendChild(body);

    if (msg.thought) {
      const details = document.createElement("details");
      details.className = "thought-drawer";
      const summary = document.createElement("summary");
      summary.textContent = "🧠 תהליך חשיבה סמוי (ToT & CoVe <thought_process>)";
      const pre = document.createElement("pre");
      pre.dir = "ltr";
      pre.textContent = msg.thought;
      details.appendChild(summary);
      details.appendChild(pre);
      div.appendChild(details);
    }

    container.appendChild(div);
  });

  container.scrollTop = container.scrollHeight;
}

async function sendBettyMessage(text) {
  const input = document.getElementById("bettyInput");
  const sendBtn = document.getElementById("bettySendBtn");
  const thinking = document.getElementById("bettyThinking");
  const thinkingText = document.getElementById("bettyThinkingText");

  isBettyLoading = true;
  input.value = "";
  sendBtn.disabled = true;
  thinking.classList.remove("hidden");
  thinkingText.textContent =
    bettyMode === "tech_support"
      ? "בטי בודקת את מפרט המערכת ומצב הסשן..."
      : "בטי מבצעת ניתוח Tree of Thoughts ו-CoVe...";

  const now = new Date().toTimeString().slice(0, 8);
  bettyHistories[bettyMode].push({
    id: String(Date.now()),
    role: "user",
    mode: bettyMode,
    text,
    timestamp: now,
  });
  renderBettyMessages();

  try {
    const res = await fetch("/api/betty/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        mode: bettyMode,
        session_id: currentSession?.session_id || null,
      }),
    });
    const data = await res.json();
    if (data.history) {
      bettyHistories[data.mode || bettyMode] = data.history;
    }
  } catch (err) {
    bettyHistories[bettyMode].push({
      id: String(Date.now()),
      role: "assistant",
      mode: bettyMode,
      text: `⚠️ שגיאת תקשורת: ${err.message}`,
      timestamp: now,
    });
  } finally {
    isBettyLoading = false;
    sendBtn.disabled = false;
    thinking.classList.add("hidden");
    renderBettyMessages();
    input.focus();
  }
}

function formatRichBettyMarkdown(text) {
  if (!text) return "";
  // Support markdown tables (for Trade-off Matrix) + bold + code blocks
  const lines = text.split("\n");
  let htmlLines = [];
  let inTable = false;
  let tableRows = [];

  function flushTable() {
    if (!tableRows.length) return;
    let tbl = '<div class="betty-md-table-wrap"><table class="betty-md-table">';
    tableRows.forEach((row, rIdx) => {
      const cells = row
        .split("|")
        .map((c) => c.trim())
        .filter((c, i, arr) => !(i === 0 && c === "") && !(i === arr.length - 1 && c === ""));
      if (cells.every((c) => /^[-:]+$/.test(c))) return; // separator line
      const tag = rIdx === 0 ? "th" : "td";
      tbl +=
        "<tr>" +
        cells.map((c) => `<${tag}>${formatSimpleMarkdown(c)}</${tag}>`).join("") +
        "</tr>";
    });
    tbl += "</table></div>";
    htmlLines.push(tbl);
    tableRows = [];
    inTable = false;
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      inTable = true;
      tableRows.push(trimmed);
    } else {
      if (inTable) flushTable();
      htmlLines.push(formatSimpleMarkdown(line));
    }
  }
  if (inTable) flushTable();

  return htmlLines.join("\n");
}

function setupBettyDragAndResize(win, header) {
  let isDragging = false;
  let startX = 0,
    startY = 0,
    startLeft = 0,
    startTop = 0;

  function ensureAbsolutePosition() {
    const rect = win.getBoundingClientRect();
    win.style.left = `${rect.left}px`;
    win.style.top = `${rect.top}px`;
    win.style.bottom = "auto";
    win.style.right = "auto";
  }

  header.addEventListener("mousedown", (e) => {
    if (e.target.closest("button") || win.classList.contains("maximized")) return;
    ensureAbsolutePosition();
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseFloat(win.style.left) || 0;
    startTop = parseFloat(win.style.top) || 0;
    document.body.style.userSelect = "none";
  });

  // 8-Direction Resizing
  let isResizing = false;
  let resizeDir = "";
  let startW = 0,
    startH = 0;

  win.querySelectorAll(".betty-resize-handle").forEach((handle) => {
    handle.addEventListener("mousedown", (e) => {
      if (win.classList.contains("maximized")) return;
      e.stopPropagation();
      ensureAbsolutePosition();
      isResizing = true;
      resizeDir = handle.dataset.resize || "se";
      startX = e.clientX;
      startY = e.clientY;
      const rect = win.getBoundingClientRect();
      startW = rect.width;
      startH = rect.height;
      startLeft = rect.left;
      startTop = rect.top;
      document.body.style.userSelect = "none";
    });
  });

  window.addEventListener("mousemove", (e) => {
    if (isDragging) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const maxLeft = window.innerWidth - 100;
      const maxTop = window.innerHeight - 60;
      const newLeft = Math.max(8, Math.min(maxLeft, startLeft + dx));
      const newTop = Math.max(8, Math.min(maxTop, startTop + dy));
      win.style.left = `${newLeft}px`;
      win.style.top = `${newTop}px`;
    } else if (isResizing) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const minW = 340;
      const minH = 400;

      let newW = startW;
      let newH = startH;
      let newL = startLeft;
      let newT = startTop;

      if (resizeDir.includes("e")) {
        newW = Math.max(minW, Math.min(window.innerWidth - startLeft - 8, startW + dx));
      }
      if (resizeDir.includes("s")) {
        newH = Math.max(minH, Math.min(window.innerHeight - startTop - 8, startH + dy));
      }
      if (resizeDir.includes("w")) {
        const possibleW = startW - dx;
        if (possibleW >= minW && startLeft + dx >= 8) {
          newW = possibleW;
          newL = startLeft + dx;
        }
      }
      if (resizeDir.includes("n")) {
        const possibleH = startH - dy;
        if (possibleH >= minH && startTop + dy >= 8) {
          newH = possibleH;
          newT = startTop + dy;
        }
      }

      win.style.width = `${newW}px`;
      win.style.height = `${newH}px`;
      win.style.left = `${newL}px`;
      win.style.top = `${newT}px`;
    }
  });

  window.addEventListener("mouseup", () => {
    if (isDragging || isResizing) {
      isDragging = false;
      isResizing = false;
      document.body.style.userSelect = "";
    }
  });
}
