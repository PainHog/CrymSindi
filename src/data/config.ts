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
  failPayoutFrac: number;
  qualitySlack: number;

  // Prestige ("go legit") -> permanent Notoriety.
  prestigeThreshold: number; // lifetime cash needed before you can retire
  notorietyDivisor: number; // gain = floor(sqrt(lifetimeCash / this))
  // Notoriety is spent in a perk tree (see data/perks.ts). Per-level effects:
  perkReputationPct: number; // Reputation: +this payout multiplier per level
  perkConnectionsPower: number; // Connections: +this effective skill per level (all members)
  perkCleanHandsPct: number; // Clean Hands: +this to the heat cooldown rate per level
  perkWarChestCash: number; // War Chest: +this starting cash per level (applied at prestige)

  // Endgame repeatable "Syndicate Contract" (unlocks with tier 5).
  contractBaseDifficulty: number;
  contractDifficultyPerLevel: number;
  contractBasePayoutPerSec: number;
  contractPayoutGrowth: number; // payoutPerSec *= this each level (exponential take)
  contractDurationSec: number;
  contractHeatCost: number;
  contractFailHeatBonus: number;

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

  // Daily reward: reward = dailyRewardBase * (1 + dailyStreakBonus*(streakDay-1))
  // * (unlocked tier), so it stays relevant as the player progresses.
  dailyRewardBase: number;
  dailyStreakBonus: number;
  dailyStreakMax: number; // streak multiplier stops growing past this many days

  // Monetization ("Marks" premium currency). Plumbed, not wired to a store yet.
  marksPerAdReward: number; // Marks from a "free Marks" rewarded ad
  iapMarksGrant: number; // Marks from the (stubbed) in-app purchase
  finishAllMarksCost: number; // Marks to instantly finish all active heists

  autosaveIntervalMs: number;
  uiTickMs: number;
}

export const CONFIG: Config = {
  // Save format version. Bump this if you change the shape of GameState in a way
  // that would break old saves; mismatched saves are discarded on load.
  version: 3,
  saveKey: 'heist-crew-idle/save/v1',

  // ---- Starting conditions -------------------------------------------------
  startingCash: 350,
  startingHeat: 0,
  startingMemberSkill: 5, // skill of each free starting member
  crewMaxMembers: 8, // how many members a crew can hold
  minCrewForHeist: 3, // members required to launch any heist

  // ---- Heat (risk meter) ---------------------------------------------------
  maxHeat: 100, // heat is clamped to [0, maxHeat]
  heatCoolPerSec: 0.08, // base heat points that cool per real second (~21 min for a full bar) - persists across long jobs so chaining big scores actually raises standing heat
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
  memberDifficultyWeight: 0.02,
  memberChanceMin: 0.05,
  memberChanceMax: 0.97,
  heatSuccessPenalty: 0.35, // at full heat, subtract this from each member's chance
  // requiredPasses = baseRequiredPasses + floor(difficulty / difficultyPerRequiredPass)
  // (this is why higher tiers need bigger crews).
  baseRequiredPasses: 2,
  difficultyPerRequiredPass: 18,

  // ---- Payout model --------------------------------------------------------
  // base = heist.payoutPerSec * durationSec. On success the take scales with how
  // many members passed relative to (requiredPasses + qualitySlack), so bringing
  // MORE members never lowers the take - it only raises the floor and the odds.
  // A flawless run (everyone passed) multiplies the take by perfectBonusMult.
  // A FAILED run still salvages failPayoutFrac of the base (never a total $0 loss
  // on a long job) but adds fail heat.
  payoutFloorFrac: 0.35,
  perfectBonusMult: 1.75,
  failPayoutFrac: 0.2,
  qualitySlack: 3,

  // ---- Prestige / Notoriety ------------------------------------------------
  prestigeThreshold: 600000,
  notorietyDivisor: 2500,
  perkReputationPct: 0.05,
  perkConnectionsPower: 0.5,
  perkCleanHandsPct: 0.25,
  perkWarChestCash: 750,

  // ---- Endgame "Syndicate Contract" (repeatable, escalates) ----------------
  contractBaseDifficulty: 54,
  contractDifficultyPerLevel: 2,
  contractBasePayoutPerSec: 18,
  contractPayoutGrowth: 1.12, // exponential take growth per level cleared
  contractDurationSec: 20 * 60,
  contractHeatCost: 60,
  contractFailHeatBonus: 45,

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
  skillUpgradeBaseCost: 40,
  skillUpgradeCostMult: 1.25,
  skillUpgradePerLevel: 1, // skill gained per upgrade
  maxMemberSkill: 15,

  // ---- Progression gates ---------------------------------------------------
  // Map of heist tier -> lifetime cash (total ever earned) required to unlock.
  // Tier 1 is always unlocked. Add more entries to gate future tiers.
  tierUnlocks: { 2: 2000, 3: 30000, 4: 180000, 5: 1200000 } as Record<number, number>,

  // ---- Daily reward --------------------------------------------------------
  dailyRewardBase: 500,
  dailyStreakBonus: 0.5, // +50% of base per consecutive day
  dailyStreakMax: 7,

  // ---- Monetization (stubbed) ----------------------------------------------
  marksPerAdReward: 2,
  iapMarksGrant: 20,
  finishAllMarksCost: 1,

  // ---- Client pacing (UI only, never the source of truth) ------------------
  autosaveIntervalMs: 15000,
  uiTickMs: 250,
};
