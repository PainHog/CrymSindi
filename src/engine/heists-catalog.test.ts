import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import { HEISTS, HEISTS_BY_ID } from '../data/heists';
import { ROLES_BY_ID } from '../data/roles';
import { isHeistUnlocked } from './selectors';
import { createInitialState } from './state';
import { SLOTS } from '../ui/map/mapSlots';

const T0 = 1_000_000_000_000;
const TIER5_CASH = CONFIG.tierUnlocks[5] ?? 1_200_000;

describe('heist catalog integrity', () => {
  it('every heist is well-formed with valid roles and positive tuning', () => {
    for (const h of HEISTS) {
      expect(h.id).toBeTruthy();
      expect(h.name).toBeTruthy();
      expect(h.description).toBeTruthy();
      expect(h.tier).toBeGreaterThanOrEqual(1);
      expect(h.tier).toBeLessThanOrEqual(5);
      expect(h.durationSec).toBeGreaterThan(0);
      expect(h.payoutPerSec).toBeGreaterThan(0);
      expect(h.heatCost).toBeGreaterThan(0);
      expect(h.difficulty).toBeGreaterThan(0);
      expect(h.failHeatBonus).toBeGreaterThanOrEqual(0);
      for (const r of h.requiredRoles) expect(ROLES_BY_ID[r]).toBeDefined();
    }
  });

  it('has no duplicate ids', () => {
    const ids = HEISTS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tiers do not overlap on payout or difficulty (the progression stays monotonic)', () => {
    const byTier = (t: number) => HEISTS.filter((h) => h.tier === t);
    for (let t = 1; t < 5; t++) {
      const lower = byTier(t);
      const upper = byTier(t + 1);
      if (lower.length === 0 || upper.length === 0) continue;
      const maxPayLower = Math.max(...lower.map((h) => h.payoutPerSec));
      const minPayUpper = Math.min(...upper.map((h) => h.payoutPerSec));
      expect(minPayUpper).toBeGreaterThan(maxPayLower);
      const maxDiffLower = Math.max(...lower.map((h) => h.difficulty));
      const minDiffUpper = Math.min(...upper.map((h) => h.difficulty));
      expect(minDiffUpper).toBeGreaterThan(maxDiffLower);
    }
  });

  it('the full board (every heist + the contract) fits the map slots', () => {
    // MapView plants pins at SLOTS[i % SLOTS.length]; overflowing would overlap.
    expect(HEISTS.length + 1).toBeLessThanOrEqual(SLOTS.length);
  });
});

describe('capstone ascension gate', () => {
  const cap = HEISTS_BY_ID['sovereign_reserve'];
  const base = createInitialState(T0);
  const tier5 = { ...base, lifetimeCash: TIER5_CASH };

  it('the capstone requires ascension', () => {
    expect(cap.minAscend).toBeGreaterThanOrEqual(1);
  });

  it('is locked at tier 5 until you have ascended', () => {
    expect(isHeistUnlocked({ ...tier5, ascendCount: 0 }, cap)).toBe(false);
    expect(isHeistUnlocked({ ...tier5, ascendCount: 1 }, cap)).toBe(true);
  });

  it('still needs the tier gate: ascended but pre-tier-5 stays locked', () => {
    expect(isHeistUnlocked({ ...base, lifetimeCash: 0, ascendCount: 3 }, cap)).toBe(false);
  });

  it('a normal tier-5 job ignores the ascension gate', () => {
    const central = HEISTS_BY_ID['central_bank'];
    expect(isHeistUnlocked({ ...tier5, ascendCount: 0 }, central)).toBe(true);
  });
});
