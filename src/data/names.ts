// -----------------------------------------------------------------------------
// NAME POOL (original, generic names for recruited crew members)
// -----------------------------------------------------------------------------
// Picked deterministically by index so recruiting stays pure/testable.
// -----------------------------------------------------------------------------

export const MEMBER_NAMES: string[] = [
  'Vic Marlow',
  'Dana Cross',
  'Rey Okafor',
  'Sal Petrov',
  'Nina Vale',
  'Cole Devlin',
  'Mara Quinn',
  'Theo Banks',
  'Isla Roth',
  'Gray Mercer',
  'Lena Vasquez',
  'Otis Kane',
  'Priya Nair',
  'Rocco Bello',
  'Sadie Lang',
  'Emil Novak',
];

export function pickName(index: number): string {
  return MEMBER_NAMES[index % MEMBER_NAMES.length];
}
