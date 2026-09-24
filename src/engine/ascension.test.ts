import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import { LEGEND_PERKS_BY_ID, legendPerkCost } from '../data/legendPerks';
import { createInitialState, loadGame } from './state';
import { ascend, buyLegendPerk } from './economy';
import {
  canAscend,
  legendGainFor,
  legendNotorietyMult,
  legendPayoutMult,
  legendPerkLevel,
  legendStartCash,
} from './selectors';
import type { GameState } from './types';

const T0 = 1_000_000_000_000;

describe('ascension selectors', () => {
  it('legendGainFor follows floor(sqrt(notoriety / divisor)) and is 0 at 0', () => {
    expect(legendGainFor(0)).toBe(0);
    expect(legendGainFor(-5)).toBe(0);
    expect(legendGainFor(CONFIG.legendDivisor)).toBe(1); // sqrt(1) = 1
    expect(legendGainFor(200)).toBe(Math.floor(Math.sqrt(200 / CONFIG.legendDivisor)));
  });

  it('canAscend gates on the Notoriety threshold', () => {
    const base = createInitialState(T0);
    expect(canAscend({ ...base, notoriety: CONFIG.ascendThreshold - 1 })).toBe(false);
    expect(canAscend({ ...base, notoriety: CONFIG.ascendThreshold })).toBe(true);
  });

  it('legend perk effect selectors scale with level', () => {
    const base = createInitialState(T0);
    const s: GameState = { ...base, legendPerks: { kingpin: 3, rep_engine: 2, deep_pockets: 4 } };
    expect(legendPerkLevel(s, 'kingpin')).toBe(3);
    expect(legendPayoutMult(s)).toBeCloseTo(1 + CONFIG.legendKingpinPct * 3, 5);
    expect(legendNotorietyMult(s)).toBeCloseTo(1 + CONFIG.legendRepEnginePct * 2, 5);
    expect(legendStartCash(s)).toBe(CONFIG.legendDeepPocketsCash * 4);
    // Neutral with no legend perks.
    expect(legendPayoutMult(base)).toBe(1);
    expect(legendStartCash(base)).toBe(0);
  });
});

describe('ascend action', () => {
  function ready(): GameState {
    return {
      ...createInitialState(T0),
      cash: 999_999,
      lifetimeCash: 500_000,
      notoriety: 200,
      perks: { reputation: 4, connections: 2 },
      prestigeCount: 3,
      contractLevel: 5,
      careerCash: 7_777,
      marks: 9,
      legend: 1,
      legendPerks: { kingpin: 2 },
      ascendCount: 1,
      stats: { heistsCompleted: 40, heistsSucceeded: 30, flawless: 5, biggestScore: 123 },
      milestonesEarned: ['gone_legit'],
      dailyStreak: 6,
    };
  }

  it('refuses below the Notoriety threshold', () => {
    const s = { ...ready(), notoriety: CONFIG.ascendThreshold - 1 };
    const r = ascend(s, T0);
    expect(r.ok).toBe(false);
  });

  it('grants Legend and burns the Notoriety layer, keeping career + legend layers', () => {
    const s = ready();
    const gain = legendGainFor(s.notoriety); // floor(sqrt(200/40)) = 2
    const r = ascend(s, T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const n = r.state;
    // Legend layer + career totals carry over.
    expect(n.legend).toBe(1 + gain);
    expect(n.legendPerks).toEqual({ kingpin: 2 });
    expect(n.ascendCount).toBe(2);
    expect(n.careerCash).toBe(7_777);
    expect(n.marks).toBe(9);
    expect(n.stats.heistsCompleted).toBe(40);
    expect(n.milestonesEarned).toEqual(['gone_legit']);
    expect(n.dailyStreak).toBe(6);
    // Notoriety layer + run are reset.
    expect(n.notoriety).toBe(0);
    expect(n.perks).toEqual({});
    expect(n.prestigeCount).toBe(0);
    expect(n.contractLevel).toBe(0);
    expect(n.lifetimeCash).toBe(0);
    expect(n.cash).toBe(createInitialState(T0).cash);
    expect(n.members).toHaveLength(3);
  });

  it('accumulates Legend across repeated ascensions', () => {
    let s = ready();
    const first = ascend(s, T0);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    // Rebuild Notoriety and ascend again; Legend keeps stacking.
    s = { ...first.state, notoriety: 400 };
    const second = ascend(s, T0);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.state.legend).toBe(first.state.legend + legendGainFor(400));
    expect(second.state.ascendCount).toBe(3);
  });
});

describe('buyLegendPerk', () => {
  it('spends Legend and raises the level', () => {
    const s: GameState = { ...createInitialState(T0), legend: 10 };
    const cost = legendPerkCost(LEGEND_PERKS_BY_ID['kingpin'], 1);
    const r = buyLegendPerk(s, 'kingpin');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.legend).toBe(10 - cost);
    expect(r.state.legendPerks['kingpin']).toBe(1);
  });

  it('rejects unknown perks, insufficient Legend, and maxed perks', () => {
    const base = createInitialState(T0);
    expect(buyLegendPerk(base, 'nope').ok).toBe(false);
    expect(buyLegendPerk({ ...base, legend: 0 }, 'kingpin').ok).toBe(false);
    const maxed: GameState = {
      ...base,
      legend: 9_999,
      legendPerks: { deep_pockets: LEGEND_PERKS_BY_ID['deep_pockets'].maxLevel },
    };
    expect(buyLegendPerk(maxed, 'deep_pockets').ok).toBe(false);
  });
});

describe('ascension save back-compat', () => {
  class MemStorage {
    private m = new Map<string, string>();
    get length() {
      return this.m.size;
    }
    clear() {
      this.m.clear();
    }
    getItem(k: string) {
      return this.m.has(k) ? this.m.get(k)! : null;
    }
    setItem(k: string, v: string) {
      this.m.set(k, String(v));
    }
    removeItem(k: string) {
      this.m.delete(k);
    }
    key(i: number) {
      return [...this.m.keys()][i] ?? null;
    }
  }
  const g = globalThis as unknown as { localStorage?: Storage };
  beforeEach(() => {
    g.localStorage = new MemStorage() as unknown as Storage;
  });
  afterEach(() => {
    delete g.localStorage;
  });

  it('defaults legend fields for a save written before they existed', () => {
    const legacy = createInitialState(T0) as unknown as Record<string, unknown>;
    delete legacy.legend;
    delete legacy.ascendCount;
    delete legacy.legendPerks;
    g.localStorage!.setItem(CONFIG.saveKey, JSON.stringify(legacy));
    const loaded = loadGame(T0);
    expect(loaded).not.toBeNull();
    expect(loaded!.state.legend).toBe(0);
    expect(loaded!.state.ascendCount).toBe(0);
    expect(loaded!.state.legendPerks).toEqual({});
  });

  it('sanitizes unknown / over-max legend perks on load', () => {
    const raw = {
      ...createInitialState(T0),
      legend: 5,
      legendPerks: { kingpin: 999, bogus: 3 },
    };
    g.localStorage!.setItem(CONFIG.saveKey, JSON.stringify(raw));
    const loaded = loadGame(T0);
    expect(loaded).not.toBeNull();
    expect(loaded!.state.legendPerks['kingpin']).toBe(LEGEND_PERKS_BY_ID['kingpin'].maxLevel);
    expect(loaded!.state.legendPerks['bogus']).toBeUndefined();
  });
});
