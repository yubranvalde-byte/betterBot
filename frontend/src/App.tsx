import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearBettyHistory,
  clearStoredMasterKey,
  createSession,
  deleteSession,
  downloadSessionZip,
  exportWorkspace,
  fetchHealth,
  getBettyHistory,
  getOrCreateWorkspaceId,
  getSession,
  getStoredMasterKey,
  importWorkspace,
  listSessions,
  renameSession,
  sendBettyChat,
  setStoredMasterKey,
  STORAGE_KEYS,
  streamSessionExecution,
  verifyMasterKey,
} from './api/client';
import {
  ExecutionBar,
  type ExecutionBannerState,
} from './components/common/ExecutionBar';
import { Toast } from './components/common/Toast';
import { TopNavBar } from './components/layout/TopNavBar';
import { BettyPanel } from './components/overlays/BettyPanel';
import { HistoryDrawer } from './components/overlays/HistoryDrawer';
import { WorkspaceSyncModal } from './components/overlays/WorkspaceSyncModal';
import { ArtifactsView } from './components/views/ArtifactsView';
import { InterviewView } from './components/views/InterviewView';
import { QaView } from './components/views/QaView';
import { TopologyView } from './components/views/TopologyView';
import type {
  ArtifactTab,
  BettyMessage,
  BettyMode,
  DiffMode,
  HealthRoutingNode,
  NodeId,
  SessionData,
  SessionSummary,
  ToastState,
  ToastTone,
  ViewId,
} from './types/api';
import { PRIMARY_FILE_KEY, resolveActiveArtifactFile } from './utils/artifacts';

const VALID_VIEWS: readonly ViewId[] = [
  'view-interview',
  'view-artifacts',
  'view-qa',
  'view-pipeline',
];

const INITIAL_BANNER: ExecutionBannerState = {
  visible: false,
  isStreaming: false,
  nodeTitle: '',
  stageLabel: '',
  description: '',
  elapsedSeconds: 0,
  tone: 'neutral',
};

function getStageLabelForNode(nodeId: NodeId, session: SessionData | null): string {
  const stageMap: Record<NodeId, string> = {
    node_1_helper: 'שלב 1/4',
    node_2_construct: 'שלב 2/4',
    node_4_adjudicator: 'שלב 3/4',
    node_3_upgrader: 'שלב 4/4',
  };
  const base = stageMap[nodeId] || 'פעיל';
  const iter = session?.state?.iteration_count || 0;
  return iter > 0 ? `${base} · איטרציה ${iter}/3` : base;
}

export function App() {
  const [workspaceId] = useState<string>(() => getOrCreateWorkspaceId());
  const [isMasterMode, setIsMasterMode] = useState(false);
  const [isMasterConfigured, setIsMasterConfigured] = useState<boolean | null>(null);
  const [healthRouting, setHealthRouting] = useState<Record<string, HealthRoutingNode> | null>(
    null,
  );

  const [sessionsList, setSessionsList] = useState<SessionSummary[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);
  const [activeView, setActiveView] = useState<ViewId>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_VIEW) as ViewId | null;
    return saved && VALID_VIEWS.includes(saved) ? saved : 'view-interview';
  });
  const [activeArtifactTab, setActiveArtifactTab] = useState<ArtifactTab>('prompt');
  const [activeArtifactFile, setActiveArtifactFile] = useState<string>(PRIMARY_FILE_KEY);
  const [diffMode, setDiffMode] = useState<DiffMode>('unified');

  const [isStreaming, setIsStreaming] = useState(false);
  const [activeStreamingNode, setActiveStreamingNode] = useState<NodeId | null>(null);
  const [activeStreamingDesc, setActiveStreamingDesc] = useState('');
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [executionBanner, setExecutionBanner] = useState<ExecutionBannerState>(INITIAL_BANNER);
  const [notifications, setNotifications] = useState<
    Partial<Record<ViewId, 'info' | 'pass' | 'escalate'>>
  >({});

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isBettyOpen, setIsBettyOpen] = useState(false);

  const [bettyMode, setBettyMode] = useState<BettyMode>('tech_support');
  const [bettyHistories, setBettyHistories] = useState<Record<BettyMode, BettyMessage[]>>({
    tech_support: [],
    prompt_advisor: [],
  });
  const [isBettyLoading, setIsBettyLoading] = useState(false);

  const [toast, setToast] = useState<ToastState | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const elapsedIntervalRef = useRef<number | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const activeViewRef = useRef<ViewId>(activeView);
  const currentSessionRef = useRef<SessionData | null>(currentSession);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  const scheduleToastHide = useCallback((delayMs: number) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, delayMs);
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'check') => {
      setToast({ id: Date.now(), message, tone });
      scheduleToastHide(tone === 'alert' ? 6000 : 3400);
    },
    [scheduleToastHide],
  );

  const handleToastMouseEnter = useCallback(() => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const handleToastMouseLeave = useCallback(() => {
    if (toast) {
      scheduleToastHide(2000);
    }
  }, [toast, scheduleToastHide]);

  const navigateView = useCallback((view: ViewId, artifactTab?: ArtifactTab) => {
    setActiveView(view);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_VIEW, view);
    setNotifications((prev) => {
      if (!prev[view]) return prev;
      const next = { ...prev };
      delete next[view];
      return next;
    });
    if (view === 'view-artifacts' && artifactTab) {
      setActiveArtifactTab(artifactTab);
    }
  }, []);

  const setBackgroundNotification = useCallback(
    (view: ViewId, tone: 'info' | 'pass' | 'escalate') => {
      if (activeViewRef.current === view) return;
      setNotifications((prev) => ({ ...prev, [view]: tone }));
    },
    [],
  );

  const refreshSessionsList = useCallback(async () => {
    const list = await listSessions();
    setSessionsList(list);
    return list;
  }, []);

  const applySession = useCallback((sess: SessionData) => {
    setCurrentSession(sess);
    if (sess.session_id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION_ID, sess.session_id);
    }
    setActiveArtifactFile((prev) => resolveActiveArtifactFile(sess, prev));
  }, []);

  const loadSessionById = useCallback(
    async (sessionId: string, closeDrawer = true) => {
      if (!sessionId || isStreaming) return;
      const loaded = await getSession(sessionId);
      if (!loaded) {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
        const list = await refreshSessionsList();
        if (list.length > 0) {
          await loadSessionById(list[0].session_id, closeDrawer);
        } else {
          const fresh = await createSession();
          setActiveArtifactFile(PRIMARY_FILE_KEY);
          applySession(fresh);
          await refreshSessionsList();
        }
        return;
      }
      setExecutionBanner(INITIAL_BANNER);
      setNotifications({});
      setActiveArtifactFile(resolveActiveArtifactFile(loaded, PRIMARY_FILE_KEY));
      applySession(loaded);
      await refreshSessionsList();
      if (closeDrawer) setIsHistoryOpen(false);
    },
    [isStreaming, applySession, refreshSessionsList],
  );

  const initSession = useCallback(async () => {
    const list = await refreshSessionsList();
    const savedId = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION_ID);

    if (list.length > 0) {
      const targetId =
        savedId && list.some((s) => s.session_id === savedId)
          ? savedId
          : list[0].session_id;
      const loaded = await getSession(targetId);
      if (loaded) {
        setActiveArtifactFile(resolveActiveArtifactFile(loaded, PRIMARY_FILE_KEY));
        applySession(loaded);
        return;
      }
    }

    const fresh = await createSession();
    setActiveArtifactFile(PRIMARY_FILE_KEY);
    applySession(fresh);
    await refreshSessionsList();
  }, [applySession, refreshSessionsList]);

  const refreshBetty = useCallback(async () => {
    try {
      const data = await getBettyHistory();
      setBettyHistories({
        tech_support: data.tech_support || [],
        prompt_advisor: data.prompt_advisor || [],
      });
    } catch {
      // Non-fatal
    }
  }, []);

  const reloadWorkspaceState = useCallback(
    async (resetActiveSession = true) => {
      if (resetActiveSession) {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
        setCurrentSession(null);
        setActiveArtifactFile(PRIMARY_FILE_KEY);
      }
      setIsHistoryOpen(false);
      await initSession();
      await refreshBetty();
    },
    [initSession, refreshBetty],
  );

  // Initial mount bootstrap
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const storedKey = getStoredMasterKey();
      if (storedKey) {
        try {
          const res = await verifyMasterKey(storedKey);
          if (!cancelled) {
            setIsMasterConfigured(Boolean(res.configured));
            if (res.authorized) {
              setIsMasterMode(true);
            } else {
              clearStoredMasterKey();
              setIsMasterMode(false);
              showToast('מפתח ה-Master השמור אינו תקף — חזרת למרחב אנונימי', 'alert');
            }
          }
        } catch {
          // ignore network warning during startup
        }
      }

      if (!cancelled) {
        await Promise.allSettled([
          fetchHealth().then((h) => {
            if (!cancelled && h.routing) setHealthRouting(h.routing);
          }),
          refreshBetty(),
          initSession(),
        ]);
      }
    };

    bootstrap();

    const heartbeat = window.setInterval(() => {
      fetchHealth()
        .then((h) => {
          if (h.routing) setHealthRouting(h.routing);
        })
        .catch(() => {});
    }, 4 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
    };
  }, [initSession, refreshBetty, showToast]);

  // Global Escape handler for modal & drawer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isSyncModalOpen) {
        setIsSyncModalOpen(false);
        return;
      }
      if (isHistoryOpen) {
        setIsHistoryOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSyncModalOpen, isHistoryOpen]);

  const handleCreateNewSession = useCallback(async () => {
    if (isStreaming) return;
    try {
      const fresh = await createSession();
      setExecutionBanner(INITIAL_BANNER);
      setNotifications({});
      setActiveArtifactFile(PRIMARY_FILE_KEY);
      applySession(fresh);
      await refreshSessionsList();
      navigateView('view-interview');
    } catch (err) {
      showToast(`שגיאה ביצירת סשן חדש: ${(err as Error).message}`, 'alert');
    }
  }, [isStreaming, applySession, refreshSessionsList, navigateView, showToast]);

  const handleRenameSession = useCallback(
    async (sessionId: string, nextTitle: string): Promise<boolean> => {
      try {
        const updated = await renameSession(sessionId, nextTitle);
        if (currentSessionRef.current?.session_id === sessionId) {
          applySession(updated);
        }
        await refreshSessionsList();
        showToast('שם היצירה עודכן', 'check');
        return true;
      } catch {
        showToast('שגיאה בעדכון שם היצירה', 'alert');
        return false;
      }
    },
    [applySession, refreshSessionsList, showToast],
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await deleteSession(sessionId);
        if (currentSessionRef.current?.session_id === sessionId) {
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
          setCurrentSession(null);
          await initSession();
        } else {
          await refreshSessionsList();
        }
        showToast('היצירה נמחקה', 'trash');
      } catch {
        showToast('שגיאה במחיקת היצירה', 'alert');
      }
    },
    [initSession, refreshSessionsList, showToast],
  );

  const handleSendMessage = useCallback(
    async (messageText: string) => {
      const activeSess = currentSessionRef.current;
      if (!activeSess || isStreaming) return;

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsStreaming(true);
      setPendingUserMessage(messageText);

      const startedAt = Date.now();
      let postStreamBanner: ExecutionBannerState | null = null;
      let wasAborted = false;
      let hadError = false;

      setExecutionBanner({
        visible: true,
        isStreaming: true,
        nodeTitle: 'מאתחל צינור סוכנים...',
        stageLabel: 'שלב 1/4',
        description: 'מעבד הנחיה...',
        elapsedSeconds: 0,
        tone: 'neutral',
      });

      if (elapsedIntervalRef.current !== null) {
        window.clearInterval(elapsedIntervalRef.current);
      }
      elapsedIntervalRef.current = window.setInterval(() => {
        const secs = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
        setExecutionBanner((prev) =>
          prev.visible && prev.isStreaming ? { ...prev, elapsedSeconds: secs } : prev,
        );
      }, 1000);

      try {
        await streamSessionExecution(
          activeSess.session_id,
          messageText,
          {
            onRecoveredSession: (recovered) => {
              setActiveArtifactFile(PRIMARY_FILE_KEY);
              applySession(recovered);
            },
            onSessionUpdate: (sess) => {
              setPendingUserMessage(null);
              applySession(sess);
            },
            onNodeStart: (payload) => {
              setActiveStreamingNode(payload.node);
              setActiveStreamingDesc(payload.description || '');
              const stage = getStageLabelForNode(payload.node, currentSessionRef.current);
              const desc = payload.model
                ? `${payload.description} (${payload.model})`
                : payload.description;
              setExecutionBanner((prev) => ({
                ...prev,
                visible: true,
                isStreaming: true,
                nodeTitle: payload.title,
                stageLabel: stage,
                description: desc,
                tone: 'neutral',
              }));
            },
            onNodeComplete: (payload) => {
              setActiveStreamingNode(null);
              setActiveStreamingDesc('');
              applySession(payload.session);
              if (payload.node === 'node_1_helper' && payload.session.raw_blueprint) {
                setBackgroundNotification('view-artifacts', 'info');
                postStreamBanner = {
                  visible: true,
                  isStreaming: false,
                  nodeTitle: 'תוכנית האב הופקה',
                  stageLabel: 'Blueprint מוכן',
                  description: 'תוכנית ה-XML Blueprint מוכנה לצפייה',
                  elapsedSeconds: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
                  tone: 'neutral',
                  ctaLabel: 'צפה ב-XML Blueprint',
                  onCtaClick: () => navigateView('view-artifacts', 'blueprint'),
                };
              } else if (
                payload.node === 'node_2_construct' ||
                payload.node === 'node_4_adjudicator'
              ) {
                setBackgroundNotification('view-artifacts', 'info');
                postStreamBanner = {
                  visible: true,
                  isStreaming: false,
                  nodeTitle: 'הפרומפט עודכן',
                  stageLabel: 'פרומפט מעודכן',
                  description: 'התוצר הידר ומוכן לבדיקה במעבדת התוצרים',
                  elapsedSeconds: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
                  tone: 'neutral',
                  ctaLabel: 'צפה בפרומפט',
                  onCtaClick: () => navigateView('view-artifacts', 'prompt'),
                };
              }
            },
            onDone: (sess) => {
              setActiveStreamingNode(null);
              setActiveStreamingDesc('');
              setPendingUserMessage(null);
              applySession(sess);

              const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
              if (sess.status === 'passed') {
                setBackgroundNotification('view-artifacts', 'pass');
                postStreamBanner = {
                  visible: true,
                  isStreaming: false,
                  nodeTitle: 'הפרומפט אושר סופית',
                  stageLabel: 'PASS',
                  description: 'בקרת האיכות הושלמה בהצלחה — ניתן לעבור לתוצר',
                  elapsedSeconds: elapsed,
                  tone: 'pass',
                  ctaLabel: 'צפה בפרומפט המאושר',
                  onCtaClick: () => navigateView('view-artifacts', 'prompt'),
                };
                showToast('הפרומפט אושר על ידי מבקר האיכות (PASS)', 'check');
              } else if (sess.status === 'escalated') {
                setBackgroundNotification('view-qa', 'escalate');
                postStreamBanner = {
                  visible: true,
                  isStreaming: false,
                  nodeTitle: 'נדרשת הכוונה ידנית',
                  stageLabel: 'ESCALATE',
                  description: 'הופעל Circuit Breaker — צפה בממצאים ושלח תיקון ב-QA',
                  elapsedSeconds: elapsed,
                  tone: 'escalate',
                  ctaLabel: 'פתח מעבדת QA לתיקון',
                  onCtaClick: () => navigateView('view-qa'),
                };
                showToast('נדרשת הכוונה ידנית (Circuit Breaker)', 'alert');
              }
            },
            onError: (payload) => {
              hadError = true;
              setActiveStreamingNode(null);
              setActiveStreamingDesc('');
              setPendingUserMessage(null);
              if (payload.session) applySession(payload.session);
              showToast(`שגיאה: ${payload.error}`, 'alert');
            },
          },
          controller.signal,
        );
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          wasAborted = true;
          showToast('ההזרמה נעצרה בצד הלקוח', 'check');
        } else {
          hadError = true;
          showToast(`שגיאת תקשורת: ${(err as Error).message}`, 'alert');
        }
      } finally {
        if (elapsedIntervalRef.current !== null) {
          window.clearInterval(elapsedIntervalRef.current);
          elapsedIntervalRef.current = null;
        }
        abortControllerRef.current = null;
        setIsStreaming(false);
        setActiveStreamingNode(null);
        setActiveStreamingDesc('');
        setPendingUserMessage(null);

        const finalElapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
        if (wasAborted) {
          setExecutionBanner({
            visible: true,
            isStreaming: false,
            nodeTitle: 'הרצה הופסקה',
            stageLabel: 'בוטל',
            description: 'ההזרמה נעצרה בצד הלקוח',
            elapsedSeconds: finalElapsed,
            tone: 'neutral',
          });
        } else if (hadError) {
          setExecutionBanner(INITIAL_BANNER);
        } else if (postStreamBanner) {
          setExecutionBanner(postStreamBanner);
        } else {
          setExecutionBanner(INITIAL_BANNER);
        }

        await refreshSessionsList().catch(() => {});
      }
    },
    [
      isStreaming,
      applySession,
      navigateView,
      refreshSessionsList,
      setBackgroundNotification,
      showToast,
    ],
  );

  const handleStopStream = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleDownloadZip = useCallback(async () => {
    if (!currentSession?.session_id) return;
    try {
      const { blob, filename } = await downloadSessionZip(
        currentSession.session_id,
        currentSession.slug_name || currentSession.session_id,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('החבילה (.ZIP) ירדה בהצלחה', 'download');
    } catch (err) {
      showToast(`שגיאה בהורדת החבילה: ${(err as Error).message}`, 'alert');
    }
  }, [currentSession, showToast]);

  const handleExportJson = useCallback(async () => {
    try {
      const { blob, filename } = await exportWorkspace(isMasterMode);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('היסטוריית מרחב העבודה יוצאה בהצלחה (JSON)', 'download');
    } catch (err) {
      showToast(`שגיאה בייצוא ההיסטוריה: ${(err as Error).message}`, 'alert');
    }
  }, [isMasterMode, showToast]);

  const handleTriggerImportJson = useCallback(() => {
    if (isStreaming) {
      showToast('יש להמתין לסיום ההרצה הפעילה לפני ייבוא היסטוריה', 'alert');
      return;
    }
    if (importInputRef.current) {
      importInputRef.current.value = '';
      importInputRef.current.click();
    }
  }, [isStreaming, showToast]);

  const handleImportFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const summary = await importWorkspace(parsed);
        setIsSyncModalOpen(false);
        await reloadWorkspaceState(false);
        showToast(`יובאו ${summary.imported ?? 0} סשנים בהצלחה למרחב העבודה`, 'check');
      } catch (err) {
        showToast(`שגיאה בייבוא קובץ JSON: ${(err as Error).message}`, 'alert');
      }
    },
    [reloadWorkspaceState, showToast],
  );

  const handleOpenSyncModal = useCallback(async () => {
    setIsSyncModalOpen(true);
    if (!isMasterMode && isMasterConfigured === null) {
      try {
        const res = await verifyMasterKey('');
        setIsMasterConfigured(Boolean(res.configured));
      } catch {
        // ignore
      }
    }
  }, [isMasterMode, isMasterConfigured]);

  const handleVerifyAndConnectMaster = useCallback(
    async (key: string): Promise<{ ok: boolean; message?: string }> => {
      try {
        const data = await verifyMasterKey(key);
        setIsMasterConfigured(Boolean(data.configured));
        if (!data.configured) {
          return {
            ok: false,
            message: 'מפתח MASTER_WORKSPACE_KEY אינו מוגדר בשרת כרגע.',
          };
        }
        if (!data.authorized) {
          return { ok: false, message: 'המפתח שהוזן שגוי.' };
        }
        setStoredMasterKey(key);
        setIsMasterMode(true);
        setIsSyncModalOpen(false);
        await reloadWorkspaceState(true);
        showToast('מצב Master הופעל — היסטוריית הבעלים מסונכרנת', 'check');
        return { ok: true };
      } catch (err) {
        return { ok: false, message: `שגיאת תקשורת: ${(err as Error).message}` };
      }
    },
    [reloadWorkspaceState, showToast],
  );

  const handleDisconnectMaster = useCallback(async () => {
    if (isStreaming) {
      showToast('יש להמתין לסיום ההרצה הפעילה לפני ניתוק מ-Master', 'alert');
      return;
    }
    clearStoredMasterKey();
    setIsMasterMode(false);
    setIsSyncModalOpen(false);
    await reloadWorkspaceState(true);
    showToast('חזרת למרחב העבודה האנונימי המבודד', 'check');
  }, [isStreaming, reloadWorkspaceState, showToast]);

  const handleSendBetty = useCallback(
    async (text: string) => {
      if (isBettyLoading) return;
      const mode = bettyMode;
      const now = new Date().toTimeString().slice(0, 8);

      setIsBettyLoading(true);
      setBettyHistories((prev) => ({
        ...prev,
        [mode]: [
          ...prev[mode],
          {
            id: String(Date.now()),
            role: 'user',
            mode,
            text,
            timestamp: now,
          },
        ],
      }));

      try {
        const data = await sendBettyChat(
          text,
          mode,
          currentSessionRef.current?.session_id || null,
        );
        if (data.history) {
          setBettyHistories((prev) => ({
            ...prev,
            [data.mode || mode]: data.history,
          }));
        }
      } catch (err) {
        setBettyHistories((prev) => ({
          ...prev,
          [mode]: [
            ...prev[mode],
            {
              id: String(Date.now()),
              role: 'assistant',
              mode,
              text: `שגיאת תקשורת: ${(err as Error).message}`,
              timestamp: now,
            },
          ],
        }));
      } finally {
        setIsBettyLoading(false);
      }
    },
    [bettyMode, isBettyLoading],
  );

  const handleClearBetty = useCallback(
    async (mode: BettyMode) => {
      try {
        const data = await clearBettyHistory(mode);
        setBettyHistories((prev) => ({
          ...prev,
          [mode]: data.history || [],
        }));
        showToast('שיחת בטי במצב הנוכחי אופסה', 'trash');
      } catch {
        showToast('שגיאה באיפוס שיחת בטי', 'alert');
      }
    },
    [showToast],
  );

  return (
    <div className="relative min-h-screen flex flex-col bg-prism-canvas text-ink overflow-x-clip">
      <TopNavBar
        activeView={activeView}
        onSelectView={(view) => navigateView(view)}
        currentSession={currentSession}
        sessionCount={sessionsList.length}
        isStreaming={isStreaming}
        activeStreamingNode={activeStreamingNode}
        isMasterMode={isMasterMode}
        isBettyOpen={isBettyOpen}
        isHistoryOpen={isHistoryOpen}
        notifications={notifications}
        onToggleHistory={() => setIsHistoryOpen((v) => !v)}
        onNewSession={handleCreateNewSession}
        onOpenSyncModal={handleOpenSyncModal}
        onToggleBetty={() => setIsBettyOpen((v) => !v)}
      />

      <ExecutionBar
        banner={executionBanner}
        onStop={handleStopStream}
        onDismiss={() => setExecutionBanner(INITIAL_BANNER)}
      />

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <main className="flex-1 min-w-0 flex flex-col min-h-0">
          {activeView === 'view-interview' && (
            <InterviewView
              session={currentSession}
              isStreaming={isStreaming}
              activeStreamingNode={activeStreamingNode}
              activeStreamingDesc={activeStreamingDesc}
              pendingUserMessage={pendingUserMessage}
              onSendMessage={handleSendMessage}
              onNavigateView={navigateView}
              onShowToast={showToast}
            />
          )}

          {activeView === 'view-artifacts' && (
            <ArtifactsView
              session={currentSession}
              activeTab={activeArtifactTab}
              onChangeTab={setActiveArtifactTab}
              activeFile={activeArtifactFile}
              onChangeFile={setActiveArtifactFile}
              isStreaming={isStreaming}
              activeStreamingNode={activeStreamingNode}
              activeStreamingDesc={activeStreamingDesc}
              onRunUpgrader={handleSendMessage}
              onDownloadZip={handleDownloadZip}
              onNavigateToQa={() => navigateView('view-qa')}
              onShowToast={showToast}
            />
          )}

          {activeView === 'view-qa' && (
            <QaView
              session={currentSession}
              diffMode={diffMode}
              onChangeDiffMode={setDiffMode}
              isStreaming={isStreaming}
              onRunUpgrader={handleSendMessage}
            />
          )}

          {activeView === 'view-pipeline' && (
            <TopologyView
              session={currentSession}
              activeStreamingNode={activeStreamingNode}
              healthRouting={healthRouting}
              onNavigateView={navigateView}
            />
          )}
        </main>

        <BettyPanel
          isOpen={isBettyOpen}
          onClose={() => setIsBettyOpen(false)}
          mode={bettyMode}
          onChangeMode={setBettyMode}
          histories={bettyHistories}
          isLoading={isBettyLoading}
          onSendMessage={handleSendBetty}
          onClearModeHistory={handleClearBetty}
        />
      </div>

      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        sessions={sessionsList}
        activeSessionId={currentSession?.session_id || null}
        isMasterMode={isMasterMode}
        isStreaming={isStreaming}
        onSelectSession={(sid) => loadSessionById(sid, true)}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
        onExportJson={handleExportJson}
        onTriggerImportJson={handleTriggerImportJson}
      />

      <WorkspaceSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        workspaceId={workspaceId}
        isMasterMode={isMasterMode}
        isMasterConfigured={isMasterConfigured}
        isStreaming={isStreaming}
        onVerifyAndConnectMaster={handleVerifyAndConnectMaster}
        onDisconnectMaster={handleDisconnectMaster}
        onExportJson={handleExportJson}
        onTriggerImportJson={handleTriggerImportJson}
        onCopyWorkspaceId={() => {
          navigator.clipboard.writeText(workspaceId);
          showToast('מזהה מרחב העבודה הועתק ללוח', 'check');
        }}
      />

      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFileChange}
      />

      <Toast
        toast={toast}
        onMouseEnter={handleToastMouseEnter}
        onMouseLeave={handleToastMouseLeave}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}

export default App;
