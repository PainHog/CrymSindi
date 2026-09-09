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
  minCrewForHeist: number;

  maxHeat: number;
  heatCoolPerSec: number;
  offlineCapSec: number;

  // Per-member resolution model (see engine/resolution.ts).
  memberBaseChance: number;
  memberSkillWeight: number;
  memberDifficultyWeight: number;
  memberChanceMin: number;
  memberChanceMax: number;
  heatSuccessPenalty: number;
  baseRequiredPasses: number;
  difficultyPerRequiredPass: number;

  // Payout model: time-based base, scaled by success quality.
  payoutFloorFrac: number;
  perfectBonusMult: number;

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
  version: 2,
  saveKey: 'heist-crew-idle/save/v1',

  // ---- Starting conditions -------------------------------------------------
  startingCash: 350,
  startingHeat: 0,
  startingMemberSkill: 3, // skill of each free starting member
  crewMaxMembers: 8, // how many members a crew can hold
  minCrewForHeist: 3, // members required to launch any heist

  // ---- Heat (risk meter) ---------------------------------------------------
  maxHeat: 100, // heat is clamped to [0, maxHeat]
  heatCoolPerSec: 0.3, // base heat points that cool per real second (~5.5 min for a full bar)
  offlineCapSec: 12 * 60 * 60, // cap passive effects (heat cooldown) at 12 hours

  // ---- Per-member resolution model -----------------------------------------
  // Each member rolls once. Their pass chance:
  //   p = memberBaseChance + memberSkillWeight*effectiveSkill
  //       - memberDifficultyWeight*difficulty - heatSuccessPenalty*(heat/maxHeat)
  //   clamped to [memberChanceMin, memberChanceMax].
  // A heist succeeds if every required role has a member who passed AND the
  // number of passers reaches requiredPasses (below).
  memberBaseChance: 0.5,
  memberSkillWeight: 0.045,
  memberDifficultyWeight: 0.01,
  memberChanceMin: 0.05,
  memberChanceMax: 0.95,
  heatSuccessPenalty: 0.35, // at full heat, subtract this from each member's chance
  // requiredPasses = baseRequiredPasses + floor(difficulty / difficultyPerRequiredPass)
  // (this is why higher tiers need bigger crews).
  baseRequiredPasses: 2,
  difficultyPerRequiredPass: 18,

  // ---- Payout model --------------------------------------------------------
  // base = heist.payoutPerSec * durationSec. On success the take scales with
  // crew performance: payout = base * (payoutFloorFrac + (1-payoutFloorFrac)*quality)
  // where quality = fraction of the crew that passed. A flawless run (everyone
  // passed) multiplies the take by perfectBonusMult.
  payoutFloorFrac: 0.5,
  perfectBonusMult: 1.5,

  // ---- Economy: safehouses -------------------------------------------------
  // Cost to buy the next NEW safehouse = base * mult^(safehousesOwned - 1).
  newSafehouseBaseCost: 1500,
  newSafehouseCostMult: 4,

  // ---- Economy: crews ------------------------------------------------------
  // Cost to form the next NEW crew = base * mult^(crewsOwned - 1).
  newCrewBaseCost: 250,
  newCrewCostMult: 3,

  // ---- Economy: recruiting -------------------------------------------------
  // Cost to recruit into a crew = role.recruitCost * mult^(membersInThatCrew).
  recruitCostMultPerMember: 1.5,

  // ---- Economy: member skill upgrades --------------------------------------
  // Cost = base * mult^(currentSkill - startingMemberSkill).
  skillUpgradeBaseCost: 60,
  skillUpgradeCostMult: 1.5,
  skillUpgradePerLevel: 1, // skill gained per upgrade
  maxMemberSkill: 15,

  // ---- Progression gates ---------------------------------------------------
  // Map of heist tier -> lifetime cash (total ever earned) required to unlock.
  // Tier 1 is always unlocked. Add more entries to gate future tiers.
  tierUnlocks: { 2: 3000, 3: 20000, 4: 120000, 5: 600000 } as Record<number, number>,

  // ---- Client pacing (UI only, never the source of truth) ------------------
  autosaveIntervalMs: 15000,
  uiTickMs: 250,
};
