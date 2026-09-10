// -----------------------------------------------------------------------------
// GEAR / TOOLS
// -----------------------------------------------------------------------------
// Gear is bought for an individual crew member and permanently boosts their
// effective skill. Each piece is either UNIVERSAL (no `role` — any member can
// use it) or ROLE-LOCKED (only a member of that role can buy/equip it). A
// laptop belongs to a hacker, not the muscle. Each role has a two-tier line: a
// cheap basic piece and a pricier advanced one. A member can own each piece once.
// -----------------------------------------------------------------------------

import type { RoleId } from './roles';

export type GearId = string;

export interface GearDef {
  id: GearId;
  name: string;
  description: string;
  /** Flat effective-skill added to the member who owns it. */
  skillBonus: number;
  /**
   * Role this gear is locked to. Only a member of this role can buy/equip it.
   * Undefined = universal: any member can use it.
   */
  role?: RoleId;
  cost: number;
}

export const GEAR: GearDef[] = [
  // ---- Universal — any role ------------------------------------------------
  {
    id: 'lockpicks',
    name: 'Lockpick Set',
    description: 'Old reliable. A small edge for anyone on the job.',
    skillBonus: 2,
    cost: 200,
  },
  {
    id: 'disguise',
    name: 'Disguise Kit',
    description: 'Blend in, walk out. Useful in any pair of hands.',
    skillBonus: 2,
    cost: 550,
  },

  // ---- Driver --------------------------------------------------------------
  {
    id: 'tuning',
    name: 'Getaway Tuning',
    description: 'Squeezes real speed out of the getaway car.',
    skillBonus: 2,
    role: 'driver',
    cost: 350,
  },
  {
    id: 'nitrous',
    name: 'Nitrous Rig',
    description: 'One button, and no roadblock keeps up.',
    skillBonus: 4,
    role: 'driver',
    cost: 900,
  },

  // ---- Hacker --------------------------------------------------------------
  {
    id: 'laptop',
    name: 'Encrypted Laptop',
    description: 'Purpose-built for cracking systems.',
    skillBonus: 2,
    role: 'hacker',
    cost: 350,
  },
  {
    id: 'zeroday',
    name: 'Zero-Day Kit',
    description: 'Unpatched exploits that open doors no key can.',
    skillBonus: 4,
    role: 'hacker',
    cost: 900,
  },

  // ---- Muscle --------------------------------------------------------------
  {
    id: 'armor',
    name: 'Body Armor',
    description: 'Lets the heavy hitter push harder without flinching.',
    skillBonus: 2,
    role: 'muscle',
    cost: 350,
  },
  {
    id: 'breaching',
    name: 'Breaching Charges',
    description: 'Walls and vault doors stop being an obstacle.',
    skillBonus: 4,
    role: 'muscle',
    cost: 900,
  },

  // ---- Lookout -------------------------------------------------------------
  {
    id: 'scanner',
    name: 'Police Scanner',
    description: 'A lookout who hears the sirens coming first.',
    skillBonus: 2,
    role: 'lookout',
    cost: 350,
  },
  {
    id: 'drone',
    name: 'Recon Drone',
    description: 'Eyes in the sky — nothing approaches unseen.',
    skillBonus: 4,
    role: 'lookout',
    cost: 900,
  },
];

export const GEAR_BY_ID: Record<GearId, GearDef> = Object.fromEntries(
  GEAR.map((g) => [g.id, g]),
);

/** True if a member of `role` is allowed to buy/equip this gear. */
export function gearAllowedForRole(gear: GearDef, role: RoleId): boolean {
  return !gear.role || gear.role === role;
}

/** Every gear piece a member of `role` can own (universal + that role's line). */
export function gearForRole(role: RoleId): GearDef[] {
  return GEAR.filter((g) => gearAllowedForRole(g, role));
}
