import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  DownloadSimple,
  Key,
  UploadSimple,
  X,
} from '@phosphor-icons/react';
import { motion } from 'motion/react';

interface WorkspaceSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  isMasterMode: boolean;
  isMasterConfigured: boolean | null;
  isStreaming: boolean;
  onVerifyAndConnectMaster: (
    key: string,
  ) => Promise<{ ok: boolean; message?: string }>;
  onDisconnectMaster: () => Promise<void>;
  onExportJson: () => void;
  onTriggerImportJson: () => void;
  onCopyWorkspaceId: () => void;
}

export function WorkspaceSyncModal(props: WorkspaceSyncModalProps) {
  if (!props.isOpen) return null;
  return <WorkspaceSyncModalInner {...props} />;
}

function WorkspaceSyncModalInner({
  onClose,
  workspaceId,
  isMasterMode,
  isMasterConfigured,
  isStreaming,
  onVerifyAndConnectMaster,
  onDisconnectMaster,
  onExportJson,
  onTriggerImportJson,
  onCopyWorkspaceId,
}: WorkspaceSyncModalProps) {
  const [keyInput, setKeyInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; isError: boolean } | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isMasterMode) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 40);
      return () => window.clearTimeout(t);
    }
  }, [isMasterMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStreaming) {
      setFeedback({
        text: 'יש להמתין לסיום ההרצה הפעילה לפני החלפת מרחב עבודה.',
        isError: true,
      });
      return;
    }
    const cleaned = keyInput.trim();
    if (!cleaned) {
      setFeedback({ text: 'נא להזין מפתח Master.', isError: true });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await onVerifyAndConnectMaster(cleaned);
      if (!result.ok) {
        setFeedback({
          text: result.message || 'שגיאה באימות המפתח.',
          isError: true,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspaceSyncTitle"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/20"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="w-full max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col bg-surface border border-hairline-strong rounded-lg shadow-xl shadow-obsidian/8 overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-hairline bg-porcelain flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-obsidian" />
            <h2
              id="workspaceSyncTitle"
              className="font-display text-lg font-bold tracking-[-0.02em] text-obsidian"
            >
              סנכרון מרחב עבודה
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור חלון"
            className="p-1.5 rounded-md border border-hairline bg-surface hover:bg-hover text-slate-ink hover:text-obsidian canon-transition cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto">
          {/* Status Card */}
          <div className="border border-hairline rounded-md bg-porcelain p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-ink font-medium">מצב נוכחי:</span>
              <span
                className={`font-mono text-[11px] px-2 py-0.5 rounded-sm border inline-flex items-center gap-1.5 ${
                  isMasterMode
                    ? 'bg-emerald-tint text-emerald border-emerald/30 font-medium'
                    : 'bg-surface text-slate-ink border-hairline'
                }`}
              >
                {isMasterMode && <Check size={11} weight="bold" />}
                {isMasterMode ? 'Master Mode פעיל (מסונכרן)' : 'מרחב אנונימי מבודד'}
              </span>
            </div>

            {!isMasterMode && (
              <div className="pt-2 border-t border-hairline flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-ink mb-0.5">מזהה מרחב מקומי:</div>
                  <code
                    dir="ltr"
                    className="font-mono text-[11px] text-obsidian break-all block"
                  >
                    {workspaceId}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={onCopyWorkspaceId}
                  className="h-7 px-2.5 rounded-sm border border-hairline bg-surface hover:bg-hover text-xs text-ink inline-flex items-center gap-1 shrink-0 canon-transition cursor-pointer"
                >
                  <Copy size={12} />
                  <span>העתק</span>
                </button>
              </div>
            )}
          </div>

          {/* Master Key Section */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-obsidian">
                גישה למרחב הבעלים (
                <code dir="ltr" className="font-mono text-xs">
                  Master Mode
                </code>
                )
              </h3>
              <p className="text-xs text-slate-ink mt-1 leading-relaxed">
                הזן את מפתח ה-
                <code dir="ltr" className="font-mono text-[11px]">
                  MASTER_WORKSPACE_KEY
                </code>{' '}
                כדי לגשת להיסטוריה המרכזית שלך מכל דפדפן או מכשיר.
              </p>
            </div>

            {!isMasterMode && isMasterConfigured === false && (
              <div className="border border-amber/30 bg-amber-tint rounded-md p-3 text-xs text-ink leading-relaxed">
                <strong>מצב Master אינו מוגדר בשרת:</strong> המשתנה{' '}
                <code dir="ltr" className="font-mono text-[11px]">
                  MASTER_WORKSPACE_KEY
                </code>{' '}
                טרם הוגדר בקובץ <code dir="ltr" className="font-mono text-[11px]">.env</code>.
                עדיין ניתן להשתמש במרחב אנונימי ובגיבוי JSON.
              </div>
            )}

            {!isMasterMode ? (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row sm:items-center gap-2">
                <input
                  ref={inputRef}
                  type="password"
                  dir="ltr"
                  autoComplete="off"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="הזן MASTER_WORKSPACE_KEY..."
                  className="w-full sm:flex-1 h-9 rounded-md border border-hairline-strong bg-surface px-3 font-mono text-xs text-ink placeholder:text-muted focus:border-obsidian focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-obsidian w-full sm:w-auto h-9 px-3.5 rounded-md text-xs font-medium shrink-0 cursor-pointer"
                >
                  {submitting ? 'מאמת...' : 'התחבר כ-Master'}
                </button>
              </form>
            ) : (
              <div>
                <button
                  type="button"
                  disabled={isStreaming}
                  onClick={onDisconnectMaster}
                  className="h-8 px-3 rounded-md border border-hairline bg-porcelain hover:bg-hover disabled:opacity-50 text-xs text-obsidian canon-transition cursor-pointer"
                >
                  התנתק וחזור למרחב אנונימי
                </button>
              </div>
            )}

            {feedback && (
              <div
                className={`text-xs px-3 py-2 rounded-md border ${
                  feedback.isError
                    ? 'border-crimson/30 bg-crimson-tint text-crimson'
                    : 'border-emerald/30 bg-emerald-tint text-emerald'
                }`}
              >
                {feedback.text}
              </div>
            )}
          </div>

          {/* JSON Portability */}
          <div className="border-t border-hairline pt-5 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-obsidian">
                גיבוי וניוד היסטוריה (<code dir="ltr" className="font-mono text-xs">JSON</code>)
              </h3>
              <p className="text-xs text-slate-ink mt-1 leading-relaxed">
                ייצא את כל הסשנים והתוצרים של המרחב הפעיל לקובץ גיבוי, או ייבא קובץ גיבוי לתוך
                המרחב הנוכחי.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onExportJson}
                className="h-8 px-3 rounded-md border border-hairline bg-porcelain hover:bg-hover text-xs text-ink inline-flex items-center gap-1.5 canon-transition cursor-pointer"
              >
                <DownloadSimple size={14} className="text-slate-ink" />
                <span>ייצוא היסטוריה (JSON)</span>
              </button>
              <button
                type="button"
                onClick={onTriggerImportJson}
                className="h-8 px-3 rounded-md border border-hairline bg-porcelain hover:bg-hover text-xs text-ink inline-flex items-center gap-1.5 canon-transition cursor-pointer"
              >
                <UploadSimple size={14} className="text-slate-ink" />
                <span>ייבוא היסטוריה (JSON)</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
