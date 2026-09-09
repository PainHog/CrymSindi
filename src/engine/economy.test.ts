import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import { createInitialState } from './state';
import {
  buyGear,
  buySafehouse,
  buyUpgrade,
  formCrew,
  recruitMember,
  upgradeSafehouse,
  upgradeSkill,
} from './economy';
import {
  getCrew,
  getMember,
  nextCrewCost,
  nextSafehouseCost,
  payoutMult,
  recruitCost,
  skillUpgradeCost,
} from './selectors';
import type { GameState } from './types';

const T0 = 1_000_000_000_000;

/** Start with plenty of cash so purchases aren't blocked by funds. */
function rich(cash = 100_000): GameState {
  return { ...createInitialState(T0), cash };
}

describe('safehouses', () => {
  it('first new safehouse costs the base price and starts empty at tier 1', () => {
    const state = rich();
    expect(nextSafehouseCost(state)).toBe(CONFIG.newSafehouseBaseCost);
    const res = buySafehouse(state);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.safehouses).toHaveLength(2);
    const bought = res.state.safehouses[1];
    expect(bought.crewIds).toHaveLength(0);
    expect(bought.crewSlots).toBe(1);
    expect(res.state.cash).toBe(state.cash - CONFIG.newSafehouseBaseCost);
  });

  it('upgrading capacity raises crew slots', () => {
    const state = rich();
    const res = upgradeSafehouse(state, 's1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(getSafehouseSlots(res.state, 's1')).toBe(2);
  });
});

describe('crews', () => {
  it('cannot form a crew with no open slot', () => {
    const state = rich(); // starting safehouse has 1 slot, already filled
    const res = formCrew(state, 's1');
    expect(res.ok).toBe(false);
  });

  it('can form a second crew after expanding capacity', () => {
    const upgraded = upgradeSafehouse(rich(), 's1');
    expect(upgraded.ok).toBe(true);
    if (!upgraded.ok) return;
    expect(nextCrewCost(upgraded.state)).toBe(CONFIG.newCrewBaseCost);
    const res = formCrew(upgraded.state, 's1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.crews).toHaveLength(2);
    expect(res.state.crews[1].memberIds).toHaveLength(0);
  });
});

describe('recruiting', () => {
  it('scales cost with crew size and adds a member of the chosen role', () => {
    const state = rich();
    const crew = getCrew(state, 'c1')!; // 1 member already
    const expected = Math.round(120 * Math.pow(CONFIG.recruitCostMultPerMember, 1));
    expect(recruitCost(crew, 'driver')).toBe(expected);

    const res = recruitMember(state, 'c1', 'hacker');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(getCrew(res.state, 'c1')!.memberIds).toHaveLength(2);
    const newMember = res.state.members.find((m) => m.role === 'hacker');
    expect(newMember).toBeTruthy();
  });

  it('cannot exceed crew capacity', () => {
    let state = rich();
    // fill the crew to maxMembers (starts with 1)
    for (let i = 1; i < CONFIG.crewMaxMembers; i++) {
      const r = recruitMember(state, 'c1', 'muscle');
      expect(r.ok).toBe(true);
      if (r.ok) state = r.state;
    }
    const overflow = recruitMember(state, 'c1', 'muscle');
    expect(overflow.ok).toBe(false);
  });
});

describe('member upgrades', () => {
  it('skill upgrade costs the base at the starting level and raises skill', () => {
    const state = rich();
    const member = getMember(state, 'm1')!;
    expect(skillUpgradeCost(member)).toBe(CONFIG.skillUpgradeBaseCost);
    const res = upgradeSkill(state, 'm1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(getMember(res.state, 'm1')!.skill).toBe(member.skill + CONFIG.skillUpgradePerLevel);
  });

  it('buying gear adds it once and blocks duplicates', () => {
    const state = rich();
    const first = buyGear(state, 'm1', 'tuning');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(getMember(first.state, 'm1')!.gearIds).toContain('tuning');
    const dup = buyGear(first.state, 'm1', 'tuning');
    expect(dup.ok).toBe(false);
  });
});

describe('global upgrades', () => {
  it('applies a payout multiplier and blocks re-purchase', () => {
    const state = rich();
    expect(payoutMult(state)).toBe(1);
    const res = buyUpgrade(state, 'laundry');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(payoutMult(res.state)).toBeCloseTo(1.15, 5);
    const dup = buyUpgrade(res.state, 'laundry');
    expect(dup.ok).toBe(false);
  });
});

function getSafehouseSlots(state: GameState, id: string): number {
  return state.safehouses.find((s) => s.id === id)!.crewSlots;
}
