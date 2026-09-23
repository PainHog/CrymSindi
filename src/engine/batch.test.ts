import { describe, it, expect } from 'vitest';
import { gearForRole } from '../data/gear';
import { createInitialState } from './state';
import { fillCrew, gearUpCrew, sendAllIdle } from './batch';
import { getCrew, getMember } from './selectors';
import type { Crew, GameState } from './types';

const T0 = 1_000_000_000_000;

describe('sendAllIdle', () => {
  it('launches every idle crew that can run the heist', () => {
    const base = createInitialState(T0);
    // A second idle crew (smash_grab needs no roles and 3 members).
    const c2: Crew = { id: 'c2', safehouseId: 's1', memberIds: ['m1', 'm2', 'm3'], maxMembers: 8, status: 'idle' };
    const state: GameState = { ...base, crews: [base.crews[0], c2] };
    const res = sendAllIdle(state, 'smash_grab', T0);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.activeHeists).toHaveLength(2);
    expect(res.state.crews.every((c) => c.status === 'onHeist')).toBe(true);
  });

  it('skips a busy crew and errors when none are idle-eligible', () => {
    const base = createInitialState(T0);
    const busy: Crew = { ...base.crews[0], status: 'onHeist' };
    const res = sendAllIdle({ ...base, crews: [busy] }, 'smash_grab', T0);
    expect(res.ok).toBe(false);
  });

  it('launches the idle crew while leaving a busy one untouched', () => {
    const base = createInitialState(T0);
    const busy: Crew = { ...base.crews[0], status: 'onHeist' };
    const idle: Crew = { id: 'c2', safehouseId: 's1', memberIds: ['m1', 'm2', 'm3'], maxMembers: 8, status: 'idle' };
    const res = sendAllIdle({ ...base, crews: [busy, idle] }, 'smash_grab', T0);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.activeHeists).toHaveLength(1); // only the idle crew launched
    expect(getCrew(res.state, 'c1')!.status).toBe('onHeist'); // busy crew unchanged
    expect(getCrew(res.state, 'c2')!.status).toBe('onHeist'); // idle crew now on the job
  });

  it('stops mid-burst once launches push Heat to the cap', () => {
    const base = createInitialState(T0);
    const c2: Crew = { id: 'c2', safehouseId: 's1', memberIds: ['m1', 'm2', 'm3'], maxMembers: 8, status: 'idle' };
    // Start near max: the first smash_grab (+heatCost) maxes Heat, blocking the 2nd.
    const hot: GameState = { ...base, heat: 96, heatUpdatedAt: T0, crews: [base.crews[0], c2] };
    const res = sendAllIdle(hot, 'smash_grab', T0);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.activeHeists).toHaveLength(1); // 2nd crew blocked by maxed Heat
  });

  it('errors when a locked heist is requested', () => {
    const res = sendAllIdle(createInitialState(T0), 'central_bank', T0); // tier 5, locked
    expect(res.ok).toBe(false);
  });
});

describe('gearUpCrew', () => {
  it('buys the cheapest affordable gear across the crew and stops when broke', () => {
    // Cheapest gear for each starter role is $300; cash 650 affords exactly two.
    const res = gearUpCrew({ ...createInitialState(T0), cash: 650 }, 'c1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const owned = res.state.members.reduce((n, m) => n + m.gearIds.length, 0);
    expect(owned).toBe(2);
    expect(res.state.cash).toBe(50);
  });

  it('errors when nothing is affordable', () => {
    expect(gearUpCrew({ ...createInitialState(T0), cash: 0 }, 'c1').ok).toBe(false);
  });

  it('errors when the crew is already fully geared', () => {
    const base = createInitialState(T0);
    const members = base.members.map((m) => ({ ...m, gearIds: gearForRole(m.role).map((g) => g.id) }));
    expect(gearUpCrew({ ...base, members, cash: 100000 }, 'c1').ok).toBe(false);
  });

  it('refuses a crew that is on a job', () => {
    const base = createInitialState(T0);
    const busy: Crew = { ...base.crews[0], status: 'onHeist' };
    expect(gearUpCrew({ ...base, crews: [busy], cash: 100000 }, 'c1').ok).toBe(false);
  });
});

describe('fillCrew', () => {
  it('covers the missing role and fills toward the cap when cash allows', () => {
    const res = fillCrew({ ...createInitialState(T0), cash: 100000 }, 'c1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const crew = getCrew(res.state, 'c1')!;
    expect(crew.memberIds.length).toBe(crew.maxMembers); // plenty of cash -> fills to 8
    const roles = new Set(crew.memberIds.map((id) => getMember(res.state, id)!.role));
    expect(roles.has('lookout')).toBe(true); // starter crew was missing a lookout
  });

  it('recruits the missing role first even on a tight budget', () => {
    // Enough for exactly one recruit; it must be the missing lookout, not redundancy.
    const base = createInitialState(T0);
    const cost = Math.round(130 * Math.pow(1.5, 3)); // lookout recruitCost at 3 members
    const res = fillCrew({ ...base, cash: cost }, 'c1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const crew = getCrew(res.state, 'c1')!;
    expect(crew.memberIds.length).toBe(4);
    expect(getMember(res.state, crew.memberIds[3])!.role).toBe('lookout');
  });

  it('errors when the crew is already full', () => {
    const base = createInitialState(T0);
    const full: Crew = { ...base.crews[0], memberIds: ['m1', 'm2', 'm3', 'm1', 'm2', 'm3', 'm1', 'm2'] };
    expect(fillCrew({ ...base, crews: [full], cash: 100000 }, 'c1').ok).toBe(false);
  });
});
