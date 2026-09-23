// -----------------------------------------------------------------------------
// GLOBAL UPGRADES (Cash sinks with permanent, stacking effects)
// -----------------------------------------------------------------------------
// One-time purchases that tweak global multipliers. Effects of all purchased
// upgrades combine multiplicatively (see engine/selectors.ts).
//
//   heatGainMult      < 1 reduces heat gained from jobs (e.g. 0.85 = -15%)
//   heatCoolRateMult  > 1 speeds up heat cooldown (e.g. 1.5 = +50% faster)
//   payoutMult        > 1 increases cash payouts (e.g. 1.15 = +15%)
// -----------------------------------------------------------------------------

export type UpgradeId = string;

export interface UpgradeEffect {
  heatGainMult?: number;
  heatCoolRateMult?: number;
  payoutMult?: number;
  /** Enables the offline auto-collect/relaunch "Fixer". */
  autoCollect?: boolean;
}

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  description: string;
  cost: number;
  effect: UpgradeEffect;
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'burner_phones',
    name: 'Burner Phones',
    description: 'Harder to trace. -15% heat gained from every job.',
    cost: 800,
    effect: { heatGainMult: 0.85 },
  },
  {
    id: 'corrupt_official',
    name: 'Corrupt Official',
    description: 'Someone loses the paperwork. +50% heat cooldown speed.',
    cost: 1200,
    effect: { heatCoolRateMult: 1.5 },
  },
  {
    id: 'laundry',
    name: 'Money Laundering',
    description: 'Clean the take through a front. +15% cash payouts.',
    cost: 1500,
    effect: { payoutMult: 1.15 },
  },
  {
    id: 'safe_routes',
    name: 'Safe Routes',
    description: 'Planned escape corridors. Another -20% heat gained.',
    cost: 2200,
    effect: { heatGainMult: 0.8 },
  },
  {
    id: 'offshore_accounts',
    name: 'Offshore Accounts',
    description: 'Move the money quietly. +25% cash payouts.',
    cost: 45000,
    effect: { payoutMult: 1.25 },
  },
  {
    id: 'the_fixer',
    name: 'The Fixer',
    description: 'A trusted hand who works while you are away: auto-collects and re-runs each crew’s last job (up to the offline cap).',
    cost: 60000,
    effect: { autoCollect: true },
  },
];

export const UPGRADES_BY_ID: Record<UpgradeId, UpgradeDef> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
);
