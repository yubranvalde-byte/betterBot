import { CaretDown, ClockCounterClockwise, Key, Plus } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import type { NodeId, SessionData, ViewId } from '../../types/api';
import { getBestPrompt } from '../../utils/artifacts';
import { decodeHtmlEntities } from '../../utils/text';
import { MicroConduitConnector, type ConduitState } from '../OpticalConduit';
import { Tooltip } from '../Tooltip';

interface TopNavBarProps {
  activeView: ViewId;
  onSelectView: (view: ViewId) => void;
  currentSession: SessionData | null;
  sessionCount: number;
  isStreaming: boolean;
  activeStreamingNode: NodeId | null;
  isMasterMode: boolean;
  isBettyOpen: boolean;
  isHistoryOpen: boolean;
  notifications: Partial<Record<ViewId, 'info' | 'pass' | 'escalate'>>;
  onToggleHistory: () => void;
  onNewSession: () => void;
  onOpenSyncModal: () => void;
  onToggleBetty: () => void;
}

const NAV_TABS: Array<{ id: ViewId; num: string; label: string }> = [
  { id: 'view-interview', num: '01', label: 'אפיון' },
  { id: 'view-artifacts', num: '02', label: 'תוצרים' },
  { id: 'view-qa', num: '03', label: 'בקרת איכות' },
  { id: 'view-pipeline', num: '04', label: 'טופולוגיה' },
];

export function TopNavBar({
  activeView,
  onSelectView,
  currentSession,
  sessionCount,
  isStreaming,
  activeStreamingNode,
  isMasterMode,
  isBettyOpen,
  isHistoryOpen,
  notifications,
  onToggleHistory,
  onNewSession,
  onOpenSyncModal,
  onToggleBetty,
}: TopNavBarProps) {
  const rawTitle = currentSession?.title || 'סוכן חדש';
  const decodedTitle = decodeHtmlEntities(rawTitle);
  const qaCount = (currentSession?.state?.error_log || []).length;
  const status = currentSession?.status || 'idle';
  const isPassed = status === 'passed';
  const hasBlueprint = Boolean(currentSession?.raw_blueprint);
  const refFiles =
    currentSession?.reference_files || currentSession?.state?.reference_files || {};
  const hasPrompt = Boolean(
    getBestPrompt(currentSession).trim() || Object.keys(refFiles).length > 0,
  );
  const rubric = currentSession?.rubric_scores || currentSession?.state?.rubric_scores || {};
  const weightedPct = rubric.used_decision_model
    ? Math.round(Number(rubric.weighted_average || 0) * 100)
    : null;

  // Live Telemetry Conduit Pill label & tone
  const telemetryPill = (() => {
    if (isStreaming) {
      if (activeStreamingNode === 'node_1_helper') {
        return { text: 'HELPER · SPEC', tone: 'active' as const };
      }
      if (activeStreamingNode === 'node_2_construct') {
        return { text: 'NEON · COMPILING', tone: 'active' as const };
      }
      if (activeStreamingNode === 'node_3_upgrader') {
        return { text: 'UPGRADER · PATCHING', tone: 'amber' as const };
      }
      if (activeStreamingNode === 'node_4_adjudicator') {
        return { text: 'ADJUDICATOR · QA', tone: 'active' as const };
      }
      return { text: 'PIPELINE · RUNNING', tone: 'active' as const };
    }
    if (status === 'passed') {
      return {
        text: weightedPct !== null ? `DECISION-1 · PASS ${weightedPct}%` : 'GATE 2 · PASS',
        tone: 'emerald' as const,
      };
    }
    if (status === 'escalated') {
      return { text: 'GATE 2 · ESCALATE', tone: 'crimson' as const };
    }
    if (status === 'interviewing') {
      return { text: 'HELPER · INTERVIEW', tone: 'idle' as const };
    }
    return { text: 'HELPER · READY', tone: 'idle' as const };
  })();

  // Micro-conduit states connecting tabs 01 -> 02 -> 03 -> 04
  const conduitStates: ConduitState[] = [
    // 01 -> 02 (gentle ambient light pulse when idle/primed)
    isStreaming &&
    (activeStreamingNode === 'node_1_helper' || activeStreamingNode === 'node_2_construct')
      ? 'active'
      : hasBlueprint || hasPrompt
      ? 'completed'
      : 'ambient',
    // 02 -> 03
    isStreaming &&
    (activeStreamingNode === 'node_3_upgrader' || activeStreamingNode === 'node_4_adjudicator')
      ? 'active'
      : qaCount > 0
      ? 'completed'
      : 'idle',
    // 03 -> 04
    isStreaming ? 'active' : isPassed ? 'completed' : 'idle',
  ];

  return (
    <header className="sticky top-0 z-30 h-[58px] bg-white border-b border-[rgba(17,18,22,0.08)] shadow-[0_1px_2px_rgba(17,18,22,0.02)] px-4 lg:px-6 flex items-center justify-between gap-3">
      {/* Right (RTL start): Wordmark + Live Telemetry Conduit Pill + Session Selector */}
      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
        <span className="font-display text-xl font-bold tracking-[-0.025em] text-obsidian leading-none">
          CANON
        </span>

        {/* Live Telemetry Conduit Pill */}
        <div
          dir="ltr"
          className={`hidden xl:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono tracking-wide border whitespace-nowrap ${
            telemetryPill.tone === 'active'
              ? 'bg-surface border-hairline-strong text-obsidian prism-aura'
              : telemetryPill.tone === 'amber'
              ? 'bg-amber-tint border-amber/30 text-amber'
              : telemetryPill.tone === 'emerald'
              ? 'bg-emerald-tint border-emerald/30 text-emerald prism-aura'
              : telemetryPill.tone === 'crimson'
              ? 'bg-crimson-tint border-crimson/30 text-crimson'
              : 'bg-porcelain border-hairline text-slate-ink prism-aura'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              telemetryPill.tone === 'active'
                ? 'bg-gradient-to-tr from-prism-cyan via-prism-violet to-prism-peach animate-pulse'
                : telemetryPill.tone === 'amber'
                ? 'bg-amber animate-pulse'
                : telemetryPill.tone === 'emerald'
                ? 'bg-emerald'
                : telemetryPill.tone === 'crimson'
                ? 'bg-crimson'
                : 'bg-gradient-to-tr from-prism-cyan via-prism-violet to-prism-peach'
            }`}
            aria-hidden="true"
          />
          <span>{telemetryPill.text}</span>
        </div>

        <Tooltip content="בחירת סשן וספריית היסטוריית יצירות" placement="bottom">
          <button
            type="button"
            onClick={onToggleHistory}
            aria-haspopup="dialog"
            aria-expanded={isHistoryOpen}
            className={`prism-interactive h-8 rounded-md border px-2.5 text-xs inline-flex items-center gap-2 max-w-[180px] xl:max-w-[230px] cursor-pointer ${
              isHistoryOpen
                ? 'border-obsidian bg-surface text-obsidian shadow-xs'
                : 'border-hairline bg-surface hover:bg-porcelain text-ink'
            }`}
          >
            <ClockCounterClockwise size={14} className="text-slate-ink shrink-0" />
            <span className="truncate font-medium">{decodedTitle}</span>
            <span className="font-mono text-[11px] tabular-nums bg-surface border border-hairline px-1.5 rounded-sm text-slate-ink shrink-0">
              {sessionCount}
            </span>
            <CaretDown size={12} className="text-muted shrink-0" />
          </button>
        </Tooltip>
      </div>

      {/* Center: 4 Numbered Workflow Tabs Linked by Micro-Conduits */}
      <nav
        aria-label="ניווט חלונות עבודה"
        className="flex items-stretch h-full overflow-x-auto no-scrollbar gap-0.5 sm:gap-1"
      >
        {NAV_TABS.map((tab, idx) => {
          const isActive = activeView === tab.id;
          const notifyTone = notifications[tab.id];

          return (
            <div key={tab.id} className="flex items-stretch shrink-0">
              <button
                type="button"
                onClick={() => onSelectView(tab.id)}
                className={`relative h-full px-2 sm:px-2.5 inline-flex items-center gap-1.5 text-sm whitespace-nowrap shrink-0 canon-transition cursor-pointer ${
                  isActive
                    ? 'text-obsidian font-semibold'
                    : 'text-slate-ink hover:text-obsidian font-normal'
                }`}
              >
                <span className="font-mono text-[11px] tabular-nums text-muted" dir="ltr">
                  {tab.num}
                </span>
                <span className="font-mono text-[11px] text-muted" aria-hidden="true">
                  /
                </span>
                <span>{tab.label}</span>

                {tab.id === 'view-artifacts' && isPassed && (
                  <Tooltip content="PASS — מאושר" placement="bottom">
                    <span className="w-2 h-2 rounded-full bg-emerald shrink-0" />
                  </Tooltip>
                )}

                {tab.id === 'view-artifacts' && !isPassed && notifyTone && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      notifyTone === 'pass'
                        ? 'bg-emerald'
                        : notifyTone === 'escalate'
                        ? 'bg-crimson'
                        : 'bg-prism-violet'
                    }`}
                  />
                )}

                {tab.id === 'view-qa' && (
                  <span className="font-mono text-[11px] tabular-nums text-slate-ink bg-recessed border border-hairline px-1.5 rounded-sm">
                    {qaCount}
                  </span>
                )}

                {tab.id === 'view-pipeline' && isStreaming && (
                  <span className="w-1.5 h-1.5 rounded-full bg-prism-violet animate-pulse shrink-0" />
                )}

                {isActive && (
                  <motion.span
                    layoutId="activeTabIndicator"
                    transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                    className="absolute inset-x-1 bottom-0 h-[2px] bg-obsidian rounded-full"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 -top-1 rounded-full bg-gradient-to-r from-prism-cyan via-prism-violet to-prism-peach blur-[8px] opacity-35"
                    />
                  </motion.span>
                )}
              </button>

              {idx < NAV_TABS.length - 1 && (
                <MicroConduitConnector state={conduitStates[idx]} />
              )}
            </div>
          );
        })}
      </nav>

      {/* Left (RTL end): Obsidian +New Agent, MASTER/Sync, Betty */}
      <div className="flex items-center gap-2 shrink-0">
        <Tooltip content="פתח סשן חדש" placement="bottom">
          <button
            type="button"
            onClick={onNewSession}
            disabled={isStreaming}
            className="btn-obsidian h-8 rounded-md px-3.5 text-xs lg:text-sm font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus size={14} weight="bold" />
            <span>סוכן חדש</span>
          </button>
        </Tooltip>

        <Tooltip content="סנכרון מרחב עבודה, מפתח Master וגיבוי JSON" placement="bottom">
          <button
            type="button"
            onClick={onOpenSyncModal}
            className="prism-interactive h-8 rounded-md border border-hairline bg-surface px-2.5 font-mono text-xs text-ink inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            {isMasterMode && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald shrink-0" aria-hidden="true" />
            )}
            <Key size={13} className="text-slate-ink shrink-0" />
            <span>{isMasterMode ? 'MASTER' : 'סנכרון'}</span>
          </button>
        </Tooltip>

        <Tooltip content="פתח / סגור את בטי — יועצת AI ותמיכה טכנית" placement="bottom">
          <button
            type="button"
            onClick={onToggleBetty}
            aria-expanded={isBettyOpen}
            className={`prism-interactive h-8 rounded-md border px-2.5 text-xs lg:text-sm inline-flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              isBettyOpen
                ? 'border-obsidian bg-recessed text-obsidian font-medium prism-aura'
                : 'border-hairline bg-surface text-ink'
            }`}
          >
            <span
              aria-hidden="true"
              className="w-1.5 h-1.5 rounded-full bg-gradient-to-tr from-prism-cyan via-prism-violet to-prism-peach shrink-0"
            />
            <span>בטי • יועצת</span>
          </button>
        </Tooltip>
      </div>
    </header>
  );
}
