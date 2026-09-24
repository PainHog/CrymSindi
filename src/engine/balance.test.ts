import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import { APPROACHES } from '../data/approaches';
import { EVENTS } from '../data/events';

// -----------------------------------------------------------------------------
// BALANCE INVARIANTS
// -----------------------------------------------------------------------------
// A guard rail over the whole reward stack + pacing, so a future config tweak
// that would make the game degenerate (a runaway payout multiplier) or draggy
// (unreachable prestige/ascension) trips a test instead of shipping. The bounds
// here encode the balance pass's conclusions (see docs/ROADMAP.md); the probe
// that measured the live $/min lives in session history.
// -----------------------------------------------------------------------------

describe('reward-stack ceiling', () => {
  it('the sustained payout-multiplier chain stays bounded (featured & events are exclusive)', () => {
    const maxApproach = Math.max(...APPROACHES.map((a) => a.rewardMult)); // loud = 1.4
    const maxFeatured = CONFIG.featuredBonusMax; // 1.6
    // Common (weight >= 1) events are the sustained case; a rare jackpot (weight
    // < 1) is allowed a higher, separate ceiling below.
    const common = EVENTS.filter((e) => (e.weight ?? 1) >= 1);
    const maxCommonReward = Math.max(1, ...common.map((e) => e.effect.rewardMult ?? 1));
    // A job carries featured OR an event, never both — so the special bonus is
    // the max of the two, not their product.
    const sustainedCeiling = maxApproach * Math.max(maxFeatured, maxCommonReward);
    expect(sustainedCeiling).toBeLessThanOrEqual(2.5); // ~2.24 today
  });

  it('a rare jackpot event is bigger but still bounded', () => {
    const maxApproach = Math.max(...APPROACHES.map((a) => a.rewardMult));
    const rare = EVENTS.filter((e) => (e.weight ?? 1) < 1);
    const maxRareReward = Math.max(1, ...rare.map((e) => e.effect.rewardMult ?? 1));
    // The jackpot (loud x The Whale) is a rare, time-boxed spike — allow up to
    // 3.5x base, no more.
    expect(maxApproach * maxRareReward).toBeLessThanOrEqual(3.5); // 1.4 * 2.0 = 2.8
    // And it must actually be rare (well below a common event's weight of 1).
    for (const e of rare) expect(e.weight!).toBeLessThan(0.6);
  });

  it('rival spoils (separate cash, escalation included) stay bounded', () => {
    // Spoils are frac * take, escalating up to frac * (1 + max). Not in the
    // payout-mult chain, so they never compound the featured/event bonus.
    const spoilsCeiling = CONFIG.rivalSpoilsFrac * (1 + CONFIG.rivalEscalationMax);
    expect(spoilsCeiling).toBeLessThanOrEqual(1.0); // at most double a won contested take
    // Max escalation must take real investment, not arrive instantly.
    const winsToMaxRivalry = (CONFIG.rivalEscalationMax / CONFIG.rivalEscalationStep) * CONFIG.rivalWinsPerLevel;
    expect(winsToMaxRivalry).toBeGreaterThanOrEqual(12);
  });
});

describe('progression pacing', () => {
  it('tier unlocks are monotonic and sit at/under the prestige threshold', () => {
    const tiers = Object.keys(CONFIG.tierUnlocks)
      .map(Number)
      .sort((a, b) => a - b);
    let prev = 0;
    for (const t of tiers) {
      const gate = CONFIG.tierUnlocks[t];
      expect(gate).toBeGreaterThan(prev);
      expect(gate).toBeLessThanOrEqual(CONFIG.prestigeThreshold);
      prev = gate;
    }
  });

  it('first ascension is a few prestige cycles, not one and not forever', () => {
    const notorietyAtThreshold = Math.floor(Math.sqrt(CONFIG.prestigeThreshold / CONFIG.notorietyDivisor));
    const prestigesToAscend = CONFIG.ascendThreshold / notorietyAtThreshold;
    expect(prestigesToAscend).toBeGreaterThan(1); // never a first-prestige ascension
    expect(prestigesToAscend).toBeLessThanOrEqual(6); // and not an endless grind
  });
});
