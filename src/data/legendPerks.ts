// -----------------------------------------------------------------------------
// LEGEND PERKS (second-tier ascension tree)
// -----------------------------------------------------------------------------
// Legend is the second meta-currency, above Notoriety. You earn it by ASCENDING
// (see engine/economy.ts `ascend`): burning your Notoriety and the whole
// Notoriety perk tree for permanent Legend that buys these stronger perks. Legend
// and this tree persist across ascension, so each ascension cycle starts the
// Notoriety loop over but with a bigger permanent floor. Per-level magnitudes
// live in CONFIG; this file is the catalog + costs (mirrors data/perks.ts).
// -----------------------------------------------------------------------------

export type LegendPerkId = string;

export interface LegendPerkDef {
  id: LegendPerkId;
  name: string;
  description: string;
  maxLevel: number;
  /** Legend cost of level 1. */
  baseCost: number;
  /** Cost of level n = round(baseCost * costGrowth^(n-1)). */
  costGrowth: number;
}

export const LEGEND_PERKS: LegendPerkDef[] = [
  {
    id: 'kingpin',
    name: 'Kingpin',
    description: 'Your name alone moves product. +10% take on every job, per level.',
    maxLevel: 10,
    baseCost: 1,
    costGrowth: 1.5,
  },
  {
    id: 'rep_engine',
    name: 'Reputation Engine',
    description: 'Notoriety comes faster every run. +10% Notoriety on retirement, per level.',
    maxLevel: 10,
    baseCost: 1,
    costGrowth: 1.5,
  },
  {
    id: 'deep_pockets',
    name: 'Deep Pockets',
    description: 'Start every new run flush. +$5,000 starting cash per level.',
    maxLevel: 5,
    baseCost: 1,
    costGrowth: 1.6,
  },
];

export const LEGEND_PERKS_BY_ID: Record<LegendPerkId, LegendPerkDef> = Object.fromEntries(
  LEGEND_PERKS.map((p) => [p.id, p]),
);

/** Legend cost to buy `nextLevel` (1-indexed) of a legend perk. */
export function legendPerkCost(perk: LegendPerkDef, nextLevel: number): number {
  return Math.round(perk.baseCost * Math.pow(perk.costGrowth, nextLevel - 1));
}
