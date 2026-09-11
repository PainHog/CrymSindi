// -----------------------------------------------------------------------------
// MEMBER TRAITS
// -----------------------------------------------------------------------------
// Each crew member carries at most one trait — a flat modifier to their
// effective skill that gives them identity and makes recruiting a bit of a
// gamble (a Prodigy is worth far more than a Rookie). Traits are assigned
// deterministically from the member's numeric id (pure/testable), so recruits
// vary without any RNG in the engine.
// -----------------------------------------------------------------------------

export type TraitId = string;

export interface TraitDef {
  id: TraitId;
  name: string;
  description: string;
  /** Flat effective-skill modifier. */
  skillBonus: number;
}

export const TRAITS: TraitDef[] = [
  { id: 'rookie', name: 'Rookie', description: 'Still learning the ropes.', skillBonus: 0 },
  { id: 'steady', name: 'Steady', description: 'Reliable when it counts.', skillBonus: 1 },
  { id: 'ghost', name: 'Ghost', description: 'Never leaves a trace.', skillBonus: 1 },
  { id: 'veteran', name: 'Veteran', description: 'Years in the game.', skillBonus: 2 },
  { id: 'brawler', name: 'Brawler', description: 'Thrives when it gets physical.', skillBonus: 2 },
  { id: 'prodigy', name: 'Prodigy', description: 'A natural — rare talent.', skillBonus: 3 },
];

export const TRAITS_BY_ID: Record<TraitId, TraitDef> = Object.fromEntries(
  TRAITS.map((t) => [t.id, t]),
);

/** Deterministic trait for a member's numeric id (varied, pure — no RNG). */
export function traitForId(numericId: number): TraitId {
  // A cheap integer hash so consecutive recruits don't just cycle in order.
  const h = (Math.abs(Math.trunc(numericId)) * 2654435761) >>> 0;
  return TRAITS[h % TRAITS.length].id;
}
