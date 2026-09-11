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
 * Animate a display number toward `value` (ease-out cubic), always starting
 * from what's currently on screen so back-to-back changes don't jump. Snaps
 * instantly under reduced motion, and (with `snapOnDecrease`) when the value
 * drops — so spending cash doesn't count downward.
 */
export function useCountUp(value: number, durationMs = 500, snapOnDecrease = false): number {
  const reduce = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const raf = useRef(0);

  const set = (v: number) => {
    displayRef.current = v;
    setDisplay(v);
  };

  useEffect(() => {
    const from = displayRef.current;
    if (reduce || durationMs <= 0 || from === value || (snapOnDecrease && value < from)) {
      set(value);
      return;
    }
    let start = 0;
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      if (p < 1) {
        set(from + (value - from) * eased);
        raf.current = requestAnimationFrame(step);
      } else {
        set(value);
      }
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // `set`/displayRef are stable; intentionally keyed on value/reduce/duration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce, durationMs, snapOnDecrease]);

  return display;
}
