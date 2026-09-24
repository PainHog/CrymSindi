import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import { EVENTS } from '../data/events';
import { HEISTS, HEISTS_BY_ID } from '../data/heists';
import {
  eventEffectFor,
  eventForHeist,
  eventForWindow,
  eventNow,
  eventWindowIndex,
  msUntilNextEvent,
} from './events';

const PERIOD = CONFIG.eventWindowSec * 1000;
/** A timestamp 1s into the given window. */
const at = (index: number) => index * PERIOD + 1000;

/** First window index in [0, limit) for which the predicate holds. */
function findWindow(pred: (i: number) => boolean, limit = 200): number {
  for (let i = 0; i < limit; i++) if (pred(i)) return i;
  throw new Error('no matching window found in range');
}

describe('living-map events', () => {
  it('eventForWindow is deterministic and pure', () => {
    for (const i of [0, 1, 7, 42, 199]) {
      expect(eventForWindow(i)).toEqual(eventForWindow(i));
    }
  });

  it('an active window flags a valid, in-scope, bounded set of jobs', () => {
    const i = findWindow((n) => eventForWindow(n) !== null);
    const ev = eventForWindow(i);
    expect(ev).not.toBeNull();
    if (!ev) return;
    expect(EVENTS.some((e) => e.id === ev.def.id)).toBe(true);
    expect(ev.heistIds.length).toBeGreaterThan(0);
    expect(ev.heistIds.length).toBeLessThanOrEqual(CONFIG.eventTargetsMax);
    // No duplicates.
    expect(new Set(ev.heistIds).size).toBe(ev.heistIds.length);
    for (const id of ev.heistIds) {
      const h = HEISTS_BY_ID[id];
      expect(h).toBeDefined();
      // Each flagged job is within the event's declared scope.
      const inScope = ev.def.scope.heistIds
        ? ev.def.scope.heistIds.includes(id)
        : (ev.def.scope.tiers ?? []).includes(h.tier);
      expect(inScope).toBe(true);
    }
  });

  it('some windows are quiet and some run an event (eventChance gate)', () => {
    let active = 0;
    let quiet = 0;
    for (let i = 0; i < 120; i++) {
      if (eventForWindow(i)) active++;
      else quiet++;
    }
    expect(active).toBeGreaterThan(0);
    expect(quiet).toBeGreaterThan(0);
  });

  it('eventChance clamps behave: 0 => always quiet, 1 => never quiet', () => {
    const never = { ...CONFIG, eventChance: 0 };
    const always = { ...CONFIG, eventChance: 1 };
    for (let i = 0; i < 40; i++) {
      expect(eventForWindow(i, never)).toBeNull();
      expect(eventForWindow(i, always)).not.toBeNull();
    }
  });

  it('eventNow matches the window for the current timestamp', () => {
    const i = findWindow((n) => eventForWindow(n) !== null);
    expect(eventWindowIndex(at(i))).toBe(i);
    expect(eventNow(at(i))).toEqual(eventForWindow(i));
  });

  it('msUntilNextEvent is within (0, period]', () => {
    expect(msUntilNextEvent(0)).toBe(PERIOD);
    expect(msUntilNextEvent(PERIOD * 3 + 500)).toBe(PERIOD - 500);
  });

  it('eventEffectFor returns the flagged effect and neutral otherwise', () => {
    const i = findWindow((n) => eventForWindow(n) !== null);
    const ev = eventForWindow(i)!;
    const now = at(i);
    const flagged = ev.heistIds[0];

    const eff = eventEffectFor(flagged, now);
    expect(eff.rewardMult).toBe(ev.def.effect.rewardMult ?? 1);
    expect(eff.oddsDelta).toBe(ev.def.effect.oddsDelta ?? 0);
    expect(eff.heatMult).toBe(ev.def.effect.heatMult ?? 1);
    expect(eventForHeist(flagged, now)?.def.id).toBe(ev.def.id);

    // A job the event did not flag gets the neutral effect and no badge.
    const unflagged = HEISTS.map((h) => h.id).find((id) => !ev.heistIds.includes(id));
    expect(unflagged).toBeDefined();
    if (unflagged) {
      expect(eventEffectFor(unflagged, now)).toEqual({ rewardMult: 1, oddsDelta: 0, heatMult: 1 });
      expect(eventForHeist(unflagged, now)).toBeNull();
    }
  });

  it('a quiet window applies neutral effects to every job', () => {
    const i = findWindow((n) => eventForWindow(n) === null);
    const now = at(i);
    expect(eventNow(now)).toBeNull();
    for (const h of HEISTS) {
      expect(eventEffectFor(h.id, now)).toEqual({ rewardMult: 1, oddsDelta: 0, heatMult: 1 });
      expect(eventForHeist(h.id, now)).toBeNull();
    }
  });

  it('different windows generally differ (event + targets vary)', () => {
    const sig = (i: number) => {
      const ev = eventForWindow(i);
      return ev ? `${ev.def.id}:${ev.heistIds.join(',')}` : 'quiet';
    };
    const distinct = new Set([sig(0), sig(1), sig(2), sig(3), sig(4), sig(5), sig(6), sig(7)]);
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('weighted selection: the rare jackpot appears, but far less than a common event', () => {
    const counts: Record<string, number> = {};
    let active = 0;
    for (let i = 0; i < 6000; i++) {
      const ev = eventForWindow(i);
      if (!ev) continue;
      active++;
      counts[ev.def.id] = (counts[ev.def.id] ?? 0) + 1;
    }
    // Every catalog event is still selectable.
    for (const e of EVENTS) expect(counts[e.id] ?? 0).toBeGreaterThan(0);
    // The whale (weight 0.35) is meaningfully rarer than a common event (weight 1).
    const whale = counts['the_whale'] ?? 0;
    const fence = counts['fence_in_town'] ?? 0;
    expect(whale).toBeLessThan(fence * 0.6);
    // Roughly its share of total weight (~0.35 / sum) — sanity, not exact.
    expect(whale / active).toBeLessThan(0.12);
  });
});
