// -----------------------------------------------------------------------------
// HEISTS
// -----------------------------------------------------------------------------
// A heist is a job a whole crew is sent on. It resolves over real time
// (durationSec) against start/end timestamps. On collect it is resolved
// per-member (see engine/resolution.ts): each member rolls against the job's
// difficulty, and the crew's success + take depend on how many passed.
//
// `tier` gates availability: tier 1 is always available; higher tiers unlock via
// CONFIG.tierUnlocks (lifetime cash thresholds). `requiredRoles` must all be
// present in the assigned crew, and the crew must meet the member-count minimum
// for the job (grows with difficulty), or it cannot be launched.
//
// Income is time-based: the base take = payoutPerSec * durationSec, then scaled
// by how well the crew performed (a flawless run pays a bonus - see config).
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
  /** Base cash earned per second of duration (before performance scaling). */
  payoutPerSec: number;
  /** Heat added when the heist is launched. */
  heatCost: number;
  /** Extra heat added when a heist is collected as a FAILURE. */
  failHeatBonus: number;
  /** Difficulty each member rolls against; also drives the crew-size minimum. */
  difficulty: number;
  /** Minimum ascensions before this job unlocks (0/undefined = no ascension gate).
   *  Used for ascension-reward content like the capstone. */
  minAscend?: number;
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
    payoutPerSec: 6,
    heatCost: 5,
    failHeatBonus: 10,
    difficulty: 4,
  },
  {
    id: 'atm_skim',
    tier: 1,
    name: 'ATM Skim',
    description: 'Tap a cash machine off the network. Needs a hacker.',
    requiredRoles: ['hacker'],
    durationSec: 45,
    payoutPerSec: 7,
    heatCost: 9,
    failHeatBonus: 12,
    difficulty: 8,
  },
  {
    id: 'warehouse_job',
    tier: 1,
    name: 'Warehouse Job',
    description: 'Back a truck up to a loading dock and clear it out.',
    requiredRoles: ['muscle', 'driver'],
    durationSec: 90,
    payoutPerSec: 8,
    heatCost: 14,
    failHeatBonus: 16,
    difficulty: 10,
  },
  {
    id: 'pickpocket_ring',
    tier: 1,
    name: 'Pickpocket Ring',
    description: 'Run a crew of dips through a crowded market. A lookout keeps it clean.',
    requiredRoles: ['lookout'],
    durationSec: 30,
    payoutPerSec: 6,
    heatCost: 6,
    failHeatBonus: 10,
    difficulty: 6,
  },

  // ---- Tier 2: bigger, longer jobs (unlock via lifetime cash) --------------
  {
    id: 'bank_vault',
    tier: 2,
    name: 'Bank Vault Run',
    description: 'A real vault. Bring a full, sharp crew.',
    requiredRoles: ['hacker', 'muscle', 'driver'],
    durationSec: 300,
    payoutPerSec: 12,
    heatCost: 34,
    failHeatBonus: 20,
    difficulty: 12,
  },
  {
    id: 'casino_heist',
    tier: 2,
    name: 'Casino Floor Heist',
    description: 'The big score. Long, loud, and very well guarded.',
    requiredRoles: ['hacker', 'muscle', 'lookout'],
    durationSec: 600,
    payoutPerSec: 15,
    heatCost: 54, // > cool-over-duration (0.08*600=48) so chained runs actually build heat
    failHeatBonus: 28,
    difficulty: 14,
  },
  {
    id: 'jewel_courier',
    tier: 2,
    name: 'Jewel Courier',
    description: 'Intercept a courier mid-route. A wheel and a lookout make it clean.',
    requiredRoles: ['driver', 'lookout'],
    durationSec: 420,
    payoutPerSec: 13,
    heatCost: 40,
    failHeatBonus: 22,
    difficulty: 13,
  },

  // ---- Tier 3: long jobs to leave running (unlock $30k lifetime) -----------
  {
    id: 'jewelry_exchange',
    tier: 3,
    name: 'Jewelry Exchange',
    description: 'A patient in-and-out on a high-end vault room. ~15 minutes.',
    requiredRoles: ['hacker', 'driver'],
    durationSec: 15 * 60,
    payoutPerSec: 24,
    heatCost: 38,
    failHeatBonus: 28,
    difficulty: 20,
  },
  {
    id: 'cargo_port',
    tier: 3,
    name: 'Cargo Port Raid',
    description: 'Hijack a container off the docks before the shift change. ~30 minutes.',
    requiredRoles: ['muscle', 'driver', 'lookout'],
    durationSec: 30 * 60,
    payoutPerSec: 30,
    heatCost: 50,
    failHeatBonus: 34,
    difficulty: 22,
  },
  {
    id: 'penthouse_job',
    tier: 3,
    name: 'Penthouse Job',
    description: 'Crack a private collector’s top-floor safe. Quiet hands, heavy door. ~20 minutes.',
    requiredRoles: ['hacker', 'muscle'],
    durationSec: 20 * 60,
    payoutPerSec: 27,
    heatCost: 44,
    failHeatBonus: 30,
    difficulty: 21,
  },

  // ---- Tier 4: multi-hour scores (unlock $180k lifetime) -------------------
  {
    id: 'armored_convoy',
    tier: 4,
    name: 'Armored Convoy',
    description: 'Take down a cash-transport route. Plan it and walk away. ~1 hour.',
    requiredRoles: ['hacker', 'muscle', 'driver'],
    durationSec: 60 * 60,
    payoutPerSec: 48,
    heatCost: 62,
    failHeatBonus: 40,
    difficulty: 31,
  },
  {
    id: 'data_center',
    tier: 4,
    name: 'Data Center Breach',
    description: 'A slow, deep intrusion for the real money. ~5 hours.',
    requiredRoles: ['hacker', 'muscle', 'lookout'],
    durationSec: 5 * 60 * 60,
    payoutPerSec: 62,
    heatCost: 78,
    failHeatBonus: 50,
    difficulty: 33,
  },
  {
    id: 'rail_yard',
    tier: 4,
    name: 'Rail Yard Heist',
    description: 'Stop a freight car of bearer bonds and strip it clean. ~3 hours.',
    requiredRoles: ['muscle', 'driver', 'lookout'],
    durationSec: 3 * 60 * 60,
    payoutPerSec: 55,
    heatCost: 70,
    failHeatBonus: 45,
    difficulty: 32,
  },

  // ---- Tier 5: the overnight big score (unlock $1.2M lifetime) -------------
  {
    id: 'central_bank',
    tier: 5,
    name: 'Central Bank Score',
    description: 'The one you retire on. Launch it, sleep on it. ~12 hours.',
    requiredRoles: ['hacker', 'muscle', 'driver'],
    durationSec: 12 * 60 * 60,
    payoutPerSec: 112,
    heatCost: 92,
    failHeatBonus: 60,
    difficulty: 38, // hardest job, but clearable by a just-unlocked tier-5 crew so it leads $/min
  },

  // ---- Capstone: unlocked only after ascending (see minAscend) -------------
  {
    id: 'sovereign_reserve',
    tier: 5,
    name: 'The Sovereign Reserve',
    description:
      "The score they only tell as a legend. The door opens for an ascended name and no one else. ~12 hours.",
    requiredRoles: ['hacker', 'muscle', 'driver', 'lookout'],
    durationSec: 12 * 60 * 60,
    payoutPerSec: 180,
    heatCost: 115,
    failHeatBonus: 75,
    difficulty: 46,
    minAscend: 1,
  },
];

export const HEISTS_BY_ID: Record<HeistId, HeistDef> = Object.fromEntries(
  HEISTS.map((h) => [h.id, h]),
);
