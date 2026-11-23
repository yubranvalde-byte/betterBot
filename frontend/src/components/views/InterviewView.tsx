import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChartBar,
  CheckCircle,
  Circle,
  Code,
  Cpu,
  EnvelopeSimple,
  Headset,
  Lightning,
  PaperPlaneTilt,
  Warning,
} from '@phosphor-icons/react';
import type {
  ArtifactTab,
  NodeId,
  SessionData,
  ToastTone,
  ViewId,
} from '../../types/api';
import { getBestPrompt } from '../../utils/artifacts';
import { decodeHtmlEntities, stripDecorativeEmojis } from '../../utils/text';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { GlassGaugeTube } from '../OpticalConduit';

interface InterviewViewProps {
  session: SessionData | null;
  isStreaming: boolean;
  activeStreamingNode: NodeId | null;
  activeStreamingDesc: string;
  pendingUserMessage: string | null;
  onSendMessage: (message: string) => void;
  onNavigateView: (view: ViewId, artifactTab?: ArtifactTab) => void;
  onShowToast?: (message: string, tone?: ToastTone) => void;
}

const HELPER_WELCOME_TEXT =
  'היי, אני ה-Helper. תאר לי בחופשיות איזה סוכן או Skill אתה רוצה לבנות — מה המטרה, מתי הוא אמור לפעול ואיך הפלט צריך להיראות — או בחר נקודת פתיחה מהירה למטה ונתחיל ללטש יחד.';

const QUICK_START_PILLS = [
  {
    id: 'email',
    title: 'ארכיטקט מיילים עסקיים',
    prompt:
      'אני רוצה לבנות בוט שעוזר לכתוב ולנסח מיילים עסקיים באנגלית ברמה של מנהלים בכירים בהייטק, מנקודות קצרות בעברית.',
    Icon: EnvelopeSimple,
    iconTint: 'bg-sky-500/10 text-sky-600',
  },
  {
    id: 'code-mentor',
    title: 'מנטור קוד ו-Code Review',
    prompt:
      'אני רוצה לבנות מנטור קוד בפייתון ובדיקות תוכנה שעובר על קוד, מוצא באגים ובעיות ביצועים, ומסביר בצורה לימודית בלי לתת סתם קוד מוכן מראש.',
    Icon: Code,
    iconTint: 'bg-indigo-500/10 text-indigo-600',
  },
  {
    id: 'strategy',
    title: 'אנליסט אסטרטגיה וסטארטאפים',
    prompt:
      'אני רוצה לבנות אנליסט אסטרטגי ומחקר שוק שמנתח רעיונות לסטארטאפים, בודק היתכנות עסקית, מזהה סיכונים ומציג ניתוח SWOT מובנה.',
    Icon: ChartBar,
    iconTint: 'bg-emerald-500/10 text-emerald-600',
  },
  {
    id: 'saas-support',
    title: 'מומחה תמיכה ושירות SaaS',
    prompt:
      'אני רוצה לבנות סוכן תמיכה טכנית אמפתי ומדויק לאפליקציית SaaS, שמאבחן תקלות צעד אחר צעד ומרגיע לקוחות מתוסכלים.',
    Icon: Headset,
    iconTint: 'bg-amber-500/10 text-amber-600',
  },
] as const;

function parseNumericScore(val: unknown): number {
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    if (lower === 'yes' || lower === 'true') return 1;
    if (lower === 'no' || lower === 'false') return 0;
    const n = Number.parseFloat(val);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(val ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function PrismOrbAvatar() {
  return (
    <div
      aria-hidden="true"
      className="w-[30px] h-[30px] rounded-full bg-porcelain border border-hairline prism-aura flex items-center justify-center shrink-0 shadow-xs"
    >
      <span className="w-3 h-3 rounded-full bg-gradient-to-tr from-prism-cyan via-prism-violet to-prism-peach shadow-[0_0_8px_rgba(129,140,248,0.45)]" />
    </div>
  );
}

export function InterviewView({
  session,
  isStreaming,
  activeStreamingNode,
  activeStreamingDesc,
  pendingUserMessage,
  onSendMessage,
  onNavigateView,
}: InterviewViewProps) {
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const history = session?.chat_history || [];
  const state = session?.state;
  const status = session?.status || 'idle';
  const iterationCount = state?.iteration_count || 0;
  const isOverrideMode =
    status === 'escalated' || status === 'passed' || iterationCount > 0;

  const userTurns = history.filter((m) => m.role === 'user').length;
  const isInitialConversation = userTurns === 0 && !pendingUserMessage;

  let lastAssistantIdx = -1;
  for (let idx = history.length - 1; idx >= 0; idx--) {
    if (history[idx]?.role !== 'user') {
      lastAssistantIdx = idx;
      break;
    }
  }

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || isInitialConversation) return;
    el.scrollTop = el.scrollHeight;
  }, [history.length, pendingUserMessage, isInitialConversation, isStreaming]);

  const resizeTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.max(44, Math.min(el.scrollHeight, 160));
    el.style.height = `${next}px`;
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = draft.trim();
    if (!cleaned || isStreaming) return;
    setDraft('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
    onSendMessage(cleaned);
  };

  const handleQuickPillClick = (promptText: string) => {
    if (isStreaming) return;
    onSendMessage(promptText);
  };

  const readiness = session?.readiness_scores || state?.readiness_scores || {};
  const targetType = String(session?.target_type || state?.target_type || 'SYSTEM_PROMPT');
  const slugName = decodeHtmlEntities(session?.slug_name || state?.slug_name || '');
  const hasBlueprint = Boolean(session?.raw_blueprint);
  const refFiles = session?.reference_files || state?.reference_files || {};
  const hasPrompt = Boolean(
    getBestPrompt(session).trim() || Object.keys(refFiles).length > 0,
  );

  let readinessPercent: number | null = null;
  if (readiness.used_decision_model && readiness.ready_to_compile !== undefined) {
    readinessPercent = Math.round(parseNumericScore(readiness.ready_to_compile) * 100);
  } else if (status === 'passed' || hasBlueprint || hasPrompt) {
    readinessPercent = 100;
  }
  const displayReadiness = readinessPercent ?? 0;

  const gateStatusMeta = (() => {
    if (status === 'passed') {
      return { label: 'Champion · PASS', cls: 'text-emerald bg-emerald-tint border-emerald/30' };
    }
    if (status === 'escalated') {
      return { label: 'Escalated', cls: 'text-crimson bg-crimson-tint border-crimson/30' };
    }
    if (status === 'compiling' || isStreaming) {
      return {
        label: 'Compiling',
        cls: 'text-obsidian bg-surface border-hairline-strong prism-aura',
      };
    }
    if (status === 'interviewing') {
      return { label: 'In Progress', cls: 'text-slate-ink bg-recessed border-hairline' };
    }
    return { label: 'Idle', cls: 'text-muted bg-surface border-hairline' };
  })();

  const activePhaseText = (() => {
    if (isStreaming && activeStreamingDesc) return activeStreamingDesc;
    if (status === 'passed') {
      return 'הפרומפט עבר בקרת איכות ומוכן להטמעה. ניתן לשלוח הנחיות שדרוג נוספות.';
    }
    if (status === 'escalated') {
      return 'מפסק הפחת הופעל. הזן הוראת תיקון ידנית עבור The Upgrader.';
    }
    if (status === 'compiling') {
      return 'הסוכנים מהדרים ובודקים את הפרומפט מול תוכנית האב...';
    }
    if (status === 'interviewing') {
      return 'The Helper אוסף מידע ממוקד לאפיון תוכנית האב.';
    }
    return 'ממתין לתיאור הסוכן או ה-Skill הראשוני מהמשתמש.';
  })();

  const readinessDims = [
    {
      key: 'objective',
      label: 'מטרה מרכזית',
      score: parseNumericScore(readiness.has_core_objective),
      ok: parseNumericScore(readiness.has_core_objective) >= 0.8 || hasBlueprint,
    },
    {
      key: 'triggers',
      label: 'טריגרים והפעלה',
      score: parseNumericScore(readiness.has_trigger_or_context),
      ok: parseNumericScore(readiness.has_trigger_or_context) >= 0.8 || hasBlueprint,
    },
    {
      key: 'contract',
      label: 'חוזה פלט',
      score: parseNumericScore(readiness.has_output_contract),
      ok: parseNumericScore(readiness.has_output_contract) >= 0.8 || hasBlueprint,
    },
    {
      key: 'auxiliary',
      label: 'קבצי עזר (Refs)',
      score: parseNumericScore(readiness.needs_auxiliary_files),
      ok:
        parseNumericScore(readiness.needs_auxiliary_files) >= 0.65 ||
        Object.keys(refFiles).length > 0,
    },
  ];

  const showPendingOptimistic =
    Boolean(pendingUserMessage) &&
    !history.some((m) => m.role === 'user' && m.text.trim() === pendingUserMessage?.trim());

  const hasDraftText = draft.trim().length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] flex-1 min-h-0 bg-porcelain/60 relative z-10">
      {/* Right Main Column — Conversational Studio */}
      <section className="p-4 lg:p-6 flex flex-col min-h-0">
        <div className="card-porcelain rounded-[14px] flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {/* Compact Header */}
          <div className="border-b border-hairline px-6 lg:px-8 py-4 flex items-center justify-between gap-4 bg-surface/90">
            <div>
              <h1 className="font-display text-2xl font-bold text-obsidian tracking-[-0.025em]">
                זירת האפיון והראיון
              </h1>
              <p className="text-xs text-slate-ink mt-0.5">
                {isOverrideMode ? (
                  <>
                    מצב עריכה ישירה מול{' '}
                    <code dir="ltr" className="font-mono text-[11px] bg-recessed px-1.5 py-0.5 rounded-sm">
                      The Upgrader
                    </code>
                  </>
                ) : (
                  <>
                    שיחה חיה עם{' '}
                    <code dir="ltr" className="font-mono text-[11px] bg-recessed px-1.5 py-0.5 rounded-sm">
                      The Helper
                    </code>{' '}
                    לזיקוק דרישות והידור
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Scrollable Chat Stream */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto px-5 lg:px-10 pt-6 pb-40 bg-porcelain/35"
          >
            <div className="max-w-3xl mx-auto flex flex-col gap-5">
              {isInitialConversation ? (
                <>
                  {/* Opening Welcome Message Bubble from The Helper */}
                  <div className="self-end w-full flex flex-row-reverse items-start gap-3">
                    <PrismOrbAvatar />
                    <div className="flex flex-col items-end max-w-[84%]">
                      <div className="font-mono text-[11px] text-muted mb-1.5" dir="auto">
                        <bdi dir="ltr">The Helper</bdi> · ארכיטקט דרישות
                      </div>
                      <div className="bg-surface border border-hairline rounded-2xl rounded-tl-[4px] shadow-xs px-5 py-4 text-[15px] leading-relaxed text-ink">
                        <p dir="auto">{HELPER_WELCOME_TEXT}</p>
                      </div>
                    </div>
                  </div>

                  {/* Compact Floating Quick-Start Prompt Pills */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {QUICK_START_PILLS.map((pill) => {
                      const Icon = pill.Icon;
                      return (
                        <button
                          key={pill.id}
                          type="button"
                          disabled={isStreaming}
                          onClick={() => handleQuickPillClick(pill.prompt)}
                          className="prism-interactive rounded-full bg-surface border border-hairline px-3.5 py-2 text-sm text-obsidian inline-flex items-center gap-2 shadow-2xs cursor-pointer disabled:opacity-50"
                        >
                          <span
                            className={`w-6 h-6 rounded-full inline-flex items-center justify-center shrink-0 ${pill.iconTint}`}
                          >
                            <Icon size={13} weight="bold" />
                          </span>
                          <span className="font-medium">{pill.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  {history.map((msg, idx) => {
                    const isUser = msg.role === 'user';
                    const isPassBanner = msg.verdict === 'PASS';
                    const isEscalateBanner = msg.verdict === 'ESCALATE';
                    const isLastAssistant = idx === lastAssistantIdx;

                    if (isPassBanner) {
                      return (
                        <div
                          key={msg.id || idx}
                          className="self-end w-full flex flex-row-reverse items-start gap-3"
                        >
                          <PrismOrbAvatar />
                          <div className="flex-1 max-w-[84%] bg-surface border border-hairline prism-aura rounded-2xl rounded-tl-[4px] p-5 shadow-xs">
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <div className="flex items-center gap-2">
                                <CheckCircle
                                  size={16}
                                  weight="bold"
                                  className="text-emerald shrink-0"
                                />
                                <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-sm bg-emerald-tint text-emerald border border-emerald/30">
                                  PASS
                                </span>
                                <span dir="ltr" className="font-mono text-xs text-slate-ink">
                                  {decodeHtmlEntities(msg.agent || 'The Adjudicator')}
                                </span>
                              </div>
                              <span
                                className="font-mono text-[11px] tabular-nums text-muted"
                                dir="ltr"
                              >
                                {msg.timestamp}
                              </span>
                            </div>
                            <MarkdownRenderer content={msg.text} stripEmojis />
                            <div className="mt-4 pt-3 border-t border-hairline flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => onNavigateView('view-artifacts', 'prompt')}
                                className="btn-obsidian rounded-md px-3.5 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <span>צפה בפרומפט המאושר</span>
                                <ArrowLeft size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (isEscalateBanner) {
                      return (
                        <div
                          key={msg.id || idx}
                          className="self-end w-full flex flex-row-reverse items-start gap-3"
                        >
                          <PrismOrbAvatar />
                          <div className="flex-1 max-w-[84%] bg-crimson-tint/40 border border-crimson/30 rounded-2xl rounded-tl-[4px] p-5">
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <div className="flex items-center gap-2">
                                <Warning
                                  size={16}
                                  weight="bold"
                                  className="text-crimson shrink-0"
                                />
                                <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-sm bg-crimson-tint text-crimson border border-crimson/30">
                                  ESCALATE
                                </span>
                                <span dir="ltr" className="font-mono text-xs text-slate-ink">
                                  {decodeHtmlEntities(msg.agent || 'Circuit Breaker')}
                                </span>
                              </div>
                              <span
                                className="font-mono text-[11px] tabular-nums text-muted"
                                dir="ltr"
                              >
                                {msg.timestamp}
                              </span>
                            </div>
                            <MarkdownRenderer content={msg.text} stripEmojis />
                            <div className="mt-4 pt-3 border-t border-crimson/20 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => onNavigateView('view-qa')}
                                className="rounded-md border border-crimson bg-surface text-crimson hover:bg-crimson hover:text-white px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 canon-transition cursor-pointer"
                              >
                                <span>פתח מעבדת QA לתיקון</span>
                                <ArrowLeft size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (isUser) {
                      return (
                        <div
                          key={msg.id || idx}
                          className="self-start flex flex-col items-start max-w-[78%]"
                        >
                          {msg.is_override && (
                            <span className="mb-1 inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded-full bg-amber-tint border border-amber/30 text-amber font-medium">
                              <Lightning size={11} weight="bold" />
                              Override
                            </span>
                          )}
                          <div className="bg-[#181A20] text-white rounded-2xl rounded-tr-[4px] px-4 py-3 shadow-sm font-sans text-[15px] leading-relaxed">
                            <p dir="auto" className="whitespace-pre-wrap">
                              {msg.text}
                            </p>
                          </div>
                          <span
                            dir="ltr"
                            className="mt-1 px-1 font-mono text-[11px] tabular-nums text-muted"
                          >
                            {msg.timestamp}
                          </span>
                        </div>
                      );
                    }

                    let contextualCta: { label: string; onClick: () => void } | null = null;
                    if (isLastAssistant && session) {
                      if (status === 'passed') {
                        contextualCta = {
                          label: 'צפה בפרומפט המאושר',
                          onClick: () => onNavigateView('view-artifacts', 'prompt'),
                        };
                      } else if (status === 'escalated') {
                        contextualCta = {
                          label: 'פתח מעבדת QA לתיקון',
                          onClick: () => onNavigateView('view-qa'),
                        };
                      } else if (hasPrompt) {
                        contextualCta = {
                          label: 'צפה בפרומפט',
                          onClick: () => onNavigateView('view-artifacts', 'prompt'),
                        };
                      } else if (hasBlueprint) {
                        contextualCta = {
                          label: 'צפה ב-XML Blueprint',
                          onClick: () => onNavigateView('view-artifacts', 'blueprint'),
                        };
                      }
                    }

                    return (
                      <div
                        key={msg.id || idx}
                        className="self-end w-full flex flex-row-reverse items-start gap-3"
                      >
                        <PrismOrbAvatar />
                        <div className="flex flex-col items-end max-w-[84%]">
                          <div className="flex items-center gap-2 font-mono text-[11px] text-muted mb-1.5">
                            <span dir="ltr">
                              {decodeHtmlEntities(msg.agent || 'The Helper • ארכיטקט דרישות')}
                            </span>
                            <span dir="ltr" className="tabular-nums">
                              · {msg.timestamp}
                            </span>
                          </div>

                          <div className="w-full bg-surface border border-hairline rounded-2xl rounded-tl-[4px] px-5 py-4 shadow-xs">
                            <MarkdownRenderer
                              content={stripDecorativeEmojis(msg.text)}
                              stripEmojis
                            />

                            {msg.thought && (
                              <details className="mt-3 border border-hairline rounded-md bg-porcelain/70">
                                <summary className="px-3 py-2 text-xs text-slate-ink cursor-pointer select-none inline-flex items-center gap-1.5">
                                  <Cpu size={13} className="text-muted" />
                                  <span>
                                    הצג תהליך חשיבה סמוי (
                                    <code dir="ltr" className="font-mono text-[11px]">
                                      &lt;thought_process&gt;
                                    </code>
                                    )
                                  </span>
                                </summary>
                                <pre
                                  dir="ltr"
                                  className="border-t border-hairline p-3 font-mono text-xs text-slate-ink whitespace-pre-wrap overflow-x-auto bg-porcelain"
                                >
                                  {msg.thought}
                                </pre>
                              </details>
                            )}

                            {contextualCta && (
                              <div className="mt-3 pt-3 border-t border-hairline">
                                <button
                                  type="button"
                                  onClick={contextualCta.onClick}
                                  className="prism-interactive rounded-md border border-hairline bg-porcelain hover:bg-surface text-obsidian px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <span>{contextualCta.label}</span>
                                  <ArrowLeft size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {showPendingOptimistic && (
                    <div className="self-start flex flex-col items-start max-w-[78%]">
                      <div className="bg-[#181A20] text-white rounded-2xl rounded-tr-[4px] px-4 py-3 shadow-sm font-sans text-[15px] leading-relaxed">
                        <p dir="auto" className="whitespace-pre-wrap">
                          {pendingUserMessage}
                        </p>
                      </div>
                      <span dir="ltr" className="mt-1 px-1 font-mono text-[11px] text-muted">
                        כעת
                      </span>
                    </div>
                  )}

                  {/* Live Streaming Typing Indicator with 3 Breathing Optical Prism Dots */}
                  {isStreaming && (
                    <div className="self-end w-full flex flex-row-reverse items-start gap-3">
                      <PrismOrbAvatar />
                      <div className="bg-surface border border-hairline prism-aura rounded-2xl rounded-tl-[4px] px-4 py-3 shadow-xs inline-flex items-center gap-3">
                        <div className="inline-flex items-center gap-1.5" dir="ltr">
                          <span
                            className="w-2 h-2 rounded-full bg-prism-cyan animate-prism-dot"
                            style={{ animationDelay: '0ms' }}
                          />
                          <span
                            className="w-2 h-2 rounded-full bg-prism-violet animate-prism-dot"
                            style={{ animationDelay: '160ms' }}
                          />
                          <span
                            className="w-2 h-2 rounded-full bg-prism-peach animate-prism-dot"
                            style={{ animationDelay: '320ms' }}
                          />
                        </div>
                        <span className="text-xs text-slate-ink">
                          {activeStreamingDesc || 'מעבד דרישות ומפעיל סוכנים...'}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Floating Prism Chat Composer Docked Over Bottom Scroll Gradient */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-surface via-surface/95 to-transparent pt-8 pb-5 px-4 lg:px-8">
            <form
              onSubmit={handleSubmit}
              className="pointer-events-auto max-w-3xl mx-auto bg-surface border border-hairline-strong rounded-2xl shadow-lg shadow-obsidian/5 prism-composer overflow-hidden"
            >
              {isOverrideMode && (
                <div className="bg-amber-tint border-b border-amber/25 px-4 py-2 text-xs text-ink flex items-center gap-2">
                  <Lightning size={13} weight="bold" className="text-amber shrink-0" />
                  <span>
                    <strong>
                      מצב הנחיה ישירה ל-
                      <bdi dir="ltr" className="font-mono">
                        The Upgrader
                      </bdi>
                      :
                    </strong>{' '}
                    כל הוראה שתכתוב תועבר לעריכה אטומית ותיבדק מחדש ב-QA.
                  </span>
                </div>
              )}

              <div className="px-3.5 py-2.5 flex items-end gap-2.5">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    resizeTextarea(e.target);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder={
                    isOverrideMode
                      ? "כתוב הנחיית שדרוג או תיקון עבור The Upgrader..."
                      : 'תאר את הסוכן או ה-Skill שברצונך לבנות... (Enter לשליחה, Shift+Enter לשורה חדשה)'
                  }
                  className="flex-1 resize-none bg-transparent px-1.5 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none min-h-[44px] max-h-[160px]"
                />
                <button
                  type="submit"
                  disabled={!hasDraftText || isStreaming}
                  className={`h-9 px-4 rounded-xl text-sm font-medium inline-flex items-center gap-1.5 shrink-0 canon-transition ${
                    hasDraftText && !isStreaming
                      ? 'btn-obsidian cursor-pointer'
                      : 'bg-recessed text-muted border border-hairline cursor-not-allowed'
                  }`}
                >
                  <span>שלח</span>
                  <PaperPlaneTilt size={14} weight="bold" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Left Sticky Margin Rail — Specification Dossier */}
      <aside className="bg-porcelain/90 lg:border-r lg:border-hairline p-6 lg:sticky lg:top-[58px] lg:h-[calc(100vh-58px)] lg:overflow-y-auto flex flex-col">
        {/* Giant Geometric Readiness Metric (0% Fixed — No Dash) */}
        <div className="pb-5">
          <div
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-2"
            dir="ltr"
          >
            COMPILATION READINESS
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-5xl font-bold tracking-[-0.03em] tabular-nums text-ink leading-none">
              {displayReadiness}%
            </span>
            <span className="text-xs text-slate-ink">מוכנות להידור</span>
          </div>
          <div className="mt-4">
            <GlassGaugeTube
              percent={displayReadiness}
              variant={status === 'passed' ? 'emerald' : 'prism'}
              height="md"
            />
          </div>
        </div>

        {/* Hairline Dossier Rows */}
        <div className="border-t border-hairline py-3.5 flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-muted" dir="ltr">
            Target Type
          </span>
          <span
            dir="ltr"
            className="font-mono text-[11px] font-medium px-2 py-0.5 rounded-sm border border-hairline bg-surface text-obsidian"
          >
            {targetType}
          </span>
        </div>

        <div className="border-t border-hairline py-3.5">
          <div className="font-mono text-[11px] text-muted mb-1" dir="ltr">
            Slug
          </div>
          <div dir="ltr" className="font-mono text-xs break-all text-obsidian">
            {slugName || '—'}
          </div>
        </div>

        <div className="border-t border-hairline py-3.5 flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-muted" dir="ltr">
            Gate Status
          </span>
          <span
            dir="ltr"
            className={`font-mono text-[11px] font-medium px-2 py-0.5 rounded-sm border ${gateStatusMeta.cls}`}
          >
            {gateStatusMeta.label}
          </span>
        </div>

        {/* Readiness Dimensions Checklist */}
        <div className="border-t border-hairline py-4">
          <div className="font-mono text-[11px] text-muted mb-3" dir="ltr">
            Readiness Dimensions (Gate 1)
          </div>
          <ul className="space-y-2.5">
            {readinessDims.map((dim) => (
              <li
                key={dim.key}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="inline-flex items-center gap-2 text-ink">
                  {dim.ok ? (
                    <CheckCircle size={14} weight="fill" className="text-emerald shrink-0" />
                  ) : (
                    <Circle size={14} className="text-muted shrink-0" />
                  )}
                  <span>{dim.label}</span>
                </span>
                <span className="font-mono text-[11px] tabular-nums text-muted" dir="ltr">
                  {readiness.used_decision_model
                    ? `${Math.round(dim.score * 100)}%`
                    : dim.key}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Active Phase Status */}
        <div className="border-t border-hairline pt-4 mt-auto">
          <div
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-1.5"
            dir="ltr"
          >
            ACTIVE PHASE STATUS
          </div>
          <p className="text-xs text-slate-ink leading-relaxed">{activePhaseText}</p>
          {activeStreamingNode && (
            <div className="mt-2 font-mono text-[11px] text-obsidian" dir="ltr">
              {activeStreamingNode}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
