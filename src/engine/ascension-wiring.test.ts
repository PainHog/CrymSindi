import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import { HEISTS_BY_ID } from '../data/heists';
import type { RoleId } from '../data/roles';
import { createInitialState } from './state';
import { resolveHeist } from './resolution';
import { ascend, prestige } from './economy';
import { notorietyGainFor } from './selectors';
import type { GameState, Member } from './types';

const T0 = 1_000_000_000_000;

function crewState(legendPerks: Record<string, number> = {}): GameState {
  const base = createInitialState(T0);
  const roles: RoleId[] = ['hacker', 'muscle', 'driver'];
  const members: Member[] = roles.map((role, i) => ({
    id: `m${i + 1}`,
    name: `M${i + 1}`,
    role,
    skill: 12,
    gearIds: [],
  }));
  return {
    ...base,
    members,
    crews: [{ ...base.crews[0], memberIds: members.map((m) => m.id), maxMembers: 8 }],
    legendPerks,
  };
}

describe('ascension effect wiring', () => {
  it('Kingpin raises payout via legendPayoutMult at resolve', () => {
    const heist = HEISTS_BY_ID.smash_grab;
    const win = () => 0.01;
    const plain = crewState();
    const king = crewState({ kingpin: 5 }); // +50% take
    const rPlain = resolveHeist(plain, heist, plain.crews[0], T0, win, CONFIG, 0);
    const rKing = resolveHeist(king, heist, king.crews[0], T0, win, CONFIG, 0);
    expect(rKing.payout).toBeGreaterThan(rPlain.payout);
    // Ratio is approximate because payouts are integer-rounded (small base take).
    expect(rKing.payout / rPlain.payout).toBeCloseTo(1 + CONFIG.legendKingpinPct * 5, 1);
  });

  it('Reputation Engine scales the Notoriety gained on prestige', () => {
    const atThreshold = { ...createInitialState(T0), lifetimeCash: CONFIG.prestigeThreshold };
    const base = notorietyGainFor(CONFIG.prestigeThreshold);
    const plain = prestige(atThreshold, T0);
    const boosted = prestige({ ...atThreshold, legendPerks: { rep_engine: 5 } }, T0);
    expect(plain.ok && boosted.ok).toBe(true);
    if (!plain.ok || !boosted.ok) return;
    expect(plain.state.notoriety).toBe(base);
    expect(boosted.state.notoriety).toBe(Math.round(base * (1 + CONFIG.legendRepEnginePct * 5)));
  });

  it('Deep Pockets funds the fresh run after prestige', () => {
    const s = { ...createInitialState(T0), lifetimeCash: CONFIG.prestigeThreshold, legendPerks: { deep_pockets: 3 } };
    const r = prestige(s, T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.cash).toBe(createInitialState(T0).cash + 3 * CONFIG.legendDeepPocketsCash);
  });

  it('Deep Pockets funds the fresh run after ascending', () => {
    const s = { ...createInitialState(T0), notoriety: 300, legendPerks: { deep_pockets: 2 } };
    const r = ascend(s, T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.cash).toBe(createInitialState(T0).cash + 2 * CONFIG.legendDeepPocketsCash);
  });

  it('no legend perks => economy is unchanged (neutral)', () => {
    const heist = HEISTS_BY_ID.smash_grab;
    const s = crewState();
    const r = resolveHeist(s, heist, s.crews[0], T0, () => 0.01, CONFIG, 0);
    // A plain crew with no meta perks: payout equals base take * takeFrac (mult = 1).
    expect(r.payout).toBeGreaterThan(0);
    const pr = prestige({ ...createInitialState(T0), lifetimeCash: CONFIG.prestigeThreshold }, T0);
    if (!pr.ok) return;
    expect(pr.state.cash).toBe(createInitialState(T0).cash); // no war chest, no deep pockets
  });
});
