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
import { HEISTS_BY_ID } from '../data/heists';
import type { HeistDef } from '../data/heists';
import { ROLES_BY_ID } from '../data/roles';
import { formatCash } from './format';
import { addHeat, settleHeat } from './heat';
import {
  contractHeistDef,
  contractUnlocked,
  deriveHeat,
  getCrew,
  heatGainMult,
  heistDefFor,
  isContract,
  isHeistUnlocked,
  missingRoles,
} from './selectors';
import { makeRng, minMembersFor, resolveHeist } from './resolution';
import type { ActionResult, GameState, HeistReport } from './types';

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

  const minMembers = minMembersFor(heist, config);
  if (crew.memberIds.length < minMembers) {
    return `This job needs at least ${minMembers} crew members.`;
  }

  const missing = missingRoles(state, crew, heist);
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
): ActionResult {
  const heist = heistDefFor(heistId, state, config);
  const blocked = launchBlockReason(state, heistId, crewId, now, config, heist);
  if (blocked) return { ok: false, error: blocked };
  // launchBlockReason returned null, so a def exists (the '!' is sound here).
  const def = heist!;

  // Heat is applied at launch (committing to a job raises heat immediately).
  let next = addHeat(state, def.heatCost * heatGainMult(state), now, config);

  const active = {
    id: `h${next.nextId}`,
    heistId,
    crewId,
    startedAt: now,
    endsAt: now + def.durationSec * 1000,
    seed: seed >>> 0,
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
  const report = resolveHeist(state, heist, crew, now, roll, config);

  let next = freeCrew(state);

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

  const message =
    report.payout > 0 ? `${report.headline} · +${formatCash(report.payout)}` : report.headline;
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
