// -----------------------------------------------------------------------------
// MILESTONES (career achievements)
// -----------------------------------------------------------------------------
// Metadata only - the condition for each id lives in engine/milestones.ts.
// Milestones persist across prestige and give small one-time rewards, so there's
// always a short-horizon goal between the big unlocks.
// -----------------------------------------------------------------------------

export interface MilestoneReward {
  cash?: number;
  notoriety?: number;
}

export interface MilestoneDef {
  id: string;
  name: string;
  description: string;
  reward?: MilestoneReward;
}

export const MILESTONES: MilestoneDef[] = [
  { id: 'first_score', name: 'First Score', description: 'Pull off your first successful heist.', reward: { cash: 250 } },
  { id: 'warmup', name: 'Warming Up', description: 'Complete 10 heists.', reward: { cash: 1500 } },
  { id: 'pro', name: 'Professionals', description: 'Complete 50 heists.', reward: { cash: 8000 } },
  { id: 'flawless5', name: 'Flawless Operator', description: 'Pull 5 flawless runs.', reward: { cash: 4000 } },
  { id: 'full_house', name: 'Full House', description: 'Field a crew of 8 members.', reward: { cash: 4000 } },
  { id: 'syndicate', name: 'Syndicate', description: 'Run 3 crews at once.', reward: { cash: 6000 } },
  { id: 'high_roller', name: 'High Roller', description: 'Land a single score of $50,000+.', reward: { notoriety: 2 } },
  { id: 'top_brass', name: 'Top Brass', description: 'Unlock the tier-5 heist.', reward: { notoriety: 3 } },
  { id: 'contractor', name: 'Contractor', description: 'Clear a Syndicate Contract.', reward: { cash: 15000 } },
  { id: 'gone_legit', name: 'Gone Legit', description: 'Retire a crew for Notoriety.', reward: { cash: 10000 } },
  { id: 'millionaire', name: 'Millionaire', description: 'Earn $1,000,000 across your career.', reward: { notoriety: 4 } },
  { id: 'kingpin', name: 'Kingpin', description: 'Earn $10,000,000 across your career.', reward: { notoriety: 12 } },
];

export const MILESTONES_BY_ID: Record<string, MilestoneDef> = Object.fromEntries(
  MILESTONES.map((m) => [m.id, m]),
);
