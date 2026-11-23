import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CaretDown,
  Check,
  CircleNotch,
  Code,
  Copy,
  Cpu,
  DotsThree,
  DownloadSimple,
  FileArrowDown,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  Lightning,
  Microphone,
  PaperPlaneTilt,
  PencilSimple,
  Prohibit,
  ShieldCheck,
  SlidersHorizontal,
  Stack,
  Target,
  Warning,
} from '@phosphor-icons/react';
import type { ArtifactTab, NodeId, SessionData, ToastTone } from '../../types/api';
import {
  buildArtifactTree,
  getActiveArtifactContent,
  getBestPrompt,
  getDownloadMdFilename,
  getRawArtifactContent,
  PRIMARY_FILE_KEY,
  resolveActiveArtifactFile,
} from '../../utils/artifacts';
import { parseYamlFrontmatter } from '../../utils/frontmatter';
import { decodeHtmlEntities } from '../../utils/text';
import { CodeBlock } from '../common/CodeBlock';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { PrismBar } from '../PrismBar';
import { Tooltip } from '../Tooltip';

interface ArtifactsViewProps {
  session: SessionData | null;
  activeTab: ArtifactTab;
  onChangeTab: (tab: ArtifactTab) => void;
  activeFile: string;
  onChangeFile: (file: string) => void;
  isStreaming: boolean;
  activeStreamingNode: NodeId | null;
  activeStreamingDesc: string;
  onRunUpgrader: (directive: string) => void;
  onDownloadZip: () => void;
  onNavigateToQa: () => void;
  onShowToast: (message: string, tone?: ToastTone) => void;
}

export function ArtifactsView({
  session,
  activeTab,
  onChangeTab,
  activeFile,
  onChangeFile,
  isStreaming,
  activeStreamingNode,
  activeStreamingDesc,
  onRunUpgrader,
  onDownloadZip,
  onNavigateToQa,
  onShowToast,
}: ArtifactsViewProps) {
  const [showRawPrompt, setShowRawPrompt] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set());
  const [upgraderInput, setUpgraderInput] = useState('');
  const overflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCollapsedFolders(new Set());
  }, [session?.session_id]);

  useEffect(() => {
    if (!overflowOpen) return;
    const handleDocClick = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOverflowOpen(false);
    };
    document.addEventListener('mousedown', handleDocClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [overflowOpen]);

  const state = session?.state;
  const targetType = String(session?.target_type || state?.target_type || 'SYSTEM_PROMPT');
  const slugName = decodeHtmlEntities(session?.slug_name || state?.slug_name || '');
  const refFiles = session?.reference_files || state?.reference_files || {};
  const refKeys = Object.keys(refFiles);
  const bestPrompt = getBestPrompt(session);
  const hasPrimaryText = Boolean(bestPrompt.trim());
  const hasAnyArtifact = hasPrimaryText || refKeys.length > 0;

  const resolvedFile = resolveActiveArtifactFile(session, activeFile);
  const displayedContent = getActiveArtifactContent(session, resolvedFile);
  const rawContent = getRawArtifactContent(session, resolvedFile);

  const tree = useMemo(() => buildArtifactTree(session), [session]);
  const parsedFrontmatter = useMemo(
    () => parseYamlFrontmatter(displayedContent),
    [displayedContent],
  );

  const rubric = session?.rubric_scores || state?.rubric_scores || {};
  const miniRubricDims = useMemo(() => {
    if (!rubric.used_decision_model) return [];
    const list: Array<{ key: string; label: string; val: number }> = [
      { key: 'trigger_precision', label: 'Trigger', val: Number(rubric.trigger_precision ?? 0) },
      { key: 'token_density_no_bloat', label: 'Density', val: Number(rubric.token_density_no_bloat ?? 0) },
      { key: 'intent_alignment', label: 'Intent', val: Number(rubric.intent_alignment ?? 0) },
      { key: 'output_contract_strength', label: 'Contract', val: Number(rubric.output_contract_strength ?? 0) },
      { key: 'actionable_clarity', label: 'Clarity', val: Number(rubric.actionable_clarity ?? 0) },
      { key: 'progressive_disclosure', label: 'Refs', val: Number(rubric.progressive_disclosure ?? 0) },
    ];
    if (rubric.trigger_deconfliction !== undefined && rubric.trigger_deconfliction !== null) {
      list.push({
        key: 'trigger_deconfliction',
        label: 'Deconf.',
        val: Number(rubric.trigger_deconfliction),
      });
    }
    return list;
  }, [rubric]);

  const weightedPct = Math.round(Number(rubric.weighted_average || 0) * 100);

  const chars = displayedContent.length;
  const estTokens = Math.ceil(chars / 4);

  const activeNode = activeStreamingNode || session?.active_node || null;
  const isPromptCompiling =
    activeNode === 'node_2_construct' ||
    activeNode === 'node_3_upgrader' ||
    activeNode === 'node_4_adjudicator' ||
    session?.status === 'compiling';

  const isBlueprintCompiling =
    isStreaming &&
    (activeNode === 'node_1_helper' ||
      activeNode === 'node_2_construct' ||
      activeNode === 'node_3_upgrader');

  const rawXml = session?.raw_blueprint || '';
  const parsedBp = session?.parsed_blueprint || {};

  const toggleFolder = (slug: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleCopyActive = () => {
    if (!displayedContent) return;
    navigator.clipboard.writeText(displayedContent);
    onShowToast('תוכן הקובץ הועתק ללוח', 'check');
  };

  const handleCopyXml = () => {
    if (!rawXml) return;
    navigator.clipboard.writeText(rawXml);
    onShowToast('קוד ה-XML Blueprint הועתק ללוח', 'check');
  };

  const handleDownloadMd = () => {
    if (!displayedContent) return;
    const filename = getDownloadMdFilename(session, resolvedFile);
    const blob = new Blob([displayedContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setOverflowOpen(false);
    onShowToast('הקובץ ירד בהצלחה', 'download');
  };

  const handleUpgraderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = upgraderInput.trim();
    if (!cleaned || isStreaming) return;
    setUpgraderInput('');
    onRunUpgrader(cleaned);
  };

  const detectCodeLang = (path: string) => {
    if (path.endsWith('.xml')) return 'xml';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'yaml';
    if (path.endsWith('.py')) return 'python';
    return 'markdown';
  };

  const isV2Blueprint = Boolean(
    parsedBp.target_type ||
      parsedBp.role_title ||
      parsedBp.description_and_triggers ||
      parsedBp.core_workflow,
  );

  const v2Clusters = [
    {
      title: '1. Identity & Epistemic Stance',
      defs: [
        { key: 'target_type', label: 'Target Type (סוג תוצר)', Icon: Stack, full: false },
        { key: 'slug_name', label: 'Slug Name (מזהה חבילה)', Icon: Cpu, full: false },
        { key: 'role_title', label: 'Role Title (פרסונה ותפקיד)', Icon: Target, full: false },
        { key: 'tone_and_language', label: 'Tone & Language (טון ושפה)', Icon: Microphone, full: false },
        { key: 'epistemic_stance', label: 'Epistemic Stance (עמדה אפיסטמית)', Icon: SlidersHorizontal, full: true },
      ],
    },
    {
      title: '2. Routing & Clarification',
      defs: [
        { key: 'description_and_triggers', label: 'Description & Triggers (טריגרי הפעלה)', Icon: Lightning, full: true },
        { key: 'negative_triggers', label: 'Negative Triggers (מתי לא להפעיל)', Icon: Prohibit, full: true },
        { key: 'suite_topology', label: 'Suite Topology (מפת הסקילים בחבילה)', Icon: Stack, full: true },
        { key: 'clarification_gate', label: 'Clarification Gate (שער הבהרות)', Icon: ShieldCheck, full: true },
      ],
    },
    {
      title: '3. Execution & Verification',
      defs: [
        { key: 'core_workflow', label: 'Core Workflow (תהליך ביצוע)', Icon: GitBranch, full: true },
        { key: 'progressive_disclosure_refs', label: 'Progressive Disclosure Refs (קבצי עזר)', Icon: Stack, full: false },
        { key: 'verification_rubric', label: 'Verification Rubric (אימות פנימי)', Icon: Check, full: false },
        { key: 'format_spec', label: 'Format Spec (מפרט פלט)', Icon: FileText, full: true },
        { key: 'guardrails', label: 'Guardrails (שומרי סף)', Icon: Warning, full: true },
      ],
    },
  ];

  const v1Defs = [
    { key: 'title', label: 'Title (פרסונה ותפקיד)', Icon: Target, full: false },
    { key: 'tone', label: 'Tone (סגנון דיבור)', Icon: Microphone, full: false },
    { key: 'domain_expertise', label: 'Domain Expertise (תחומי מומחיות)', Icon: Cpu, full: false },
    { key: 'cognitive_modules', label: 'Cognitive Modules (מודולים קוגניטיביים)', Icon: SlidersHorizontal, full: false },
    { key: 'workflow', label: 'Workflow (תהליך עבודה מובנה)', Icon: GitBranch, full: true },
    { key: 'negative_constraints', label: 'Negative Constraints (איסורים ומגבלות)', Icon: Prohibit, full: true },
    { key: 'output_format', label: 'Output Format (תבנית פלט)', Icon: FileText, full: true },
  ];

  const activeFileDisplayLabel =
    resolvedFile === PRIMARY_FILE_KEY ? tree.primaryLabel : resolvedFile;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] flex-1 min-h-0 relative z-10">
      {/* Right Main Column — Elevated Porcelain Document Card */}
      <section className="p-4 lg:p-6 flex flex-col min-h-0">
        <div className="card-porcelain rounded-[14px] flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Top Action Strip */}
          <div className="border-b border-hairline px-6 lg:px-8 py-3 flex items-center justify-between gap-4 flex-wrap">
            {/* Recessed Pill Mode Switcher */}
            <div
              role="tablist"
              aria-label="תוצרי המערכת"
              className="inline-flex bg-recessed p-1 rounded-md border border-hairline"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'prompt'}
                onClick={() => onChangeTab('prompt')}
                className={`px-3 py-1 rounded-sm text-xs font-medium canon-transition cursor-pointer ${
                  activeTab === 'prompt'
                    ? 'bg-surface text-obsidian shadow-xs border border-hairline'
                    : 'text-slate-ink hover:text-obsidian border border-transparent'
                }`}
              >
                פרומפט / קבצים
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'blueprint'}
                onClick={() => onChangeTab('blueprint')}
                className={`px-3 py-1 rounded-sm text-xs font-medium font-mono canon-transition cursor-pointer ${
                  activeTab === 'blueprint'
                    ? 'bg-surface text-obsidian shadow-xs border border-hairline'
                    : 'text-slate-ink hover:text-obsidian border border-transparent'
                }`}
                dir="ltr"
              >
                XML Blueprint
              </button>
            </div>

            {/* Minimal Action Controls */}
            {activeTab === 'prompt' ? (
              <div className="flex items-center gap-2">
                <Tooltip content="העתק את תוכן הקובץ הפעיל" placement="bottom">
                  <button
                    type="button"
                    disabled={!hasAnyArtifact}
                    onClick={handleCopyActive}
                    className="prism-interactive h-8 px-2.5 rounded-md border border-hairline bg-surface disabled:opacity-40 text-xs text-ink inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy size={14} className="text-slate-ink" />
                    <span>העתק</span>
                  </button>
                </Tooltip>

                <Tooltip content="הורד חבילת התקנה מלאה (.ZIP)" placement="bottom">
                  <button
                    type="button"
                    disabled={!hasAnyArtifact}
                    onClick={onDownloadZip}
                    className="btn-obsidian h-8 px-3.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <DownloadSimple size={14} weight="bold" />
                    <span>הורד חבילה (.ZIP)</span>
                  </button>
                </Tooltip>

                <div className="relative" ref={overflowRef}>
                  <Tooltip content="אפשרויות תצוגה והורדה נוספות" placement="bottom">
                    <button
                      type="button"
                      disabled={!hasAnyArtifact}
                      aria-label="אפשרויות נוספות"
                      aria-expanded={overflowOpen}
                      onClick={() => setOverflowOpen((v) => !v)}
                      className="prism-interactive h-8 w-8 rounded-md border border-hairline bg-surface disabled:opacity-40 text-ink inline-flex items-center justify-center cursor-pointer"
                    >
                      <DotsThree size={16} weight="bold" />
                    </button>
                  </Tooltip>

                  {overflowOpen && (
                    <div className="absolute left-0 top-9 z-30 w-48 rounded-md border border-hairline-strong bg-surface shadow-xl shadow-obsidian/8 py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowRawPrompt((prev) => !prev);
                          setOverflowOpen(false);
                        }}
                        className="w-full px-3 py-2 text-right text-xs text-ink hover:bg-hover flex items-center gap-2 cursor-pointer"
                      >
                        <Code size={14} className="text-slate-ink" />
                        <span>{showRawPrompt ? 'תצוגה מעוצבת' : 'תצוגת קוד גולמי'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadMd}
                        className="w-full px-3 py-2 text-right text-xs text-ink hover:bg-hover flex items-center gap-2 cursor-pointer"
                      >
                        <FileArrowDown size={14} className="text-slate-ink" />
                        <span>{resolvedFile.endsWith('.py') ? 'הורד .PY' : 'הורד .MD'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <span dir="ltr" className="font-mono text-xs text-muted">
                  V{parsedBp.version || '2.0'}
                </span>
                <Tooltip content="העתק את קוד ה-XML Blueprint" placement="bottom">
                  <button
                    type="button"
                    disabled={!rawXml}
                    onClick={handleCopyXml}
                    className="prism-interactive h-8 px-3 rounded-md border border-hairline bg-surface disabled:opacity-40 text-xs text-ink inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy size={14} className="text-slate-ink" />
                    <span>העתק XML</span>
                  </button>
                </Tooltip>
              </div>
            )}
          </div>

          {/* Document Body */}
          <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
            <div className="max-w-[80ch] mx-auto">
              {activeTab === 'prompt' ? (
                !hasAnyArtifact ? (
                  isPromptCompiling ? (
                    <div className="border border-hairline prism-aura rounded-md bg-porcelain p-6">
                      <div className="flex items-center gap-2.5 text-sm font-medium text-obsidian">
                        <CircleNotch size={16} className="animate-spin text-obsidian" />
                        <span>
                          מהדר תוצר חי —{' '}
                          <code dir="ltr" className="font-mono text-xs">
                            {activeNode === 'node_4_adjudicator'
                              ? 'The Adjudicator'
                              : activeNode === 'node_3_upgrader'
                              ? 'The Upgrader'
                              : 'The Construct'}
                          </code>
                        </span>
                      </div>
                      <p className="text-xs text-slate-ink mt-2">
                        {activeStreamingDesc || 'בונה ומהדר את התוצר מתוך תוכנית האב...'}
                      </p>
                      <div className="mt-5 space-y-2.5" dir="ltr">
                        <div className="h-2.5 w-11/12 bg-recessed rounded-sm animate-pulse" />
                        <div className="h-2.5 w-9/12 bg-recessed rounded-sm animate-pulse" />
                        <div className="h-2.5 w-10/12 bg-recessed rounded-sm animate-pulse" />
                        <div className="h-2.5 w-7/12 bg-recessed rounded-sm animate-pulse" />
                      </div>
                    </div>
                  ) : (
                    <div className="py-16 text-center max-w-md mx-auto">
                      <Stack size={36} className="mx-auto text-muted mb-3" />
                      <h2 className="font-display text-xl font-bold tracking-[-0.025em] text-obsidian">
                        תוצר המערכת יופיע כאן
                      </h2>
                      <p className="text-sm text-slate-ink mt-2 leading-relaxed">
                        לאחר סיום הראיון הקצר עם{' '}
                        <code dir="ltr" className="font-mono text-xs bg-recessed px-1.5 py-0.5 rounded-sm">
                          The Helper
                        </code>
                        , המהדר (
                        <code dir="ltr" className="font-mono text-xs bg-recessed px-1.5 py-0.5 rounded-sm">
                          The Construct
                        </code>
                        ) יבנה כאן את ה-Skill / System Prompt ויעביר אותו בדיקות QA אוטומטיות.
                      </p>
                    </div>
                  )
                ) : (
                  <div>
                    {/* Active File Sub-title */}
                    <div className="flex items-center justify-between gap-2 pb-4 mb-6 border-b border-hairline">
                      <span dir="ltr" className="font-mono text-xs font-semibold text-obsidian inline-flex items-center gap-2">
                        {resolvedFile.endsWith('.py') ? (
                          <Code size={15} className="text-slate-ink shrink-0" />
                        ) : null}
                        <span>{activeFileDisplayLabel}</span>
                      </span>
                      {resolvedFile.endsWith('.py') ? (
                        <span
                          className="font-mono text-[10px] px-2 py-0.5 rounded-sm border border-hairline bg-recessed text-obsidian"
                          dir="ltr"
                        >
                          PYTHON 3 STDLIB SCRIPT
                        </span>
                      ) : showRawPrompt ? (
                        <span className="font-mono text-[11px] text-muted" dir="ltr">
                          RAW SOURCE VIEW
                        </span>
                      ) : null}
                    </div>

                    {showRawPrompt || /\.(py|json|ya?ml|xml)$/i.test(resolvedFile) ? (
                      <CodeBlock
                        code={showRawPrompt ? rawContent : displayedContent}
                        lang={detectCodeLang(resolvedFile)}
                      />
                    ) : (
                      <>
                        {parsedFrontmatter.frontmatter && (
                          <div className="prism-aura bg-porcelain/70 rounded-md overflow-hidden mb-6 border border-hairline">
                            {/* Top 2px Optical Prism Light-Refraction Bar */}
                            <div
                              aria-hidden="true"
                              className="h-[2px] w-full bg-gradient-to-r from-prism-cyan via-prism-violet to-prism-peach"
                            />
                            <div className="p-5">
                              <div
                                dir="ltr"
                                className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-3"
                              >
                                YAML Frontmatter Specification
                              </div>
                              <dl dir="ltr" className="space-y-2.5 text-left">
                                {parsedFrontmatter.frontmatter.map((entry) => (
                                  <div
                                    key={entry.key}
                                    className="grid grid-cols-1 sm:grid-cols-[130px_1fr] gap-1 sm:gap-4 border-t border-hairline/80 pt-2 first:border-t-0 first:pt-0"
                                  >
                                    <dt className="font-mono text-xs font-semibold text-slate-ink">
                                      {entry.key}
                                    </dt>
                                    <dd className="font-mono text-xs text-obsidian leading-relaxed break-words">
                                      {entry.value}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            </div>
                          </div>
                        )}

                        <MarkdownRenderer content={parsedFrontmatter.body} />
                      </>
                    )}
                  </div>
                )
              ) : /* XML Blueprint Tab */ !rawXml ? (
                isBlueprintCompiling ? (
                  <div className="border border-hairline prism-aura rounded-md bg-porcelain p-6">
                    <div className="flex items-center gap-2.5 text-sm font-medium text-obsidian">
                      <CircleNotch size={16} className="animate-spin text-obsidian" />
                      <span>
                        מגבש תוכנית אב —{' '}
                        <code dir="ltr" className="font-mono text-xs">
                          {activeNode === 'node_3_upgrader' ? 'The Upgrader' : 'The Helper'}
                        </code>
                      </span>
                    </div>
                    <p className="text-xs text-slate-ink mt-2">
                      {activeStreamingDesc || 'מנתח דרישות ומגבש את מבנה ה-XML Blueprint...'}
                    </p>
                  </div>
                ) : (
                  <div className="py-16 text-center max-w-md mx-auto">
                    <Cpu size={36} className="mx-auto text-muted mb-3" />
                    <h2 className="font-display text-xl font-bold tracking-[-0.025em] text-obsidian">
                      תוכנית האב (XML Blueprint) טרם הופקה
                    </h2>
                    <p className="text-sm text-slate-ink mt-2 leading-relaxed">
                      השלם את שאלות המיקוד בראיון עם{' '}
                      <code dir="ltr" className="font-mono text-xs bg-recessed px-1.5 py-0.5 rounded-sm">
                        The Helper
                      </code>{' '}
                      כדי לחלץ את הגדרות היעד, הטריגרים וחוזה הפלט.
                    </p>
                  </div>
                )
              ) : (
                <div className="space-y-8">
                  {isV2Blueprint ? (
                    <>
                      {v2Clusters.map((cluster) => {
                        const visibleDefs = cluster.defs.filter((d) => Boolean(parsedBp[d.key]));
                        if (visibleDefs.length === 0) return null;
                        return (
                          <div key={cluster.title}>
                            <h3
                              dir="ltr"
                              className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted border-b border-hairline pb-2 mb-4"
                            >
                              {cluster.title}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {visibleDefs.map((def) => {
                                const Icon = def.Icon;
                                return (
                                  <div
                                    key={def.key}
                                    className={`border border-hairline rounded-md bg-porcelain/60 p-4 ${
                                      def.full ? 'md:col-span-2' : ''
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 text-xs font-semibold text-obsidian mb-2">
                                      <Icon size={14} className="text-slate-ink shrink-0" />
                                      <span>{def.label}</span>
                                    </div>
                                    <MarkdownRenderer
                                      content={decodeHtmlEntities(parsedBp[def.key])}
                                      className="text-sm"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {v1Defs
                        .filter((d) => Boolean(parsedBp[d.key]))
                        .map((def) => {
                          const Icon = def.Icon;
                          return (
                            <div
                              key={def.key}
                              className={`border border-hairline rounded-md bg-porcelain/60 p-4 ${
                                def.full ? 'md:col-span-2' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2 text-xs font-semibold text-obsidian mb-2">
                                <Icon size={14} className="text-slate-ink shrink-0" />
                                <span>{def.label}</span>
                              </div>
                              <MarkdownRenderer
                                content={decodeHtmlEntities(parsedBp[def.key])}
                                className="text-sm"
                              />
                            </div>
                          );
                        })}
                    </div>
                  )}

                  <details className="border border-hairline rounded-md bg-porcelain">
                    <summary className="px-4 py-3 text-xs font-medium text-ink cursor-pointer select-none flex items-center justify-between">
                      <span className="inline-flex items-center gap-2">
                        <Code size={14} className="text-slate-ink" />
                        <span>
                          קוד XML מלא (
                          <code dir="ltr" className="font-mono text-[11px]">
                            &lt;ARTIFACT_BLUEPRINT&gt;
                          </code>
                          )
                        </span>
                      </span>
                      <CaretDown size={13} className="text-muted" />
                    </summary>
                    <div className="border-t border-hairline">
                      <CodeBlock code={rawXml} lang="xml" className="border-0 rounded-none" />
                    </div>
                  </details>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Quick Upgrader Bar */}
          {hasAnyArtifact && (
            <form
              onSubmit={handleUpgraderSubmit}
              className="border-t border-hairline bg-porcelain/70 px-6 lg:px-8 py-3 flex flex-wrap sm:flex-nowrap items-center gap-2.5"
            >
              <div className="flex items-center gap-1.5 text-xs text-slate-ink shrink-0">
                <PencilSimple size={14} className="text-amber" />
                <span>פקודת שדרוג מהירה:</span>
              </div>
              <input
                type="text"
                value={upgraderInput}
                onChange={(e) => setUpgraderInput(e.target.value)}
                placeholder="פקודת שדרוג מהירה ל-The Upgrader (למשל: 'הוסף טבלת השוואה לפלט')..."
                className="flex-1 min-w-[200px] h-9 rounded-md border border-hairline-strong bg-surface px-3 text-xs text-ink placeholder:text-muted focus:border-obsidian focus:outline-none"
              />
              <button
                type="submit"
                disabled={!upgraderInput.trim() || isStreaming}
                className="btn-obsidian h-9 px-3.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <span>שדרג ובדוק ב-QA</span>
                <PaperPlaneTilt size={13} weight="bold" />
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Left Sticky Margin Rail — Solid #FFFFFF File Tree, Mini Rubric Spectrum & Telemetry */}
      <aside className="bg-white lg:border-r lg:border-[rgba(17,18,22,0.08)] p-6 lg:sticky lg:top-[58px] lg:h-[calc(100vh-58px)] lg:overflow-y-auto flex flex-col shadow-[0_2px_6px_rgba(17,18,22,0.02)]">
        {/* File Tree */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted" dir="ltr">
              PACKAGE FILE TREE
            </span>
            {tree.hasNestedSuite && (
              <span
                dir="ltr"
                className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm border border-hairline bg-surface text-obsidian"
              >
                {tree.skillGroups.length} skills
              </span>
            )}
          </div>

          {!hasAnyArtifact ? (
            <div className="border border-hairline rounded-md bg-porcelain/60 px-3 py-4 text-xs text-muted text-center">
              אין קבצים להצגה עדיין
            </div>
          ) : (
            <div dir="ltr" className="space-y-1.5 text-left">
              {tree.showPrimary && (
                <Tooltip content={tree.primaryLabel} dir="ltr" placement="right" className="w-full">
                  <button
                    type="button"
                    onClick={() => {
                      onChangeFile(PRIMARY_FILE_KEY);
                      if (activeTab !== 'prompt') onChangeTab('prompt');
                    }}
                    className={`prism-interactive w-full px-2.5 py-2 rounded-sm border text-xs font-mono flex items-center justify-between gap-2 cursor-pointer ${
                      resolvedFile === PRIMARY_FILE_KEY
                        ? 'bg-porcelain border-hairline shadow-xs border-r-[2.5px] border-r-obsidian text-obsidian font-semibold'
                        : 'bg-porcelain/50 border-transparent hover:bg-porcelain text-slate-ink'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 truncate">
                      <FileText size={14} className="shrink-0 text-slate-ink" />
                      <span className="truncate">{tree.primaryLabel}</span>
                    </span>
                    <span className="text-[10px] text-muted shrink-0">PRIMARY</span>
                  </button>
                </Tooltip>
              )}

              {tree.rootExtraKeys.map((relPath) => {
                const isActive = resolvedFile === relPath;
                const isScript =
                  relPath.startsWith('scripts/') ||
                  relPath.includes('/scripts/') ||
                  relPath.endsWith('.py');
                const rootTag =
                  relPath === 'SKILL.md'
                    ? 'SKILL'
                    : relPath === 'SYSTEM_PROMPT.md'
                    ? 'PROMPT'
                    : isScript
                    ? 'SCRIPT'
                    : 'REF';
                return (
                  <Tooltip key={relPath} content={relPath} dir="ltr" placement="right" className="w-full">
                    <button
                      type="button"
                      onClick={() => {
                        onChangeFile(relPath);
                        if (activeTab !== 'prompt') onChangeTab('prompt');
                      }}
                      className={`prism-interactive w-full px-2.5 py-2 rounded-sm border text-xs font-mono flex items-center justify-between gap-2 cursor-pointer ${
                        isActive
                          ? 'bg-porcelain border-hairline shadow-xs border-r-[2.5px] border-r-obsidian text-obsidian font-semibold'
                          : 'bg-porcelain/50 border-transparent hover:bg-porcelain text-slate-ink'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 truncate">
                        {isScript ? (
                          <Code size={14} className="shrink-0 text-slate-ink" />
                        ) : (
                          <FileText size={14} className="shrink-0 text-slate-ink" />
                        )}
                        <span className="truncate">{relPath}</span>
                      </span>
                      <span className="text-[10px] text-muted shrink-0">{rootTag}</span>
                    </button>
                  </Tooltip>
                );
              })}

              {tree.skillGroups.map((group) => {
                const containsActive = group.files.includes(resolvedFile);
                const isOpen = containsActive || !collapsedFolders.has(group.slug);
                return (
                  <div key={group.slug} className="border border-hairline rounded-md bg-white overflow-hidden">
                    <Tooltip content={`skills/${group.slug}/`} dir="ltr" placement="right" className="w-full">
                      <button
                        type="button"
                        onClick={() => toggleFolder(group.slug)}
                        className="w-full px-2.5 py-2 text-xs font-mono text-obsidian flex items-center justify-between gap-2 hover:bg-hover canon-transition cursor-pointer"
                      >
                        <span className="inline-flex items-center gap-1.5 truncate">
                          {isOpen ? (
                            <FolderOpen size={14} className="text-obsidian shrink-0" />
                          ) : (
                            <Folder size={14} className="text-slate-ink shrink-0" />
                          )}
                          <span className="truncate">skills/{group.slug}/</span>
                        </span>
                        <span className="text-[10px] tabular-nums text-slate-ink bg-recessed px-1.5 rounded-sm shrink-0">
                          {group.files.length}
                        </span>
                      </button>
                    </Tooltip>

                    {isOpen && (
                      <div className="border-t border-hairline divide-y divide-hairline/70">
                        {group.files.map((relPath) => {
                          const subPath = relPath.slice(`skills/${group.slug}/`.length);
                          const isMainSkill = subPath === 'SKILL.md';
                          const isScript = subPath.startsWith('scripts/') || subPath.endsWith('.py');
                          const roleTag = isMainSkill
                            ? 'SKILL'
                            : subPath.startsWith('references/')
                            ? 'REF'
                            : isScript
                            ? 'SCRIPT'
                            : 'FILE';
                          const isActive = resolvedFile === relPath;
                          return (
                            <Tooltip key={relPath} content={relPath} dir="ltr" placement="right" className="w-full">
                              <button
                                type="button"
                                onClick={() => {
                                  onChangeFile(relPath);
                                  if (activeTab !== 'prompt') onChangeTab('prompt');
                                }}
                                className={`prism-interactive w-full pl-5 pr-2.5 py-1.5 text-xs font-mono flex items-center justify-between gap-2 border border-transparent cursor-pointer ${
                                  isActive
                                    ? 'bg-porcelain border-r-[2.5px] border-r-obsidian text-obsidian font-semibold'
                                    : 'bg-white hover:bg-porcelain/70 text-slate-ink'
                                }`}
                              >
                                <span className="inline-flex items-center gap-1.5 truncate">
                                  {isScript ? (
                                    <Code size={13} className="shrink-0 text-slate-ink" />
                                  ) : (
                                    <FileText size={13} className="shrink-0 text-slate-ink" />
                                  )}
                                  <span className="truncate">{subPath}</span>
                                </span>
                                <span className="text-[10px] text-muted shrink-0">{roleTag}</span>
                              </button>
                            </Tooltip>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mini Rubric Spectrum Widget (Clickable -> 03 / בקרת איכות) */}
        {miniRubricDims.length > 0 && (
          <Tooltip content="לחץ למעבר לבקרת איכות (03 / בקרת איכות)" placement="top" className="w-full mt-6">
            <button
              type="button"
              onClick={onNavigateToQa}
              className="prism-interactive w-full text-right card-porcelain rounded-md p-3.5 cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted" dir="ltr">
                  RUBRIC SPECTRUM ({miniRubricDims.length}D)
                </span>
                <span className="font-mono text-xs font-semibold tabular-nums text-emerald" dir="ltr">
                  {weightedPct}%
                </span>
              </div>
              <div className="space-y-2.5">
                {miniRubricDims.map((dim) => {
                  const pct = Math.max(0, Math.min(100, Math.round((dim.val / 5) * 100)));
                  return (
                    <div key={dim.key} dir="ltr" className="grid grid-cols-[54px_1fr_28px] items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-ink truncate">{dim.label}</span>
                      <PrismBar value={pct} variant={dim.val < 3.0 ? 'warning' : 'prism'} />
                      <span className="font-mono text-[10px] tabular-nums text-muted text-right">
                        {dim.val.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </button>
          </Tooltip>
        )}

        {/* Aligned Telemetry Metadata */}
        <div className="border-t border-hairline mt-6 pt-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-3" dir="ltr">
            ARTIFACT TELEMETRY
          </div>
          <dl className="divide-y divide-hairline/80 text-xs">
            <div className="py-2 flex items-center justify-between gap-3">
              <dt className="text-slate-ink">תווים</dt>
              <dd className="font-mono tabular-nums text-obsidian" dir="ltr">
                {chars.toLocaleString()}
              </dd>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <dt className="text-slate-ink">טוקנים (הערכה)</dt>
              <dd className="font-mono tabular-nums text-obsidian" dir="ltr">
                ~{estTokens.toLocaleString()}
              </dd>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <dt className="text-slate-ink">סוג תוצר</dt>
              <dd className="font-mono text-[11px] text-obsidian" dir="ltr">
                {targetType}
              </dd>
            </div>
            <div className="py-2 flex items-start justify-between gap-3">
              <dt className="text-slate-ink shrink-0">מזהה</dt>
              <dd className="font-mono text-[11px] text-obsidian break-all text-left" dir="ltr">
                {slugName || '—'}
              </dd>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <dt className="text-slate-ink">גרסה</dt>
              <dd>
                {session?.status === 'passed' ? (
                  <span
                    dir="ltr"
                    className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded-sm bg-emerald-tint text-emerald border border-emerald/30 whitespace-nowrap"
                  >
                    <Check size={11} weight="bold" />
                    Champion (Approved)
                  </span>
                ) : hasAnyArtifact ? (
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-sm bg-recessed text-slate-ink border border-hairline whitespace-nowrap">
                    איטרציה {state?.iteration_count || 1}
                  </span>
                ) : (
                  <span className="font-mono text-[11px] text-muted">ממתין להידור</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}
