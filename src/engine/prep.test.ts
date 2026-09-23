import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import { HEISTS_BY_ID } from '../data/heists';
import type { RoleId } from '../data/roles';
import { createInitialState } from './state';
import { launchHeist, collectHeist } from './heists';
import { estimateSuccess } from './resolution';
import { prepCostFor } from './selectors';
import type { GameState, Member } from './types';

const T0 = 1_000_000_000_000;

function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

function makeState(role: RoleId, skill: number, n: number, cash = 100000): GameState {
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
    cash,
    members,
    crews: [{ ...base.crews[0], memberIds: members.map((m) => m.id), maxMembers: 8 }],
  };
}

const HEIST = HEISTS_BY_ID.smash_grab;

describe('prep — case the job', () => {
  it('prepCostFor is a share of the base take', () => {
    expect(prepCostFor(HEIST)).toBe(Math.round(HEIST.payoutPerSec * HEIST.durationSec * CONFIG.prepCostFrac));
  });

  it('launching with prep charges the cost and records the odds bump', () => {
    const s = makeState('driver', 6, 3);
    const res = launchHeist(s, 'smash_grab', s.crews[0].id, T0, 1, CONFIG, 'quiet', true);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.cash).toBe(s.cash - prepCostFor(HEIST));
    expect(res.state.activeHeists[0].prepOdds).toBe(CONFIG.prepOddsBonus);
  });

  it('launching without prep charges nothing and stores no bump', () => {
    const s = makeState('driver', 6, 3);
    const res = launchHeist(s, 'smash_grab', s.crews[0].id, T0, 1, CONFIG, 'quiet', false);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.cash).toBe(s.cash);
    expect(res.state.activeHeists[0].prepOdds).toBeUndefined();
  });

  it('prep is skipped (not charged) when the crew cannot afford it', () => {
    const s = makeState('driver', 6, 3, 10); // far below prep cost
    const res = launchHeist(s, 'smash_grab', s.crews[0].id, T0, 1, CONFIG, 'quiet', true);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.cash).toBe(10);
    expect(res.state.activeHeists[0].prepOdds).toBeUndefined();
  });

  it('prep raises the previewed odds', () => {
    const s = makeState('driver', 6, 3);
    const crew = s.crews[0];
    const base = estimateSuccess(s, HEIST, crew, T0, undefined, 0);
    const cased = estimateSuccess(s, HEIST, crew, T0, undefined, CONFIG.prepOddsBonus);
    expect(cased).toBeGreaterThan(base);
  });

  it('prep can flip an otherwise-blown run — same seed, same rolls', () => {
    // eff = 4 => each member chance = 0.5 + 0.045*4 - 0.02*4 = 0.60. Rolls of 0.65
    // fail without prep (0.65 > 0.60) but pass with prep (0.65 < 0.72).
    const s = makeState('driver', 4, 3);
    const crewId = s.crews[0].id;
    const noPrep = launchHeist(s, 'smash_grab', crewId, T0, 1, CONFIG, 'quiet', false);
    const withPrep = launchHeist(s, 'smash_grab', crewId, T0, 1, CONFIG, 'quiet', true);
    if (!noPrep.ok || !withPrep.ok) return;
    const aN = noPrep.state.activeHeists[0];
    const aP = withPrep.state.activeHeists[0];
    // 3 member rolls of 0.65, then a high injury-chance roll so the blown run isn't
    // also an injury (keeps the assertion about success clean).
    const rN = collectHeist(noPrep.state, aN.id, aN.endsAt, seq(0.65, 0.65, 0.65, 0.99), CONFIG);
    const rP = collectHeist(withPrep.state, aP.id, aP.endsAt, seq(0.65, 0.65, 0.65, 0.99), CONFIG);
    expect(rN.ok && rP.ok).toBe(true);
    if (!rN.ok || !rP.ok) return;
    expect(rN.report?.success).toBe(false);
    expect(rP.report?.success).toBe(true);
  });
});
