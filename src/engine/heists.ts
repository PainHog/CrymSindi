// -----------------------------------------------------------------------------
// HEIST ACTIONS: launch + collect
// -----------------------------------------------------------------------------
// Launch: validates the crew, applies heat cost, locks the crew, and records
// start/end timestamps. Collect: only allowed once now >= endsAt; rolls the
// success chance (roll-at-collect), applies cash/heat, and frees the crew.
//
// All randomness is injected via `rng` so the resolution math is deterministic
// under test.
// -----------------------------------------------------------------------------

import { CONFIG } from '../data/config';
import type { Config } from '../data/config';
import { HEISTS_BY_ID } from '../data/heists';
import { addHeat, settleHeat } from './heat';
import {
  deriveHeat,
  getCrew,
  heatGainMult,
  isHeistUnlocked,
  missingRoles,
  payoutMult,
  successChance,
} from './selectors';
import { ROLES_BY_ID } from '../data/roles';
import type { ActionResult, CollectOutcome, GameState } from './types';

/** Launch a heist: assign a crew and start the timer. */
export function launchHeist(
  state: GameState,
  heistId: string,
  crewId: string,
  now: number,
  config: Config = CONFIG,
): ActionResult {
  const heist = HEISTS_BY_ID[heistId];
  if (!heist) return { ok: false, error: 'Unknown heist.' };
  if (!isHeistUnlocked(state, heist)) return { ok: false, error: 'That heist is still locked.' };

  const crew = getCrew(state, crewId);
  if (!crew) return { ok: false, error: 'Unknown crew.' };
  if (crew.status !== 'idle') return { ok: false, error: 'That crew is already on a job.' };
  if (crew.memberIds.length === 0) return { ok: false, error: 'That crew has no members.' };

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
  };

  next = {
    ...next,
    nextId: next.nextId + 1,
    activeHeists: [...next.activeHeists, active],
    crews: next.crews.map((c) => (c.id === crewId ? { ...c, status: 'onHeist' as const } : c)),
  };

  return { ok: true, state: next, message: `${heist.name} underway.` };
}

/** Collect a finished heist: roll success, apply results, free the crew. */
export function collectHeist(
  state: GameState,
  activeHeistId: string,
  now: number,
  rng: () => number = Math.random,
  config: Config = CONFIG,
): ActionResult & { outcome?: CollectOutcome } {
  const active = state.activeHeists.find((a) => a.id === activeHeistId);
  if (!active) return { ok: false, error: 'That heist no longer exists.' };
  if (now < active.endsAt) return { ok: false, error: 'That heist is still in progress.' };

  const heist = HEISTS_BY_ID[active.heistId];
  const crew = getCrew(state, active.crewId);
  if (!heist || !crew) {
    // Corrupt reference - free the crew and drop the heist defensively.
    const cleaned: GameState = {
      ...state,
      activeHeists: state.activeHeists.filter((a) => a.id !== activeHeistId),
      crews: state.crews.map((c) =>
        c.id === active.crewId ? { ...c, status: 'idle' as const } : c,
      ),
    };
    return { ok: true, state: cleaned, message: 'Collected.' };
  }

  const chance = successChance(state, heist, crew, now, config);
  const success = rng() < chance;

  // Remove the active heist and unlock the crew regardless of outcome.
  let next: GameState = {
    ...state,
    activeHeists: state.activeHeists.filter((a) => a.id !== activeHeistId),
    crews: state.crews.map((c) =>
      c.id === active.crewId ? { ...c, status: 'idle' as const } : c,
    ),
  };

  let payout = 0;
  let heatAdded = 0;
  let message: string;

  if (success) {
    const span = heist.payoutMax - heist.payoutMin;
    payout = Math.round((heist.payoutMin + rng() * span) * payoutMult(state));
    next = { ...next, cash: next.cash + payout, lifetimeCash: next.lifetimeCash + payout };
    message = `${heist.name} succeeded! +$${payout.toLocaleString()}`;
  } else {
    heatAdded = heist.failHeatBonus * heatGainMult(state);
    next = addHeat(next, heatAdded, now, config);
    message = `${heist.name} failed. The crew got out, but the heat is on.`;
  }

  const outcome: CollectOutcome = {
    success,
    chance,
    payout,
    heatAdded,
    heistId: heist.id,
  };

  return { ok: true, state: next, message, outcome };
}

/** Settle heat to `now` without any other change (used on focus/visibility). */
export function refreshHeat(state: GameState, now: number, config: Config = CONFIG): GameState {
  return settleHeat(state, now, config);
}
