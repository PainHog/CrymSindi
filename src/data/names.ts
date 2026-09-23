// -----------------------------------------------------------------------------
// NAME POOL (original, generic names for recruited crew members)
// -----------------------------------------------------------------------------
// Names are drawn deterministically by index (so recruiting stays pure and
// testable) from a first-name x last-name grid — hundreds of combinations — and
// the recruiter skips any name already on the roster, so repeats don't show up
// in normal play. Consecutive indices vary the first name, so a run of recruits
// reads as distinct people.
// -----------------------------------------------------------------------------

export const FIRST_NAMES: string[] = [
  'Vic', 'Dana', 'Rey', 'Sal', 'Nina', 'Cole', 'Mara', 'Theo',
  'Isla', 'Gray', 'Lena', 'Otis', 'Priya', 'Rocco', 'Sadie', 'Emil',
  'Nadia', 'Cyrus', 'Wren', 'Dex', 'Frankie', 'Zoe', 'Marlon', 'Odessa',
];

export const LAST_NAMES: string[] = [
  'Marlow', 'Cross', 'Okafor', 'Petrov', 'Vale', 'Devlin', 'Quinn', 'Banks',
  'Roth', 'Mercer', 'Vasquez', 'Kane', 'Nair', 'Bello', 'Lang', 'Novak',
  'Sloane', 'Ferro', 'Ashby', 'Calder', 'Reyes', 'Kwan', 'Dolan', 'Vance',
];

/** Total distinct names the grid can produce. */
export const NAME_POOL_SIZE = FIRST_NAMES.length * LAST_NAMES.length;

/**
 * Deterministic name for an index. Uses a sheared (Latin-square) walk of the
 * first x last grid, so consecutive indices change BOTH names and every one of
 * the FIRST x LAST combinations is produced once before any repeats.
 */
export function nameForIndex(index: number): string {
  const f = FIRST_NAMES.length;
  const l = LAST_NAMES.length;
  const row = Math.floor(index / f);
  const col = index % f;
  const first = FIRST_NAMES[col];
  const last = LAST_NAMES[(row + col) % l];
  return `${first} ${last}`;
}

/** Back-compat: a name for an index, no de-duplication. */
export function pickName(index: number): string {
  return nameForIndex(index);
}

/**
 * A name for `index` that isn't already used by a current member. Walks forward
 * through the grid until it finds an unused name; only repeats once every one of
 * the hundreds of combinations is taken.
 */
export function pickUniqueName(index: number, taken: readonly string[]): string {
  const used = new Set(taken);
  for (let i = 0; i < NAME_POOL_SIZE; i++) {
    const name = nameForIndex(index + i);
    if (!used.has(name)) return name;
  }
  return nameForIndex(index);
}
