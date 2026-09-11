// -----------------------------------------------------------------------------
// GEAR / TOOLS
// -----------------------------------------------------------------------------
// Gear is bought for an individual crew member and permanently boosts their
// effective skill. Every piece is ROLE-SPECIFIC: only a member of that role can
// buy/equip it. A laptop belongs to a hacker, not the muscle. Each role has its
// own three-tier line (basic +2, mid +3, advanced +5) that a member climbs one
// piece at a time. A member can own each piece once.
// -----------------------------------------------------------------------------

import type { RoleId } from './roles';

export type GearId = string;

export interface GearDef {
  id: GearId;
  name: string;
  description: string;
  /** Flat effective-skill added to the member who owns it. */
  skillBonus: number;
  /** Role this gear is locked to. Only a member of this role can buy/equip it. */
  role: RoleId;
  cost: number;
}

export const GEAR: GearDef[] = [
  // ---- Driver --------------------------------------------------------------
  {
    id: 'tuning',
    name: 'Getaway Tuning',
    description: 'Squeezes real speed out of the getaway car.',
    skillBonus: 2,
    role: 'driver',
    cost: 300,
  },
  {
    id: 'runflat',
    name: 'Run-Flat Tires',
    description: 'Spike strips and blowouts stop ending the chase.',
    skillBonus: 3,
    role: 'driver',
    cost: 650,
  },
  {
    id: 'nitrous',
    name: 'Nitrous Rig',
    description: 'One button, and no roadblock keeps up.',
    skillBonus: 5,
    role: 'driver',
    cost: 1200,
  },

  // ---- Hacker --------------------------------------------------------------
  {
    id: 'laptop',
    name: 'Encrypted Laptop',
    description: 'Purpose-built for cracking systems.',
    skillBonus: 2,
    role: 'hacker',
    cost: 300,
  },
  {
    id: 'jammer',
    name: 'Signal Jammer',
    description: 'Silences alarms and radios at the worst moment for them.',
    skillBonus: 3,
    role: 'hacker',
    cost: 650,
  },
  {
    id: 'zeroday',
    name: 'Zero-Day Kit',
    description: 'Unpatched exploits that open doors no key can.',
    skillBonus: 5,
    role: 'hacker',
    cost: 1200,
  },

  // ---- Muscle --------------------------------------------------------------
  {
    id: 'armor',
    name: 'Body Armor',
    description: 'Lets the heavy hitter push harder without flinching.',
    skillBonus: 2,
    role: 'muscle',
    cost: 300,
  },
  {
    id: 'torch',
    name: 'Cutting Torch',
    description: 'Carves through bars and vault steel given a minute.',
    skillBonus: 3,
    role: 'muscle',
    cost: 650,
  },
  {
    id: 'breaching',
    name: 'Breaching Charges',
    description: 'Walls and vault doors stop being an obstacle.',
    skillBonus: 5,
    role: 'muscle',
    cost: 1200,
  },

  // ---- Lookout -------------------------------------------------------------
  {
    id: 'scanner',
    name: 'Police Scanner',
    description: 'A lookout who hears the sirens coming first.',
    skillBonus: 2,
    role: 'lookout',
    cost: 300,
  },
  {
    id: 'wiretap',
    name: 'Wiretap Kit',
    description: 'Taps the response net — you know their move before they do.',
    skillBonus: 3,
    role: 'lookout',
    cost: 650,
  },
  {
    id: 'drone',
    name: 'Recon Drone',
    description: 'Eyes in the sky — nothing approaches unseen.',
    skillBonus: 5,
    role: 'lookout',
    cost: 1200,
  },
];

export const GEAR_BY_ID: Record<GearId, GearDef> = Object.fromEntries(
  GEAR.map((g) => [g.id, g]),
);

/** True if a member of `role` is allowed to buy/equip this gear. */
export function gearAllowedForRole(gear: GearDef, role: RoleId): boolean {
  return gear.role === role;
}

/** Every gear piece a member of `role` can own (that role's line). */
export function gearForRole(role: RoleId): GearDef[] {
  return GEAR.filter((g) => gearAllowedForRole(g, role));
}
