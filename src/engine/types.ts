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
  /** RNG seed fixed at launch, so the outcome is determined then (not re-rollable
   *  by reloading). Optional for backward compatibility with older saves. */
  seed?: number;
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

// ---- After-action report (the play-by-play) ---------------------------------

/** How a single member performed on their part of the job. */
export type BeatQuality = 'flawless' | 'clean' | 'shaky' | 'botched';

export interface MemberBeat {
  memberId: string;
  name: string;
  role: RoleId;
  effectiveSkill: number;
  gearIds: GearId[];
  /** Whether this member cleared their check. */
  passed: boolean;
  /** The roll (0..1) and the chance they needed to beat it. */
  roll: number;
  chance: number;
  quality: BeatQuality;
  /** Narrative of what this member did and how it went. */
  detail: string;
}

/** A driver that pushed the outcome one way or the other. */
export interface HeistFactor {
  label: string;
  /** true = helped, false = hurt. */
  positive: boolean;
  note: string;
}

export interface Recommendation {
  kind: 'skill' | 'gear' | 'role' | 'heat' | 'crewSize';
  text: string;
  memberId?: string;
}

/** Full after-action report produced when a heist is collected. */
export interface HeistReport {
  heistId: HeistId;
  heistName: string;
  crewId: string;
  crewLabelIndex: number;

  success: boolean;
  perfect: boolean;
  headline: string;
  turningPoint: string;

  passCount: number;
  crewSize: number;
  requiredPasses: number;
  /** Fraction of the crew that passed (0..1) - the "success quality" slider. */
  quality: number;

  payout: number;
  perfectBonus: number;
  heatAdded: number;

  difficulty: number;
  crewPower: number;
  heatAtResolve: number;

  members: MemberBeat[];
  missingRoleCoverage: RoleId[];
  factors: HeistFactor[];
  recommendations: Recommendation[];
}
