// -----------------------------------------------------------------------------
// GEAR / TOOLS
// -----------------------------------------------------------------------------
// Gear is bought for an individual crew member and permanently boosts their
// effective skill. Gear with a matching `roleAffinity` grants an extra bonus
// when equipped by a member of that role. Each member can own each gear once.
// -----------------------------------------------------------------------------

import type { RoleId } from './roles';

export type GearId = string;

export interface GearDef {
  id: GearId;
  name: string;
  description: string;
  /** Flat skill added to any member who owns it. */
  skillBonus: number;
  /** Optional role that gets an extra bonus from this gear. */
  roleAffinity?: RoleId;
  /** Extra skill added on top of skillBonus when the role matches. */
  affinityBonus?: number;
  cost: number;
}

export const GEAR: GearDef[] = [
  {
    id: 'lockpicks',
    name: 'Lockpick Set',
    description: 'Old reliable. A small edge for anyone on the job.',
    skillBonus: 2,
    cost: 200,
  },
  {
    id: 'laptop',
    name: 'Encrypted Laptop',
    description: 'Purpose-built for cracking systems.',
    skillBonus: 2,
    roleAffinity: 'hacker',
    affinityBonus: 3,
    cost: 450,
  },
  {
    id: 'tuning',
    name: 'Getaway Tuning',
    description: 'Squeezes real speed out of the getaway car.',
    skillBonus: 1,
    roleAffinity: 'driver',
    affinityBonus: 3,
    cost: 400,
  },
  {
    id: 'armor',
    name: 'Body Armor',
    description: 'Lets the heavy hitter push harder without flinching.',
    skillBonus: 1,
    roleAffinity: 'muscle',
    affinityBonus: 3,
    cost: 400,
  },
  {
    id: 'scanner',
    name: 'Police Scanner',
    description: 'A lookout who hears the sirens coming first.',
    skillBonus: 1,
    roleAffinity: 'lookout',
    affinityBonus: 3,
    cost: 350,
  },
];

export const GEAR_BY_ID: Record<GearId, GearDef> = Object.fromEntries(
  GEAR.map((g) => [g.id, g]),
);
