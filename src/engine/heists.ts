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
import { ROLES_BY_ID } from '../data/roles';
import { addHeat, settleHeat } from './heat';
import { deriveHeat, getCrew, heatGainMult, isHeistUnlocked, missingRoles } from './selectors';
import { makeRng, minMembersFor, resolveHeist } from './resolution';
import type { ActionResult, GameState, HeistReport } from './types';

/** Launch a heist: assign a crew and start the timer. */
export function launchHeist(
  state: GameState,
  heistId: string,
  crewId: string,
  now: number,
  seed: number = Math.floor(Math.random() * 0x100000000),
  config: Config = CONFIG,
): ActionResult {
  const heist = HEISTS_BY_ID[heistId];
  if (!heist) return { ok: false, error: 'Unknown heist.' };
  if (!isHeistUnlocked(state, heist)) return { ok: false, error: 'That heist is still locked.' };

  const crew = getCrew(state, crewId);
  if (!crew) return { ok: false, error: 'Unknown crew.' };
  if (crew.status !== 'idle') return { ok: false, error: 'That crew is already on a job.' };

  const minMembers = minMembersFor(heist, config);
  if (crew.memberIds.length < minMembers) {
    return { ok: false, error: `This job needs at least ${minMembers} crew members.` };
  }

  const missing = missingRoles(state, crew, heist);
  if (missing.length > 0) {
    const names = missing.map((r) => ROLES_BY_ID[r]?.name ?? r).join(', ');
    return { ok: false, error: `Crew is missing required role(s): ${names}.` };
  }

  if (deriveHeat(state, now, config) >= config.maxHeat) {
    return { ok: false, error: 'Heat is maxed out - lie low until it cools.' };
  }

  // Heat is applied at launch (committing to a job raises heat immediately).
  let next = addHeat(state, heist.heatCost * heatGainMult(state), now, config);

  const active = {
    id: `h${next.nextId}`,
    heistId,
    crewId,
    startedAt: now,
    endsAt: now + heist.durationSec * 1000,
    seed: seed >>> 0,
  };

  next = {
    ...next,
    nextId: next.nextId + 1,
    activeHeists: [...next.activeHeists, active],
    crews: next.crews.map((c) => (c.id === crewId ? { ...c, status: 'onHeist' as const } : c)),
  };

  return { ok: true, state: next, message: `${heist.name} underway.` };
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

  const heist = HEISTS_BY_ID[active.heistId];
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
  if (report.payout > 0) {
    // includes salvage on a failed run
    next = { ...next, cash: next.cash + report.payout, lifetimeCash: next.lifetimeCash + report.payout };
  }
  if (report.heatAdded > 0) {
    next = addHeat(next, report.heatAdded, now, config);
  }

  return { ok: true, state: next, message: report.headline, report };
}

/** Settle heat to `now` without any other change (used on focus/visibility). */
export function refreshHeat(state: GameState, now: number, config: Config = CONFIG): GameState {
  return settleHeat(state, now, config);
}
