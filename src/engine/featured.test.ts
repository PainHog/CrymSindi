import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import { HEISTS } from '../data/heists';
import type { RoleId } from '../data/roles';
import { createInitialState } from './state';
import { launchHeist, collectHeist } from './heists';
import {
  featuredBonusFor,
  featuredForRotation,
  featuredRotationIndex,
  msUntilNextRotation,
} from './featured';
import type { GameState, Member } from './types';

const PERIOD = CONFIG.featuredRotationSec * 1000;

function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

/** A big, role-complete, unlocked crew that can launch any catalog heist. */
function bigCrewState(): GameState {
  const base = createInitialState(0);
  const roles: RoleId[] = ['hacker', 'muscle', 'driver', 'lookout', 'hacker', 'muscle'];
  const members: Member[] = roles.map((role, i) => ({
    id: `m${i + 1}`,
    name: `M${i + 1}`,
    role,
    skill: 12,
    gearIds: [],
  }));
  return {
    ...base,
    cash: 1_000_000,
    lifetimeCash: 2_000_000, // unlock every tier
    members,
    crews: [{ ...base.crews[0], memberIds: members.map((m) => m.id), maxMembers: 8 }],
  };
}

describe('featured jobs', () => {
  it('is deterministic per rotation and picks featuredCount heists in range', () => {
    const a = featuredForRotation(5);
    const b = featuredForRotation(5);
    expect(a).toEqual(b);
    expect(a).toHaveLength(Math.min(CONFIG.featuredCount, HEISTS.length));
    for (const e of a) {
      expect(e.bonusMult).toBeGreaterThanOrEqual(CONFIG.featuredBonusMin);
      expect(e.bonusMult).toBeLessThanOrEqual(CONFIG.featuredBonusMax);
      expect(HEISTS.some((h) => h.id === e.heistId)).toBe(true);
    }
  });

  it('different rotations generally feature a different set', () => {
    const ids = (i: number) => featuredForRotation(i).map((e) => e.heistId).join(',');
    const distinct = new Set([ids(0), ids(1), ids(2), ids(3), ids(4)]);
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('featuredBonusFor matches the current rotation; non-featured heists get 1x', () => {
    const now = 3 * PERIOD + 1234;
    expect(featuredRotationIndex(now)).toBe(3);
    const set = featuredForRotation(3);
    for (const e of set) expect(featuredBonusFor(e.heistId, now)).toBe(e.bonusMult);
    const notFeatured = HEISTS.find((h) => !set.some((e) => e.heistId === h.id));
    expect(notFeatured).toBeDefined();
    if (notFeatured) expect(featuredBonusFor(notFeatured.id, now)).toBe(1);
  });

  it('msUntilNextRotation is within (0, period]', () => {
    expect(msUntilNextRotation(0)).toBe(PERIOD);
    const m = msUntilNextRotation(PERIOD * 2 + 500);
    expect(m).toBe(PERIOD - 500);
  });

  it('launching a featured job locks in its bonus and pays it out', () => {
    const s = bigCrewState();
    const feat = featuredForRotation(0)[0];
    const hid = feat.heistId;
    const now = 1000; // rotation 0
    // Find a rotation where this heist is NOT featured, for a control launch.
    let idx2 = 1;
    while (featuredForRotation(idx2).some((f) => f.heistId === hid)) idx2++;
    const now2 = idx2 * PERIOD + 1000;

    const featured = launchHeist(s, hid, s.crews[0].id, now, 7, CONFIG);
    const control = launchHeist(s, hid, s.crews[0].id, now2, 7, CONFIG);
    expect(featured.ok && control.ok).toBe(true);
    if (!featured.ok || !control.ok) return;
    const aF = featured.state.activeHeists[0];
    const aC = control.state.activeHeists[0];
    expect(aF.featuredMult).toBe(feat.bonusMult);
    expect(aC.featuredMult).toBeUndefined();

    // Same crew, same forced-success rolls → payout differs only by the bonus.
    const win = () => seq(0.01, 0.01, 0.01, 0.01, 0.01, 0.01);
    const rF = collectHeist(featured.state, aF.id, aF.endsAt, win(), CONFIG);
    const rC = collectHeist(control.state, aC.id, aC.endsAt, win(), CONFIG);
    if (!rF.ok || !rC.ok) return;
    const payF = rF.report?.payout ?? 0;
    const payC = rC.report?.payout ?? 0;
    expect(payF).toBeGreaterThan(payC);
    expect(payF / payC).toBeCloseTo(feat.bonusMult, 1);
  });
});
