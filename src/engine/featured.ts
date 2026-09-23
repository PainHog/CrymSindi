// -----------------------------------------------------------------------------
// FEATURED JOBS (hourly rotation, layered on the catalog)
// -----------------------------------------------------------------------------
// A curated set of catalog heists is "featured" each rotation and pays a bonus
// while it is. The selection is a PURE function of the rotation index (derived
// from the timestamp), so it's the same for every client and fully testable —
// no state is stored for it. The bonus a launched job actually gets is locked in
// at launch (see ActiveHeist.featuredMult) so a rotation mid-job can't change it.
// -----------------------------------------------------------------------------

import { CONFIG } from '../data/config';
import type { Config } from '../data/config';
import { HEISTS } from '../data/heists';
import type { HeistId } from '../data/heists';
import { makeRng } from './resolution';

export interface FeaturedEntry {
  heistId: HeistId;
  /** Payout multiplier while featured (>1). */
  bonusMult: number;
}

/** The rotation index for a timestamp (which "hour" of featured jobs we're in). */
export function featuredRotationIndex(now: number, config: Config = CONFIG): number {
  return Math.floor(now / (config.featuredRotationSec * 1000));
}

/** Ms until the next rotation flips (for a "next drop" countdown). */
export function msUntilNextRotation(now: number, config: Config = CONFIG): number {
  const period = config.featuredRotationSec * 1000;
  return period - (now % period);
}

/** The featured heists for a given rotation index — deterministic and pure. */
export function featuredForRotation(index: number, config: Config = CONFIG): FeaturedEntry[] {
  const rnd = makeRng((index * 0x9e3779b1) >>> 0);
  const ids = HEISTS.map((h) => h.id);
  // Fisher–Yates with the seeded rng (deterministic across engines, unlike a
  // comparator-based shuffle whose call count varies by sort implementation).
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const n = Math.min(config.featuredCount, ids.length);
  const span = config.featuredBonusMax - config.featuredBonusMin;
  const out: FeaturedEntry[] = [];
  for (let k = 0; k < n; k++) {
    const bonus = config.featuredBonusMin + rnd() * span;
    out.push({ heistId: ids[k], bonusMult: Math.round(bonus * 100) / 100 });
  }
  return out;
}

/** The featured heists right now. */
export function featuredNow(now: number, config: Config = CONFIG): FeaturedEntry[] {
  return featuredForRotation(featuredRotationIndex(now, config), config);
}

/** The payout multiplier a heist would get if launched now (1 if not featured). */
export function featuredBonusFor(heistId: string, now: number, config: Config = CONFIG): number {
  const entry = featuredNow(now, config).find((f) => f.heistId === heistId);
  return entry ? entry.bonusMult : 1;
}
