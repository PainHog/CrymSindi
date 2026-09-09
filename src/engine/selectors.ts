// -----------------------------------------------------------------------------
// SELECTORS (pure derived reads)
// -----------------------------------------------------------------------------
// Read-only helpers that compute derived values from GameState + the current
// time. Nothing here mutates state. These are the source of truth for display
// (heat, success chance, costs, ready/in-progress status) and are reused by the
// action logic so UI and engine never disagree.
// -----------------------------------------------------------------------------

import { CONFIG } from '../data/config';
import type { Config } from '../data/config';
import { GEAR_BY_ID } from '../data/gear';
import { HEISTS_BY_ID } from '../data/heists';
import type { HeistDef } from '../data/heists';
import { ROLES_BY_ID } from '../data/roles';
import type { RoleId } from '../data/roles';
import { UPGRADES_BY_ID } from '../data/upgrades';
import { SAFEHOUSE_TIERS, safehouseTierIndex } from '../data/safehouses';
import type { Crew, GameState, Member, Safehouse } from './types';

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// ---- Entity lookups ---------------------------------------------------------

export function getMember(state: GameState, id: string): Member | undefined {
  return state.members.find((m) => m.id === id);
}
export function getCrew(state: GameState, id: string): Crew | undefined {
  return state.crews.find((c) => c.id === id);
}
export function getSafehouse(state: GameState, id: string): Safehouse | undefined {
  return state.safehouses.find((s) => s.id === id);
}

// ---- Skill / power ----------------------------------------------------------

/** A member's effective skill including gear bonuses (flat + role affinity). */
export function memberEffectiveSkill(member: Member): number {
  let skill = member.skill;
  for (const gearId of member.gearIds) {
    const gear = GEAR_BY_ID[gearId];
    if (!gear) continue;
    skill += gear.skillBonus;
    if (gear.roleAffinity === member.role) skill += gear.affinityBonus ?? 0;
  }
  return skill;
}

/** Sum of effective skill across all members in a crew. */
export function crewPower(state: GameState, crew: Crew): number {
  return crew.memberIds.reduce((sum, id) => {
    const m = getMember(state, id);
    return sum + (m ? memberEffectiveSkill(m) : 0);
  }, 0);
}

/** Roles present in a crew (distinct set). */
export function crewRoles(state: GameState, crew: Crew): Set<RoleId> {
  const roles = new Set<RoleId>();
  for (const id of crew.memberIds) {
    const m = getMember(state, id);
    if (m) roles.add(m.role);
  }
  return roles;
}

/** Which required roles a crew is missing for a given heist. */
export function missingRoles(state: GameState, crew: Crew, heist: HeistDef): RoleId[] {
  const have = crewRoles(state, crew);
  return heist.requiredRoles.filter((r) => !have.has(r));
}

export function crewHasRoles(state: GameState, crew: Crew, heist: HeistDef): boolean {
  return missingRoles(state, crew, heist).length === 0;
}

// ---- Upgrade multipliers ----------------------------------------------------

function upgradeProduct(
  state: GameState,
  key: 'heatGainMult' | 'heatCoolRateMult' | 'payoutMult',
): number {
  let mult = 1;
  for (const id of state.purchasedUpgradeIds) {
    const up = UPGRADES_BY_ID[id];
    const v = up?.effect[key];
    if (typeof v === 'number') mult *= v;
  }
  return mult;
}

export const heatGainMult = (s: GameState) => upgradeProduct(s, 'heatGainMult');
export const heatCoolRateMult = (s: GameState) => upgradeProduct(s, 'heatCoolRateMult');
export const payoutMult = (s: GameState) => upgradeProduct(s, 'payoutMult');

// ---- Heat (timestamp-derived) ----------------------------------------------

/**
 * Current heat, derived from the stored value and elapsed real time. Cooling is
 * capped at CONFIG.offlineCapSec of elapsed time so extremely long absences
 * can't produce runaway passive effects. This is the ONLY correct way to read
 * "how much heat right now" - both UI display and the action logic use it.
 */
export function deriveHeat(state: GameState, now: number, config: Config = CONFIG): number {
  const elapsedMs = Math.max(0, now - state.heatUpdatedAt);
  const cappedMs = Math.min(elapsedMs, config.offlineCapSec * 1000);
  const coolRate = config.heatCoolPerSec * heatCoolRateMult(state);
  const cooled = state.heat - coolRate * (cappedMs / 1000);
  return clamp(cooled, 0, config.maxHeat);
}

// ---- Progression ------------------------------------------------------------

/** Highest heist tier currently unlocked (tier 1 always unlocked). */
export function maxUnlockedTier(state: GameState, config: Config = CONFIG): number {
  let tier = 1;
  for (const [tierStr, needed] of Object.entries(config.tierUnlocks)) {
    const t = Number(tierStr);
    if (state.lifetimeCash >= needed) tier = Math.max(tier, t);
  }
  return tier;
}

export function isHeistUnlocked(state: GameState, heist: HeistDef): boolean {
  return heist.tier <= maxUnlockedTier(state);
}

// ---- Heist instance status --------------------------------------------------

export type HeistStatus = 'inProgress' | 'ready';

export function heistStatusAt(endsAt: number, now: number): HeistStatus {
  return now >= endsAt ? 'ready' : 'inProgress';
}

// ---- Costs ------------------------------------------------------------------

/** Cost of buying the next new safehouse given how many are already owned. */
export function nextSafehouseCost(state: GameState, config: Config = CONFIG): number {
  const owned = state.safehouses.length;
  return Math.round(
    config.newSafehouseBaseCost * Math.pow(config.newSafehouseCostMult, owned - 1),
  );
}

/** Cost of forming the next new crew given how many are already owned. */
export function nextCrewCost(state: GameState, config: Config = CONFIG): number {
  const owned = state.crews.length;
  return Math.round(config.newCrewBaseCost * Math.pow(config.newCrewCostMult, owned - 1));
}

/** Cost of recruiting a member of `roleId` into `crew` (scales with crew size). */
export function recruitCost(
  crew: Crew,
  roleId: RoleId,
  config: Config = CONFIG,
): number {
  const role = ROLES_BY_ID[roleId];
  if (!role) return Infinity;
  return Math.round(
    role.recruitCost * Math.pow(config.recruitCostMultPerMember, crew.memberIds.length),
  );
}

/** Cost of the next skill upgrade for a member (returns Infinity if maxed). */
export function skillUpgradeCost(member: Member, config: Config = CONFIG): number {
  if (member.skill >= config.maxMemberSkill) return Infinity;
  const steps = member.skill - config.startingMemberSkill;
  return Math.round(config.skillUpgradeBaseCost * Math.pow(config.skillUpgradeCostMult, steps));
}

/** Cost to upgrade an existing safehouse to the next tier (Infinity if maxed). */
export function safehouseUpgradeCost(safehouse: Safehouse): number {
  const idx = safehouseTierIndex(safehouse.tierId);
  const next = SAFEHOUSE_TIERS[idx + 1];
  return next ? next.upgradeCost : Infinity;
}

// ---- Convenience derived views ---------------------------------------------

/** Is this crew tied up in an (in-progress or uncollected) heist? */
export function isCrewLocked(state: GameState, crewId: string): boolean {
  return state.crews.find((c) => c.id === crewId)?.status === 'onHeist';
}

export function activeHeistForCrew(state: GameState, crewId: string) {
  return state.activeHeists.find((a) => a.crewId === crewId);
}

export const heistDef = (id: string): HeistDef | undefined => HEISTS_BY_ID[id];
