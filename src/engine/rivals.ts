// -----------------------------------------------------------------------------
// RIVAL SYNDICATE (turf contests layered on the city)
// -----------------------------------------------------------------------------
// A rival crew stakes a claim on ONE catalog job per contest window. Whether a
// window runs a contest, which rival, and which job are a PURE function of the
// window index (derived from the timestamp) — identical on every client, fully
// testable, no stored state. Exactly the events/featured pattern, on its own
// clock and seed so the three streams don't correlate.
//
// Seizing the turf (completing the contested job before the window closes) is
// rewarded at collect with cash spoils + a turf-win tally; the "contested at
// launch" flag is snapshotted onto the ActiveHeist (Phase 2), so a window
// flipping mid-job can't retroactively grant or revoke the reward. This module
// is read-only: it says what's contested now and how big the spoils would be.
// -----------------------------------------------------------------------------

import { CONFIG } from '../data/config';
import type { Config } from '../data/config';
import { HEISTS } from '../data/heists';
import type { HeistId } from '../data/heists';
import { RIVALS } from '../data/rivals';
import type { RivalDef } from '../data/rivals';
import { makeRng } from './resolution';
import type { GameState } from './types';

/** A rival crew contesting a specific job in a given window. */
export interface RivalContest {
  rival: RivalDef;
  heistId: HeistId;
  /** The window index this contest belongs to (handy as a stable React key). */
  index: number;
}

/** The contest-window index for a timestamp (which window we're in). */
export function rivalWindowIndex(now: number, config: Config = CONFIG): number {
  return Math.floor(now / (config.rivalWindowSec * 1000));
}

/** Ms until the current contest window flips (for a countdown). */
export function msUntilNextRival(now: number, config: Config = CONFIG): number {
  const period = config.rivalWindowSec * 1000;
  return period - (now % period);
}

/**
 * The contest for a given window index, or null for a quiet window. Deterministic
 * and pure: the same index always yields the same rival + target.
 */
export function rivalForWindow(index: number, config: Config = CONFIG): RivalContest | null {
  const rnd = makeRng((index * 0xc2b2ae35) >>> 0);
  // Roll quiet-vs-active first so the stream stays stable as other knobs change.
  if (rnd() >= config.rivalChance) return null;
  if (RIVALS.length === 0 || HEISTS.length === 0) return null;
  const rival = RIVALS[Math.floor(rnd() * RIVALS.length)];
  const heist = HEISTS[Math.floor(rnd() * HEISTS.length)];
  return { rival, heistId: heist.id, index };
}

/** The contest running right now (or null). */
export function rivalNow(now: number, config: Config = CONFIG): RivalContest | null {
  return rivalForWindow(rivalWindowIndex(now, config), config);
}

/** The contest on a given heist right now (or null) — for the pin/dossier callout. */
export function rivalContestFor(
  heistId: string,
  now: number,
  config: Config = CONFIG,
): RivalContest | null {
  const c = rivalNow(now, config);
  return c && c.heistId === heistId ? c : null;
}

/** Whether a rival is contesting this heist right now. */
export function rivalContestsHeist(heistId: string, now: number, config: Config = CONFIG): boolean {
  return rivalContestFor(heistId, now, config) != null;
}

/** Base cash spoils for seizing a contested job whose take was `payout` (before
 *  the per-rival escalation multiplier). */
export function rivalSpoilsFor(payout: number, config: Config = CONFIG): number {
  return Math.max(0, Math.round(payout * config.rivalSpoilsFrac));
}

// ---- Persistent rivalries --------------------------------------------------
// Each rival remembers how many times you've beaten them. Wins raise a "rivalry
// level", and a higher level means bigger spoils when that rival comes back —
// so a specific nemesis is worth hunting. Contest *selection* stays stateless;
// only the reward magnitude reads this stored standing.

/** How many times you've seized a contested job from this rival. */
export function rivalWinCount(state: GameState, rivalId: string): number {
  return state.rivalWins?.[rivalId] ?? 0;
}

/** The rivalry level with a rival — one level per `rivalWinsPerLevel` wins. */
export function rivalryLevel(state: GameState, rivalId: string, config: Config = CONFIG): number {
  return Math.floor(rivalWinCount(state, rivalId) / config.rivalWinsPerLevel);
}

/** The spoils multiplier from the rivalry (1 at level 0, capped as it escalates). */
export function rivalStakeMult(state: GameState, rivalId: string, config: Config = CONFIG): number {
  const bonus = Math.min(rivalryLevel(state, rivalId, config) * config.rivalEscalationStep, config.rivalEscalationMax);
  return 1 + bonus;
}

/** Spoils for a contested job of this take, escalated by the rivalry standing. */
export function rivalSpoilsWithStanding(
  state: GameState,
  rivalId: string,
  payout: number,
  config: Config = CONFIG,
): number {
  return Math.max(0, Math.round(rivalSpoilsFor(payout, config) * rivalStakeMult(state, rivalId, config)));
}

/** Whether you've run this rival out of town (dominated them). */
export function isRivalDominated(state: GameState, rivalId: string): boolean {
  return (state.rivalsDominated ?? []).includes(rivalId);
}
