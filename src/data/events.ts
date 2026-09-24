// -----------------------------------------------------------------------------
// LIVING-MAP EVENTS
// -----------------------------------------------------------------------------
// A time-boxed condition on the city — a fence paying premium, a police
// crackdown, a blackout — that alters specific jobs while it runs. Data-only:
// the engine (engine/events.ts) reads these defs and, like featured jobs,
// derives the active event purely from the timestamp (no stored state). The
// effect a launched job gets is locked in at launch (Phase 2), so an event
// ending mid-job can't change that job's terms.
//
// An event's `effect` is applied through the same paths approaches/prep/featured
// already use: rewardMult scales the take, oddsDelta shifts every member's pass
// chance, heatMult scales the heat added at launch. Any subset may be set;
// omitted fields are neutral (1 / 0 / 1). `scope` says which catalog jobs are
// eligible (by tier or explicit id); the engine flags a seeded subset of them.
// -----------------------------------------------------------------------------

import type { HeistId } from './heists';

/** Opportunity = a good thing to chase (gold); pressure = a reason to lie low (magenta). */
export type EventKind = 'opportunity' | 'pressure';

export interface EventEffect {
  /** Scales the base take (>1 pays more, <1 less). */
  rewardMult?: number;
  /** Flat add to every member's pass chance (can be negative). */
  oddsDelta?: number;
  /** Scales the heat added at launch (>1 hotter, <1 cooler). */
  heatMult?: number;
}

export interface EventDef {
  id: string;
  name: string;
  /** One-line flavor for the ticker / dossier callout. */
  blurb: string;
  kind: EventKind;
  /** Which catalog jobs this event can flag. Give tiers or explicit ids. */
  scope: { tiers?: number[]; heistIds?: HeistId[] };
  effect: EventEffect;
  /** Relative selection weight (default 1). A rare jackpot sits below 1. */
  weight?: number;
}

export const EVENTS: EventDef[] = [
  {
    id: 'fence_in_town',
    name: 'Fence in town',
    blurb: 'A fence is paying premium tonight — the take is worth more.',
    kind: 'opportunity',
    scope: { tiers: [2, 3, 4, 5] }, // higher-value jobs are where a fence matters
    effect: { rewardMult: 1.4 },
  },
  {
    id: 'blackout',
    name: 'Grid blackout',
    blurb: "The grid's down — security is blind. Cleaner and cooler work.",
    kind: 'opportunity',
    scope: { tiers: [1, 2, 3, 4, 5] },
    effect: { oddsDelta: 0.1, heatMult: 0.6 },
  },
  {
    id: 'inside_job',
    name: 'Inside contact',
    blurb: 'Someone on the inside left a door open — better odds.',
    kind: 'opportunity',
    scope: { tiers: [2, 3, 4, 5] },
    effect: { oddsDelta: 0.12 },
  },
  {
    id: 'crackdown',
    name: 'Police crackdown',
    blurb: 'Patrols doubled — every job runs hotter and riskier here.',
    kind: 'pressure',
    scope: { tiers: [1, 2, 3, 4, 5] },
    effect: { heatMult: 1.6, oddsDelta: -0.08 },
  },
  {
    id: 'turf_war',
    name: 'Turf war',
    blurb: 'Rival crews have the block in chaos — more cash, more risk.',
    kind: 'pressure',
    scope: { tiers: [3, 4, 5] },
    effect: { rewardMult: 1.35, oddsDelta: -0.12 },
  },
  {
    id: 'hot_tip',
    name: 'Hot tip',
    blurb: 'Word on the street points to an easy mark — a little more, a little safer.',
    kind: 'opportunity',
    scope: { tiers: [1, 2, 3] },
    effect: { rewardMult: 1.2, oddsDelta: 0.06 },
  },
  {
    id: 'snitch',
    name: 'Snitch in the wind',
    blurb: 'Someone’s talking to the cops — jobs here are a coin-flip until it blows over.',
    kind: 'pressure',
    scope: { tiers: [2, 3, 4, 5] },
    effect: { oddsDelta: -0.16 },
  },
  {
    // The rare jackpot: a career score. Low weight, so it turns up only now and
    // then; when it does, it's the best cash on the board by far.
    id: 'the_whale',
    name: 'The Whale',
    blurb: 'A once-in-a-season score just surfaced — this is the big one.',
    kind: 'opportunity',
    scope: { tiers: [3, 4, 5] },
    effect: { rewardMult: 2.0 },
    weight: 0.35,
  },
];

/** A jackpot event is a rare opportunity paying a headline take (>= 2x). */
export function isJackpotEvent(def: EventDef): boolean {
  return def.kind === 'opportunity' && (def.effect.rewardMult ?? 1) >= 2;
}

export const EVENTS_BY_ID: Record<string, EventDef> = Object.fromEntries(
  EVENTS.map((e) => [e.id, e]),
);
