// -----------------------------------------------------------------------------
// RECRUIT TIERS
// -----------------------------------------------------------------------------
// When hiring, you pick how green or seasoned the recruit is: a cheap rookie who
// learns on the job, or a pricier pro/elite who starts sharper. Data-only — the
// engine reads skillBonus (added to the role's base skill, clamped to the cap)
// and costMult (times the role's scaling recruit cost).
// -----------------------------------------------------------------------------

export type RecruitTierId = 'street' | 'pro' | 'elite';

export interface RecruitTierDef {
  id: RecruitTierId;
  name: string;
  blurb: string;
  /** Added to the role's base skill at hire (clamped to maxMemberSkill). */
  skillBonus: number;
  /** Multiplier on the role's (crew-size-scaled) recruit cost. */
  costMult: number;
}

export const RECRUIT_TIERS: RecruitTierDef[] = [
  { id: 'street', name: 'Street', blurb: 'Green and cheap — learns on the job.', skillBonus: 0, costMult: 1 },
  { id: 'pro', name: 'Pro', blurb: 'Seasoned. Starts sharper.', skillBonus: 3, costMult: 2.5 },
  { id: 'elite', name: 'Elite', blurb: 'The best money can buy.', skillBonus: 6, costMult: 6 },
];

export const RECRUIT_TIERS_BY_ID: Record<RecruitTierId, RecruitTierDef> = Object.fromEntries(
  RECRUIT_TIERS.map((t) => [t.id, t]),
) as Record<RecruitTierId, RecruitTierDef>;

export const DEFAULT_RECRUIT_TIER: RecruitTierId = 'street';

/** Resolve a tier id (or undefined) to its def, defaulting to Street. */
export function recruitTierFor(id: RecruitTierId | undefined): RecruitTierDef {
  return (id && RECRUIT_TIERS_BY_ID[id]) || RECRUIT_TIERS_BY_ID[DEFAULT_RECRUIT_TIER];
}
