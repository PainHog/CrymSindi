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
import { TRAITS_BY_ID } from '../data/traits';
import { activeSynergies, synergyPower } from '../data/synergies';
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

// ---- Injuries ---------------------------------------------------------------

/** True if this member is currently injured (benched until a future time). */
export function isMemberDown(member: Member, now: number): boolean {
  return member.downUntil != null && now < member.downUntil;
}

/** A copy of the crew holding only the members healthy at `now` — the ones who
 *  can actually be sent. Injured members sit out (they aren't removed from the
 *  crew, just excluded from launch gating, previews, and power). */
export function healthyCrew(state: GameState, crew: Crew, now: number): Crew {
  return {
    ...crew,
    memberIds: crew.memberIds.filter((id) => {
      const m = getMember(state, id);
      return !!m && !isMemberDown(m, now);
    }),
  };
}

/** Cash to immediately patch up an injured member (scales with their skill). */
export function healCost(member: Member, config: Config = CONFIG): number {
  return Math.round(config.injuryHealBaseCost + config.injuryHealPerSkill * member.skill);
}

// ---- Skill / power ----------------------------------------------------------

/** A member's effective skill including owned-gear bonuses and their trait. */
export function memberEffectiveSkill(member: Member): number {
  let skill = member.skill;
  for (const gearId of member.gearIds) {
    const gear = GEAR_BY_ID[gearId];
    if (!gear) continue;
    skill += gear.skillBonus;
  }
  if (member.traitId) skill += TRAITS_BY_ID[member.traitId]?.skillBonus ?? 0;
  return skill;
}

/** Flat effective-skill bonus every member gets from the crew's active synergies. */
export function crewSynergyPower(members: Member[]): number {
  return synergyPower(members.map((m) => m.role));
}
/** Names of the crew's active synergies (for display). */
export function crewSynergyNames(members: Member[]): string[] {
  return activeSynergies(members.map((m) => m.role)).map((s) => s.name);
}

/** A member's effective skill including the global Notoriety aura. */
export function memberPower(state: GameState, member: Member, config: Config = CONFIG): number {
  return memberEffectiveSkill(member) + notorietySkillBonus(state, config);
}

/** Sum of member power across a crew — including trait, Notoriety, and the
 *  per-member crew-synergy bonus, so it matches the power resolution actually
 *  uses. */
export function crewPower(state: GameState, crew: Crew): number {
  const members = crew.memberIds
    .map((id) => getMember(state, id))
    .filter((m): m is Member => Boolean(m));
  const synergy = crewSynergyPower(members);
  return members.reduce((sum, m) => sum + memberPower(state, m) + synergy, 0);
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
export const payoutMult = (s: GameState) => upgradeProduct(s, 'payoutMult');
/** Heat cools faster with the Clean Hands perk on top of any upgrades. */
export const heatCoolRateMult = (s: GameState, config: Config = CONFIG) =>
  upgradeProduct(s, 'heatCoolRateMult') * (1 + config.perkCleanHandsPct * perkLevel(s, 'clean_hands'));

/** Does any purchased upgrade grant the offline auto-collect Fixer? */
export function hasFixer(state: GameState): boolean {
  return state.purchasedUpgradeIds.some((id) => UPGRADES_BY_ID[id]?.effect.autoCollect);
}

// ---- Notoriety (meta-progression) ------------------------------------------

/** Purchased level of a Notoriety perk (0 if unowned). */
export function perkLevel(state: GameState, perkId: string): number {
  return state.perks?.[perkId] ?? 0;
}

/** Permanent global payout multiplier from the Reputation perk. */
export function notorietyMult(state: GameState, config: Config = CONFIG): number {
  return 1 + config.perkReputationPct * perkLevel(state, 'reputation');
}
/** Flat power every member gains from the Connections perk. */
export function notorietySkillBonus(state: GameState, config: Config = CONFIG): number {
  return config.perkConnectionsPower * perkLevel(state, 'connections');
}
/** Notoriety you'd earn by retiring now (from this run's lifetime cash). */
export function notorietyGainFor(lifetimeCash: number, config: Config = CONFIG): number {
  if (lifetimeCash <= 0) return 0;
  return Math.floor(Math.sqrt(lifetimeCash / config.notorietyDivisor));
}
export function canPrestige(state: GameState, config: Config = CONFIG): boolean {
  return state.lifetimeCash >= config.prestigeThreshold;
}

// ---- Ascension / Legend (second meta layer) --------------------------------

/** Purchased level of a legend perk (0 if unowned). */
export function legendPerkLevel(state: GameState, perkId: string): number {
  return state.legendPerks?.[perkId] ?? 0;
}
/** Legend you'd earn by ascending now (from your current Notoriety). */
export function legendGainFor(notoriety: number, config: Config = CONFIG): number {
  if (notoriety <= 0) return 0;
  return Math.floor(Math.sqrt(notoriety / config.legendDivisor));
}
/** Whether ascension is available (enough Notoriety, and it would yield >=1 Legend). */
export function canAscend(state: GameState, config: Config = CONFIG): boolean {
  return state.notoriety >= config.ascendThreshold && legendGainFor(state.notoriety, config) >= 1;
}
/** Permanent global payout multiplier from the Kingpin legend perk. */
export function legendPayoutMult(state: GameState, config: Config = CONFIG): number {
  return 1 + config.legendKingpinPct * legendPerkLevel(state, 'kingpin');
}
/** Multiplier applied to Notoriety earned on retirement (Reputation Engine). */
export function legendNotorietyMult(state: GameState, config: Config = CONFIG): number {
  return 1 + config.legendRepEnginePct * legendPerkLevel(state, 'rep_engine');
}
/** Extra starting cash each new run gets from the Deep Pockets legend perk. */
export function legendStartCash(state: GameState, config: Config = CONFIG): number {
  return config.legendDeepPocketsCash * legendPerkLevel(state, 'deep_pockets');
}

// ---- Endgame repeatable "Syndicate Contract" -------------------------------

export const CONTRACT_ID = 'syndicate_contract';
export const isContract = (heistId: string): boolean => heistId === CONTRACT_ID;

/** The repeatable contract's (escalating) definition at a given cleared level. */
export function contractHeistDef(level: number, config: Config = CONFIG): HeistDef {
  const lvl = Math.max(0, Math.floor(level));
  return {
    id: CONTRACT_ID,
    tier: 6,
    name: `Syndicate Contract · Op ${lvl + 1}`,
    description: 'A standing job that escalates every time you clear it. The work never ends.',
    requiredRoles: ['hacker', 'muscle', 'driver'],
    durationSec: config.contractDurationSec,
    payoutPerSec: config.contractBasePayoutPerSec * Math.pow(config.contractPayoutGrowth, lvl),
    heatCost: config.contractHeatCost,
    failHeatBonus: config.contractFailHeatBonus,
    difficulty: config.contractBaseDifficulty + config.contractDifficultyPerLevel * lvl,
  };
}

/** Resolve any heist id to its definition (handles the dynamic contract). */
export function heistDefFor(heistId: string, state: GameState, config: Config = CONFIG): HeistDef | undefined {
  if (isContract(heistId)) return contractHeistDef(state.contractLevel, config);
  return HEISTS_BY_ID[heistId];
}

/**
 * The endgame contract unlocks once you reach tier 5 — and STAYS unlocked. The
 * regular tier gates read run-local `lifetimeCash`, which prestige resets to 0
 * (so tiers 2-5 re-lock and you re-climb them — the intended prestige loop). But
 * the contract's cleared level persists across prestige, so re-locking it would
 * strand a player who's been grinding it. Gate it on persistent signals:
 *   - careerCash (cumulative-ever earnings, preserved across prestige and never
 *     decreasing) reaching the tier-5 threshold — the primary signal, and the
 *     one that carries a player who reached tier 5 but hadn't launched the
 *     contract yet.
 *   - contractLevel > 0 — already cleared it at least once; also survives a
 *     later upward change to the tier-5 threshold.
 * The run-local maxUnlockedTier check is kept as a defensive fallback: in normal
 * play careerCash >= lifetimeCash, so it's subsumed by the careerCash clause —
 * but a hand-edited/corrupt save can present lifetimeCash >= tier5 > careerCash,
 * and there it's the only clause that keeps a legitimately tier-5 run unlocked.
 */
export function contractUnlocked(state: GameState, config: Config = CONFIG): boolean {
  const tier5Cash = config.tierUnlocks[5] ?? Infinity;
  return (
    maxUnlockedTier(state, config) >= 5 || // run-local fallback (corrupt-save safe)
    state.careerCash >= tier5Cash || // ever reached tier 5 (persists past prestige)
    state.contractLevel > 0 // already cleared it at least once
  );
}

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
  const coolRate = config.heatCoolPerSec * heatCoolRateMult(state, config);
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
  return heist.tier <= maxUnlockedTier(state) && (heist.minAscend ?? 0) <= (state.ascendCount ?? 0);
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

/** Cash to "case the job" before a launch — a share of its base take. */
export function prepCostFor(heist: HeistDef, config: Config = CONFIG): number {
  return Math.round(heist.payoutPerSec * heist.durationSec * config.prepCostFrac);
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
