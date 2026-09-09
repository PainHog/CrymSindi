// -----------------------------------------------------------------------------
// CORE DATA MODEL
// -----------------------------------------------------------------------------
// The nested hierarchy: Safehouse -> Crew -> Member. Heists lock a whole crew.
// GameState is the single serializable source of truth (persisted to
// localStorage). Timestamps (ms epoch) drive all idle/offline resolution.
// -----------------------------------------------------------------------------

import type { RoleId } from '../data/roles';
import type { GearId } from '../data/gear';
import type { HeistId } from '../data/heists';
import type { UpgradeId } from '../data/upgrades';
import type { SafehouseTierId } from '../data/safehouses';

export interface Member {
  id: string;
  name: string;
  role: RoleId;
  skill: number;
  gearIds: GearId[];
}

export type CrewStatus = 'idle' | 'onHeist';

export interface Crew {
  id: string;
  safehouseId: string;
  memberIds: string[];
  maxMembers: number;
  status: CrewStatus;
}

export interface Safehouse {
  id: string;
  tierId: SafehouseTierId;
  crewSlots: number;
  crewIds: string[];
}

/** An in-progress or finished-but-uncollected heist. Timestamps are truth. */
export interface ActiveHeist {
  id: string; // unique instance id
  heistId: HeistId;
  crewId: string;
  startedAt: number; // ms epoch
  endsAt: number; // ms epoch
}

export interface GameState {
  version: number;

  cash: number;

  /** Heat value as of `heatUpdatedAt`. Current heat is derived from elapsed
   *  real time (see deriveHeat). Never read this raw for display. */
  heat: number;
  heatUpdatedAt: number; // ms epoch

  safehouses: Safehouse[];
  crews: Crew[];
  members: Member[];
  activeHeists: ActiveHeist[];
  purchasedUpgradeIds: UpgradeId[];

  /** Total cash ever earned (monotonic). Drives tier unlock gates. */
  lifetimeCash: number;

  /** Timestamp of the last save; used for offline resolution + display. */
  lastSaved: number;

  /** Monotonic counter for generating unique entity ids. */
  nextId: number;
}

/** Result of any state-changing engine action. */
export type ActionResult =
  | { ok: true; state: GameState; message?: string }
  | { ok: false; error: string };

/** Outcome details returned when a heist is collected. */
export interface CollectOutcome {
  success: boolean;
  chance: number;
  payout: number;
  heatAdded: number;
  heistId: HeistId;
}
