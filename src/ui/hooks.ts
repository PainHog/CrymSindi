import { useEffect, useRef, useState } from 'react';

/** True when the viewer has asked for reduced motion; updates live. */
export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduce(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduce;
}

/**
 * Animate a display number toward `value` (ease-out cubic). Snaps instantly
 * under reduced motion. Each change animates from the previous target.
 */
export function useCountUp(value: number, durationMs = 500): number {
  const reduce = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  const raf = useRef(0);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (reduce || durationMs <= 0 || from === value) {
      setDisplay(value);
      return;
    }
    let start = 0;
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(step);
      else setDisplay(value);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, reduce, durationMs]);

  return display;
}
