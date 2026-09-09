import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import type { Config } from '../data/config';
import { HEISTS_BY_ID } from '../data/heists';
import { createInitialState } from './state';
import { launchHeist, collectHeist } from './heists';
import { successChance, getCrew, crewPower, memberEffectiveSkill } from './selectors';
import type { GameState } from './types';

const T0 = 1_000_000_000_000; // fixed base timestamp

/** rng stub that yields a fixed sequence, then repeats the last value. */
function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

/** Force the (single) starting member to a given skill for deterministic math. */
function withStartingSkill(skill: number): GameState {
  const s = createInitialState(T0);
  return { ...s, members: s.members.map((m) => ({ ...m, skill })) };
}

describe('success chance model', () => {
  const cfg: Config = {
    ...CONFIG,
    successBase: 0.5,
    successSlope: 0.1,
    successMin: 0,
    successMax: 1,
    heatSuccessPenalty: 0,
  };

  it('scales with (crew power - difficulty)', () => {
    const state = withStartingSkill(5); // power = 5 (one member, no gear)
    const crew = getCrew(state, 'c1')!;
    const heist = { ...HEISTS_BY_ID['smash_grab'], difficulty: 5 };
    expect(successChance(state, heist, crew, T0, cfg)).toBeCloseTo(0.5, 5);

    const easier = { ...heist, difficulty: 3 };
    expect(successChance(state, easier, crew, T0, cfg)).toBeCloseTo(0.7, 5);
  });

  it('clamps to [min, max]', () => {
    const state = withStartingSkill(5);
    const crew = getCrew(state, 'c1')!;
    const impossible = { ...HEISTS_BY_ID['smash_grab'], difficulty: 100 };
    const trivial = { ...HEISTS_BY_ID['smash_grab'], difficulty: -100 };
    const clampCfg: Config = { ...cfg, successMin: 0.05, successMax: 0.97 };
    expect(successChance(state, impossible, crew, T0, clampCfg)).toBe(0.05);
    expect(successChance(state, trivial, crew, T0, clampCfg)).toBe(0.97);
  });

  it('is reduced by current heat', () => {
    const state = { ...withStartingSkill(5), heat: CONFIG.maxHeat, heatUpdatedAt: T0 };
    const crew = getCrew(state, 'c1')!;
    const heist = { ...HEISTS_BY_ID['smash_grab'], difficulty: 5 };
    const heatCfg: Config = { ...cfg, heatSuccessPenalty: 0.25 };
    // base 0.5, full heat subtracts 0.25 -> 0.25
    expect(successChance(state, heist, crew, T0, heatCfg)).toBeCloseTo(0.25, 5);
  });

  it('counts gear (flat + role affinity) in crew power', () => {
    const s = createInitialState(T0);
    // starting member is a driver; give them the driver-affinity tuning gear
    const withGear: GameState = {
      ...s,
      members: s.members.map((m) => ({ ...m, gearIds: ['tuning'] })),
    };
    const member = withGear.members[0];
    // tuning: skillBonus 1 + affinityBonus 3 for a driver = +4 over base skill 3
    expect(memberEffectiveSkill(member)).toBe(3 + 1 + 3);
    expect(crewPower(withGear, getCrew(withGear, 'c1')!)).toBe(7);
  });
});

describe('launch heist', () => {
  it('locks the crew, applies heat, and sets start/end timestamps', () => {
    const state = withStartingSkill(5);
    const res = launchHeist(state, 'smash_grab', 'c1', T0);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const heist = HEISTS_BY_ID['smash_grab'];
    const active = res.state.activeHeists[0];
    expect(active.startedAt).toBe(T0);
    expect(active.endsAt).toBe(T0 + heist.durationSec * 1000);
    expect(getCrew(res.state, 'c1')!.status).toBe('onHeist');
    // heat applied at launch (no upgrades -> multiplier 1)
    expect(res.state.heat).toBeCloseTo(heist.heatCost, 5);
  });

  it('rejects a crew missing a required role', () => {
    const state = withStartingSkill(5); // driver only
    const res = launchHeist(state, 'atm_skim', 'c1', T0); // needs a hacker
    expect(res.ok).toBe(false);
  });

  it('rejects a crew that is already on a job', () => {
    const state = withStartingSkill(5);
    const first = launchHeist(state, 'smash_grab', 'c1', T0);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = launchHeist(first.state, 'smash_grab', 'c1', T0);
    expect(second.ok).toBe(false);
  });

  it('rejects launching when heat is maxed', () => {
    const hot: GameState = { ...withStartingSkill(5), heat: CONFIG.maxHeat, heatUpdatedAt: T0 };
    const res = launchHeist(hot, 'smash_grab', 'c1', T0);
    expect(res.ok).toBe(false);
  });
});

describe('collect heist (roll at collect)', () => {
  const heist = HEISTS_BY_ID['smash_grab'];
  const endsAt = T0 + heist.durationSec * 1000;

  function launched(): GameState {
    const res = launchHeist(withStartingSkill(5), 'smash_grab', 'c1', T0);
    if (!res.ok) throw new Error('launch failed');
    return res.state;
  }

  it('cannot be collected before it finishes', () => {
    const res = collectHeist(launched(), launched().activeHeists[0].id, endsAt - 1);
    expect(res.ok).toBe(false);
  });

  it('pays cash on success and frees the crew', () => {
    const state = launched();
    const id = state.activeHeists[0].id;
    // rng: first value < chance -> success; second value picks payout (0 -> min)
    const res = collectHeist(state, id, endsAt, seq(0, 0));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.outcome!.success).toBe(true);
    expect(res.outcome!.payout).toBe(heist.payoutMin);
    expect(res.state.cash).toBe(state.cash + heist.payoutMin);
    expect(res.state.lifetimeCash).toBe(heist.payoutMin);
    expect(res.state.activeHeists).toHaveLength(0);
    expect(getCrew(res.state, 'c1')!.status).toBe('idle');
  });

  it('adds heat on failure, pays nothing, and frees the crew', () => {
    const state = launched();
    const id = state.activeHeists[0].id;
    // rng first value 0.999 -> above any chance -> failure
    const res = collectHeist(state, id, endsAt, seq(0.999));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.outcome!.success).toBe(false);
    expect(res.outcome!.payout).toBe(0);
    expect(res.state.cash).toBe(state.cash);
    expect(res.outcome!.heatAdded).toBeCloseTo(heist.failHeatBonus, 5);
    expect(getCrew(res.state, 'c1')!.status).toBe('idle');
  });

  it('is deterministic for a given rng', () => {
    const a = collectHeist(launched(), launched().activeHeists[0].id, endsAt, seq(0.1, 0.5));
    const b = collectHeist(launched(), launched().activeHeists[0].id, endsAt, seq(0.1, 0.5));
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.outcome).toEqual(b.outcome);
    }
  });
});
