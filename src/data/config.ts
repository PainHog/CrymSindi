// -----------------------------------------------------------------------------
// TUNING CONSTANTS
// -----------------------------------------------------------------------------
// Every knob that shapes the economy, difficulty, heat, and pacing lives here.
// Change numbers in this file to rebalance the game without touching logic/UI.
// -----------------------------------------------------------------------------

export interface Config {
  version: number;
  saveKey: string;

  startingCash: number;
  startingHeat: number;
  startingMemberSkill: number;
  crewMaxMembers: number;

  maxHeat: number;
  heatCoolPerSec: number;
  offlineCapSec: number;

  successBase: number;
  successSlope: number;
  successMin: number;
  successMax: number;
  heatSuccessPenalty: number;

  newSafehouseBaseCost: number;
  newSafehouseCostMult: number;

  newCrewBaseCost: number;
  newCrewCostMult: number;

  recruitCostMultPerMember: number;

  skillUpgradeBaseCost: number;
  skillUpgradeCostMult: number;
  skillUpgradePerLevel: number;
  maxMemberSkill: number;

  tierUnlocks: Record<number, number>;

  autosaveIntervalMs: number;
  uiTickMs: number;
}

export const CONFIG: Config = {
  // Save format version. Bump this if you change the shape of GameState in a way
  // that would break old saves; mismatched saves are discarded on load.
  version: 1,
  saveKey: 'heist-crew-idle/save/v1',

  // ---- Starting conditions -------------------------------------------------
  startingCash: 300,
  startingHeat: 0,
  startingMemberSkill: 3, // skill of the free starting member
  crewMaxMembers: 3, // how many members a crew can hold

  // ---- Heat (risk meter) ---------------------------------------------------
  maxHeat: 100, // heat is clamped to [0, maxHeat]
  heatCoolPerSec: 0.6, // base heat points that cool per real second
  offlineCapSec: 8 * 60 * 60, // cap passive effects (heat cooldown) at 8 hours

  // ---- Success-chance model ------------------------------------------------
  // chance = successBase + successSlope * (crewPower - difficulty)
  //          - heatSuccessPenalty * (heat / maxHeat)
  // then clamped to [successMin, successMax].
  successBase: 0.55,
  successSlope: 0.02, // per point of (crewPower - difficulty)
  successMin: 0.05,
  successMax: 0.97,
  heatSuccessPenalty: 0.25, // at full heat, subtract up to this from the chance

  // ---- Economy: safehouses -------------------------------------------------
  // Cost to buy the next NEW safehouse = base * mult^(safehousesOwned - 1).
  newSafehouseBaseCost: 1500,
  newSafehouseCostMult: 4,

  // ---- Economy: crews ------------------------------------------------------
  // Cost to form the next NEW crew = base * mult^(crewsOwned - 1).
  newCrewBaseCost: 400,
  newCrewCostMult: 3,

  // ---- Economy: recruiting -------------------------------------------------
  // Cost to recruit into a crew = role.recruitCost * mult^(membersInThatCrew).
  recruitCostMultPerMember: 1.8,

  // ---- Economy: member skill upgrades --------------------------------------
  // Cost = base * mult^(currentSkill - startingMemberSkill).
  skillUpgradeBaseCost: 60,
  skillUpgradeCostMult: 1.5,
  skillUpgradePerLevel: 1, // skill gained per upgrade
  maxMemberSkill: 15,

  // ---- Progression gates ---------------------------------------------------
  // Map of heist tier -> lifetime cash (total ever earned) required to unlock.
  // Tier 1 is always unlocked. Add more entries to gate future tiers.
  tierUnlocks: { 2: 3000 } as Record<number, number>,

  // ---- Client pacing (UI only, never the source of truth) ------------------
  autosaveIntervalMs: 15000,
  uiTickMs: 250,
};
