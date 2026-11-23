import { ArrowLeft, CircleNotch, X } from '@phosphor-icons/react';
import { formatElapsedSeconds } from '../../utils/text';

export interface ExecutionBannerState {
  visible: boolean;
  isStreaming: boolean;
  nodeTitle: string;
  stageLabel: string;
  description: string;
  elapsedSeconds: number;
  tone: 'neutral' | 'pass' | 'escalate';
  ctaLabel?: string;
  onCtaClick?: () => void;
}

interface ExecutionBarProps {
  banner: ExecutionBannerState;
  onStop: () => void;
  onDismiss: () => void;
}

export function ExecutionBar({ banner, onStop, onDismiss }: ExecutionBarProps) {
  if (!banner.visible) return null;

  const toneStyle =
    banner.tone === 'pass'
      ? 'bg-emerald-tint border-emerald/30'
      : banner.tone === 'escalate'
      ? 'bg-crimson-tint border-crimson/30'
      : banner.isStreaming
      ? 'bg-surface border-hairline-strong prism-aura'
      : 'bg-recessed/70 border-hairline';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`border-b px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs canon-transition ${toneStyle}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {banner.isStreaming && (
          <CircleNotch size={15} className="animate-spin text-obsidian shrink-0" />
        )}
        <strong className="font-mono text-obsidian shrink-0" dir="ltr">
          {banner.nodeTitle}
        </strong>
        <span className="font-mono text-[11px] px-2 py-0.5 rounded-sm border border-hairline bg-surface text-slate-ink shrink-0 tabular-nums">
          {banner.stageLabel}
        </span>
        <span className="text-slate-ink truncate">{banner.description}</span>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <span className="font-mono text-[11px] tabular-nums text-muted" dir="ltr">
          {formatElapsedSeconds(banner.elapsedSeconds)}
        </span>

        {banner.isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="rounded-sm border border-crimson/40 bg-crimson-tint px-2.5 py-1 text-xs font-medium text-crimson hover:bg-crimson hover:text-white canon-transition cursor-pointer"
          >
            עצור הרצה
          </button>
        ) : (
          <>
            {banner.ctaLabel && banner.onCtaClick && (
              <button
                type="button"
                onClick={banner.onCtaClick}
                className="btn-obsidian rounded-sm px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>{banner.ctaLabel.replace(/\s*←$/, '')}</span>
                <ArrowLeft size={12} />
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              aria-label="סגור הודעת סטטוס"
              className="p-1 text-slate-ink hover:text-obsidian rounded-sm hover:bg-hover canon-transition cursor-pointer"
            >
              <X size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
