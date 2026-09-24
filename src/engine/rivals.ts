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

/** Cash spoils for seizing a contested job whose take was `payout`. */
export function rivalSpoilsFor(payout: number, config: Config = CONFIG): number {
  return Math.max(0, Math.round(payout * config.rivalSpoilsFrac));
}
