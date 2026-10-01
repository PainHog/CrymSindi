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
  /** A short signature line, in the rival's voice, shown when they contest a job. */
  taunt: string;
}

export const RIVALS: RivalDef[] = [
  { id: 'ivory_court', name: 'The Ivory Court', tag: 'old money', taunt: 'This block was ours before you had a name.' },
  { id: 'meridian', name: 'Meridian Cartel', tag: 'imports', taunt: 'Everything that moves through this port moves for us.' },
  { id: 'ashfall', name: 'Ashfall Crew', tag: 'arson-for-hire', taunt: 'Walk away now and the building stays standing.' },
  { id: 'the_gild', name: 'The Gild', tag: 'fences', taunt: "Whatever you lift, you'll still have to sell it to us." },
  { id: 'nine_ravens', name: 'Nine Ravens', tag: 'ghosts', taunt: "You won't see us take it. You never do." },
  { id: 'saltwater', name: 'The Saltwater Kings', tag: 'dockside', taunt: 'The water remembers everyone who crossed us.' },
  { id: 'hollow_men', name: 'The Hollow Men', tag: 'enforcers', taunt: 'We break what we came for. Including hands.' },
  { id: 'violet_hour', name: 'Violet Hour', tag: 'grifters', taunt: "By the time you notice, it's already gone." },
  { id: 'red_lantern', name: 'The Red Lantern', tag: 'smugglers', taunt: 'We had this route mapped while you were still lost.' },
  { id: 'obsidian_row', name: 'Obsidian Row', tag: 'launderers', taunt: 'Your cut is dirty. Ours is already clean.' },
  { id: 'brass_union', name: 'The Brass Union', tag: 'racketeers', taunt: 'Nobody works this corner without paying the Union.' },
  { id: 'pale_syndicate', name: 'The Pale Syndicate', tag: 'blackmail', taunt: 'We know a name you want kept quiet. Step aside.' },
];

export const RIVALS_BY_ID: Record<string, RivalDef> = Object.fromEntries(
  RIVALS.map((r) => [r.id, r]),
);
