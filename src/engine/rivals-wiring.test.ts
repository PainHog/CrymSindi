import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import type { RoleId } from '../data/roles';
import { createInitialState } from './state';
import { launchHeist, collectHeist } from './heists';
import { prestige, ascend } from './economy';
import { rivalForWindow, rivalContestsHeist } from './rivals';
import type { GameState, Member } from './types';

const PERIOD = CONFIG.rivalWindowSec * 1000;
const at = (index: number) => index * PERIOD + 1000;
const forcedWin = () => () => 0.01; // every member passes, no injury roll
const forcedLoss = () => () => 0.99; // everyone fails

/** A big, role-complete, all-tiers-unlocked crew that can launch any catalog job. */
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
    cash: 5_000_000,
    lifetimeCash: 5_000_000,
    members,
    crews: [{ ...base.crews[0], memberIds: members.map((m) => m.id), maxMembers: 8 }],
  };
}

/** First window (default config) that contests a launchable job (skip the
 *  ascension-gated capstone, which bigCrewState can't run at ascendCount 0). */
function findContestWindow(limit = 4000): { now: number; heistId: string; rivalId: string } {
  for (let i = 0; i < limit; i++) {
    const c = rivalForWindow(i);
    if (c && c.heistId !== 'sovereign_reserve') {
      return { now: at(i), heistId: c.heistId, rivalId: c.rival.id };
    }
  }
  throw new Error('no contested window found');
}

/** A time when `heistId` is NOT contested (a clean control). */
function findQuietFor(heistId: string, limit = 4000): number {
  for (let i = 0; i < limit; i++) {
    const now = at(i);
    if (!rivalContestsHeist(heistId, now)) return now;
  }
  throw new Error(`no quiet window found for ${heistId}`);
}

describe('rival wiring (launch/collect)', () => {
  it('snapshots the contesting rival onto the active heist at launch', () => {
    const { now, heistId, rivalId } = findContestWindow();
    const s = bigCrewState();
    const r = launchHeist(s, heistId, s.crews[0].id, now, 7, CONFIG, 'quiet');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.activeHeists[0].rivalId).toBe(rivalId);
  });

  it('a clean win on a contested job seizes the turf: spoils + a turf-win', () => {
    const { now, heistId } = findContestWindow();
    const s = bigCrewState();
    const r = launchHeist(s, heistId, s.crews[0].id, now, 7, CONFIG, 'quiet');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = r.state.activeHeists[0];
    const cashBefore = r.state.cash;

    const c = collectHeist(r.state, a.id, a.endsAt, forcedWin(), CONFIG);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const rep = c.report!;
    expect(rep.success).toBe(true);
    expect(rep.turfSeized).toBe(true);
    expect(rep.rivalSpoils).toBe(Math.round(rep.payout * CONFIG.rivalSpoilsFrac));
    expect(c.state.turfWins).toBe(1);
    // Cash gained = the take PLUS the spoils (spoils sit outside the payout).
    expect(c.state.cash - cashBefore).toBe(rep.payout + (rep.rivalSpoils ?? 0));
  });

  it('a blown contested job does not seize the turf', () => {
    const { now, heistId } = findContestWindow();
    const s = bigCrewState();
    const r = launchHeist(s, heistId, s.crews[0].id, now, 7, CONFIG, 'quiet');
    if (!r.ok) return;
    const a = r.state.activeHeists[0];
    const c = collectHeist(r.state, a.id, a.endsAt, forcedLoss(), CONFIG);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.report!.success).toBe(false);
    expect(c.report!.turfSeized).toBeFalsy();
    expect(c.state.turfWins).toBe(0);
  });

  it('an uncontested job never seizes turf (backward compatible)', () => {
    const heistId = 'smash_grab';
    const now = findQuietFor(heistId);
    const s = bigCrewState();
    const r = launchHeist(s, heistId, s.crews[0].id, now, 7, CONFIG, 'quiet');
    if (!r.ok) return;
    expect(r.state.activeHeists[0].rivalId).toBeUndefined();
    const a = r.state.activeHeists[0];
    const c = collectHeist(r.state, a.id, a.endsAt, forcedWin(), CONFIG);
    if (!c.ok) return;
    expect(c.report!.turfSeized).toBeFalsy();
    expect(c.state.turfWins).toBe(0);
  });

  it('turf wins are a career total: they survive prestige and ascension', () => {
    const seeded: GameState = { ...bigCrewState(), turfWins: 3, notoriety: 200 };
    const p = prestige(seeded, 1_000);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.state.turfWins).toBe(3);

    const a = ascend(seeded, 1_000);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.state.turfWins).toBe(3);
  });
});
