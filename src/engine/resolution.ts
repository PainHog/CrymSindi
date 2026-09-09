// -----------------------------------------------------------------------------
// HEIST RESOLUTION (per-member checks + after-action report)
// -----------------------------------------------------------------------------
// Each member on a heist rolls once against the job's difficulty. The heist
// succeeds if every required role has a member who passed AND the number of
// passers reaches requiredPasses (which grows with difficulty - that's why
// higher tiers need bigger crews). The take is time-based and scales with how
// many passed; a flawless run pays a bonus.
//
// resolveHeist() also produces the play-by-play: a per-member beat, the factors
// that drove the outcome, and concrete recommendations for where to invest.
// All randomness is injected via `rng` so the whole thing is deterministic.
// -----------------------------------------------------------------------------

import { CONFIG } from '../data/config';
import type { Config } from '../data/config';
import { GEAR } from '../data/gear';
import type { HeistDef } from '../data/heists';
import { ROLES_BY_ID } from '../data/roles';
import type { RoleId } from '../data/roles';
import {
  clamp,
  crewPower,
  deriveHeat,
  getMember,
  heatGainMult,
  memberEffectiveSkill,
  payoutMult,
} from './selectors';
import type {
  BeatQuality,
  Crew,
  GameState,
  HeistFactor,
  HeistReport,
  MemberBeat,
  Recommendation,
} from './types';

// ---- Core numbers -----------------------------------------------------------

/** A single member's chance to clear their part of a job. */
export function memberPassChance(
  effectiveSkill: number,
  difficulty: number,
  heat: number,
  config: Config = CONFIG,
): number {
  const heatDrag = config.heatSuccessPenalty * (heat / config.maxHeat);
  const p =
    config.memberBaseChance +
    config.memberSkillWeight * effectiveSkill -
    config.memberDifficultyWeight * difficulty -
    heatDrag;
  return clamp(p, config.memberChanceMin, config.memberChanceMax);
}

/** How many members must pass for a job of this difficulty (never above the
 *  crew-size cap, so a job can't become unwinnable-by-construction). */
export function requiredPassesFor(heist: HeistDef, config: Config = CONFIG): number {
  const raw = config.baseRequiredPasses + Math.floor(heist.difficulty / config.difficultyPerRequiredPass);
  return Math.min(raw, config.crewMaxMembers);
}

/** Deterministic PRNG (mulberry32) from a 32-bit seed. Used so a heist's outcome
 *  is fixed at launch time - keeps collect resolution pure and closes the
 *  reload-to-reroll exploit. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Minimum crew size to even attempt a job (roles + passes + global floor). */
export function minMembersFor(heist: HeistDef, config: Config = CONFIG): number {
  return Math.max(
    config.minCrewForHeist,
    heist.requiredRoles.length,
    requiredPassesFor(heist, config),
  );
}

// ---- Preview estimate (honest, from the per-member model) -------------------

/** Distribution tail P(successes >= k) for independent Bernoulli(ps) (DP). */
function poissonBinomialAtLeast(ps: number[], k: number): number {
  let dist = [1];
  for (const p of ps) {
    const next = new Array(dist.length + 1).fill(0);
    for (let i = 0; i < dist.length; i++) {
      next[i] += dist[i] * (1 - p);
      next[i + 1] += dist[i] * p;
    }
    dist = next;
  }
  let tail = 0;
  for (let i = Math.max(0, k); i < dist.length; i++) tail += dist[i];
  return clamp(tail, 0, 1);
}

/**
 * Estimated success probability for the assign/launch preview. Combines the
 * chance of hitting requiredPasses with the chance every required role is
 * covered. An approximation (the two aren't independent), good enough to guide
 * the player.
 */
export function estimateSuccess(
  state: GameState,
  heist: HeistDef,
  crew: Crew,
  now: number,
  config: Config = CONFIG,
): number {
  const members = crew.memberIds
    .map((id) => getMember(state, id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));
  if (members.length < minMembersFor(heist, config)) return 0;

  const heat = deriveHeat(state, now, config);
  const per = members.map((m) => ({
    role: m.role,
    p: memberPassChance(memberEffectiveSkill(m), heist.difficulty, heat, config),
  }));

  const pCount = poissonBinomialAtLeast(per.map((x) => x.p), requiredPassesFor(heist, config));

  let pRoles = 1;
  for (const role of heist.requiredRoles) {
    const ofRole = per.filter((x) => x.role === role);
    if (ofRole.length === 0) return 0;
    const noneP = ofRole.reduce((a, x) => a * (1 - x.p), 1);
    pRoles *= 1 - noneP;
  }
  return clamp(pCount * pRoles, 0, 1);
}

// ---- Narrative helpers ------------------------------------------------------

interface RoleBeat {
  pass: string;
  fail: string;
  slip: string;
}
const ROLE_BEATS: Record<string, RoleBeat> = {
  hacker: {
    pass: 'cut the alarms and cameras clean',
    fail: 'tripped an alarm they could not kill',
    slip: 'nearly locked the systems down, then lost the thread',
  },
  muscle: {
    pass: 'forced the doors and kept everyone in line',
    fail: 'lost control once it got physical',
    slip: 'held the room, but only just',
  },
  driver: {
    pass: 'held the route and the timing',
    fail: 'blew the timing on the getaway',
    slip: 'kept the car close, but the timing wobbled',
  },
  lookout: {
    pass: 'called every move a beat early',
    fail: 'missed a patrol until it was almost on them',
    slip: 'caught the patrol late, but caught it',
  },
};
function roleBeat(role: RoleId): RoleBeat {
  return (
    ROLE_BEATS[role] ?? {
      pass: 'did their part clean',
      fail: 'fumbled their part',
      slip: 'scraped through their part',
    }
  );
}
function roleName(role: RoleId): string {
  return ROLES_BY_ID[role]?.name ?? role;
}

function classify(passed: boolean, margin: number): BeatQuality {
  if (passed) return margin >= 0.35 ? 'flawless' : 'clean';
  return -margin <= 0.12 ? 'shaky' : 'botched';
}

function beatDetail(
  name: string,
  role: RoleId,
  quality: BeatQuality,
  effectiveSkill: number,
  difficulty: number,
  heatHigh: boolean,
): string {
  const b = roleBeat(role);
  switch (quality) {
    case 'flawless':
      return `${name} ${b.pass} — flawless.`;
    case 'clean':
      return `${name} ${b.pass}.`;
    case 'shaky': {
      const why = heatHigh ? ' The heat nearly cost them.' : '';
      return `${name} ${b.slip} — but missed the mark.${why}`;
    }
    case 'botched': {
      let why = '';
      if (effectiveSkill * 2 < difficulty) why = ` Skill ${effectiveSkill} is thin for a difficulty-${difficulty} job.`;
      else if (heatHigh) why = ' The heat rattled them.';
      return `${name} ${b.fail}.${why}`;
    }
  }
}

// ---- Full resolution --------------------------------------------------------

export function resolveHeist(
  state: GameState,
  heist: HeistDef,
  crew: Crew,
  now: number,
  rng: () => number = Math.random,
  config: Config = CONFIG,
): HeistReport {
  const heat = deriveHeat(state, now, config);
  const heatHigh = heat >= config.maxHeat * 0.4;
  const members = crew.memberIds
    .map((id) => getMember(state, id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  // Per-member checks (one rng() per member, in crew order).
  const beats: MemberBeat[] = members.map((m) => {
    const eff = memberEffectiveSkill(m);
    const chance = memberPassChance(eff, heist.difficulty, heat, config);
    const roll = rng();
    const passed = roll < chance;
    const quality = classify(passed, chance - roll);
    return {
      memberId: m.id,
      name: m.name,
      role: m.role,
      effectiveSkill: eff,
      gearIds: m.gearIds,
      passed,
      roll,
      chance,
      quality,
      detail: beatDetail(m.name, m.role, quality, eff, heist.difficulty, heatHigh),
    };
  });

  const crewSize = beats.length;
  const passCount = beats.filter((b) => b.passed).length;
  const requiredPasses = requiredPassesFor(heist, config);

  // Required-role coverage: each required role needs at least one passer.
  const missingRoleCoverage: RoleId[] = heist.requiredRoles.filter(
    (role) => !beats.some((b) => b.role === role && b.passed),
  );

  const rolesOk = missingRoleCoverage.length === 0;
  const countOk = passCount >= requiredPasses;
  const success = crewSize > 0 && rolesOk && countOk;
  const quality = crewSize > 0 ? passCount / crewSize : 0;
  const perfect = success && passCount === crewSize;

  // Time-based take. On success it scales with passers relative to
  // (requiredPasses + slack) - a denominator independent of crew size, so
  // bringing MORE members never lowers the take. A flawless run pays a bonus; a
  // blown run still salvages a fraction of the base for the time invested.
  const base = heist.payoutPerSec * heist.durationSec;
  const mult = payoutMult(state);
  let payout = 0;
  let perfectBonus = 0;
  if (success) {
    const target = requiredPasses + config.qualitySlack;
    const takeFrac = config.payoutFloorFrac + (1 - config.payoutFloorFrac) * clamp(passCount / target, 0, 1);
    payout = Math.round(base * takeFrac * mult);
    if (perfect) {
      const before = payout;
      payout = Math.round(payout * config.perfectBonusMult);
      perfectBonus = payout - before;
    }
  } else {
    payout = Math.round(base * config.failPayoutFrac * mult);
  }
  const heatAdded = success ? 0 : heist.failHeatBonus * heatGainMult(state);

  const report: HeistReport = {
    heistId: heist.id,
    heistName: heist.name,
    crewId: crew.id,
    crewLabelIndex: state.crews.findIndex((c) => c.id === crew.id),
    success,
    perfect,
    headline: perfect
      ? `FLAWLESS — ${heist.name}`
      : success
        ? `SUCCESS — ${heist.name}`
        : `BLOWN — ${heist.name}`,
    turningPoint: turningPoint(beats, missingRoleCoverage, passCount, requiredPasses, success, perfect),
    passCount,
    crewSize,
    requiredPasses,
    quality,
    payout,
    perfectBonus,
    heatAdded,
    difficulty: heist.difficulty,
    crewPower: crewPower(state, crew),
    heatAtResolve: heat,
    members: beats,
    missingRoleCoverage,
    factors: buildFactors(beats, heist, heat, passCount, requiredPasses, missingRoleCoverage, perfect, perfectBonus, config),
    recommendations: buildRecommendations(beats, heat, passCount, requiredPasses, missingRoleCoverage, success, perfect, crewSize, config),
  };
  return report;
}

function turningPoint(
  beats: MemberBeat[],
  missing: RoleId[],
  passCount: number,
  requiredPasses: number,
  success: boolean,
  perfect: boolean,
): string {
  if (perfect) return 'Every member delivered. Nothing to fix.';
  if (success) {
    const best = [...beats].filter((b) => b.passed).sort((a, b) => b.chance - b.roll - (a.chance - a.roll))[0];
    return best ? `${best.name} carried it — ${roleBeat(best.role).pass}.` : 'The crew got it done.';
  }
  if (missing.length > 0) {
    return `A ${roleName(missing[0])} blew their part with no backup — that sank the job.`;
  }
  return `Only ${passCount} of ${requiredPasses} needed pulled their weight — not enough hands held.`;
}

function buildFactors(
  beats: MemberBeat[],
  heist: HeistDef,
  heat: number,
  passCount: number,
  requiredPasses: number,
  missing: RoleId[],
  perfect: boolean,
  perfectBonus: number,
  config: Config,
): HeistFactor[] {
  const factors: HeistFactor[] = [];
  const avgChance = beats.length ? beats.reduce((a, b) => a + b.chance, 0) / beats.length : 0;

  factors.push({
    label: 'Crew skill vs difficulty',
    positive: avgChance >= 0.5,
    note: `Each member averaged a ${Math.round(avgChance * 100)}% chance against difficulty ${heist.difficulty}.`,
  });

  factors.push({
    label: 'Hands on the job',
    positive: passCount >= requiredPasses,
    note: `${passCount} of ${beats.length} passed; ${requiredPasses} needed.`,
  });

  if (heat > 5) {
    const dragPct = Math.round(config.heatSuccessPenalty * (heat / config.maxHeat) * 100);
    factors.push({
      label: 'Heat',
      positive: false,
      note: `Heat at ${Math.round(heat)} shaved ~${dragPct}% off every member's odds.`,
    });
  }

  if (missing.length > 0) {
    factors.push({
      label: 'Role coverage',
      positive: false,
      note: `No one covered: ${missing.map(roleName).join(', ')}.`,
    });
  } else if (heist.requiredRoles.length > 0) {
    factors.push({ label: 'Role coverage', positive: true, note: 'Every required role had a passer.' });
  }

  if (perfect) {
    factors.push({
      label: 'Flawless bonus',
      positive: true,
      note: `Everyone delivered — +$${perfectBonus.toLocaleString()} bonus.`,
    });
  }
  return factors;
}

function buildRecommendations(
  beats: MemberBeat[],
  heat: number,
  passCount: number,
  requiredPasses: number,
  missing: RoleId[],
  success: boolean,
  perfect: boolean,
  crewSize: number,
  config: Config,
): Recommendation[] {
  const recs: Recommendation[] = [];

  // 1. Uncovered required roles - bring a backup of that role.
  for (const role of missing) {
    recs.push({
      kind: 'role',
      text: `Bring another ${roleName(role)} for backup — your only ${roleName(role)} botched with no one to cover.`,
    });
  }

  // 2. Not enough passers - grow the crew.
  if (passCount < requiredPasses && crewSize < config.crewMaxMembers) {
    recs.push({
      kind: 'crewSize',
      text: `Add members — this job needs ${requiredPasses} clean and your crew managed ${passCount}.`,
    });
  }

  // 3. Weakest link that failed - train / gear them.
  const failers = beats.filter((b) => !b.passed).sort((a, b) => a.effectiveSkill - b.effectiveSkill);
  const weak = failers[0];
  if (weak) {
    if (weak.effectiveSkill < config.maxMemberSkill) {
      recs.push({ kind: 'skill', memberId: weak.memberId, text: `Train ${weak.name} (skill ${weak.effectiveSkill}) — the weak link this run.` });
    }
    if (weak.gearIds.length < GEAR.length) {
      recs.push({ kind: 'gear', memberId: weak.memberId, text: `Gear up ${weak.name} — better tools lift their odds.` });
    }
  }

  // 4. Heat drag.
  if (heat >= config.maxHeat * 0.4) {
    recs.push({
      kind: 'heat',
      text: `Heat cost you this run. Buy Burner Phones / Corrupt Official or let it cool before launching.`,
    });
  }

  // 5. Push for the perfect-run bonus.
  if (success && !perfect) {
    const bonusPct = Math.round((config.perfectBonusMult - 1) * 100);
    recs.push({
      kind: 'skill',
      text: `Get all ${crewSize} passing for the flawless bonus (+${bonusPct}% take).`,
    });
  }

  return recs.slice(0, 4);
}
