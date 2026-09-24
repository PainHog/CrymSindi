import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import type { RoleId } from '../data/roles';
import { createInitialState } from './state';
import { launchHeist, collectHeist } from './heists';
import { featuredBonusFor } from './featured';
import { eventForHeist, eventForWindow } from './events';
import type { GameState, Member } from './types';

const PERIOD = CONFIG.eventWindowSec * 1000;
const at = (index: number) => index * PERIOD + 1000;
const forcedWin = () => () => 0.01; // every member passes, no injury roll

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

/** Find a window whose event has `id` flagging a job that is NOT featured then. */
function findEventJob(id: string, limit = 4000): { now: number; heistId: string } {
  for (let i = 0; i < limit; i++) {
    const ev = eventForWindow(i);
    if (!ev || ev.def.id !== id) continue;
    for (const h of ev.heistIds) {
      if (featuredBonusFor(h, at(i)) === 1) return { now: at(i), heistId: h };
    }
  }
  throw new Error(`no un-featured window found for event ${id}`);
}

/** Find a time when `heistId` has no event and isn't featured (a clean control). */
function findQuietFor(heistId: string, limit = 4000): number {
  for (let i = 0; i < limit; i++) {
    const now = at(i);
    if (!eventForHeist(heistId, now) && featuredBonusFor(heistId, now) === 1) return now;
  }
  throw new Error(`no quiet window found for ${heistId}`);
}

describe('events wiring (launch/resolve)', () => {
  it('locks a reward event onto the active heist at launch', () => {
    const { now, heistId } = findEventJob('fence_in_town'); // rewardMult 1.4, no oddsDelta
    const s = bigCrewState();
    const r = launchHeist(s, heistId, s.crews[0].id, now, 7, CONFIG, 'quiet');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = r.state.activeHeists[0];
    expect(a.eventId).toBe('fence_in_town');
    expect(a.eventRewardMult).toBe(1.4);
    expect(a.eventOddsDelta).toBeUndefined(); // fence has no odds effect
    expect(a.featuredMult).toBeUndefined();
  });

  it('locks an odds event (inside contact) onto the active heist', () => {
    const { now, heistId } = findEventJob('inside_job'); // oddsDelta +0.12, no reward
    const s = bigCrewState();
    const r = launchHeist(s, heistId, s.crews[0].id, now, 7, CONFIG, 'quiet');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = r.state.activeHeists[0];
    expect(a.eventId).toBe('inside_job');
    expect(a.eventOddsDelta).toBeCloseTo(0.12, 5);
    expect(a.eventRewardMult).toBeUndefined();
  });

  it('a reward event pays its bonus, and it stays locked after the window ends', () => {
    const { now, heistId } = findEventJob('fence_in_town');
    const quiet = findQuietFor(heistId);
    const s = bigCrewState();

    const ev = launchHeist(s, heistId, s.crews[0].id, now, 7, CONFIG, 'quiet');
    const ctl = launchHeist(s, heistId, s.crews[0].id, quiet, 7, CONFIG, 'quiet');
    expect(ev.ok && ctl.ok).toBe(true);
    if (!ev.ok || !ctl.ok) return;
    const aEv = ev.state.activeHeists[0];
    const aCtl = ctl.state.activeHeists[0];

    // Collect the event job at its end — for a long job that's well past the
    // 45-min event window, proving the bonus is locked, not recomputed.
    const rEv = collectHeist(ev.state, aEv.id, aEv.endsAt, forcedWin(), CONFIG);
    const rCtl = collectHeist(ctl.state, aCtl.id, aCtl.endsAt, forcedWin(), CONFIG);
    if (!rEv.ok || !rCtl.ok) return;
    const payEv = rEv.report?.payout ?? 0;
    const payCtl = rCtl.report?.payout ?? 0;
    expect(payEv).toBeGreaterThan(payCtl);
    expect(payEv / payCtl).toBeCloseTo(1.4, 1);
  });

  it('featured wins: a featured job launched during an event carries no event', () => {
    // Find a moment a job is BOTH featured and event-flagged.
    let hit: { now: number; heistId: string } | null = null;
    for (let i = 0; i < 4000 && !hit; i++) {
      const ev = eventForWindow(i);
      if (!ev) continue;
      for (const h of ev.heistIds) {
        if (featuredBonusFor(h, at(i)) > 1) {
          hit = { now: at(i), heistId: h };
          break;
        }
      }
    }
    expect(hit).not.toBeNull();
    if (!hit) return;

    const s = bigCrewState();
    const r = launchHeist(s, hit.heistId, s.crews[0].id, hit.now, 7, CONFIG, 'quiet');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = r.state.activeHeists[0];
    expect(a.featuredMult).toBeGreaterThan(1);
    expect(a.eventId).toBeUndefined();
    expect(a.eventRewardMult).toBeUndefined();
    expect(a.eventOddsDelta).toBeUndefined();
  });

  it('the collected report carries the event id for the debrief', () => {
    const { now, heistId } = findEventJob('fence_in_town');
    const s = bigCrewState();
    const r = launchHeist(s, heistId, s.crews[0].id, now, 7, CONFIG, 'quiet');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = r.state.activeHeists[0];
    const c = collectHeist(r.state, a.id, a.endsAt, forcedWin(), CONFIG);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.report?.eventId).toBe('fence_in_town');
  });

  it('no event, no featured => clean active heist (backward compatible)', () => {
    const heistId = 'smash_grab';
    const now = findQuietFor(heistId);
    const s = bigCrewState();
    const r = launchHeist(s, heistId, s.crews[0].id, now, 7, CONFIG, 'quiet');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = r.state.activeHeists[0];
    expect(a.eventId).toBeUndefined();
    expect(a.eventRewardMult).toBeUndefined();
    expect(a.eventOddsDelta).toBeUndefined();
    expect(a.featuredMult).toBeUndefined();
  });
});
