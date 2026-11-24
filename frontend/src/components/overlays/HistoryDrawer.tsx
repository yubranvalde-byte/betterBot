import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  DownloadSimple,
  MagnifyingGlass,
  PencilSimple,
  Trash,
  UploadSimple,
  X,
} from '@phosphor-icons/react';
import { motion } from 'motion/react';
import type { SessionSummary } from '../../types/api';
import { decodeHtmlEntities, formatRelativeTime } from '../../utils/text';
import { Tooltip } from '../Tooltip';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SessionSummary[];
  activeSessionId: string | null;
  isMasterMode: boolean;
  isStreaming: boolean;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, nextTitle: string) => Promise<boolean>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onExportJson: () => void;
  onTriggerImportJson: () => void;
}

const FILTER_OPTIONS = [
  { key: 'ALL', label: 'הכל' },
  { key: 'SKILL_PACKAGE', label: 'SKILL' },
  { key: 'SYSTEM_PROMPT', label: 'PROMPT' },
  { key: 'HYBRID_BUNDLE', label: 'HYBRID' },
  { key: 'SKILL_SUITE', label: 'SUITE' },
] as const;

export function HistoryDrawer(props: HistoryDrawerProps) {
  if (!props.isOpen) return null;
  return <HistoryDrawerInner {...props} />;
}

function HistoryDrawerInner({
  onClose,
  sessions,
  activeSessionId,
  isMasterMode,
  isStreaming,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  onExportJson,
  onTriggerImportJson,
}: HistoryDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const confirmTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 40);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current !== null) {
        window.clearTimeout(confirmTimerRef.current);
      }
    };
  }, []);

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sessions.filter((s) => {
      const typeMatch =
        filterType === 'ALL' || (s.target_type || 'SYSTEM_PROMPT') === filterType;
      if (!typeMatch) return false;
      if (!q) return true;
      const decodedTitle = decodeHtmlEntities(s.title || '');
      const hay = `${decodedTitle} ${s.target_type || ''} ${s.slug_name || ''} ${
        s.status || ''
      }`.toLowerCase();
      return hay.includes(q);
    });
  }, [sessions, filterType, searchQuery]);

  const startRename = (s: SessionSummary) => {
    setRenamingId(s.session_id);
    setRenameDraft(decodeHtmlEntities(s.title || ''));
  };

  const commitRename = async (s: SessionSummary) => {
    const cleaned = renameDraft.trim();
    const orig = decodeHtmlEntities(s.title || '').trim();
    setRenamingId(null);
    if (!cleaned || cleaned === orig) return;
    await onRenameSession(s.session_id, cleaned);
  };

  const handleDeleteClick = async (sessionId: string) => {
    if (confirmDeleteId !== sessionId) {
      setConfirmDeleteId(sessionId);
      if (confirmTimerRef.current !== null) {
        window.clearTimeout(confirmTimerRef.current);
      }
      confirmTimerRef.current = window.setTimeout(() => {
        setConfirmDeleteId(null);
      }, 3500);
      return;
    }
    if (confirmTimerRef.current !== null) {
      window.clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
    setConfirmDeleteId(null);
    setDeletingId(sessionId);
    try {
      await onDeleteSession(sessionId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      {/* Scrim */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
        className="fixed inset-0 z-40 bg-obsidian/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Opaque Porcelain Slide-Over Drawer */}
      <motion.aside
        initial={{ x: 24, opacity: 0.9 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        role="dialog"
        aria-modal="true"
        aria-label="ספריית היסטוריית יצירות"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-[400px] bg-surface border-l border-hairline-strong shadow-xl shadow-obsidian/8 flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-hairline bg-porcelain flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold tracking-[-0.02em] text-obsidian">
              ספריית היסטוריית יצירות
            </h2>
            <p className="text-xs text-slate-ink mt-0.5">
              {isMasterMode ? 'מרחב Master מסונכרן' : 'מרחב אישי מבודד'} ·{' '}
              <span className="font-mono tabular-nums">{sessions.length}</span> סשנים
            </p>
          </div>
          <Tooltip content="סגור ספריית היסטוריה" placement="left">
            <button
              type="button"
              onClick={onClose}
              aria-label="סגור ספריית היסטוריה"
              className="p-1.5 rounded-md border border-hairline bg-surface hover:bg-hover text-slate-ink hover:text-obsidian canon-transition cursor-pointer"
            >
              <X size={15} />
            </button>
          </Tooltip>
        </div>

        {/* Search & Filter Controls */}
        <div className="px-5 py-3.5 border-b border-hairline space-y-3 bg-porcelain/60">
          <div className="relative">
            <MagnifyingGlass
              size={14}
              className="text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חפש יצירה לפי שם או סוג..."
              className="w-full h-9 rounded-md border border-hairline-strong bg-surface pr-8 pl-3 text-xs text-ink placeholder:text-muted focus:border-obsidian focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FILTER_OPTIONS.map((opt) => {
              const active = filterType === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setFilterType(opt.key)}
                  className={`px-2.5 py-1 rounded-sm border font-mono text-[11px] canon-transition cursor-pointer ${
                    active
                      ? 'border-obsidian bg-obsidian text-white font-medium'
                      : 'border-hairline bg-surface text-slate-ink hover:bg-hover hover:text-obsidian'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Session Rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-hairline bg-surface">
          {filteredSessions.length === 0 ? (
            <div className="px-6 py-12 text-center text-xs text-slate-ink space-y-3">
              <p>
                {searchQuery.trim() || filterType !== 'ALL'
                  ? `לא נמצאו יצירות עבור ${
                      searchQuery.trim() ? `"${searchQuery.trim()}"` : `סוג ${filterType}`
                    }.`
                  : 'עדיין אין יצירות שמורות במרחב זה.'}
              </p>
              {(searchQuery.trim() || filterType !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterType('ALL');
                  }}
                  className="rounded-md border border-hairline bg-porcelain hover:bg-hover px-3 py-1.5 text-xs text-obsidian cursor-pointer"
                >
                  נקה סינון וחיפוש
                </button>
              )}
            </div>
          ) : (
            filteredSessions.map((s) => {
              const isCurrent = s.session_id === activeSessionId;
              const isEditing = renamingId === s.session_id;
              const isConfirmingDel = confirmDeleteId === s.session_id;
              const statusUpper = String(s.status || 'idle').toUpperCase();
              const decodedTitle = decodeHtmlEntities(s.title || 'ללא שם');
              const timeLabel = formatRelativeTime(
                s.updated_at_iso || s.updated_at || s.created_at,
              );

              const statusCls =
                statusUpper === 'PASSED' || statusUpper === 'PASS'
                  ? 'bg-emerald-tint text-emerald border-emerald/30'
                  : statusUpper === 'ESCALATED' || statusUpper === 'ESCALATE'
                  ? 'bg-crimson-tint text-crimson border-crimson/30'
                  : 'bg-recessed text-slate-ink border-hairline';

              return (
                <div
                  key={s.session_id}
                  className={`px-5 py-3.5 flex items-start justify-between gap-2 canon-transition ${
                    isCurrent
                      ? 'bg-porcelain border-r-[2.5px] border-r-obsidian'
                      : 'bg-surface hover:bg-porcelain/70'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={renameDraft}
                          autoFocus
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitRename(s);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              e.stopPropagation();
                              setRenamingId(null);
                            }
                          }}
                          onBlur={() => commitRename(s)}
                          className="w-full h-7 rounded-sm border border-obsidian bg-surface px-2 text-xs text-ink focus:outline-none"
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            commitRename(s);
                          }}
                          aria-label="אשר שינוי שם"
                          className="p-1 text-emerald cursor-pointer"
                        >
                          <Check size={14} weight="bold" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isStreaming}
                        onClick={() => onSelectSession(s.session_id)}
                        className="w-full text-right cursor-pointer disabled:opacity-60"
                      >
                        <div className="text-sm font-medium text-obsidian leading-snug break-words">
                          {decodedTitle}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span
                            dir="ltr"
                            className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm border border-hairline bg-porcelain text-slate-ink"
                          >
                            {s.target_type || 'SYSTEM_PROMPT'}
                          </span>
                          <span
                            dir="ltr"
                            className={`font-mono text-[10px] px-1.5 py-0.5 rounded-sm border ${statusCls}`}
                          >
                            {statusUpper}
                          </span>
                          <span className="font-mono text-[10px] text-muted">
                            {timeLabel}
                          </span>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Row Actions */}
                  {!isEditing && (
                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <Tooltip content="שנה שם">
                        <button
                          type="button"
                          onClick={() => startRename(s)}
                          aria-label="שנה שם"
                          className="p-1.5 rounded-sm text-muted hover:text-obsidian hover:bg-hover canon-transition cursor-pointer"
                        >
                          <PencilSimple size={14} />
                        </button>
                      </Tooltip>
                      <Tooltip content={isConfirmingDel ? 'לחץ שוב לאישור מחיקה' : 'מחק יצירה'}>
                        <button
                          type="button"
                          disabled={deletingId === s.session_id || isStreaming}
                          onClick={() => handleDeleteClick(s.session_id)}
                          aria-label={isConfirmingDel ? 'לחץ שוב לאישור מחיקה' : 'מחק יצירה'}
                          className={`px-1.5 py-1 rounded-sm text-xs canon-transition cursor-pointer ${
                            isConfirmingDel
                              ? 'bg-crimson text-white font-medium'
                              : 'text-muted hover:text-crimson hover:bg-crimson-tint'
                          }`}
                        >
                          {isConfirmingDel ? 'בטוח?' : <Trash size={14} />}
                        </button>
                      </Tooltip>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-hairline bg-porcelain flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onExportJson}
            className="flex-1 h-8 rounded-md border border-hairline bg-surface hover:bg-hover text-xs text-ink inline-flex items-center justify-center gap-1.5 canon-transition cursor-pointer"
          >
            <DownloadSimple size={14} className="text-slate-ink" />
            <span>ייצוא JSON</span>
          </button>
          <button
            type="button"
            onClick={onTriggerImportJson}
            className="flex-1 h-8 rounded-md border border-hairline bg-surface hover:bg-hover text-xs text-ink inline-flex items-center justify-center gap-1.5 canon-transition cursor-pointer"
          >
            <UploadSimple size={14} className="text-slate-ink" />
            <span>ייבוא JSON</span>
          </button>
        </div>
      </motion.aside>
    </>
  );
}
