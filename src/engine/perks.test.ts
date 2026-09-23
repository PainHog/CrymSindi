import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import { PERKS_BY_ID, perkCost } from '../data/perks';
import { createInitialState } from './state';
import { buyPerk, prestige } from './economy';
import { heatCoolRateMult, notorietyMult } from './selectors';

const T0 = 1_000_000_000_000;

describe('perks', () => {
  it('buys the next level, spends notoriety, and rejects unaffordable/maxed/unknown', () => {
    const s = { ...createInitialState(T0), notoriety: 5 };
    const r = buyPerk(s, 'reputation');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.perks.reputation).toBe(1);
    expect(r.state.notoriety).toBe(5 - perkCost(PERKS_BY_ID.reputation, 1));
    expect(notorietyMult(r.state)).toBeCloseTo(1 + CONFIG.perkReputationPct, 5);

    expect(buyPerk(s, 'nope').ok).toBe(false); // unknown
    expect(buyPerk({ ...createInitialState(T0), notoriety: 0 }, 'reputation').ok).toBe(false); // broke
    const maxed = { ...createInitialState(T0), notoriety: 100, perks: { old_loyalties: 1 } };
    expect(buyPerk(maxed, 'old_loyalties').ok).toBe(false); // maxed
  });

  it('Clean Hands speeds the heat cooldown', () => {
    const withPerk = { ...createInitialState(T0), perks: { clean_hands: 2 } };
    expect(heatCoolRateMult(withPerk)).toBeCloseTo(1 + CONFIG.perkCleanHandsPct * 2, 5);
  });

  it('prestige keeps perks; Old Loyalties keeps upgrades; War Chest adds starting cash', () => {
    const s = {
      ...createInitialState(T0),
      lifetimeCash: CONFIG.prestigeThreshold,
      purchasedUpgradeIds: ['the_fixer'],
      perks: { reputation: 3, old_loyalties: 1, war_chest: 2 },
    };
    const res = prestige(s, T0);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.perks.reputation).toBe(3);
    expect(res.state.purchasedUpgradeIds).toContain('the_fixer');
    expect(res.state.cash).toBe(CONFIG.startingCash + 2 * CONFIG.perkWarChestCash);
  });

  it('without Old Loyalties, prestige wipes upgrades', () => {
    const s = {
      ...createInitialState(T0),
      lifetimeCash: CONFIG.prestigeThreshold,
      purchasedUpgradeIds: ['the_fixer'],
    };
    const res = prestige(s, T0);
    if (!res.ok) return;
    expect(res.state.purchasedUpgradeIds).not.toContain('the_fixer');
  });
});
