import { useId } from 'react';
import { motion } from 'motion/react';

export type ConduitState = 'idle' | 'ambient' | 'completed' | 'active' | 'amber';

interface SvgIds {
  glassGrad: string;
  prismGrad: string;
  amberGrad: string;
  glowFilter: string;
}

function useOpticalSvgIds(): SvgIds {
  const uid = useId().replace(/:/g, '');
  return {
    glassGrad: `glassTubeGrad-${uid}`,
    prismGrad: `prismPulseGrad-${uid}`,
    amberGrad: `amberPulseGrad-${uid}`,
    glowFilter: `opticalGlow-${uid}`,
  };
}

function OpticalDefs({ ids }: { ids: SvgIds }) {
  return (
    <defs>
      <linearGradient id={ids.glassGrad} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.96" />
        <stop offset="50%" stopColor="#EDF1F7" stopOpacity="0.88" />
        <stop offset="100%" stopColor="#D8DFE9" stopOpacity="0.9" />
      </linearGradient>
      <linearGradient id={ids.prismGrad} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="50%" stopColor="#818CF8" />
        <stop offset="100%" stopColor="#FB923C" />
      </linearGradient>
      <linearGradient id={ids.amberGrad} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#D97706" />
        <stop offset="50%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#FB923C" />
      </linearGradient>
      <filter id={ids.glowFilter} x="-15%" y="-40%" width="130%" height="180%">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

function PortCollar({
  x,
  y,
  orientation = 'vertical',
  state,
}: {
  x: number;
  y: number;
  orientation?: 'vertical' | 'horizontal';
  state: ConduitState;
}) {
  const dotColor =
    state === 'completed'
      ? '#0E9F6E'
      : state === 'active' || state === 'ambient'
      ? '#818CF8'
      : state === 'amber'
      ? '#D97706'
      : '#94A3B8';

  if (orientation === 'horizontal') {
    return (
      <g>
        <rect
          x={x - 7}
          y={y - 3}
          width={14}
          height={6}
          rx={2.5}
          fill="#FFFFFF"
          stroke="#CBD5E1"
          strokeWidth={1.2}
        />
        <circle cx={x} cy={y} r={1.6} fill={dotColor} />
      </g>
    );
  }

  return (
    <g>
      <rect
        x={x - 3}
        y={y - 7}
        width={6}
        height={14}
        rx={2.5}
        fill="#FFFFFF"
        stroke="#CBD5E1"
        strokeWidth={1.2}
      />
      <circle cx={x} cy={y} r={1.6} fill={dotColor} />
    </g>
  );
}

function OpticalConduitLayers({
  d,
  state,
  ids,
  reverseFlow = false,
}: {
  d: string;
  state: ConduitState;
  ids: SvgIds;
  reverseFlow?: boolean;
}) {
  return (
    <>
      {/* Layer 1: Recessed Porcelain Channel */}
      <path d={d} fill="none" stroke="#E2E6EE" strokeWidth={12} strokeLinecap="round" />

      {/* Layer 2: Borosilicate Glass Tube Body + Top Specular Highlight */}
      <path
        d={d}
        fill="none"
        stroke={`url(#${ids.glassGrad})`}
        strokeWidth={8}
        strokeLinecap="round"
        opacity={0.92}
      />
      <path
        d={d}
        fill="none"
        stroke="rgba(255, 255, 255, 0.95)"
        strokeWidth={1.5}
        strokeLinecap="round"
        transform="translate(0, -2)"
      />

      {/* Layer 3: Permanent Subtle Internal Prismatic Core (Alive-at-Idle Fiber Optics) */}
      <path
        d={d}
        fill="none"
        stroke={`url(#${ids.prismGrad})`}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={state === 'idle' || state === 'ambient' ? 0.22 : 0.14}
      />

      {/* State-Driven Optical Core Overlay */}
      {state === 'ambient' && (
        <path
          d={d}
          fill="none"
          stroke={`url(#${ids.prismGrad})`}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray="28 212"
          opacity={0.78}
          className="animate-optical-flow-ambient"
          filter={`url(#${ids.glowFilter})`}
        />
      )}

      {state === 'completed' && (
        <path
          d={d}
          fill="none"
          stroke="#10B981"
          strokeWidth={2.5}
          strokeLinecap="round"
          filter={`url(#${ids.glowFilter})`}
        />
      )}

      {state === 'active' && (
        <path
          d={d}
          fill="none"
          stroke={`url(#${ids.prismGrad})`}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeDasharray="36 204"
          className="animate-optical-flow-fast"
          style={reverseFlow ? { animationDirection: 'reverse' } : undefined}
          filter={`url(#${ids.glowFilter})`}
        />
      )}

      {state === 'amber' && (
        <>
          <path
            d={d}
            fill="none"
            stroke="#FDE68A"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <path
            d={d}
            fill="none"
            stroke={`url(#${ids.amberGrad})`}
            strokeWidth={3.4}
            strokeLinecap="round"
            strokeDasharray="36 204"
            className="animate-optical-flow-fast"
            style={reverseFlow ? { animationDirection: 'reverse' } : undefined}
            filter={`url(#${ids.glowFilter})`}
          />
        </>
      )}
    </>
  );
}

interface HorizontalConduitSegmentProps {
  state: ConduitState;
  label?: string;
  bidirectional?: boolean;
}

export function HorizontalConduitSegment({
  state,
  label,
  bidirectional = false,
}: HorizontalConduitSegmentProps) {
  const ids = useOpticalSvgIds();
  const pathD = 'M 6 20 C 30 20, 56 20, 80 20';

  return (
    <div className="flex xl:flex-col items-center justify-center gap-1 py-1 xl:py-0 xl:px-0.5 min-w-[68px]">
      {label && (
        <span
          className={`font-mono text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${
            state === 'active'
              ? 'bg-surface border-hairline-strong text-obsidian prism-aura'
              : state === 'ambient'
              ? 'bg-surface border-hairline text-slate-ink prism-aura'
              : state === 'amber'
              ? 'bg-amber-tint border-amber/30 text-amber font-medium'
              : state === 'completed'
              ? 'bg-emerald-tint border-emerald/30 text-emerald font-medium'
              : 'bg-porcelain border-hairline text-muted'
          }`}
        >
          {label}
        </span>
      )}

      <svg
        viewBox="0 0 86 40"
        className="w-16 xl:w-20 h-8 rotate-90 xl:rotate-0 shrink-0 overflow-visible"
        aria-hidden="true"
      >
        <OpticalDefs ids={ids} />
        <OpticalConduitLayers
          d={pathD}
          state={state}
          ids={ids}
          reverseFlow={bidirectional && state === 'amber'}
        />
        <PortCollar x={5} y={20} orientation="vertical" state={state} />
        <PortCollar x={81} y={20} orientation="vertical" state={state} />
      </svg>
    </div>
  );
}

interface HillClimbingFeedbackConduitProps {
  state: ConduitState;
  label?: string;
  iterationCount: number;
}

export function HillClimbingFeedbackConduit({
  state,
  label = 'Hill Climbing Loop',
  iterationCount,
}: HillClimbingFeedbackConduitProps) {
  const ids = useOpticalSvgIds();
  const feedbackPath =
    'M 82 5 C 82 44, 102 48, 138 48 L 282 48 C 318 48, 338 44, 338 5';

  return (
    <div className="hidden xl:flex flex-col items-center -mt-1 px-2">
      <svg
        viewBox="0 0 420 68"
        className="w-full h-16 overflow-visible"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <OpticalDefs ids={ids} />
        <OpticalConduitLayers d={feedbackPath} state={state} ids={ids} />
        <PortCollar x={82} y={4} orientation="horizontal" state={state} />
        <PortCollar x={338} y={4} orientation="horizontal" state={state} />
      </svg>

      <div className="-mt-6 relative z-10 flex items-center gap-1.5">
        <span
          className={`font-mono text-[10px] px-2.5 py-0.5 rounded-full border shadow-[0_1px_2px_rgba(17,18,22,0.04)] whitespace-nowrap ${
            state === 'amber'
              ? 'bg-amber-tint border-amber/40 text-amber font-medium'
              : state === 'completed'
              ? 'bg-emerald-tint border-emerald/30 text-emerald font-medium'
              : 'bg-surface border-hairline text-slate-ink'
          }`}
        >
          {label}
          {iterationCount > 0 ? ` · #${iterationCount}` : ''}
        </span>
      </div>
    </div>
  );
}

export function MicroConduitConnector({ state }: { state: ConduitState }) {
  const ids = useOpticalSvgIds();
  const d = 'M 2 6 L 26 6';

  return (
    <svg
      viewBox="0 0 28 12"
      className="hidden md:block w-5 lg:w-7 h-3 shrink-0 self-center"
      aria-hidden="true"
    >
      <OpticalDefs ids={ids} />
      <path d={d} fill="none" stroke="#E2E6EE" strokeWidth={5} strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        stroke={`url(#${ids.glassGrad})`}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <path
        d={d}
        fill="none"
        stroke={`url(#${ids.prismGrad})`}
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.22}
      />
      {state === 'completed' && (
        <path d={d} fill="none" stroke="#10B981" strokeWidth={1.6} strokeLinecap="round" />
      )}
      {state === 'ambient' && (
        <path
          d={d}
          fill="none"
          stroke={`url(#${ids.prismGrad})`}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeDasharray="8 20"
          opacity={0.75}
          className="animate-optical-flow-ambient"
        />
      )}
      {state === 'active' && (
        <path
          d={d}
          fill="none"
          stroke={`url(#${ids.prismGrad})`}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="10 18"
          className="animate-optical-flow-fast"
        />
      )}
    </svg>
  );
}

interface GlassGaugeTubeProps {
  percent: number;
  variant?: 'prism' | 'emerald' | 'amber' | 'crimson';
  height?: 'xs' | 'sm' | 'md';
  className?: string;
}

export function GlassGaugeTube({
  percent,
  variant = 'emerald',
  height = 'sm',
  className = '',
}: GlassGaugeTubeProps) {
  const clamped = Math.max(0, Math.min(100, percent));

  const heightCls =
    height === 'xs' ? 'h-1.5' : height === 'md' ? 'h-2.5' : 'h-2';

  const fillStyle =
    variant === 'prism'
      ? 'bg-gradient-to-r from-prism-cyan via-prism-violet to-prism-peach'
      : variant === 'amber'
      ? 'bg-gradient-to-r from-amber to-prism-peach'
      : variant === 'crimson'
      ? 'bg-crimson'
      : 'bg-gradient-to-r from-emerald to-[#34D399]';

  return (
    <div
      dir="ltr"
      className={`relative w-full ${heightCls} rounded-full bg-recessed border border-hairline-strong/80 shadow-[inset_0_1px_2px_rgba(17,18,22,0.08)] overflow-hidden ${className}`}
    >
      <motion.div
        initial={false}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
        className={`h-full rounded-full ${fillStyle}`}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0.5 top-0 h-[40%] rounded-full bg-gradient-to-b from-white/75 to-transparent"
      />
    </div>
  );
}
