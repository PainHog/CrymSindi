// -----------------------------------------------------------------------------
// DAILY REWARD / LOGIN STREAK
// -----------------------------------------------------------------------------
// A cheap, proven retention hook: one claimable reward per calendar day, worth
// more on a consecutive-day streak, scaled by how far the player has progressed
// so it stays relevant. Pure and timestamp-based like the rest of the engine;
// the "day" is a UTC day index derived from the timestamp so it's deterministic
// and testable.
// -----------------------------------------------------------------------------

import { CONFIG } from '../data/config';
import type { Config } from '../data/config';
import { maxUnlockedTier } from './selectors';
import type { GameState } from './types';

const DAY_MS = 86_400_000;

/** UTC day index for a timestamp. */
export function dayIndexFor(ms: number): number {
  return Math.floor(ms / DAY_MS);
}

/** True if a daily reward can be claimed at `now` (a new day since last claim). */
export function canClaimDaily(state: GameState, now: number): boolean {
  return dayIndexFor(now) > state.dailyClaimDay;
}

/** The streak a claim at `now` would produce (resets if a day was skipped). */
export function nextStreakFor(state: GameState, now: number): number {
  if (!canClaimDaily(state, now)) return state.dailyStreak;
  const today = dayIndexFor(now);
  return state.dailyClaimDay >= 0 && today === state.dailyClaimDay + 1 ? state.dailyStreak + 1 : 1;
}

/** Cash a claim at `now` would grant. */
export function dailyReward(state: GameState, now: number, config: Config = CONFIG): number {
  const streak = Math.max(1, nextStreakFor(state, now));
  const steps = Math.min(streak, config.dailyStreakMax) - 1;
  const tierScale = Math.max(1, maxUnlockedTier(state, config));
  return Math.round(config.dailyRewardBase * (1 + config.dailyStreakBonus * steps) * tierScale);
}

export type DailyResult =
  | { ok: false; error: string }
  | { ok: true; state: GameState; reward: number; streak: number };

/** Claim today's reward. Grants cash and advances/resets the streak. */
export function claimDaily(state: GameState, now: number, config: Config = CONFIG): DailyResult {
  if (!canClaimDaily(state, now)) return { ok: false, error: 'Daily reward already claimed today.' };
  const streak = nextStreakFor(state, now);
  const reward = dailyReward(state, now, config);
  return {
    ok: true,
    state: {
      ...state,
      cash: state.cash + reward,
      lifetimeCash: state.lifetimeCash + reward,
      careerCash: state.careerCash + reward,
      dailyClaimDay: dayIndexFor(now),
      dailyStreak: streak,
    },
    reward,
    streak,
  };
}
