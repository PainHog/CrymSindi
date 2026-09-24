import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import { ROLES_BY_ID } from '../data/roles';
import { RECRUIT_TIERS_BY_ID } from '../data/recruits';
import { createInitialState } from './state';
import { recruitMember } from './economy';
import { recruitTierCost, recruitTierSkill } from './selectors';
import type { GameState } from './types';

const T0 = 1_000_000_000_000;
const CREW = 'c1';
const rich = (): GameState => ({ ...createInitialState(T0), cash: 5_000_000 });

describe('recruit tier selectors', () => {
  it('recruitTierSkill adds the tier bonus over the role base, clamped to the cap', () => {
    const base = ROLES_BY_ID.hacker.baseSkill;
    expect(recruitTierSkill('hacker', 'street')).toBe(base);
    expect(recruitTierSkill('hacker', 'pro')).toBe(
      Math.min(CONFIG.maxMemberSkill, base + RECRUIT_TIERS_BY_ID.pro.skillBonus),
    );
    expect(recruitTierSkill('hacker', 'elite')).toBe(
      Math.min(CONFIG.maxMemberSkill, base + RECRUIT_TIERS_BY_ID.elite.skillBonus),
    );
  });

  it('recruitTierCost scales the base recruit cost by the tier multiplier', () => {
    const crew = rich().crews[0];
    const street = recruitTierCost(crew, 'hacker', 'street');
    expect(recruitTierCost(crew, 'hacker', 'pro')).toBe(Math.round(street * RECRUIT_TIERS_BY_ID.pro.costMult));
    expect(recruitTierCost(crew, 'hacker', 'elite')).toBe(Math.round(street * RECRUIT_TIERS_BY_ID.elite.costMult));
  });
});

describe('recruitMember with tiers', () => {
  it('hires at the tier skill and charges the tier cost', () => {
    const s = rich();
    const cost = recruitTierCost(s.crews[0], 'muscle', 'elite');
    const r = recruitMember(s, CREW, 'muscle', 'elite');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const hired = r.state.members[r.state.members.length - 1];
    expect(hired.role).toBe('muscle');
    expect(hired.skill).toBe(recruitTierSkill('muscle', 'elite'));
    expect(r.state.cash).toBe(s.cash - cost);
  });

  it('defaults to Street (unchanged from the pre-tier behavior)', () => {
    const s = rich();
    const r = recruitMember(s, CREW, 'driver'); // no tier arg
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const hired = r.state.members[r.state.members.length - 1];
    expect(hired.skill).toBe(ROLES_BY_ID.driver.baseSkill);
    expect(r.state.cash).toBe(s.cash - recruitTierCost(s.crews[0], 'driver', 'street'));
  });

  it('refuses when cash is short for the (pricier) tier', () => {
    const crew0 = createInitialState(T0).crews[0];
    const eliteCost = recruitTierCost(crew0, 'hacker', 'elite');
    const s: GameState = { ...createInitialState(T0), cash: eliteCost - 1 };
    expect(recruitMember(s, CREW, 'hacker', 'elite').ok).toBe(false);
    // ...but the cheap Street tier is affordable at the same cash.
    expect(recruitMember(s, CREW, 'hacker', 'street').ok).toBe(true);
  });
});
