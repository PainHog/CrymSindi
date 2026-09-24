import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine';
import type { GameState } from '../../engine';
import { firstRunStep } from './onboarding';

const T0 = 1_000_000_000_000;
const active = (endsAt: number) => ({
  id: 'h1', heistId: 'smash_grab', crewId: 'c1', startedAt: T0, endsAt, seed: 1,
});

describe('first-run onboarding step', () => {
  it('starts on "send" for a fresh game with nothing running', () => {
    expect(firstRunStep(createInitialState(T0), T0)).toBe('send');
  });

  it('moves to "wait" while a job is in progress', () => {
    const s: GameState = { ...createInitialState(T0), activeHeists: [active(T0 + 20_000)] };
    expect(firstRunStep(s, T0)).toBe('wait');
  });

  it('moves to "collect" once a job is ready', () => {
    const s: GameState = { ...createInitialState(T0), activeHeists: [active(T0 - 1)] };
    expect(firstRunStep(s, T0)).toBe('collect');
  });

  it('ends (null) once the player has banked their first job', () => {
    const base = createInitialState(T0);
    const s: GameState = { ...base, stats: { ...base.stats, heistsCompleted: 1 } };
    expect(firstRunStep(s, T0)).toBeNull();
    // ...even if another job is mid-flight afterwards.
    expect(firstRunStep({ ...s, activeHeists: [active(T0 + 5_000)] }, T0)).toBeNull();
  });
});
