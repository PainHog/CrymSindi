// -----------------------------------------------------------------------------
// MAP LAYOUT
// -----------------------------------------------------------------------------
// Fixed landmark footprints and district labels for the noir city map. Heist
// pins are planted ON these landmarks (by index), so the board reads as places
// in a city rather than rows in a list. Pure data — no engine coupling.
// -----------------------------------------------------------------------------

export type LandmarkKind = 'spire' | 'tower' | 'twin' | 'block' | 'dome' | 'bunker';

/** [xPct, yPct, kind] — a known building the city always draws. */
export type Slot = readonly [number, number, LandmarkKind];

export const SLOTS: Slot[] = [
  [18, 20, 'spire'],
  [31, 14, 'tower'],
  [46, 22, 'twin'],
  [62, 16, 'block'],
  [79, 24, 'tower'],
  [87, 42, 'block'],
  [72, 36, 'dome'],
  [57, 38, 'bunker'],
  [40, 36, 'tower'],
  [24, 40, 'block'],
  [14, 58, 'tower'],
  [30, 72, 'dome'],
  [50, 80, 'twin'],
  [69, 73, 'spire'],
  [83, 68, 'bunker'],
  [45, 56, 'block'],
  // Room to grow (slots 16+): filled in the empty gaps so the board can hold
  // more heists as content is added, without pins overlapping.
  [8, 34, 'block'],
  [92, 30, 'tower'],
  [66, 52, 'spire'],
  [37, 62, 'twin'],
  [58, 66, 'block'],
  [78, 55, 'dome'],
  [18, 48, 'bunker'],
  [92, 58, 'tower'],
];

/** [name, xPct, yPct] district labels drawn under the pins. */
export const DISTRICTS: ReadonlyArray<readonly [string, number, number]> = [
  ['Sable Heights', 30, 10],
  ['Little Kowloon', 83, 15],
  ['Grid Center', 63, 47],
  ['Dockside', 12, 66],
  ['Underline', 50, 60],
  ['The Mirage Mile', 80, 63],
  ['Old Quarter', 40, 86],
];

/** HQ marker position (percent of the stage). */
export const HQ = { x: 50, y: 47 } as const;

/** Risk band from a heist tier, used to color its pin. */
export function tierRisk(tier: number): 'lo' | 'med' | 'hi' {
  if (tier <= 1) return 'lo';
  if (tier <= 3) return 'med';
  return 'hi';
}
