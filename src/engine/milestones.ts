// -----------------------------------------------------------------------------
// MILESTONE EVALUATION
// -----------------------------------------------------------------------------
// The condition for each milestone id, plus awardMilestones() which grants any
// newly-met milestones (and their one-time rewards). Pure and deterministic.
// -----------------------------------------------------------------------------

import { MILESTONES } from '../data/milestones';
import type { MilestoneDef } from '../data/milestones';
import { maxUnlockedTier } from './selectors';
import type { GameState } from './types';

type Check = (s: GameState) => boolean;

const CHECKS: Record<string, Check> = {
  first_score: (s) => s.stats.heistsSucceeded >= 1,
  warmup: (s) => s.stats.heistsCompleted >= 10,
  pro: (s) => s.stats.heistsCompleted >= 50,
  flawless5: (s) => s.stats.flawless >= 5,
  full_house: (s) => s.crews.some((c) => c.memberIds.length >= 8),
  syndicate: (s) => s.crews.length >= 3,
  high_roller: (s) => s.stats.biggestScore >= 50000,
  top_brass: (s) => maxUnlockedTier(s) >= 5,
  contractor: (s) => s.contractLevel >= 1,
  gone_legit: (s) => s.prestigeCount >= 1,
  millionaire: (s) => s.careerCash >= 1_000_000,
  kingpin: (s) => s.careerCash >= 10_000_000,
};

/** Grant any newly-met milestones and apply their rewards. */
export function awardMilestones(state: GameState): { state: GameState; earned: MilestoneDef[] } {
  let next = state;
  const earned: MilestoneDef[] = [];
  for (const m of MILESTONES) {
    if (next.milestonesEarned.includes(m.id)) continue;
    if (!CHECKS[m.id]?.(next)) continue;
    earned.push(m);
    next = { ...next, milestonesEarned: [...next.milestonesEarned, m.id] };
    if (m.reward?.cash) {
      next = { ...next, cash: next.cash + m.reward.cash, careerCash: next.careerCash + m.reward.cash };
    }
    if (m.reward?.notoriety) {
      next = { ...next, notoriety: next.notoriety + m.reward.notoriety };
    }
  }
  return { state: next, earned };
}

/** Is a milestone already earned? (UI helper) */
export function isMilestoneEarned(state: GameState, id: string): boolean {
  return state.milestonesEarned.includes(id);
}
