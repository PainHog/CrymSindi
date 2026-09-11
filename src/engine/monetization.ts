// -----------------------------------------------------------------------------
// MONETIZATION (engine side) — premium currency + reward grants
// -----------------------------------------------------------------------------
// Pure state transitions for the "Marks" premium currency and for the rewards
// that rewarded-ads / IAP grant. The UI drives the (stubbed, no-network) ad
// flow in src/monetization/ads.ts and calls these on completion. Nothing here
// touches a network or a store.
// -----------------------------------------------------------------------------

import { CONFIG } from '../data/config';
import type { Config } from '../data/config';
import type { ActionResult, GameState } from './types';

/** Grant premium currency (from the stubbed IAP or a "free Marks" ad). */
export function grantMarks(state: GameState, amount: number): ActionResult {
  const n = Math.max(0, Math.floor(amount));
  if (n <= 0) return { ok: false, error: 'Nothing to grant.' };
  return { ok: true, state: { ...state, marks: state.marks + n }, message: `+${n} Marks.` };
}

/**
 * Grant the "double the take" reward from a rewarded ad. `amount` is the take
 * that was just collected; doubling it is legitimate income (the heist really
 * happened), so it counts toward lifetime/career like any collect.
 */
export function rewardBonusCash(state: GameState, amount: number): ActionResult {
  const n = Math.max(0, Math.round(amount));
  if (n <= 0) return { ok: false, error: 'No take to double.' };
  return {
    ok: true,
    state: {
      ...state,
      cash: state.cash + n,
      lifetimeCash: state.lifetimeCash + n,
      careerCash: state.careerCash + n,
    },
    message: `Take doubled — +$${n}.`,
  };
}

/** Finish one active heist immediately (a rewarded-ad "skip cooldown"). */
export function skipCooldown(state: GameState, activeHeistId: string, now: number): ActionResult {
  const active = state.activeHeists.find((a) => a.id === activeHeistId);
  if (!active) return { ok: false, error: 'That job is not running.' };
  if (now >= active.endsAt) return { ok: false, error: 'That job is already done.' };
  return {
    ok: true,
    state: {
      ...state,
      activeHeists: state.activeHeists.map((a) => (a.id === activeHeistId ? { ...a, endsAt: now } : a)),
    },
    message: 'Cooldown skipped.',
  };
}

/** Spend Marks to finish every running heist at once (premium convenience). */
export function finishAllNow(state: GameState, now: number, config: Config = CONFIG): ActionResult {
  const running = state.activeHeists.filter((a) => now < a.endsAt);
  if (running.length === 0) return { ok: false, error: 'No jobs are running.' };
  if (state.marks < config.finishAllMarksCost) return { ok: false, error: 'Not enough Marks.' };
  return {
    ok: true,
    state: {
      ...state,
      marks: state.marks - config.finishAllMarksCost,
      activeHeists: state.activeHeists.map((a) => (now < a.endsAt ? { ...a, endsAt: now } : a)),
    },
    message: `Rushed ${running.length} job${running.length > 1 ? 's' : ''} home.`,
  };
}
