import type { ModelTelemetryEntry } from '../types/api';

const NAMED_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

export function decodeHtmlEntities(input: string | null | undefined): string {
  if (!input) return '';
  let out = String(input);
  // Decode iteratively up to twice in case values were double-encoded
  for (let i = 0; i < 2; i++) {
    const next = out
      .replace(/&(amp|lt|gt|quot|apos|nbsp);|&#39;/gi, (m) => NAMED_ENTITIES[m.toLowerCase()] ?? m)
      .replace(/&#(\d+);/g, (_, dec) => {
        const code = Number.parseInt(dec, 10);
        return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : _;
      })
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
        const code = Number.parseInt(hex, 16);
        return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : _;
      });
    if (next === out) break;
    out = next;
  }
  return out;
}

const DECORATIVE_EMOJI_RE =
  /[\u{1F31F}\u{26A0}\u{2705}\u{1F504}\u{26A1}\u{1F527}\u{1F6E0}\u{1F9E0}\u{2728}\u{1F4CB}\u{1F50D}\u{1F680}\uFE0F]/gu;

export function stripDecorativeEmojis(input: string | null | undefined): string {
  if (!input) return '';
  return String(input)
    .replace(DECORATIVE_EMOJI_RE, '')
    .replace(/^[ \t]+|[ \t]+$/gm, (m) => (m.length > 0 && m === ' ' ? ' ' : m))
    .replace(/\s{2,}/g, (match) => (match.includes('\n') ? match : ' '))
    .trim();
}

export function formatRelativeTime(isoOrClock: string | undefined): string {
  if (!isoOrClock) return '';
  const parsed = Date.parse(isoOrClock);
  if (Number.isNaN(parsed)) return isoOrClock;
  const diffSec = Math.max(0, Math.floor((Date.now() - parsed) / 1000));
  if (diffSec < 60) return 'עכשיו';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `לפני ${diffMin} דק'`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `לפני ${diffHrs} שע'`;
  return new Date(parsed).toLocaleDateString('he-IL');
}

export function formatElapsedSeconds(totalSec: number): string {
  const mins = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const secs = String(totalSec % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

export function formatModelBadgeText(info?: Pick<ModelTelemetryEntry, 'model' | 'thinking_level' | 'fallback_used'> | null): string {
  if (!info || !info.model) return '';
  const levelMap: Record<string, string> = {
    medium: 'med',
    low: 'low',
    high: 'high',
    none: 'fast',
  };
  const lvl = (info.thinking_level && levelMap[info.thinking_level]) || info.thinking_level || '';
  if (info.fallback_used) {
    return lvl ? `fallback → ${info.model} · ${lvl}` : `fallback → ${info.model}`;
  }
  return lvl ? `${info.model} · ${lvl}` : info.model;
}
