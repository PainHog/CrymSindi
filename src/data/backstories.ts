// -----------------------------------------------------------------------------
// CREW BACKSTORIES (flavor)
// -----------------------------------------------------------------------------
// A one-line origin for each member, to make the crew feel like people you know
// rather than stat blocks. Purely cosmetic and DERIVED from the member id (a
// stable hash into this pool), so it needs no save state and never changes for a
// given member. Keep lines role-agnostic and short.
// -----------------------------------------------------------------------------

export const BACKSTORIES: string[] = [
  'Did a nickel upstate and came out sharper.',
  'Used to run with a rival crew — left on bad terms.',
  'Came up boosting cars in the Underline.',
  'Ex-military. The syndicate pays better.',
  'Owes a debt to the wrong people.',
  "Never been caught, and intends to keep it that way.",
  'In it for one last score — allegedly.',
  "Learned the trade from a parent who's still inside.",
  'Quiet, precise, and never explains the scar.',
  'Was a straight cop for six years. Not anymore.',
  'Fences on the side; knows everyone worth knowing.',
  'Talks too much, delivers every time.',
  'Trusts the crew — and barely them.',
  'Came up through the docks; fears nothing on water.',
  "Swears they're retiring after this one. Said it last year too.",
  'A ghost on the street: no record, no photo, no past.',
];

/** Stable index into the backstory pool from an arbitrary id string. */
function hashId(id: string): number {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** The (stable, cosmetic) backstory line for a member id. */
export function backstoryFor(id: string): string {
  if (BACKSTORIES.length === 0) return '';
  return BACKSTORIES[hashId(id) % BACKSTORIES.length];
}
