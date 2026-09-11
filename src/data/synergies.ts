// -----------------------------------------------------------------------------
// CREW SYNERGIES
// -----------------------------------------------------------------------------
// Crew-composition bonuses: a flat effective-skill boost to EVERY member when
// the crew's makeup qualifies. This turns crew-building into a real decision
// (diverse roles vs. stacking muscle) rather than just filling slots. Evaluated
// from role counts at resolution and preview time.
// -----------------------------------------------------------------------------

import type { RoleId } from './roles';

export interface SynergyDef {
  id: string;
  name: string;
  description: string;
  /** Flat effective-skill added to each member when active. */
  power: number;
  /** Active when this returns true for the crew's role counts. */
  test: (roleCounts: Record<RoleId, number>, size: number) => boolean;
}

export const SYNERGIES: SynergyDef[] = [
  {
    id: 'tight_unit',
    name: 'Tight Unit',
    description: 'Every member a different role — no toes stepped on. +1 power each.',
    power: 1,
    test: (counts, size) => size >= 3 && Object.values(counts).every((n) => n <= 1),
  },
  {
    id: 'full_deck',
    name: 'Full Deck',
    description: 'Driver, hacker, muscle and lookout all present. +2 power each.',
    power: 2,
    test: (counts) => !!counts.driver && !!counts.hacker && !!counts.muscle && !!counts.lookout,
  },
  {
    id: 'heavy_hitters',
    name: 'Heavy Hitters',
    description: 'Two or more muscle — doors are not a problem. +1 power each.',
    power: 1,
    test: (counts) => (counts.muscle ?? 0) >= 2,
  },
];

/** Count members per role. */
function roleCounts(roles: RoleId[]): Record<RoleId, number> {
  const counts: Record<RoleId, number> = {};
  for (const r of roles) counts[r] = (counts[r] ?? 0) + 1;
  return counts;
}

/** The synergies active for a crew of these roles. */
export function activeSynergies(roles: RoleId[]): SynergyDef[] {
  if (roles.length === 0) return [];
  const counts = roleCounts(roles);
  return SYNERGIES.filter((s) => s.test(counts, roles.length));
}

/** Total flat effective-skill bonus every member gets from active synergies. */
export function synergyPower(roles: RoleId[]): number {
  return activeSynergies(roles).reduce((sum, s) => sum + s.power, 0);
}
