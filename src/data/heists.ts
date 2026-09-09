// -----------------------------------------------------------------------------
// HEISTS
// -----------------------------------------------------------------------------
// A heist is a job a whole crew is sent on. It resolves over real time
// (durationSec) against start/end timestamps. On collect, a success roll is made
// from crew power vs difficulty (see engine/heists.ts).
//
// `tier` gates availability: tier 1 is always available; higher tiers unlock via
// CONFIG.tierUnlocks (lifetime cash thresholds). `requiredRoles` must all be
// present in the assigned crew or the heist cannot be launched.
//
// Heat: heatCost is applied when the heist is LAUNCHED (committing to a job
// raises heat immediately, then it cools over real time). On a FAILED collect,
// failHeatBonus is added on top.
// -----------------------------------------------------------------------------

import type { RoleId } from './roles';

export type HeistId = string;

export interface HeistDef {
  id: HeistId;
  tier: number;
  name: string;
  description: string;
  requiredRoles: RoleId[];
  durationSec: number;
  payoutMin: number;
  payoutMax: number;
  /** Heat added when the heist is launched. */
  heatCost: number;
  /** Extra heat added when a heist is collected as a FAILURE. */
  failHeatBonus: number;
  /** Difficulty in the same units as crew power (sum of member effective skill). */
  difficulty: number;
}

export const HEISTS: HeistDef[] = [
  // ---- Tier 1: short, frequent early jobs ----------------------------------
  {
    id: 'smash_grab',
    tier: 1,
    name: 'Smash & Grab',
    description: 'A quick corner-store till job. Anyone can pull it off.',
    requiredRoles: [],
    durationSec: 20,
    payoutMin: 40,
    payoutMax: 80,
    heatCost: 6,
    failHeatBonus: 8,
    difficulty: 4,
  },
  {
    id: 'atm_skim',
    tier: 1,
    name: 'ATM Skim',
    description: 'Tap a cash machine off the network. Needs a hacker.',
    requiredRoles: ['hacker'],
    durationSec: 45,
    payoutMin: 110,
    payoutMax: 180,
    heatCost: 10,
    failHeatBonus: 10,
    difficulty: 8,
  },
  {
    id: 'warehouse_job',
    tier: 1,
    name: 'Warehouse Job',
    description: 'Back a truck up to a loading dock and clear it out.',
    requiredRoles: ['muscle', 'driver'],
    durationSec: 90,
    payoutMin: 240,
    payoutMax: 380,
    heatCost: 16,
    failHeatBonus: 12,
    difficulty: 14,
  },

  // ---- Tier 2: bigger, longer jobs (unlock via lifetime cash) --------------
  {
    id: 'bank_vault',
    tier: 2,
    name: 'Bank Vault Run',
    description: 'A real vault. Bring a full, sharp crew.',
    requiredRoles: ['hacker', 'muscle', 'driver'],
    durationSec: 300,
    payoutMin: 900,
    payoutMax: 1500,
    heatCost: 28,
    failHeatBonus: 18,
    difficulty: 28,
  },
  {
    id: 'casino_heist',
    tier: 2,
    name: 'Casino Floor Heist',
    description: 'The big score. Long, loud, and very well guarded.',
    requiredRoles: ['hacker', 'muscle', 'lookout'],
    durationSec: 600,
    payoutMin: 2200,
    payoutMax: 3800,
    heatCost: 40,
    failHeatBonus: 24,
    difficulty: 40,
  },
];

export const HEISTS_BY_ID: Record<HeistId, HeistDef> = Object.fromEntries(
  HEISTS.map((h) => [h.id, h]),
);
