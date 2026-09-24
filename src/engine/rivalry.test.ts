import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import type { RoleId } from '../data/roles';
import { createInitialState } from './state';
import { launchHeist, collectHeist } from './heists';
import { prestige, ascend } from './economy';
import {
  rivalForWindow,
  rivalryLevel,
  rivalStakeMult,
  rivalSpoilsWithStanding,
  isRivalDominated,
} from './rivals';
import type { GameState, Member } from './types';

const PERIOD = CONFIG.rivalWindowSec * 1000;
const at = (index: number) => index * PERIOD + 1000;
const forcedWin = () => () => 0.01;

function bigCrewState(): GameState {
  const base = createInitialState(0);
  const roles: RoleId[] = ['hacker', 'muscle', 'driver', 'lookout', 'hacker', 'muscle'];
  const members: Member[] = roles.map((role, i) => ({ id: `m${i + 1}`, name: `M${i + 1}`, role, skill: 12, gearIds: [] }));
  return {
    ...base,
    cash: 5_000_000,
    lifetimeCash: 5_000_000,
    members,
    crews: [{ ...base.crews[0], memberIds: members.map((m) => m.id), maxMembers: 8 }],
  };
}

function findContestWindow(limit = 4000): { now: number; heistId: string; rivalId: string } {
  for (let i = 0; i < limit; i++) {
    const c = rivalForWindow(i);
    if (c && c.heistId !== 'sovereign_reserve') return { now: at(i), heistId: c.heistId, rivalId: c.rival.id };
  }
  throw new Error('no contested window found');
}

describe('rivalry standing selectors', () => {
  it('levels up every rivalWinsPerLevel wins and caps the escalation', () => {
    const s = createInitialState(0);
    const withWins = (n: number): GameState => ({ ...s, rivalWins: { r: n } });
    expect(rivalryLevel(withWins(0), 'r')).toBe(0);
    expect(rivalryLevel(withWins(3), 'r')).toBe(1);
    expect(rivalryLevel(withWins(6), 'r')).toBe(2);
    expect(rivalStakeMult(withWins(0), 'r')).toBeCloseTo(1, 5);
    expect(rivalStakeMult(withWins(3), 'r')).toBeCloseTo(1.2, 5);
    expect(rivalStakeMult(withWins(6), 'r')).toBeCloseTo(1.4, 5);
    // Cap: +100% max (level 5 = 15 wins), and it stops climbing past that.
    expect(rivalStakeMult(withWins(15), 'r')).toBeCloseTo(2, 5);
    expect(rivalStakeMult(withWins(60), 'r')).toBeCloseTo(2, 5);
  });

  it('escalates the spoils by the standing multiplier', () => {
    const s = createInitialState(0);
    expect(rivalSpoilsWithStanding({ ...s, rivalWins: {} }, 'r', 1000)).toBe(500); // level 0
    expect(rivalSpoilsWithStanding({ ...s, rivalWins: { r: 6 } }, 'r', 1000)).toBe(700); // ×1.4
  });
});

describe('rivalry escalation + domination at collect', () => {
  it('pays escalated spoils based on prior standing and increments the per-rival win', () => {
    const { now, heistId, rivalId } = findContestWindow();
    // 3 prior wins → rivalry level 1 (×1.2), still below the domination threshold.
    const s: GameState = { ...bigCrewState(), rivalWins: { [rivalId]: 3 } };
    const r = launchHeist(s, heistId, s.crews[0].id, now, 7, CONFIG, 'quiet');
    if (!r.ok) return;
    const a = r.state.activeHeists[0];
    const c = collectHeist(r.state, a.id, a.endsAt, forcedWin(), CONFIG);
    if (!c.ok) return;
    const rep = c.report!;
    const base = Math.round(rep.payout * CONFIG.rivalSpoilsFrac);
    expect(rep.rivalSpoils).toBe(Math.round(base * 1.2));
    expect(c.state.rivalWins[rivalId]).toBe(4);
    expect(rep.rivalDominated).toBeFalsy();
  });

  it('the win that reaches the threshold dominates the rival for a one-time bonus, once', () => {
    const { now, heistId, rivalId } = findContestWindow();
    const s: GameState = { ...bigCrewState(), rivalWins: { [rivalId]: CONFIG.rivalDominateAt - 1 } };
    const r = launchHeist(s, heistId, s.crews[0].id, now, 7, CONFIG, 'quiet');
    if (!r.ok) return;
    const a = r.state.activeHeists[0];
    const cashBefore = r.state.cash;
    const c = collectHeist(r.state, a.id, a.endsAt, forcedWin(), CONFIG);
    if (!c.ok) return;
    const rep = c.report!;
    expect(rep.rivalDominated).toBe(true);
    expect(rep.dominationBonus).toBe(Math.round(rep.payout * CONFIG.rivalDominateTakeMult));
    expect(isRivalDominated(c.state, rivalId)).toBe(true);
    // Cash gained = take + escalated spoils + the one-time domination bonus.
    expect(c.state.cash - cashBefore).toBe(rep.payout + (rep.rivalSpoils ?? 0) + (rep.dominationBonus ?? 0));

    // A later win does NOT re-trigger the domination bonus.
    const r2 = launchHeist(c.state, heistId, c.state.crews[0].id, now, 9, CONFIG, 'quiet');
    if (!r2.ok) return;
    const a2 = r2.state.activeHeists[0];
    const c2 = collectHeist(r2.state, a2.id, a2.endsAt, forcedWin(), CONFIG);
    if (!c2.ok) return;
    expect(c2.report!.rivalDominated).toBeFalsy();
    expect(c2.report!.dominationBonus).toBeUndefined();
  });

  it('per-rival standing + domination survive prestige and ascension', () => {
    const s: GameState = {
      ...bigCrewState(),
      notoriety: 200,
      rivalWins: { ivory_court: 4 },
      rivalsDominated: ['meridian'],
    };
    const p = prestige(s, 1000);
    if (!p.ok) return;
    expect(p.state.rivalWins.ivory_court).toBe(4);
    expect(p.state.rivalsDominated).toContain('meridian');
    const asc = ascend(s, 1000);
    if (!asc.ok) return;
    expect(asc.state.rivalWins.ivory_court).toBe(4);
    expect(asc.state.rivalsDominated).toContain('meridian');
  });
});
