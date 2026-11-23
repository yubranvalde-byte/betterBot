import { useMemo, useState } from 'react';
import {
  CheckCircle,
  GitDiff,
  Lightning,
  PaperPlaneTilt,
  PencilSimple,
  ShieldCheck,
  Warning,
  XCircle,
} from '@phosphor-icons/react';
import type { DiffMode, SessionData } from '../../types/api';
import { buildUnifiedDiff, renderDiffHtml } from '../../utils/diff';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { GlassGaugeTube } from '../OpticalConduit';

interface QaViewProps {
  session: SessionData | null;
  diffMode: DiffMode;
  onChangeDiffMode: (mode: DiffMode) => void;
  isStreaming: boolean;
  onRunUpgrader: (directive: string) => void;
}

interface ParsedQaEntry {
  kind: 'PASS' | 'FAIL' | 'ESCALATE' | 'OVERRIDE' | 'INFO';
  badgeLabel: string;
  body: string;
}

function parseQaEntry(raw: string): ParsedQaEntry {
  const trimmed = (raw || '').trim();
  if (trimmed.startsWith('[MANUAL OVERRIDE]')) {
    return {
      kind: 'OVERRIDE',
      badgeLabel: 'MANUAL OVERRIDE',
      body: trimmed.slice('[MANUAL OVERRIDE]'.length).trim(),
    };
  }
  if (trimmed.startsWith('[PASS]')) {
    return {
      kind: 'PASS',
      badgeLabel: 'PASS',
      body: trimmed.slice('[PASS]'.length).trim(),
    };
  }
  if (trimmed.startsWith('[FAIL]')) {
    return {
      kind: 'FAIL',
      badgeLabel: 'FAIL',
      body: trimmed.slice('[FAIL]'.length).trim(),
    };
  }
  if (trimmed.startsWith('[ESCALATE]')) {
    return {
      kind: 'ESCALATE',
      badgeLabel: 'ESCALATE',
      body: trimmed.slice('[ESCALATE]'.length).trim(),
    };
  }
  if (trimmed.includes('[PASS]')) {
    return { kind: 'PASS', badgeLabel: 'PASS', body: trimmed };
  }
  if (trimmed.includes('[ESCALATE]')) {
    return { kind: 'ESCALATE', badgeLabel: 'ESCALATE', body: trimmed };
  }
  if (trimmed.includes('[FAIL]')) {
    return { kind: 'FAIL', badgeLabel: 'FAIL', body: trimmed };
  }
  return { kind: 'INFO', badgeLabel: 'AUDIT', body: trimmed };
}

export function QaView({
  session,
  diffMode,
  onChangeDiffMode,
  isStreaming,
  onRunUpgrader,
}: QaViewProps) {
  const [qaInput, setQaInput] = useState('');

  const state = session?.state;
  const logs = state?.error_log || [];
  const iterationCount = state?.iteration_count || 0;
  const status = session?.status || 'idle';
  const rubric = session?.rubric_scores || state?.rubric_scores || {};
  const telemetry = session?.model_telemetry || state?.model_telemetry || {};
  const adjTel = telemetry.node_4_adjudicator;

  const championText = session?.clean_champion_prompt || '';
  const challengerText = session?.clean_challenger_prompt || '';

  const diffBundle = useMemo(
    () => buildUnifiedDiff(championText, challengerText, 'Champion', 'Challenger'),
    [championText, challengerText],
  );

  const diffHtml = useMemo(
    () => renderDiffHtml(diffBundle.unifiedDiff, diffMode),
    [diffBundle.unifiedDiff, diffMode],
  );

  const dims = useMemo(() => {
    const base = [
      { key: 'trigger_precision', label: 'Trigger Precision', isSuite: false },
      { key: 'token_density_no_bloat', label: 'Token Density', isSuite: false },
      { key: 'intent_alignment', label: 'Intent Alignment', isSuite: false },
      { key: 'output_contract_strength', label: 'Output Contract', isSuite: false },
      { key: 'actionable_clarity', label: 'Actionable Clarity', isSuite: false },
      { key: 'progressive_disclosure', label: 'Progressive Disclosure', isSuite: false },
    ] as const;

    const list: Array<{ key: keyof typeof rubric; label: string; isSuite: boolean }> = [
      ...base,
    ];
    if (rubric.trigger_deconfliction !== undefined && rubric.trigger_deconfliction !== null) {
      list.push({
        key: 'trigger_deconfliction',
        label: 'Trigger De-confliction',
        isSuite: true,
      });
    }
    return list;
  }, [rubric.trigger_deconfliction]);

  const weightedPct = Math.round(Number(rubric.weighted_average || 0) * 100);
  const beatsChamp = Number(rubric.challenger_beats_champion ?? 1);

  const gateVerdict = (() => {
    const lastEntry = logs[logs.length - 1] || '';
    const fastPath = adjTel?.fast_path;
    if (status === 'passed' || lastEntry.includes('[PASS]')) {
      if (fastPath === 'post_override_pass') {
        return { label: 'Gate 2 Post-override PASS', tone: 'emerald' as const };
      }
      if (fastPath === 'fast_pass') {
        return { label: 'Gate 2 Fast PASS', tone: 'emerald' as const };
      }
      return { label: 'Adjudicator PASS', tone: 'emerald' as const };
    }
    if (status === 'escalated' || lastEntry.includes('[ESCALATE]')) {
      return {
        label: fastPath === 'plateau_escalate' ? 'Gate 2 Plateau ESCALATE' : 'Gate 2 ESCALATE',
        tone: 'crimson' as const,
      };
    }
    if (lastEntry.includes('[FAIL]')) {
      return { label: 'Adjudicator FAIL', tone: 'crimson' as const };
    }
    return { label: 'Pending QA Gate', tone: 'slate' as const };
  })();

  const canUpgradeFromQa = status === 'escalated' || iterationCount > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = qaInput.trim();
    if (!cleaned || isStreaming) return;
    setQaInput('');
    onRunUpgrader(cleaned);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-porcelain/60 relative z-10">
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header & Score Summary Card */}
          <section className="card-porcelain rounded-[14px] p-6">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <div
                  dir="ltr"
                  className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-1.5"
                >
                  AUDIT DOSSIER · PHASE 03
                </div>
                <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-[-0.025em] text-obsidian">
                  בקרת איכות והשוואת גרסאות
                </h1>
                <p className="text-sm text-slate-ink mt-1">
                  תיק ביקורת כמותית של{' '}
                  <code dir="ltr" className="font-mono text-xs bg-recessed px-1.5 py-0.5 rounded-sm">
                    The Adjudicator
                  </code>{' '}
                  והשוואת{' '}
                  <code dir="ltr" className="font-mono text-xs bg-recessed px-1.5 py-0.5 rounded-sm">
                    Champion
                  </code>{' '}
                  מול{' '}
                  <code dir="ltr" className="font-mono text-xs bg-recessed px-1.5 py-0.5 rounded-sm">
                    Challenger
                  </code>
                </p>
              </div>

              {rubric.used_decision_model && (
                <div className="flex flex-wrap items-stretch gap-6 border-t sm:border-t-0 sm:border-r border-hairline pt-4 sm:pt-0 sm:pr-6">
                  {/* Disambiguated Weighted Rubric Score */}
                  <div>
                    <div className="text-xs font-medium text-slate-ink mb-1">
                      ציון רובריקה משוקלל
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-5xl font-bold tracking-[-0.03em] tabular-nums text-obsidian leading-none">
                        {weightedPct}%
                      </span>
                      <span dir="ltr" className="font-mono text-[11px] text-muted">
                        ({dims.length}D)
                      </span>
                    </div>
                  </div>

                  {/* Disambiguated Gate 2 Verdict */}
                  <div className="flex flex-col justify-between">
                    <div className="text-xs font-medium text-slate-ink mb-1.5">
                      החלטת שער (Gate 2)
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        dir="ltr"
                        className={`font-mono text-xs font-medium px-2.5 py-1 rounded-sm border ${
                          gateVerdict.tone === 'emerald'
                            ? 'bg-emerald-tint text-emerald border-emerald/35'
                            : gateVerdict.tone === 'crimson'
                            ? 'bg-crimson-tint text-crimson border-crimson/35'
                            : 'bg-recessed text-slate-ink border-hairline'
                        }`}
                      >
                        {gateVerdict.label}
                      </span>

                      {iterationCount > 1 && (
                        <span
                          dir="ltr"
                          className={`font-mono text-xs font-medium px-2.5 py-1 rounded-sm border ${
                            beatsChamp >= 0.5
                              ? 'bg-emerald-tint text-emerald border-emerald/35'
                              : 'bg-amber-tint text-amber border-amber/35'
                          }`}
                        >
                          {beatsChamp >= 0.5 ? 'Challenger > Champion' : 'No Improvement'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 6/7-Dimension Rubric Table with Borosilicate Glass Gauge Tubes */}
            {rubric.used_decision_model && (
              <div className="mt-6 border-t border-hairline pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                  {dims.map((dim) => {
                    const rawVal = Number(rubric[dim.key] ?? 0);
                    const pct = Math.max(0, Math.min(100, Math.round((rawVal / 5.0) * 100)));
                    const gaugeVariant =
                      rawVal >= 4.0
                        ? 'emerald'
                        : rawVal < 3.8
                        ? 'crimson'
                        : 'amber';
                    return (
                      <div key={dim.key} className="border-b border-hairline py-3.5">
                        <div
                          dir="ltr"
                          className="flex items-center justify-between gap-2 mb-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-medium text-obsidian">{dim.label}</span>
                            {dim.isSuite && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm border border-hairline bg-recessed text-obsidian">
                                SKILL_SUITE
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-xs tabular-nums text-obsidian shrink-0">
                            {rawVal.toFixed(1)} / 5
                          </span>
                        </div>
                        <GlassGaugeTube percent={pct} variant={gaugeVariant} height="sm" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* QA History & Manual Override Audit Log */}
          <section className="card-porcelain rounded-[14px] overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={17} className="text-obsidian" />
                <h2 className="font-display text-lg font-bold tracking-[-0.02em] text-obsidian">
                  יומן ביקורות והנחיות ידניות
                </h2>
              </div>
              <span className="font-mono text-xs tabular-nums text-slate-ink bg-recessed border border-hairline px-2 py-0.5 rounded-sm">
                {logs.length} רשומות
              </span>
            </div>

            {logs.length === 0 ? (
              <div className="border-t border-hairline px-6 py-12 text-center">
                <ShieldCheck size={32} className="mx-auto text-muted mb-2.5" />
                <h3 className="font-display text-lg font-bold text-obsidian">
                  טרם בוצעו סבבי QA
                </h3>
                <p className="text-sm text-slate-ink mt-1 max-w-md mx-auto">
                  ברגע שיופק פרומפט ראשוני, ה-Adjudicator יבצע ביקורת איכות קפדנית ויציג כאן את
                  הממצאים.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-hairline border-t border-hairline">
                {logs.map((entry, idx) => {
                  const parsed = parseQaEntry(entry);
                  const pillClass =
                    parsed.kind === 'PASS'
                      ? 'bg-emerald-tint text-emerald border-emerald/30'
                      : parsed.kind === 'FAIL' || parsed.kind === 'ESCALATE'
                      ? 'bg-crimson-tint text-crimson border-crimson/30'
                      : parsed.kind === 'OVERRIDE'
                      ? 'bg-amber-tint text-amber border-amber/30'
                      : 'bg-recessed text-slate-ink border-hairline';

                  const PillIcon =
                    parsed.kind === 'PASS'
                      ? CheckCircle
                      : parsed.kind === 'OVERRIDE'
                      ? Lightning
                      : parsed.kind === 'FAIL'
                      ? XCircle
                      : Warning;

                  return (
                    <div key={idx} className="p-5">
                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2.5">
                          <span
                            dir="ltr"
                            className="font-mono text-xs tabular-nums text-muted"
                          >
                            #{idx + 1}
                          </span>
                          <span
                            dir="ltr"
                            className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold px-2 py-0.5 rounded-sm border ${pillClass}`}
                          >
                            <PillIcon size={12} weight="bold" />
                            {parsed.badgeLabel}
                          </span>
                        </div>
                      </div>
                      <MarkdownRenderer content={parsed.body} stripEmojis />
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Diff Viewer */}
          {(championText || challengerText) && (
            <section className="card-porcelain rounded-[14px] overflow-hidden">
              <div className="px-6 py-4 border-b border-hairline flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <GitDiff size={17} className="text-obsidian" />
                  <h2 className="font-display text-lg font-bold tracking-[-0.02em] text-obsidian">
                    השוואת Champion מול Challenger
                  </h2>
                  <span dir="ltr" className="font-mono text-xs tabular-nums flex items-center gap-1.5">
                    <span className="text-emerald font-semibold">+{diffBundle.addCount}</span>
                    <span className="text-muted">/</span>
                    <span className="text-crimson font-semibold">-{diffBundle.delCount}</span>
                  </span>
                </div>

                <div
                  role="group"
                  aria-label="מצב תצוגת השוואה"
                  className="inline-flex bg-recessed p-1 rounded-md border border-hairline"
                  dir="ltr"
                >
                  <button
                    type="button"
                    onClick={() => onChangeDiffMode('unified')}
                    className={`px-2.5 py-1 rounded-sm font-mono text-xs canon-transition cursor-pointer ${
                      diffMode === 'unified'
                        ? 'bg-surface text-obsidian border border-hairline shadow-xs font-medium'
                        : 'text-slate-ink hover:text-obsidian border border-transparent'
                    }`}
                  >
                    Unified Diff
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeDiffMode('split')}
                    className={`px-2.5 py-1 rounded-sm font-mono text-xs canon-transition cursor-pointer ${
                      diffMode === 'split'
                        ? 'bg-surface text-obsidian border border-hairline shadow-xs font-medium'
                        : 'text-slate-ink hover:text-obsidian border border-transparent'
                    }`}
                  >
                    Side-by-Side
                  </button>
                </div>
              </div>

              {diffBundle.isSame || diffBundle.isMissingOne ? (
                <div className="px-6 py-5 bg-porcelain/60 text-xs text-slate-ink">
                  {diffBundle.isSame
                    ? '0 הבדלים — גרסת ה-Challenger אושרה והפכה ל-Champion הנוכחי.'
                    : 'קיימת גרסה יחידה בלבד — בצע שדרוג נוסף כדי לצפות בהשוואת שינויים בין גרסאות.'}
                </div>
              ) : (
                <div
                  dir="ltr"
                  className="canon-diff overflow-x-auto bg-surface"
                  dangerouslySetInnerHTML={{ __html: diffHtml }}
                />
              )}
            </section>
          )}
        </div>
      </div>

      {/* Bottom QA Upgrader Command Bar */}
      {canUpgradeFromQa && (
        <form
          onSubmit={handleSubmit}
          className="border-t border-hairline bg-surface px-6 lg:px-8 py-3 flex flex-wrap sm:flex-nowrap items-center gap-2.5"
        >
          <div className="flex items-center gap-1.5 text-xs text-slate-ink shrink-0">
            <PencilSimple size={14} className="text-amber" />
            <span>תיקון ישיר ממעבדת ה-QA:</span>
          </div>
          <input
            type="text"
            value={qaInput}
            onChange={(e) => setQaInput(e.target.value)}
            placeholder="שלח הוראת תיקון או שדרוג אטומי בעקבות ממצאי ה-QA..."
            className="flex-1 min-w-[200px] h-9 rounded-md border border-hairline-strong bg-porcelain px-3 text-xs text-ink placeholder:text-muted focus:border-obsidian focus:bg-surface focus:outline-none"
          />
          <button
            type="submit"
            disabled={!qaInput.trim() || isStreaming}
            className="btn-obsidian h-9 px-3.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <span>שדרג ובדוק מחדש ב-QA</span>
            <PaperPlaneTilt size={13} weight="bold" />
          </button>
        </form>
      )}
    </div>
  );
}
