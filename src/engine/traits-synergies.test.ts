import { describe, it, expect } from 'vitest';
import { TRAITS_BY_ID, traitForId } from '../data/traits';
import { activeSynergies, synergyPower } from '../data/synergies';
import { crewSynergyPower, memberEffectiveSkill } from './selectors';
import type { Member } from './types';

function m(role: string, skill: number, traitId?: string): Member {
  return { id: 'x', name: 'X', role, skill, gearIds: [], traitId };
}

describe('traits', () => {
  it('traitForId is deterministic and always a real trait', () => {
    expect(traitForId(5)).toBe(traitForId(5));
    expect(TRAITS_BY_ID[traitForId(5)]).toBeTruthy();
    expect(TRAITS_BY_ID[traitForId(123)]).toBeTruthy();
  });

  it('memberEffectiveSkill adds the trait bonus and ignores unknown ids', () => {
    const base = memberEffectiveSkill(m('driver', 5));
    expect(memberEffectiveSkill(m('driver', 5, 'prodigy'))).toBe(base + 3); // Prodigy +3
    expect(memberEffectiveSkill(m('driver', 5, 'bogus'))).toBe(5); // unknown -> +0
  });
});

describe('crew synergies', () => {
  it('Tight Unit requires 3+ all-distinct roles', () => {
    expect(activeSynergies(['driver', 'hacker', 'muscle']).map((s) => s.id)).toContain('tight_unit');
    expect(activeSynergies(['driver', 'driver', 'hacker']).map((s) => s.id)).not.toContain(
      'tight_unit',
    );
  });

  it('Full Deck requires all four roles; Heavy Hitters needs 2+ muscle', () => {
    const full = activeSynergies(['driver', 'hacker', 'muscle', 'lookout']).map((s) => s.id);
    expect(full).toContain('full_deck');
    expect(full).toContain('tight_unit');
    expect(activeSynergies(['muscle', 'muscle', 'driver']).map((s) => s.id)).toContain(
      'heavy_hitters',
    );
  });

  it('crewSynergyPower sums the active synergies', () => {
    const members = [m('driver', 5), m('hacker', 5), m('muscle', 5), m('lookout', 5)];
    expect(crewSynergyPower(members)).toBe(3); // Tight Unit (+1) + Full Deck (+2)
    expect(synergyPower(['driver', 'hacker', 'muscle', 'lookout'])).toBe(3);
    expect(crewSynergyPower([m('driver', 5), m('driver', 5)])).toBe(0); // dupes, size 2
  });
});
