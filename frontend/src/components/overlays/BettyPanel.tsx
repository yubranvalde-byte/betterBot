import { useEffect, useRef, useState } from 'react';
import {
  ArrowsIn,
  ArrowsOut,
  CircleNotch,
  Cpu,
  PaperPlaneTilt,
  Robot,
  SidebarSimple,
  Stack,
  Trash,
  User,
  Wrench,
  X,
} from '@phosphor-icons/react';
import { STORAGE_KEYS } from '../../api/client';
import type { BettyMessage, BettyMode } from '../../types/api';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { Tooltip } from '../Tooltip';

interface BettyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  mode: BettyMode;
  onChangeMode: (mode: BettyMode) => void;
  histories: Record<BettyMode, BettyMessage[]>;
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onClearModeHistory: (mode: BettyMode) => void;
}

const BETTY_SUGGESTIONS: Record<BettyMode, string[]> = {
  tech_support: [
    'איך עובדים 4 הסוכנים במערכת?',
    'מה קורה במצב ESCALATE (מפסק פחת)?',
    'מה ההבדל בין Champion ל-Challenger?',
    'איך עובד מצב עריכה ישירה (Manual Override)?',
  ],
  prompt_advisor: [
    'אילו מודולים קוגניטיביים כדאי לבחור לבוט שלי?',
    'נתח ובקר את ה-Blueprint / הפרומפט הנוכחי שלי',
    'איך למנוע הזיות (Hallucinations) בפרומפט מורכב?',
    'נסח לי פקודת שדרוג מדויקת עבור ה-Upgrader',
  ],
};

interface FloatingRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function clampDockedWidth(desired: number): number {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const minW = 320;
  const maxW = Math.max(minW, Math.min(560, Math.floor(vw * 0.45)));
  const numeric = Number(desired);
  const base = Number.isFinite(numeric) && numeric > 0 ? numeric : 380;
  return Math.round(Math.max(minW, Math.min(maxW, base)));
}

function clampFloatingRect(rect: FloatingRect): FloatingRect {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const width = Math.round(Math.max(340, Math.min(rect.width, vw - 24)));
  const height = Math.round(Math.max(360, Math.min(rect.height, vh - 24)));
  const left = Math.round(Math.max(12, Math.min(vw - width - 12, rect.left)));
  const top = Math.round(Math.max(12, Math.min(vh - height - 12, rect.top)));
  return { left, top, width, height };
}

export function BettyPanel({
  isOpen,
  onClose,
  mode,
  onChangeMode,
  histories,
  isLoading,
  onSendMessage,
  onClearModeHistory,
}: BettyPanelProps) {
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true,
  );
  const [isDocked, setIsDocked] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [dockedWidth, setDockedWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEYS.BETTY_DOCKED_WIDTH));
    return clampDockedWidth(saved || 380);
  });
  const [floatingRect, setFloatingRect] = useState<FloatingRect>(() =>
    clampFloatingRect({ left: 24, top: 72, width: 420, height: 560 }),
  );
  const [draft, setDraft] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const clearTimerRef = useRef<number | null>(null);
  const dragStateRef = useRef<{
    kind: 'dock-resize' | 'float-drag' | 'float-resize' | null;
    startX: number;
    startY: number;
    startWidth: number;
    startRect: FloatingRect;
  }>({
    kind: null,
    startX: 0,
    startY: 0,
    startWidth: 380,
    startRect: { left: 24, top: 72, width: 420, height: 560 },
  });

  const messages = histories[mode] || [];

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen, mode]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, isLoading, mode, isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const syncBreakpoint = () => setIsDesktop(mq.matches);
    syncBreakpoint();
    mq.addEventListener('change', syncBreakpoint);
    return () => mq.removeEventListener('change', syncBreakpoint);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setDockedWidth((prev) => clampDockedWidth(prev));
      setFloatingRect((prev) => clampFloatingRect(prev));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const ds = dragStateRef.current;
      if (!ds.kind) return;
      const dx = e.clientX - ds.startX;
      const dy = e.clientY - ds.startY;
      if (ds.kind === 'dock-resize') {
        const nextW = clampDockedWidth(ds.startWidth + dx);
        setDockedWidth(nextW);
      } else if (ds.kind === 'float-drag') {
        setFloatingRect(
          clampFloatingRect({
            ...ds.startRect,
            left: ds.startRect.left + dx,
            top: ds.startRect.top + dy,
          }),
        );
      } else if (ds.kind === 'float-resize') {
        setFloatingRect(
          clampFloatingRect({
            ...ds.startRect,
            width: ds.startRect.width + dx,
            height: ds.startRect.height + dy,
          }),
        );
      }
    };

    const onPointerUp = () => {
      if (dragStateRef.current.kind === 'dock-resize') {
        localStorage.setItem(STORAGE_KEYS.BETTY_DOCKED_WIDTH, String(dockedWidth));
      }
      dragStateRef.current.kind = null;
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dockedWidth]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = draft.trim();
    if (!cleaned || isLoading) return;
    setDraft('');
    onSendMessage(cleaned);
  };

  const handleChipClick = (q: string) => {
    setDraft(q);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleClearClick = () => {
    if (isLoading) return;
    if (!confirmClear) {
      setConfirmClear(true);
      if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = window.setTimeout(() => setConfirmClear(false), 3500);
      return;
    }
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    setConfirmClear(false);
    onClearModeHistory(mode);
  };

  const containerClasses = !isDesktop
    ? 'fixed inset-y-0 left-0 z-50 w-full sm:max-w-[440px] h-[100dvh] bg-surface sm:border-r sm:border-hairline-strong shadow-xl shadow-obsidian/10 flex flex-col overflow-hidden'
    : isMaximized
    ? 'fixed inset-4 z-40 bg-surface border border-hairline-strong rounded-lg shadow-xl shadow-obsidian/8 flex flex-col overflow-hidden'
    : isDocked
    ? 'w-full lg:w-[var(--betty-w)] bg-surface border-t lg:border-t-0 lg:border-r border-hairline flex flex-col shrink-0 relative h-[520px] lg:h-[calc(100vh-58px)] lg:sticky lg:top-[58px]'
    : 'fixed z-40 bg-surface border border-hairline-strong rounded-lg shadow-xl shadow-obsidian/8 flex flex-col overflow-hidden';

  const containerStyle: React.CSSProperties | undefined = !isDesktop
    ? undefined
    : isMaximized
    ? {}
    : isDocked
    ? ({ '--betty-w': `${dockedWidth}px` } as React.CSSProperties)
    : {
        left: `${floatingRect.left}px`,
        top: `${floatingRect.top}px`,
        width: `${floatingRect.width}px`,
        height: `${floatingRect.height}px`,
      };

  return (
    <>
      {!isDesktop && (
        <div
          className="fixed inset-0 z-40 bg-obsidian/25 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        role={!isDesktop ? 'dialog' : undefined}
        aria-modal={!isDesktop ? true : undefined}
        aria-label="חלון הצ'אט של בטי"
        className={containerClasses}
        style={containerStyle}
      >
        {/* Docked Edge Resize Handle (Inner right edge in RTL) */}
        {isDesktop && isDocked && !isMaximized && (
          <Tooltip
            content="גרור לשינוי רוחב הפאנל"
            placement="left"
            className="hidden lg:block absolute top-0 bottom-0 -right-1 w-2 z-10"
          >
            <div
              onPointerDown={(e) => {
                if (e.button !== 0 || window.innerWidth < 1024) return;
                e.preventDefault();
                dragStateRef.current = {
                  kind: 'dock-resize',
                  startX: e.clientX,
                  startY: e.clientY,
                  startWidth: dockedWidth,
                  startRect: floatingRect,
                };
                document.body.style.userSelect = 'none';
              }}
              className="w-full h-full cursor-ew-resize hover:bg-obsidian/15"
            />
          </Tooltip>
        )}

        {/* Title Bar */}
        <div
          onPointerDown={(e) => {
            if (!isDesktop || isDocked || isMaximized || e.button !== 0) return;
            if ((e.target as HTMLElement).closest('button')) return;
            dragStateRef.current = {
              kind: 'float-drag',
              startX: e.clientX,
              startY: e.clientY,
              startWidth: dockedWidth,
              startRect: floatingRect,
            };
            document.body.style.userSelect = 'none';
          }}
          className={`px-4 py-3 border-b border-hairline bg-porcelain flex items-center justify-between gap-2 ${
            isDesktop && !isDocked && !isMaximized ? 'cursor-move' : ''
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1.5 rounded-md border border-hairline bg-surface text-obsidian prism-aura shrink-0">
              <Robot size={15} />
            </span>
            <div className="min-w-0">
              <div className="font-display text-sm font-semibold text-obsidian">בטי (Betty)</div>
              <div className="text-[11px] text-slate-ink truncate">
                {mode === 'tech_support'
                  ? 'תמיכה טכנית והדרכה על המערכת'
                  : 'יועצת הנדסת פרומפטים · Architect'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Tooltip
              content={isDocked ? 'עבור לחלון צף' : 'עגן כסרגל צד'}
              placement="bottom"
              className="hidden lg:inline-flex"
            >
              <button
                type="button"
                onClick={() => {
                  setIsMaximized(false);
                  setIsDocked((prev) => !prev);
                }}
                aria-label={isDocked ? 'עבור לחלון צף' : 'עגן כסרגל צד'}
                className={`p-1.5 rounded-sm border canon-transition cursor-pointer ${
                  isDocked
                    ? 'border-obsidian bg-recessed text-obsidian'
                    : 'border-hairline bg-surface hover:bg-hover text-slate-ink hover:text-obsidian'
                }`}
              >
                <SidebarSimple size={14} />
              </button>
            </Tooltip>

            <Tooltip
              content={isMaximized ? 'שחזר גודל' : 'הגדל חלון'}
              placement="bottom"
              className="hidden lg:inline-flex"
            >
              <button
                type="button"
                onClick={() => setIsMaximized((prev) => !prev)}
                aria-label={isMaximized ? 'שחזר גודל' : 'הגדל חלון'}
                className="p-1.5 rounded-sm border border-hairline bg-surface hover:bg-hover text-slate-ink hover:text-obsidian canon-transition cursor-pointer"
              >
                {isMaximized ? <ArrowsIn size={14} /> : <ArrowsOut size={14} />}
              </button>
            </Tooltip>

            <Tooltip content="סגור חלון" placement="bottom">
              <button
                type="button"
                onClick={onClose}
                aria-label="סגור חלון בטי"
                className="p-2 lg:p-1.5 rounded-sm border border-hairline bg-surface hover:bg-hover text-slate-ink hover:text-obsidian canon-transition cursor-pointer"
              >
                <X size={14} />
              </button>
            </Tooltip>
          </div>
        </div>

      {/* Mode Switcher + Clear Button */}
      <div className="px-4 py-2.5 border-b border-hairline bg-surface flex items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="מצב ייעוץ בטי"
          className="inline-flex bg-recessed p-1 rounded-md border border-hairline flex-1 min-w-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'tech_support'}
            onClick={() => {
              setConfirmClear(false);
              onChangeMode('tech_support');
            }}
            className={`flex-1 px-2 py-1 rounded-sm text-[11px] font-medium inline-flex items-center justify-center gap-1.5 canon-transition cursor-pointer truncate ${
              mode === 'tech_support'
                ? 'bg-surface text-obsidian border border-hairline shadow-xs'
                : 'text-slate-ink hover:text-obsidian border border-transparent'
            }`}
          >
            <Wrench size={12} className="shrink-0" />
            <span className="truncate">תמיכה טכנית והדרכה</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === 'prompt_advisor'}
            onClick={() => {
              setConfirmClear(false);
              onChangeMode('prompt_advisor');
            }}
            className={`flex-1 px-2 py-1 rounded-sm text-[11px] font-medium inline-flex items-center justify-center gap-1.5 canon-transition cursor-pointer truncate ${
              mode === 'prompt_advisor'
                ? 'bg-surface text-obsidian border border-hairline shadow-xs'
                : 'text-slate-ink hover:text-obsidian border border-transparent'
            }`}
          >
            <Stack size={12} className="shrink-0" />
            <span dir="ltr" className="truncate font-mono">
              Prompt Advisor
            </span>
          </button>
        </div>

        <Tooltip
          content={confirmClear ? 'לחץ שוב לאישור ניקוי השיחה' : 'נקה שיחה במצב הנוכחי'}
          placement="bottom"
        >
          <button
            type="button"
            onClick={handleClearClick}
            aria-label={confirmClear ? 'לחץ שוב לאישור ניקוי השיחה' : 'נקה שיחה במצב הנוכחי'}
            className={`h-7 px-2 rounded-sm border text-[11px] inline-flex items-center gap-1 shrink-0 canon-transition cursor-pointer ${
              confirmClear
                ? 'border-crimson bg-crimson text-white font-medium'
                : 'border-hairline bg-porcelain hover:bg-hover text-slate-ink hover:text-obsidian'
            }`}
          >
            <Trash size={12} />
            {confirmClear && <span>אפס שיחה?</span>}
          </button>
        </Tooltip>
      </div>

      {/* Wrapping Quick Suggestions — ZERO horizontal scrollbar */}
      <div className="px-3 py-2 lg:px-4 lg:py-2.5 border-b border-hairline bg-porcelain/60 flex flex-wrap gap-1.5 max-h-[112px] lg:max-h-none overflow-y-auto lg:overflow-visible">
        {BETTY_SUGGESTIONS[mode].map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => handleChipClick(q)}
            className="text-right text-[11px] leading-snug px-2.5 py-1 rounded-sm border border-hairline bg-surface hover:bg-hover hover:border-hairline-strong text-slate-ink hover:text-obsidian canon-transition cursor-pointer"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Messages */}
      <div
        ref={messagesRef}
        className="flex-1 overflow-y-auto px-4 py-4 divide-y divide-hairline bg-surface"
      >
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id || idx} className="py-3.5 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2 mb-1.5 text-[11px] font-mono text-muted">
                <span className="inline-flex items-center gap-1.5 font-sans font-medium text-obsidian">
                  {isUser ? (
                    <>
                      <User size={12} className="text-slate-ink" />
                      <span>אתה</span>
                    </>
                  ) : mode === 'tech_support' ? (
                    <>
                      <Wrench size={12} className="text-obsidian" />
                      <span>בטי — תמיכה טכנית</span>
                    </>
                  ) : (
                    <>
                      <Stack size={12} className="text-obsidian" />
                      <span>בטי — Prompt Advisor</span>
                    </>
                  )}
                </span>
                <span dir="ltr" className="tabular-nums">
                  {msg.timestamp}
                </span>
              </div>

              <MarkdownRenderer content={msg.text} stripEmojis className="text-sm" />

              {msg.thought && (
                <details className="mt-2.5 border border-hairline rounded-md bg-porcelain/70">
                  <summary className="px-2.5 py-1.5 text-[11px] text-slate-ink cursor-pointer select-none inline-flex items-center gap-1.5">
                    <Cpu size={12} className="text-muted" />
                    <span>תהליך חשיבה סמוי (&lt;thought_process&gt;)</span>
                  </summary>
                  <pre
                    dir="ltr"
                    className="border-t border-hairline p-2.5 font-mono text-[11px] text-slate-ink whitespace-pre-wrap overflow-x-auto bg-porcelain"
                  >
                    {msg.thought}
                  </pre>
                </details>
              )}
            </div>
          );
        })}
      </div>

      {/* Thinking Indicator */}
      {isLoading && (
        <div className="px-4 py-2 border-t border-hairline bg-porcelain/80 flex items-center gap-2 text-xs text-slate-ink">
          <CircleNotch size={13} className="animate-spin text-obsidian shrink-0" />
          <span>
            {mode === 'tech_support'
              ? 'בטי בודקת את מפרט המערכת ומצב הסשן...'
              : 'בטי מבצעת ניתוח Tree of Thoughts ו-CoVe...'}
          </span>
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="px-3 sm:px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:py-3 border-t border-hairline bg-porcelain"
      >
        <div className="prism-composer flex items-end gap-2 rounded-xl border border-hairline bg-white px-3 py-2">
          <textarea
            ref={inputRef}
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={
              mode === 'tech_support'
                ? 'שאל את בטי איך המערכת עובדת או איך לתפעל...'
                : 'התייעץ עם בטי על ארכיטקטורת הפרומפט והמודולים...'
            }
            className="flex-1 resize-none bg-transparent text-sm lg:text-xs text-ink placeholder:text-muted focus:outline-none min-h-[44px] max-h-[140px]"
          />
          <button
            type="submit"
            disabled={!draft.trim() || isLoading}
            className="btn-obsidian h-8 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>שלח</span>
            <PaperPlaneTilt size={13} weight="bold" />
          </button>
        </div>
      </form>

      {/* Bottom-right floating resize handle */}
      {isDesktop && !isDocked && !isMaximized && (
        <Tooltip
          content="שנה גודל חלון"
          placement="top"
          className="absolute bottom-0 right-0 w-3.5 h-3.5"
        >
          <div
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              dragStateRef.current = {
                kind: 'float-resize',
                startX: e.clientX,
                startY: e.clientY,
                startWidth: dockedWidth,
                startRect: floatingRect,
              };
              document.body.style.userSelect = 'none';
            }}
            className="w-full h-full cursor-nwse-resize"
          />
        </Tooltip>
      )}
      </aside>
    </>
  );
}
