import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import { HEISTS_BY_ID } from '../data/heists';
import { createInitialState, loadGame } from './state';
import { launchHeist, collectHeist } from './heists';
import {
  memberEffectiveSkill,
  memberLevel,
  veteranBonus,
  veteranXpForLevel,
  xpForHeist,
} from './selectors';
import type { GameState, Member } from './types';

const T0 = 1_000_000_000_000;

describe('veterancy selectors', () => {
  it('memberLevel follows floor(sqrt(xp / base)) and caps at the max', () => {
    const m = (xp: number): Member => ({ id: 'x', name: 'X', role: 'hacker', skill: 5, gearIds: [], xp });
    expect(memberLevel(m(0))).toBe(0);
    expect(memberLevel(m(CONFIG.veteranXpBase))).toBe(1);
    expect(memberLevel(m(CONFIG.veteranXpBase * 4))).toBe(2);
    // A huge XP value is capped.
    expect(memberLevel(m(10_000_000))).toBe(CONFIG.veteranMaxLevel);
  });

  it('veteranXpForLevel is the inverse of the level curve', () => {
    for (let lvl = 1; lvl <= CONFIG.veteranMaxLevel; lvl++) {
      const need = veteranXpForLevel(lvl);
      const m: Member = { id: 'x', name: 'X', role: 'hacker', skill: 5, gearIds: [], xp: need };
      expect(memberLevel(m)).toBeGreaterThanOrEqual(lvl);
    }
  });

  it('veteran level adds to effective skill', () => {
    const base: Member = { id: 'x', name: 'X', role: 'hacker', skill: 8, gearIds: [] };
    const vet: Member = { ...base, xp: CONFIG.veteranXpBase * 9 }; // level 3
    expect(memberLevel(vet)).toBe(3);
    expect(veteranBonus(vet)).toBeCloseTo(CONFIG.veteranSkillPerLevel * 3, 5);
    expect(memberEffectiveSkill(vet)).toBeCloseTo(memberEffectiveSkill(base) + veteranBonus(vet), 5);
  });

  it('xpForHeist scales with difficulty and outcome', () => {
    const win = xpForHeist(20, { success: true, flawless: false });
    const flaw = xpForHeist(20, { success: true, flawless: true });
    const loss = xpForHeist(20, { success: false, flawless: false });
    expect(flaw).toBeGreaterThan(win);
    expect(win).toBeGreaterThan(loss);
    expect(loss).toBeGreaterThan(0); // still some XP for showing up
    expect(xpForHeist(40, { success: true, flawless: false })).toBeGreaterThan(win); // harder pays more
  });
});

describe('veterancy award on collect', () => {
  it('every participant earns XP on a win; non-participants get none', () => {
    const s = createInitialState(T0); // crew c1 = m1,m2,m3
    const launched = launchHeist(s, 'smash_grab', 'c1', T0, 1, CONFIG, 'quiet');
    expect(launched.ok).toBe(true);
    if (!launched.ok) return;
    const a = launched.state.activeHeists[0];
    const res = collectHeist(launched.state, a.id, a.endsAt, () => 0.01, CONFIG);
    expect(res.ok).toBe(true);
    if (!res.ok || !res.report) return;
    const expected = xpForHeist(HEISTS_BY_ID.smash_grab.difficulty, {
      success: res.report.success,
      flawless: res.report.perfect,
    });
    expect(expected).toBeGreaterThan(0);
    for (const id of a.memberIds ?? []) {
      expect(res.state.members.find((m) => m.id === id)?.xp).toBe(expected);
    }
  });

  it('a blown run still awards (smaller) XP', () => {
    const s = createInitialState(T0);
    const launched = launchHeist(s, 'smash_grab', 'c1', T0, 1, CONFIG, 'quiet');
    if (!launched.ok) return;
    const a = launched.state.activeHeists[0];
    const res = collectHeist(launched.state, a.id, a.endsAt, () => 0.999, CONFIG); // all fail
    expect(res.ok).toBe(true);
    if (!res.ok || !res.report) return;
    expect(res.report.success).toBe(false);
    const expected = xpForHeist(HEISTS_BY_ID.smash_grab.difficulty, { success: false, flawless: false });
    const m1 = res.state.members.find((m) => m.id === 'm1');
    expect(m1?.xp).toBe(expected);
  });
});

describe('veterancy save back-compat', () => {
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

  it('defaults member xp to 0 for a save written before veterancy', () => {
    const legacy = createInitialState(T0) as unknown as GameState;
    legacy.members = legacy.members.map((m) => {
      const copy = { ...m } as Record<string, unknown>;
      delete copy.xp;
      return copy as unknown as Member;
    });
    g.localStorage!.setItem(CONFIG.saveKey, JSON.stringify(legacy));
    const loaded = loadGame(T0);
    expect(loaded).not.toBeNull();
    for (const m of loaded!.state.members) expect(m.xp).toBe(0);
  });
});
