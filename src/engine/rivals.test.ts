import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import {
  msUntilNextRival,
  rivalContestFor,
  rivalContestsHeist,
  rivalForWindow,
  rivalNow,
  rivalSpoilsFor,
  rivalWindowIndex,
} from './rivals';
import { HEISTS } from '../data/heists';

const always = { ...CONFIG, rivalChance: 1 }; // every window runs a contest
const never = { ...CONFIG, rivalChance: 0 }; // no window runs a contest

describe('rival contest — determinism & windowing', () => {
  it('is a pure function of the window index', () => {
    for (const i of [0, 1, 7, 42, 1000]) {
      expect(rivalForWindow(i)).toEqual(rivalForWindow(i));
    }
  });

  it('picks a real rival and a real catalog heist when active', () => {
    const known = new Set(HEISTS.map((h) => h.id));
    for (let i = 0; i < 30; i++) {
      const c = rivalForWindow(i, always);
      expect(c).not.toBeNull();
      expect(known.has(c!.heistId)).toBe(true);
      expect(c!.rival.name.length).toBeGreaterThan(0);
      expect(c!.index).toBe(i);
    }
  });

  it('runs no contest when the chance is zero, and one every window when it is one', () => {
    for (let i = 0; i < 20; i++) {
      expect(rivalForWindow(i, never)).toBeNull();
      expect(rivalForWindow(i, always)).not.toBeNull();
    }
  });

  it('advances the window index across the window boundary', () => {
    const period = CONFIG.rivalWindowSec * 1000;
    const base = 5_000_000_000;
    const i0 = rivalWindowIndex(base);
    expect(rivalWindowIndex(base + period)).toBe(i0 + 1);
  });

  it('msUntilNextRival stays within (0, period]', () => {
    const period = CONFIG.rivalWindowSec * 1000;
    for (const t of [0, 1, 123456, 999_999_999]) {
      const ms = msUntilNextRival(t);
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(period);
    }
  });
});

describe('rival contest — per-heist lookup', () => {
  it('flags exactly the contested heist right now', () => {
    const now = 5 * CONFIG.rivalWindowSec * 1000 + 1000; // some window
    const c = rivalNow(now, always);
    expect(c).not.toBeNull();
    expect(rivalContestsHeist(c!.heistId, now, always)).toBe(true);
    expect(rivalContestFor(c!.heistId, now, always)?.rival.id).toBe(c!.rival.id);

    const other = HEISTS.find((h) => h.id !== c!.heistId)!;
    expect(rivalContestsHeist(other.id, now, always)).toBe(false);
  });

  it('flags nothing during a quiet window', () => {
    const now = 3 * CONFIG.rivalWindowSec * 1000 + 500;
    expect(rivalNow(now, never)).toBeNull();
    for (const h of HEISTS) expect(rivalContestsHeist(h.id, now, never)).toBe(false);
  });
});

describe('rival spoils', () => {
  it('is the configured fraction of the take, rounded, floored at zero', () => {
    expect(rivalSpoilsFor(1000, { ...CONFIG, rivalSpoilsFrac: 0.5 })).toBe(500);
    expect(rivalSpoilsFor(333, { ...CONFIG, rivalSpoilsFrac: 0.5 })).toBe(167); // round
    expect(rivalSpoilsFor(0)).toBe(0);
    expect(rivalSpoilsFor(-50)).toBe(0);
  });
});
