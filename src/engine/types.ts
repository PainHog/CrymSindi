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
import type { ApproachId } from '../data/approaches';
import type { UpgradeId } from '../data/upgrades';
import type { SafehouseTierId } from '../data/safehouses';

export interface Member {
  id: string;
  name: string;
  role: RoleId;
  skill: number;
  gearIds: GearId[];
  /** Optional trait modifying effective skill (see data/traits.ts). */
  traitId?: string;
  /** If set and in the future, this member is injured and sitting out until this
   *  ms-epoch time. Injured members don't count toward a crew and can't be sent.
   *  Undefined/past = healthy. */
  downUntil?: number;
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
  /** For the repeatable Syndicate Contract: the contract level this run was
   *  launched at, so its (escalating) definition is stable across collect. */
  contractLevel?: number;
  /** Ambient heat when this job was committed. The job resolves against THIS
   *  heat (not the cooled-down collect-time heat), so launching while hot stays
   *  costly even for a long job. Optional for backward compatibility with older
   *  saves (which fall back to collect-time heat). */
  heatAtLaunch?: number;
  /** The approach chosen at launch (loud/quiet/ghost). Drives payout + odds at
   *  resolve; heat/duration were already applied at launch. Optional — older
   *  saves and default launches resolve as the neutral "quiet" approach. */
  approachId?: ApproachId;
  /** The members who actually went (healthy at launch), snapshotted so an
   *  injury that benches a member after launch — or a recovery mid-job — can't
   *  change who resolves this job. Optional — older saves resolve over the crew's
   *  current roster. */
  memberIds?: string[];
}

/** Career totals that persist across prestige resets (drive milestones). */
export interface CareerStats {
  heistsCompleted: number;
  heistsSucceeded: number;
  flawless: number;
  biggestScore: number;
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

  /** Total cash earned THIS run (reset on prestige). Drives tier unlock gates
   *  and the notoriety payout on retirement. */
  lifetimeCash: number;

  // ---- Meta-progression (persists across prestige) -------------------------
  /** Permanent Notoriety points earned by retiring crews. */
  notoriety: number;
  /** How many times the player has retired ("gone legit"). */
  prestigeCount: number;
  /** Total cash earned across ALL runs (never reset) - for milestones. */
  careerCash: number;
  /** Cleared levels of the repeatable Syndicate Contract. */
  contractLevel: number;
  /** Career totals for milestones (persist across prestige). */
  stats: CareerStats;
  /** Milestone ids already awarded. */
  milestonesEarned: string[];
  /** Day index (see daily.ts) of the last claimed daily reward; -1 if never. */
  dailyClaimDay: number;
  /** Consecutive-day login streak, for the daily reward. */
  dailyStreak: number;
  /** Premium currency ("Marks"). Persists across prestige. Monetization is
   *  plumbed but not wired to any store/SDK yet (see src/monetization). */
  marks: number;
  /** Purchased Notoriety perk levels, keyed by perk id (see data/perks.ts).
   *  Persists across prestige; drives the notoriety bonuses. */
  perks: Record<string, number>;

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
  /** Display name of the member's trait, if any. */
  trait?: string;
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
  /** Names of crew synergies that were active this run. */
  synergies: string[];
  factors: HeistFactor[];
  recommendations: Recommendation[];
}
