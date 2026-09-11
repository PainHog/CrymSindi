// -----------------------------------------------------------------------------
// ECONOMY ACTIONS (Cash sinks)
// -----------------------------------------------------------------------------
// Buy safehouse, upgrade safehouse capacity, form crew, recruit member, buy
// gear, upgrade member skill, buy global upgrade. Each returns an ActionResult
// with either the new state or an error string. Costs come from selectors so
// the UI can preview them and the logic can charge them consistently.
// -----------------------------------------------------------------------------

import { CONFIG } from '../data/config';
import type { Config } from '../data/config';
import { GEAR_BY_ID, gearAllowedForRole } from '../data/gear';
import { pickUniqueName } from '../data/names';
import { PERKS_BY_ID, perkCost } from '../data/perks';
import { traitForId } from '../data/traits';
import { ROLES_BY_ID } from '../data/roles';
import { SAFEHOUSE_TIERS, safehouseTierIndex } from '../data/safehouses';
import { UPGRADES_BY_ID } from '../data/upgrades';
import {
  getCrew,
  getMember,
  getSafehouse,
  nextCrewCost,
  nextSafehouseCost,
  notorietyGainFor,
  recruitCost,
  safehouseUpgradeCost,
  skillUpgradeCost,
} from './selectors';
import { createInitialState } from './state';
import type { ActionResult, Crew, GameState, Member, Safehouse } from './types';

function spend(state: GameState, cost: number): GameState {
  return { ...state, cash: state.cash - cost };
}

function insufficient(): ActionResult {
  return { ok: false, error: 'Not enough cash.' };
}

/** Buy a brand-new safehouse (starts at the first tier, no crews). */
export function buySafehouse(state: GameState, config: Config = CONFIG): ActionResult {
  const cost = nextSafehouseCost(state, config);
  if (state.cash < cost) return insufficient();

  const tier = SAFEHOUSE_TIERS[0];
  const safehouse: Safehouse = {
    id: `s${state.nextId}`,
    tierId: tier.id,
    crewSlots: tier.crewSlots,
    crewIds: [],
  };

  const next = spend(state, cost);
  return {
    ok: true,
    state: {
      ...next,
      nextId: next.nextId + 1,
      safehouses: [...next.safehouses, safehouse],
    },
    message: `Bought a new safehouse: ${tier.name}.`,
  };
}

/** Upgrade an existing safehouse to the next tier (more crew slots). */
export function upgradeSafehouse(
  state: GameState,
  safehouseId: string,
): ActionResult {
  const safehouse = getSafehouse(state, safehouseId);
  if (!safehouse) return { ok: false, error: 'Unknown safehouse.' };

  const idx = safehouseTierIndex(safehouse.tierId);
  const nextTier = SAFEHOUSE_TIERS[idx + 1];
  if (!nextTier) return { ok: false, error: 'Safehouse is already at max capacity.' };

  const cost = safehouseUpgradeCost(safehouse);
  if (state.cash < cost) return insufficient();

  const next = spend(state, cost);
  return {
    ok: true,
    state: {
      ...next,
      safehouses: next.safehouses.map((s) =>
        s.id === safehouseId
          ? { ...s, tierId: nextTier.id, crewSlots: nextTier.crewSlots }
          : s,
      ),
    },
    message: `Upgraded safehouse to ${nextTier.name} (${nextTier.crewSlots} crew slots).`,
  };
}

/** Form a new (empty) crew in an open safehouse slot. */
export function formCrew(
  state: GameState,
  safehouseId: string,
  config: Config = CONFIG,
): ActionResult {
  const safehouse = getSafehouse(state, safehouseId);
  if (!safehouse) return { ok: false, error: 'Unknown safehouse.' };
  if (safehouse.crewIds.length >= safehouse.crewSlots) {
    return { ok: false, error: 'No open crew slot in that safehouse.' };
  }

  const cost = nextCrewCost(state, config);
  if (state.cash < cost) return insufficient();

  const crew: Crew = {
    id: `c${state.nextId}`,
    safehouseId,
    memberIds: [],
    maxMembers: config.crewMaxMembers,
    status: 'idle',
  };

  const next = spend(state, cost);
  return {
    ok: true,
    state: {
      ...next,
      nextId: next.nextId + 1,
      crews: [...next.crews, crew],
      safehouses: next.safehouses.map((s) =>
        s.id === safehouseId ? { ...s, crewIds: [...s.crewIds, crew.id] } : s,
      ),
    },
    message: 'Formed a new crew.',
  };
}

/** Recruit a member of `roleId` into a crew's open slot. */
export function recruitMember(
  state: GameState,
  crewId: string,
  roleId: string,
  config: Config = CONFIG,
): ActionResult {
  const crew = getCrew(state, crewId);
  if (!crew) return { ok: false, error: 'Unknown crew.' };
  if (crew.status !== 'idle') return { ok: false, error: 'Cannot recruit into a crew on a job.' };
  if (crew.memberIds.length >= crew.maxMembers) {
    return { ok: false, error: 'That crew is full.' };
  }

  const role = ROLES_BY_ID[roleId];
  if (!role) return { ok: false, error: 'Unknown role.' };

  const cost = recruitCost(crew, roleId, config);
  if (state.cash < cost) return insufficient();

  const member: Member = {
    id: `m${state.nextId}`,
    name: pickUniqueName(state.nextId, state.members.map((m) => m.name)),
    role: roleId,
    skill: role.baseSkill,
    gearIds: [],
    traitId: traitForId(state.nextId),
  };

  const next = spend(state, cost);
  return {
    ok: true,
    state: {
      ...next,
      nextId: next.nextId + 1,
      members: [...next.members, member],
      crews: next.crews.map((c) =>
        c.id === crewId ? { ...c, memberIds: [...c.memberIds, member.id] } : c,
      ),
    },
    message: `Recruited a ${role.name}.`,
  };
}

/** Buy a piece of gear for a member (each gear can be owned once per member). */
export function buyGear(state: GameState, memberId: string, gearId: string): ActionResult {
  const member = getMember(state, memberId);
  if (!member) return { ok: false, error: 'Unknown member.' };

  const gear = GEAR_BY_ID[gearId];
  if (!gear) return { ok: false, error: 'Unknown gear.' };
  if (!gearAllowedForRole(gear, member.role)) {
    return { ok: false, error: `${gear.name} isn't for a ${member.role}.` };
  }
  if (member.gearIds.includes(gearId)) {
    return { ok: false, error: 'That member already owns this gear.' };
  }
  if (state.cash < gear.cost) return insufficient();

  const next = spend(state, gear.cost);
  return {
    ok: true,
    state: {
      ...next,
      members: next.members.map((m) =>
        m.id === memberId ? { ...m, gearIds: [...m.gearIds, gearId] } : m,
      ),
    },
    message: `Bought ${gear.name}.`,
  };
}

/** Upgrade a member's skill by one level. */
export function upgradeSkill(
  state: GameState,
  memberId: string,
  config: Config = CONFIG,
): ActionResult {
  const member = getMember(state, memberId);
  if (!member) return { ok: false, error: 'Unknown member.' };
  if (member.skill >= config.maxMemberSkill) {
    return { ok: false, error: 'That member is already at max skill.' };
  }

  const cost = skillUpgradeCost(member, config);
  if (state.cash < cost) return insufficient();

  const next = spend(state, cost);
  return {
    ok: true,
    state: {
      ...next,
      members: next.members.map((m) =>
        m.id === memberId ? { ...m, skill: m.skill + config.skillUpgradePerLevel } : m,
      ),
    },
    message: `${member.name} leveled up.`,
  };
}

/**
 * Retire the crew ("go legit"): wipe the operation for permanent Notoriety.
 * Career totals, contract progress, and milestones carry over.
 */
export function prestige(state: GameState, now: number, config: Config = CONFIG): ActionResult {
  if (state.lifetimeCash < config.prestigeThreshold) {
    return { ok: false, error: 'Not enough of a track record to retire yet.' };
  }
  const gain = notorietyGainFor(state.lifetimeCash, config);
  const fresh = createInitialState(now, config);
  const perks = state.perks;
  // Perk effects that shape the fresh run:
  const keepUpgrades = (perks['old_loyalties'] ?? 0) > 0;
  const warChest = (perks['war_chest'] ?? 0) * config.perkWarChestCash;
  return {
    ok: true,
    state: {
      ...fresh,
      cash: fresh.cash + warChest,
      purchasedUpgradeIds: keepUpgrades ? state.purchasedUpgradeIds : fresh.purchasedUpgradeIds,
      notoriety: state.notoriety + gain,
      prestigeCount: state.prestigeCount + 1,
      careerCash: state.careerCash,
      contractLevel: state.contractLevel,
      stats: state.stats,
      milestonesEarned: state.milestonesEarned,
      // The login streak is real-time, not run-scoped — keep it across prestige.
      dailyClaimDay: state.dailyClaimDay,
      dailyStreak: state.dailyStreak,
      // Premium currency and the perk tree persist across prestige.
      marks: state.marks,
      perks: state.perks,
    },
    message: `Went legit. +${gain} Notoriety (now ${state.notoriety + gain}).`,
  };
}

/** Spend Notoriety on the next level of a perk (see data/perks.ts). */
export function buyPerk(state: GameState, perkId: string): ActionResult {
  const perk = PERKS_BY_ID[perkId];
  if (!perk) return { ok: false, error: 'Unknown perk.' };
  const level = state.perks[perkId] ?? 0;
  if (level >= perk.maxLevel) return { ok: false, error: 'That perk is maxed.' };
  const cost = perkCost(perk, level + 1);
  if (state.notoriety < cost) return { ok: false, error: 'Not enough Notoriety.' };
  return {
    ok: true,
    state: {
      ...state,
      notoriety: state.notoriety - cost,
      perks: { ...state.perks, [perkId]: level + 1 },
    },
    message: `${perk.name} → level ${level + 1}.`,
  };
}

/** Purchase a one-time global upgrade. */
export function buyUpgrade(state: GameState, upgradeId: string): ActionResult {
  const up = UPGRADES_BY_ID[upgradeId];
  if (!up) return { ok: false, error: 'Unknown upgrade.' };
  if (state.purchasedUpgradeIds.includes(upgradeId)) {
    return { ok: false, error: 'Already purchased.' };
  }
  if (state.cash < up.cost) return insufficient();

  const next = spend(state, up.cost);
  return {
    ok: true,
    state: {
      ...next,
      purchasedUpgradeIds: [...next.purchasedUpgradeIds, upgradeId],
    },
    message: `Purchased ${up.name}.`,
  };
}
