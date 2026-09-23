import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import { createInitialState } from './state';
import { canClaimDaily, claimDaily, dailyReward, dayIndexFor, nextStreakFor } from './daily';

const DAY = 86_400_000;
const T0 = 1_000_000_000_000;

describe('daily reward', () => {
  it('is claimable on a fresh state', () => {
    const s = createInitialState(T0);
    expect(s.dailyClaimDay).toBe(-1);
    expect(canClaimDaily(s, T0)).toBe(true);
  });

  it('grants cash, starts a streak, and blocks a second claim the same day', () => {
    const s = createInitialState(T0);
    const r = claimDaily(s, T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.streak).toBe(1);
    expect(r.reward).toBe(CONFIG.dailyRewardBase); // day 1, tier 1
    expect(r.state.cash).toBe(s.cash + r.reward);
    // Spendable cash only — must not advance the tier/prestige/milestone gates.
    expect(r.state.lifetimeCash).toBe(s.lifetimeCash);
    expect(r.state.careerCash).toBe(s.careerCash);
    expect(canClaimDaily(r.state, T0 + 1000)).toBe(false);
    expect(claimDaily(r.state, T0 + 1000).ok).toBe(false);
  });

  it('advances the streak on a consecutive day and resets after a skipped day', () => {
    const s0 = createInitialState(T0);
    const d1 = claimDaily(s0, T0);
    if (!d1.ok) throw new Error('claim 1 failed');

    const day2 = T0 + DAY;
    expect(nextStreakFor(d1.state, day2)).toBe(2);
    const d2 = claimDaily(d1.state, day2);
    if (!d2.ok) throw new Error('claim 2 failed');
    expect(d2.streak).toBe(2);

    const afterGap = day2 + 2 * DAY; // skipped a day
    expect(nextStreakFor(d2.state, afterGap)).toBe(1);
    const d3 = claimDaily(d2.state, afterGap);
    if (!d3.ok) throw new Error('claim 3 failed');
    expect(d3.streak).toBe(1);
  });

  it('reward grows with the streak', () => {
    const s = createInitialState(T0);
    const day1 = dailyReward(s, T0);
    // A state poised to claim day 3 (claimed yesterday, streak 2).
    const s3 = { ...s, dailyClaimDay: dayIndexFor(T0) - 1, dailyStreak: 2 };
    const day3 = dailyReward(s3, T0);
    // base * (1 + 0.5*2) * tier1 = 2 * base
    expect(day3).toBe(Math.round(CONFIG.dailyRewardBase * (1 + CONFIG.dailyStreakBonus * 2)));
    expect(day3).toBeGreaterThan(day1);
  });
});
