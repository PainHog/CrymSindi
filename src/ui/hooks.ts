import { useCallback, useEffect, useRef, useState } from 'react';
import { CONFIG } from '../data/config';
import { deriveHeat, type GameState } from '../engine';
import { rewardedAdsAvailable, showRewardedAd, type AdPlacement } from '../monetization/ads';

export interface HeatSnapshot {
  roundedHeat: number;
  heatMaxed: boolean;
}

/**
 * Current Heat, sampled on the UI tick but exposed ONLY as a rounded value plus
 * a maxed flag. The interval fires at CONFIG.uiTickMs, but setState returns the
 * previous tuple (Object.is bail-out) whenever neither field changed — so a
 * consumer re-renders roughly once every ~12s as Heat cools, instead of 4x/sec
 * like a raw `useNow()` read forces on the whole subtree. Re-syncs immediately
 * when `game` changes (a launch/collect that just moved Heat).
 */
export function useHeatSnapshot(game: GameState): HeatSnapshot {
  const snap = (): HeatSnapshot => {
    const h = deriveHeat(game, Date.now());
    return { roundedHeat: Math.round(h), heatMaxed: h >= CONFIG.maxHeat };
  };
  const [state, setState] = useState<HeatSnapshot>(snap);
  useEffect(() => {
    const tick = () =>
      setState((prev) => {
        const next = snap();
        return prev.roundedHeat === next.roundedHeat && prev.heatMaxed === next.heatMaxed
          ? prev
          : next;
      });
    tick(); // resync now: `game` just changed, so Heat may have jumped
    const id = window.setInterval(tick, CONFIG.uiTickMs);
    return () => window.clearInterval(id);
    // `snap` closes over `game`; re-run whenever the game state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);
  return state;
}

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

/**
 * Drives a rewarded-ad flow: `watch(placement)` shows the (stubbed) ad and
 * resolves true if it completed. `watching` gates the UI while it plays.
 */
export function useRewardedAd() {
  const [watching, setWatching] = useState(false);
  const mounted = useRef(true);
  // Set true on (re)mount too — StrictMode's mount/cleanup/remount would
  // otherwise leave it false and wedge `watching` on after the first ad.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const watch = useCallback(async (placement: AdPlacement): Promise<boolean> => {
    setWatching(true);
    try {
      const { completed } = await showRewardedAd(placement);
      return completed;
    } finally {
      if (mounted.current) setWatching(false);
    }
  }, []);

  return { watching, watch, available: rewardedAdsAvailable() };
}
