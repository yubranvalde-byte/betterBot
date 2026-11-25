import { useState } from 'react';
import { CheckSquare, ShieldCheck, Square, Sword, Warning, Wrench } from '@phosphor-icons/react';
import type { RedTeamFinding, RedTeamReport } from '../../types/api';

interface RedTeamPanelProps {
  report: RedTeamReport;
  isStreaming: boolean;
  onHarden: (directive: string) => void;
}

function synthesizeSubsetDirective(
  selected: RedTeamFinding[],
  allFindings: RedTeamFinding[],
  fullDirective: string,
): string {
  if (
    selected.length === allFindings.length &&
    fullDirective &&
    fullDirective.trim().length > 0
  ) {
    return fullDirective.trim();
  }
  const lines = selected.map(
    (f, idx) =>
      `${idx + 1}. [${f.severity}] \`${f.target_file}\` — ${f.title}: ${f.fix} (Evidence: ${f.evidence})`,
  );
  return (
    "Apply surgical Delta-Patch hardening fixes for the following Red-Team findings:\n" +
    lines.join('\n')
  );
}

export function RedTeamPanel({ report, isStreaming, onHarden }: RedTeamPanelProps) {
  const [deselectedState, setDeselectedState] = useState<{
    report: RedTeamReport;
    ids: string[];
  }>(() => ({ report, ids: [] }));

  const findings = report.findings || [];
  const deselectedSet = new Set(
    deselectedState.report === report ? deselectedState.ids : [],
  );
  const selectedFindings = findings.filter((f) => !deselectedSet.has(f.id));
  const isReady = report.verdict === 'PRODUCTION_READY';
  const canHarden =
    !isStreaming &&
    (selectedFindings.length > 0 ||
      (!isReady && Boolean((report.patch_directive || '').trim())));

  const toggleFinding = (id: string) => {
    setDeselectedState((prev) => {
      const current = prev.report === report ? prev.ids : [];
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      return { report, ids: next };
    });
  };

  const handleHardenClick = () => {
    if (!canHarden) return;
    const directive = synthesizeSubsetDirective(
      selectedFindings,
      findings,
      report.patch_directive || '',
    );
    onHarden(directive);
  };

  return (
    <section className="rounded-[14px] border border-hairline bg-white/85 backdrop-blur-md shadow-xs overflow-hidden">
      <div className="px-5 py-4 border-b border-hairline flex flex-wrap items-center justify-between gap-3 bg-porcelain/60">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-obsidian text-white inline-flex items-center justify-center shrink-0">
            <Sword size={15} weight="bold" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-sm font-bold text-obsidian">
                דוח תקיפה אדוורסרית (Red-Team)
              </h3>
              <span
                dir="ltr"
                className={`inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-2 py-0.5 rounded-sm border ${
                  isReady
                    ? 'bg-emerald-tint text-emerald border-emerald/35'
                    : 'bg-amber-tint text-amber border-amber/35'
                }`}
              >
                {isReady ? (
                  <ShieldCheck size={12} weight="bold" />
                ) : (
                  <Warning size={12} weight="bold" />
                )}
                {report.verdict}
              </span>
              {report.model && (
                <span
                  dir="ltr"
                  className="font-mono text-[10px] text-muted bg-surface border border-hairline px-1.5 py-0.5 rounded-sm"
                >
                  {report.model}
                  {report.thinking_level ? ` · ${report.thinking_level}` : ''}
                </span>
              )}
            </div>
            <p dir="auto" className="text-xs text-slate-ink mt-1">
              {report.summary}
            </p>
          </div>
        </div>

        {!isReady && (
          <button
            type="button"
            disabled={!canHarden}
            onClick={handleHardenClick}
            className={`h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 shrink-0 canon-transition ${
              canHarden
                ? 'btn-obsidian cursor-pointer'
                : 'bg-recessed text-muted border border-hairline cursor-not-allowed'
            }`}
          >
            <Wrench size={13} weight="bold" />
            <span>Harden Package (Delta-Patch)</span>
          </button>
        )}
      </div>

      {findings.length > 0 ? (
        <div className="divide-y divide-hairline">
          {findings.map((finding) => {
            const checked = !deselectedSet.has(finding.id);
            const sevClass =
              finding.severity === 'Critical'
                ? 'bg-crimson-tint text-crimson border-crimson/30'
                : finding.severity === 'High'
                ? 'bg-amber-tint text-amber border-amber/30'
                : 'bg-recessed text-slate-ink border-hairline';

            return (
              <div
                key={finding.id}
                onClick={() => toggleFinding(finding.id)}
                className={`px-5 py-3.5 flex items-start gap-3 cursor-pointer canon-transition ${
                  checked ? 'bg-white hover:bg-porcelain/60' : 'bg-porcelain/40 opacity-65'
                }`}
              >
                <button
                  type="button"
                  aria-label={`בחר ממצא ${finding.id}`}
                  className="mt-0.5 text-obsidian shrink-0 cursor-pointer"
                >
                  {checked ? (
                    <CheckSquare size={16} weight="fill" className="text-obsidian" />
                  ) : (
                    <Square size={16} className="text-muted" />
                  )}
                </button>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2" dir="ltr">
                    <span
                      className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-sm border ${sevClass}`}
                    >
                      {finding.severity}
                    </span>
                    <code className="font-mono text-[11px] bg-recessed px-1.5 py-0.5 rounded-sm text-obsidian">
                      {finding.target_file}
                    </code>
                    <span className="text-xs font-semibold text-obsidian">{finding.title}</span>
                  </div>
                  <p dir="auto" className="text-xs text-slate-ink">
                    <strong className="text-obsidian">ראיה:</strong> {finding.evidence}
                  </p>
                  <p dir="auto" className="text-xs text-obsidian">
                    <strong>תיקון מומלץ:</strong> {finding.fix}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-5 py-4 text-xs text-slate-ink flex items-center gap-2">
          <ShieldCheck size={15} weight="bold" className="text-emerald shrink-0" />
          <span>
            {report.parse_error
              ? 'לא התקבל פלט JSON תקין מה-Red-Team — ניתן להריץ בדיקה חוזרת או להיעזר בבטי.'
              : 'לא נמצאו כשלי קצה, פערי Parity או בעיות סקייל/אבטחה בחבילה.'}
          </span>
        </div>
      )}
    </section>
  );
}
