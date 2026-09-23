// -----------------------------------------------------------------------------
// HEIST ACTIONS: launch + collect
// -----------------------------------------------------------------------------
// Launch: validates the crew (size minimum + required roles), applies heat cost,
// locks the crew, and records start/end timestamps. Collect: only allowed once
// now >= endsAt; runs the per-member resolution (see resolution.ts), applies the
// take/heat, frees the crew, and returns the full after-action report.
//
// Randomness is injected via `rng` so resolution is deterministic under test.
// -----------------------------------------------------------------------------

import { CONFIG } from '../data/config';
import type { Config } from '../data/config';
import { approachFor, type ApproachId } from '../data/approaches';
import { featuredBonusFor } from './featured';
import { eventEffectFor, eventForHeist } from './events';
import { HEISTS_BY_ID } from '../data/heists';
import type { HeistDef } from '../data/heists';
import { ROLES_BY_ID } from '../data/roles';
import { formatCash } from './format';
import { addHeat, settleHeat } from './heat';
import {
  clamp,
  contractHeistDef,
  contractUnlocked,
  deriveHeat,
  getCrew,
  getMember,
  healthyCrew,
  heatGainMult,
  heistDefFor,
  isContract,
  isHeistUnlocked,
  isMemberDown,
  missingRoles,
  prepCostFor,
} from './selectors';
import { makeRng, minMembersFor, resolveHeist } from './resolution';
import type { ActionResult, GameState, HeistReport, Member } from './types';

/** Launch a heist: assign a crew and start the timer. */
/**
 * Why a launch would be rejected right now, or null if it would succeed. Pure —
 * the UI uses it to gate "Run it again" (so it never fires-then-closes on a
 * launch that can't happen, e.g. heat maxed by the collect that just landed).
 */
export function launchBlockReason(
  state: GameState,
  heistId: string,
  crewId: string,
  now: number,
  config: Config = CONFIG,
  // Optional pre-resolved def so launchHeist doesn't derive it twice (the
  // Fixer relaunches in a tight loop). Defaults to resolving it here.
  heist: HeistDef | undefined = heistDefFor(heistId, state, config),
): string | null {
  if (!heist) return 'Unknown heist.';
  if (isContract(heistId)) {
    if (!contractUnlocked(state)) return 'That contract is still locked.';
  } else if (!isHeistUnlocked(state, heist)) {
    return 'That heist is still locked.';
  }

  const crew = getCrew(state, crewId);
  if (!crew) return 'Unknown crew.';
  if (crew.status !== 'idle') return 'That crew is already on a job.';

  // Injured members sit out — gate on who can actually be sent right now.
  const available = healthyCrew(state, crew, now);
  const minMembers = minMembersFor(heist, config);
  if (available.memberIds.length < minMembers) {
    const hurt = crew.memberIds.length - available.memberIds.length;
    return hurt > 0
      ? `Too many crew are recovering — this job needs ${minMembers} on their feet.`
      : `This job needs at least ${minMembers} crew members.`;
  }

  const missing = missingRoles(state, available, heist);
  if (missing.length > 0) {
    const names = missing.map((r) => ROLES_BY_ID[r]?.name ?? r).join(', ');
    return `Crew is missing required role(s): ${names}.`;
  }

  if (deriveHeat(state, now, config) >= config.maxHeat) {
    return 'Heat is maxed out - lie low until it cools.';
  }
  return null;
}

export function launchHeist(
  state: GameState,
  heistId: string,
  crewId: string,
  now: number,
  seed: number = Math.floor(Math.random() * 0x100000000),
  config: Config = CONFIG,
  approachId?: ApproachId,
  prep = false,
): ActionResult {
  const heist = heistDefFor(heistId, state, config);
  const blocked = launchBlockReason(state, heistId, crewId, now, config, heist);
  if (blocked) return { ok: false, error: blocked };
  // launchBlockReason returned null, so a def exists (the '!' is sound here).
  const def = heist!;
  const approach = approachFor(approachId);

  // Lock in the featured payout bonus (if any) at launch — authoritative, so a
  // rotation before collect can't change it and the client can't inflate it.
  const featuredMult = featuredBonusFor(heistId, now, config);
  // Living-map event modifiers, also locked in at launch. Featured and events are
  // mutually exclusive per job (featured wins), so a job carries at most one
  // special condition — no payout double-dip and one thing to read on the pin.
  const eventEff = featuredMult > 1 ? null : eventEffectFor(heistId, now, config);
  const eventHeatMult = eventEff?.heatMult ?? 1;

  // Ambient heat the moment we commit (BEFORE this job's own cost is added). The
  // job resolves against this at collect, so launching while hot stays costly for
  // long jobs too, while a cooled-down launch (heat ~0) is unaffected.
  const heatAtLaunch = deriveHeat(state, now, config);

  // Heat is applied at launch (committing to a job raises heat immediately);
  // the approach scales it (loud is hotter, ghost cooler) and an event can too.
  let next = addHeat(
    state,
    def.heatCost * heatGainMult(state) * approach.heatMult * eventHeatMult,
    now,
    config,
  );

  // Optional "case the job" prep: pay a cash premium up front for an odds bump
  // this run. If it can't be afforded, the job simply launches without it.
  let prepOdds: number | undefined;
  if (prep) {
    const prepCost = prepCostFor(def, config);
    if (next.cash >= prepCost) {
      next = { ...next, cash: next.cash - prepCost };
      prepOdds = config.prepOddsBonus;
    }
  }

  // Snapshot the healthy members who actually go, so an injury (or recovery)
  // after launch can't change who resolves this job.
  const participants = healthyCrew(state, getCrew(state, crewId)!, now).memberIds;

  // Event odds/reward are also locked in (heat was already applied above).
  const eventOddsDelta = eventEff?.oddsDelta ?? 0;
  const eventRewardMult = eventEff?.rewardMult ?? 1;
  const eventActive = eventEff != null && (eventRewardMult !== 1 || eventOddsDelta !== 0);

  const active = {
    id: `h${next.nextId}`,
    heistId,
    crewId,
    startedAt: now,
    endsAt: now + Math.round(def.durationSec * approach.timeMult) * 1000,
    seed: seed >>> 0,
    heatAtLaunch,
    approachId: approach.id,
    memberIds: participants,
    ...(prepOdds != null ? { prepOdds } : {}),
    ...(featuredMult > 1 ? { featuredMult } : {}),
    ...(eventActive ? { eventId: eventForHeist(heistId, now, config)?.def.id } : {}),
    ...(eventRewardMult !== 1 ? { eventRewardMult } : {}),
    ...(eventOddsDelta !== 0 ? { eventOddsDelta } : {}),
    ...(isContract(heistId) ? { contractLevel: state.contractLevel } : {}),
  };

  next = {
    ...next,
    nextId: next.nextId + 1,
    activeHeists: [...next.activeHeists, active],
    crews: next.crews.map((c) => (c.id === crewId ? { ...c, status: 'onHeist' as const } : c)),
  };

  return { ok: true, state: next, message: `${def.name} underway.` };
}

/** Collect a finished heist: resolve per member, apply results, free the crew. */
export function collectHeist(
  state: GameState,
  activeHeistId: string,
  now: number,
  rng?: () => number,
  config: Config = CONFIG,
): ActionResult & { report?: HeistReport } {
  const active = state.activeHeists.find((a) => a.id === activeHeistId);
  if (!active) return { ok: false, error: 'That heist no longer exists.' };
  if (now < active.endsAt) return { ok: false, error: 'That heist is still in progress.' };

  // Use the contract's level snapshotted at launch (its def escalates over time).
  const heist =
    active.contractLevel != null
      ? contractHeistDef(active.contractLevel, config)
      : HEISTS_BY_ID[active.heistId];
  const crew = getCrew(state, active.crewId);

  const freeCrew = (s: GameState): GameState => ({
    ...s,
    activeHeists: s.activeHeists.filter((a) => a.id !== activeHeistId),
    crews: s.crews.map((c) => (c.id === active.crewId ? { ...c, status: 'idle' as const } : c)),
  });

  if (!heist || !crew) {
    // Corrupt reference - free the crew and drop the heist defensively.
    return { ok: true, state: freeCrew(state), message: 'Collected.' };
  }

  // Determinism: outcome is fixed by the seed stored at launch (falls back to
  // Math.random only for pre-seed saves). Tests can still inject their own rng.
  const roll = rng ?? (active.seed != null ? makeRng(active.seed) : Math.random);
  // Resolve against the heat captured at launch (older saves lack it and fall
  // back to current heat inside resolveHeist). The approach chosen at launch
  // scales the take and shifts the odds (older saves default to neutral).
  const approach = approachFor(active.approachId);
  // Resolve over the members who actually went (snapshot at launch), so a
  // mid-job injury/recovery elsewhere can't change this job's outcome.
  const participantsCrew = active.memberIds ? { ...crew, memberIds: active.memberIds } : crew;
  const report = resolveHeist(state, heist, participantsCrew, now, roll, config, active.heatAtLaunch, {
    oddsDelta: approach.oddsDelta + (active.prepOdds ?? 0) + (active.eventOddsDelta ?? 0),
    rewardMult: approach.rewardMult * (active.featuredMult ?? 1) * (active.eventRewardMult ?? 1),
  });
  // Attribute the living-map event this job ran under, for the debrief.
  if (active.eventId) report.eventId = active.eventId;

  // Stakes: a blown job can sideline a member (worse the hotter it was), but
  // never the crew's last healthy member. Uses the same seeded rng stream, so
  // the injury is fixed at launch and can't be reload-rerolled.
  let injured: Member | undefined;
  if (!report.success) {
    const heatFrac = clamp((active.heatAtLaunch ?? report.heatAtResolve) / config.maxHeat, 0, 1);
    const chance = config.injuryChanceBase + config.injuryChanceHeatMax * heatFrac;
    if (roll() < chance) {
      const healthyIds = crew.memberIds.filter((id) => {
        const m = getMember(state, id);
        return m && !isMemberDown(m, now);
      });
      if (healthyIds.length > 1) {
        // Prefer someone who blew their part; fall back to any healthy member.
        const failed = report.members.filter((b) => !b.passed && healthyIds.includes(b.memberId));
        const pool = failed.length ? failed.map((b) => b.memberId) : healthyIds;
        const pick = pool[Math.min(pool.length - 1, Math.floor(roll() * pool.length))];
        injured = getMember(state, pick);
      }
    }
  }

  let next = freeCrew(state);
  if (injured) {
    const downUntil = now + config.injuryRecoverySec * 1000;
    next = {
      ...next,
      members: next.members.map((m) => (m.id === injured!.id ? { ...m, downUntil } : m)),
    };
  }

  // Career totals (persist across prestige; drive milestones).
  next = {
    ...next,
    stats: {
      heistsCompleted: next.stats.heistsCompleted + 1,
      heistsSucceeded: next.stats.heistsSucceeded + (report.success ? 1 : 0),
      flawless: next.stats.flawless + (report.perfect ? 1 : 0),
      biggestScore: Math.max(next.stats.biggestScore, report.payout),
    },
  };

  if (report.payout > 0) {
    // includes salvage on a failed run
    next = {
      ...next,
      cash: next.cash + report.payout,
      lifetimeCash: next.lifetimeCash + report.payout,
      careerCash: next.careerCash + report.payout,
    };
  }
  // Clearing a contract escalates the next one.
  if (report.success && isContract(active.heistId)) {
    next = { ...next, contractLevel: next.contractLevel + 1 };
  }
  if (report.heatAdded > 0) {
    next = addHeat(next, report.heatAdded, now, config);
  }

  let message =
    report.payout > 0 ? `${report.headline} · +${formatCash(report.payout)}` : report.headline;
  if (injured) message += ` · ${injured.name} was hurt`;
  return { ok: true, state: next, message, report };
}

/** Collect every finished heist at once (bulk). Returns a summary; individual
 *  collect still resolves the seeded outcome and updates stats/contract. */
export function collectAllReady(
  state: GameState,
  now: number,
  config: Config = CONFIG,
): { state: GameState; collected: number; earned: number } {
  const readyIds = state.activeHeists.filter((a) => now >= a.endsAt).map((a) => a.id);
  let s = state;
  let collected = 0;
  let earned = 0;
  for (const id of readyIds) {
    const res = collectHeist(s, id, now, undefined, config);
    if (res.ok) {
      s = res.state;
      collected += 1;
      earned += res.report?.payout ?? 0;
    }
  }
  return { state: s, collected, earned };
}

/** Settle heat to `now` without any other change (used on focus/visibility). */
export function refreshHeat(state: GameState, now: number, config: Config = CONFIG): GameState {
  return settleHeat(state, now, config);
}
