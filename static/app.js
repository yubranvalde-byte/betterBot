// ==========================================
// BetterBot — Multi-Window Studio Architecture UI (v3.0)
// ==========================================

let currentSession = null;
let isStreaming = false;
let showRawPrompt = false;
let currentDiffMode = "unified"; // "unified" | "split"
let activeWorkspaceView = "view-interview";
let activeStreamingNode = null;
let activeStreamingDesc = "";
let timelineFilterQuery = "";

const ICONS = {
  check: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  alert: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  edit: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`,
  download: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
  user: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
  bot: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path></svg>`,
  zap: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
  cpu: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>`,
  shield: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>`,
  shieldLg: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>`,
  layersLg: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`,
  cpuLg: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>`,
  target: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`,
  mic: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>`,
  sliders: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>`,
  workflow: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`,
  ban: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>`,
  fileText: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>`,
  wrench: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`,
  layers: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`,
  trash: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>`,
};

const NODE_ROLES = {
  node_1_helper: "Node 1: The Helper — ארכיטקט דרישות וראיון",
  node_2_construct: "Node 2: The Construct — מהדר הפרומפטים",
  node_3_upgrader: "Node 3: The Upgrader — עורך אטומי ומשדרג",
  node_4_adjudicator: "Node 4: The Adjudicator — בקרת איכות ורגרסיה",
};

const NODE_SHORT_LABELS = {
  node_1_helper: "Node 1 · The Helper",
  node_2_construct: "Node 2 · The Construct",
  node_3_upgrader: "Node 3 · The Upgrader",
  node_4_adjudicator: "Node 4 · The Adjudicator",
};

const els = {
  modelNameText: document.getElementById("modelNameText"),
  sessionSelect: document.getElementById("sessionSelect"),
  newSessionBtn: document.getElementById("newSessionBtn"),

  headerTelemetryPill: document.getElementById("headerTelemetryPill"),
  telemetryLiveDot: document.getElementById("telemetryLiveDot"),
  headerActiveNodeText: document.getElementById("headerActiveNodeText"),
  globalStageBadge: document.getElementById("globalStageBadge"),
  globalStageDesc: document.getElementById("globalStageDesc"),
  cbDots: document.getElementById("cbDots"),
  iterationBadge: document.getElementById("iterationBadge"),
  archCbText: document.getElementById("archCbText"),
  timelineCountPill: document.getElementById("timelineCountPill"),

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

  promptToolbarGroup: document.getElementById("promptToolbarGroup"),
  blueprintToolbarGroup: document.getElementById("blueprintToolbarGroup"),
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

  artifactUpgraderForm: document.getElementById("artifactUpgraderForm"),
  artifactUpgraderInput: document.getElementById("artifactUpgraderInput"),
  artifactUpgraderSendBtn: document.getElementById("artifactUpgraderSendBtn"),

  qaLogsList: document.getElementById("qaLogsList"),
  diffComparisonSection: document.getElementById("diffComparisonSection"),
  diffUnifiedContainer: document.getElementById("diffUnifiedContainer"),
  diffUnifiedPre: document.getElementById("diffUnifiedPre"),
  diffSplitContainer: document.getElementById("diffSplitContainer"),
  diffChampionPre: document.getElementById("diffChampionPre"),
  diffChallengerPre: document.getElementById("diffChallengerPre"),

  timelineSearchInput: document.getElementById("timelineSearchInput"),
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
  // Keep-Alive heartbeat every 4 minutes so Render free-tier containers stay warm while open
  setInterval(checkHealth, 4 * 60 * 1000);
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
  switchWorkspaceView("view-interview");
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
// Multi-Window Studio Routing & Sub-Tab Switching
// ==========================================
function switchWorkspaceView(viewId) {
  if (!viewId) return;
  activeWorkspaceView = viewId;

  document.querySelectorAll(".nav-rail-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewId);
  });

  document.querySelectorAll(".studio-view").forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });

  if (viewId === "view-interview" && els.userInput) {
    els.userInput.focus();
  }
}

function switchTab(tabId) {
  if (tabId === "qaTab") {
    switchWorkspaceView("view-qa");
    return;
  }
  if (tabId === "timelineTab") {
    switchWorkspaceView("view-pipeline");
    return;
  }

  switchWorkspaceView("view-artifacts");

  document.querySelectorAll(".tab-btn").forEach((b) => {
    const isActive = b.dataset.tab === tabId;
    b.classList.toggle("active", isActive);
    b.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  document.querySelectorAll("#view-artifacts .tab-content").forEach((c) => {
    c.classList.toggle("active", c.id === tabId);
  });

  if (els.promptToolbarGroup && els.blueprintToolbarGroup) {
    els.promptToolbarGroup.classList.toggle("hidden", tabId !== "promptTab");
    els.blueprintToolbarGroup.classList.toggle("hidden", tabId !== "blueprintTab");
  }
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

  // Navigation Rail View Buttons
  document.querySelectorAll(".nav-rail-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchWorkspaceView(btn.dataset.view);
    });
  });

  // Header Telemetry Pill -> Opens Pipeline Architecture & Timeline View
  if (els.headerTelemetryPill) {
    els.headerTelemetryPill.addEventListener("click", () => {
      switchWorkspaceView("view-pipeline");
    });
  }

  // Artifact Sub-Tabs switching (Prompt vs XML Blueprint)
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Interactive Pipeline Node Navigation (from view-pipeline)
  const nodeRoutes = {
    node_1_helper: () => {
      switchWorkspaceView("view-interview");
      els.userInput.focus();
    },
    node_2_construct: () => switchTab("blueprintTab"),
    node_4_adjudicator: () => switchWorkspaceView("view-qa"),
    node_3_upgrader: () => switchTab("promptTab"),
  };

  document.querySelectorAll(".agent-node").forEach((nodeEl) => {
    const nid = nodeEl.dataset.node;
    const triggerRoute = () => {
      if (nodeRoutes[nid]) nodeRoutes[nid]();
    };
    nodeEl.addEventListener("click", triggerRoute);
    nodeEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        triggerRoute();
      }
    });
  });

  // Diff View Mode Toggle (Unified vs Side-by-Side)
  document.querySelectorAll(".diff-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.diffMode || "unified";
      currentDiffMode = mode;
      document.querySelectorAll(".diff-mode-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.diffMode === mode);
      });
      if (els.diffUnifiedContainer && els.diffSplitContainer) {
        els.diffUnifiedContainer.classList.toggle("hidden", mode !== "unified");
        els.diffSplitContainer.classList.toggle("hidden", mode !== "split");
      }
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
      showToast("ההצעה הועתקה לתיבת הטקסט — ניתן לערוך וללחוץ על 'שלח'", "edit");
    });
  });

  // Main Chat Form submit & Enter key
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

  // Quick Upgrader Command Bar inside view-artifacts
  if (els.artifactUpgraderForm && els.artifactUpgraderInput) {
    els.artifactUpgraderForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = els.artifactUpgraderInput.value.trim();
      if (!text || isStreaming) return;
      els.artifactUpgraderInput.value = "";
      sendUserMessage(text);
    });
  }

  // Timeline Search Filter
  if (els.timelineSearchInput) {
    els.timelineSearchInput.addEventListener("input", (e) => {
      timelineFilterQuery = (e.target.value || "").trim().toLowerCase();
      if (currentSession) {
        renderTimelineTab(currentSession.timeline || []);
      }
    });
  }

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
    showToast("פרומפט המערכת הועתק ללוח", "check");
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
    showToast("הקובץ ירד בהצלחה", "download");
  });

  // Copy XML
  els.copyXmlBtn.addEventListener("click", () => {
    const xml = currentSession?.raw_blueprint || "";
    if (!xml) return;
    navigator.clipboard.writeText(xml);
    showToast("קוד ה-XML Blueprint הועתק ללוח", "check");
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
  if (els.artifactUpgraderSendBtn) els.artifactUpgraderSendBtn.disabled = true;
  els.presetsContainer.classList.add("hidden");

  // Optimistically render user bubble
  appendOptimisticUserBubble(messageText);

  try {
    let response = await fetch(`/api/sessions/${currentSession.session_id}/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: messageText, mode: "auto" }),
    });

    // Auto-recover if server restarted and session ID was evicted
    if (response.status === 404) {
      const res = await fetch("/api/sessions", { method: "POST" });
      currentSession = await res.json();
      response = await fetch(`/api/sessions/${currentSession.session_id}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText, mode: "auto" }),
      });
    }

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
    // Restore user's message input so nothing is lost on network failure
    if (els.userInput && !els.userInput.value) {
      els.userInput.value = messageText;
    }
    showToast(`שגיאת תקשורת: ${err.message}`, "alert");
  } finally {
    isStreaming = false;
    activeStreamingNode = null;
    activeStreamingDesc = "";
    els.sendBtn.disabled = false;
    if (els.artifactUpgraderSendBtn) els.artifactUpgraderSendBtn.disabled = false;
    els.activeExecutionBar.classList.add("hidden");
    if (currentSession) renderAll(currentSession);
    await refreshSessionSelector();
    if (activeWorkspaceView === "view-interview") {
      els.userInput.focus();
    }
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
    activeStreamingNode = payload.node;
    activeStreamingDesc = payload.description || "";
    els.activeExecutionBar.classList.remove("hidden");
    els.execNodeTitle.textContent = payload.title;
    els.execNodeDesc.textContent = payload.description;
    highlightActiveNode(payload.node, payload.description);
    if (currentSession) {
      renderPromptTab(currentSession);
      renderBlueprintTab(currentSession);
    }
  } else if (eventType === "node_complete") {
    activeStreamingNode = null;
    currentSession = payload.session;
    renderAll(currentSession);
    if (payload.node === "node_1_helper" && currentSession.raw_blueprint) {
      switchTab("blueprintTab");
    } else if (payload.node === "node_2_construct" || payload.node === "node_4_adjudicator") {
      switchTab("promptTab");
    }
  } else if (eventType === "done") {
    activeStreamingNode = null;
    currentSession = payload;
    els.activeExecutionBar.classList.add("hidden");
    renderAll(currentSession);
    if (currentSession.status === "passed") {
      switchTab("promptTab");
      showToast("הפרומפט אושר על ידי מבקר האיכות (PASS)", "check");
    } else if (currentSession.status === "escalated") {
      switchWorkspaceView("view-qa");
      showToast("נדרשת הכוונה ידנית (Circuit Breaker)", "alert");
    }
  } else if (eventType === "error") {
    activeStreamingNode = null;
    els.activeExecutionBar.classList.add("hidden");
    if (payload.session) {
      currentSession = payload.session;
      renderAll(currentSession);
    }
    showToast(`שגיאה: ${payload.error}`, "alert");
  }
}

// ==========================================
// Rendering Functions
// ==========================================
function renderAll(session) {
  if (!session) return;
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

  // Circuit breaker dots & counters
  els.iterationBadge.textContent = `${iter} / 3`;
  if (els.archCbText) {
    els.archCbText.textContent = `${iter} / 3 איטרציות`;
  }
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

  // Header Telemetry Pill & Global status banner
  const activeNodeId = activeStreamingNode || session.active_node;
  if (els.telemetryLiveDot) {
    els.telemetryLiveDot.className = "telemetry-live-dot";
    if (activeNodeId || status === "compiling") {
      els.telemetryLiveDot.classList.add("active");
    } else if (status === "passed") {
      els.telemetryLiveDot.classList.add("passed");
    } else if (status === "escalated") {
      els.telemetryLiveDot.classList.add("escalated");
    }
  }

  if (els.headerActiveNodeText) {
    if (activeNodeId && NODE_SHORT_LABELS[activeNodeId]) {
      els.headerActiveNodeText.textContent = NODE_SHORT_LABELS[activeNodeId];
    } else if (status === "passed") {
      els.headerActiveNodeText.textContent = "Node 4 · Adjudicator (PASS)";
    } else if (status === "escalated") {
      els.headerActiveNodeText.textContent = "Node 3 · Upgrader Ready";
    } else if (hasBlueprint) {
      els.headerActiveNodeText.textContent = "Node 2 · The Construct";
    } else {
      els.headerActiveNodeText.textContent = "Node 1 · The Helper";
    }
  }

  els.globalStageBadge.className = "stage-indicator";
  if (status === "passed") {
    els.globalStageBadge.classList.add("status-passed");
    els.globalStageBadge.innerHTML = `אושר סופית (<code class="tech-token" dir="ltr">PASS</code>)`;
    els.globalStageDesc.innerHTML = `הפרומפט עבר בקרת איכות ומוכן להטמעה. ניתן לשלוח הנחיות שדרוג נוספות.`;
  } else if (status === "escalated") {
    els.globalStageBadge.classList.add("status-escalated");
    els.globalStageBadge.innerHTML = `הסלמה (<code class="tech-token" dir="ltr">ESCALATE</code>)`;
    els.globalStageDesc.innerHTML = `מפסק הפחת הופעל. הזן הוראת תיקון ידנית עבור <code class="tech-token" dir="ltr">The Upgrader</code>.`;
  } else if (status === "compiling") {
    els.globalStageBadge.textContent = "הידור ובקרת איכות";
    els.globalStageDesc.innerHTML = `הסוכנים מהדרים ובודקים את הפרומפט מול <code class="tech-token" dir="ltr">&lt;GEM_BLUEPRINT&gt;</code>...`;
  } else if (status === "interviewing") {
    els.globalStageBadge.innerHTML = `שלב הראיון (<code class="tech-token" dir="ltr">Phase 1</code>)`;
    els.globalStageDesc.innerHTML = `<code class="tech-token" dir="ltr">The Helper</code> אוסף מידע לאפיון ה-<code class="tech-token" dir="ltr">XML Blueprint</code>`;
  } else {
    els.globalStageBadge.textContent = "מוכן להפעלה";
    els.globalStageDesc.textContent = "תאר את הבוט הרצוי כדי להתחיל את תהליך הייצור";
  }

  // Update visual graph nodes in view-pipeline
  const nodes = ["node_1_helper", "node_2_construct", "node_3_upgrader", "node_4_adjudicator"];
  nodes.forEach((nid) => {
    const el = document.getElementById(`graph-${nid}`);
    const badge = document.getElementById(`badge-${nid}`);
    if (!el || !badge) return;
    el.className = "agent-node";

    if (activeNodeId === nid) {
      el.classList.add("active");
      badge.textContent = "פעיל כעת...";
      el.title = `${NODE_ROLES[nid]} — פעיל כעת`;
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
        badge.textContent = "PASS";
      } else if (status === "escalated") {
        el.classList.add("danger");
        badge.textContent = "ESCALATE";
      } else if (iter > 0) {
        el.classList.add("warning");
        badge.textContent = `בבדיקה (${iter})`;
      } else {
        badge.textContent = "המתנה";
      }
    }

    el.title = `${NODE_ROLES[nid]} (${badge.textContent})`;
  });
}

function highlightActiveNode(nodeId, description) {
  if (els.headerActiveNodeText && NODE_SHORT_LABELS[nodeId]) {
    els.headerActiveNodeText.textContent = NODE_SHORT_LABELS[nodeId];
  }
  if (els.telemetryLiveDot) {
    els.telemetryLiveDot.className = "telemetry-live-dot active";
  }

  const nodes = ["node_1_helper", "node_2_construct", "node_3_upgrader", "node_4_adjudicator"];
  nodes.forEach((nid) => {
    const el = document.getElementById(`graph-${nid}`);
    const badge = document.getElementById(`badge-${nid}`);
    if (!el || !badge) return;
    if (nid === nodeId) {
      el.classList.add("active");
      badge.textContent = "פועל...";
      el.title = `${NODE_ROLES[nid]} — ${description || "פועל כעת"}`;
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
    els.inputModeBadge.innerHTML = `<code class="tech-token" dir="ltr">Upgrader</code>`;
    els.inputModeBadge.classList.add("override-mode");
    els.overrideNotice.classList.remove("hidden");
    els.userInput.placeholder =
      "כתוב הנחיית שדרוג או תיקון עבור The Upgrader (למשל: 'הוסף חוק שאוסר על שימוש באימוג'ים')...";
    els.chatSubheader.innerHTML = `שליחת פקודות שדרוג אטומיות ישירות לסוכן העריכה (<code class="tech-token" dir="ltr">The Upgrader</code>)`;
  } else {
    els.inputModeBadge.textContent = "ראיון";
    els.inputModeBadge.classList.remove("override-mode");
    els.overrideNotice.classList.add("hidden");
    els.userInput.placeholder =
      "תאר את הבוט שאתה רוצה לבנות או ענה לשאלות הארכיטקט... (Enter לשליחה)";
    els.chatSubheader.innerHTML = `שיחה אינטראקטיבית עם <code class="tech-token" dir="ltr">The Helper</code> לבניית תוכנית האב`;
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
    if (msg.role === "user") {
      agentSpan.innerHTML = msg.is_override
        ? `${ICONS.zap} <span>אתה (<code class="tech-token" dir="ltr">Override</code>)</span>`
        : `${ICONS.user} <span>אתה</span>`;
    } else {
      const agentName = escapeHtml(msg.agent || "BetterBot");
      agentSpan.innerHTML = `${ICONS.bot} <code class="tech-token" dir="ltr">${agentName}</code>`;
    }

    const timeSpan = document.createElement("span");
    timeSpan.className = "tl-time";
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
      summary.innerHTML = `${ICONS.cpu} <span>הצג תהליך חשיבה סמוי (<code class="tech-token" dir="ltr">&lt;thought_process&gt;</code>)</span>`;
      const pre = document.createElement("pre");
      pre.dir = "ltr";
      pre.textContent = msg.thought;
      details.appendChild(summary);
      details.appendChild(pre);
      bubble.appendChild(details);
    }

    els.chatMessages.appendChild(bubble);
  });

  const scrollParent = els.chatMessages.closest(".chat-canvas-scroll") || els.chatMessages;
  scrollParent.scrollTop = scrollParent.scrollHeight;
}

function appendOptimisticUserBubble(text) {
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble user";
  const now = new Date().toTimeString().slice(0, 8);
  bubble.innerHTML = `
    <div class="bubble-header">
      <span class="bubble-agent-name">${ICONS.user} <span>אתה</span></span>
      <span class="tl-time">${now}</span>
    </div>
    <div class="bubble-text">${escapeHtml(text)}</div>
  `;
  els.chatMessages.appendChild(bubble);
  const scrollParent = els.chatMessages.closest(".chat-canvas-scroll") || els.chatMessages;
  scrollParent.scrollTop = scrollParent.scrollHeight;
}

function getBestPrompt(session) {
  if (!session) return "";
  return session.clean_champion_prompt || session.clean_challenger_prompt || "";
}

function buildSkeletonHTML(agentLabel, actionDesc) {
  return `
    <div class="skeleton-loader">
      <div class="skeleton-header">
        <div class="spinner-ring spinner-sm"></div>
        <span>מהדר תוצר חי — <code class="tech-token" dir="ltr">${escapeHtml(agentLabel)}</code></span>
      </div>
      <div class="skeleton-sub">${escapeHtml(actionDesc)}</div>
      <div class="skeleton-lines" dir="ltr">
        <div class="skeleton-bar w-90"></div>
        <div class="skeleton-bar w-75"></div>
        <div class="skeleton-bar w-85"></div>
        <div class="skeleton-bar w-60"></div>
      </div>
    </div>
  `;
}

function renderPromptTab(session) {
  const promptText = getBestPrompt(session);
  const state = session.state || {};
  const activeNode = activeStreamingNode || session.active_node;
  const isPromptCompiling =
    activeNode === "node_2_construct" ||
    activeNode === "node_3_upgrader" ||
    activeNode === "node_4_adjudicator" ||
    session.status === "compiling";

  if (!promptText) {
    els.promptEmptyState.classList.remove("hidden");
    els.promptDisplayContainer.classList.add("hidden");
    els.copyPromptBtn.disabled = true;
    els.downloadPromptBtn.disabled = true;
    els.promptStatsText.textContent = "0 תווים · ~0 טוקנים";

    if (isPromptCompiling) {
      const agentLabel =
        activeNode === "node_4_adjudicator"
          ? "The Adjudicator"
          : activeNode === "node_3_upgrader"
          ? "The Upgrader"
          : "The Construct";
      els.promptStatusPill.textContent = "בהידור";
      els.promptVersionTag.innerHTML = `<code class="tech-token" dir="ltr">${agentLabel}</code> פעיל`;
      els.promptVersionTag.className = "badge badge-warning";
      els.promptEmptyState.innerHTML = buildSkeletonHTML(
        agentLabel,
        activeStreamingDesc || "בונה ומהדר את פרומפט המערכת מתוך תוכנית האב..."
      );
    } else {
      els.promptStatusPill.textContent = "ריק";
      els.promptVersionTag.textContent = "ממתין להידור";
      els.promptVersionTag.className = "badge badge-neutral";
      els.promptEmptyState.innerHTML = `
        <div class="empty-illustration">${ICONS.layersLg}</div>
        <h3>פרומפט המערכת יופיע כאן</h3>
        <p>לאחר סיום הראיון הקצר עם <code class="tech-token" dir="ltr">The Helper</code>, המהדר (<code class="tech-token" dir="ltr">The Construct</code>) יבנה כאן את פרומפט המערכת המלא ויעביר אותו בדיקות <code class="tech-token" dir="ltr">QA</code> אוטומטיות.</p>
      `;
    }
    return;
  }

  els.promptEmptyState.classList.add("hidden");
  els.promptDisplayContainer.classList.remove("hidden");
  els.copyPromptBtn.disabled = false;
  els.downloadPromptBtn.disabled = false;

  const chars = promptText.length;
  els.promptStatsText.textContent = `${chars.toLocaleString()} תווים · ~${Math.ceil(chars / 4).toLocaleString()} טוקנים`;

  if (session.status === "passed") {
    els.promptStatusPill.textContent = "מאושר";
    els.promptVersionTag.innerHTML = `${ICONS.check} <span>Champion Prompt (Approved)</span>`;
    els.promptVersionTag.className = "badge badge-success";
  } else {
    els.promptStatusPill.textContent = `איטרציה ${state.iteration_count || 1}`;
    els.promptVersionTag.innerHTML = `${ICONS.zap} <span>גרסת עבודה (Challenger / Champion)</span>`;
    els.promptVersionTag.className = "badge badge-warning";
  }

  if (session.compilation_check) {
    els.compilationCheckBox.classList.remove("hidden");
    els.compilationCheckContent.textContent = session.compilation_check;
  } else {
    els.compilationCheckBox.classList.add("hidden");
  }

  els.promptFormattedView.innerHTML = renderStructuredMarkdown(promptText);
  els.promptRawView.textContent = state.champion_prompt || state.challenger_prompt || promptText;
}

function renderBlueprintTab(session) {
  const rawXml = session.raw_blueprint || "";
  const parsed = session.parsed_blueprint || {};
  const activeNode = activeStreamingNode || session.active_node;
  const isBlueprintCompiling =
    activeNode === "node_1_helper" ||
    activeNode === "node_2_construct" ||
    activeNode === "node_3_upgrader";

  if (!rawXml) {
    els.blueprintEmptyState.classList.remove("hidden");
    els.blueprintContainer.classList.add("hidden");
    els.copyXmlBtn.disabled = true;

    if (isBlueprintCompiling && isStreaming) {
      els.blueprintEmptyState.innerHTML = buildSkeletonHTML(
        activeNode === "node_3_upgrader" ? "The Upgrader" : "The Helper",
        activeStreamingDesc || "מנתח דרישות ומגבש את מבנה ה-XML Blueprint..."
      );
    } else {
      els.blueprintEmptyState.innerHTML = `
        <div class="empty-illustration">${ICONS.cpuLg}</div>
        <h3>תוכנית האב (<code class="tech-token" dir="ltr">&lt;GEM_BLUEPRINT&gt;</code>) טרם הופקה</h3>
        <p>השלם את שאלות המיקוד בראיון עם <code class="tech-token" dir="ltr">The Helper</code> כדי לחלץ את המודולים הקוגניטיביים וחוקי הפעולה.</p>
      `;
    }
    return;
  }

  els.blueprintEmptyState.classList.add("hidden");
  els.blueprintContainer.classList.remove("hidden");
  els.copyXmlBtn.disabled = false;
  els.bpVersionText.textContent = `V${parsed.version || "1.0"}`;

  const cardDefs = [
    { key: "title", icon: ICONS.target, label: "Title (פרסונה ותפקיד)", full: false },
    { key: "tone", icon: ICONS.mic, label: "Tone (סגנון דיבור)", full: false },
    { key: "domain_expertise", icon: ICONS.cpu, label: "Domain Expertise (תחומי מומחיות)", full: false },
    { key: "cognitive_modules", icon: ICONS.sliders, label: "Cognitive Modules (מודולים קוגניטיביים)", full: false },
    { key: "workflow", icon: ICONS.workflow, label: "Workflow (תהליך עבודה מובנה)", full: true },
    { key: "negative_constraints", icon: ICONS.ban, label: "Negative Constraints (איסורים ומגבלות)", full: true },
    { key: "output_format", icon: ICONS.fileText, label: "Output Format (תבנית פלט)", full: true },
  ];

  els.bpCardsGrid.innerHTML = "";
  cardDefs.forEach((def) => {
    if (!parsed[def.key]) return;
    const card = document.createElement("div");
    card.className = `bp-card ${def.full ? "full-width" : ""}`;
    card.dir = "ltr";
    card.innerHTML = `
      <div class="bp-card-label">${def.icon} <span>${escapeHtml(def.label)}</span></div>
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
        <div class="empty-illustration">${ICONS.shieldLg}</div>
        <h3>טרם בוצעו סבבי <code class="tech-token" dir="ltr">QA</code></h3>
        <p>ברגע שיופק פרומפט ראשוני, ה-<code class="tech-token" dir="ltr">Adjudicator</code> יבצע ביקורת איכות קפדנית ויציג כאן את הממצאים.</p>
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

  const championText = session.clean_champion_prompt || "";
  const challengerText = session.clean_challenger_prompt || "";

  if (championText || challengerText) {
    els.diffComparisonSection.classList.remove("hidden");
    els.diffChampionPre.textContent = championText || "(טרם נקבע Champion)";
    els.diffChallengerPre.textContent = challengerText || "(טרם נקבע Challenger)";
    renderUnifiedDiff(championText, challengerText);
  } else {
    els.diffComparisonSection.classList.add("hidden");
  }
}

// ==========================================
// Line-by-Line Unified Diff Utility
// ==========================================
function computeLineDiff(oldText, newText) {
  const oldLines = (oldText || "").split("\n");
  const newLines = (newText || "").split("\n");
  const n = oldLines.length;
  const m = newLines.length;

  if (n * m > 250000) {
    const out = [];
    const maxLen = Math.max(n, m);
    for (let i = 0; i < maxLen; i++) {
      if (i < n && i < m && oldLines[i] === newLines[i]) {
        out.push({ type: "ctx", text: oldLines[i] });
      } else {
        if (i < n) out.push({ type: "del", text: oldLines[i] });
        if (i < m) out.push({ type: "add", text: newLines[i] });
      }
    }
    return out;
  }

  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      result.push({ type: "ctx", text: oldLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "del", text: oldLines[i] });
      i++;
    } else {
      result.push({ type: "add", text: newLines[j] });
      j++;
    }
  }
  while (i < n) {
    result.push({ type: "del", text: oldLines[i++] });
  }
  while (j < m) {
    result.push({ type: "add", text: newLines[j++] });
  }
  return result;
}

function renderUnifiedDiff(championText, challengerText) {
  if (!els.diffUnifiedPre) return;
  const base = championText || challengerText || "";
  const target = challengerText || championText || "";
  const ops = computeLineDiff(base, target);

  els.diffUnifiedPre.innerHTML = ops
    .map((op) => {
      if (op.type === "add") {
        return `<span class="diff-line diff-add">+ ${escapeHtml(op.text)}</span>`;
      }
      if (op.type === "del") {
        return `<span class="diff-line diff-del">- ${escapeHtml(op.text)}</span>`;
      }
      return `<span class="diff-line diff-ctx">  ${escapeHtml(op.text)}</span>`;
    })
    .join("");
}

function renderTimelineTab(timeline) {
  if (els.timelineCountPill) {
    els.timelineCountPill.textContent = String((timeline || []).length);
  }

  els.timelineList.innerHTML = "";
  const reversed = (timeline || []).slice().reverse();
  const filtered = timelineFilterQuery
    ? reversed.filter((item) => {
        const hay = `${item.title || ""} ${item.detail || ""} ${item.timestamp || ""}`.toLowerCase();
        return hay.includes(timelineFilterQuery);
      })
    : reversed;

  if (filtered.length === 0) {
    els.timelineList.innerHTML = `
      <div class="empty-state" style="min-height:140px;padding:16px;">
        <p>${timelineFilterQuery ? "לא נמצאו אירועים התואמים לחיפוש." : "טרם נרשמו אירועים ביומן הסשן."}</p>
      </div>
    `;
    return;
  }

  filtered.forEach((item) => {
    const row = document.createElement("div");
    row.className = "timeline-item";
    row.innerHTML = `
      <div class="tl-time">${escapeHtml(item.timestamp || "")}</div>
      <div class="tl-body">
        <div class="tl-title">${formatSimpleMarkdown(item.title || "")}</div>
        <div class="tl-detail">${formatSimpleMarkdown(item.detail || "")}</div>
      </div>
    `;
    els.timelineList.appendChild(row);
  });
}

// ==========================================
// Helpers & BiDi Token Formatting
// ==========================================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const BI_DI_TECH_TERMS = [
  "The Helper",
  "The Construct",
  "The Adjudicator",
  "The Upgrader",
  "Adjudicator",
  "Upgrader",
  "Hill Climbing",
  "Circuit Breaker",
  "Challenger",
  "Champion",
];

function wrapBiDiTechTokens(safeHtml) {
  let out = safeHtml.replace(
    /&lt;(\/?[A-Za-z_][A-Za-z0-9_-]*)&gt;/g,
    '<code class="tech-token" dir="ltr">&lt;$1&gt;</code>'
  );
  BI_DI_TECH_TERMS.forEach((term) => {
    const reg = new RegExp(`\\b(${term})\\b`, "g");
    out = out.replace(reg, '<code class="tech-token" dir="ltr">$1</code>');
  });
  return out;
}

function formatSimpleMarkdown(text) {
  let safe = escapeHtml(text);
  const codeSlots = [];
  safe = safe.replace(/`([^`]+)`/g, (_, code) => {
    const token = `__CODE_SLOT_${codeSlots.length}__`;
    codeSlots.push(`<code class="tech-token" dir="ltr">${code}</code>`);
    return token;
  });
  safe = safe.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  safe = wrapBiDiTechTokens(safe);
  codeSlots.forEach((html, idx) => {
    safe = safe.replace(`__CODE_SLOT_${idx}__`, html);
  });
  return safe;
}

function renderStructuredMarkdown(markdownText) {
  if (!markdownText) return "";
  const lines = markdownText.split("\n");
  const out = [];
  let inCodeBlock = false;
  let codeLines = [];
  let inList = false;
  let listTag = "ul";

  function closeList() {
    if (inList) {
      out.push(`</${listTag}>`);
      inList = false;
    }
  }

  for (const rawLine of lines) {
    if (rawLine.trim().startsWith("```")) {
      closeList();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLines = [];
      } else {
        out.push(`<pre dir="ltr"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        inCodeBlock = false;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    const trimmed = rawLine.trim();
    if (/^###\s+/.test(trimmed)) {
      closeList();
      out.push(`<h3>${formatSimpleMarkdown(trimmed.replace(/^###\s+/, ""))}</h3>`);
    } else if (/^##\s+/.test(trimmed)) {
      closeList();
      out.push(`<h2>${formatSimpleMarkdown(trimmed.replace(/^##\s+/, ""))}</h2>`);
    } else if (/^#\s+/.test(trimmed)) {
      closeList();
      out.push(`<h1>${formatSimpleMarkdown(trimmed.replace(/^#\s+/, ""))}</h1>`);
    } else if (/^[-*]\s+/.test(trimmed)) {
      if (!inList || listTag !== "ul") {
        closeList();
        listTag = "ul";
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${formatSimpleMarkdown(trimmed.replace(/^[-*]\s+/, ""))}</li>`);
    } else if (/^\d+\.\s+/.test(trimmed)) {
      if (!inList || listTag !== "ol") {
        closeList();
        listTag = "ol";
        out.push("<ol>");
        inList = true;
      }
      out.push(`<li>${formatSimpleMarkdown(trimmed.replace(/^\d+\.\s+/, ""))}</li>`);
    } else {
      closeList();
      out.push(formatSimpleMarkdown(rawLine));
    }
  }

  closeList();
  if (inCodeBlock) {
    out.push(`<pre dir="ltr"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  return out.join("\n");
}

let toastTimer = null;
function showToast(msg, iconKey = "check") {
  const iconSvg = ICONS[iconKey] || ICONS.check;
  els.toast.innerHTML = `${iconSvg} <span>${escapeHtml(msg)}</span>`;
  els.toast.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.add("hidden");
  }, 3400);
}

// =========================================================
// BETTY (בטי) — Non-Overlapping Push Side-Panel & Floating Drawer
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
  const dockBtn = document.getElementById("bettyDockBtn");
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

  // Header Toggle Button opens/closes Betty Push Side-Panel
  fab.addEventListener("click", () => {
    const isNowHidden = win.classList.toggle("hidden");
    fab.classList.toggle("active", !isNowHidden);
    if (!isNowHidden) {
      renderBettyMessages();
      input.focus();
    }
  });

  closeBtn.addEventListener("click", () => {
    win.classList.add("hidden");
    fab.classList.remove("active");
  });

  // Dock / Float Toggle Button
  if (dockBtn) {
    dockBtn.addEventListener("click", () => {
      win.classList.remove("maximized");
      const isNowDocked = win.classList.toggle("docked");
      dockBtn.classList.toggle("active", isNowDocked);
      if (isNowDocked) {
        win.style.left = "";
        win.style.top = "";
        win.style.width = "";
        win.style.height = "";
      } else {
        win.style.left = "24px";
        win.style.top = "80px";
        win.style.width = "420px";
        win.style.height = "560px";
      }
    });
  }

  // Maximize / Restore
  maxBtn.addEventListener("click", () => {
    if (win.classList.contains("docked")) {
      win.classList.remove("docked");
      if (dockBtn) dockBtn.classList.remove("active");
    }
    win.classList.toggle("maximized");
  });

  // Double-clicking header toggles maximize when floating
  dragHeader.addEventListener("dblclick", (e) => {
    if (e.target.closest("button") || win.classList.contains("docked")) return;
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
        showToast("שיחת בטי במצב הנוכחי אופסה", "trash");
      }
    } catch (err) {
      console.warn(err);
    }
  });

  // Mode buttons (Segmented Control)
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

  // Setup Dragging & Resizing (when floating)
  setupBettyDragAndResize(win, dragHeader);
}

function renderBettyModeUI() {
  document.querySelectorAll(".betty-mode-btn").forEach((b) => {
    const isActive = b.dataset.mode === bettyMode;
    b.classList.toggle("active", isActive);
    b.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  const subStatus = document.getElementById("bettySubStatus");
  const input = document.getElementById("bettyInput");
  if (bettyMode === "tech_support") {
    subStatus.textContent = "מצב פעיל: תמיכה טכנית והדרכה על המערכת";
    input.placeholder = "שאל את בטי איך האפליקציה עובדת, מה קורה בכל שלב או איך לתפעל...";
  } else {
    subStatus.innerHTML = `מצב פעיל: יועצת הנדסת פרומפטים (<code class="tech-token" dir="ltr">Master Architect V5</code>)`;
    input.placeholder = "התייעץ עם בטי על ארכיטקטורת הבוט, פרומפטים, מודולים קוגניטיביים...";
  }

  // Render quick chips
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
        ? `${ICONS.user} <span>אתה</span>`
        : bettyMode === "tech_support"
        ? `${ICONS.wrench} <span>בטי — תמיכה טכנית</span>`
        : `${ICONS.layers} <span>בטי — <code class="tech-token" dir="ltr">Prompt Advisor V5</code></span>`;
    meta.innerHTML = `<strong style="display:inline-flex;align-items:center;gap:5px;">${sender}</strong><span class="tl-time">${escapeHtml(msg.timestamp || "")}</span>`;
    div.appendChild(meta);

    const body = document.createElement("div");
    body.className = "bubble-text";
    body.innerHTML = formatRichBettyMarkdown(msg.text || "");
    div.appendChild(body);

    if (msg.thought) {
      const details = document.createElement("details");
      details.className = "thought-drawer";
      const summary = document.createElement("summary");
      summary.innerHTML = `${ICONS.cpu} <span>תהליך חשיבה סמוי (<code class="tech-token" dir="ltr">ToT &amp; CoVe &lt;thought_process&gt;</code>)</span>`;
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
  thinkingText.innerHTML =
    bettyMode === "tech_support"
      ? "בטי בודקת את מפרט המערכת ומצב הסשן..."
      : `בטי מבצעת ניתוח <code class="tech-token" dir="ltr">Tree of Thoughts</code> ו-<code class="tech-token" dir="ltr">CoVe</code>...`;

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
      text: `שגיאת תקשורת: ${err.message}`,
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
      if (cells.every((c) => /^[-:]+$/.test(c))) return;
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
    if (
      e.target.closest("button") ||
      win.classList.contains("maximized") ||
      win.classList.contains("docked")
    ) {
      return;
    }
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
      if (win.classList.contains("maximized") || win.classList.contains("docked")) return;
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
      const minH = 380;

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
