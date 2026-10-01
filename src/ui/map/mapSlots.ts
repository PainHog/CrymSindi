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

// The city is laid out on ONE lattice shared by the street grid, the filler
// blocks and the landmarks (see CityCanvas), so every building sits centred in
// its own block instead of floating across the grid lines. Buildings live in a
// staggered brick pattern (rows of 3 and 4) across the inner columns, which
// reads as a real street plan and keeps edge columns clear of clipping.
export const GRID_COLS = 12;
export const GRID_ROWS = 9;

/** Percent-of-stage centre of a lattice cell. */
export function cellCenter(col: number, row: number): readonly [number, number] {
  return [((col + 0.5) / GRID_COLS) * 100, ((row + 0.5) / GRID_ROWS) * 100];
}

// [col, row, kind] — landmark cells on the shared lattice, in BOARD ORDER. Pins
// fill these in sequence as heists unlock, so the list is sequenced to scatter
// the early pins across the map (corners, then centre, then fill) rather than
// run along one edge. Buildings live in rows 1..7, leaving the top/bottom rows
// as margin so pins clear the event banners and the crew panel.
const CELLS: ReadonlyArray<readonly [number, number, LandmarkKind]> = [
  [2, 1, 'tower'], [8, 1, 'block'], [1, 6, 'tower'], [10, 6, 'dome'],
  [5, 5, 'block'], [7, 2, 'spire'], [3, 3, 'twin'], [6, 7, 'bunker'],
  [10, 2, 'tower'], [1, 4, 'block'], [5, 1, 'dome'], [9, 7, 'block'],
  [3, 7, 'twin'], [7, 4, 'spire'], [1, 2, 'tower'], [8, 5, 'bunker'],
  [4, 6, 'block'], [10, 4, 'dome'], [2, 5, 'tower'], [6, 3, 'spire'],
  [4, 2, 'twin'], [9, 3, 'block'], [7, 6, 'bunker'], [4, 4, 'tower'],
];

/** Landmark footprints, planted on the lattice. Heist pins sit on these by
 *  index (MapView), so a pin always lands centred on its building. */
export const SLOTS: Slot[] = CELLS.map(([c, r, kind]) => {
  const [x, y] = cellCenter(c, r);
  return [x, y, kind] as const;
});

/** [name, xPct, yPct] district labels drawn under the pins. */
// District labels sit on empty cells (the "streets" between landmarks) so they
// stay legible over the new block layout.
export const DISTRICTS: ReadonlyArray<readonly [string, number, number]> = [
  ['Sable Heights', 29.2, 11.1],
  ['Little Kowloon', 79.2, 11.1],
  ['Grid Center', 50, 44.4],
  ['Dockside', 20.8, 66.7],
  ['Underline', 50, 55.6],
  ['The Mirage Mile', 79.2, 66.7],
  ['Old Quarter', 45.8, 88.9],
];

/** HQ marker position (percent of the stage). */
export const HQ = { x: 50, y: 47 } as const;

/** Risk band from a heist tier, used to color its pin. */
export function tierRisk(tier: number): 'lo' | 'med' | 'hi' {
  if (tier <= 1) return 'lo';
  if (tier <= 3) return 'med';
  return 'hi';
}
