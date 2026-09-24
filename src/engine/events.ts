// -----------------------------------------------------------------------------
// LIVING-MAP EVENTS (time-boxed conditions layered on the city)
// -----------------------------------------------------------------------------
// At most one event runs per window; whether a window runs one and which jobs it
// flags are a PURE function of the window index (derived from the timestamp), so
// it's identical on every client, fully testable, and needs no stored state -
// exactly the featured-jobs pattern (see featured.ts). A separate seed constant
// keeps the event stream from correlating with the featured stream.
//
// The effect a launched job actually gets is locked in at launch (Phase 2, via
// ActiveHeist), so an event ending mid-job can't change that job's terms. This
// module is read-only: it tells the UI what's live now and tells launch/resolve
// what modifiers a job would take right now.
// -----------------------------------------------------------------------------

import { CONFIG } from '../data/config';
import type { Config } from '../data/config';
import { EVENTS } from '../data/events';
import type { EventDef } from '../data/events';
import { HEISTS } from '../data/heists';
import type { HeistId } from '../data/heists';
import { makeRng } from './resolution';

/** An event running in a given window, with the specific jobs it flags. */
export interface ActiveEvent {
  def: EventDef;
  heistIds: HeistId[];
}

/** An event's effect resolved to concrete numbers (neutral when nothing applies). */
export interface EventEffect {
  rewardMult: number;
  oddsDelta: number;
  heatMult: number;
}

const NEUTRAL: EventEffect = { rewardMult: 1, oddsDelta: 0, heatMult: 1 };

/** The event-window index for a timestamp (which window we're in). */
export function eventWindowIndex(now: number, config: Config = CONFIG): number {
  return Math.floor(now / (config.eventWindowSec * 1000));
}

/** Ms until the current event window flips (for a countdown). */
export function msUntilNextEvent(now: number, config: Config = CONFIG): number {
  const period = config.eventWindowSec * 1000;
  return period - (now % period);
}

/** Catalog jobs eligible for an event's scope (by explicit id, else by tier). */
function scopeCandidates(def: EventDef): HeistId[] {
  if (def.scope.heistIds && def.scope.heistIds.length > 0) {
    const known = new Set(HEISTS.map((h) => h.id));
    return def.scope.heistIds.filter((id) => known.has(id));
  }
  const tiers = new Set(def.scope.tiers ?? []);
  return HEISTS.filter((h) => tiers.has(h.tier)).map((h) => h.id);
}

/**
 * The event for a given window index, or null for a quiet window. Deterministic
 * and pure: the same index always yields the same event and flagged jobs.
 */
/** Deterministic weighted pick from the event catalog (one rng draw, so it
 *  doesn't shift the downstream Fisher-Yates stream). */
function pickEvent(r: number): EventDef {
  const total = EVENTS.reduce((a, d) => a + (d.weight ?? 1), 0);
  let x = r * total;
  for (const d of EVENTS) {
    x -= d.weight ?? 1;
    if (x < 0) return d;
  }
  return EVENTS[EVENTS.length - 1];
}

export function eventForWindow(index: number, config: Config = CONFIG): ActiveEvent | null {
  const rnd = makeRng((index * 0x85ebca77) >>> 0);
  // Some windows are quiet - roll that first so the stream stays stable.
  if (rnd() >= config.eventChance) return null;
  if (EVENTS.length === 0) return null;

  const def = pickEvent(rnd());
  const candidates = scopeCandidates(def);
  if (candidates.length === 0) return null;

  // Fisher-Yates with the seeded rng (deterministic across engines).
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const n = Math.min(config.eventTargetsMax, candidates.length);
  return { def, heistIds: candidates.slice(0, n) };
}

/** The event running right now (or null). */
export function eventNow(now: number, config: Config = CONFIG): ActiveEvent | null {
  return eventForWindow(eventWindowIndex(now, config), config);
}

/** The active event flagging a given heist right now (or null) - for UI badges. */
export function eventForHeist(
  heistId: string,
  now: number,
  config: Config = CONFIG,
): ActiveEvent | null {
  const ev = eventNow(now, config);
  return ev && ev.heistIds.includes(heistId) ? ev : null;
}

/**
 * The effect a heist would take if launched now (neutral when no event flags it).
 * Launch/resolve combine this with the approach/prep/featured modifiers.
 */
export function eventEffectFor(heistId: string, now: number, config: Config = CONFIG): EventEffect {
  const ev = eventForHeist(heistId, now, config);
  if (!ev) return NEUTRAL;
  const e = ev.def.effect;
  return {
    rewardMult: e.rewardMult ?? 1,
    oddsDelta: e.oddsDelta ?? 0,
    heatMult: e.heatMult ?? 1,
  };
}
