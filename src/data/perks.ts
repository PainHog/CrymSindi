// -----------------------------------------------------------------------------
// NOTORIETY PERKS (ascension / prestige tree)
// -----------------------------------------------------------------------------
// Notoriety earned by retiring is spent here on permanent perks that persist
// across every future prestige. This is the reason to prestige repeatedly:
// allocate points across income, crew power, and utility. Per-level effect
// magnitudes live in CONFIG (data-driven); this file is the catalog + costs.
// -----------------------------------------------------------------------------

export type PerkId = string;

export interface PerkDef {
  id: PerkId;
  name: string;
  description: string;
  maxLevel: number;
  /** Notoriety cost of level 1. */
  baseCost: number;
  /** Cost of level n = round(baseCost * costGrowth^(n-1)). */
  costGrowth: number;
}

export const PERKS: PerkDef[] = [
  {
    id: 'reputation',
    name: 'Reputation',
    description: 'Every job pays more. +5% take per level.',
    maxLevel: 20,
    baseCost: 1,
    costGrowth: 1.2,
  },
  {
    id: 'connections',
    name: 'Connections',
    description: 'The whole crew works sharper. +0.5 effective skill (all members) per level.',
    maxLevel: 20,
    baseCost: 1,
    costGrowth: 1.2,
  },
  {
    id: 'clean_hands',
    name: 'Clean Hands',
    description: 'Heat fades faster. +25% cooldown rate per level.',
    maxLevel: 4,
    baseCost: 3,
    costGrowth: 1.6,
  },
  {
    id: 'war_chest',
    name: 'War Chest',
    description: 'Start every new run with more cash. +$750 per level.',
    maxLevel: 6,
    baseCost: 2,
    costGrowth: 1.5,
  },
  {
    id: 'old_loyalties',
    name: 'Old Loyalties',
    description: 'Keep your purchased upgrades when you go legit. No more rebuying the Fixer.',
    maxLevel: 1,
    baseCost: 8,
    costGrowth: 1,
  },
];

export const PERKS_BY_ID: Record<PerkId, PerkDef> = Object.fromEntries(
  PERKS.map((p) => [p.id, p]),
);

/** Notoriety cost to buy `nextLevel` (1-indexed) of a perk. */
export function perkCost(perk: PerkDef, nextLevel: number): number {
  return Math.round(perk.baseCost * Math.pow(perk.costGrowth, nextLevel - 1));
}
