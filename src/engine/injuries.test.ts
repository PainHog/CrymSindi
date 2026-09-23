import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import { HEISTS_BY_ID } from '../data/heists';
import type { RoleId } from '../data/roles';
import { createInitialState } from './state';
import { launchBlockReason, launchHeist, collectHeist } from './heists';
import { healMember } from './economy';
import { estimateSuccess } from './resolution';
import { healCost, isMemberDown } from './selectors';
import type { GameState, Member } from './types';

const T0 = 1_000_000_000_000;

function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

function makeState(role: RoleId, skill: number, n: number, cash = 5000): GameState {
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

const HEIST = HEISTS_BY_ID.smash_grab; // difficulty 4, dur 20s, min crew 3

describe('crew injuries', () => {
  it('launch snapshots the healthy participants', () => {
    const s = makeState('driver', 6, 3);
    const res = launchHeist(s, 'smash_grab', s.crews[0].id, T0, 1, CONFIG);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.activeHeists[0].memberIds).toEqual(['m1', 'm2', 'm3']);
  });

  it('a blown job can bench a member who failed, for the recovery window', () => {
    const s = makeState('driver', 3, 3);
    const launched = launchHeist(s, 'smash_grab', s.crews[0].id, T0, 1, CONFIG);
    expect(launched.ok).toBe(true);
    if (!launched.ok) return;
    const a = launched.state.activeHeists[0];
    // 3 failing rolls, then injury-chance roll (0.01 < 0.15 base), then target 0.
    const res = collectHeist(launched.state, a.id, a.endsAt, seq(0.99, 0.99, 0.99, 0.01, 0), CONFIG);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.report?.success).toBe(false);
    const down = res.state.members.filter((m) => isMemberDown(m, a.endsAt));
    expect(down.length).toBe(1);
    expect(down[0].downUntil).toBe(a.endsAt + CONFIG.injuryRecoverySec * 1000);
    // never benches everyone — at least one member stays healthy.
    expect(res.state.members.some((m) => !isMemberDown(m, a.endsAt))).toBe(true);
  });

  it('a successful job never injures anyone', () => {
    const s = makeState('driver', 12, 3);
    const launched = launchHeist(s, 'smash_grab', s.crews[0].id, T0, 1, CONFIG);
    if (!launched.ok) return;
    const a = launched.state.activeHeists[0];
    const res = collectHeist(launched.state, a.id, a.endsAt, seq(0.01, 0.01, 0.01), CONFIG);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.report?.success).toBe(true);
    expect(res.state.members.every((m) => !isMemberDown(m, a.endsAt))).toBe(true);
  });

  it('a low injury-chance roll leaves the crew unhurt', () => {
    const s = makeState('driver', 3, 3);
    const launched = launchHeist(s, 'smash_grab', s.crews[0].id, T0, 1, CONFIG);
    if (!launched.ok) return;
    const a = launched.state.activeHeists[0];
    // fail the job, but the injury-chance roll (0.9) exceeds the base chance.
    const res = collectHeist(launched.state, a.id, a.endsAt, seq(0.99, 0.99, 0.99, 0.9), CONFIG);
    if (!res.ok) return;
    expect(res.report?.success).toBe(false);
    expect(res.state.members.every((m) => !isMemberDown(m, a.endsAt))).toBe(true);
  });

  it('an injured member cannot be sent — launch is blocked', () => {
    const s = makeState('driver', 5, 3);
    s.members[0].downUntil = T0 + 10_000;
    const reason = launchBlockReason(s, 'smash_grab', s.crews[0].id, T0);
    expect(reason).toMatch(/recovering/i);
  });

  it('estimateSuccess ignores an injured member', () => {
    const s = makeState('driver', 8, 4);
    const full = estimateSuccess(s, HEIST, s.crews[0], T0);
    s.members[0].downUntil = T0 + 10_000;
    const hurt = estimateSuccess(s, HEIST, s.crews[0], T0);
    expect(hurt).toBeLessThan(full);
  });

  it('heal patches a member up for cash; healing a healthy member fails', () => {
    const s = makeState('driver', 6, 3);
    s.members[0].downUntil = T0 + 10_000;
    const cost = healCost(s.members[0]);
    const res = healMember(s, 'm1', T0, CONFIG);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.cash).toBe(s.cash - cost);
    expect(res.state.members[0].downUntil).toBeUndefined();
    const again = healMember(res.state, 'm1', T0, CONFIG);
    expect(again.ok).toBe(false);
  });

  it('recovery is time-based — a member heals on their own once the timer passes', () => {
    const m: Member = { id: 'x', name: 'X', role: 'driver', skill: 5, gearIds: [], downUntil: T0 + 1000 };
    expect(isMemberDown(m, T0)).toBe(true);
    expect(isMemberDown(m, T0 + 2000)).toBe(false);
  });
});
