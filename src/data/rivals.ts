// -----------------------------------------------------------------------------
// RIVAL SYNDICATES (flavor for the turf-contest layer)
// -----------------------------------------------------------------------------
// The rival crews that periodically stake a claim on a job. Which one contests a
// given window is a pure function of the window index (see engine/rivals.ts), so
// this is just names/tags — no behavior lives here. Keep the list non-empty.
// -----------------------------------------------------------------------------

export interface RivalDef {
  id: string;
  /** Display name of the rival crew. */
  name: string;
  /** A one-word turf/style tag, for flavor in the callout. */
  tag: string;
}

export const RIVALS: RivalDef[] = [
  { id: 'ivory_court', name: 'The Ivory Court', tag: 'old money' },
  { id: 'meridian', name: 'Meridian Cartel', tag: 'imports' },
  { id: 'ashfall', name: 'Ashfall Crew', tag: 'arson-for-hire' },
  { id: 'the_gild', name: 'The Gild', tag: 'fences' },
  { id: 'nine_ravens', name: 'Nine Ravens', tag: 'ghosts' },
];

export const RIVALS_BY_ID: Record<string, RivalDef> = Object.fromEntries(
  RIVALS.map((r) => [r.id, r]),
);
