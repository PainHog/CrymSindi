import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import type { Config } from '../data/config';
import { createInitialState, resolveOffline, saveGame } from './state';
import { launchHeist } from './heists';
import { deriveHeat, heistStatusAt } from './selectors';
import { settleHeat, addHeat } from './heat';
import type { GameState } from './types';

const T0 = 1_000_000_000_000;
const SEC = 1000;

function hot(heat: number, at = T0): GameState {
  return { ...createInitialState(T0), heat, heatUpdatedAt: at };
}

describe('deriveHeat (timestamp-based cooldown)', () => {
  it('cools linearly with elapsed real time', () => {
    const state = hot(100);
    // coolPerSec 0.6 default -> after 10s, 6 points gone
    expect(deriveHeat(state, T0 + 10 * SEC)).toBeCloseTo(100 - 0.6 * 10, 5);
  });

  it('never drops below zero', () => {
    const state = hot(20);
    expect(deriveHeat(state, T0 + 10_000 * SEC)).toBe(0);
  });

  it('does not change heat when no time has elapsed', () => {
    const state = hot(42);
    expect(deriveHeat(state, T0)).toBe(42);
  });

  it('caps cooldown at the offline cap for very long absences', () => {
    const cfg: Config = { ...CONFIG, heatCoolPerSec: 1, offlineCapSec: 10 };
    const state = hot(100);
    // 100s elapsed would cool 100 points, but the cap limits it to 10s -> 10 points
    expect(deriveHeat(state, T0 + 100 * SEC, cfg)).toBe(90);
  });

  it('respects the heat-cooldown-speed upgrade multiplier', () => {
    const state: GameState = { ...hot(100), purchasedUpgradeIds: ['corrupt_official'] };
    // corrupt_official = +50% cooldown speed -> 0.6 * 1.5 = 0.9/sec
    expect(deriveHeat(state, T0 + 10 * SEC)).toBeCloseTo(100 - 0.9 * 10, 5);
  });
});

describe('heat mutation helpers', () => {
  it('settleHeat bakes in cooldown and resets the clock', () => {
    const state = hot(100);
    const settled = settleHeat(state, T0 + 10 * SEC);
    expect(settled.heat).toBeCloseTo(94, 5);
    expect(settled.heatUpdatedAt).toBe(T0 + 10 * SEC);
  });

  it('addHeat settles first, then adds, clamped to maxHeat', () => {
    const state = hot(100);
    // cool 10s (-6 -> 94), then add 20 -> 114 clamped to 100
    const bumped = addHeat(state, 20, T0 + 10 * SEC);
    expect(bumped.heat).toBe(CONFIG.maxHeat);
  });
});

describe('resolveOffline (idle/offline resolution)', () => {
  it('marks heists finished while away as ready to collect', () => {
    const launch = launchHeist(createInitialState(T0), 'smash_grab', 'c1', T0);
    expect(launch.ok).toBe(true);
    if (!launch.ok) return;

    const endsAt = launch.state.activeHeists[0].endsAt;
    // simulate saving at launch, then returning well after the heist ended
    const saved: GameState = { ...launch.state, lastSaved: T0 };
    const now = endsAt + 60 * SEC;

    const summary = resolveOffline(saved, now);
    expect(summary.readyCount).toBe(1);
    expect(summary.awayMs).toBe(now - T0);
    expect(summary.state.lastSaved).toBe(now);
    expect(summary.state.heatUpdatedAt).toBe(now);
    expect(heistStatusAt(endsAt, now)).toBe('ready');
    // the active heist is left in place (not auto-collected)
    expect(summary.state.activeHeists).toHaveLength(1);
  });

  it('does not count still-running heists as ready', () => {
    const launch = launchHeist(createInitialState(T0), 'warehouse_job', 'c1', T0);
    // warehouse_job requires roles the starting crew lacks -> launch fails,
    // so fall back to a valid short heist for the timing check
    const valid = launch.ok ? launch : launchHeist(createInitialState(T0), 'smash_grab', 'c1', T0);
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;

    const endsAt = valid.state.activeHeists[0].endsAt;
    const summary = resolveOffline({ ...valid.state, lastSaved: T0 }, endsAt - 1 * SEC);
    expect(summary.readyCount).toBe(0);
  });

  it('settles heat forward across the away period', () => {
    const saved = hot(100);
    const summary = resolveOffline({ ...saved, lastSaved: T0 }, T0 + 10 * SEC);
    expect(summary.state.heat).toBeCloseTo(94, 5);
  });
});

describe('saveGame', () => {
  it('returns a state with heat settled to now (works without localStorage)', () => {
    const saved = saveGame(hot(100), T0 + 10 * SEC);
    expect(saved.heat).toBeCloseTo(94, 5);
    expect(saved.lastSaved).toBe(T0 + 10 * SEC);
  });
});
