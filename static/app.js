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
let activeArtifactFile = "__primary__";
const collapsedSuiteFolders = new Set();
let cachedSessionsList = [];
let historyFilterType = "ALL";
let historySearchQuery = "";
let isMasterMode = false;
let isMasterConfigured = null;
let healthRouting = null;
let activeStreamController = null;
let streamElapsedTimer = null;
let streamStartTime = 0;
let lastStreamCta = null;
let bettyClearConfirmTimer = null;
let isSyncingScroll = false;
let focusTrapCleanup = null;

const STORAGE_KEYS = {
  ACTIVE_SESSION_ID: "betterbot_active_session_id",
  ACTIVE_VIEW: "betterbot_active_view",
  WORKSPACE_ID: "betterbot_workspace_id",
  MASTER_KEY: "betterbot_master_key",
};

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
  folder: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
  chevronDown: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
};

function getTargetBadgeClass(targetType) {
  return String(targetType || "").trim().toUpperCase() === "SKILL_SUITE"
    ? "target-type-badge target-suite"
    : "target-type-badge";
}

function getFirstSuiteSkillPath(refFiles) {
  const keys = Object.keys(refFiles || {});
  if (keys.length === 0) return "__primary__";
  const nestedSkill = keys.find((k) => /^skills\/[^/]+\/SKILL\.md$/i.test(k));
  if (nestedSkill) return nestedSkill;
  const anySkill = keys.find((k) => /(^|\/)SKILL\.md$/i.test(k));
  return anySkill || keys[0];
}

function resolveActiveArtifactFile(session) {
  if (!session) {
    activeArtifactFile = "__primary__";
    return activeArtifactFile;
  }
  const st = session.state || {};
  const targetType = String(session.target_type || st.target_type || "SYSTEM_PROMPT")
    .trim()
    .toUpperCase();
  const refFiles = session.reference_files || st.reference_files || {};
  const refKeys = Object.keys(refFiles);
  const primaryText = (getBestPrompt(session) || "").trim();

  if (activeArtifactFile !== "__primary__" && refFiles[activeArtifactFile] === undefined) {
    activeArtifactFile = "__primary__";
  }

  if (activeArtifactFile === "__primary__" && refKeys.length > 0) {
    const isMinimalOrEmptySuite =
      targetType === "SKILL_SUITE" && primaryText.length < 80;
    if (!primaryText || isMinimalOrEmptySuite) {
      activeArtifactFile = getFirstSuiteSkillPath(refFiles);
    }
  }
  return activeArtifactFile;
}

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
  newSessionBtn: document.getElementById("newSessionBtn"),
  historyLibraryWrap: document.getElementById("historyLibraryWrap"),
  historyLibraryBtn: document.getElementById("historyLibraryBtn"),
  activeSessionLabel: document.getElementById("activeSessionLabel"),
  historyCountBadge: document.getElementById("historyCountBadge"),
  historyLibraryPopover: document.getElementById("historyLibraryPopover"),
  historySearchInput: document.getElementById("historySearchInput"),
  historyFilterBar: document.getElementById("historyFilterBar"),
  historyLibraryList: document.getElementById("historyLibraryList"),
  readinessBarWrap: document.getElementById("readinessBarWrap"),

  headerTelemetryPill: document.getElementById("headerTelemetryPill"),
  telemetryLiveDot: document.getElementById("telemetryLiveDot"),
  navStatusDot: document.getElementById("navStatusDot"),
  headerActiveNodeText: document.getElementById("headerActiveNodeText"),
  globalStageBadge: document.getElementById("globalStageBadge"),
  globalStageDesc: document.getElementById("globalStageDesc"),
  cbDots: document.getElementById("cbDots"),
  iterationBadge: document.getElementById("iterationBadge"),
  archCbText: document.getElementById("archCbText"),
  timelineCountPill: document.getElementById("timelineCountPill"),

  chatCanvasScroll: document.getElementById("chatCanvasScroll"),
  presetsContainer: document.getElementById("presetsContainer"),
  chatMessages: document.getElementById("chatMessages"),
  activeExecutionBar: document.getElementById("activeExecutionBar"),
  execSpinnerRing: document.getElementById("execSpinnerRing"),
  execNodeTitle: document.getElementById("execNodeTitle"),
  execStageText: document.getElementById("execStageText"),
  execNodeDesc: document.getElementById("execNodeDesc"),
  execElapsedTime: document.getElementById("execElapsedTime"),
  execActionCta: document.getElementById("execActionCta"),
  stopStreamBtn: document.getElementById("stopStreamBtn"),
  execDismissBtn: document.getElementById("execDismissBtn"),

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
  artifactTargetTypeBadge: document.getElementById("artifactTargetTypeBadge"),
  artifactSlugBadge: document.getElementById("artifactSlugBadge"),
  promptStatsText: document.getElementById("promptStatsText"),
  toggleRawPromptBtn: document.getElementById("toggleRawPromptBtn"),
  copyPromptBtn: document.getElementById("copyPromptBtn"),
  downloadPromptBtn: document.getElementById("downloadPromptBtn"),
  downloadZipBtn: document.getElementById("downloadZipBtn"),

  promptEmptyState: document.getElementById("promptEmptyState"),
  promptDisplayContainer: document.getElementById("promptDisplayContainer"),
  artifactFileSwitcher: document.getElementById("artifactFileSwitcher"),
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
  qaUpgraderForm: document.getElementById("qaUpgraderForm"),
  qaUpgraderInput: document.getElementById("qaUpgraderInput"),
  qaUpgraderSendBtn: document.getElementById("qaUpgraderSendBtn"),

  decisionRubricCard: document.getElementById("decisionRubricCard"),
  qaLogsList: document.getElementById("qaLogsList"),
  diffComparisonSection: document.getElementById("diffComparisonSection"),
  diffStatsBadge: document.getElementById("diffStatsBadge"),
  diffZeroChangesBanner: document.getElementById("diffZeroChangesBanner"),
  diffUnifiedContainer: document.getElementById("diffUnifiedContainer"),
  diffUnifiedPre: document.getElementById("diffUnifiedPre"),
  diffSplitContainer: document.getElementById("diffSplitContainer"),
  diffChampionPre: document.getElementById("diffChampionPre"),
  diffChallengerPre: document.getElementById("diffChallengerPre"),

  timelineSearchInput: document.getElementById("timelineSearchInput"),
  timelineList: document.getElementById("timelineList"),
  toast: document.getElementById("toast"),

  workspaceSyncBtn: document.getElementById("workspaceSyncBtn"),
  workspaceSyncBtnLabel: document.getElementById("workspaceSyncBtnLabel"),
  workspaceMasterPill: document.getElementById("workspaceMasterPill"),
  historyWorkspaceHint: document.getElementById("historyWorkspaceHint"),
  historyExportJsonBtn: document.getElementById("historyExportJsonBtn"),
  historyImportJsonBtn: document.getElementById("historyImportJsonBtn"),

  workspaceSyncModal: document.getElementById("workspaceSyncModal"),
  workspaceSyncCloseBtn: document.getElementById("workspaceSyncCloseBtn"),
  workspaceModeBadge: document.getElementById("workspaceModeBadge"),
  workspaceUuidRow: document.getElementById("workspaceUuidRow"),
  workspaceUuidText: document.getElementById("workspaceUuidText"),
  copyWorkspaceUuidBtn: document.getElementById("copyWorkspaceUuidBtn"),
  masterUnconfiguredHint: document.getElementById("masterUnconfiguredHint"),
  masterKeyForm: document.getElementById("masterKeyForm"),
  masterKeyInput: document.getElementById("masterKeyInput"),
  masterKeySubmitBtn: document.getElementById("masterKeySubmitBtn"),
  masterKeyFeedback: document.getElementById("masterKeyFeedback"),
  masterActiveActions: document.getElementById("masterActiveActions"),
  masterDisconnectBtn: document.getElementById("masterDisconnectBtn"),
  exportWorkspaceBtn: document.getElementById("exportWorkspaceBtn"),
  importWorkspaceBtn: document.getElementById("importWorkspaceBtn"),
  importWorkspaceFileInput: document.getElementById("importWorkspaceFileInput"),
  bettyClearBtnLabel: document.getElementById("bettyClearBtnLabel"),
};

// ==========================================
// Workspace Isolation & Auth Helpers
// ==========================================
function generateUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getOrCreateWorkspaceId() {
  let wid = (localStorage.getItem(STORAGE_KEYS.WORKSPACE_ID) || "").trim();
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!wid || !uuidPattern.test(wid)) {
    wid = generateUUID();
    localStorage.setItem(STORAGE_KEYS.WORKSPACE_ID, wid);
  }
  return wid;
}

function getStoredMasterKey() {
  return (localStorage.getItem(STORAGE_KEYS.MASTER_KEY) || "").trim();
}

function buildWorkspaceHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  headers["X-Workspace-ID"] = getOrCreateWorkspaceId();
  const masterKey = getStoredMasterKey();
  if (masterKey) {
    headers["X-Master-Key"] = masterKey;
  }
  return headers;
}

async function apiFetch(url, options = {}) {
  const mergedHeaders = buildWorkspaceHeaders(options.headers || {});
  return fetch(url, {
    ...options,
    headers: mergedHeaders,
  });
}

function updateWorkspaceSyncUI() {
  const wid = getOrCreateWorkspaceId();
  if (els.workspaceSyncBtn) {
    els.workspaceSyncBtn.classList.toggle("is-master", isMasterMode);
  }
  if (els.workspaceMasterPill) {
    els.workspaceMasterPill.classList.toggle("hidden", !isMasterMode);
  }
  if (els.historyWorkspaceHint) {
    els.historyWorkspaceHint.textContent = isMasterMode ? "מרחב Master מסונכרן" : "מרחב אישי מבודד";
  }
  if (els.workspaceModeBadge) {
    els.workspaceModeBadge.className = isMasterMode ? "badge badge-success" : "badge badge-neutral";
    els.workspaceModeBadge.textContent = isMasterMode
      ? "Master Mode פעיל (מסונכרן)"
      : "מרחב אנונימי מבודד";
  }
  if (els.workspaceUuidText) {
    els.workspaceUuidText.textContent = wid;
  }
  if (els.workspaceUuidRow) {
    els.workspaceUuidRow.classList.toggle("hidden", isMasterMode);
  }
  if (els.masterKeyForm) {
    els.masterKeyForm.classList.toggle("hidden", isMasterMode);
  }
  if (els.masterActiveActions) {
    els.masterActiveActions.classList.toggle("hidden", !isMasterMode);
  }
  if (els.masterUnconfiguredHint) {
    const showUnconfigured = !isMasterMode && isMasterConfigured === false;
    els.masterUnconfiguredHint.classList.toggle("hidden", !showUnconfigured);
  }
}

function showMasterKeyFeedback(message, isError = true) {
  if (!els.masterKeyFeedback) return;
  if (!message) {
    els.masterKeyFeedback.classList.add("hidden");
    els.masterKeyFeedback.textContent = "";
    return;
  }
  els.masterKeyFeedback.textContent = message;
  els.masterKeyFeedback.className = `workspace-feedback ${isError ? "error" : "success"}`;
}

async function initWorkspaceAuth() {
  getOrCreateWorkspaceId();
  const storedKey = getStoredMasterKey();
  if (storedKey) {
    try {
      const res = await fetch("/api/workspace/verify-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: storedKey }),
      });
      if (res.ok) {
        const data = await res.json();
        isMasterConfigured = Boolean(data.configured);
        if (data.authorized) {
          isMasterMode = true;
        } else {
          localStorage.removeItem(STORAGE_KEYS.MASTER_KEY);
          isMasterMode = false;
          showToast("מפתח ה-Master השמור אינו תקף — חזרת למרחב אנונימי", "alert");
        }
      }
    } catch (err) {
      console.warn("Workspace auth verification failed:", err);
    }
  } else {
    isMasterMode = false;
  }
  updateWorkspaceSyncUI();
}

function releaseFocusTrap() {
  if (typeof focusTrapCleanup === "function") {
    focusTrapCleanup();
    focusTrapCleanup = null;
  }
}

function trapFocus(modalEl, triggerEl) {
  releaseFocusTrap();
  if (!modalEl) return;
  const previousFocus = triggerEl || document.activeElement;
  const selector =
    'button:not([disabled]):not(.hidden), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const getFocusable = () =>
    Array.from(modalEl.querySelectorAll(selector)).filter(
      (el) => !el.closest(".hidden") && el.offsetParent !== null
    );

  const onKeyDown = (e) => {
    if (e.key !== "Tab") return;
    const focusables = getFocusable();
    if (!focusables.length) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first || !modalEl.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last || !modalEl.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  };

  modalEl.addEventListener("keydown", onKeyDown);
  const initialFocusables = getFocusable();
  if (initialFocusables.length > 0) {
    initialFocusables[0].focus();
  }

  focusTrapCleanup = () => {
    modalEl.removeEventListener("keydown", onKeyDown);
    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus();
    }
  };
}

async function openWorkspaceSyncModal() {
  if (!els.workspaceSyncModal) return;
  showMasterKeyFeedback("");
  if (els.masterKeyInput) els.masterKeyInput.value = "";
  updateWorkspaceSyncUI();
  els.workspaceSyncModal.classList.remove("hidden");
  trapFocus(els.workspaceSyncModal, els.workspaceSyncBtn || document.activeElement);

  if (!isMasterMode && isMasterConfigured === null) {
    try {
      const res = await fetch("/api/workspace/verify-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "" }),
      });
      if (res.ok) {
        const data = await res.json();
        isMasterConfigured = Boolean(data.configured);
        updateWorkspaceSyncUI();
      }
    } catch (err) {
      console.warn("Could not check master configuration status:", err);
    }
  }
}

function closeWorkspaceSyncModal() {
  if (!els.workspaceSyncModal) return;
  els.workspaceSyncModal.classList.add("hidden");
  releaseFocusTrap();
}

async function reloadWorkspaceState(resetActiveSession = true) {
  if (resetActiveSession) {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
    currentSession = null;
    activeArtifactFile = "__primary__";
    collapsedSuiteFolders.clear();
  }
  setHistoryPopoverOpen(false);
  await initSession();
  await refreshBettyHistory();
}

async function exportWorkspaceHistory() {
  try {
    const res = await apiFetch("/api/workspace/export");
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const blob = await res.blob();
    let filename = `betterbot-history-${isMasterMode ? "master" : "workspace"}.json`;
    const disp = res.headers.get("Content-Disposition") || "";
    const match = disp.match(/filename="?([^";]+)"?/i);
    if (match && match[1]) {
      filename = match[1];
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("היסטוריית מרחב העבודה יוצאה בהצלחה (JSON)", "download");
  } catch (err) {
    showToast(`שגיאה בייצוא ההיסטוריה: ${err.message}`, "alert");
  }
}

async function importWorkspaceHistory(file) {
  if (!file) return;
  if (isStreaming) {
    showToast("יש להמתין לסיום ההרצה הפעילה לפני ייבוא היסטוריה", "alert");
    return;
  }
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const res = await apiFetch("/api/workspace/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.detail || `HTTP ${res.status}`);
    }
    const summary = await res.json();
    closeWorkspaceSyncModal();
    await reloadWorkspaceState(false);
    showToast(`יובאו ${summary.imported ?? 0} סשנים בהצלחה למרחב העבודה`, "check");
  } catch (err) {
    showToast(`שגיאה בייבוא קובץ JSON: ${err.message}`, "alert");
  }
}

// ==========================================
// Initialization
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  bindUIEvents();
  await initWorkspaceAuth();
  await initBettyWidget();
  await checkHealth();
  await initSession();
  // Keep-Alive heartbeat every 4 minutes so Render free-tier containers stay warm while open
  setInterval(checkHealth, 4 * 60 * 1000);
});

async function checkHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    if (data.routing) {
      healthRouting = data.routing;
      renderNodeModelTags(currentSession);
    }
    if (data.model && els.modelNameText) {
      els.modelNameText.textContent = data.model;
    }
  } catch (err) {
    console.warn("Health check error:", err);
  }
}

function formatModelBadgeText(info) {
  if (!info || !info.model) return "";
  const levelMap = { medium: "med", low: "low", high: "high", none: "fast" };
  const lvl = levelMap[info.thinking_level] || info.thinking_level || "";
  if (info.fallback_used) {
    return lvl ? `fallback → ${info.model} · ${lvl}` : `fallback → ${info.model}`;
  }
  return lvl ? `${info.model} · ${lvl}` : info.model;
}

function renderNodeModelTags(session) {
  const telemetry = session?.model_telemetry || session?.state?.model_telemetry || {};
  const nodes = ["node_1_helper", "node_2_construct", "node_3_upgrader", "node_4_adjudicator"];
  nodes.forEach((nid) => {
    const el = document.getElementById(`model-${nid}`);
    if (!el) return;
    const nodeInfo = telemetry[nid] || healthRouting?.[nid] || null;
    if (!nodeInfo || !nodeInfo.model) {
      el.textContent = "";
      el.classList.remove("is-fallback");
      return;
    }
    el.textContent = formatModelBadgeText(nodeInfo);
    el.classList.toggle("is-fallback", Boolean(nodeInfo.fallback_used));
    const configured = nodeInfo.configured_model ? ` (configured: ${nodeInfo.configured_model})` : "";
    el.title = `Model: ${nodeInfo.model}${configured} | thinking_level=${nodeInfo.thinking_level || "default"}`;
  });
}

async function initSession() {
  const listRes = await apiFetch("/api/sessions");
  if (!listRes.ok) {
    throw new Error(`HTTP ${listRes.status}`);
  }
  const listData = await listRes.json();
  cachedSessionsList = listData.sessions || [];

  const savedSessionId = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
  const savedView = localStorage.getItem(STORAGE_KEYS.ACTIVE_VIEW);

  if (cachedSessionsList.length > 0) {
    const targetId =
      savedSessionId && cachedSessionsList.some((s) => s.session_id === savedSessionId)
        ? savedSessionId
        : cachedSessionsList[0].session_id;
    await loadSessionById(targetId, false);
    if (savedView && document.getElementById(savedView)) {
      switchWorkspaceView(savedView);
    }
  } else {
    await createNewSession();
  }
}

function resetPostStreamBarAndDots() {
  lastStreamCta = null;
  if (els.activeExecutionBar) {
    els.activeExecutionBar.classList.add("hidden");
    els.activeExecutionBar.classList.remove("is-completed", "tone-pass", "tone-escalate");
  }
  document.querySelectorAll(".nav-rail-btn .nav-notify-dot").forEach((dot) => {
    dot.className = "nav-notify-dot hidden";
  });
}

async function loadSessionById(sessionId, closeHistory = true) {
  if (!sessionId || isStreaming) return;
  const res = await apiFetch(`/api/sessions/${sessionId}`);
  if (!res.ok) {
    if (res.status === 404) {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
      await refreshSessionSelector();
      if (cachedSessionsList.length > 0) {
        await loadSessionById(cachedSessionsList[0].session_id, closeHistory);
      } else {
        await createNewSession();
      }
      return;
    }
    throw new Error(`HTTP ${res.status}`);
  }
  resetPostStreamBarAndDots();
  currentSession = await res.json();
  activeArtifactFile = "__primary__";
  collapsedSuiteFolders.clear();
  resolveActiveArtifactFile(currentSession);
  localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION_ID, currentSession.session_id);
  await refreshSessionSelector();
  renderAll(currentSession);
  if (closeHistory) {
    setHistoryPopoverOpen(false);
  }
}

async function createNewSession() {
  if (isStreaming) return;
  const res = await apiFetch("/api/sessions", { method: "POST" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  resetPostStreamBarAndDots();
  currentSession = await res.json();
  activeArtifactFile = "__primary__";
  collapsedSuiteFolders.clear();
  localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION_ID, currentSession.session_id);
  await refreshSessionSelector();
  switchWorkspaceView("view-interview");
  renderAll(currentSession);
  els.userInput.focus();
}

function updateActiveSessionPillLabel(session) {
  if (!els.activeSessionLabel) return;
  els.activeSessionLabel.textContent = (session && session.title) || "סוכן חדש";
}

async function refreshSessionSelector() {
  const res = await apiFetch("/api/sessions");
  if (!res.ok) return;
  const data = await res.json();
  cachedSessionsList = data.sessions || [];

  updateActiveSessionPillLabel(currentSession);

  if (els.historyCountBadge) {
    els.historyCountBadge.textContent = String(cachedSessionsList.length);
  }
  renderHistoryLibraryList();
}

function renderHistoryLibraryList() {
  if (!els.historyLibraryList) return;
  const q = historySearchQuery.trim().toLowerCase();
  const filtered = cachedSessionsList.filter((s) => {
    const typeMatch = historyFilterType === "ALL" || (s.target_type || "SYSTEM_PROMPT") === historyFilterType;
    if (!typeMatch) return false;
    if (!q) return true;
    const hay = `${s.title || ""} ${s.target_type || ""} ${s.slug_name || ""} ${s.status || ""}`.toLowerCase();
    return hay.includes(q);
  });

  if (filtered.length === 0) {
    const hasActiveFilter = Boolean(q || historyFilterType !== "ALL");
    const filterMsg = hasActiveFilter
      ? `לא נמצאו יצירות עבור ${q ? `"${escapeHtml(historySearchQuery.trim())}"` : `סוג ${escapeHtml(historyFilterType)}`}.`
      : "עדיין אין יצירות שמורות במרחב זה.";
    els.historyLibraryList.innerHTML = `
      <div class="empty-state" style="min-height:110px;padding:12px;gap:10px;">
        <p>${filterMsg}</p>
        ${hasActiveFilter ? `<button type="button" class="btn btn-secondary btn-sm history-clear-filter-btn">נקה סינון וחיפוש</button>` : ""}
      </div>
    `;
    const clearFilterBtn = els.historyLibraryList.querySelector(".history-clear-filter-btn");
    if (clearFilterBtn) {
      clearFilterBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        historySearchQuery = "";
        historyFilterType = "ALL";
        if (els.historySearchInput) els.historySearchInput.value = "";
        if (els.historyFilterBar) {
          els.historyFilterBar.querySelectorAll(".history-filter-chip").forEach((c) => {
            c.classList.toggle("active", c.dataset.filter === "ALL");
          });
        }
        renderHistoryLibraryList();
      });
    }
    return;
  }

  els.historyLibraryList.innerHTML = "";
  filtered.forEach((s) => {
    const item = document.createElement("div");
    item.className = "history-item";
    if (currentSession && s.session_id === currentSession.session_id) {
      item.classList.add("active");
    }

    const statusUpper = String(s.status || "idle").toUpperCase();
    let statusCls = "";
    if (statusUpper === "PASSED" || statusUpper === "PASS") statusCls = "status-passed";
    else if (statusUpper === "ESCALATED" || statusUpper === "ESCALATE") statusCls = "status-escalated";

    const timeLabel = formatRelativeTime(s.updated_at_iso || s.updated_at || s.created_at);

    item.innerHTML = `
      <button type="button" class="history-item-main">
        <div class="history-item-title">${escapeHtml(s.title || "ללא שם")}</div>
        <div class="history-item-meta">
          <span class="${getTargetBadgeClass(s.target_type)}">${escapeHtml(s.target_type || "SYSTEM_PROMPT")}</span>
          <span class="status-badge ${statusCls}">${escapeHtml(statusUpper)}</span>
          <span class="history-time">${escapeHtml(timeLabel)}</span>
        </div>
      </button>
      <div class="history-item-actions">
        <button type="button" class="history-action-btn rename" title="שנה שם">${ICONS.edit}</button>
        <button type="button" class="history-action-btn delete" title="מחק יצירה">${ICONS.trash}</button>
      </div>
    `;

    const mainBtn = item.querySelector(".history-item-main");
    const titleEl = item.querySelector(".history-item-title");
    let isRenaming = false;

    mainBtn.addEventListener("click", () => {
      if (isRenaming) return;
      loadSessionById(s.session_id, true);
    });

    item.querySelector(".history-action-btn.rename").addEventListener("click", (e) => {
      e.stopPropagation();
      if (isRenaming) return;
      isRenaming = true;
      const originalTitle = s.title || "";
      const renameInput = document.createElement("input");
      renameInput.type = "text";
      renameInput.className = "history-inline-rename";
      renameInput.value = originalTitle;
      renameInput.setAttribute("aria-label", "שם חדש ליצירה");

      titleEl.textContent = "";
      titleEl.appendChild(renameInput);
      renameInput.focus();
      renameInput.select();

      let finished = false;
      const restoreTitle = () => {
        isRenaming = false;
        titleEl.textContent = s.title || "ללא שם";
      };

      const commitRename = async () => {
        if (finished) return;
        finished = true;
        const nextTitle = renameInput.value.trim();
        if (!nextTitle || nextTitle === originalTitle.trim()) {
          restoreTitle();
          return;
        }
        try {
          const resp = await apiFetch(`/api/sessions/${s.session_id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: nextTitle }),
          });
          if (resp.ok) {
            const updated = await resp.json();
            if (currentSession && currentSession.session_id === s.session_id) {
              currentSession = updated;
              updateActiveSessionPillLabel(currentSession);
            }
            await refreshSessionSelector();
            showToast("שם היצירה עודכן", "check");
          } else {
            restoreTitle();
            showToast("שגיאה בעדכון שם היצירה", "alert");
          }
        } catch {
          restoreTitle();
          showToast("שגיאת תקשורת בעדכון השם", "alert");
        }
      };

      renameInput.addEventListener("click", (ev) => ev.stopPropagation());
      renameInput.addEventListener("keyup", (ev) => ev.stopPropagation());
      renameInput.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          ev.stopPropagation();
          commitRename();
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          ev.stopPropagation();
          finished = true;
          restoreTitle();
        }
      });
      renameInput.addEventListener("blur", () => {
        if (!finished) {
          commitRename();
        }
      });
    });

    const deleteBtn = item.querySelector(".history-action-btn.delete");
    let deleteConfirmTimer = null;
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!deleteBtn.classList.contains("is-confirming")) {
        deleteBtn.classList.add("is-confirming");
        deleteBtn.textContent = "בטוח?";
        deleteBtn.title = "לחץ שוב לאישור מחיקה";
        if (deleteConfirmTimer) clearTimeout(deleteConfirmTimer);
        deleteConfirmTimer = setTimeout(() => {
          deleteBtn.classList.remove("is-confirming");
          deleteBtn.innerHTML = ICONS.trash;
          deleteBtn.title = "מחק יצירה";
        }, 3500);
        return;
      }

      if (deleteConfirmTimer) clearTimeout(deleteConfirmTimer);
      deleteBtn.disabled = true;
      const resp = await apiFetch(`/api/sessions/${s.session_id}`, { method: "DELETE" });
      if (resp.ok) {
        if (currentSession && currentSession.session_id === s.session_id) {
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
          currentSession = null;
          await initSession();
        } else {
          await refreshSessionSelector();
        }
        showToast("היצירה נמחקה", "trash");
      } else {
        deleteBtn.disabled = false;
        deleteBtn.classList.remove("is-confirming");
        deleteBtn.innerHTML = ICONS.trash;
        showToast("שגיאה במחיקת היצירה", "alert");
      }
    });

    els.historyLibraryList.appendChild(item);
  });
}

function formatRelativeTime(isoOrClock) {
  if (!isoOrClock) return "";
  const parsed = Date.parse(isoOrClock);
  if (Number.isNaN(parsed)) return isoOrClock;
  const diffSec = Math.max(0, Math.floor((Date.now() - parsed) / 1000));
  if (diffSec < 60) return "עכשיו";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `לפני ${diffMin} דק'`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `לפני ${diffHrs} שע'`;
  return new Date(parsed).toLocaleDateString("he-IL");
}

// ==========================================
// Multi-Window Studio Routing & Sub-Tab Switching
// ==========================================
function setNavNotification(viewId, tone = "info") {
  if (!viewId || activeWorkspaceView === viewId) return;
  const btn = document.querySelector(`.nav-rail-btn[data-view="${viewId}"]`);
  const dot = btn?.querySelector(".nav-notify-dot");
  if (!dot) return;
  dot.className = `nav-notify-dot tone-${tone}`;
}

function clearNavNotification(viewId) {
  if (!viewId) return;
  const btn = document.querySelector(`.nav-rail-btn[data-view="${viewId}"]`);
  const dot = btn?.querySelector(".nav-notify-dot");
  if (!dot) return;
  dot.className = "nav-notify-dot hidden";
}

function switchWorkspaceView(viewId) {
  if (!viewId) return;
  activeWorkspaceView = viewId;
  localStorage.setItem(STORAGE_KEYS.ACTIVE_VIEW, viewId);
  clearNavNotification(viewId);

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
function setHistoryPopoverOpen(isOpen) {
  if (!els.historyLibraryPopover || !els.historyLibraryBtn) return;
  els.historyLibraryPopover.classList.toggle("hidden", !isOpen);
  els.historyLibraryBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

function bindUIEvents() {
  els.newSessionBtn.addEventListener("click", createNewSession);

  // Creation History Library Popover Toggle, Search & Filter
  if (els.historyLibraryBtn && els.historyLibraryPopover) {
    els.historyLibraryBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const willOpen = els.historyLibraryPopover.classList.contains("hidden");
      setHistoryPopoverOpen(willOpen);
      if (willOpen) {
        await refreshSessionSelector();
        if (els.historySearchInput) els.historySearchInput.focus();
      }
    });

    document.addEventListener("click", (e) => {
      if (
        els.historyLibraryWrap &&
        !els.historyLibraryWrap.contains(e.target) &&
        !els.historyLibraryPopover.classList.contains("hidden")
      ) {
        setHistoryPopoverOpen(false);
      }
    });
  }

  if (els.historySearchInput) {
    els.historySearchInput.addEventListener("input", (e) => {
      historySearchQuery = e.target.value || "";
      renderHistoryLibraryList();
    });
  }

  if (els.historyFilterBar) {
    els.historyFilterBar.querySelectorAll(".history-filter-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        historyFilterType = chip.dataset.filter || "ALL";
        els.historyFilterBar.querySelectorAll(".history-filter-chip").forEach((c) => {
          c.classList.toggle("active", c.dataset.filter === historyFilterType);
        });
        renderHistoryLibraryList();
      });
    });
  }

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
      autoResizeTextarea(els.userInput);
      els.userInput.focus();
      els.userInput.setSelectionRange(prompt.length, prompt.length);
      const inputShell = els.userInput.closest(".input-row") || els.userInput;
      inputShell.classList.remove("input-flash");
      void inputShell.offsetWidth; // trigger reflow
      inputShell.classList.add("input-flash");
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

  els.userInput.addEventListener("input", () => autoResizeTextarea(els.userInput));

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

  // Contextual Upgrader Command Bar inside view-qa
  if (els.qaUpgraderForm && els.qaUpgraderInput) {
    els.qaUpgraderForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = els.qaUpgraderInput.value.trim();
      if (!text || isStreaming) return;
      els.qaUpgraderInput.value = "";
      sendUserMessage(text);
    });
  }

  // Stop Active SSE Stream (AbortController) & Execution Bar Controls
  if (els.stopStreamBtn) {
    els.stopStreamBtn.addEventListener("click", () => {
      if (activeStreamController) {
        activeStreamController.abort();
      }
    });
  }

  if (els.execDismissBtn) {
    els.execDismissBtn.addEventListener("click", () => {
      lastStreamCta = null;
      if (els.activeExecutionBar) {
        els.activeExecutionBar.classList.add("hidden");
        els.activeExecutionBar.classList.remove("is-completed", "tone-pass", "tone-escalate");
      }
    });
  }

  if (els.execActionCta) {
    els.execActionCta.addEventListener("click", () => {
      if (lastStreamCta && typeof lastStreamCta.action === "function") {
        lastStreamCta.action();
      }
    });
  }

  // Side-by-Side Diff Scroll Synchronization (re-entrancy locked)
  const syncDiffScroll = (sourceEl, targetEl) => {
    if (!sourceEl || !targetEl || isSyncingScroll) return;
    isSyncingScroll = true;
    const maxSource = sourceEl.scrollHeight - sourceEl.clientHeight;
    const maxTarget = targetEl.scrollHeight - targetEl.clientHeight;
    if (maxSource > 0 && maxTarget > 0) {
      const ratio = sourceEl.scrollTop / maxSource;
      targetEl.scrollTop = ratio * maxTarget;
    } else {
      targetEl.scrollTop = sourceEl.scrollTop;
    }
    requestAnimationFrame(() => {
      isSyncingScroll = false;
    });
  };
  if (els.diffChampionPre && els.diffChallengerPre) {
    els.diffChampionPre.addEventListener("scroll", () =>
      syncDiffScroll(els.diffChampionPre, els.diffChallengerPre)
    );
    els.diffChallengerPre.addEventListener("scroll", () =>
      syncDiffScroll(els.diffChallengerPre, els.diffChampionPre)
    );
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

  // Copy Prompt / Active File
  els.copyPromptBtn.addEventListener("click", () => {
    const contentText = getActiveArtifactContent(currentSession);
    if (!contentText) return;
    navigator.clipboard.writeText(contentText);
    showToast("תוכן הקובץ הועתק ללוח", "check");
  });

  // Download Prompt .MD
  els.downloadPromptBtn.addEventListener("click", () => {
    const contentText = getActiveArtifactContent(currentSession);
    if (!contentText) return;
    const resolvedFile = resolveActiveArtifactFile(currentSession);
    const targetType = currentSession?.target_type || "SYSTEM_PROMPT";
    const defaultName =
      targetType === "SKILL_PACKAGE"
        ? "SKILL.md"
        : `system_prompt_${currentSession?.session_id || "gem"}.md`;
    const suiteSkillMatch = resolvedFile.match(/^skills\/([^/]+)\/SKILL\.md$/i);
    const fileName =
      resolvedFile !== "__primary__"
        ? suiteSkillMatch
          ? `${suiteSkillMatch[1]}-SKILL.md`
          : resolvedFile.split("/").pop()
        : defaultName;
    const blob = new Blob([contentText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    showToast("הקובץ ירד בהצלחה", "download");
  });

  // Download Full Package .ZIP
  if (els.downloadZipBtn) {
    els.downloadZipBtn.addEventListener("click", async () => {
      if (!currentSession?.session_id) return;
      try {
        const res = await apiFetch(`/api/sessions/${currentSession.session_id}/download`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const blob = await res.blob();
        let filename = `${currentSession.slug_name || currentSession.session_id}.zip`;
        const disp = res.headers.get("Content-Disposition") || "";
        const match = disp.match(/filename="?([^";]+)"?/i);
        if (match && match[1]) {
          filename = match[1];
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast("החבילה (.ZIP) ירדה בהצלחה", "download");
      } catch (err) {
        showToast(`שגיאה בהורדת החבילה: ${err.message}`, "alert");
      }
    });
  }

  // Copy XML
  els.copyXmlBtn.addEventListener("click", () => {
    const xml = currentSession?.raw_blueprint || "";
    if (!xml) return;
    navigator.clipboard.writeText(xml);
    showToast("קוד ה-XML Blueprint הועתק ללוח", "check");
  });

  // Workspace Sync Modal & JSON Portability
  if (els.workspaceSyncBtn) {
    els.workspaceSyncBtn.addEventListener("click", openWorkspaceSyncModal);
  }
  if (els.workspaceSyncCloseBtn) {
    els.workspaceSyncCloseBtn.addEventListener("click", closeWorkspaceSyncModal);
  }
  if (els.workspaceSyncModal) {
    els.workspaceSyncModal.addEventListener("click", (e) => {
      if (e.target === els.workspaceSyncModal) {
        closeWorkspaceSyncModal();
      }
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (e.target && e.target.classList && e.target.classList.contains("history-inline-rename")) {
      return;
    }
    if (els.workspaceSyncModal && !els.workspaceSyncModal.classList.contains("hidden")) {
      closeWorkspaceSyncModal();
      return;
    }
    if (els.historyLibraryPopover && !els.historyLibraryPopover.classList.contains("hidden")) {
      setHistoryPopoverOpen(false);
      if (els.historyLibraryBtn) els.historyLibraryBtn.focus();
      return;
    }
    const bettyWin = document.getElementById("bettyWindow");
    const bettyFab = document.getElementById("bettyFab");
    if (bettyWin && !bettyWin.classList.contains("hidden") && !bettyWin.classList.contains("docked")) {
      bettyWin.classList.add("hidden");
      if (bettyFab) {
        bettyFab.classList.remove("active");
        bettyFab.setAttribute("aria-expanded", "false");
        bettyFab.focus();
      }
    }
  });

  if (els.copyWorkspaceUuidBtn) {
    els.copyWorkspaceUuidBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(getOrCreateWorkspaceId());
      showToast("מזהה מרחב העבודה הועתק ללוח", "check");
    });
  }

  if (els.masterKeyForm) {
    els.masterKeyForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (isStreaming) {
        showMasterKeyFeedback("יש להמתין לסיום ההרצה הפעילה לפני החלפת מרחב עבודה", true);
        return;
      }
      const key = (els.masterKeyInput?.value || "").trim();
      if (!key) {
        showMasterKeyFeedback("נא להזין מפתח Master", true);
        return;
      }
      if (els.masterKeySubmitBtn) els.masterKeySubmitBtn.disabled = true;
      showMasterKeyFeedback("");
      try {
        const res = await fetch("/api/workspace/verify-master", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        });
        const data = await res.json().catch(() => ({}));
        isMasterConfigured = Boolean(data.configured);
        if (!data.configured) {
          updateWorkspaceSyncUI();
          showMasterKeyFeedback("מפתח MASTER_WORKSPACE_KEY אינו מוגדר בשרת כרגע.", true);
          return;
        }
        if (!data.authorized) {
          updateWorkspaceSyncUI();
          showMasterKeyFeedback("המפתח שהוזן שגוי.", true);
          return;
        }
        localStorage.setItem(STORAGE_KEYS.MASTER_KEY, key);
        isMasterMode = true;
        updateWorkspaceSyncUI();
        closeWorkspaceSyncModal();
        await reloadWorkspaceState(true);
        showToast("מצב Master הופעל — היסטוריית הבעלים מסונכרנת", "check");
      } catch (err) {
        showMasterKeyFeedback(`שגיאת תקשורת: ${err.message}`, true);
      } finally {
        if (els.masterKeySubmitBtn) els.masterKeySubmitBtn.disabled = false;
      }
    });
  }

  if (els.masterDisconnectBtn) {
    els.masterDisconnectBtn.addEventListener("click", async () => {
      if (isStreaming) {
        showToast("יש להמתין לסיום ההרצה הפעילה לפני ניתוק מ-Master", "alert");
        return;
      }
      localStorage.removeItem(STORAGE_KEYS.MASTER_KEY);
      isMasterMode = false;
      updateWorkspaceSyncUI();
      closeWorkspaceSyncModal();
      await reloadWorkspaceState(true);
      showToast("חזרת למרחב העבודה האנונימי המבודד", "check");
    });
  }

  if (els.exportWorkspaceBtn) {
    els.exportWorkspaceBtn.addEventListener("click", exportWorkspaceHistory);
  }
  if (els.historyExportJsonBtn) {
    els.historyExportJsonBtn.addEventListener("click", exportWorkspaceHistory);
  }

  const triggerImportPicker = () => {
    if (isStreaming) {
      showToast("יש להמתין לסיום ההרצה הפעילה לפני ייבוא היסטוריה", "alert");
      return;
    }
    if (els.importWorkspaceFileInput) {
      els.importWorkspaceFileInput.value = "";
      els.importWorkspaceFileInput.click();
    }
  };
  if (els.importWorkspaceBtn) {
    els.importWorkspaceBtn.addEventListener("click", triggerImportPicker);
  }
  if (els.historyImportJsonBtn) {
    els.historyImportJsonBtn.addEventListener("click", triggerImportPicker);
  }
  if (els.importWorkspaceFileInput) {
    els.importWorkspaceFileInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        await importWorkspaceHistory(file);
      }
      e.target.value = "";
    });
  }
}

// ==========================================
// Streaming Execution (SSE)
// ==========================================
function formatElapsedSeconds(totalSec) {
  const mins = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const secs = String(totalSec % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function getStageLabelForNode(nodeId, session) {
  const stageMap = {
    node_1_helper: "שלב 1/4",
    node_2_construct: "שלב 2/4",
    node_4_adjudicator: "שלב 3/4",
    node_3_upgrader: "שלב 4/4",
  };
  const base = stageMap[nodeId] || "פעיל";
  const iter = session?.state?.iteration_count || 0;
  return iter > 0 ? `${base} · איטרציה ${iter}/3` : base;
}

async function sendUserMessage(messageText) {
  if (!currentSession || isStreaming) return;
  isStreaming = true;
  lastStreamCta = null;
  let wasAborted = false;
  activeStreamController = new AbortController();

  els.userInput.value = "";
  resetTextareaHeight(els.userInput);
  els.sendBtn.disabled = true;
  if (els.artifactUpgraderSendBtn) els.artifactUpgraderSendBtn.disabled = true;
  if (els.qaUpgraderSendBtn) els.qaUpgraderSendBtn.disabled = true;
  els.presetsContainer.classList.add("hidden");
  if (els.chatCanvasScroll) els.chatCanvasScroll.classList.remove("is-onboarding");
  if (els.chatMessages) els.chatMessages.classList.remove("hidden");

  if (els.activeExecutionBar) {
    els.activeExecutionBar.classList.remove("hidden", "is-completed", "tone-pass", "tone-escalate");
  }
  if (els.execSpinnerRing) els.execSpinnerRing.classList.remove("hidden");
  if (els.stopStreamBtn) els.stopStreamBtn.classList.remove("hidden");
  if (els.execActionCta) els.execActionCta.classList.add("hidden");
  if (els.execDismissBtn) els.execDismissBtn.classList.add("hidden");
  if (els.execNodeTitle) els.execNodeTitle.textContent = "מאתחל צינור סוכנים...";
  if (els.execStageText) els.execStageText.textContent = "שלב 1/4";
  if (els.execNodeDesc) els.execNodeDesc.textContent = "מעבד הנחיה...";
  if (els.execElapsedTime) els.execElapsedTime.textContent = "00:00";

  streamStartTime = Date.now();
  if (streamElapsedTimer) clearInterval(streamElapsedTimer);
  streamElapsedTimer = setInterval(() => {
    if (els.execElapsedTime) {
      const elapsedSec = Math.max(0, Math.floor((Date.now() - streamStartTime) / 1000));
      els.execElapsedTime.textContent = formatElapsedSeconds(elapsedSec);
    }
  }, 1000);

  // Optimistically render user bubble
  appendOptimisticUserBubble(messageText);

  try {
    let response = await apiFetch(`/api/sessions/${currentSession.session_id}/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: messageText, mode: "auto" }),
      signal: activeStreamController.signal,
    });

    // Auto-recover if server restarted and session ID was evicted
    if (response.status === 404) {
      const res = await apiFetch("/api/sessions", {
        method: "POST",
        signal: activeStreamController.signal,
      });
      currentSession = await res.json();
      activeArtifactFile = "__primary__";
      collapsedSuiteFolders.clear();
      response = await apiFetch(`/api/sessions/${currentSession.session_id}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText, mode: "auto" }),
        signal: activeStreamController.signal,
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
    if (err && err.name === "AbortError") {
      wasAborted = true;
      showToast("ההזרמה נעצרה בצד הלקוח", "check");
    } else {
      // Restore user's message input so nothing is lost on network failure
      if (els.userInput && !els.userInput.value) {
        els.userInput.value = messageText;
        autoResizeTextarea(els.userInput);
      }
      showToast(`שגיאת תקשורת: ${err.message}`, "alert");
    }
  } finally {
    if (streamElapsedTimer) {
      clearInterval(streamElapsedTimer);
      streamElapsedTimer = null;
    }
    activeStreamController = null;
    isStreaming = false;
    activeStreamingNode = null;
    activeStreamingDesc = "";
    els.sendBtn.disabled = false;
    if (els.artifactUpgraderSendBtn) els.artifactUpgraderSendBtn.disabled = false;
    if (els.qaUpgraderSendBtn) els.qaUpgraderSendBtn.disabled = false;
    if (els.execSpinnerRing) els.execSpinnerRing.classList.add("hidden");
    if (els.stopStreamBtn) els.stopStreamBtn.classList.add("hidden");

    if (wasAborted) {
      if (els.activeExecutionBar) {
        els.activeExecutionBar.classList.remove("hidden", "tone-pass", "tone-escalate");
        els.activeExecutionBar.classList.add("is-completed");
      }
      if (els.execNodeTitle) els.execNodeTitle.textContent = "הרצה הופסקה";
      if (els.execStageText) els.execStageText.textContent = "בוטל";
      if (els.execNodeDesc) els.execNodeDesc.textContent = "ההזרמה נעצרה בצד הלקוח";
      if (els.execActionCta) els.execActionCta.classList.add("hidden");
      if (els.execDismissBtn) els.execDismissBtn.classList.remove("hidden");
    } else if (lastStreamCta) {
      if (els.activeExecutionBar) {
        els.activeExecutionBar.classList.remove("hidden", "tone-pass", "tone-escalate");
        els.activeExecutionBar.classList.add("is-completed");
        if (lastStreamCta.tone === "pass") els.activeExecutionBar.classList.add("tone-pass");
        if (lastStreamCta.tone === "escalate") els.activeExecutionBar.classList.add("tone-escalate");
      }
      if (els.execNodeTitle) els.execNodeTitle.textContent = lastStreamCta.summaryTitle || "הושלם";
      if (els.execStageText) els.execStageText.textContent = lastStreamCta.stageBadge || "הושלם";
      if (els.execNodeDesc) els.execNodeDesc.textContent = lastStreamCta.summaryDesc || "";
      if (els.execActionCta) {
        els.execActionCta.textContent = lastStreamCta.label;
        els.execActionCta.classList.remove("hidden");
      }
      if (els.execDismissBtn) els.execDismissBtn.classList.remove("hidden");
    } else if (els.activeExecutionBar) {
      els.activeExecutionBar.classList.add("hidden");
    }

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

  if (eventType === "session_update" || eventType === "state_update") {
    currentSession = payload;
    renderAll(currentSession);
  } else if (eventType === "node_start") {
    activeStreamingNode = payload.node;
    activeStreamingDesc = payload.description || "";
    if (els.activeExecutionBar) {
      els.activeExecutionBar.classList.remove("hidden", "is-completed", "tone-pass", "tone-escalate");
    }
    if (els.execSpinnerRing) els.execSpinnerRing.classList.remove("hidden");
    if (els.stopStreamBtn) els.stopStreamBtn.classList.remove("hidden");
    if (els.execActionCta) els.execActionCta.classList.add("hidden");
    if (els.execDismissBtn) els.execDismissBtn.classList.add("hidden");
    els.execNodeTitle.textContent = payload.title;
    if (els.execStageText) {
      els.execStageText.textContent = getStageLabelForNode(payload.node, currentSession);
    }
    els.execNodeDesc.textContent = payload.model
      ? `${payload.description} (${payload.model})`
      : payload.description;
    if (payload.model && payload.node) {
      const tagEl = document.getElementById(`model-${payload.node}`);
      if (tagEl) {
        tagEl.textContent = formatModelBadgeText(payload);
        tagEl.classList.remove("is-fallback");
      }
    }
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
      setNavNotification("view-artifacts", "info");
      lastStreamCta = {
        label: "צפה ב-XML Blueprint ←",
        action: () => switchTab("blueprintTab"),
        tone: "info",
        stageBadge: "Blueprint מוכן",
        summaryTitle: "תוכנית האב הופקה",
        summaryDesc: "תוכנית ה-XML Blueprint מוכנה לצפייה",
      };
    } else if (payload.node === "node_2_construct" || payload.node === "node_4_adjudicator") {
      setNavNotification("view-artifacts", "info");
      lastStreamCta = {
        label: "צפה בפרומפט ←",
        action: () => switchTab("promptTab"),
        tone: "info",
        stageBadge: "פרומפט מעודכן",
        summaryTitle: "הפרומפט עודכן",
        summaryDesc: "התוצר הידר ומוכן לבדיקה במעבדת הפרומפט",
      };
    }
  } else if (eventType === "done") {
    activeStreamingNode = null;
    currentSession = payload;
    renderAll(currentSession);
    if (currentSession.status === "passed") {
      setNavNotification("view-artifacts", "pass");
      lastStreamCta = {
        label: "צפה בפרומפט המאושר ←",
        action: () => switchTab("promptTab"),
        tone: "pass",
        stageBadge: "PASS",
        summaryTitle: "הפרומפט אושר סופית",
        summaryDesc: "בקרת האיכות הושלמה בהצלחה — ניתן לעבור לתוצר",
      };
      showToast("הפרומפט אושר על ידי מבקר האיכות (PASS)", "check");
    } else if (currentSession.status === "escalated") {
      setNavNotification("view-qa", "escalate");
      lastStreamCta = {
        label: "פתח מעבדת QA לתיקון ←",
        action: () => switchWorkspaceView("view-qa"),
        tone: "escalate",
        stageBadge: "ESCALATE",
        summaryTitle: "נדרשת הכוונה ידנית",
        summaryDesc: "הופעל Circuit Breaker — צפה בממצאים ושלח תיקון ב-QA",
      };
      showToast("נדרשת הכוונה ידנית (Circuit Breaker)", "alert");
    }
  } else if (eventType === "error") {
    activeStreamingNode = null;
    lastStreamCta = null;
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
  if (session.session_id) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION_ID, session.session_id);
  }
  updateActiveSessionPillLabel(session);
  const userTurns = (session.chat_history || []).filter((m) => m.role === "user").length;
  els.presetsContainer.classList.toggle("hidden", userTurns > 0);
  if (els.chatMessages) els.chatMessages.classList.toggle("hidden", userTurns === 0);
  if (els.chatCanvasScroll) els.chatCanvasScroll.classList.toggle("is-onboarding", userTurns === 0);

  renderPipelineStatus(session);
  renderReadinessPill(session);
  renderChatHistory(session.chat_history || [], session);
  renderInputMode(session);
  renderPromptTab(session);
  renderBlueprintTab(session);
  renderQATab(session);
  renderTimelineTab(session.timeline || []);
}

function renderReadinessPill(session) {
  if (!els.readinessBarWrap) return;
  const st = session.state || {};
  const readiness = session.readiness_scores || st.readiness_scores || {};
  const targetType = session.target_type || st.target_type;
  const userTurns = (session.chat_history || []).filter((m) => m.role === "user").length;

  if (!readiness.used_decision_model && (userTurns === 0 || !targetType)) {
    els.readinessBarWrap.classList.add("hidden");
    return;
  }

  const dims = [
    { key: "has_core_objective", label: "מטרה" },
    { key: "has_trigger_or_context", label: "הפעלה" },
    { key: "has_output_contract", label: "פלט" },
  ];
  const dotsHtml = dims
    .map((d) => {
      const ok = Number(readiness[d.key] || 0) >= 0.8;
      return `<span class="readiness-dim-dot ${ok ? "ready" : ""}" title="${d.label}: ${Math.round(Number(readiness[d.key] || 0) * 100)}%"></span>`;
    })
    .join("");

  const readyPct = readiness.used_decision_model
    ? `${Math.round(Number(readiness.ready_to_compile || 0) * 100)}% מוכנות`
    : "אפיון פעיל";

  els.readinessBarWrap.classList.remove("hidden");
  els.readinessBarWrap.innerHTML = `
    <span class="${getTargetBadgeClass(targetType)}">${escapeHtml(targetType || "SYSTEM_PROMPT")}</span>
    <span class="readiness-dim-dots">${dotsHtml}</span>
    <span class="mono-text" style="font-size:0.75rem;">${escapeHtml(readyPct)}</span>
  `;
}

function renderPipelineStatus(session) {
  const state = session.state || {};
  const iter = state.iteration_count || 0;
  const hasBlueprint = Boolean(session.raw_blueprint);
  const refFiles = session.reference_files || state.reference_files || {};
  const hasPrompt = Boolean(
    (session.clean_champion_prompt || session.clean_challenger_prompt || "").trim() ||
      Object.keys(refFiles).length > 0
  );
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

  // Header Telemetry Pill & Single-Source Status Indicator
  const activeNodeId = activeStreamingNode || session.active_node;
  const statusTone =
    activeNodeId || status === "compiling"
      ? "active"
      : status === "passed"
      ? "passed"
      : status === "escalated"
      ? "escalated"
      : "";
  if (els.telemetryLiveDot) {
    els.telemetryLiveDot.className = statusTone ? `telemetry-live-dot ${statusTone}` : "telemetry-live-dot";
  }
  if (els.navStatusDot) {
    els.navStatusDot.className = statusTone ? `nav-status-dot ${statusTone}` : "nav-status-dot";
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

  if (els.globalStageBadge) {
    els.globalStageBadge.className = "stage-indicator";
    if (status === "passed") {
      els.globalStageBadge.classList.add("status-passed");
      els.globalStageBadge.innerHTML = `אושר סופית (<code class="tech-token" dir="ltr">PASS</code>)`;
    } else if (status === "escalated") {
      els.globalStageBadge.classList.add("status-escalated");
      els.globalStageBadge.innerHTML = `הסלמה (<code class="tech-token" dir="ltr">ESCALATE</code>)`;
    } else if (status === "compiling") {
      els.globalStageBadge.textContent = "הידור ובקרת איכות";
    } else if (status === "interviewing") {
      els.globalStageBadge.innerHTML = `שלב הראיון (<code class="tech-token" dir="ltr">Phase 1</code>)`;
    } else {
      els.globalStageBadge.textContent = "מוכן להפעלה";
    }
  }

  if (els.globalStageDesc) {
    if (status === "passed") {
      els.globalStageDesc.innerHTML = `הפרומפט עבר בקרת איכות ומוכן להטמעה. ניתן לשלוח הנחיות שדרוג נוספות.`;
    } else if (status === "escalated") {
      els.globalStageDesc.innerHTML = `מפסק הפחת הופעל. הזן הוראת תיקון ידנית עבור <code class="tech-token" dir="ltr">The Upgrader</code>.`;
    } else if (status === "compiling") {
      els.globalStageDesc.innerHTML = `הסוכנים מהדרים ובודקים את הפרומפט מול <code class="tech-token" dir="ltr">&lt;ARTIFACT_BLUEPRINT&gt;</code>...`;
    } else if (status === "interviewing") {
      els.globalStageDesc.innerHTML = `<code class="tech-token" dir="ltr">The Helper</code> אוסף מידע לאפיון תוכנית האב`;
    } else {
      els.globalStageDesc.textContent = "ממתין לתיאור הסוכן הראשוני מהמשתמש";
    }
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
  renderNodeModelTags(session);
}

function highlightActiveNode(nodeId, description) {
  if (els.headerActiveNodeText && NODE_SHORT_LABELS[nodeId]) {
    els.headerActiveNodeText.textContent = NODE_SHORT_LABELS[nodeId];
  }
  if (els.telemetryLiveDot) {
    els.telemetryLiveDot.className = "telemetry-live-dot active";
  }
  if (els.navStatusDot) {
    els.navStatusDot.className = "nav-status-dot active";
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
  if (els.globalStageDesc) els.globalStageDesc.textContent = description;
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

function renderChatHistory(history, session = currentSession) {
  els.chatMessages.innerHTML = "";
  const userTurns = (history || []).filter((m) => m.role === "user").length;
  if (userTurns === 0) {
    els.chatMessages.classList.add("hidden");
    return;
  }
  els.chatMessages.classList.remove("hidden");
  let lastAssistantIdx = -1;
  for (let idx = history.length - 1; idx >= 0; idx--) {
    if (history[idx]?.role !== "user") {
      lastAssistantIdx = idx;
      break;
    }
  }

  history.forEach((msg, idx) => {
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

    if (idx === lastAssistantIdx && session) {
      const st = session.state || {};
      const refFiles = session.reference_files || st.reference_files || {};
      const hasPrompt = Boolean((getBestPrompt(session) || "").trim() || Object.keys(refFiles).length > 0);
      let ctaLabel = "";
      let ctaHandler = null;
      if (session.status === "passed") {
        ctaLabel = "צפה בפרומפט המאושר ←";
        ctaHandler = () => switchTab("promptTab");
      } else if (session.status === "escalated") {
        ctaLabel = "פתח מעבדת QA לתיקון ←";
        ctaHandler = () => switchWorkspaceView("view-qa");
      } else if (hasPrompt) {
        ctaLabel = "צפה בפרומפט ←";
        ctaHandler = () => switchTab("promptTab");
      } else if (session.raw_blueprint) {
        ctaLabel = "צפה ב-XML Blueprint ←";
        ctaHandler = () => switchTab("blueprintTab");
      }
      if (ctaLabel && ctaHandler) {
        const actionRow = document.createElement("div");
        actionRow.className = "bubble-action-row";
        const ctaBtn = document.createElement("button");
        ctaBtn.type = "button";
        ctaBtn.className = "btn btn-secondary btn-sm bubble-action-cta";
        ctaBtn.textContent = ctaLabel;
        ctaBtn.addEventListener("click", ctaHandler);
        actionRow.appendChild(ctaBtn);
        bubble.appendChild(actionRow);
      }
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

function getActiveArtifactContent(session) {
  if (!session) return "";
  const resolvedFile = resolveActiveArtifactFile(session);
  const refFiles = session.reference_files || session.state?.reference_files || {};
  if (resolvedFile !== "__primary__" && refFiles[resolvedFile] !== undefined) {
    return refFiles[resolvedFile];
  }
  return getBestPrompt(session);
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

function renderGroupedSuiteFileTree(container, session, targetType, refFiles, hasPrimaryText) {
  const refKeys = Object.keys(refFiles);
  const skillGroups = new Map();
  const rootExtraKeys = [];

  refKeys.forEach((relPath) => {
    const match = relPath.match(/^skills\/([^/]+)\/(.+)$/);
    if (match) {
      const subSlug = match[1];
      if (!skillGroups.has(subSlug)) skillGroups.set(subSlug, []);
      skillGroups.get(subSlug).push(relPath);
    } else {
      rootExtraKeys.push(relPath);
    }
  });

  container.classList.add("is-grouped-tree");
  container.innerHTML = "";

  const header = document.createElement("div");
  header.className = "suite-tree-header";
  header.innerHTML = `<span>SKILL_SUITE TREE · ${skillGroups.size} skills · ${refKeys.length} files</span><span>Pick &amp; Mix Ready</span>`;
  container.appendChild(header);

  const showPrimaryPill = hasPrimaryText && (targetType !== "SKILL_SUITE" || getBestPrompt(session).trim().length >= 80);
  if (showPrimaryPill || rootExtraKeys.length > 0) {
    const rootRow = document.createElement("div");
    rootRow.className = "suite-root-files";
    if (showPrimaryPill) {
      const primaryBtn = document.createElement("button");
      primaryBtn.type = "button";
      primaryBtn.className = `file-tab-btn ${activeArtifactFile === "__primary__" ? "active" : ""}`;
      primaryBtn.textContent = targetType === "HYBRID_BUNDLE" ? "Primary Bundle" : "Overview";
      primaryBtn.addEventListener("click", () => {
        activeArtifactFile = "__primary__";
        renderPromptTab(currentSession);
      });
      rootRow.appendChild(primaryBtn);
    }
    rootExtraKeys.forEach((relPath) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `file-tab-btn ${activeArtifactFile === relPath ? "active" : ""}`;
      btn.textContent = relPath;
      btn.addEventListener("click", () => {
        activeArtifactFile = relPath;
        renderPromptTab(currentSession);
      });
      rootRow.appendChild(btn);
    });
    container.appendChild(rootRow);
  }

  skillGroups.forEach((groupFiles, subSlug) => {
    const sorted = groupFiles.slice().sort((a, b) => {
      const aIsRoot = a.endsWith("/SKILL.md");
      const bIsRoot = b.endsWith("/SKILL.md");
      if (aIsRoot !== bIsRoot) return aIsRoot ? -1 : 1;
      return a.localeCompare(b);
    });

    const details = document.createElement("details");
    details.className = "suite-folder-group";
    const containsActive = sorted.includes(activeArtifactFile);
    details.open = containsActive || !collapsedSuiteFolders.has(subSlug);
    details.addEventListener("toggle", () => {
      if (details.open) collapsedSuiteFolders.delete(subSlug);
      else collapsedSuiteFolders.add(subSlug);
    });

    const summary = document.createElement("summary");
    summary.className = "suite-folder-summary";
    summary.innerHTML = `
      <span class="suite-folder-summary-left">
        <span class="suite-folder-chevron">${ICONS.chevronDown}</span>
        <span class="suite-folder-icon">${ICONS.folder}</span>
        <span>skills/${escapeHtml(subSlug)}/</span>
      </span>
      <span class="suite-folder-count">${sorted.length}</span>
    `;
    details.appendChild(summary);

    const childrenWrap = document.createElement("div");
    childrenWrap.className = "suite-folder-children";
    sorted.forEach((relPath) => {
      const subPath = relPath.slice(`skills/${subSlug}/`.length);
      const isMainSkill = subPath === "SKILL.md";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `suite-file-item ${isMainSkill ? "" : "is-ref-child"} ${activeArtifactFile === relPath ? "active" : ""}`;
      const roleLabel = isMainSkill ? "SKILL" : subPath.startsWith("references/") ? "REF" : "FILE";
      btn.innerHTML = `<span>${escapeHtml(subPath)}</span><span class="suite-file-role-tag">${roleLabel}</span>`;
      btn.addEventListener("click", () => {
        activeArtifactFile = relPath;
        renderPromptTab(currentSession);
      });
      childrenWrap.appendChild(btn);
    });
    details.appendChild(childrenWrap);
    container.appendChild(details);
  });
}

function renderPromptTab(session) {
  const promptText = getBestPrompt(session);
  const state = session.state || {};
  const targetType = session.target_type || state.target_type || "SYSTEM_PROMPT";
  const slugName = session.slug_name || state.slug_name || "";
  const refFiles = session.reference_files || state.reference_files || {};
  const refKeys = Object.keys(refFiles);
  const hasPrimaryText = Boolean(promptText.trim());
  const hasAnyArtifact = hasPrimaryText || refKeys.length > 0;
  if (els.artifactUpgraderForm) {
    els.artifactUpgraderForm.classList.toggle("hidden", !hasAnyArtifact);
  }
  const activeNode = activeStreamingNode || session.active_node;
  const isPromptCompiling =
    activeNode === "node_2_construct" ||
    activeNode === "node_3_upgrader" ||
    activeNode === "node_4_adjudicator" ||
    session.status === "compiling";

  if (els.artifactTargetTypeBadge) {
    els.artifactTargetTypeBadge.className = getTargetBadgeClass(targetType);
    els.artifactTargetTypeBadge.textContent = targetType;
    els.artifactTargetTypeBadge.classList.toggle("hidden", !hasAnyArtifact && !slugName);
  }
  if (els.artifactSlugBadge) {
    const codeEl = els.artifactSlugBadge.querySelector("code");
    if (codeEl) codeEl.textContent = slugName;
    els.artifactSlugBadge.classList.toggle("hidden", !slugName);
  }

  if (!hasAnyArtifact) {
    els.promptEmptyState.classList.remove("hidden");
    els.promptDisplayContainer.classList.add("hidden");
    els.copyPromptBtn.disabled = true;
    els.downloadPromptBtn.disabled = true;
    if (els.downloadZipBtn) els.downloadZipBtn.disabled = true;
    if (els.artifactFileSwitcher) {
      els.artifactFileSwitcher.classList.add("hidden");
      els.artifactFileSwitcher.classList.remove("is-grouped-tree");
    }
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
        activeStreamingDesc || "בונה ומהדר את התוצר מתוך תוכנית האב..."
      );
    } else {
      els.promptStatusPill.textContent = "ריק";
      els.promptVersionTag.textContent = "ממתין להידור";
      els.promptVersionTag.className = "badge badge-neutral";
      els.promptEmptyState.innerHTML = `
        <div class="empty-illustration">${ICONS.layersLg}</div>
        <h3>תוצר המערכת יופיע כאן</h3>
        <p>לאחר סיום הראיון הקצר עם <code class="tech-token" dir="ltr">The Helper</code>, המהדר (<code class="tech-token" dir="ltr">The Construct</code>) יבנה כאן את ה-<code class="tech-token" dir="ltr">Skill / System Prompt</code> ויעביר אותו בדיקות <code class="tech-token" dir="ltr">QA</code> אוטומטיות.</p>
      `;
    }
    return;
  }

  els.promptEmptyState.classList.add("hidden");
  els.promptDisplayContainer.classList.remove("hidden");
  els.copyPromptBtn.disabled = false;
  els.downloadPromptBtn.disabled = false;
  if (els.downloadZipBtn) els.downloadZipBtn.disabled = false;

  resolveActiveArtifactFile(session);

  if (els.artifactFileSwitcher) {
    if (refKeys.length > 0) {
      els.artifactFileSwitcher.classList.remove("hidden");
      const hasNestedSkills = refKeys.some((k) => /^skills\/[^/]+\/.+/.test(k));
      if (hasNestedSkills) {
        renderGroupedSuiteFileTree(els.artifactFileSwitcher, session, targetType, refFiles, hasPrimaryText);
      } else {
        els.artifactFileSwitcher.classList.remove("is-grouped-tree");
        const primaryLabel =
          targetType === "SKILL_PACKAGE"
            ? "SKILL.md"
            : targetType === "HYBRID_BUNDLE"
            ? "Primary Bundle"
            : "SYSTEM_PROMPT.md";
        els.artifactFileSwitcher.innerHTML = "";

        if (hasPrimaryText || targetType !== "SKILL_SUITE") {
          const primaryBtn = document.createElement("button");
          primaryBtn.type = "button";
          primaryBtn.className = `file-tab-btn ${activeArtifactFile === "__primary__" ? "active" : ""}`;
          primaryBtn.textContent = primaryLabel;
          primaryBtn.addEventListener("click", () => {
            activeArtifactFile = "__primary__";
            renderPromptTab(currentSession);
          });
          els.artifactFileSwitcher.appendChild(primaryBtn);
        }

        refKeys.forEach((relPath) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `file-tab-btn ${activeArtifactFile === relPath ? "active" : ""}`;
          btn.textContent = relPath;
          btn.addEventListener("click", () => {
            activeArtifactFile = relPath;
            renderPromptTab(currentSession);
          });
          els.artifactFileSwitcher.appendChild(btn);
        });
      }
    } else {
      els.artifactFileSwitcher.classList.add("hidden");
      els.artifactFileSwitcher.classList.remove("is-grouped-tree");
    }
  }

  const displayedContent = getActiveArtifactContent(session);
  const chars = displayedContent.length;
  els.promptStatsText.textContent = `${chars.toLocaleString()} תווים · ~${Math.ceil(chars / 4).toLocaleString()} טוקנים`;

  if (session.status === "passed") {
    els.promptStatusPill.textContent = "מאושר";
    els.promptVersionTag.innerHTML = `${ICONS.check} <span>Champion (Approved)</span>`;
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

  els.promptFormattedView.innerHTML = renderStructuredMarkdown(displayedContent);
  els.promptRawView.textContent =
    activeArtifactFile === "__primary__"
      ? state.champion_prompt || state.challenger_prompt || displayedContent
      : displayedContent;
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
        <h3>תוכנית האב (<code class="tech-token" dir="ltr">&lt;ARTIFACT_BLUEPRINT&gt;</code>) טרם הופקה</h3>
        <p>השלם את שאלות המיקוד בראיון עם <code class="tech-token" dir="ltr">The Helper</code> כדי לחלץ את הגדרות היעד, הטריגרים וחוזה הפלט.</p>
      `;
    }
    return;
  }

  els.blueprintEmptyState.classList.add("hidden");
  els.blueprintContainer.classList.remove("hidden");
  els.copyXmlBtn.disabled = false;
  els.bpVersionText.textContent = `V${parsed.version || "2.0"}`;

  const isV2 = Boolean(
    parsed.target_type || parsed.role_title || parsed.description_and_triggers || parsed.core_workflow
  );

  const buildBpCard = (def) => {
    const card = document.createElement("div");
    card.className = `bp-card ${def.full ? "full-width" : ""}`;
    card.innerHTML = `
      <div class="bp-card-label">${def.icon} <span>${escapeHtml(def.label)}</span></div>
      <div class="bp-card-value" dir="auto">${renderStructuredMarkdown(parsed[def.key])}</div>
    `;
    return card;
  };

  els.bpCardsGrid.innerHTML = "";
  if (isV2) {
    const v2Clusters = [
      {
        title: "1. Identity & Epistemic Stance",
        defs: [
          { key: "target_type", icon: ICONS.layers, label: "Target Type (סוג תוצר)", full: false },
          { key: "slug_name", icon: ICONS.cpu, label: "Slug Name (מזהה חבילה)", full: false },
          { key: "role_title", icon: ICONS.target, label: "Role Title (פרסונה ותפקיד)", full: false },
          { key: "tone_and_language", icon: ICONS.mic, label: "Tone & Language (טון ושפה)", full: false },
          { key: "epistemic_stance", icon: ICONS.sliders, label: "Epistemic Stance (עמדה אפיסטמית)", full: true },
        ],
      },
      {
        title: "2. Routing & Clarification",
        defs: [
          { key: "description_and_triggers", icon: ICONS.zap, label: "Description & Triggers (טריגרי הפעלה)", full: true },
          { key: "negative_triggers", icon: ICONS.ban, label: "Negative Triggers (מתי לא להפעיל)", full: true },
          { key: "suite_topology", icon: ICONS.layers, label: "Suite Topology (מפת הסקילים בחבילה)", full: true },
          { key: "clarification_gate", icon: ICONS.shield, label: "Clarification Gate (שער הבהרות)", full: true },
        ],
      },
      {
        title: "3. Execution & Verification",
        defs: [
          { key: "core_workflow", icon: ICONS.workflow, label: "Core Workflow (תהליך ביצוע)", full: true },
          { key: "progressive_disclosure_refs", icon: ICONS.layers, label: "Progressive Disclosure Refs (קבצי עזר)", full: false },
          { key: "verification_rubric", icon: ICONS.check, label: "Verification Rubric (אימות פנימי)", full: false },
          { key: "format_spec", icon: ICONS.fileText, label: "Format Spec (מפרט פלט)", full: true },
          { key: "guardrails", icon: ICONS.alert, label: "Guardrails (שומרי סף)", full: true },
        ],
      },
    ];

    const clusteredKeys = new Set(["version"]);
    v2Clusters.forEach((cluster) => {
      const visibleDefs = cluster.defs.filter((def) => {
        clusteredKeys.add(def.key);
        return Boolean(parsed[def.key]);
      });
      if (visibleDefs.length === 0) return;

      const section = document.createElement("div");
      section.className = "bp-cluster-section";
      section.innerHTML = `
        <div class="bp-cluster-header">
          <span class="bp-cluster-title" dir="ltr">${escapeHtml(cluster.title)}</span>
        </div>
      `;
      const grid = document.createElement("div");
      grid.className = "bp-cluster-grid";
      visibleDefs.forEach((def) => grid.appendChild(buildBpCard(def)));
      section.appendChild(grid);
      els.bpCardsGrid.appendChild(section);
    });

    // Fallback for any non-empty legacy/custom fields outside the 3 V2 clusters
    Object.keys(parsed).forEach((key) => {
      if (clusteredKeys.has(key) || !parsed[key]) return;
      els.bpCardsGrid.appendChild(
        buildBpCard({ key, icon: ICONS.fileText, label: key, full: true })
      );
    });
  } else {
    const v1Defs = [
      { key: "title", icon: ICONS.target, label: "Title (פרסונה ותפקיד)", full: false },
      { key: "tone", icon: ICONS.mic, label: "Tone (סגנון דיבור)", full: false },
      { key: "domain_expertise", icon: ICONS.cpu, label: "Domain Expertise (תחומי מומחיות)", full: false },
      { key: "cognitive_modules", icon: ICONS.sliders, label: "Cognitive Modules (מודולים קוגניטיביים)", full: false },
      { key: "workflow", icon: ICONS.workflow, label: "Workflow (תהליך עבודה מובנה)", full: true },
      { key: "negative_constraints", icon: ICONS.ban, label: "Negative Constraints (איסורים ומגבלות)", full: true },
      { key: "output_format", icon: ICONS.fileText, label: "Output Format (תבנית פלט)", full: true },
    ];
    v1Defs.forEach((def) => {
      if (!parsed[def.key]) return;
      els.bpCardsGrid.appendChild(buildBpCard(def));
    });
  }

  els.xmlRawViewer.textContent = rawXml;
}

function renderDecisionRubricCard(session) {
  if (!els.decisionRubricCard) return;
  const scores = session.rubric_scores || session.state?.rubric_scores || {};
  if (!scores.used_decision_model) {
    els.decisionRubricCard.classList.add("hidden");
    return;
  }

  const dims = [
    { key: "intent_alignment", label: "Intent Alignment" },
    { key: "token_density_no_bloat", label: "Token Density" },
    { key: "trigger_precision", label: "Trigger Precision" },
    { key: "progressive_disclosure", label: "Progressive Disclosure" },
    { key: "actionable_clarity", label: "Actionable Clarity" },
    { key: "output_contract_strength", label: "Output Contract" },
  ];
  if (
    scores.trigger_deconfliction !== undefined &&
    scores.trigger_deconfliction !== null
  ) {
    dims.push({
      key: "trigger_deconfliction",
      label: "Trigger De-confliction",
      isSuiteDim: true,
    });
  }

  const avgPct = Math.round(Number(scores.weighted_average || 0) * 100);
  const avgClass = avgPct >= 88 ? "badge-success" : avgPct >= 70 ? "badge-warning" : "badge-neutral";
  const beats = Number(scores.challenger_beats_champion ?? 1);
  const beatsBadge =
    (session.state?.iteration_count || 0) > 1
      ? `<span class="badge ${beats >= 0.5 ? "badge-success" : "badge-warning"}">${
          beats >= 0.5 ? "Challenger > Champion" : "No Improvement"
        }</span>`
      : "";

  const barsHtml = dims
    .map((d) => {
      const val = Number(scores[d.key] || 0);
      const pct = Math.max(0, Math.min(100, Math.round((val / 5.0) * 100)));
      const fillCls = val >= 4.0 ? "high" : val >= 3.0 ? "warn" : "low";
      const rowCls = d.isSuiteDim ? "rubric-dim-row suite-dim-row" : "rubric-dim-row";
      const suiteTag = d.isSuiteDim ? `<span class="rubric-suite-tag">SKILL_SUITE</span>` : "";
      return `
        <div class="${rowCls}" dir="ltr">
          <div class="rubric-dim-top">
            <span class="rubric-dim-name">${escapeHtml(d.label)}${suiteTag}</span>
            <span class="rubric-dim-score">${val.toFixed(1)} / 5</span>
          </div>
          <div class="rubric-progress-track">
            <div class="rubric-progress-fill ${fillCls}" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
    })
    .join("");

  els.decisionRubricCard.classList.remove("hidden");
  els.decisionRubricCard.innerHTML = `
    <div class="rubric-card-header">
      <div class="rubric-card-title">
        ${ICONS.shield}
        <span>ניקוד רובריקה כמותי (<code class="tech-token" dir="ltr">gemini-decision-1</code>)</span>
      </div>
      <div class="rubric-summary-badges">
        ${beatsBadge}
        <span class="badge ${avgClass} mono-text">ציון משוקלל: ${avgPct}%</span>
      </div>
    </div>
    <div class="rubric-bars-grid">${barsHtml}</div>
  `;
}

function renderQATab(session) {
  const state = session.state || {};
  const logs = state.error_log || [];
  els.qaCountPill.textContent = String(logs.length);
  if (els.qaUpgraderForm) {
    const canUpgradeFromQa = session.status === "escalated" || (state.iteration_count || 0) > 0;
    els.qaUpgraderForm.classList.toggle("hidden", !canUpgradeFromQa);
  }
  renderDecisionRubricCard(session);

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
    item.dir = "auto";
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
  const champ = championText || "";
  const chall = challengerText || "";
  const isSame = Boolean(champ && chall && champ.trim() === chall.trim());
  const isMissingOne = !champ || !chall;

  if (isSame || isMissingOne) {
    if (els.diffZeroChangesBanner) {
      els.diffZeroChangesBanner.textContent = isSame
        ? "0 הבדלים — גרסת ה-Challenger אושרה והפכה ל-Champion הנוכחי"
        : "קיימת גרסה יחידה בלבד — עבור לתצוגת Side-by-Side או בצע שדרוג נוסף להשוואה";
      els.diffZeroChangesBanner.classList.remove("hidden");
    }
    if (els.diffStatsBadge) {
      els.diffStatsBadge.innerHTML = `<span class="diff-add-count">+0</span><span>/</span><span class="diff-del-count">-0</span>`;
      els.diffStatsBadge.classList.remove("hidden");
    }
    els.diffUnifiedPre.classList.add("hidden");
    els.diffUnifiedPre.innerHTML = "";
    return;
  }

  if (els.diffZeroChangesBanner) els.diffZeroChangesBanner.classList.add("hidden");
  els.diffUnifiedPre.classList.remove("hidden");

  const ops = computeLineDiff(champ, chall);
  let oldLn = 1;
  let newLn = 1;
  let addCount = 0;
  let delCount = 0;

  els.diffUnifiedPre.innerHTML = ops
    .map((op) => {
      if (op.type === "add") {
        addCount++;
        const lnLabel = String(newLn++);
        return `<span class="diff-line diff-add"><span class="diff-ln">${lnLabel}</span><span class="diff-code">+ ${escapeHtml(op.text)}</span></span>`;
      }
      if (op.type === "del") {
        delCount++;
        const lnLabel = String(oldLn++);
        return `<span class="diff-line diff-del"><span class="diff-ln">${lnLabel}</span><span class="diff-code">- ${escapeHtml(op.text)}</span></span>`;
      }
      const lnLabel = String(newLn++);
      oldLn++;
      return `<span class="diff-line diff-ctx"><span class="diff-ln">${lnLabel}</span><span class="diff-code">  ${escapeHtml(op.text)}</span></span>`;
    })
    .join("");

  if (els.diffStatsBadge) {
    els.diffStatsBadge.innerHTML = `<span class="diff-add-count">+${addCount}</span><span>/</span><span class="diff-del-count">-${delCount}</span>`;
    els.diffStatsBadge.classList.remove("hidden");
  }
}

function renderTimelineTab(timeline) {
  if (els.timelineCountPill) {
    els.timelineCountPill.textContent = String((timeline || []).length);
  }

  els.timelineList.innerHTML = "";
  const reversed = (timeline || []).slice().reverse();
  const filtered = timelineFilterQuery
    ? reversed.filter((item) => {
        const hay = `${item.title || ""} ${item.detail || ""} ${item.timestamp || ""} ${item.model || ""}`.toLowerCase();
        return hay.includes(timelineFilterQuery);
      })
    : reversed;

  if (filtered.length === 0) {
    els.timelineList.innerHTML = `
      <div class="empty-state" style="min-height:140px;padding:16px;gap:10px;">
        <p>${
          timelineFilterQuery
            ? `לא נמצאו אירועים עבור "${escapeHtml(timelineFilterQuery)}".`
            : "טרם נרשמו אירועים ביומן הסשן."
        }</p>
        ${
          timelineFilterQuery
            ? `<button type="button" class="btn btn-secondary btn-sm timeline-clear-filter-btn">נקה סינון וחיפוש</button>`
            : ""
        }
      </div>
    `;
    const clearTimelineBtn = els.timelineList.querySelector(".timeline-clear-filter-btn");
    if (clearTimelineBtn) {
      clearTimelineBtn.addEventListener("click", () => {
        timelineFilterQuery = "";
        if (els.timelineSearchInput) els.timelineSearchInput.value = "";
        renderTimelineTab(timeline);
      });
    }
    return;
  }

  filtered.forEach((item) => {
    const row = document.createElement("div");
    row.className = "timeline-item";
    const modelBadge = item.model
      ? `<span class="tl-model-badge ${item.fallback_used ? "is-fallback" : ""}" dir="ltr">${escapeHtml(
          formatModelBadgeText(item)
        )}</span>`
      : "";
    row.innerHTML = `
      <div class="tl-time">${escapeHtml(item.timestamp || "")}</div>
      <div class="tl-body">
        <div class="tl-title">${formatSimpleMarkdown(item.title || "")}${modelBadge}</div>
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
    out = out.replace(reg, '<bdi dir="ltr" class="bidi-term">$1</bdi>');
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
      out.push(`<h3 dir="auto">${formatSimpleMarkdown(trimmed.replace(/^###\s+/, ""))}</h3>`);
    } else if (/^##\s+/.test(trimmed)) {
      closeList();
      out.push(`<h2 dir="auto">${formatSimpleMarkdown(trimmed.replace(/^##\s+/, ""))}</h2>`);
    } else if (/^#\s+/.test(trimmed)) {
      closeList();
      out.push(`<h1 dir="auto">${formatSimpleMarkdown(trimmed.replace(/^#\s+/, ""))}</h1>`);
    } else if (/^[-*]\s+/.test(trimmed)) {
      if (!inList || listTag !== "ul") {
        closeList();
        listTag = "ul";
        out.push('<ul dir="auto">');
        inList = true;
      }
      out.push(`<li dir="auto">${formatSimpleMarkdown(trimmed.replace(/^[-*]\s+/, ""))}</li>`);
    } else if (/^\d+\.\s+/.test(trimmed)) {
      if (!inList || listTag !== "ol") {
        closeList();
        listTag = "ol";
        out.push('<ol dir="auto">');
        inList = true;
      }
      out.push(`<li dir="auto">${formatSimpleMarkdown(trimmed.replace(/^\d+\.\s+/, ""))}</li>`);
    } else {
      closeList();
      if (trimmed) {
        out.push(`<p dir="auto">${formatSimpleMarkdown(rawLine)}</p>`);
      }
    }
  }

  closeList();
  if (inCodeBlock) {
    out.push(`<pre dir="ltr"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  return out.join("");
}

function autoResizeTextarea(el, minHeight = 56, maxHeight = 180) {
  if (!el) return;
  el.style.height = "auto";
  const nextHeight = Math.max(minHeight, Math.min(el.scrollHeight, maxHeight));
  el.style.height = `${nextHeight}px`;
}

function resetTextareaHeight(el, minHeight = 56) {
  if (!el) return;
  el.style.height = `${minHeight}px`;
}

let toastTimer = null;
let toastDuration = 3400;
let toastHoverBound = false;

function scheduleToastHide(delayMs) {
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (els.toast) {
      els.toast.classList.add("hidden");
      els.toast.classList.remove("toast-error");
    }
  }, delayMs);
}

function showToast(msg, iconKey = "check") {
  if (!els.toast) return;
  if (!toastHoverBound) {
    toastHoverBound = true;
    els.toast.addEventListener("mouseenter", () => {
      if (toastTimer) {
        clearTimeout(toastTimer);
        toastTimer = null;
      }
    });
    els.toast.addEventListener("mouseleave", () => {
      if (!els.toast.classList.contains("hidden")) {
        scheduleToastHide(2000);
      }
    });
  }
  const iconSvg = ICONS[iconKey] || ICONS.check;
  const isError = iconKey === "alert";
  toastDuration = isError ? 6000 : 3400;
  els.toast.classList.toggle("toast-error", isError);
  els.toast.innerHTML = `${iconSvg} <span>${escapeHtml(msg)}</span>`;
  els.toast.classList.remove("hidden");
  scheduleToastHide(toastDuration);
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

async function refreshBettyHistory() {
  try {
    const res = await apiFetch("/api/betty/history");
    if (res.ok) {
      const data = await res.json();
      bettyHistories.tech_support = data.tech_support || [];
      bettyHistories.prompt_advisor = data.prompt_advisor || [];
      renderBettyModeUI();
    }
  } catch (err) {
    console.warn("Could not load Betty history:", err);
  }
}

const BETTY_DOCKED_WIDTH_KEY = "betterbot_betty_docked_width";

function getDockedBettyWidthBounds() {
  const minW = 320;
  const vw = window.innerWidth || 1280;
  const navEl = document.querySelector(".studio-nav-rail");
  const navRectW = vw > 1100 && navEl && navEl.getBoundingClientRect ? navEl.getBoundingClientRect().width : 0;
  const navW = vw > 1100 ? (navRectW > 0 ? navRectW : 248) : 0;
  const maxW = Math.max(
    minW,
    Math.min(640, Math.floor(vw * 0.48), vw - navW - 420)
  );
  return { minW, maxW };
}

function clampDockedBettyWidth(desiredWidth, win = document.getElementById("bettyWindow")) {
  const { minW, maxW } = getDockedBettyWidthBounds();
  const numeric = Number(desiredWidth);
  const base = Number.isFinite(numeric) && numeric > 0 ? numeric : 380;
  const clamped = Math.round(Math.max(minW, Math.min(maxW, base)));
  if (win && win.style) {
    if (typeof win.style.setProperty === "function") {
      win.style.setProperty("--betty-docked-width", `${clamped}px`);
    } else {
      win.style["--betty-docked-width"] = `${clamped}px`;
    }
  }
  return clamped;
}

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

  let wasDockedBeforeMaximize = win.classList.contains("docked");
  let lastFloatingRect = { left: 24, top: 72, width: 420, height: 560 };

  clampDockedBettyWidth(localStorage.getItem(BETTY_DOCKED_WIDTH_KEY), win);

  function saveCurrentFloatingRect() {
    if (
      win.classList.contains("docked") ||
      win.classList.contains("maximized") ||
      win.classList.contains("hidden")
    ) {
      return;
    }
    const rect = win.getBoundingClientRect ? win.getBoundingClientRect() : {};
    if (rect.width > 0 && rect.height > 0) {
      lastFloatingRect = {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    }
  }

  function applyFloatingRect(rect = lastFloatingRect) {
    win.style.left = `${rect.left}px`;
    win.style.top = `${rect.top}px`;
    win.style.width = `${rect.width}px`;
    win.style.height = `${rect.height}px`;
    win.style.bottom = "auto";
    win.style.right = "auto";
  }

  function clearFloatingInlineStyles() {
    win.style.left = "";
    win.style.top = "";
    win.style.width = "";
    win.style.height = "";
    win.style.bottom = "";
    win.style.right = "";
  }

  await refreshBettyHistory();

  // Header Toggle Button opens/closes Betty Push Side-Panel
  fab.addEventListener("click", () => {
    const isNowHidden = win.classList.toggle("hidden");
    fab.classList.toggle("active", !isNowHidden);
    fab.setAttribute("aria-expanded", !isNowHidden ? "true" : "false");
    if (!isNowHidden) {
      if (win.classList.contains("docked")) {
        clampDockedBettyWidth(localStorage.getItem(BETTY_DOCKED_WIDTH_KEY), win);
      } else if (!win.classList.contains("maximized")) {
        clampFloatingBettyToViewport(win);
      }
      renderBettyMessages();
      input.focus();
    }
  });

  closeBtn.addEventListener("click", () => {
    win.classList.add("hidden");
    fab.classList.remove("active");
    fab.setAttribute("aria-expanded", "false");
    fab.focus();
  });

  // Dock / Float Toggle Button (preserves previous floating or docked geometry)
  if (dockBtn) {
    dockBtn.addEventListener("click", () => {
      if (!win.classList.contains("docked") && !win.classList.contains("maximized")) {
        saveCurrentFloatingRect();
      }
      const isNowDocked = !win.classList.contains("docked");
      win.classList.remove("maximized");
      if (maxBtn) maxBtn.classList.remove("active");
      win.classList.toggle("docked", isNowDocked);
      dockBtn.classList.toggle("active", isNowDocked);
      wasDockedBeforeMaximize = isNowDocked;
      if (isNowDocked) {
        clearFloatingInlineStyles();
        clampDockedBettyWidth(localStorage.getItem(BETTY_DOCKED_WIDTH_KEY), win);
      } else {
        applyFloatingRect(lastFloatingRect);
        clampFloatingBettyToViewport(win);
      }
    });
  }

  function toggleMaximizeBetty() {
    const isEnteringMax = !win.classList.contains("maximized");
    if (isEnteringMax) {
      wasDockedBeforeMaximize = win.classList.contains("docked");
      if (!wasDockedBeforeMaximize) {
        saveCurrentFloatingRect();
      } else {
        clearFloatingInlineStyles();
      }
      win.classList.remove("docked");
      if (dockBtn) dockBtn.classList.remove("active");
      win.classList.add("maximized");
      if (maxBtn) maxBtn.classList.add("active");
      return;
    }

    win.classList.remove("maximized");
    if (maxBtn) maxBtn.classList.remove("active");
    if (wasDockedBeforeMaximize) {
      win.classList.add("docked");
      if (dockBtn) dockBtn.classList.add("active");
      clearFloatingInlineStyles();
      clampDockedBettyWidth(localStorage.getItem(BETTY_DOCKED_WIDTH_KEY), win);
    } else {
      win.classList.remove("docked");
      if (dockBtn) dockBtn.classList.remove("active");
      applyFloatingRect(lastFloatingRect);
      clampFloatingBettyToViewport(win);
    }
  }

  if (maxBtn) {
    maxBtn.addEventListener("click", toggleMaximizeBetty);
  }

  // Double-clicking header toggles maximize when floating
  dragHeader.addEventListener("dblclick", (e) => {
    if (e.target.closest("button") || win.classList.contains("docked")) return;
    toggleMaximizeBetty();
  });

  const resetBettyClearConfirm = () => {
    if (bettyClearConfirmTimer) {
      clearTimeout(bettyClearConfirmTimer);
      bettyClearConfirmTimer = null;
    }
    if (clearBtn) {
      clearBtn.classList.remove("is-confirming");
      clearBtn.title = "נקה שיחה במצב הנוכחי";
    }
    if (els.bettyClearBtnLabel) {
      els.bettyClearBtnLabel.classList.add("hidden");
    }
  };

  // Clear history for current mode (2-step confirmation guard)
  clearBtn.addEventListener("click", async () => {
    if (isBettyLoading) return;
    if (!clearBtn.classList.contains("is-confirming")) {
      clearBtn.classList.add("is-confirming");
      clearBtn.title = "לחץ שוב לאישור ניקוי השיחה";
      if (els.bettyClearBtnLabel) {
        els.bettyClearBtnLabel.classList.remove("hidden");
      }
      if (bettyClearConfirmTimer) clearTimeout(bettyClearConfirmTimer);
      bettyClearConfirmTimer = setTimeout(resetBettyClearConfirm, 3500);
      return;
    }

    resetBettyClearConfirm();
    try {
      const res = await apiFetch("/api/betty/clear", {
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
      resetBettyClearConfirm();
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

  input.addEventListener("input", () => autoResizeTextarea(input));

  // Setup Dragging & Resizing (floating 8-way + docked divider resize)
  setupBettyDragAndResize(win, dragHeader, {
    onFloatingRectChange: (rect) => {
      lastFloatingRect = rect;
    },
  });
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
      autoResizeTextarea(input);
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
  resetTextareaHeight(input);
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
    const res = await apiFetch("/api/betty/chat", {
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

function clampFloatingBettyToViewport(win = document.getElementById("bettyWindow")) {
  if (
    !win ||
    win.classList.contains("docked") ||
    win.classList.contains("maximized") ||
    win.classList.contains("hidden")
  ) {
    return null;
  }
  const rect = win.getBoundingClientRect ? win.getBoundingClientRect() : null;
  if (!rect || !rect.width || !rect.height) return null;
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 800;
  const maxW = Math.max(340, vw - 16);
  const maxH = Math.max(360, vh - 16);
  const clampedW = Math.round(Math.min(rect.width, maxW));
  const clampedH = Math.round(Math.min(rect.height, maxH));
  const maxLeft = Math.max(8, vw - clampedW - 8);
  const maxTop = Math.max(8, vh - clampedH - 8);
  const clampedLeft = Math.round(Math.max(8, Math.min(maxLeft, rect.left)));
  const clampedTop = Math.round(Math.max(8, Math.min(maxTop, rect.top)));

  win.style.width = `${clampedW}px`;
  win.style.height = `${clampedH}px`;
  win.style.left = `${clampedLeft}px`;
  win.style.top = `${clampedTop}px`;
  win.style.bottom = "auto";
  win.style.right = "auto";

  return {
    left: clampedLeft,
    top: clampedTop,
    width: clampedW,
    height: clampedH,
  };
}

function setupBettyDragAndResize(win, header, callbacks = {}) {
  let isDragging = false;
  let isResizing = false;
  let isDockedResizing = false;
  let resizeDir = "";
  let activePointerId = null;
  let activeCaptureEl = null;
  let startX = 0,
    startY = 0,
    startLeft = 0,
    startTop = 0,
    startW = 0,
    startH = 0;

  function capturePointer(el, pointerId) {
    activeCaptureEl = el;
    activePointerId = pointerId;
    if (el && typeof el.setPointerCapture === "function" && pointerId !== undefined) {
      try {
        el.setPointerCapture(pointerId);
      } catch {
        // Ignore if element cannot capture pointer in synthetic environments
      }
    }
  }

  function releaseCapturedPointer() {
    if (
      activeCaptureEl &&
      typeof activeCaptureEl.releasePointerCapture === "function" &&
      activePointerId !== null
    ) {
      try {
        activeCaptureEl.releasePointerCapture(activePointerId);
      } catch {
        // Ignore if pointer already released
      }
    }
    activeCaptureEl = null;
    activePointerId = null;
  }

  function ensureAbsolutePosition() {
    const rect = win.getBoundingClientRect ? win.getBoundingClientRect() : null;
    if (!rect) return;
    win.style.left = `${rect.left}px`;
    win.style.top = `${rect.top}px`;
    win.style.width = `${rect.width}px`;
    win.style.height = `${rect.height}px`;
    win.style.bottom = "auto";
    win.style.right = "auto";
  }

  header.addEventListener("pointerdown", (e) => {
    if (
      e.button !== 0 ||
      e.target.closest("button") ||
      win.classList.contains("maximized") ||
      win.classList.contains("docked")
    ) {
      return;
    }
    ensureAbsolutePosition();
    isDragging = true;
    win.classList.add("is-dragging");
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseFloat(win.style.left) || 0;
    startTop = parseFloat(win.style.top) || 0;
    document.body.style.userSelect = "none";
    capturePointer(header, e.pointerId);
  });

  // 8-Direction Floating Resizing & Docked Edge-Rail Horizontal Resizing
  win.querySelectorAll(".betty-resize-handle").forEach((handle) => {
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || win.classList.contains("maximized")) return;
      const dir = handle.dataset.resize || "se";

      if (win.classList.contains("docked")) {
        if (dir !== "e" || (window.innerWidth || 1280) <= 1100) return;
        e.stopPropagation();
        e.preventDefault();
        isDockedResizing = true;
        resizeDir = "e";
        startX = e.clientX;
        const rect = win.getBoundingClientRect ? win.getBoundingClientRect() : null;
        startW =
          rect && rect.width > 0
            ? rect.width
            : clampDockedBettyWidth(localStorage.getItem(BETTY_DOCKED_WIDTH_KEY), win);
        win.classList.add("is-resizing");
        document.body.style.userSelect = "none";
        capturePointer(handle, e.pointerId);
        return;
      }

      e.stopPropagation();
      e.preventDefault();
      ensureAbsolutePosition();
      isResizing = true;
      resizeDir = dir;
      startX = e.clientX;
      startY = e.clientY;
      const rect = win.getBoundingClientRect();
      startW = rect.width;
      startH = rect.height;
      startLeft = rect.left;
      startTop = rect.top;
      win.classList.add("is-resizing");
      document.body.style.userSelect = "none";
      capturePointer(handle, e.pointerId);
    });
  });

  window.addEventListener("pointermove", (e) => {
    if (isDockedResizing) {
      // Betty is docked on the left edge in RTL; rightward mouse movement (+dx) widens the panel.
      const dx = e.clientX - startX;
      clampDockedBettyWidth(startW + dx, win);
    } else if (isDragging) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const rect = win.getBoundingClientRect ? win.getBoundingClientRect() : { width: 420, height: 560 };
      const vw = window.innerWidth || 1280;
      const vh = window.innerHeight || 800;
      const maxLeft = Math.max(8, vw - (rect.width || 420) - 8);
      const maxTop = Math.max(8, vh - (rect.height || 560) - 8);
      const newLeft = Math.max(8, Math.min(maxLeft, startLeft + dx));
      const newTop = Math.max(8, Math.min(maxTop, startTop + dy));
      win.style.left = `${Math.round(newLeft)}px`;
      win.style.top = `${Math.round(newTop)}px`;
    } else if (isResizing) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const vw = window.innerWidth || 1280;
      const vh = window.innerHeight || 800;
      const minW = 340;
      const minH = 360;

      let newW = startW;
      let newH = startH;
      let newL = startLeft;
      let newT = startTop;

      if (resizeDir.includes("e")) {
        newW = Math.max(minW, Math.min(vw - startLeft - 8, startW + dx));
      }
      if (resizeDir.includes("s")) {
        newH = Math.max(minH, Math.min(vh - startTop - 8, startH + dy));
      }
      if (resizeDir.includes("w")) {
        const rightEdge = startLeft + startW;
        const clampedLeft = Math.max(8, Math.min(rightEdge - minW, startLeft + dx));
        newL = clampedLeft;
        newW = rightEdge - clampedLeft;
      }
      if (resizeDir.includes("n")) {
        const bottomEdge = startTop + startH;
        const clampedTop = Math.max(8, Math.min(bottomEdge - minH, startTop + dy));
        newT = clampedTop;
        newH = bottomEdge - clampedTop;
      }

      win.style.width = `${Math.round(newW)}px`;
      win.style.height = `${Math.round(newH)}px`;
      win.style.left = `${Math.round(newL)}px`;
      win.style.top = `${Math.round(newT)}px`;
    }
  });

  const endPointerInteraction = () => {
    if (!isDragging && !isResizing && !isDockedResizing) return;

    if (isDockedResizing) {
      const rect = win.getBoundingClientRect ? win.getBoundingClientRect() : null;
      const finalW = clampDockedBettyWidth(
        rect && rect.width > 0 ? rect.width : startW,
        win
      );
      localStorage.setItem(BETTY_DOCKED_WIDTH_KEY, String(finalW));
    } else {
      const clampedRect = clampFloatingBettyToViewport(win);
      if (clampedRect && typeof callbacks.onFloatingRectChange === "function") {
        callbacks.onFloatingRectChange(clampedRect);
      }
    }

    isDragging = false;
    isResizing = false;
    isDockedResizing = false;
    win.classList.remove("is-dragging", "is-resizing");
    document.body.style.userSelect = "";
    releaseCapturedPointer();
  };

  window.addEventListener("pointerup", endPointerInteraction);
  window.addEventListener("pointercancel", endPointerInteraction);
  window.addEventListener("resize", () => {
    if (win.classList.contains("docked")) {
      const rawProp =
        win.style && typeof win.style.getPropertyValue === "function"
          ? win.style.getPropertyValue("--betty-docked-width")
          : "";
      const currentW = parseFloat(rawProp) || parseFloat(localStorage.getItem(BETTY_DOCKED_WIDTH_KEY) || "") || 380;
      clampDockedBettyWidth(currentW, win);
      return;
    }
    const clampedRect = clampFloatingBettyToViewport(win);
    if (clampedRect && typeof callbacks.onFloatingRectChange === "function") {
      callbacks.onFloatingRectChange(clampedRect);
    }
  });
}
