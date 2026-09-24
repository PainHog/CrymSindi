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

  // Crew injuries: a blown job can sideline a member (never the last healthy one).
  injuryChanceBase: number; // base chance a failed job hurts a member
  injuryChanceHeatMax: number; // extra chance added at full heat (scaled by heat/maxHeat)
  injuryRecoverySec: number; // real seconds a hurt member sits out before auto-recovery
  injuryHealBaseCost: number; // cash to patch a member up immediately (flat part)
  injuryHealPerSkill: number; // + this per point of the member's skill

  // Prep ("case the job"): a per-launch cash spend that lifts each member's odds.
  prepOddsBonus: number; // flat pass-chance added to every member this run
  prepCostFrac: number; // prep cost = this * (payoutPerSec * durationSec)

  // Featured jobs: a curated set of catalog heists that rotate on a timer and pay
  // a bonus while featured. Deterministic from the rotation index (pure/testable).
  featuredCount: number; // how many heists are featured each rotation
  featuredRotationSec: number; // rotation period (real seconds)
  featuredBonusMin: number; // payout multiplier range while featured
  featuredBonusMax: number;

  // Living-map events: a time-boxed condition (a fence in town, a crackdown, ...)
  // that alters specific jobs' take/odds/heat while it runs. Like featured, it's a
  // PURE function of the window index (deterministic/testable, no stored state).
  eventWindowSec: number; // event window length (real seconds) - off the featured clock
  eventChance: number; // fraction of windows that actually run an event (0..1)
  eventTargetsMax: number; // how many specific jobs one event hits

  // Rival Syndicate: a rival crew stakes a claim on one specific job each contest
  // window. Beat them to it (complete it successfully before the window closes) to
  // seize the turf for cash spoils + a turf-win tally. Deterministic from the
  // window index (pure/testable), on its own clock.
  rivalWindowSec: number; // contest window length (real seconds)
  rivalChance: number; // fraction of windows that run a contest (0..1)
  rivalSpoilsFrac: number; // seize bonus = this * the job's take (extra cash)

  // Prestige ("go legit") -> permanent Notoriety.
  prestigeThreshold: number; // lifetime cash needed before you can retire
  notorietyDivisor: number; // gain = floor(sqrt(lifetimeCash / this))

  // Ascension ("become a legend") -> permanent Legend, a second meta layer above
  // Notoriety. Ascending burns Notoriety + the Notoriety perk tree for Legend,
  // which buys the (stronger) legend perks that persist across ascension.
  ascendThreshold: number; // Notoriety needed before you can ascend
  legendDivisor: number; // Legend gain = floor(sqrt(notoriety / this))
  legendKingpinPct: number; // Kingpin: +this payout multiplier per level
  legendRepEnginePct: number; // Reputation Engine: +this Notoriety-gain multiplier per level
  legendDeepPocketsCash: number; // Deep Pockets: +this starting cash per level

  // Crew veterancy: members earn XP per job and level up for a small permanent
  // effective-skill bonus (attachment — your long-serving crew get better).
  veteranXpBase: number; // level = min(max, floor(sqrt(xp / this)))
  veteranMaxLevel: number; // level cap
  veteranSkillPerLevel: number; // +effective skill per veteran level
  xpPerHeistBase: number; // base XP a participant earns per collected job
  xpPerDifficulty: number; // + this * heist.difficulty
  xpSuccessMult: number; // XP multiplier on a successful run
  xpFlawlessMult: number; // ...on a flawless run
  xpFailMult: number; // ...on a blown run (still some XP for showing up)
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

  // ---- Crew injuries -------------------------------------------------------
  // On a FAILED collect, chance = injuryChanceBase + injuryChanceHeatMax*(heat/maxHeat)
  // to sideline one member who blew their part (never the crew's last healthy
  // member). They sit out injuryRecoverySec of real time, or pay to patch up.
  injuryChanceBase: 0.15,
  injuryChanceHeatMax: 0.35, // 15% at zero heat up to 50% at max heat
  injuryRecoverySec: 180, // ~3 minutes benched
  injuryHealBaseCost: 200,
  injuryHealPerSkill: 60,

  // ---- Prep ("case the job") -----------------------------------------------
  prepOddsBonus: 0.12, // +12% pass chance per member for the cased run
  prepCostFrac: 0.15, // costs 15% of the job's base take to case it

  // ---- Featured jobs (hourly rotation) -------------------------------------
  featuredCount: 3,
  featuredRotationSec: 3600, // a fresh set every hour
  featuredBonusMin: 1.25, // +25%..+60% take while featured
  featuredBonusMax: 1.6,

  // ---- Living-map events ---------------------------------------------------
  eventWindowSec: 2700, // 45-min windows (deliberately off the 60-min featured clock)
  eventChance: 0.6, // ~60% of windows run an event; the rest are quiet
  eventTargetsMax: 2, // an event flags up to this many specific jobs

  // ---- Rival Syndicate (turf contests) -------------------------------------
  rivalWindowSec: 1800, // 30-min contest windows (off the featured/event clocks)
  rivalChance: 0.5, // ~half the windows run a contest; the rest are quiet
  rivalSpoilsFrac: 0.5, // seize a contested job -> +50% of the take as spoils

  // ---- Prestige / Notoriety ------------------------------------------------
  // Must sit at/above the tier-5 unlock (tierUnlocks[5]) so "going legit" is
  // gated behind actually reaching the capstone you retire on — otherwise the
  // concave notoriety curve makes retiring early optimal and the tier-5 content
  // never gets played. Set a touch above the unlock so a capstone score lands
  // first.
  prestigeThreshold: 1500000,
  notorietyDivisor: 2500,
  perkReputationPct: 0.05,
  perkConnectionsPower: 0.5,
  perkCleanHandsPct: 0.25,
  perkWarChestCash: 750,

  // ---- Ascension / Legend --------------------------------------------------
  // ~75 Notoriety takes a few prestige cycles to reach; the sqrt curve then
  // yields ~1-2 Legend per ascension early, scaling slowly. Legend perks are
  // roughly 2x a Notoriety perk's magnitude to justify the deeper reset.
  ascendThreshold: 75,
  legendDivisor: 40,
  legendKingpinPct: 0.1,
  legendRepEnginePct: 0.1,
  legendDeepPocketsCash: 5000,

  // ---- Crew veterancy ------------------------------------------------------
  // level 1 after ~2 early jobs; ~100+ jobs to max a member at +3 skill (a long
  // attachment arc, a separate axis from the trainable skill cap of 15).
  veteranXpBase: 20,
  veteranMaxLevel: 10,
  veteranSkillPerLevel: 0.3,
  xpPerHeistBase: 8,
  xpPerDifficulty: 0.5,
  xpSuccessMult: 1.0,
  xpFlawlessMult: 1.6,
  xpFailMult: 0.35,

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
