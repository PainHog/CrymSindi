// -----------------------------------------------------------------------------
// SAFEHOUSES
// -----------------------------------------------------------------------------
// A safehouse is the top-level capacity unit: it holds a limited number of crew
// slots. Tiers form an upgrade chain - upgrading a safehouse raises its crew
// capacity. Buying a brand-new safehouse always starts at the first tier.
//
// The per-safehouse "buy a new one" cost is computed in the engine from
// CONFIG.newSafehouseBaseCost/Mult; the `upgradeCost` here is what it costs to
// raise an EXISTING safehouse from the previous tier to this one.
// -----------------------------------------------------------------------------

export type SafehouseTierId = string;

export interface SafehouseTier {
  id: SafehouseTierId;
  name: string;
  /** Number of crew slots a safehouse of this tier provides. */
  crewSlots: number;
  /** Cash cost to upgrade an existing safehouse from the previous tier to this
   *  one. Ignored for the first tier (new safehouses start there). */
  upgradeCost: number;
}

// Ordered chain: index N upgrades to index N+1.
export const SAFEHOUSE_TIERS: SafehouseTier[] = [
  { id: 'lockup', name: 'Backstreet Lockup', crewSlots: 1, upgradeCost: 0 },
  { id: 'warehouse', name: 'Riverside Warehouse', crewSlots: 2, upgradeCost: 400 },
  { id: 'compound', name: 'Fortified Compound', crewSlots: 3, upgradeCost: 3000 },
];

export const SAFEHOUSE_TIERS_BY_ID: Record<SafehouseTierId, SafehouseTier> =
  Object.fromEntries(SAFEHOUSE_TIERS.map((t) => [t.id, t]));

/** Index of a tier in the upgrade chain (-1 if unknown). */
export function safehouseTierIndex(tierId: SafehouseTierId): number {
  return SAFEHOUSE_TIERS.findIndex((t) => t.id === tierId);
}
