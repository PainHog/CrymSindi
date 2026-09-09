// -----------------------------------------------------------------------------
// ROLES
// -----------------------------------------------------------------------------
// The kinds of specialists a crew can hold. Heists require certain roles to be
// present in the assigned crew. Add a role by appending to ROLES.
// -----------------------------------------------------------------------------

export type RoleId = string;

export interface RoleDef {
  id: RoleId;
  name: string;
  description: string;
  /** Base skill a freshly recruited member of this role starts with. */
  baseSkill: number;
  /** Base cash cost to recruit this role (scaled up by current crew size). */
  recruitCost: number;
}

export const ROLES: RoleDef[] = [
  {
    id: 'driver',
    name: 'Driver',
    description: 'Wheelman. Keeps the getaway fast and clean.',
    baseSkill: 3,
    recruitCost: 120,
  },
  {
    id: 'hacker',
    name: 'Hacker',
    description: 'Cracks alarms, cameras, and digital locks.',
    baseSkill: 3,
    recruitCost: 160,
  },
  {
    id: 'muscle',
    name: 'Muscle',
    description: 'Handles heavy doors and heavier problems.',
    baseSkill: 3,
    recruitCost: 150,
  },
  {
    id: 'lookout',
    name: 'Lookout',
    description: 'Eyes on the street. Buys the crew time.',
    baseSkill: 3,
    recruitCost: 130,
  },
];

export const ROLES_BY_ID: Record<RoleId, RoleDef> = Object.fromEntries(
  ROLES.map((r) => [r.id, r]),
);
