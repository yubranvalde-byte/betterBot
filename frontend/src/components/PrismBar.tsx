interface PrismBarProps {
  value: number;
  variant?: 'prism' | 'warning';
  className?: string;
}

export function PrismBar({ value, variant = 'prism', className = '' }: PrismBarProps) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const fillGradient =
    variant === 'warning'
      ? 'linear-gradient(90deg, #F59E0B 0%, #EF4444 100%)'
      : 'linear-gradient(90deg, #38BDF8 0%, #818CF8 52%, #FB923C 100%)';

  return (
    <div
      dir="ltr"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-[6px] w-full rounded-full bg-[#EAEDF3] overflow-hidden relative ${className}`}
    >
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{
          width: `${clamped}%`,
          background: fillGradient,
        }}
      />
    </div>
  );
}
