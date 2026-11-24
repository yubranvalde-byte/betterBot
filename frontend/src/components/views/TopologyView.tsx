import { useMemo, useState } from 'react';
import {
  ArrowSquareOut,
  ChatCircleText,
  CheckCircle,
  Code,
  Funnel,
  MagnifyingGlass,
  PencilSimple,
  ShieldCheck,
  X,
} from '@phosphor-icons/react';
import type {
  ArtifactTab,
  HealthRoutingNode,
  NodeId,
  SessionData,
  TimelineItem,
  ViewId,
} from '../../types/api';

const EMPTY_TIMELINE: TimelineItem[] = [];
import { getBestPrompt } from '../../utils/artifacts';
import { formatModelBadgeText, stripDecorativeEmojis } from '../../utils/text';
import {
  HillClimbingFeedbackConduit,
  HorizontalConduitSegment,
  type ConduitState,
} from '../OpticalConduit';
import { Tooltip } from '../Tooltip';

interface TopologyViewProps {
  session: SessionData | null;
  activeStreamingNode: NodeId | null;
  healthRouting: Record<string, HealthRoutingNode> | null;
  onNavigateView: (view: ViewId, artifactTab?: ArtifactTab) => void;
}

const NODE_DEFS: Array<{
  id: NodeId;
  phase: string;
  title: string;
  role: string;
  Icon: typeof ChatCircleText;
  iconTint: string;
  activeIconTint: string;
  topAccentHover: string;
  topAccentActive: string;
  dotColor: string;
}> = [
  {
    id: 'node_1_helper',
    phase: 'Phase 1 · Spec',
    title: 'The Helper',
    role: 'ארכיטקט דרישות וראיון',
    Icon: ChatCircleText,
    iconTint: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
    activeIconTint: 'bg-sky-500/15 text-sky-600 border-sky-500/40',
    topAccentHover: 'hover:border-t-2 hover:border-t-sky-500',
    topAccentActive: 'border-t-2 border-t-sky-500',
    dotColor: 'bg-sky-500',
  },
  {
    id: 'node_2_construct',
    phase: 'Phase 2 · Compile',
    title: 'The Construct',
    role: 'מהדר הפרומפטים',
    Icon: Code,
    iconTint: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    activeIconTint: 'bg-indigo-500/15 text-indigo-600 border-indigo-500/40',
    topAccentHover: 'hover:border-t-2 hover:border-t-indigo-500',
    topAccentActive: 'border-t-2 border-t-indigo-500',
    dotColor: 'bg-indigo-500',
  },
  {
    id: 'node_4_adjudicator',
    phase: 'Phase 3 · QA Gate',
    title: 'The Adjudicator',
    role: 'בקרת איכות ורגרסיה',
    Icon: ShieldCheck,
    iconTint: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    activeIconTint: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/40',
    topAccentHover: 'hover:border-t-2 hover:border-t-emerald-500',
    topAccentActive: 'border-t-2 border-t-emerald-500',
    dotColor: 'bg-emerald-500',
  },
  {
    id: 'node_3_upgrader',
    phase: 'Loop · Upgrader',
    title: 'The Upgrader',
    role: 'עורך אטומי ומשדרג',
    Icon: PencilSimple,
    iconTint: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    activeIconTint: 'bg-amber-500/15 text-amber-600 border-amber-500/40',
    topAccentHover: 'hover:border-t-2 hover:border-t-amber-500',
    topAccentActive: 'border-t-2 border-t-amber-500',
    dotColor: 'bg-amber-500',
  },
];

export function TopologyView({
  session,
  activeStreamingNode,
  healthRouting,
  onNavigateView,
}: TopologyViewProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedNodeFilter, setSelectedNodeFilter] = useState<NodeId | null>(null);

  const state = session?.state;
  const iter = state?.iteration_count || 0;
  const status = session?.status || 'idle';
  const activeNodeId = activeStreamingNode || session?.active_node || null;
  const hasBlueprint = Boolean(session?.raw_blueprint);
  const refFiles = session?.reference_files || state?.reference_files || {};
  const hasPrompt = Boolean(
    getBestPrompt(session).trim() || Object.keys(refFiles).length > 0,
  );
  const telemetry = session?.model_telemetry || state?.model_telemetry || {};
  const timeline = session?.timeline ?? EMPTY_TIMELINE;

  const filteredTimeline = useMemo(() => {
    const reversed = timeline.slice().reverse();
    const byNode = selectedNodeFilter
      ? reversed.filter((item) => item.node === selectedNodeFilter)
      : reversed;
    const q = filterQuery.trim().toLowerCase();
    if (!q) return byNode;
    return byNode.filter((item) => {
      const hay = `${item.title || ''} ${item.detail || ''} ${item.timestamp || ''} ${
        item.model || ''
      }`.toLowerCase();
      return hay.includes(q);
    });
  }, [timeline, filterQuery, selectedNodeFilter]);

  const getNodeVisualState = (nid: NodeId) => {
    if (activeNodeId === nid) {
      return {
        kind: 'active' as const,
        badge: 'פעיל כעת...',
      };
    }
    if (nid === 'node_1_helper') {
      if (hasBlueprint) return { kind: 'completed' as const, badge: 'הופק XML' };
      if (status === 'interviewing') return { kind: 'waiting' as const, badge: 'מראיין' };
      return { kind: 'waiting' as const, badge: 'המתנה' };
    }
    if (nid === 'node_2_construct') {
      if (hasPrompt) return { kind: 'completed' as const, badge: 'הודר' };
      return { kind: 'waiting' as const, badge: 'המתנה' };
    }
    if (nid === 'node_3_upgrader') {
      if (iter > 1) return { kind: 'completed' as const, badge: `שודרג (${iter - 1})` };
      return { kind: 'waiting' as const, badge: 'מוכן' };
    }
    if (status === 'passed') return { kind: 'completed' as const, badge: 'PASS' };
    if (status === 'escalated') return { kind: 'escalated' as const, badge: 'ESCALATE' };
    if (iter > 0) return { kind: 'warning' as const, badge: `בבדיקה (${iter})` };
    return { kind: 'waiting' as const, badge: 'המתנה' };
  };

  const openNodeWorkspace = (nid: NodeId) => {
    if (nid === 'node_1_helper') onNavigateView('view-interview');
    else if (nid === 'node_2_construct') onNavigateView('view-artifacts', 'blueprint');
    else if (nid === 'node_4_adjudicator') onNavigateView('view-qa');
    else onNavigateView('view-artifacts', 'prompt');
  };

  // Alive-at-idle conduit states: Gate 1 (Helper -> Construct) pulses serenely when primed
  const conduit12State: ConduitState =
    activeNodeId === 'node_1_helper' || activeNodeId === 'node_2_construct'
      ? 'active'
      : hasBlueprint || hasPrompt
      ? 'completed'
      : 'ambient';

  const conduit24State: ConduitState =
    activeNodeId === 'node_2_construct' ||
    activeNodeId === 'gate_1_5_linter' ||
    activeNodeId === 'node_4_adjudicator'
      ? 'active'
      : hasPrompt && (status === 'passed' || iter > 0)
      ? 'completed'
      : 'idle';

  const conduit43State: ConduitState =
    activeNodeId === 'node_3_upgrader'
      ? 'amber'
      : iter > 1 || status === 'escalated'
      ? 'amber'
      : status === 'passed' && iter > 0
      ? 'completed'
      : 'idle';

  const hillClimbLoopState: ConduitState =
    activeNodeId === 'node_3_upgrader' ||
    (activeNodeId === 'node_4_adjudicator' && iter > 0) ||
    status === 'escalated' ||
    iter > 1
      ? 'amber'
      : status === 'passed' && iter > 0
      ? 'completed'
      : 'idle';

  const selectedNodeTitle =
    NODE_DEFS.find((n) => n.id === selectedNodeFilter)?.title || '';

  return (
    <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-8 relative z-10">
      <div className="max-w-[1320px] mx-auto space-y-6">
        {/* Optical Conduit Workbench */}
        <section className="card-porcelain rounded-[14px] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-hairline">
            <div>
              <div
                dir="ltr"
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-1"
              >
                OPTICAL CONDUIT WORKBENCH · PHASE 04
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-2xl font-bold tracking-[-0.025em] text-obsidian">
                  טופולוגיית הסוכנים
                </h1>
                <span
                  dir="ltr"
                  className="font-mono text-xs px-2.5 py-1 rounded-md bg-recessed text-slate-ink border border-hairline"
                >
                  LangGraph StateGraph
                </span>
              </div>
              <p className="text-xs text-slate-ink mt-1.5">
                לחץ על כרטיס סוכן כדי לסנן את יומן הטלמטריה שלו, או פתח ישירות את חלון העבודה שלו
              </p>
            </div>

            {/* Circuit Breaker & Iteration Indicator */}
            <div className="flex items-center gap-2.5 border border-hairline bg-porcelain px-3.5 py-2 rounded-md">
              <span className="text-xs text-slate-ink">איטרציות</span>
              <span
                dir="ltr"
                className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-white border border-hairline text-muted"
              >
                Circuit Breaker
              </span>
              <div className="flex items-center gap-1" dir="ltr">
                {[1, 2].map((step) => {
                  const used = step <= iter;
                  const tripped = status === 'escalated' && used;
                  return (
                    <span
                      key={step}
                      className={`h-1.5 w-5 rounded-full ${
                        tripped
                          ? 'bg-crimson'
                          : used
                          ? 'bg-emerald'
                          : 'bg-hairline-strong'
                      }`}
                    />
                  );
                })}
              </div>
              <span
                className="font-mono text-xs tabular-nums font-semibold text-obsidian"
                dir="ltr"
              >
                {iter}/2
              </span>
            </div>
          </div>

          {/* 4-Node Horizontal Optical Conduit Pipeline (Overflow-Safe When Betty Docked) */}
          <div className="mt-6 overflow-x-auto pb-2">
            <div
              dir="ltr"
              className="min-w-[860px] grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] gap-y-2 gap-x-0 items-stretch"
            >
              {NODE_DEFS.map((node, index) => {
                const Icon = node.Icon;
                const vis = getNodeVisualState(node.id);
                const nodeInfo = telemetry[node.id] || healthRouting?.[node.id] || null;
                const modelLabel = formatModelBadgeText(nodeInfo);
                const isSelectedFilter = selectedNodeFilter === node.id;
                const isActive = vis.kind === 'active';

                const cardClasses = isActive
                  ? `bg-white border-hairline-strong prism-aura shadow-sm ${node.topAccentActive}`
                  : isSelectedFilter
                  ? `bg-white border-2 border-obsidian shadow-xs ${node.topAccentActive}`
                  : vis.kind === 'completed'
                  ? `bg-white border border-[rgba(17,18,22,0.08)] hover:border-hairline-strong ${node.topAccentHover}`
                  : vis.kind === 'escalated'
                  ? 'bg-white border border-crimson/50'
                  : vis.kind === 'warning'
                  ? 'bg-white border border-amber/50'
                  : `bg-white border border-[rgba(17,18,22,0.08)] text-slate-ink hover:border-hairline-strong ${node.topAccentHover}`;

                const segmentState =
                  index === 0 ? conduit12State : index === 1 ? conduit24State : conduit43State;
                const segmentLabel =
                  index === 0
                    ? '<ARTIFACT_BLUEPRINT>'
                    : index === 1
                    ? activeNodeId === 'gate_1_5_linter'
                      ? 'Gate 1.5 Linter'
                      : 'Challenger'
                    : 'Gate 2';

                return (
                  <div key={node.id} className="contents">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setSelectedNodeFilter((prev) => (prev === node.id ? null : node.id))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedNodeFilter((prev) => (prev === node.id ? null : node.id));
                        }
                      }}
                      className={`text-left rounded-md p-4 flex flex-col justify-between gap-3 canon-transition cursor-pointer min-w-0 overflow-hidden ${cardClasses}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted truncate">
                            {node.phase}
                          </span>
                          {isActive ? (
                            <span
                              className={`w-2 h-2 rounded-full ${node.dotColor} animate-pulse shrink-0`}
                            />
                          ) : vis.kind === 'completed' ? (
                            <CheckCircle size={14} weight="fill" className="text-emerald shrink-0" />
                          ) : null}
                        </div>

                        <div className="flex items-start gap-2.5 min-w-0">
                          <span
                            className={`p-1.5 rounded-md border shrink-0 ${
                              isActive ? node.activeIconTint : node.iconTint
                            }`}
                          >
                            <Icon size={16} weight="duotone" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-display text-sm font-semibold text-obsidian truncate">
                              {node.title}
                            </div>
                            <div dir="rtl" className="text-xs text-slate-ink mt-0.5 text-right truncate">
                              {node.role}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-1 min-w-0">
                        {modelLabel && (
                          <div className="max-w-full">
                            <Tooltip content={modelLabel} dir="ltr" className="max-w-full inline-flex">
                              <span
                                className={`max-w-full inline-flex items-center px-2.5 py-1 rounded-sm border font-mono text-[11px] leading-none overflow-hidden ${
                                  nodeInfo && 'fallback_used' in nodeInfo && nodeInfo.fallback_used
                                    ? 'bg-amber-tint border-amber/30 text-amber'
                                    : 'bg-porcelain border-hairline text-obsidian'
                                }`}
                              >
                                <span className="truncate">{modelLabel}</span>
                              </span>
                            </Tooltip>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-0.5 min-w-0">
                          <span
                            dir="rtl"
                            className={`font-mono text-[11px] px-2 py-0.5 rounded-sm border truncate ${
                              isActive
                                ? 'bg-white border-obsidian text-obsidian font-medium'
                                : vis.kind === 'completed'
                                ? 'bg-emerald-tint border-emerald/30 text-emerald font-medium'
                                : vis.kind === 'escalated'
                                ? 'bg-crimson-tint border-crimson/30 text-crimson font-medium'
                                : vis.kind === 'warning'
                                ? 'bg-amber-tint border-amber/30 text-amber font-medium'
                                : 'bg-porcelain border-hairline text-muted'
                            }`}
                          >
                            {vis.badge}
                          </span>

                          <Tooltip content="עבור לחלון העבודה של סוכן זה" placement="top">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openNodeWorkspace(node.id);
                              }}
                              className="font-mono text-[10px] text-slate-ink hover:text-obsidian inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm hover:bg-hover canon-transition cursor-pointer shrink-0"
                            >
                              <span>פתח</span>
                              <ArrowSquareOut size={11} />
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    </div>

                    {index < NODE_DEFS.length - 1 && (
                      <HorizontalConduitSegment
                        state={segmentState}
                        label={segmentLabel}
                        bidirectional={index === 2}
                      />
                    )}
                  </div>
                );
              })}

              {/* Sweeping Lower Curved Hill-Climbing Feedback Conduit (Docked under Adjudicator <-> Upgrader) */}
              <div className="col-start-5 col-span-3">
                <HillClimbingFeedbackConduit
                  state={hillClimbLoopState}
                  label="Hill Climbing Loop"
                  iterationCount={iter}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Live Chronological Telemetry Log */}
        <section className="card-porcelain rounded-[14px] overflow-hidden">
          <div className="px-6 py-4 border-b border-hairline flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-lg font-bold tracking-[-0.02em] text-obsidian">
                  יומן ריצה וטלמטריה חי
                </h2>
                {selectedNodeFilter && (
                  <button
                    type="button"
                    onClick={() => setSelectedNodeFilter(null)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-obsidian bg-recessed px-2.5 py-0.5 text-[11px] font-mono text-obsidian cursor-pointer"
                  >
                    <Funnel size={11} />
                    <span>{selectedNodeTitle}</span>
                    <X size={11} />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-ink mt-0.5">
                תיעוד כרונולוגי של מעברי הסוכנים, ההידורים ובדיקות ה-QA בסשן
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <MagnifyingGlass
                size={14}
                className="text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                type="search"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="סנן אירועים ביומן..."
                className="w-full h-9 rounded-md border border-hairline-strong bg-porcelain pr-8 pl-8 text-xs text-ink placeholder:text-muted focus:border-obsidian focus:bg-surface focus:outline-none"
              />
              {filterQuery && (
                <button
                  type="button"
                  onClick={() => setFilterQuery('')}
                  aria-label="נקה חיפוש"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-obsidian cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {filteredTimeline.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-ink">
              {filterQuery || selectedNodeFilter ? (
                <div className="space-y-3">
                  <p>
                    {filterQuery
                      ? `לא נמצאו אירועים עבור "${filterQuery}".`
                      : `לא נמצאו אירועים עבור ${selectedNodeTitle}.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterQuery('');
                      setSelectedNodeFilter(null);
                    }}
                    className="rounded-md border border-hairline bg-porcelain hover:bg-hover px-3 py-1.5 text-xs text-obsidian cursor-pointer"
                  >
                    נקה סינון
                  </button>
                </div>
              ) : (
                'טרם נרשמו אירועים ביומן הסשן.'
              )}
            </div>
          ) : (
            <div className="divide-y divide-hairline">
              {filteredTimeline.map((item) => {
                const statusBadgeCls =
                  item.status === 'success'
                    ? 'bg-emerald-tint text-emerald border-emerald/30'
                    : item.status === 'warning'
                    ? 'bg-amber-tint text-amber border-amber/30'
                    : item.status === 'danger'
                    ? 'bg-crimson-tint text-crimson border-crimson/30'
                    : 'bg-recessed text-slate-ink border-hairline';

                const modelLabel = item.model ? formatModelBadgeText(item) : '';

                return (
                  <div
                    key={item.id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-start gap-3"
                  >
                    <div className="flex items-center gap-2.5 shrink-0 sm:w-44">
                      <span
                        dir="ltr"
                        className="font-mono text-xs tabular-nums text-muted"
                      >
                        {item.timestamp}
                      </span>
                      <span
                        dir="ltr"
                        className={`font-mono text-[10px] uppercase px-1.5 py-0.5 rounded-sm border ${statusBadgeCls}`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span dir="auto" className="text-sm font-medium text-obsidian">
                          {stripDecorativeEmojis(item.title)}
                        </span>
                        {modelLabel && (
                          <span
                            dir="ltr"
                            className={`whitespace-nowrap font-mono text-[11px] px-2 py-0.5 rounded-sm border ${
                              item.fallback_used
                                ? 'bg-amber-tint border-amber/30 text-amber'
                                : 'bg-porcelain border-hairline text-slate-ink'
                            }`}
                          >
                            {modelLabel}
                          </span>
                        )}
                        {item.latency_ms !== undefined && (
                          <span
                            dir="ltr"
                            className="font-mono text-[11px] tabular-nums text-muted"
                          >
                            {Math.round(item.latency_ms)}ms
                          </span>
                        )}
                      </div>
                      {item.detail && (
                        <p dir="auto" className="text-xs text-slate-ink mt-1 leading-relaxed">
                          {stripDecorativeEmojis(item.detail)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
