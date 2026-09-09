import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import { HEISTS_BY_ID } from '../data/heists';
import type { RoleId } from '../data/roles';
import { createInitialState } from './state';
import { launchHeist, collectHeist } from './heists';
import {
  estimateSuccess,
  memberPassChance,
  minMembersFor,
  requiredPassesFor,
  resolveHeist,
} from './resolution';
import { getCrew } from './selectors';
import type { GameState, Member } from './types';

const T0 = 1_000_000_000_000;

/** rng stub yielding a fixed sequence, repeating the last value. */
function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

interface Spec {
  role: RoleId;
  skill: number;
  gear?: string[];
}

/** Build a state with one idle crew of the given members. */
function makeState(specs: Spec[]): GameState {
  const base = createInitialState(T0);
  const members: Member[] = specs.map((s, i) => ({
    id: `m${i + 1}`,
    name: `M${i + 1}`,
    role: s.role,
    skill: s.skill,
    gearIds: s.gear ?? [],
  }));
  return {
    ...base,
    members,
    crews: [{ ...base.crews[0], memberIds: members.map((m) => m.id), maxMembers: 8 }],
  };
}

describe('resolution numbers', () => {
  it('memberPassChance follows the formula and clamps', () => {
    // 0.5 + 0.045*3 - 0.02*4 - 0 = 0.555
    expect(memberPassChance(3, 4, 0)).toBeCloseTo(0.555, 5);
    expect(memberPassChance(1000, 4, 0)).toBe(CONFIG.memberChanceMax);
    expect(memberPassChance(0, 1000, 0)).toBe(CONFIG.memberChanceMin);
  });

  it('heat drags each member chance down', () => {
    const noHeat = memberPassChance(10, 20, 0);
    const hot = memberPassChance(10, 20, CONFIG.maxHeat);
    expect(hot).toBeCloseTo(noHeat - CONFIG.heatSuccessPenalty, 5);
  });

  it('requiredPasses and minMembers scale with difficulty', () => {
    expect(requiredPassesFor(HEISTS_BY_ID['smash_grab'])).toBe(2);
    expect(requiredPassesFor(HEISTS_BY_ID['bank_vault'])).toBe(3); // 2 + floor(28/18)
    expect(requiredPassesFor(HEISTS_BY_ID['central_bank'])).toBe(5); // 2 + floor(70/18)
    expect(minMembersFor(HEISTS_BY_ID['smash_grab'])).toBe(3);
    expect(minMembersFor(HEISTS_BY_ID['central_bank'])).toBe(5);
  });
});

describe('resolveHeist outcomes', () => {
  const smash = HEISTS_BY_ID['smash_grab'];

  // base = payoutPerSec(6) * durationSec(20) = 120; requiredPasses(smash)=2;
  // target = 2 + qualitySlack(3) = 5; takeFrac = 0.35 + 0.65*clamp(pass/5).
  it('a flawless run pays the perfect bonus', () => {
    const state = makeState([
      { role: 'driver', skill: 5 },
      { role: 'muscle', skill: 5 },
      { role: 'hacker', skill: 5 },
    ]);
    const report = resolveHeist(state, smash, getCrew(state, 'c1')!, T0, seq(0)); // everyone passes
    expect(report.success).toBe(true);
    expect(report.perfect).toBe(true);
    expect(report.quality).toBe(1);
    // 3 passed: takeFrac = 0.35 + 0.65*(3/5) = 0.74 -> 120*0.74 = 88.8 -> 89; perfect x1.75 -> 156
    expect(report.payout).toBe(156);
    expect(report.perfectBonus).toBe(67);
    expect(report.heatAdded).toBe(0);
  });

  it('a failed run still salvages a fraction of the base and adds fail heat', () => {
    const state = makeState([
      { role: 'driver', skill: 5 },
      { role: 'muscle', skill: 5 },
      { role: 'hacker', skill: 5 },
    ]);
    const report = resolveHeist(state, smash, getCrew(state, 'c1')!, T0, seq(0.999));
    expect(report.success).toBe(false);
    // salvage = base(120) * failPayoutFrac(0.2) = 24
    expect(report.payout).toBe(24);
    expect(report.heatAdded).toBeCloseTo(smash.failHeatBonus, 5);
  });

  it('scales the take by how many passed', () => {
    const state = makeState([
      { role: 'driver', skill: 5 },
      { role: 'muscle', skill: 5 },
      { role: 'hacker', skill: 5 },
      { role: 'lookout', skill: 5 },
    ]);
    // first 3 pass, 4th fails
    const report = resolveHeist(state, smash, getCrew(state, 'c1')!, T0, seq(0, 0, 0, 0.999));
    expect(report.success).toBe(true);
    expect(report.perfect).toBe(false);
    expect(report.quality).toBe(0.75);
    // 3 passed: takeFrac = 0.35 + 0.65*(3/5) = 0.74 -> 120*0.74 = 88.8 -> 89
    expect(report.payout).toBe(89);
  });

  it('fails when a required role has no passer, even if enough others pass', () => {
    const atm = HEISTS_BY_ID['atm_skim']; // requires hacker, requiredPasses 2
    const state = makeState([
      { role: 'driver', skill: 9 },
      { role: 'hacker', skill: 9 },
      { role: 'muscle', skill: 9 },
    ]);
    // driver pass, hacker FAIL, muscle pass -> 2 passes but hacker uncovered
    const report = resolveHeist(state, atm, getCrew(state, 'c1')!, T0, seq(0, 0.999, 0));
    expect(report.passCount).toBe(2);
    expect(report.success).toBe(false);
    expect(report.missingRoleCoverage).toEqual(['hacker']);
  });

  it('fails a high-difficulty job when too few members pass', () => {
    const central = HEISTS_BY_ID['central_bank']; // requiredPasses 5
    const state = makeState([
      { role: 'hacker', skill: 20 },
      { role: 'muscle', skill: 20 },
      { role: 'driver', skill: 20 },
    ]);
    const report = resolveHeist(state, central, getCrew(state, 'c1')!, T0, seq(0)); // all 3 pass
    expect(report.passCount).toBe(3);
    expect(report.requiredPasses).toBe(5);
    expect(report.success).toBe(false); // roles covered, but not enough hands
    expect(report.recommendations.some((r) => r.kind === 'crewSize')).toBe(true);
  });

  it('produces a per-member beat for every member', () => {
    const state = makeState([
      { role: 'driver', skill: 5 },
      { role: 'muscle', skill: 5 },
      { role: 'hacker', skill: 5 },
    ]);
    const report = resolveHeist(state, smash, getCrew(state, 'c1')!, T0, seq(0));
    expect(report.members).toHaveLength(3);
    for (const b of report.members) {
      expect(typeof b.detail).toBe('string');
      expect(b.detail.length).toBeGreaterThan(0);
      expect(['flawless', 'clean', 'shaky', 'botched']).toContain(b.quality);
    }
  });
});

describe('estimateSuccess', () => {
  const smash = HEISTS_BY_ID['smash_grab'];

  it('is 0 for a crew below the member minimum', () => {
    const state = makeState([
      { role: 'driver', skill: 5 },
      { role: 'muscle', skill: 5 },
    ]);
    expect(estimateSuccess(state, smash, getCrew(state, 'c1')!, T0)).toBe(0);
  });

  it('rises with crew skill', () => {
    const weak = makeState([
      { role: 'driver', skill: 3 },
      { role: 'muscle', skill: 3 },
      { role: 'hacker', skill: 3 },
    ]);
    const strong = makeState([
      { role: 'driver', skill: 12 },
      { role: 'muscle', skill: 12 },
      { role: 'hacker', skill: 12 },
    ]);
    const eWeak = estimateSuccess(weak, smash, getCrew(weak, 'c1')!, T0);
    const eStrong = estimateSuccess(strong, smash, getCrew(strong, 'c1')!, T0);
    expect(eStrong).toBeGreaterThan(eWeak);
    expect(eWeak).toBeGreaterThan(0);
    expect(eStrong).toBeLessThanOrEqual(1);
  });
});

describe('launch + collect integration', () => {
  it('rejects launching with fewer than the minimum crew', () => {
    const state = makeState([
      { role: 'driver', skill: 5 },
      { role: 'muscle', skill: 5 },
    ]);
    const res = launchHeist(state, 'smash_grab', 'c1', T0);
    expect(res.ok).toBe(false);
  });

  it('launch then collect returns a report and frees the crew', () => {
    const state = makeState([
      { role: 'driver', skill: 6 },
      { role: 'muscle', skill: 6 },
      { role: 'hacker', skill: 6 },
    ]);
    const launched = launchHeist(state, 'smash_grab', 'c1', T0);
    expect(launched.ok).toBe(true);
    if (!launched.ok) return;
    const endsAt = launched.state.activeHeists[0].endsAt;
    const collected = collectHeist(launched.state, launched.state.activeHeists[0].id, endsAt, seq(0));
    expect(collected.ok).toBe(true);
    if (!collected.ok) return;
    expect(collected.report).toBeTruthy();
    expect(collected.report!.members).toHaveLength(3);
    expect(getCrew(collected.state, 'c1')!.status).toBe('idle');
  });
});
