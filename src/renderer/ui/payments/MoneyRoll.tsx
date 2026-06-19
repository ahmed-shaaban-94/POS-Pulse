import { useEffect, useRef, useState, type JSX } from 'react';

/**
 * POS v3.5 Phase 3 — <MoneyRoll>.
 *
 * Presentational animated money readout for a PRECOMPUTED minor-unit value
 * (e.g. change-due from `computeChangeDueMinor`). It performs NO money math:
 * the caller owns the value; MoneyRoll only animates the display from the prior
 * value to the new one and formats it. Money stays Latin/mono and `dir="ltr"`
 * even inside the RTL shell (receipt/audit compatibility, README brand rules).
 *
 * Motion: a short cubic ease-out via requestAnimationFrame. Honors
 * `prefers-reduced-motion` by snapping straight to the value (README motion
 * rule). A non-safe-integer value renders an em dash rather than NaN money.
 *
 * Recreated against POS-Pulse conventions from the v3.5 design reference —
 * prototype code not copied.
 */

const DURATION_MS = 520;

function formatMinorUnits(minor: number): string {
  if (!Number.isSafeInteger(minor)) {
    return '—';
  }
  const whole = Math.floor(minor / 100);
  const frac = Math.abs(minor % 100)
    .toString()
    .padStart(2, '0');
  return `${whole.toString()}.${frac}`;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export interface MoneyRollProps {
  /** The value to display, in integer minor units. Precomputed by the caller. */
  valueMinor: number;
  className?: string;
}

export function MoneyRoll({ valueMinor, className }: MoneyRollProps): JSX.Element {
  const [shown, setShown] = useState<number>(valueMinor);
  const fromRef = useRef<number>(valueMinor);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // A non-animatable value (NaN / non-integer) snaps straight through; the
    // formatter renders the dash. Reduced motion snaps to the final value.
    if (!Number.isSafeInteger(valueMinor) || prefersReducedMotion()) {
      setShown(valueMinor);
      fromRef.current = valueMinor;
      return;
    }

    const from = Number.isSafeInteger(fromRef.current) ? fromRef.current : valueMinor;
    const start = performance.now();

    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (valueMinor - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = valueMinor;
      }
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [valueMinor]);

  return (
    <span
      dir="ltr"
      className={`mono money-roll${className ? ` ${className}` : ''}`}
      data-testid="money-roll"
    >
      {formatMinorUnits(shown)}
    </span>
  );
}
