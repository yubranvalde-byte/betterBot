import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: string;
  children: ReactNode;
  placement?: TooltipPlacement;
  delayMs?: number;
  className?: string;
  dir?: 'rtl' | 'ltr' | 'auto';
}

interface TooltipCoords {
  top: number;
  left: number;
  actualPlacement: TooltipPlacement;
  ready: boolean;
}

const VIEWPORT_MARGIN = 12;
const GAP = 8;

export function Tooltip({
  content,
  children,
  placement = 'top',
  delayMs = 180,
  className = 'inline-flex',
  dir = 'auto',
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<TooltipCoords>({
    top: 0,
    left: 0,
    actualPlacement: placement,
    ready: false,
  });

  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    if (!content.trim()) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setIsOpen(true);
    }, delayMs);
  }, [content, delayMs, clearTimer]);

  const hide = useCallback(() => {
    clearTimer();
    setIsOpen(false);
    setCoords((prev) => (prev.ready ? { ...prev, ready: false } : prev));
  }, [clearTimer]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tip = tooltipRef.current;
    if (!trigger || !tip) return;

    const tr = trigger.getBoundingClientRect();
    const tt = tip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let actualPlacement: TooltipPlacement = placement;

    if (
      actualPlacement === 'top' &&
      tr.top - tt.height - GAP < VIEWPORT_MARGIN &&
      tr.bottom + tt.height + GAP <= vh - VIEWPORT_MARGIN
    ) {
      actualPlacement = 'bottom';
    } else if (
      actualPlacement === 'bottom' &&
      tr.bottom + tt.height + GAP > vh - VIEWPORT_MARGIN &&
      tr.top - tt.height - GAP >= VIEWPORT_MARGIN
    ) {
      actualPlacement = 'top';
    } else if (
      actualPlacement === 'left' &&
      tr.left - tt.width - GAP < VIEWPORT_MARGIN &&
      tr.right + tt.width + GAP <= vw - VIEWPORT_MARGIN
    ) {
      actualPlacement = 'right';
    } else if (
      actualPlacement === 'right' &&
      tr.right + tt.width + GAP > vw - VIEWPORT_MARGIN &&
      tr.left - tt.width - GAP >= VIEWPORT_MARGIN
    ) {
      actualPlacement = 'left';
    }

    let top = 0;
    let left = 0;

    if (actualPlacement === 'top') {
      top = tr.top - tt.height - GAP;
      left = tr.left + tr.width / 2 - tt.width / 2;
    } else if (actualPlacement === 'bottom') {
      top = tr.bottom + GAP;
      left = tr.left + tr.width / 2 - tt.width / 2;
    } else if (actualPlacement === 'left') {
      top = tr.top + tr.height / 2 - tt.height / 2;
      left = tr.left - tt.width - GAP;
    } else {
      top = tr.top + tr.height / 2 - tt.height / 2;
      left = tr.right + GAP;
    }

    left = Math.max(VIEWPORT_MARGIN, Math.min(vw - tt.width - VIEWPORT_MARGIN, left));
    top = Math.max(VIEWPORT_MARGIN, Math.min(vh - tt.height - VIEWPORT_MARGIN, top));

    setCoords({
      top: Math.round(top),
      left: Math.round(left),
      actualPlacement,
      ready: true,
    });
  }, [placement]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  const enterOffset =
    coords.actualPlacement === 'top'
      ? 'translateY(2px)'
      : coords.actualPlacement === 'bottom'
      ? 'translateY(-2px)'
      : coords.actualPlacement === 'left'
      ? 'translateX(2px)'
      : 'translateX(-2px)';

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onMouseDown={hide}
        className={className}
      >
        {children}
      </span>
      {isOpen &&
        content.trim() &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            dir={dir}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              opacity: coords.ready ? 1 : 0,
              transform: coords.ready ? 'translate(0, 0)' : enterOffset,
              transition: 'opacity 120ms ease-out, transform 120ms ease-out',
            }}
            className="bg-[#111216] text-white text-xs font-sans font-medium px-2.5 py-1.5 rounded-lg shadow-lg shadow-black/15 border border-white/10 whitespace-nowrap z-[100] pointer-events-none"
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
