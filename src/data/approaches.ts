// -----------------------------------------------------------------------------
// MISSION APPROACHES
// -----------------------------------------------------------------------------
// How a crew plays a job. A pre-launch choice that trades reward vs. heat vs.
// time vs. odds — pure multipliers/deltas applied by the engine at launch
// (heat + duration) and at resolve (payout + per-member odds). Data-only; the
// engine reads the modifiers, so balance lives here.
// -----------------------------------------------------------------------------

export type ApproachId = 'quiet' | 'loud' | 'ghost';

export interface ApproachDef {
  id: ApproachId;
  name: string;
  description: string;
  /** Scales the base take. */
  rewardMult: number;
  /** Scales the heat added at launch. */
  heatMult: number;
  /** Scales the job duration. */
  timeMult: number;
  /** Flat add to every member's pass chance (can be negative). */
  oddsDelta: number;
}

export const APPROACHES: ApproachDef[] = [
  {
    id: 'quiet',
    name: 'Quiet',
    description: 'Play it straight — no surprises.',
    rewardMult: 1,
    heatMult: 1,
    timeMult: 1,
    oddsDelta: 0,
  },
  {
    id: 'loud',
    name: 'Loud',
    description: 'Smash & grab — more cash and speed, more Heat, riskier.',
    rewardMult: 1.4,
    heatMult: 1.5,
    // 0.85, not a steeper 0.8: the speed bonus is what lets Loud out-earn Quiet
    // even on long endgame jobs where its Heat cost has fully cooled by collect,
    // so it stays the aggressive pick without being a strict no-brainer at scale.
    timeMult: 0.85,
    oddsDelta: -0.1,
  },
  {
    id: 'ghost',
    name: 'Ghost',
    description: 'Slow and silent — safer and cooler, a smaller cut.',
    rewardMult: 0.8,
    heatMult: 0.6,
    timeMult: 1.25,
    oddsDelta: 0.06,
  },
];

export const APPROACHES_BY_ID: Record<ApproachId, ApproachDef> = Object.fromEntries(
  APPROACHES.map((a) => [a.id, a]),
) as Record<ApproachId, ApproachDef>;

export const DEFAULT_APPROACH: ApproachId = 'quiet';

/** Resolve an approach id (or undefined, for old saves) to its definition. */
export function approachFor(id: ApproachId | undefined): ApproachDef {
  return (id && APPROACHES_BY_ID[id]) || APPROACHES_BY_ID[DEFAULT_APPROACH];
}
