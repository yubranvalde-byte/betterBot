import { Lock } from '@phosphor-icons/react';
import type { EffortTier } from '../../types/api';
import { Tooltip } from '../Tooltip';

interface EffortTierSelectorProps {
  value: EffortTier;
  isMasterMode: boolean;
  disabled?: boolean;
  compact?: boolean;
  onChange: (tier: EffortTier) => void;
  onRequestMasterUnlock: () => void;
}

const MASTER_ONLY_TIERS = new Set<EffortTier>(['high', 'overkill']);

const TIER_OPTIONS: Array<{
  id: EffortTier;
  label: string;
  compactLabel: string;
  hint: string;
}> = [
  {
    id: 'low',
    label: 'Fast / נמוך',
    compactLabel: 'נמוך',
    hint: 'מהיר וחסכוני — מתאים לטיוטות וניסויים',
  },
  {
    id: 'medium',
    label: 'Balanced / בינוני',
    compactLabel: 'בינוני',
    hint: 'ברירת מחדל מאוזנת — הידור מהודק ובדיקת סקריפטים',
  },
  {
    id: 'high',
    label: 'Deep / גבוה',
    compactLabel: 'גבוה',
    hint: 'חשיבה עמוקה וסבב ביקורת מחמיר (Master Mode)',
  },
  {
    id: 'overkill',
    label: '🔥 יא אללה הגזמת',
    compactLabel: '🔥 הגזמת',
    hint: 'עומק מקסימלי ללא דילוג על Stage B (Master Mode)',
  },
];

export function EffortTierSelector({
  value,
  isMasterMode,
  disabled = false,
  compact = false,
  onChange,
  onRequestMasterUnlock,
}: EffortTierSelectorProps) {
  return (
    <div
      role="group"
      aria-label="רמת מאמץ וחשיבה"
      className={`inline-flex flex-wrap items-center gap-0.5 rounded-xl border border-hairline bg-white/75 backdrop-blur-md shadow-xs ${
        compact ? 'p-0.5' : 'p-0.5'
      }`}
    >
      {TIER_OPTIONS.map((opt) => {
        const isLocked = MASTER_ONLY_TIERS.has(opt.id) && !isMasterMode;
        const isActive = value === opt.id && !isLocked;

        const button = (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => {
              if (disabled) return;
              if (isLocked) {
                onRequestMasterUnlock();
                return;
              }
              onChange(opt.id);
            }}
            className={`inline-flex items-center gap-1 rounded-lg font-medium whitespace-nowrap canon-transition ${
              compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1 text-[11px]'
            } ${
              disabled
                ? 'opacity-50 cursor-not-allowed text-muted'
                : isLocked
                ? 'text-muted/85 bg-recessed/60 hover:bg-recessed hover:text-slate-ink cursor-pointer border border-transparent'
                : isActive
                ? opt.id === 'overkill'
                  ? 'btn-obsidian shadow-xs prism-aura cursor-pointer'
                  : 'btn-obsidian shadow-xs cursor-pointer'
                : 'text-slate-ink hover:text-obsidian hover:bg-porcelain cursor-pointer'
            }`}
          >
            {isLocked && <Lock size={11} weight="bold" className="text-amber shrink-0" />}
            <span>{compact ? opt.compactLabel : opt.label}</span>
          </button>
        );

        return (
          <Tooltip
            key={opt.id}
            content={isLocked ? 'Master Mode Only' : opt.hint}
            placement="top"
          >
            {button}
          </Tooltip>
        );
      })}
    </div>
  );
}
