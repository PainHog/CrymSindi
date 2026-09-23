import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import { HEISTS_BY_ID } from '../data/heists';
import type { RoleId } from '../data/roles';
import { createInitialState } from './state';
import { launchHeist, collectHeist } from './heists';
import { estimateSuccess } from './resolution';
import type { GameState, Member } from './types';

const T0 = 1_000_000_000_000;

/** rng stub yielding a fixed sequence, repeating the last value. */
function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

function makeState(role: RoleId, skill: number, n: number): GameState {
  const base = createInitialState(T0);
  const members: Member[] = Array.from({ length: n }, (_, i) => ({
    id: `m${i + 1}`,
    name: `M${i + 1}`,
    role,
    skill,
    gearIds: [],
  }));
  return {
    ...base,
    members,
    crews: [{ ...base.crews[0], memberIds: members.map((m) => m.id), maxMembers: 8 }],
  };
}

const HEIST = HEISTS_BY_ID.smash_grab; // difficulty 4, dur 20s, heatCost 5, no roles

describe('mission approaches', () => {
  it('estimateSuccess: loud lowers odds, ghost raises them vs quiet', () => {
    const s = makeState('driver', 6, 3); // mid skill leaves headroom in both directions
    const crew = s.crews[0];
    const quiet = estimateSuccess(s, HEIST, crew, T0, undefined, 0);
    const loud = estimateSuccess(s, HEIST, crew, T0, undefined, -0.1);
    const ghost = estimateSuccess(s, HEIST, crew, T0, undefined, 0.06);
    expect(loud).toBeLessThan(quiet);
    expect(ghost).toBeGreaterThan(quiet);
  });

  it('launch applies heat and duration multipliers and records the approach', () => {
    const s = makeState('driver', 8, 3);
    const crewId = s.crews[0].id;

    const loud = launchHeist(s, 'smash_grab', crewId, T0, 1, CONFIG, 'loud');
    const quiet = launchHeist(s, 'smash_grab', crewId, T0, 1, CONFIG, 'quiet');
    const ghost = launchHeist(s, 'smash_grab', crewId, T0, 1, CONFIG, 'ghost');
    expect(loud.ok && quiet.ok && ghost.ok).toBe(true);
    if (!loud.ok || !quiet.ok || !ghost.ok) return;

    const aLoud = loud.state.activeHeists[0];
    expect(aLoud.approachId).toBe('loud');
    // duration: round(20 * 0.85) = 17s ; ghost: round(20 * 1.25) = 25s
    expect(aLoud.endsAt - aLoud.startedAt).toBe(17_000);
    expect(ghost.state.activeHeists[0].endsAt - ghost.state.activeHeists[0].startedAt).toBe(25_000);

    // heat added at launch scales by the approach (loud 1.5x, quiet 1x, ghost 0.6x).
    expect(loud.state.heat).toBeCloseTo(HEIST.heatCost * 1.5, 5);
    expect(quiet.state.heat).toBeCloseTo(HEIST.heatCost * 1, 5);
    expect(ghost.state.heat).toBeCloseTo(HEIST.heatCost * 0.6, 5);
  });

  it('collect payout scales with the approach reward multiplier (loud > quiet > ghost)', () => {
    const win = () => seq(0.01, 0.01, 0.01); // every member passes → same performance tier
    const payoutFor = (approach: 'loud' | 'quiet' | 'ghost'): number => {
      const s = makeState('driver', 12, 3);
      const launched = launchHeist(s, 'smash_grab', s.crews[0].id, T0, 1, CONFIG, approach);
      expect(launched.ok).toBe(true);
      if (!launched.ok) return 0;
      const a = launched.state.activeHeists[0];
      const res = collectHeist(launched.state, a.id, a.endsAt, win(), CONFIG);
      return res.ok ? (res.report?.payout ?? 0) : 0;
    };
    const loud = payoutFor('loud');
    const quiet = payoutFor('quiet');
    const ghost = payoutFor('ghost');
    expect(loud).toBeGreaterThan(quiet);
    expect(quiet).toBeGreaterThan(ghost);
    // loud is ~1.4x quiet, ghost ~0.8x quiet (same performance tier / seed;
    // approximate because payouts are integer-rounded at each step).
    expect(loud / quiet).toBeCloseTo(1.4, 1);
    expect(ghost / quiet).toBeCloseTo(0.8, 1);
  });

  it('an active heist with no approachId (old save) resolves as neutral quiet', () => {
    const s = makeState('driver', 12, 3);
    const launched = launchHeist(s, 'smash_grab', s.crews[0].id, T0, 1, CONFIG, 'quiet');
    expect(launched.ok).toBe(true);
    if (!launched.ok) return;
    const a = launched.state.activeHeists[0];

    const quietPayout = collectHeist(launched.state, a.id, a.endsAt, seq(0.01, 0.01, 0.01), CONFIG);
    // Simulate a pre-approach save: strip approachId.
    const legacy: GameState = {
      ...launched.state,
      activeHeists: [{ ...a, approachId: undefined }],
    };
    const legacyPayout = collectHeist(legacy, a.id, a.endsAt, seq(0.01, 0.01, 0.01), CONFIG);
    expect(quietPayout.ok && legacyPayout.ok).toBe(true);
    if (!quietPayout.ok || !legacyPayout.ok) return;
    expect(legacyPayout.report?.payout).toBe(quietPayout.report?.payout);
  });
});
